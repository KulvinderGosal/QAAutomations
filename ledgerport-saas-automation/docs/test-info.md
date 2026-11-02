# LedgerPort SaaS Dashboard — Test Info

**Product:** LedgerPort SaaS dashboard (app.ledgerport.com) + its Shopify↔QuickBooks connector.
**Skill:** `qa-ledgerport-saas` · **Coverage:** `coverage/component-test-sheet.csv` (mirrors the Sheet's Component Test Sheet).
**Credentials master (private):** "QA of LedgerPort" Sheet → *SaaS* / *prod acc* tabs. Local secrets in `.env` (see `.env.example`).

## Targets (select via `LP_ENV`, default staging)
- Staging: app-staging.ledgerport.com · API api-staging.ledgerport.com/api/v1
- Production: app.ledgerport.com · API api.ledgerport.com/api/v1
- Shopify store (connector): https://ledgerport-saas.myshopify.com

## Accounts (by role — actual creds in .env / Sheet)
- Staging owner, production owner, read-only user, free-plan staging user.
- Plan accounts: Free / Business / Premium / Growth (see Sheet *prod acc*).
- 2FA account for MFA tests.

## Auth architecture (important)
- Login is Cloudflare-Turnstile gated → scripted login BLOCKED. Capture session once per env: `npm run auth:capture` / `auth:capture:prod` → `.auth/<env>.json`.
- Auth lives in `localStorage.__LEDGERPORT_AUTH_STATE__` (not cookies). `global-setup` auto-refreshes the 15-min access token via `POST {apiBase}/auth/refresh`. Refresh token rotates — re-capture if consumed out-of-band.
- Runs serial (`workers:1`); keep a run < ~15 min.

## Mutations
- `@destructive` tests (Disconnect, Automap, Push to QuickBooks, Create Business, Invite User, Change Plan, Transfer Ownership) only commit when `LP_RUN_MUTATIONS=1`. `npm run test:safe` skips them.

## Key scenarios (8 screens + connector)
- Connections, Mappings, Manual Sync, Audit Log, Manage Accounts/Businesses/Users, Billing.
- Connector: Shopify orders→QB sales receipts, product/inventory/cost sync, sync frequency, skip types, order triggers, historical-sync cutoff, downgrade/upgrade gating, role-based permissions, invitation & ownership transfer.

## DOM gotchas
- No data-testid. Toolbar filters are Radix `role=combobox`. Confirm dialogs: Radix Dialog (forms) / AlertDialog (destructive). Row checkboxes `role=checkbox`. Tables load async. Don't use `networkidle`.

## How to run
`npm test` · `LP_ENV=production npm test` · `npm run test:safe`.

> Full case log + the canonical Component Test Sheet: https://docs.google.com/spreadsheets/d/1Cy5kSAZFIQMWpFFnB1mHOedtt897Xa0of6oDcgfsKo8/edit
