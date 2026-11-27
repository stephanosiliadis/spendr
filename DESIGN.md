# Spendr design notes

The app keeps its original lively look: the greeting dashboard, icon stat cards, monthly bar chart, expense donut, coloured badges and shadowed cards. On top of that:

- **Navigation:** a sidebar with a wordmark, six links, a theme toggle and Privacy/Terms in the footer. On mobile it becomes a top bar with a menu drawer that closes on Escape.
- **Palette:** cool slate neutrals, money blue (`--secondary`) for actions and the current page, teal (`--highlight`) for icon tiles, progress and the net line, green for income and coral for expenses. Category colours are one evenly toned 12-colour set in `lib/types.ts`. Tokens live in `app/globals.css`.
- **Type:** DM Sans for the interface and Space Grotesk for headings and the wordmark, bundled through `@fontsource-variable` so builds need no network.
- **Practices kept:** skip link, visible focus rings, `aria-current` on navigation, row actions reachable by keyboard and visible on touch screens, `prefers-reduced-motion` respected, consistent formats (`€1,234.56`, `25 Nov 2026`).
- **Behaviour:** the dashboard's recent transactions are ordered by ID, newest first. The recurring picker is grouped into Income and Expenses and sorted A to Z.
