<div align="center">
  <img src="public/Spendr%20Logo.png" alt="Spendr" width="220" />
  <h1>Spendr</h1>
  <p>A personal finance tracker for income, spending, budgets, and savings goals.</p>
  <p>
    <img alt="Next.js 14.2.29" src="https://img.shields.io/badge/Next.js-14.2.29-000000?logo=next.js&logoColor=white" />
    <img alt="React 18.3.1" src="https://img.shields.io/badge/React-18.3.1-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript 5.7.2" src="https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript&logoColor=white" />
    <img alt="Tailwind CSS 3.4.16" src="https://img.shields.io/badge/Tailwind_CSS-3.4.16-06B6D4?logo=tailwindcss&logoColor=white" />
  </p>
</div>

Spendr includes a web interface and API routes for recording income and expenses, reviewing spending trends, setting category budgets, and tracking savings goals.

> **Deployment note:** Spendr currently has no authentication and stores data in JSON files on the server. The storage implementation is designed for one running server instance, not multiple processes or horizontally scaled hosting. Keep deployments private and access-controlled. Do not expose a shared instance to the public internet or use it for multiple users without first adding authentication, data isolation, and durable transactional storage.

## 📚 Table of Contents

- [📚 Table of Contents](#-table-of-contents)
- [✨ Features](#-features)
- [🧰 Technology](#-technology)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Run locally](#run-locally)
- [💾 Data Storage and Recovery](#-data-storage-and-recovery)
- [📥 CSV Import](#-csv-import)
- [📤 Export, Backup, and Restore](#-export-backup-and-restore)
- [🔌 API Routes](#-api-routes)
- [🧪 Development Checks](#-development-checks)
- [🗂️ Project Structure](#️-project-structure)
- [🔐 Privacy and Deployment](#-privacy-and-deployment)

## ✨ Features

- **Dashboard:** Income and expense totals, monthly trends, expense categories, and recent transactions.
- **Transactions:** Create, edit, delete, search, filter, sort, and paginate entries. Expenses can be split across categories.
- **Analytics:** View income and expense summaries, monthly trends, category breakdowns, and custom date ranges.
- **Budgets:** Set monthly category limits and compare them with recorded spending.
- **Category rules:** Automatically assign a category to new or edited transactions categorized as `Other` when the description matches a saved phrase. Longer phrases take precedence; existing transactions are not changed until edited and saved.
- **Savings goals:** Create goals and manually record contributions. Contributions do not create or change transactions.
- **Recurring templates:** Mark transactions as recurring and reuse their details when adding another transaction. Spendr does not currently schedule or automatically create recurring transactions.
- **CSV import:** Map columns, preview and validate rows, and optionally skip duplicates.
- **Export:** Download all transactions as CSV or JSON.
- **Backup and restore:** Download a versioned backup or replace the current dataset from a validated backup. Restore creates a recovery snapshot first.
- **Undo deletion:** An Undo action is shown for 15 seconds; the server accepts restoration for up to one minute.
- **Themes:** System, light, and dark modes.

## 🧰 Technology

- Next.js 14 App Router and React 18
- TypeScript
- Tailwind CSS and Radix UI primitives
- Recharts for charts
- date-fns and React Day Picker for date controls
- Sonner for notifications
- next-themes for theme selection
- Server-side JSON file persistence

## 🚀 Getting Started

### Prerequisites

- Node.js with npm

The repository does not currently declare a supported Node.js version. Use a currently supported Node.js LTS release compatible with the locked Next.js dependencies.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The server creates its data directory when it starts.

To use a different data directory, set `DATA_DIR` in `.env.local` to an absolute path:

```dotenv
DATA_DIR=/absolute/path/to/spendr-data
```

Keep the data directory private and include it in a secure backup plan. `.env.local` and the `data/` directory are ignored by Git.

## 💾 Data Storage and Recovery

Spendr persists data on the server, not in the browser. By default, files are stored in `<project-root>/data/`; `DATA_DIR` changes that location.

| File                         | Purpose                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `transactions.json`          | Active transactions                                                                 |
| `transaction-meta.json`      | Short-lived deletion/Undo records and import/restore retry receipts                 |
| `transaction-journal.json`   | Temporary recovery journal used to finish an interrupted transaction/metadata write |
| `category-budgets.json`      | Category budget limits                                                              |
| `category-rules.json`        | Description matching rules                                                          |
| `savings-goals.json`         | Savings goals and recorded progress                                                 |
| `backups/pre-restore-*.json` | Recovery snapshots created before backup restore                                    |

Individual JSON files are written through a temporary file and atomic replacement. Transaction data and its metadata use a journal so an interrupted write can be completed on the next storage operation. This does not make the store safe for concurrent server processes. Do not manually remove a journal while a write is in progress. Recovery snapshots remain on disk until removed manually; protect and periodically review them because they contain financial data.

The current store is intended for one running server instance and is not a multi-process database. It does not provide user accounts, authentication, authorization, or per-user data separation. Deploy only in a trusted, access-controlled environment until those capabilities and a suitable persistent backend are implemented.

## 📥 CSV Import

From **Transactions → Data → Import CSV**, select a header-first comma- or semicolon-separated file, map the columns, review the preview, and submit the import.

- Required fields: Type, Amount, Description, Date.
- Optional fields: Category (defaults to `Other`), Recurring (defaults to No), and Splits (JSON allocation data from a Spendr CSV export).
- Dates must be valid `YYYY-MM-DD` values. Types are `Income` or `Expense`. Amounts must be positive and have no more than two decimal places.
- Categories must match one of Spendr's built-in categories. Recurring values accept yes/no, true/false, or 1/0.
- Splits are supported for expenses, require unique categories, and must add up to the transaction amount.
- Quoted commas, escaped quotes, multiline fields, UTF-8 BOM, and CRLF line endings are supported.
- Any invalid row blocks the entire import. CSV files are limited to 5 MiB and 10,000 transactions.
- Duplicate skipping is enabled by default. It compares type, amount, trimmed description, date, category, and recurring status, including duplicates within the import file.
- Import operation IDs make retries safe, including when duplicate skipping is off. The browser stores retry fingerprints and IDs in session storage, not financial payloads. If session storage is unavailable, retry protection lasts only for the current page session.

## 📤 Export, Backup, and Restore

The transaction export downloads the complete transaction history, not just the currently displayed page. CSV and JSON exports are transaction exports and are not complete backups.

A version 1 backup includes transactions, IDs, recurring flags, splits, budgets, category rules, savings goals, creation time, and the current theme preference. Backup files are limited to 100 MiB and 100,000 transactions. Restore validates the file and requires explicit confirmation before replacing current data. An empty transaction list is a valid backup and can clear the active transaction dataset. Restore invalidates pending Undo actions and creates a recovery snapshot of the previous data. The UI offers a download link for that snapshot after restore.

Recovery snapshots are stored in `data/backups/` (or under the configured `DATA_DIR`) and are retained until manually removed. Treat backups and recovery snapshots as sensitive financial records. Back up the complete data directory securely; a portable backup downloaded through the app does not include temporary Undo records or retry receipts.

## 🔌 API Routes

All routes are implemented in the Next.js application and use the shared server-side JSON store.

| Method   | Route                                   | Description                                                                                                                                                   |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/transactions`                     | List transactions with filters and pagination: `type`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `category`, `search`, `sort`, `order`, `page`, `limit` |
| `POST`   | `/api/transactions`                     | Create a transaction                                                                                                                                          |
| `GET`    | `/api/transactions/:id`                 | Retrieve one transaction                                                                                                                                      |
| `PUT`    | `/api/transactions/:id`                 | Update a transaction                                                                                                                                          |
| `DELETE` | `/api/transactions/:id`                 | Delete a transaction and return an Undo token and expiry                                                                                                      |
| `POST`   | `/api/transactions/undo`                | Restore a recent deletion using `{ "token": "…" }`                                                                                                            |
| `GET`    | `/api/transactions/recurring`           | List recurring transaction templates                                                                                                                          |
| `GET`    | `/api/insights`                         | Return analytics; optional `dateFrom` and `dateTo` use `YYYY-MM-DD`                                                                                           |
| `GET`    | `/api/budgets?month=YYYY-MM`            | Return budget status and categories for a month                                                                                                               |
| `PUT`    | `/api/budgets`                          | Replace the category budget limits                                                                                                                            |
| `GET`    | `/api/category-rules`                   | List category rules                                                                                                                                           |
| `POST`   | `/api/category-rules`                   | Add or update a rule using `{ "matchText": "…", "category": "…" }`                                                                                            |
| `DELETE` | `/api/category-rules?id=…`              | Remove a category rule                                                                                                                                        |
| `GET`    | `/api/savings-goals`                    | List savings goals                                                                                                                                            |
| `POST`   | `/api/savings-goals`                    | Create a goal                                                                                                                                                 |
| `PATCH`  | `/api/savings-goals`                    | Record a contribution using `{ "id": "…", "contribution": 12.34 }`                                                                                            |
| `DELETE` | `/api/savings-goals?id=…`               | Remove a goal                                                                                                                                                 |
| `POST`   | `/api/import`                           | Import validated transactions with duplicate choice and operation ID                                                                                          |
| `GET`    | `/api/export?format=csv\|json`          | Export all transactions as CSV or JSON                                                                                                                        |
| `GET`    | `/api/backup?theme=system\|light\|dark` | Download a complete backup                                                                                                                                    |
| `GET`    | `/api/backup?recovery=<filename>`       | Download a prior-restore recovery snapshot                                                                                                                    |
| `POST`   | `/api/backup`                           | Restore a backup with explicit confirmation, current theme, and operation ID                                                                                  |

The API currently has no authentication or authorization. Do not expose these endpoints to untrusted users.

## 🧪 Development Checks

```bash
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

The Node test suite covers storage, API routes, CSV parsing, data-transfer validation, and retry-operation helpers. Tests use temporary data directories. Run these checks before submitting changes; the project does not currently include browser end-to-end tests.

## 🗂️ Project Structure

```text
app/                 Pages, layout, styles, and API route handlers
components/          Feature components and reusable UI primitives
lib/                 Domain types, validation, CSV helpers, and JSON storage
tests/               Node-based API, storage, CSV, and validation tests
public/              Static icons and images
```

## 🔐 Privacy and Deployment

The application handles financial information. The current code stores transaction data on the server and has no authentication. Review the privacy and terms pages against the actual deployment and data flows before inviting users; configure hosting access controls, secure backups, logging, and data retention appropriately. The cookie banner currently stores a consent choice in browser local storage; it does not itself configure analytics or third-party cookies.
