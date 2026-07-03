# SETUP.md

## Requirements
- Node.js 20+
- npm
- GitHub
- Vercel
- Convex

## Install

```bash
npm install
```

## Run Frontend

```bash
npm run dev
```

Set `VITE_CONVEX_URL` in `.env.local` before using the migrated UI. Without it, the app shows a setup message instead of loading inventory.

## Run Convex

```bash
npx convex dev
```

## Build

```bash
npm run build
```

## Deploy

See `docs/DEPLOYMENT.md`.


## Convex UI Notes

After `npx convex dev` runs, Convex generates `convex/_generated/*`.
The React app imports those generated files. Keep them committed after schema or API changes, and regenerate them with Convex before building locally against a real deployment.

Recommended local workflow:

```bash
npm install
npx convex dev
npm run dev
```

The inventory table, dashboard cards, add/edit/delete actions, and Excel import now use Convex. Excel export still runs in the browser from the current Convex query result.
