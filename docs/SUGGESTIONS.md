# Spendr: suggestions for a private finance tracker

Spendr is for one person and is not going to be published. That removes auth, multi-tenancy and scaling from the list. The effort goes into data safety, less manual entry and better answers.

## Priority list

| # | Item | Why | Effort |
|---|------|-----|--------|
| 1 | Automatic backups and atomic restore | A bad write or half-finished restore could wipe all history | Small |
| 2 | Bank CSV import with duplicate detection | Manual entry is the main reason trackers get abandoned | Medium |
| 3 | Auto-categorise rules on import and re-run on old data | Removes the repetitive part of every import | Small |
| 4 | Multiple accounts with transfers | Transfers currently look like income or expense and distort totals | Medium |
| 5 | Recurring transactions that post themselves (confirm or skip inbox) | Fixed bills should not need typing | Medium |
| 6 | Safe-to-spend number | The one figure you check daily | Small |
| 7 | Month-over-month comparison per category | Shows where spending actually changed | Small |
| 8 | Subscription view | Finds creeping recurring costs | Small |
| 9 | Net worth over time | Cash flow alone hides savings and debt | Medium |
| 10 | Undo for deletes, tags, receipt attachments | Quality of life | Small each |
| 11 | Move JSON storage to SQLite | Only needed past a few thousand transactions | Large |

Do 1 to 3 first. They protect the data and cut the most manual work. Everything after that is optional.

## Data you can trust

- Automatic daily backup of `data/` to a second location, with one-click restore.
- Make restore atomic: write to a temp file, validate, then swap. If it fails, the old data stays intact.
- Validate imports and show a preview ("42 new, 3 duplicates") before committing.
- Move from JSON to SQLite once search and sorting slow down. You also get constraints and real transactions.

## Less manual entry

- Bank CSV or CAMT import with a saved column mapping per bank.
- Duplicate detection on import: same date, amount and description.
- Category rules that apply on import and can be re-run over existing transactions.
- Recurring transactions that post on their due date, with a confirm-or-skip inbox.
- Quick-add from your phone: a home-screen shortcut that opens the form with the amount focused.

## Better answers

- Month-over-month comparison per category, for example "Food is +€80 vs your 3-month average".
- Safe to spend: income minus fixed bills minus budgets, divided by days left in the month.
- Subscription view: recurring charges, monthly total, and which ones went up.
- Net worth over time across accounts, savings and debts.
- Savings goals with a projected finish date at your current rate.
- Year view and a CSV export of annual totals per category for tax time.

## Fixing what is awkward

- Multiple accounts (checking, savings, cash, card). Transfers between them are neither income nor expense.
- Split transactions, and refunds linked to the original purchase.
- Tags next to categories, for example "holiday 2026" across several categories.
- Receipt photo or note attached to a transaction.
- Undo for deletes instead of a confirm dialog.

## Running it privately

- Run it on your own machine or home server, reachable only on localhost or over Tailscale. Do not expose it to the internet.
- If it ever leaves localhost, add one shared password and HTTPS. Nothing more elaborate.
- Keep `data/` out of git and out of any cloud-synced folder you do not control.
- Encrypt backups (for example with `age`). They contain your full financial history.
