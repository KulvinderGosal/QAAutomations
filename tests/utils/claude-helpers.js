/**
 * Claude (Anthropic API) Helpers for QA Automation
 *
 * This module is the "System Two" layer behind Jev (see jev-helpers.js).
 *
 * Jev makes fast, cheap, typed decisions with a calibrated confidence score.
 * When Jev is confident, act on its answer. When it isn't (confidence below the
 * threshold), escalate to Claude for a human-readable diagnosis of what is
 * actually on the page and why the check is ambiguous. This mirrors the
 * documented Jev pattern: act on high confidence, send the uncertain middle to
 * a more capable model, hand the rest to a human.
 *
 * Uses the official Anthropic SDK (@anthropic-ai/sdk) via CommonJS require.
 * The SDK is loaded lazily so tests that never touch Claude don't require it.
 *
 * Requires an Anthropic API key. Set ANTHROPIC_API_KEY in your .env (never
 * commit it). Use `isConfigured()` to skip Claude-dependent tests gracefully.
 */

const config = require('./config');
const { jevAsk } = require('./jev-helpers');

let _Anthropic = null;
function loadSdk() {
  if (!_Anthropic) {
    try {
      _Anthropic = require('@anthropic-ai/sdk');
    } catch (err) {
      throw new Error(
        'The Anthropic SDK is not installed. Run: npm install @anthropic-ai/sdk'
      );
    }
  }
  return _Anthropic;
}

/**
 * Client for the Anthropic (Claude) Messages API, tuned for QA use.
 */
class ClaudeClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]   - Defaults to config.claude.apiKey (ANTHROPIC_API_KEY).
   * @param {string} [options.model]    - Defaults to config.claude.model (CLAUDE_MODEL).
   * @param {number} [options.maxTokens]- Defaults to config.claude.maxTokens (CLAUDE_MAX_TOKENS).
   * @param {number} [options.timeout]  - Request timeout in ms. Defaults to config.claude.timeout.
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.claude.apiKey;
    this.model = options.model || config.claude.model;
    this.maxTokens = options.maxTokens || config.claude.maxTokens;
    this.timeout = options.timeout || config.claude.timeout;
    this._client = null;
  }

  /**
   * Whether an API key is configured. Use this to skip tests gracefully.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Lazily construct and cache the underlying Anthropic client.
   * @returns {Object} The Anthropic SDK client instance.
   */
  client() {
    if (!this._client) {
      const Anthropic = loadSdk();
      this._client = new Anthropic({ apiKey: this.apiKey, timeout: this.timeout });
    }
    return this._client;
  }

  /**
   * Send a single-turn message to Claude and return the concatenated text.
   *
   * @param {Object} params
   * @param {string} params.prompt   - The user message.
   * @param {string} [params.system] - Optional system prompt.
   * @param {number} [params.maxTokens] - Override max_tokens for this call.
   * @param {string} [params.model]  - Override the model for this call.
   * @returns {Promise<string>} Claude's text response.
   */
  async complete({ prompt, system, maxTokens, model } = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        'Claude is not configured: set ANTHROPIC_API_KEY in your environment (.env). ' +
        'Use ClaudeClient#isConfigured() to skip tests when no key is present.'
      );
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('complete(): "prompt" must be a non-empty string');
    }

    const request = {
      model: model || this.model,
      max_tokens: maxTokens || this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
    if (system) request.system = system;

    let response;
    try {
      response = await this.client().messages.create(request);
    } catch (err) {
      // Anthropic.APIError subclasses carry a numeric `status`.
      const status = err && err.status ? ` (HTTP ${err.status})` : '';
      throw new Error(`Claude request failed${status}: ${err.message}`);
    }

    // response.content is a list of typed blocks; keep only the text.
    return (response.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
  }

  /**
   * Ask Claude to diagnose an ambiguous UI state. Returns a structured verdict.
   *
   * @param {string} state - The content to look at (e.g. visible page text).
   * @param {Object} [context]
   * @param {string} [context.question] - The original question being decided.
   * @param {string} [context.expected] - What the test expected to see.
   * @param {Object} [context.jev]      - The (low-confidence) Jev result, for context.
   * @returns {Promise<{summary: string, likelyState: string, suggestedFix: string, confident: boolean, raw: string}>}
   */
  async diagnose(state, context = {}) {
    const system =
      'You are a senior QA automation engineer analyzing a web application under test. ' +
      'You are given the visible content of a page and a question a fast classifier could ' +
      'not answer confidently. Reason about what state the page is actually in and reply ' +
      'ONLY with a compact JSON object (no markdown, no code fences) with these keys: ' +
      '"summary" (one sentence describing what the page shows), ' +
      '"likelyState" (one of: success, error, empty, loading, unexpected), ' +
      '"suggestedFix" (a short hint for the test author, e.g. a better selector or wait), ' +
      '"confident" (boolean: whether you are confident in this diagnosis).';

    const parts = [];
    if (context.question) parts.push(`Question being decided: ${context.question}`);
    if (context.expected) parts.push(`Test expected: ${context.expected}`);
    if (context.jev) parts.push(`Fast classifier (Jev) result: ${JSON.stringify(context.jev)}`);
    parts.push('Page content:\n"""\n' + String(state) + '\n"""');

    const text = await this.complete({ system, prompt: parts.join('\n\n') });

    // Parse defensively — model output should be JSON but we never assume it.
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (_e) { /* fall through */ }
      }
    }

    return {
      summary: parsed.summary || text,
      likelyState: parsed.likelyState || 'unexpected',
      suggestedFix: parsed.suggestedFix || '',
      confident: Boolean(parsed.confident),
      raw: text,
    };
  }
}

/**
 * A shared client instance built from config/env.
 */
const claude = new ClaudeClient();

/**
 * System 1 -> System 2: ask Jev a yes/no question; if Jev is not confident,
 * escalate to Claude for a diagnosis. This is the core Jev + Claude integration.
 *
 * @param {(string|Object)} state - The content to evaluate (e.g. page text).
 * @param {string} question - The yes/no question.
 * @param {Object} [options]
 * @param {number} [options.minConfidence] - Confidence floor for Jev (see config.jev).
 * @param {string} [options.expected] - What the test expected (passed to Claude).
 * @param {ClaudeClient} [options.claudeClient] - A specific Claude client.
 * @returns {Promise<{
 *   yes: boolean, probability: number, confidence: number, decisive: boolean,
 *   escalated: boolean, claude: (Object|null)
 * }>}
 *
 * @example
 * const r = await jevWithClaudeFallback(pageText,
 *   'Did the broadcast send successfully?', { expected: 'a success toast' });
 * if (r.decisive) {
 *   expect(r.yes).toBe(true);            // Jev was confident — trust it
 * } else {
 *   console.warn('Jev unsure:', r.claude.summary, '| fix:', r.claude.suggestedFix);
 * }
 */
async function jevWithClaudeFallback(state, question, options = {}) {
  const r = await jevAsk(state, question, {
    minConfidence: options.minConfidence,
  });

  if (r.decisive) {
    return { ...r, escalated: false, claude: null };
  }

  const client = options.claudeClient || claude;
  if (!client.isConfigured()) {
    return { ...r, escalated: false, claude: null };
  }

  const diagnosis = await client.diagnose(state, {
    question,
    expected: options.expected,
    jev: { probability: r.probability, confidence: r.confidence },
  });

  return { ...r, escalated: true, claude: diagnosis };
}

module.exports = {
  ClaudeClient,
  claude,
  jevWithClaudeFallback,
};
