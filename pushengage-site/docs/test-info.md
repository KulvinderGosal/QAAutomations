# PushEngage Marketing Site — Test Info

**Product:** pushengage.com public marketing site (WordPress + WooCommerce, behind Cloudflare).
**Skill:** `qa-pushengage-site` · **Coverage:** `coverage/component-test-sheet.csv`
**Credentials master (private):** "QA of LedgerPort" Sheet → *PushEngage Site* info. Local secrets in `.env` (see `.env.example`).

## Targets
- Production: https://www.pushengage.com
- Staging: https://staging.pushengage.com
- Select with `TEST_ENV=production|staging`.

## Accounts (by role — actual creds in .env / Sheet)
- Free-plan signup uses pattern `<QA_EMAIL user>+qa<random>@<QA_EMAIL domain>` (`QA_EMAIL` in `.env`).
- Login is gated by Cloudflare Turnstile — scripted login is blocked; test form/validation only.

## Key scenarios
- Home/hero, navigation, pricing table & toggles.
- Free-plan signup form submission + validation.
- Contact form, schedule-demo, forgot-password.
- Footer/legal links and encoding scans.

## Gotchas
- Claude-in-Chrome blocks pushengage.com — use Playwright + curl.
- Pages are very tall (~14k px); screenshots time out. Do visual checks via `page.evaluate`.
- curl needs a desktop browser UA (Cloudflare won't challenge it).

## How to run
`npm test` (or `TEST_ENV=staging npm test`). Reports under `playwright-report/`.

> Bug log: see [marketing-site QA memory] and the Google Sheet (https://docs.google.com/spreadsheets/d/1Cy5kSAZFIQMWpFFnB1mHOedtt897Xa0of6oDcgfsKo8/edit).
