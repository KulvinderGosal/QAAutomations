# TypeSafe Jev Integration

[Jev](https://typesafe.ai) is TypeSafe AI's **System One** decision model. Unlike a
chat LLM, it does not generate free text — you give it a **state** (the thing to
look at) and a map of **typed questions**, and it returns **typed, calibrated
answers with a confidence score (0..1)**.

In this QA framework we use it for assertions that are brittle with pure
selectors, for example:

- *"Did this page confirm the broadcast was sent?"* → yes/no + confidence
- *"Is this a success / error / empty state?"* → one of a fixed set of choices
- *"How severe does this validation message look?"* → a score on a rubric

## Setup

1. Get an API key from https://typesafe.ai.
2. Copy `.env.example` to `.env` and fill in:

   ```bash
   TYPESAFE_API_KEY=sk_...            # required; leave blank to skip Jev tests
   TYPESAFE_BASE_URL=https://api.typesafe.ai
   JEV_MODEL=typesafe/jev
   JEV_MIN_CONFIDENCE=0.7             # min confidence before an answer is "decisive"
   JEV_TIMEOUT=10000                  # request timeout in ms
   ```

   `.env` is git-ignored — **never commit your API key.**

No new npm dependency is required: the helper calls the REST API directly using
Node's built-in `fetch` (Node 18+; this repo runs on Node 22).

## Usage

Everything lives in [`tests/utils/jev-helpers.js`](../tests/utils/jev-helpers.js).

### Question types

| Builder | Question | Answer shape |
| --- | --- | --- |
| `choice(instructions, options)` | Pick one of up to 255 named options | `{ choice, probabilities, confidence }` |
| `score(instructions, levels)` | Rate against 2–10 ordered rubric levels | `{ score, legend, confidence }` |
| `noul(instructions)` | Yes/no | `{ noul }` (probability of "yes", 0..1) |

### Yes/no assertion (simplest)

```js
const { jevAsk } = require('../utils/jev-helpers');

const text = await page.locator('body').innerText();
const r = await jevAsk(text, 'Does the page confirm the broadcast was sent?');

// r = { yes, probability, confidence, decisive, answer }
expect(r.decisive && r.yes).toBe(true);
```

`decisive` is `true` when `confidence >= JEV_MIN_CONFIDENCE`. This lets you route
low-confidence cases to a human / fallback instead of asserting blindly.

### Classify page state (choice)

```js
const { jev, choice, answerValue } = require('../utils/jev-helpers');

const answers = await jev.ask(text, {
  state: choice('What state is this page in?', {
    success: 'A success or confirmation message is shown.',
    error:   'An error or failure message is shown.',
    empty:   'There is no data / an empty state.',
    other:   'None of the above clearly fits.',
  }),
});

expect(answerValue(answers.state)).toBe('success');
```

### Multiple questions in one call

```js
const { jev, choice, noul } = require('../utils/jev-helpers');

const answers = await jev.ask(text, {
  active: noul('Is the campaign currently active?'),
  state:  choice('What is the outcome shown?', {
    activated: 'Something was turned on / activated.',
    deactivated: 'Something was turned off / paused.',
    unknown: 'The outcome is unclear.',
  }),
});

expect(answers.active.noul).toBeGreaterThan(0.8);
```

### Skipping tests when no key is configured

Jev-based tests should skip gracefully so CI stays green without a key:

```js
test.skip(() => !jev.isConfigured(), 'Set TYPESAFE_API_KEY to run Jev tests');
```

See [`tests/examples/jev-decision.spec.js`](../tests/examples/jev-decision.spec.js)
for a full, runnable example.

## Running

```bash
npm run test:jev
```

## API reference (under the hood)

- **Endpoint:** `POST {TYPESAFE_BASE_URL}/v1/systemone`
- **Auth:** `Authorization: Bearer $TYPESAFE_API_KEY`
- **Body:** `{ model, state, questions }` where each question is
  `{ type: "choice"|"score"|"noul", instructions, options?|levels? }`
- **Response:** `{ answers: { <name>: { choice|score|noul, confidence, probabilities? } }, usage }`

The exact request/response field names follow TypeSafe's public documentation
and JS SDK shape. If TypeSafe changes the schema, adjust the builders and
response parsing in `tests/utils/jev-helpers.js` — the low-level
`JevClient#systemOne({ state, questions, model })` accepts raw question objects,
so callers can always match the current API exactly.

> Note: this repo is CommonJS, so we call the REST API directly rather than
> using the official ESM-only `@typesafe-ai/sdk` package. If you migrate the
> repo to ESM, you can swap the client for the SDK without changing test call
> sites, since the `choice`/`score`/`noul` shapes match.
