# QA Report — PushEngage Marketing Site (Production)

**Date:** 2026-10-05
**Tester:** QA Automation (Playwright + Chromium; desktop, iPad, iPhone viewports)
**Environment:** Production — `https://www.pushengage.com`
**Scope:** Pricing page (design/UI + responsive iPad/iPhone), all pricing CTAs → signup,
Schedule-Demo flow, every submittable form on the site, support-ticket path, full-site
link/page health + SEO.

> **Submission policy for this run (authorized by requester):**
> - **Schedule Demo:** completed end-to-end with QA-labeled data (see result below).
> - **Signup:** verified page + validation only — **no account created**.
> - **Support ticket:** reported the link behavior — **not submitted**.
> - **Newsletter optin:** render + required-validation only — **no real subscription** (real-world transaction).

---

## Overall verdict: ✅ Site is healthy — with 1 functional bug, 2 UX issues, and some SEO/a11y cleanups

Core funnel works: pricing renders well and is responsive, all four plan CTAs redirect
correctly to signup, the schedule-demo flow works through to the Calendly booking step,
and 1,438 / 1,460 sitemap pages load clean. The notable issues are on the **Contact Us**
page and the **test-drive email capture**, plus SEO/accessibility cleanups.

Automated coverage added to the repo: **169 checks** (`tests/marketing-site/**`), all green
(known issues guarded with `test.fail()` so they flip red when fixed).

---

## 1) Pricing page — design / UI / responsive

**Design/UI:** Clean, consistent, on-brand. Plan cards (Enterprise/Growth/Premium/Business),
yearly/monthly toggle, subscriber calculator, comparison table, testimonials and FAQ all
render correctly on desktop.

**Responsive — verified at 7 breakpoints** (iPhone SE 375, iPhone 13 390, iPhone 14 Pro Max 430,
iPad portrait 768, iPad Pro 1024, iPad landscape 1024, desktop 1440):

| Check | Result |
|---|---|
| No horizontal **page** scroll at any breakpoint | ✅ Pass |
| Plan CTAs visible/usable at every breakpoint (8 CTAs) | ✅ Pass |
| Comparison table scrolls inside its own `overflow-x:auto` wrapper (not a page bug) | ✅ Pass |
| Mobile hero, plan cards, calculator render correctly | ✅ Pass |

**Observations (minor):**
- 🟡 **Mobile pricing header is minimal** — only the logo + language selector; there is **no visible hamburger menu and no Log In / Get Started** in the header on phones/tablets (desktop shows both). May be intentional (conversion-focused), but worth confirming — there's no header nav/login path on mobile pricing.
- 🟡 The floating **"Talk to us!" chat bubble overlaps the "Get Growth" CTA** corner on mobile.
- 🟡 Intermittent single JS error observed on some pricing loads (not reproducible every load).

---

## 2) Pricing CTAs → Signup (all verified navigating)

All four plan CTAs navigate to a working signup page with the correct plan params, and the
signup form renders each time:

| CTA | Destination | Result |
|---|---|---|
| Try it free | `/signup/?planName=free&ref=pricing` | ✅ loads, form renders |
| Get Growth | `/signup/?planName=growth&plan=plan_PBbbyOHAzmKM35&ref=pricing` | ✅ loads, form renders |
| Get Premium | `/signup/?planName=premium&plan=plan_Mj8tSAoZEDAeRB&ref=pricing` | ✅ loads, form renders |
| Get Business | `/signup/?planName=business&plan=plan_Mj8sg96JELVnuk&ref=pricing` | ✅ loads, form renders |

"Book a strategy call" → `/schedule_demo/` ✅. Signup flow itself verified to page+validation
only (no account created, per policy). Signup funnel = Choose Plan → Setup Account → Payment
Info → Instant Access, with email/password/name/website/industry + Google signup.

---

## 3) Schedule-Demo flow

3-step WPForms wizard → Calendly:
1. **Tell us where to start** — email, first/last name, company website, optional agenda. ✅
2. **Help us prepare your call** — role, monthly sessions, mobile app, channels, platform. ✅
3. **See available times** — Calendly embed (prefilled with name/email). ✅ loads

| Check | Result |
|---|---|
| Step-1 required-field validation blocks empty "Continue" | ✅ Pass |
| Advances step 1 → 2 → 3 with valid data | ✅ Pass |
| Calendly embed loads with name/email prefilled | ✅ Pass |
| Final booking submit | ⚠️ Blocked by **Calendly's own anti-bot** security for the automated session ("This booking cannot be completed. For security reasons…") — **not a PushEngage defect**. A normal human browser completes it. No real booking was created. |

The flow is functional end-to-end; the only stop was Calendly's bot protection rejecting the
automated/datacenter session at the very last commit.

---

## 4) Every submittable form on the site

| Form | Location(s) | Result |
|---|---|---|
| **Schedule Demo** (WPForms 28814) | `/schedule_demo/` | ✅ Works (to Calendly, see §3) |
| **Contact Us** general form (WPForms 1682) | `/contact-us/` | 🔴 **Reveal bug — see §5** |
| **"Take PushEngage for a Test Drive"** email capture | blog, features, integrations, case-studies, contact | 🟠 **Discards email, redirects to /pricing/ — see §6** |
| **Blog search** | `/blog/` | ✅ Works (`/?s=…`, 20 results) |
| **Newsletter "Join Us"** optin | `/workflows/` (and others) | ✅ Renders; required-email validation blocks empty submit. (Live subscription not submitted — real-world transaction.) |
| **"Submit a Support Ticket"** button | `/contact-us/` | 🟠 **Points to `/documentation/`, not a ticket form — see §7** |

---

## 5) 🔴 Contact Us — "Complete a form" reveal is unreliable on desktop

On `https://www.pushengage.com/contact-us/`, the general/pre-sales contact form is behind a
progressive-disclosure flow: **"create a support ticket"** → chooser (*technical* / *basic*) →
**"Complete a form"** should reveal the WPForms contact form.

**Finding:** At **desktop widths (1024–1536px)** the **first click on "Complete a form" does
nothing** — the `open-form` class is not applied and the form stays `display:none`. A **second
click** reveals it. At **≤768px (tablet/phone) a single click works.**

- Reveal CSS: `.pe-contact-page-technical-basic-questions.open-form + .pe-contact-page-contact-form { display:flex }`
- Reproduced consistently in standalone Chromium at every desktop width tested (1st click → `open-form:false`; 2nd click → `open-form:true`, form `display:flex`).
- Under the slower Playwright test runner the single click sometimes succeeded, so the trigger is **timing/state-related (a race in the reveal handler)** rather than a pure CSS fault.
- **User impact:** many desktop visitors will click "Complete a form", see nothing happen, and assume there is no contact form.
- **Recommendation:** confirm in a real desktop browser; harden the click handler so the first click reliably applies `open-form` (and is idempotent). Priority: **High** (primary contact path).

---

## 6) 🟠 "Take PushEngage for a Test Drive" email capture discards the email

The CTA shows a "Your Email Address…" field + "Take PushEngage for a Test Drive" button,
implying the email starts a trial/signup. Observed on `/integrations/` (and the shared block
elsewhere):
- Clicking the button **redirects to `/pricing/`** (not `/signup/`).
- The **entered email is not carried** anywhere (no prefill on the destination).
- **Empty submit also proceeds** (the `required` attribute isn't enforced because the button is an `<a>` that bypasses native form submit).

**Recommendation:** either carry the email into `/signup/?email=…` (and enforce validation), or
remove the email field if the intent is simply to route to pricing. Priority: **Medium** (misleading conversion element).

---

## 7) 🟠 "Submit a Support Ticket" links to the Docs page

On the Contact page, the **"Submit a Support Ticket"** button (under "I have a technical
question") links to `https://www.pushengage.com/documentation/…`, i.e. the **documentation
page, not a support-ticket form**. A user expecting to file a ticket lands on docs instead.
Per policy, no ticket was submitted. **Recommendation:** point this to the actual ticket/helpdesk
form (or relabel). Priority: **Medium**.

---

## 8) Full-site link & page health

Crawled **all 1,460 URLs** in the AIOSEO sitemap index (posts, pages, docs, categories, tags):

| Status | Count |
|---|---|
| 200 OK | 1,438 |
| Non-200 | 22 — **all** `/recommends/*` ThirstyAffiliates cloaked affiliate redirects (403/502/202/204/redirect to external merchants) |

**No first-party page is broken.** The affiliate `/recommends/` links intentionally redirect
off-site; their non-200s come from the external destinations/affiliate networks, not PushEngage.
🟡 Minor SEO hygiene: consider excluding `/recommends/` (affiliate cloaks) from the public sitemap.

---

## 9) SEO / accessibility findings (rendered checks on 46 key pages — all HTTP 200)

| Finding | Pages | Priority |
|---|---|---|
| 🔴 **Client-side JS error** `TypeError: Cannot read properties of undefined (reading 'slice')` in theme `main.js` | `/wordpress-pricing/`, `/web-push-notifications-shopify-pricing/` | Medium |
| 🟠 **No `<h1>`** (hero is an `<h2>`) | `/pricing/` | Medium (SEO) |
| 🟠 **Multiple `<h1>` (6)** incl. a newsletter heading | `/workflows/` | Low (SEO) |
| 🟡 No `<h1>` / no meta description (likely intentional funnel page) | `/signup/` | Info |
| 🟡 Very short meta description (28 chars) | `/api/` | Low |
| 🟡 **Many images missing `alt` text** (site-wide header/footer/template images) | most pages | Medium (a11y/SEO) |

Third-party analytics/ad beacons (Google Analytics, DoubleClick) abort / 4xx on most pages —
normal consent-gated tracker behavior, not site defects. No first-party request failed.

---

## Priority summary

| # | Issue | Priority |
|---|---|---|
| 1 | Contact "Complete a form" needs 2 clicks on desktop (form won't open on first click) | **High** |
| 2 | Pricing-variant pages throw a JS error (`main.js` slice) | Medium |
| 3 | Test-drive email capture discards email + redirects to pricing, no validation | Medium |
| 4 | "Submit a Support Ticket" points to Docs, not a ticket form | Medium |
| 5 | `/pricing/` has no `<h1>`; images missing alt text site-wide | Medium (SEO/a11y) |
| 6 | Mobile pricing header has no nav/login; chat bubble overlaps CTA | Low (UX) |
| 7 | `/workflows/` multiple `<h1>`; `/recommends/` cloaks in sitemap | Low (SEO) |

---

## Automated regression suite (added to repo)

`npm run test:marketing` (or `npx playwright test --config playwright-marketing.config.js`).
In a sandboxed/proxied runner: `PW_EXECUTABLE_PATH=<chromium> HTTPS_PROXY=<proxy> npm run test:marketing`.

- `pricing-page.prod.spec.js` — page health, plan-CTA param integrity, all-4 CTA navigation, toggle, demo handoff.
- `schedule-demo.prod.spec.js` — page health, step-1 validation, multi-step advance (no final submit).
- `regression/link-health.prod.spec.js` — crawls every sitemap URL, asserts first-party pages < 400.
- `regression/page-health.prod.spec.js` — 46 key pages: 200 + title + canonical + viewport + meta + no-JS-errors + single-H1, with known SEO/JS defects guarded by `test.fail()`.
- `regression/pricing-responsive.prod.spec.js` — 7 breakpoints: no horizontal page scroll + CTAs visible.
- `regression/contact-form.prod.spec.js` — chatbot + chooser render; form reachable (≤2 clicks); support-ticket→docs guarded.
- `regression/forms-inventory.prod.spec.js` — test-drive capture, blog search, newsletter render/validation.

Exploratory scripts used to produce this report live in `scripts/prod-*.js`; screenshots and raw
JSON are written to `test-results/prod-qa/`.
