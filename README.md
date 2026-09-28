# Spendr Web

A beautiful, full-featured expense tracker built with Next.js, Shadcn/ui, and Radix UI — the web evolution of the Spendr CLI.

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Real-time stats cards, monthly income/expense bar chart, expense category donut chart, recent transactions |
| **Transactions** | Full CRUD with searchable, filterable, paginated table; sort by any column |
| **Analytics** | Tabbed insights — monthly trends, income/expense category breakdowns with progress bars, key stats |
| **Categories** | 12 built-in categories (Food, Transport, Salary, Investment, etc.) with emoji decoration |
| **Recurring flag** | Mark transactions as recurring for visibility |
| **Export** | One-click CSV or JSON export (entire transaction history) |
| **Dark / Light mode** | Toggle in the sidebar footer; defaults to dark |
| **Shared DB** | Reads/writes the same SQLite file as the Python CLI (`../data/transactions.db`) |

## Stack

- **Next.js 14** (App Router)
- **Shadcn/ui** + **Radix UI** primitives
- **Tailwind CSS** with custom income/expense color tokens
- **better-sqlite3** — synchronous SQLite on the server
- **Recharts** — monthly trend chart + category pie chart
- **Sonner** — toast notifications
- **next-themes** — dark/light mode

## Getting Started

```bash
# 1. Install dependencies (from the web/ directory)
cd web
npm install

# 2. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app automatically creates `../data/transactions.db` (relative to `web/`) on first launch and migrates any existing Python CLI database to add the `category` and `is_recurring` columns.

## Database

The database path defaults to `<project-root>/data/transactions.db`. Override with:

```
# web/.env.local
DATABASE_PATH=/absolute/path/to/your/transactions.db
```

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/transactions` | List with filters: `type`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `category`, `search`, `sort`, `order`, `page`, `limit` |
| `POST` | `/api/transactions` | Create a transaction |
| `GET` | `/api/transactions/:id` | Get a single transaction |
| `PUT` | `/api/transactions/:id` | Update a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/insights` | Aggregated stats and chart data |
| `GET` | `/api/export?format=csv\|json` | Download all transactions |
