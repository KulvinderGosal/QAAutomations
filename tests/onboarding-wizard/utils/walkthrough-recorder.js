/**
 * Walkthrough recorder — makes a Playwright run behave like a manual tester.
 *
 * A manual tester walks the whole flow, notes each case as Pass / Fail /
 * Blocked with a screenshot, and keeps going instead of stopping at the first
 * problem. This recorder does the same: each `case()` is a SOFT check — if its
 * body throws, the case is marked failed but the walkthrough continues.
 *
 * At the end call `finalize()` to write:
 *   test-results/onboarding-walkthrough/<run>/report.md   (human-readable)
 *   test-results/onboarding-walkthrough/<run>/report.json  (machine-readable)
 *   ...and one screenshot per case in the same folder.
 */
const fs = require('fs');
const path = require('path');

class WalkthroughRecorder {
  constructor(runName = 'run') {
    this.runName = runName.replace(/[^a-z0-9_-]/gi, '_');
    this.outDir = path.join(process.cwd(), 'test-results', 'onboarding-walkthrough', this.runName);
    fs.mkdirSync(this.outDir, { recursive: true });
    this.results = [];
    this.started = new Date();
  }

  _log(icon, msg) { console.log(`${icon} ${msg}`); }

  /**
   * Run a soft-checked case. `fn(page)` should perform the tester's checks and
   * throw (e.g. via expect) to signal a failure. Returns the result object.
   * A case may call `this.blocked(...)` by throwing a BlockedError.
   */
  async case(page, id, title, fn, opts = {}) {
    const priority = opts.priority || '';
    const rec = { id, title, priority, status: 'pass', note: '', screenshot: null, ts: new Date().toISOString() };
    this._log('🔎', `${id} ${priority} — ${title}`);
    try {
      const note = await fn(page);
      if (typeof note === 'string' && note) rec.note = note;
      this._log('✅', `${id} PASS${rec.note ? ' — ' + rec.note : ''}`);
    } catch (err) {
      if (err && err.__blocked) {
        rec.status = 'blocked';
        rec.note = err.message;
        this._log('⛔', `${id} BLOCKED — ${err.message}`);
      } else {
        rec.status = 'fail';
        rec.note = (err && err.message ? err.message : String(err)).split('\n').slice(0, 4).join(' ');
        this._log('❌', `${id} FAIL — ${rec.note}`);
      }
    }
    rec.screenshot = await this._shot(page, id);
    this.results.push(rec);
    return rec;
  }

  /** Mark a case Blocked without running checks (e.g. a fixture/precondition is missing). */
  async block(page, id, title, reason, priority = '') {
    const rec = { id, title, priority, status: 'blocked', note: reason, screenshot: null, ts: new Date().toISOString() };
    this._log('⛔', `${id} BLOCKED — ${reason}`);
    if (page) rec.screenshot = await this._shot(page, id);
    this.results.push(rec);
    return rec;
  }

  /** Free-form observation attached to the report (not a case result). */
  observe(text) { this._log('📝', text); this.results.push({ id: '—', title: 'note', priority: '', status: 'note', note: text, ts: new Date().toISOString() }); }

  blockedError(message) { const e = new Error(message); e.__blocked = true; return e; }

  async _shot(page, id) {
    if (!page) return null;
    const file = path.join(this.outDir, `${id.replace(/[^a-z0-9_-]/gi, '_')}.png`);
    try { await page.screenshot({ path: file, fullPage: true }); return path.relative(process.cwd(), file); }
    catch (e) { return null; }
  }

  summary() {
    const s = { pass: 0, fail: 0, blocked: 0 };
    this.results.forEach((r) => { if (s[r.status] != null) s[r.status]++; });
    return s;
  }

  finalize() {
    const s = this.summary();
    const cases = this.results.filter((r) => r.status !== 'note');
    const notes = this.results.filter((r) => r.status === 'note');
    const dur = Math.round((Date.now() - this.started) / 1000);

    const md = [];
    md.push(`# Onboarding wizard — manual walkthrough report (${this.runName})`);
    md.push('');
    md.push(`Run: ${this.started.toISOString()} · ${dur}s · **${s.pass} pass · ${s.fail} fail · ${s.blocked} blocked** of ${cases.length} cases touched.`);
    md.push('');
    md.push('| Case | Pri | Status | Note | Screenshot |');
    md.push('|---|---|---|---|---|');
    cases.forEach((r) => {
      const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⛔';
      md.push(`| ${r.id} | ${r.priority} | ${icon} ${r.status} | ${(r.note || '').replace(/\|/g, '\\|')} | ${r.screenshot ? `\`${r.screenshot}\`` : ''} |`);
    });
    if (notes.length) {
      md.push('');
      md.push('## Observations');
      notes.forEach((n) => md.push(`- ${n.note}`));
    }
    const mdPath = path.join(this.outDir, 'report.md');
    const jsonPath = path.join(this.outDir, 'report.json');
    fs.writeFileSync(mdPath, md.join('\n'));
    fs.writeFileSync(jsonPath, JSON.stringify({ run: this.runName, started: this.started, durationSec: dur, summary: s, results: this.results }, null, 2));
    this._log('📄', `Report: ${path.relative(process.cwd(), mdPath)}  (${s.pass}✅ ${s.fail}❌ ${s.blocked}⛔)`);
    return { mdPath, jsonPath, summary: s };
  }
}

module.exports = { WalkthroughRecorder };
