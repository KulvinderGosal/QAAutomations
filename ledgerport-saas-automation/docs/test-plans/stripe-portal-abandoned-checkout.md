# Test plan — Stripe portal upgrade: abandoned checkout must not consume coupons

**Asana:** QA: Stripe portal upgrade — abandoned checkout must not consume coupons
**Type:** manual / dev E2E (not API-automatable — Stripe-hosted portal + webhook + DB/Redis)

## Why
An existing Stripe subscriber changing plans goes through the **Stripe billing portal** (not a new checkout). The bug: the coupon redemption was recorded the moment the **portal session was created**, so abandoning the portal permanently burned a one-time coupon. Fixed so redemption is recorded only when the subscription actually lands on the target price (via the `customer.subscription.updated` webhook), with the pending redemption held in Redis (`stripe:pending_redemption:<subscriptionId>`, 24h TTL).

## Preconditions
- Stripe **test mode**.
- An **existing** Stripe subscriber account (already on a paid plan).
- A coupon configured **`maxPerAccount=1`**.
- Read access to the **`discount_redemptions`** table and Redis key `stripe:pending_redemption:<subscriptionId>`.
- Ability to observe / re-deliver Stripe webhook events (Stripe CLI / dashboard).

## Cases
| ID | Steps | Expected |
|----|-------|----------|
| **LP-STR-1 · abandon** | Start a plan change with the coupon → get redirected to the Stripe portal → **close it without confirming**. | **No row** in `discount_redemptions`. The coupon **still validates** and applies on the next attempt. A Redis pending key may exist but must not count as a redemption. |
| **LP-STR-2 · confirm** | Repeat, but **confirm** the plan change in the portal. Wait for the subscription to update. | **Exactly one** redemption recorded — *after* the subscription actually lands on the target price (not at session creation). The coupon is then **rejected** on any later attempt with reason `account_limit_reached`. |
| **LP-STR-3 · unrelated action** | While an upgrade is pending unconfirmed, perform an **unrelated** portal action (e.g. update payment method). | The coupon is **not** consumed — no redemption row, coupon still valid. |
| **LP-STR-4 · duplicate webhook** | Trigger/redeliver the `customer.subscription.updated` webhook **twice** for the same successful change. | Idempotent — redemption count **stays 1** (no double-count). |

## Verification queries
- Redemptions: `SELECT * FROM discount_redemptions WHERE account_id = <acct> AND coupon_code = '<CODE>';`
- Pending (Redis): `GET stripe:pending_redemption:<subscriptionId>`
- Coupon still valid after abandonment: re-run the coupon validation (see the coupon-validate API spec) → `valid:true`.

## Notes / safety
- Stripe **test mode only** — no real charges. Do not run against live billing.
- A `429` during coupon re-validation is the rate limiter (20/min), not a bug — space out attempts.
