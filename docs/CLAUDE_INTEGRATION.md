# Claude Integration (System Two behind Jev)

This extends the [Jev integration](./JEV_INTEGRATION.md) with **Claude (the
Anthropic API)** as a second, more capable layer.

The pattern is **System 1 → System 2**:

1. **Jev** makes the fast, cheap, typed decision with a calibrated confidence
   score (milliseconds, fractions of a cent).
2. If Jev's confidence is **at or above** the threshold (`JEV_MIN_CONFIDENCE`),
   the test trusts Jev and moves on.
3. If Jev is **not confident**, escalate to **Claude** for a human-readable
   diagnosis of what the page actually shows and a hint for the test author.

This keeps the common case fast and cheap, and spends Claude's time only on the
ambiguous minority — the exact routing TypeSafe recommends for System One models
("act on high confidence, review the middle, send the rest to something smarter").

## Setup

1. Get an API key from https://console.anthropic.com.
2. Add it to your `.env` (git-ignored — never commit it):

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   CLAUDE_MODEL=claude-opus-5     # switch to claude-haiku-4-5 for cheaper high-volume runs
   CLAUDE_MAX_TOKENS=1024
   CLAUDE_TIMEOUT=60000
   ```

3. The Anthropic SDK is already a dependency (`@anthropic-ai/sdk`); `npm install`
   pulls it in.

## Usage

Everything lives in [`tests/utils/claude-helpers.js`](../tests/utils/claude-helpers.js).

### Jev with automatic Claude fallback (the main entry point)

```js
const { jevWithClaudeFallback } = require('../utils/claude-helpers');

const text = await page.locator('body').innerText();
const r = await jevWithClaudeFallback(text,
  'Did the broadcast send successfully?', { expected: 'a success toast' });

if (r.decisive) {
  expect(r.yes).toBe(true);            // Jev was confident — trust it
} else {
  // Jev was unsure → Claude diagnosed it
  console.warn('Ambiguous UI:', r.claude.summary);
  console.warn('Hint:', r.claude.suggestedFix, '| state:', r.claude.likelyState);
}
```

Result shape:

| Field | Meaning |
| --- | --- |
| `yes` / `probability` / `confidence` | Jev's answer (as in `jevAsk`) |
| `decisive` | `true` when Jev's confidence ≥ threshold |
| `escalated` | `true` when Claude was called (Jev unsure **and** a key is set) |
| `claude` | `null`, or `{ summary, likelyState, suggestedFix, confident, raw }` |

`likelyState` is one of `success`, `error`, `empty`, `loading`, `unexpected`.

### Claude directly (open-ended diagnosis)

```js
const { claude } = require('../utils/claude-helpers');

const d = await claude.diagnose(pageText, {
  question: 'What went wrong here?',
  expected: 'the campaign to save',
});
// d = { summary, likelyState, suggestedFix, confident, raw }
```

### A raw completion

```js
const { claude } = require('../utils/claude-helpers');
const answer = await claude.complete({
  system: 'You are a QA assistant.',
  prompt: 'Summarize this console log in one line:\n' + logText,
});
```

### Skipping tests when keys are missing

```js
const { jev } = require('../utils/jev-helpers');
const { claude } = require('../utils/claude-helpers');

test.skip(() => !jev.isConfigured() || !claude.isConfigured(),
  'Set TYPESAFE_API_KEY and ANTHROPIC_API_KEY to run this test');
```

See [`tests/examples/jev-claude-fallback.spec.js`](../tests/examples/jev-claude-fallback.spec.js)
for a full, runnable example.

## Running

```bash
npm run test:jev:claude
```

## Notes

- **Model default.** `CLAUDE_MODEL` defaults to `claude-opus-5` (most capable).
  For high-volume fallbacks where a lighter model is fine, set
  `CLAUDE_MODEL=claude-haiku-4-5`.
- **Cost control.** Claude is only called on Jev's low-confidence cases, so the
  Anthropic spend scales with ambiguity, not with total test count. Tighten or
  loosen `JEV_MIN_CONFIDENCE` to trade escalation frequency against strictness.
- **Lazy SDK load.** `@anthropic-ai/sdk` is required lazily, so tests that never
  touch Claude don't depend on it being importable.
- **Robust parsing.** `diagnose()` asks Claude for JSON but never assumes it —
  it falls back to extracting the first JSON object, then to the raw text.
