# Test plan — Invoice "Pay" button in a QuickBooks Production account

**Asana:** Test Invoice Pay button in QB Production Account
**Type:** manual, **production**-only (QuickBooks payment links work in production only)

## Why
QuickBooks Online invoice **payment links only function in production**. In sandbox the link redirects to an error page (documented Intuit behavior — see the Intuit dev thread in the task). So the Pay button must be verified against a **QB production** account.

## Preconditions
- LedgerPort connected to a **QuickBooks *production*** account (not sandbox).
- An invoice synced to QB that exposes the **Pay** button / payment link.
- QuickBooks Payments enabled on that production account.

## Cases
| ID | Steps | Expected |
|----|-------|----------|
| **LP-QBPAY-1 · prod link resolves** | Open an invoice with the **Pay** button in the production account → click **Pay** (or open the payment link). | Redirects to a **working QuickBooks payment page** for that invoice — **not** the sandbox error page. Page shows the correct invoice amount/number. |
| **LP-QBPAY-2 · link integrity** | Inspect the payment link URL. | Points at the QB **production** payments host (not `sandbox`), and is tied to the correct invoice id. |
| **LP-QBPAY-3 · sandbox regression note** | (Reference only) In a sandbox account, the same link redirects to the Intuit error page. | Expected/known Intuit limitation — **not** a LedgerPort bug. Document, don't file. |

## Safety
- **Do NOT complete a real payment.** Verify only that the payment page **loads correctly**; stop before entering any card / submitting payment.
- Use a low-value / test invoice where possible even in production.
