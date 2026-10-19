// Non-destructive discovery of the live production Pricing + Schedule Demo pages.
// Does NOT submit any form. Captures structure, CTAs, links, console/network errors.
const { chromium } = require('@playwright/test');
const fs = require('fs');

const OUT = '/home/user/QAAutomations/test-results/prod-qa';

async function auditPage(context, name, url) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400) failedRequests.push(`HTTP ${s} ${res.request().method()} ${res.url()}`);
  });

  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const status = resp ? resp.status() : 'no-response';
  await page.waitForTimeout(5000);

  const title = await page.title();
  const finalUrl = page.url();

  // Collect visible links + buttons with their text + target
  const ctas = await page.evaluate(() => {
    const out = [];
    const nodes = Array.from(document.querySelectorAll('a, button'));
    for (const n of nodes) {
      const text = (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) continue;
      const rect = n.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (!visible) continue;
      out.push({
        tag: n.tagName.toLowerCase(),
        text: text.slice(0, 60),
        href: n.getAttribute('href') || '',
      });
    }
    // de-dup
    const seen = new Set();
    return out.filter((o) => {
      const k = o.tag + '|' + o.text + '|' + o.href;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

  // Form fields on the page (inputs/selects/textareas) + iframes (Calendly etc.)
  const forms = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('input, select, textarea')).map((f) => ({
      tag: f.tagName.toLowerCase(),
      type: f.getAttribute('type') || '',
      name: f.getAttribute('name') || '',
      id: f.id || '',
      placeholder: f.getAttribute('placeholder') || '',
      required: f.required || false,
    }));
    const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => f.src || f.getAttribute('data-src') || '(no src)');
    return { fields, iframes, formCount: document.querySelectorAll('form').length };
  });

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  const report = { name, url, status, finalUrl, title, consoleErrors, pageErrors, failedRequests, ctas, forms };
  fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(report, null, 2));

  console.log(`\n===== ${name} =====`);
  console.log(`URL: ${url}`);
  console.log(`HTTP status: ${status}`);
  console.log(`Final URL: ${finalUrl}`);
  console.log(`Title: ${title}`);
  console.log(`Forms on page: ${forms.formCount}; fields: ${forms.fields.length}; iframes: ${forms.iframes.length}`);
  if (forms.iframes.length) console.log('Iframes:', forms.iframes.join('\n  '));
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 10).forEach((e) => console.log('  CONSOLE-ERR:', e.slice(0, 160)));
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.slice(0, 10).forEach((e) => console.log('  PAGE-ERR:', e.slice(0, 160)));
  console.log(`Failed/4xx-5xx requests: ${failedRequests.length}`);
  [...new Set(failedRequests)].slice(0, 20).forEach((e) => console.log('  REQ:', e.slice(0, 180)));
  console.log(`CTAs (${ctas.length}):`);
  ctas.slice(0, 60).forEach((c) => console.log(`  [${c.tag}] "${c.text}" -> ${c.href}`));

  await page.close();
  return report;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await auditPage(context, '01-pricing', 'https://www.pushengage.com/pricing');
  await auditPage(context, '02-schedule-demo', 'https://www.pushengage.com/schedule_demo/');

  await browser.close();
  console.log('\nDONE. Artifacts in', OUT);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
