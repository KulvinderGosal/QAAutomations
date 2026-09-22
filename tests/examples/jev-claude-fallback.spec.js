const { test, expect } = require('@playwright/test');
const { jev } = require('../utils/jev-helpers');
const { claude, jevWithClaudeFallback } = require('../utils/claude-helpers');

/**
 * Example: Jev + Claude "System 1 -> System 2" integration.
 *
 * Jev makes the fast, cheap, confidence-scored decision. When Jev is not
 * confident, we escalate to Claude for a human-readable diagnosis of what the
 * page actually shows and a hint for the test author.
 *
 * These tests need BOTH a TypeSafe key (TYPESAFE_API_KEY) and an Anthropic key
 * (ANTHROPIC_API_KEY). They auto-skip when either is missing, so CI stays green
 * without configuration.
 *
 * Run with:  npm run test:jev:claude
 */

test.describe('Example: Jev + Claude fallback', () => {
  test.skip(() => !jev.isConfigured() || !claude.isConfigured(),
    'Set TYPESAFE_API_KEY and ANTHROPIC_API_KEY in .env to run this example');

  test('confident case: trust Jev, no escalation', async () => {
    const pageText = '✅ Your broadcast "Flash Sale" was sent successfully to 12,430 subscribers.';

    const r = await jevWithClaudeFallback(pageText,
      'Did the broadcast send successfully?', { expected: 'a success confirmation' });

    console.log(`   confidence=${r.confidence} decisive=${r.decisive} escalated=${r.escalated}`);
    expect(r.decisive).toBe(true);
    expect(r.escalated).toBe(false);
    expect(r.yes).toBe(true);
  });

  test('ambiguous case: escalate to Claude for a diagnosis', async () => {
    // Deliberately ambiguous copy that a fast classifier may not resolve.
    const pageText = 'Processing… your request has been queued. Status: pending. ' +
      'This page will update shortly. (No confirmation yet.)';

    const r = await jevWithClaudeFallback(pageText,
      'Did the broadcast send successfully?', { expected: 'a clear success or failure' });

    console.log(`   confidence=${r.confidence} decisive=${r.decisive} escalated=${r.escalated}`);
    if (r.escalated) {
      console.log(`   Claude: ${r.claude.summary}`);
      console.log(`   likelyState=${r.claude.likelyState} fix="${r.claude.suggestedFix}"`);
      expect(r.claude).toHaveProperty('summary');
      expect(['success', 'error', 'empty', 'loading', 'unexpected'])
        .toContain(r.claude.likelyState);
    } else {
      // Jev was confident enough on its own — that's a valid outcome too.
      expect(r.decisive).toBe(true);
    }
  });

  test('direct Claude diagnosis (no Jev)', async () => {
    const pageText = 'Error 500: Something went wrong while saving your campaign.';

    const diagnosis = await claude.diagnose(pageText, {
      question: 'What went wrong on this page?',
      expected: 'the campaign to save',
    });

    console.log(`   summary=${diagnosis.summary}`);
    expect(diagnosis.likelyState).toBe('error');
  });
});
