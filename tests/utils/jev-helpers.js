/**
 * TypeSafe Jev (System One) Helpers for QA Automation
 *
 * Jev is TypeSafe AI's "System One" decision model. Unlike a chat LLM, it does
 * not generate free text. You give it a `state` (the thing to look at) and a
 * map of typed `questions`, and it returns typed, calibrated answers with a
 * confidence score between 0 and 1.
 *
 * In a QA context this is useful for assertions that are brittle with pure
 * selectors, for example:
 *   - "Did this page confirm the broadcast was sent?"  (yes/no + confidence)
 *   - "Is this an error / empty / success state?"       (choice + confidence)
 *   - "How severe does this validation message look?"   (score + confidence)
 *
 * This module is a thin, dependency-free wrapper over the REST endpoint
 * (POST {baseUrl}/v1/systemone) using Node's global `fetch` (Node >= 18).
 * The official SDK (`@typesafe-ai/sdk`) is an ESM/Node-20 package; this repo is
 * CommonJS, so we call the API directly and keep the same question shape.
 *
 * Docs: https://docs.typesafe.ai
 *
 * IMPORTANT: requests require a TypeSafe API key. Set TYPESAFE_API_KEY in your
 * .env (never commit it). Tests that use Jev should skip gracefully when no key
 * is configured — see `isConfigured()` and the example spec.
 */

const config = require('./config');

/**
 * Build a "choice" question: pick exactly one of a set of named options.
 *
 * @param {string} instructions - What the model should decide.
 * @param {Object<string,string>} options - Map of optionName -> description.
 *   Up to 255 options are supported.
 * @returns {Object} A question object for the `questions` map.
 *
 * @example
 * choice('What state is this page in?', {
 *   success: 'A success/confirmation message is shown.',
 *   error:   'An error or failure message is shown.',
 *   empty:   'There is no data / an empty state.',
 *   other:   'None of the above clearly fits.'
 * });
 */
function choice(instructions, options) {
  if (!instructions || typeof instructions !== 'string') {
    throw new Error('choice(instructions, options): "instructions" must be a non-empty string');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('choice(instructions, options): "options" must be a map of name -> description');
  }
  return { type: 'choice', instructions, options };
}

/**
 * Build a "score" question: rate the state against ordered, descriptive levels
 * (a rubric). Provide between 2 and 10 levels, ordered lowest -> highest.
 *
 * @param {string} instructions - What the model should rate.
 * @param {string[]} levels - Ordered level descriptions (2-10 entries).
 * @returns {Object} A question object for the `questions` map.
 *
 * @example
 * score('How severe is the on-screen error?', [
 *   'No error at all',
 *   'A minor, non-blocking warning',
 *   'A blocking error that stops the user'
 * ]);
 */
function score(instructions, levels) {
  if (!instructions || typeof instructions !== 'string') {
    throw new Error('score(instructions, levels): "instructions" must be a non-empty string');
  }
  if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10) {
    throw new Error('score(instructions, levels): "levels" must be an array of 2-10 descriptions');
  }
  return { type: 'score', instructions, levels };
}

/**
 * Build a "noul" question: a yes/no question. The answer is the probability of
 * "yes" (0..1).
 *
 * @param {string} instructions - The yes/no question.
 * @returns {Object} A question object for the `questions` map.
 *
 * @example
 * noul('Does the page confirm the broadcast was sent successfully?');
 */
function noul(instructions) {
  if (!instructions || typeof instructions !== 'string') {
    throw new Error('noul(instructions): "instructions" must be a non-empty string');
  }
  return { type: 'noul', instructions };
}

/**
 * Client for the TypeSafe Jev System One API.
 */
class JevClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]  - Defaults to config.jev.apiKey (TYPESAFE_API_KEY).
   * @param {string} [options.baseUrl] - Defaults to config.jev.baseUrl (TYPESAFE_BASE_URL).
   * @param {string} [options.model]   - Defaults to config.jev.model (JEV_MODEL).
   * @param {number} [options.timeout] - Request timeout in ms. Defaults to config.jev.timeout.
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.jev.apiKey;
    this.baseUrl = (options.baseUrl || config.jev.baseUrl).replace(/\/+$/, '');
    this.model = options.model || config.jev.model;
    this.timeout = options.timeout || config.jev.timeout;
  }

  /**
   * Whether an API key is configured. Use this to skip tests gracefully.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Low-level call to POST {baseUrl}/v1/systemone.
   *
   * @param {Object} params
   * @param {(string|Object)} params.state - The content to evaluate.
   * @param {Object<string,Object>} params.questions - Map of name -> question
   *   object (from choice()/score()/noul(), or a raw {type, ...} object).
   * @param {string} [params.model] - Override the default model for this call.
   * @returns {Promise<Object>} The parsed API response (includes `answers` and `usage`).
   */
  async systemOne({ state, questions, model } = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        'Jev is not configured: set TYPESAFE_API_KEY in your environment (.env). ' +
        'Use JevClient#isConfigured() to skip tests when no key is present.'
      );
    }
    if (state === undefined || state === null) {
      throw new Error('systemOne(): "state" is required');
    }
    if (!questions || typeof questions !== 'object' || Object.keys(questions).length === 0) {
      throw new Error('systemOne(): "questions" must be a non-empty map of typed questions');
    }

    const url = `${this.baseUrl}/v1/systemone`;
    const body = JSON.stringify({ model: model || this.model, state, questions });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Jev request timed out after ${this.timeout}ms (${url})`);
      }
      throw new Error(`Jev request failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { raw: text };
    }

    if (!response.ok) {
      const detail = data && (data.error || data.message) ? (data.error || data.message) : text;
      throw new Error(`Jev API error ${response.status} ${response.statusText}: ${detail}`);
    }

    return data;
  }

  /**
   * Convenience wrapper that returns just the `answers` map.
   *
   * @param {(string|Object)} state - The content to evaluate.
   * @param {Object<string,Object>} questions - Map of name -> question object.
   * @param {Object} [options] - Passed through to systemOne (e.g. { model }).
   * @returns {Promise<Object>} The `answers` map keyed by question name.
   *
   * @example
   * const answers = await client.ask(pageText, {
   *   sent: noul('Was the broadcast sent successfully?'),
   * });
   * // answers.sent.noul -> 0.97, answers.sent.confidence -> 0.9
   */
  async ask(state, questions, options = {}) {
    const result = await this.systemOne({ state, questions, ...options });
    return (result && result.answers) || {};
  }
}

/**
 * A shared client instance built from config/env. Prefer `new JevClient()` when
 * you need custom settings.
 */
const jev = new JevClient();

/**
 * Extract a comparable primitive value from a single Jev answer, regardless of
 * question type: choice -> string, score -> string/level, noul -> number(0..1).
 *
 * @param {Object} answer - One entry from the `answers` map.
 * @returns {(string|number|undefined)}
 */
function answerValue(answer) {
  if (!answer || typeof answer !== 'object') return undefined;
  if ('choice' in answer) return answer.choice;
  if ('score' in answer) return answer.score;
  if ('noul' in answer) return answer.noul;
  return undefined;
}

/**
 * QA convenience: ask Jev a single yes/no (noul) question about some state and
 * assert the answer with a confidence floor. Returns a structured result so the
 * caller can decide how to assert (e.g. with Playwright's `expect`).
 *
 * @param {(string|Object)} state - The content to evaluate (e.g. page text).
 * @param {string} question - The yes/no question.
 * @param {Object} [options]
 * @param {number} [options.minConfidence] - Minimum confidence to treat the
 *   answer as decisive. Defaults to config.jev.minConfidence.
 * @param {number} [options.threshold=0.5] - Probability-of-yes threshold.
 * @param {JevClient} [options.client] - A specific client to use.
 * @returns {Promise<{yes: boolean, probability: number, confidence: number, decisive: boolean, answer: Object}>}
 *
 * @example
 * const r = await jevAsk(await page.locator('body').innerText(),
 *   'Does the page confirm the broadcast was sent?');
 * expect(r.decisive && r.yes).toBe(true);
 */
async function jevAsk(state, question, options = {}) {
  const client = options.client || jev;
  const minConfidence = options.minConfidence != null ? options.minConfidence : config.jev.minConfidence;
  const threshold = options.threshold != null ? options.threshold : 0.5;

  const answers = await client.ask(state, { answer: noul(question) });
  const a = answers.answer || {};
  const probability = typeof a.noul === 'number' ? a.noul : Number(a.noul) || 0;
  const confidence = typeof a.confidence === 'number' ? a.confidence : probability;

  return {
    yes: probability >= threshold,
    probability,
    confidence,
    decisive: confidence >= minConfidence,
    answer: a,
  };
}

module.exports = {
  // Question builders
  choice,
  score,
  noul,

  // Client
  JevClient,
  jev,

  // Helpers
  answerValue,
  jevAsk,
};
