/**
 * Reusable primitives for driving and asserting on the AI Onboarding Wizard.
 *
 * These wrap the behaviours the QA plan repeatedly relies on:
 *   - navigating wizard routes and waiting for the SPA to settle
 *   - capturing GTM dataLayer telemetry (ai_onboarding_* events)
 *   - reading the per-site localStorage snapshot (pe_ai_onboarding_data_<id>)
 *   - watching onboarding-ai network calls (and their `fallback` flag)
 *   - checking the left sider visibility (hidden inside the wizard)
 *
 * Selectors intentionally prefer role/text over brittle CSS. Where a real
 * selector must be confirmed against the running app, it is marked TODO(selector).
 */
const cfg = require('./onboarding-config');

/* ------------------------------------------------------------------ routes */
const routes = {
  picker: '/onboarding',
  webInstall: '/onboarding/web/install',
  webAnalyzing: '/onboarding/web/analyzing',
  webPopup: '/onboarding/web/popup',
  webSegments: '/onboarding/web/segments',
  webWorkflows: '/onboarding/web/workflows',
  webSummary: '/onboarding/web/summary',
  appDetails: '/onboarding/app/details',
  appSdk: '/onboarding/app/sdk',
  chatChannels: '/onboarding/chat/channels',
  chatDesign: '/onboarding/chat/design',
  chatAgents: '/onboarding/chat/agents',
  settingsInstall: '/settings/installation',
  mobileInstall: '/mobile-app-push/installation',
};

/** Navigate to an app-dashboard path and wait for the SPA to settle. */
async function goto(page, route, opts = {}) {
  const url = route.startsWith('http') ? route : cfg.appDashboardUrl + route;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeouts.nav, ...opts });
  await waitForSpa(page);
}

/** Wait for common antd/React loading spinners to clear. */
async function waitForSpa(page, timeout = 12000) {
  try {
    await page.waitForFunction(() => {
      const s = document.querySelectorAll('.ant-spin-spinning, .loading, .spinner, [class*="skeleton"]');
      return s.length === 0;
    }, { timeout });
  } catch (e) { /* proceed regardless */ }
}

/* -------------------------------------------------------------- telemetry */
/**
 * Install a dataLayer capture shim BEFORE any wizard script runs.
 * Call inside a fresh context via `context.addInitScript(...)` OR use
 * `startTelemetryCapture(page)` which does it on the current page.
 * Retrieve events later with `getTelemetry(page)`.
 */
const TELEMETRY_INIT = () => {
  window.__peEvents = window.__peEvents || [];
  window.dataLayer = window.dataLayer || [];
  const origPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function (...args) {
    try { args.forEach((a) => window.__peEvents.push(a)); } catch (e) {}
    return origPush(...args);
  };
};

async function startTelemetryCapture(context) {
  // context = BrowserContext; must be called before navigation.
  await context.addInitScript(TELEMETRY_INIT);
}

async function getTelemetry(page) {
  return page.evaluate(() => (window.__peEvents || []).slice());
}

/** Filter captured events to onboarding ones, optionally by event name. */
function onboardingEvents(events, eventName) {
  return (events || []).filter((e) => {
    const name = e && (e.event || e.eventName);
    if (eventName && name !== eventName) return false;
    return typeof name === 'string' && (name.startsWith('ai_onboarding') || name === 'verify_installation');
  });
}

/* ------------------------------------------------------------ localStorage */
function snapshotKey(siteId) { return `pe_ai_onboarding_data_${siteId}`; }

async function readSnapshot(page, siteId) {
  return page.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return localStorage.getItem(k); }
  }, snapshotKey(siteId));
}

async function readOnboardingKeys(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pe_ai_onboarding')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

async function setRawSnapshot(page, siteId, rawValue) {
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: snapshotKey(siteId), v: rawValue });
}

/* ---------------------------------------------------------------- network */
/**
 * Start collecting onboarding-ai requests/responses.
 * Returns a handle with `.calls` (array) and `.stop()`.
 */
function watchOnboardingApi(page) {
  const calls = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    if (!/onboarding-ai\//.test(url)) return;
    let body = null;
    try { body = await resp.json(); } catch (e) { /* non-JSON */ }
    calls.push({
      url,
      endpoint: url.split('onboarding-ai/')[1] || '',
      method: resp.request().method(),
      status: resp.status(),
      fallback: body && typeof body.fallback === 'boolean' ? body.fallback : null,
      body,
    });
  };
  page.on('response', onResponse);
  return { calls, stop: () => page.off('response', onResponse) };
}

/* ------------------------------------------------------------------ sider */
/** True when the left navigation sider is visible (should be hidden in-wizard). */
async function isSiderVisible(page) {
  // TODO(selector): confirm the sider element id/class against the app.
  const candidates = ['#pe-page-sider', '.pe-page-sider', 'aside[class*="sider" i]', '.ant-layout-sider'];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      return el.isVisible().catch(() => false);
    }
  }
  return false;
}

/* --------------------------------------------------------------- site UI */
/**
 * Switch the active site via the header SiteSelector.
 * TODO(selector): confirm the header selector + option markup.
 */
async function switchSite(page, siteName) {
  const trigger = page.locator('[class*="SiteSelector" i], [class*="site-selector" i], header [class*="select" i]').first();
  await trigger.click();
  await page.getByText(siteName, { exact: false }).first().click();
  await waitForSpa(page);
}

/** Read the current site id from localStorage.currentSite (best effort). */
async function currentSiteId(page) {
  return page.evaluate(() => {
    try { return localStorage.getItem('currentSite'); } catch (e) { return null; }
  });
}

module.exports = {
  routes,
  goto,
  waitForSpa,
  TELEMETRY_INIT,
  startTelemetryCapture,
  getTelemetry,
  onboardingEvents,
  snapshotKey,
  readSnapshot,
  readOnboardingKeys,
  setRawSnapshot,
  watchOnboardingApi,
  isSiderVisible,
  switchSite,
  currentSiteId,
};
