/**
 * Custom Playwright reporter — "Smoke Test Report".
 *
 * Produces a complete, human-readable summary of what the smoke run tested,
 * grouped by CRITICAL FUNCTIONALITY (website loads · pages · links · CTAs ·
 * forms · pricing · login · signup/onboarding · contact/ticket/affiliate
 * submissions), not just a pass/fail dump. Writes a self-contained HTML report
 * + a Markdown twin to <framework>/smoke-reports/ on completion.
 *
 * Wire it up:  --reporter=list,./reporters/smoke-report.js
 * (see the `test:smoke:report` npm script).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Map a test to a functional area + a stable order, from tags/id/title. */
function areaFor(title) {
  const t = title.toLowerCase();
  const id = (title.match(/pesite-(\d+)|lp-[a-z]+-\d+/i) || [''])[0];
  if (/@signup|onboarding|sign ?up \+/.test(t)) return { key: '80-signup', label: 'Signup & onboarding' };
  if (/contact.*submit|submit.*contact|create.*ticket|ticket.*creat|affiliate.*form|form.*submit|submission/.test(t))
    return { key: '60-forms-submit', label: 'Form submissions (contact · ticket · affiliate)' };
  if (/@pricing|pricing|plan comparison|billing toggle|calculator/.test(t)) return { key: '50-pricing', label: 'Pricing · plan comparison · price calculator' };
  if (/login entry|signup entry|routes to the app/.test(t)) return { key: '55-auth-entry', label: 'Login / Signup entry' };
  if (/9001|sitemap|every published page/.test(t) || /9001/.test(id)) return { key: '10-pages', label: 'Website up · all pages load (sitemap)' };
  if (/9002|key page|render without error/.test(t)) return { key: '20-keypages', label: 'Key pages render (no soft-404)' };
  if (/9003|links.*resolve|homepage link/.test(t)) return { key: '30-links', label: 'Links resolve (nav · body · footer)' };
  if (/9004|footer/.test(t)) return { key: '35-footer', label: 'Footer links resolve' };
  if (/9005|cta/.test(t)) return { key: '40-cta', label: 'Primary CTAs resolve' };
  if (/9006|forms render|contact.*form|support.*form/.test(t)) return { key: '45-forms-render', label: 'Forms render (contact · support)' };
  return { key: '90-other', label: 'Other checks' };
}

/** Pull the meaningful highlight lines a test logged (✅/⚠️/❌/•/→ …). */
function highlights(stdout) {
  const lines = [];
  for (const chunk of stdout || []) {
    const text = typeof chunk === 'string' ? chunk : chunk.text || '';
    for (const raw of text.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (/[✅⚠️❌ℹ️]|→|checked|resolve|renders|updates|OK\b/.test(line) && line.trim().length > 2 && !/^\s*📍/.test(line)) {
        lines.push(line.trim());
      }
    }
  }
  return [...new Set(lines)].slice(0, 8);
}

const STATUS_ICON = { passed: '✅', failed: '❌', timedOut: '⏱️', skipped: '⏭️', interrupted: '◼️' };

class SmokeReport {
  constructor(options = {}) {
    this.options = options;
    this.tests = [];
    this.baseURL = '';
    this.startedAt = new Date();
  }

  onBegin(config, suite) {
    this._suite = suite;
    try {
      const p = (config.projects || [])[0];
      this.baseURL = (p && p.use && p.use.baseURL) || '';
    } catch (_) { /* ignore */ }
    this.framework = path.basename(process.cwd());
    this.env = process.env.TEST_ENV || process.env.APP_ENV || process.env.LP_ENV || (process.env.BASE_URL || '').replace(/^https?:\/\//, '') || 'default';
    // Optional PR/task this report verifies — passed by the Reports on-demand
    // builder (SMOKE_TASK_REF) so the report is traceable to a PR/task.
    this.taskRef = (process.env.SMOKE_TASK_REF || '').trim() || null;
  }

  onTestEnd(test, result) {
    // Keep the final attempt's outcome.
    this.tests.push({
      title: test.title,
      full: test.titlePath().slice(1).join(' › '),
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
      error: result.error ? String(result.error.message || result.error).split('\n').slice(0, 3).join(' ') : null,
      highlights: highlights(result.stdout),
    });
  }

  async onEnd(result) {
    // Collapse retries: keep the best (passed beats failed) per full-title.
    const byTitle = new Map();
    const rank = { passed: 3, skipped: 2, timedOut: 1, failed: 0, interrupted: 0 };
    for (const t of this.tests) {
      const prev = byTitle.get(t.full);
      if (!prev || (rank[t.status] ?? 0) >= (rank[prev.status] ?? 0)) byTitle.set(t.full, t);
    }
    const tests = [...byTitle.values()];

    const areas = new Map();
    for (const t of tests) {
      const a = areaFor(t.full);
      if (!areas.has(a.key)) areas.set(a.key, { label: a.label, tests: [] });
      areas.get(a.key).tests.push(t);
    }
    const orderedAreas = [...areas.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, v]) => v);

    const tally = tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const passed = tally.passed || 0;
    const failed = (tally.failed || 0) + (tally.timedOut || 0);
    const skipped = tally.skipped || 0;
    const durationS = ((Date.now() - this.startedAt.getTime()) / 1000).toFixed(0);
    const verdict = failed > 0 ? 'FAILED' : passed > 0 ? 'PASSED' : 'NO TESTS RUN';

    const meta = {
      framework: this.framework, env: this.env, baseURL: this.baseURL,
      started: this.startedAt.toISOString(), durationS, verdict,
      passed, failed, skipped, total: tests.length,
      taskRef: this.taskRef,
    };

    const outDir = path.join(process.cwd(), 'smoke-reports');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) { /* ignore */ }
    const stamp = this.startedAt.toISOString().replace(/[:.]/g, '-');
    const base = `smoke-${meta.env}-${stamp}`;

    const md = this._markdown(meta, orderedAreas);
    const html = this._html(meta, orderedAreas);
    const write = (name, body) => { try { fs.writeFileSync(path.join(outDir, name), body); } catch (_) { /* ignore */ } };
    write(`${base}.md`, md);
    write(`${base}.html`, html);
    write('latest.md', md);
    write('latest.html', html);

    const bar = '─'.repeat(64);
    console.log(`\n${bar}`);
    console.log(`🧪 SMOKE REPORT — ${meta.framework} (${meta.env}) — ${verdict}`);
    console.log(`   ${passed} passed · ${failed} failed · ${skipped} skipped · ${durationS}s`);
    console.log(`   HTML: ${path.join(outDir, base + '.html')}`);
    console.log(`   also: ${path.join(outDir, 'latest.html')}`);
    console.log(`${bar}\n`);
  }

  _markdown(meta, areas) {
    const L = [];
    L.push(`# Smoke Test Report — ${meta.framework}`);
    L.push('');
    L.push(`**Verdict:** ${meta.verdict === 'PASSED' ? '✅ PASSED' : meta.verdict === 'FAILED' ? '❌ FAILED' : '⚠️ ' + meta.verdict}  ·  **${meta.passed}** passed · **${meta.failed}** failed · **${meta.skipped}** skipped`);
    L.push('');
    if (meta.taskRef) L.push(`- **PR / task:** ${meta.taskRef}`);
    L.push(`- **Environment:** ${meta.env}`);
    L.push(`- **Base URL:** ${meta.baseURL || '(per-test)'}`);
    L.push(`- **Started:** ${meta.started}`);
    L.push(`- **Duration:** ${meta.durationS}s`);
    L.push('');
    L.push('## Coverage by critical functionality');
    L.push('');
    L.push('| Area | Tests | ✅ | ❌ | ⏭️ |');
    L.push('|---|---|---|---|---|');
    for (const a of areas) {
      const p = a.tests.filter((t) => t.status === 'passed').length;
      const f = a.tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length;
      const s = a.tests.filter((t) => t.status === 'skipped').length;
      L.push(`| ${a.label} | ${a.tests.length} | ${p} | ${f} | ${s} |`);
    }
    L.push('');
    L.push('## Details');
    for (const a of areas) {
      L.push('');
      L.push(`### ${a.label}`);
      for (const t of a.tests) {
        L.push(`- ${STATUS_ICON[t.status] || '•'} **${t.title}** — ${t.status} (${(t.durationMs / 1000).toFixed(1)}s)`);
        for (const h of t.highlights) L.push(`    - ${h}`);
        if (t.error) L.push(`    - ⚠️ ${t.error}`);
      }
    }
    L.push('');
    L.push(`_Generated by the smoke-report reporter · ${new Date().toISOString()}_`);
    return L.join('\n');
  }

  _html(meta, areas) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const vClass = meta.verdict === 'PASSED' ? 'ok' : meta.verdict === 'FAILED' ? 'bad' : 'warn';
    const rows = areas.map((a) => {
      const p = a.tests.filter((t) => t.status === 'passed').length;
      const f = a.tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length;
      const s = a.tests.filter((t) => t.status === 'skipped').length;
      const cls = f > 0 ? 'bad' : p > 0 ? 'ok' : 'warn';
      return `<tr><td>${esc(a.label)}</td><td class="num">${a.tests.length}</td><td class="num ok">${p}</td><td class="num ${f ? 'bad' : ''}">${f}</td><td class="num">${s}</td><td><span class="dot ${cls}"></span></td></tr>`;
    }).join('');
    const detail = areas.map((a) => `
      <section class="area">
        <h3>${esc(a.label)}</h3>
        ${a.tests.map((t) => `
          <div class="test ${t.status}">
            <div class="test-hd"><span class="badge ${t.status}">${STATUS_ICON[t.status] || '•'} ${esc(t.status)}</span>
              <span class="ttl">${esc(t.title)}</span><span class="dur">${(t.durationMs / 1000).toFixed(1)}s</span></div>
            ${t.highlights.length ? `<ul>${t.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
            ${t.error ? `<div class="err">⚠️ ${esc(t.error)}</div>` : ''}
          </div>`).join('')}
      </section>`).join('');
    const clean = (v) => String(v || '').replace(/[<>]/g, ' ').replace(/--+/g, '-');
    return `<!doctype html><!-- smoke-verdict: ${clean(meta.verdict)} --><!-- smoke-env: ${clean(meta.env)} --><!-- smoke-taskref: ${clean(meta.taskRef)} -->
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Smoke Report — ${esc(meta.framework)} (${esc(meta.env)})</title>
<style>
  :root{--bg:#f6f8fc;--card:#fff;--ink:#18202f;--ink2:#5b6474;--bd:#e4e9f1;--ok:#1f9a5f;--bad:#d64545;--warn:#c77a0a;--accent:#4b45d6}
  @media(prefers-color-scheme:dark){:root{--bg:#0d1220;--card:#161d2c;--ink:#e9edf5;--ink2:#9ba6bc;--bd:#26303f;--ok:#4fc98a;--bad:#f2777a;--warn:#f0a94a;--accent:#9e97f7}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1000px;margin:0 auto;padding:32px 20px 64px}
  h1{font-size:26px;margin:0 0 4px}.sub{color:var(--ink2);font-size:13px;font-family:ui-monospace,Menlo,monospace;margin-bottom:20px}
  .verdict{display:inline-block;font-weight:800;letter-spacing:.05em;padding:8px 16px;border-radius:10px;font-size:15px;margin:6px 0 18px}
  .verdict.ok{background:color-mix(in oklab,var(--ok) 16%,transparent);color:var(--ok)}
  .verdict.bad{background:color-mix(in oklab,var(--bad) 16%,transparent);color:var(--bad)}
  .verdict.warn{background:color-mix(in oklab,var(--warn) 16%,transparent);color:var(--warn)}
  .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
  .kpi{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px 18px;min-width:96px}
  .kpi b{display:block;font-size:24px}.kpi span{color:var(--ink2);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;margin-bottom:28px}
  th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--bd);font-size:14px}th{color:var(--ink2);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  td.num{text-align:right;font-variant-numeric:tabular-nums;width:52px}td.ok{color:var(--ok)}td.bad{color:var(--bad);font-weight:700}
  .dot{display:inline-block;width:10px;height:10px;border-radius:50%}.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}.dot.warn{background:var(--warn)}
  .area{margin-bottom:22px}.area h3{font-size:15px;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid var(--accent);display:inline-block}
  .test{background:var(--card);border:1px solid var(--bd);border-left:3px solid var(--bd);border-radius:8px;padding:10px 14px;margin-bottom:8px}
  .test.passed{border-left-color:var(--ok)}.test.failed,.test.timedOut{border-left-color:var(--bad)}.test.skipped{border-left-color:var(--warn)}
  .test-hd{display:flex;align-items:center;gap:10px}.ttl{font-weight:600;flex:1}.dur{color:var(--ink2);font-size:12px;font-family:ui-monospace,monospace}
  .badge{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px;border-radius:999px}
  .badge.passed{background:color-mix(in oklab,var(--ok) 15%,transparent);color:var(--ok)}
  .badge.failed,.badge.timedOut{background:color-mix(in oklab,var(--bad) 15%,transparent);color:var(--bad)}
  .badge.skipped{background:color-mix(in oklab,var(--warn) 15%,transparent);color:var(--warn)}
  .test ul{margin:8px 0 0;padding-left:18px;color:var(--ink2);font-size:13px}.test li{margin:2px 0}
  .err{margin-top:8px;color:var(--bad);font-size:13px}
  .foot{color:var(--ink2);font-size:12px;margin-top:32px;border-top:1px solid var(--bd);padding-top:12px}
</style></head><body><div class="wrap">
  <h1>Smoke Test Report — ${esc(meta.framework)}</h1>
  <div class="sub">${meta.taskRef ? `PR/task: ${esc(meta.taskRef)} · ` : ''}env: ${esc(meta.env)} · base: ${esc(meta.baseURL || '(per-test)')} · ${esc(meta.started)} · ${esc(meta.durationS)}s</div>
  <div class="verdict ${vClass}">${meta.verdict === 'PASSED' ? '✅ PASSED' : meta.verdict === 'FAILED' ? '❌ FAILED' : '⚠️ ' + esc(meta.verdict)}</div>
  <div class="kpis">
    <div class="kpi"><b>${meta.total}</b><span>Tests</span></div>
    <div class="kpi"><b style="color:var(--ok)">${meta.passed}</b><span>Passed</span></div>
    <div class="kpi"><b style="color:var(--bad)">${meta.failed}</b><span>Failed</span></div>
    <div class="kpi"><b style="color:var(--warn)">${meta.skipped}</b><span>Skipped</span></div>
  </div>
  <h2 style="font-size:16px">Coverage by critical functionality</h2>
  <table><thead><tr><th>Area</th><th class="num">#</th><th class="num">✅</th><th class="num">❌</th><th class="num">⏭️</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  <h2 style="font-size:16px">Details</h2>
  ${detail}
  <div class="foot">Generated by the smoke-report reporter · ${esc(new Date().toISOString())}</div>
</div></body></html>`;
  }
}

module.exports = SmokeReport;
