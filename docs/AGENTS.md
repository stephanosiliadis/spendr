# AGENTS.md

Instructions for AI agents working on Spendr. Keep changes small, verify them, and do not read more than the task needs.

## What this is

Spendr is a single-user, private personal finance tracker. Next.js 14 (App Router), React 18, TypeScript, Tailwind 3.4, Radix/shadcn-style UI, Recharts. Data is stored in JSON files on the server, with a journal. There is no auth by design, and the app is never exposed publicly.

## Reading order (save tokens)

1. This file.
2. `README.md`, only the section you need: Data Storage and Recovery, CSV Import, API Routes, Project Structure. Skip the badges and table of contents.
3. `DESIGN.md` (9 lines) before any UI change.
4. `PRD.md`, only when a task asks about intended behaviour.

Do not read `node_modules`, `.next`, `package-lock.json` or `data/`.

## Map

- `app/page.tsx` dashboard. `app/transactions`, `insights` (Analytics), `budgets`, `rules`, `goals` are one `page.tsx` each.
- `app/api/*/route.ts` thin handlers: transactions, insights, budgets, category-rules, savings-goals, import, export, backup.
- `lib/db.ts` all storage, locking and journal. `lib/data-transfer.ts` backup/import validation. `lib/csv.ts` CSV parsing. `lib/types.ts` types, `CATEGORIES` and `CATEGORY_COLORS`. `lib/utils.ts` `formatCurrency` and `formatDate`.
- `components/` feature components. `components/ui/` shared primitives. `components/sidebar.tsx` navigation.
- `tests/*.test.cjs` Node test runner.

## Commands

```bash
npm run dev        # http://localhost:3000
npx tsc --noEmit   # type-check
npm run lint
npm test
npm run build
```

Run `tsc` and `lint` after every change. Run `build` before reporting UI or routing work as done. `npm test` has 10 known failures in `csv.test.cjs` that exist on the original upload. Do not "fix" them as a side effect, and do not add new failures.

## Data safety (highest priority)

- Never read, edit, delete or commit anything in `data/` or any `DATA_DIR`. Use a temporary `DATA_DIR` for experiments and tests.
- All reads and writes go through `lib/db.ts`. Do not write JSON files from route handlers or components.
- Treat restore, import and delete as destructive. Keep the recovery snapshot before restore and the undo window for deletes.
- Money is euros, displayed with `formatCurrency`. Keep amounts as numbers with two decimals. Do not introduce floating-point rounding in totals.
- Do not add dependencies, network calls or telemetry without asking.

## UI rules

- Use design tokens from `app/globals.css` (`secondary` is the brand blue, `highlight` teal, `income` green, `expense` coral). No hard-coded hex colours except in `CATEGORY_COLORS`.
- Fonts: DM Sans (interface), Space Grotesk (headings). Self-hosted through `@fontsource-variable`. Do not use Google Fonts links.
- Reuse `components/ui/*` before creating new primitives.
- Formats: `€1,234.56`, `25 Nov 2026`. Use `.figure` (tabular numbers) for amounts.
- Categories are shown as a small coloured dot plus text. No emojis for categories.
- Transactions are listed by ID, newest first, on the dashboard and on the Transactions page.
- Keep: skip link, visible focus rings, `aria-current` on navigation, keyboard-reachable row actions, `prefers-reduced-motion`. Check light and dark mode and a 375px wide screen.
- Charts: dashboard uses the mirrored cash-flow chart and the ranked category list. Analytics uses the donut. Do not put the same data in two panels side by side.
- Sentence case, no exclamation marks in interface text, and error messages that say what to do next.

## Working style

- Make the smallest change that solves the task. Do not refactor, rename or reformat unrelated code.
- Match existing patterns and naming. TypeScript strict, no `any`.
- Validate input at the API boundary and return clear error messages.
- Add or update a test in `tests/` when changing `lib/` or API behaviour.
- For UI changes, take a screenshot in light and dark mode and look at it. A passing type-check does not mean it looks right.
- If a request is ambiguous and a wrong guess would be costly to undo, ask one short question. Otherwise decide, and state the assumption.
- When done, report what changed, what you verified, and what you did not. Do not claim a check passed unless you ran it.

## Updating docs

Update `README.md` when behaviour, routes or setup change. Update `DESIGN.md` when the visual system changes. Update this file when a rule above stops being true.
