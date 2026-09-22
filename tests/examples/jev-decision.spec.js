const { test, expect } = require('@playwright/test');
const { jev, choice, score, noul, jevAsk, answerValue } = require('../utils/jev-helpers');

/**
 * Example: Using TypeSafe Jev (System One) for confidence-scored QA assertions.
 *
 * Jev returns typed, calibrated decisions instead of free text, which is handy
 * for assertions that are brittle with pure selectors (e.g. "is this a success
 * or error state?", "was the broadcast confirmed as sent?").
 *
 * These tests require a TypeSafe API key. They auto-skip when TYPESAFE_API_KEY
 * is not set, so they never break CI without configuration.
 *
 * Run with:  npm run test:jev
 */

test.describe('Example: TypeSafe Jev decision model', () => {
  test.skip(() => !jev.isConfigured(),
    'Set TYPESAFE_API_KEY in .env to run Jev examples');

  test('yes/no (noul): detect a broadcast success message', async () => {
    // In a real test this would be `await page.locator('body').innerText()`.
    const pageText = '✅ Your broadcast "Flash Sale" was sent successfully to 12,430 subscribers.';

    const r = await jevAsk(pageText,
      'Does this page confirm the broadcast was sent successfully?');

    console.log(`   probability(yes)=${r.probability} confidence=${r.confidence} decisive=${r.decisive}`);
    expect(r.decisive).toBe(true);
    expect(r.yes).toBe(true);
  });

  test('choice: classify the page state', async () => {
    const pageText = 'Error: We could not save your campaign. Please try again later.';

    const answers = await jev.ask(pageText, {
      state: choice('What state is this page in?', {
        success: 'A success or confirmation message is shown.',
        error: 'An error or failure message is shown.',
        empty: 'There is no data / an empty state.',
        other: 'None of the above clearly fits.',
      }),
    });

    console.log(`   choice=${answerValue(answers.state)} confidence=${answers.state.confidence}`);
    expect(answerValue(answers.state)).toBe('error');
  });

  test('score: rate error severity on a rubric', async () => {
    const pageText = 'Warning: Your subscriber list is nearly full (98% used).';

    const answers = await jev.ask(pageText, {
      severity: score('How severe is the on-screen message for the user?', [
        'No problem at all',
        'A minor, non-blocking warning',
        'A blocking error that stops the user',
      ]),
    });

    console.log(`   severity=${answerValue(answers.severity)} confidence=${answers.severity.confidence}`);
    expect(answers.severity).toHaveProperty('confidence');
  });

  test('multiple typed questions in one call', async () => {
    const pageText = 'Your drip campaign is now ACTIVE. 3 notifications scheduled.';

    const answers = await jev.ask(pageText, {
      active: noul('Is the campaign currently active?'),
      state: choice('What is the outcome shown?', {
        activated: 'Something was turned on / activated.',
        deactivated: 'Something was turned off / paused.',
        unknown: 'The outcome is unclear.',
      }),
    });

    expect(answers.active).toHaveProperty('noul');
    expect(answerValue(answers.state)).toBe('activated');
  });
});
