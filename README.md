# Spendr Web

A beautiful, full-featured expense tracker built with Next.js, Shadcn/ui, and Radix UI — the web evolution of the Spendr CLI.

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Real-time stats cards, monthly income/expense bar chart, expense category donut chart, recent transactions |
| **Transactions** | Full CRUD with searchable, filterable, paginated table; sort by any column |
| **Analytics** | Tabbed insights — monthly trends, income/expense category breakdowns with progress bars, key stats |
| **Categories** | 12 built-in categories (Food, Transport, Salary, Investment, etc.) with emoji decoration |
| **Recurring transactions** | Reuse a recurring transaction's details when adding a new occurrence |
| **Undo deletion** | Undo action visible for 15 seconds; server-side recovery window of one minute |
| **CSV import** | Column mapping, preview and validation, optional duplicate skipping; accepts Spendr CSV exports |
| **Export** | One-click CSV or JSON export (entire transaction history) |
| **Backup & restore** | Versioned backup of all transactions and the browser's theme preference; confirmed replacement with an automatic recovery snapshot |
| **System / Light / Dark mode** | Theme menu in the sidebar and mobile header; defaults to System and remembers explicit choices |
| **Local storage** | JSON transaction file with atomic, recoverable writes |

## Stack

- **Next.js 14** (App Router)
- **Shadcn/ui** + **Radix UI** primitives
- **Tailwind CSS** with custom income/expense color tokens
- **Local JSON storage** — synchronous server-side persistence with a recovery journal
- **Recharts** — monthly trend chart + category pie chart
- **Sonner** — toast notifications
- **next-themes** — system/light/dark mode

## Getting Started

```bash
# 1. Install dependencies (from the project root)
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Transactions are stored in `<project-root>/data/transactions.json`. The data directory is created automatically.

## Storage and recovery

Override the storage directory in `.env.local`:

```
DATA_DIR=/absolute/path/to/your/data
```

- `transactions.json` stores the active transactions.
- `transaction-meta.json` stores short-lived Undo records and import/restore retry receipts.
- `transaction-journal.json` exists during a write; the next storage operation completes an interrupted commit. Do not delete it manually. Files are flushed before replacement; directory metadata is also flushed where the operating system/filesystem supports it.
- `backups/pre-restore-*.json` preserves the previous transactions and theme before a restore. These recovery files and metadata are excluded from Git.

The JSON store is intended for one running server instance. It is not a multi-process database. The app has no authentication; run it locally or behind access controls, and keep backups private.

## Import, backup, and restore

Open **Transactions → Data** for CSV import, existing exports, and backup/restore.

### CSV import

Select a comma- or semicolon-separated, header-first CSV, then review column mapping and the preview. Spendr export headers map automatically; imported IDs are ignored and new IDs are assigned.

- Required columns: Type, Amount, Description, Date.
- Optional columns: Category (defaults to Other), Recurring (defaults to No).
- Dates: valid `YYYY-MM-DD`; types: Income or Expense; amounts: positive, decimal point, at most two decimal places.
- Categories must match a built-in Spendr category. Recurring accepts yes/no, true/false, or 1/0.
- Quoted commas, escaped quotes, multiline descriptions, UTF-8 BOM, and CRLF are supported.
- Any invalid row blocks the whole import. Limits: 5 MiB and 10,000 transactions per CSV.
- Duplicate skipping is enabled by default and compares type, amount, trimmed description, date, category, and recurring status. It covers both existing entries and repeated rows within the file; disable it to intentionally import identical entries.
- Retrying the same submission does not import it twice, even when duplicate skipping is disabled. Unresolved operation IDs and payload fingerprints are kept in this tab's session storage so reopening the dialog or refreshing the page can safely retry the same file. Financial payloads are not stored there. If browser storage is blocked, retry protection across page refreshes is unavailable (in-memory retries still work).

### Backup and restore

**Download backup** includes the complete active transaction dataset (not just a table page), original IDs and recurring flags, schema version, creation date, and the current browser's theme preference. Theme is the only user preference currently stored by the app. Ordinary transaction JSON exports are not full backup files.

Restore validates the entire backup first, then requires explicit confirmation to **replace** existing transactions and apply the saved theme. To append data, use CSV import instead. An empty backup can intentionally clear the active dataset. Limits are 100,000 active transactions and 100 MiB per backup; writes cannot grow the dataset beyond the supported backup limits.

Each restore saves a recovery snapshot in `data/backups/` (or the configured `DATA_DIR`). The success notification includes **Download previous data**. Older snapshots can also be retrieved through `GET /api/backup?recovery=<filename>` using the exact generated filename. Recovery snapshots are retained until you remove them. Restoring invalidates pending Undo actions; retrying the same restore does not repeat the replacement. Like imports, unresolved restore attempts retain their operation IDs in this tab's session storage.

Existing legacy amount precision and description lengths are preserved in backups rather than rounded or truncated. Downloading also preserves incompatible legacy records, but restoring a file with invalid dates/categories requires correcting those records first. Temporary Undo records and retry receipts are operational metadata, not included in portable backups.

## Validation

```bash
npm test
npx tsc --noEmit --incremental false
npm run build
```

Tests use temporary data directories and never modify the application's transaction file.

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/transactions` | List with filters: `type`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `category`, `search`, `sort`, `order`, `page`, `limit` |
| `POST` | `/api/transactions` | Create a transaction |
| `GET` | `/api/transactions/:id` | Get a single transaction |
| `PUT` | `/api/transactions/:id` | Update a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction; returns an Undo token and expiry |
| `POST` | `/api/transactions/undo` | Restore a deletion with `{ token }` |
| `GET` | `/api/transactions/recurring` | List recurring transaction templates |
| `POST` | `/api/import` | Import `{ transactions, skipDuplicates, operationId }`; UUID operation ID makes retries safe |
| `GET` | `/api/backup?theme=system\|light\|dark` | Download a complete version 1 backup |
| `POST` | `/api/backup` | Restore `{ backup, confirm: true, currentTheme, operationId }`; returns recovery filename and saved settings |
| `GET` | `/api/insights` | Aggregated stats and chart data |
| `GET` | `/api/export?format=csv\|json` | Download all transactions |
