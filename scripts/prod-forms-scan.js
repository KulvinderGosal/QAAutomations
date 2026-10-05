// Enumerate every submittable form across key pushengage.com pages.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const OUT = '/home/user/QAAutomations/test-results/prod-qa';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = ['/', '/contact-us/', '/blog/', '/about/', '/press/', '/workflows/', '/web-push-notifications/', '/features/', '/case-studies/', '/integrations/'];

async function dismissCookie(page) { for (const sel of ['button:has-text("Accept")']) { try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1200 })) { await b.click(); } } catch (e) {} } }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:40213' }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const all = {};
  for (const path of PAGES) {
    const p = await ctx.newPage();
    try { await p.goto('https://www.pushengage.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { all[path] = { error: String(e.message) }; await p.close(); continue; }
    await p.waitForTimeout(3500);
    await dismissCookie(p);
    const forms = await p.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      return Array.from(document.querySelectorAll('form')).map((f) => {
        const fields = Array.from(f.querySelectorAll('input,select,textarea'))
          .filter((x) => (x.type || '') !== 'hidden')
          .map((x) => `${x.tagName.toLowerCase()}:${x.type || ''}${x.name ? '[' + x.name + ']' : ''}`);
        const submit = Array.from(f.querySelectorAll('button,input[type=submit]')).map((s) => (s.innerText || s.value || '').trim()).filter(Boolean);
        return {
          id: f.id || '(none)',
          cls: (f.className || '').split(' ').filter((c) => /wpforms|newsletter|subscribe|optin|cta|search|om-/.test(c)).join(' ') || (f.className || '').slice(0, 30),
          visible: vis(f),
          action: f.getAttribute('action') || '',
          fieldCount: fields.length,
          fields: fields.slice(0, 10),
          submit,
        };
      });
    });
    all[path] = forms;
    console.log(`\n=== ${path} (${forms.length} forms) ===`);
    forms.forEach((f) => console.log(`  [${f.visible ? 'VIS' : 'hid'}] id=${f.id} cls="${f.cls}" fields=${f.fieldCount} submit=${JSON.stringify(f.submit)} fieldtypes=${JSON.stringify(f.fields)}`));
    await p.close();
  }
  fs.writeFileSync(`${OUT}/forms-scan.json`, JSON.stringify(all, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
