# Architecture

```text
GitHub -> Vercel -> React/Vite/PWA -> Convex
```

Vercel hosts the frontend. Convex stores assets, collections, sales, value history, research checks, and dashboard reports.

The main React UI reads inventory and dashboard data with Convex `useQuery`, and add/edit/delete/import actions write through Convex mutations.

Excel import/export stays as a backup and data portability layer. Import parses spreadsheets in the browser and sends rows to `assets.importMany`; export serializes the current Convex query rows.
