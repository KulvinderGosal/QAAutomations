# QA Report — Marketing Site: Pricing Page & Schedule Demo Page (Production)

**Date:** 2026-10-05
**Tester:** QA Automation (Playwright, Chromium desktop @ 1440×900)
**Environment:** Production — `https://www.pushengage.com`
**Pages under test:**
- Pricing: https://www.pushengage.com/pricing
- Schedule Demo: https://www.pushengage.com/schedule_demo/
**Flows requested:** Signup flow + Schedule Demo flow

> **Non-destructive policy:** All checks are read-only / safe. The signup form was
> opened and verified but **no account was created**, and the Schedule Demo wizard was
> walked through its steps but the **final booking was never submitted** — no real lead
> was generated in production.

---

## Verdict: ✅ PASS — both pages and both flows are healthy

Both pages load (HTTP 200), render correctly, have no JavaScript page errors, and the
signup and schedule-demo flows work end-to-end up to (but not including) the point that
would create real production data. 8/8 automated checks pass.

---

## Results

### Pricing Page

| ID | Scenario | Priority | Result |
|---|---|---|---|
| PE-MKT-PRICING-001 | Page loads, title `…Pricing…`, plan cards (Growth/Premium/Business) visible, 0 JS page errors | P0 | ✅ Pass |
| PE-MKT-PRICING-002 | All plan CTAs carry correct `planName` (free/growth/premium/business); paid plans include a `plan=plan_…` Stripe id | P0 | ✅ Pass |
| PE-MKT-PRICING-003 | Free-plan CTA (`/signup/?planName=free&ref=pricing`) opens the signup form (email/password/submit render) | P0 | ✅ Pass |
| PE-MKT-PRICING-004 | Monthly/Yearly toggle updates displayed pricing | P1 | ✅ Pass |
| PE-MKT-PRICING-005 | "Book a strategy call" links to `/schedule_demo/` | P1 | ✅ Pass |

**CTA → signup mapping verified (plan params intact):**
- `Try it free` → `/signup/?planName=free&ref=pricing`
- `Get Growth`  → `/signup/?planName=growth&plan=plan_PBbbyOHAzmKM35&ref=pricing`
- `Get Premium` → `/signup/?planName=premium&plan=plan_Mj8tSAoZEDAeRB&ref=pricing`
- `Get Business`→ `/signup/?planName=business&plan=plan_Mj8sg96JELVnuk&ref=pricing`

Signup page (`/signup/`) renders the full 4-step funnel (Choose Plan → Setup Account →
Payment Info → Instant Access) with Email, Password (min 10 chars), First/Last Name,
Website, Industry, "Register with Google", and the correct right-rail plan context.

### Schedule Demo Page

| ID | Scenario | Priority | Result |
|---|---|---|---|
| PE-MKT-DEMO-001 | Page loads, title `…Demo…`, WPForms demo form + work-email field present, 0 JS page errors | P0 | ✅ Pass |
| PE-MKT-DEMO-002 | Step 1 empty "Continue" blocks advance and shows "This field is required." on the 4 required fields (email, first, last, website) | P0 | ✅ Pass |
| PE-MKT-DEMO-003 | Valid step-1 data advances to Step 2 of 3 (role / monthly sessions / mobile app / channels / marketing platform), ending at "See available times" | P1 | ✅ Pass |

The demo form is a 3-step WPForms wizard:
1. **Tell us where to start** — work email, first/last name, company website, optional agenda question
2. **Help us prepare your call** — role, monthly sessions, mobile app, channels (optional), marketing platform (optional)
3. **See available times** — time-slot selection (not exercised to avoid creating a real booking)

---

## Observations (informational — not defects)

1. **Third-party analytics/ad beacons are aborted or return 4xx** on both pages —
   `analytics.google.com/g/collect`, `ad.doubleclick.net/ccm/s/collect` (`ERR_ABORTED`),
   `www.google.com/ccm/collect`. This is normal tracker/consent-gated behavior and does
   not affect page functionality. No first-party (`pushengage.com`) request failed.
2. **Cookie-consent banner overlaps content** on initial load — it sits over the top-left
   of the Enterprise plan card (pricing) and over the hero copy (schedule demo). Purely
   cosmetic; content is reachable after Accept/Reject. Consider repositioning if flagged by design.
3. **Pricing defaults to the "Yearly" view.** Intentional, but worth confirming with the
   growth team that annual-first is the desired default.

---

## How to run

```bash
# Dependencies
npm install

# Sandbox/proxied runner (point at a Chromium binary; proxy auto-used from HTTPS_PROXY):
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  npx playwright test --config playwright-marketing.config.js

# CI / machine with system Chrome:
npx playwright test --config playwright-marketing.config.js

# One-off exploratory discovery + flow scripts (artifacts in test-results/prod-qa/):
node scripts/prod-discovery.js
node scripts/prod-flows.js
```

Screenshots and raw discovery/flow JSON are written to `test-results/prod-qa/`.
