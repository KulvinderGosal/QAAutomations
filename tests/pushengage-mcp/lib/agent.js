/**
 * Drives the MCP with Claude, the way a real user would: a natural-language prompt in,
 * Claude chooses the tools and builds the arguments (including subscriber_filter).
 *
 * The harness, not Claude, decides what is allowed to run:
 *   - read-only tools (list/get/...) always run
 *   - send tools run only when PE_MCP_ALLOW_SEND=1; otherwise the call is recorded and
 *     answered with an error, so you can review the arguments Claude built (dry run)
 *   - every other tool (create/update/delete/pause...) is blocked
 *
 * Every tool call and result is recorded in the transcript for the report.
 */
const Anthropic = require('@anthropic-ai/sdk');
const { resultText } = require('./checks');

const MODEL = process.env.PE_MCP_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.PE_MCP_EFFORT || 'medium';
const MAX_TURNS = Number(process.env.PE_MCP_MAX_TURNS || 10);
const USE_FALLBACKS = process.env.PE_MCP_FALLBACKS !== 'off';

const SYSTEM = [
  'You are operating a PushEngage TEST site through its MCP tools, as part of an automated QA run.',
  'Do exactly what the user asks, using the tools. Do not ask clarifying questions.',
  'Use names and values exactly as the user writes them unless the user tells you to look them up.',
  'If a tool returns an error, do not retry with different values; stop and report the error text.',
  'When you are done, reply with one short paragraph saying what you did and the notification id if one was created.',
].join('\n');

function allowSend() {
  return process.env.PE_MCP_ALLOW_SEND === '1';
}

function toAnthropicTools(mcpTools) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: (t.description || '').slice(0, 4000),
    input_schema: t.inputSchema && t.inputSchema.type ? t.inputSchema : { type: 'object', properties: {} },
  }));
}

/**
 * @param {import('./mcp-session').McpSession} session
 * @param {string} prompt
 * @returns {Promise<{finalText: string, toolCalls: Array, stopReason: string, turns: number}>}
 */
async function runAgent(session, prompt) {
  const anthropic = new Anthropic();
  const tools = toAnthropicTools(session.tools);
  const messages = [{ role: 'user', content: prompt }];
  const toolCalls = [];
  let finalText = '';
  let stopReason = '';
  let turns = 0;

  for (; turns < MAX_TURNS; turns++) {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      output_config: { effort: EFFORT },
      messages,
    };
    if (USE_FALLBACKS) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    const response = await anthropic.beta.messages.create(params);
    stopReason = response.stop_reason;

    // Append the assistant turn unchanged (keeps thinking blocks valid on the next request).
    messages.push({ role: 'assistant', content: response.content });
    finalText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (stopReason === 'refusal') {
      finalText = `[model refused: ${response.stop_details?.category || 'unknown'}] ${finalText}`;
      break;
    }
    if (stopReason !== 'tool_use') break;

    const results = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      const record = { name: block.name, args: block.input, isError: false, text: '', blocked: null, raw: null };
      if (session.isSendTool(block.name) && !allowSend()) {
        record.blocked = 'dry-run';
        record.isError = true;
        record.text = 'QA harness dry run: this send was not executed (PE_MCP_ALLOW_SEND is not 1).';
      } else if (!session.isSendTool(block.name) && !session.isReadOnlyTool(block.name)) {
        record.blocked = 'not-allowed';
        record.isError = true;
        record.text = `QA harness: ${block.name} is not on the allowed list for this run.`;
      } else {
        try {
          const res = await session.call(block.name, block.input);
          record.raw = res;
          record.isError = Boolean(res.isError);
          record.text = resultText(res);
        } catch (err) {
          record.isError = true;
          record.text = `MCP call threw: ${err.message}`;
        }
      }
      toolCalls.push(record);
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: record.text || '(empty result)',
        is_error: record.isError,
      });
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: 'user', content: results });
  }

  return { finalText, toolCalls, stopReason, turns: turns + 1, model: MODEL };
}

module.exports = { runAgent, allowSend, MODEL };
