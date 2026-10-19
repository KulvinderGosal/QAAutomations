#!/usr/bin/env node
/**
 * Generates the Onboarding Wizard manual QA execution checklist from cases.json.
 * Source of truth: tests/onboarding-wizard/cases.json (extracted from the QA plan artifact).
 * Usage: node scripts/gen-onboarding-checklist.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/onboarding-wizard/cases.json'), 'utf8'));
const OUT = path.join(ROOT, 'tests/onboarding-wizard/MANUAL_TEST_CHECKLIST.md');

const L = [];
const p = (s = '') => L.push(s);

p('# Onboarding Wizard — Manual QA Execution Checklist');
p();
p('> Auto-generated from `cases.json` by `scripts/gen-onboarding-checklist.js`. Do not hand-edit —');
p('> record results in the **Result** line under each case, or in the artifact\'s shared results DB.');
p(`> Source: ${data.source}`);
p();
p('**Environment:** `https://staging-app-dashboard2.pushengage.com/`  ');
p('**PRs:** FE [pushengage-app#1014](https://github.com/awesomemotive/pushengage-app/pull/1014) · BE [pushengage-adonis-node-api#407](https://github.com/awesomemotive/pushengage-adonis-node-api/pull/407)  ');
p('**Deploy order:** backend → run free-plan migration → frontend');
p();
p(`**Totals:** ${data.totals.cases} cases — ${data.totals.P0} P0 · ${data.totals.P1} P1 · ${data.totals.P2} P2 (${data.totals.fe} FE · ${data.totals.be} BE)`);
p();

p('## ⛔ Two hard prerequisites (skip = whole flow breaks)');
p();
p('1. **Free-plan migration** — run `node ace migrate:free_plan_segments` on the backend before testing free accounts. Without it, free users get `403 Your account does not have access to this feature` the moment the wizard creates a segment (see case **N1 / N10**).');
p('2. **`GOOGLE_GENERATIVE_AI_API_KEY`** set on the backend. Without it every AI response returns `fallback: true` with generic content — not a bug, but "AI-curated" cases are untestable. Confirm with one `site-analysis` call returning `fallback:false`.');
p();
p('> **`fallback: true` is never an error.** Model failure, a busy per-site lock, and the hourly/daily cap all return HTTP 200 with usable default content. The wizard must never show an error for it.');
p();

p('## Priority legend');
p();
p('| | Meaning |');
p('|---|---|');
p('| **P0** | Release blocker — core path of a track, a data-writing action, or a regression on an existing paid feature. |');
p('| **P1** | Must pass before release; a fix can land as a follow-up commit. |');
p('| **P2** | Polish, copy, or edge. Log and move on. |');
p();

p('## Before you start — accounts, sites & fixtures');
p();
data.setup.forEach(s => p(`- [ ] **${s.item}** — ${s.detail}`));
p();

p('## Progress tracker (fill as you go)');
p();
p('| Group | Cases | Passed | Failed | Blocked | Notes |');
p('|---|---|---|---|---|---|');
data.groups.forEach(g => p(`| ${g.key} · ${g.title} | ${g.count} | | | | |`));
p(`| **TOTAL** | **${data.totals.cases}** | | | | |`);
p();

p('---');
p();
p('## Test cases');
p();
const byGroup = {};
data.cases.forEach(c => { (byGroup[c.group] = byGroup[c.group] || []).push(c); });
data.groups.forEach(g => {
  p(`### ${g.key} · ${g.title}`);
  const intro = (byGroup[g.key][0] || {}).groupIntro;
  if (intro) { p(); p(`_${intro}_`); }
  p();
  byGroup[g.key].forEach(c => {
    p(`#### ${c.id} — ${c.title}  \`${c.priority}\` \`${c.repo.toUpperCase()}\``);
    p();
    p('_Steps:_');
    c.steps.forEach((s, i) => p(`${i + 1}. ${s}`));
    p();
    p(`_Expected:_ ${c.expected}`);
    if (c.note) { p(); p(`> Note: ${c.note}`); }
    p();
    p('- [ ] **Result:** ⬜ Pass / ⬜ Fail / ⬜ Blocked — _notes:_');
    p();
  });
  p('---');
  p();
});

p('## Impacted existing screens (regression watch)');
p();
p('| Screen / surface | Repo | What changed | Regression to look for | Cases |');
p('|---|---|---|---|---|');
data.screens.forEach(s => p(`| ${s.screen} | ${s.repo} | ${s.changed} | ${s.regression} | ${s.cases} |`));
p();

p('## Known issues & decisions — DO NOT file as bugs');
p();
p('_Confirm they behave as described; file only if the behaviour differs._');
p();
data.known.forEach(k => p(`- **${k.title}** ${k.detail}`));
p();

fs.writeFileSync(OUT, L.join('\n'));
console.log('Wrote', OUT, '(' + L.length + ' lines)');
