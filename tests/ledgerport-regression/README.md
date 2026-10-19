# Ledgerport Regression Automation (Playwright)

Dedicated, organized Playwright automation for:

- Base URL: `https://staging.ledgerport.com/`
- Primary signup identity: `kgosal@awesomemotive.com`

## Structure

```text
tests/ledgerport-regression/
├── fixtures/
│   └── test-data.js
├── pages/
│   ├── base.page.js
│   ├── home.page.js
│   └── signup.page.js
├── specs/
│   ├── smoke/
│   │   └── homepage-and-signup-entry.spec.js
│   └── regression/
│       └── signup-form-regression.spec.js
└── utils/
    ├── env.js
    └── test-helpers.js
```

## Environment Variables

Copy `.env.ledgerport.example` to `.env` (or merge values into your existing `.env`):

```env
LEDGERPORT_BASE_URL=https://staging.ledgerport.com
LEDGERPORT_SIGNUP_PATH=/signup
LEDGERPORT_SIGNUP_EMAIL=kgosal@awesomemotive.com
LEDGERPORT_SIGNUP_PASSWORD=TempPass@123
LEDGERPORT_FIRST_NAME=Kulvinder
LEDGERPORT_LAST_NAME=Gosal
LEDGERPORT_COMPANY=Awesome Motive
LEDGERPORT_PHONE=5551234567
LEDGERPORT_WEBSITE=https://awesomemotive.com
HEADLESS=true
```

## Commands

Run from repository root:

```bash
npm run test:ledgerport:smoke
npm run test:ledgerport:regression
npm run test:ledgerport
```

## Notes

- The suite uses resilient selector fallbacks for staging UI changes.
- Signup tests use unique tagged emails derived from `LEDGERPORT_SIGNUP_EMAIL`.
- Assertions validate flow progression and blocking-client-validation behavior to keep tests stable across expected backend responses (success, already-exists, etc.).
