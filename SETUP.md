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

For the full ordered owner checklist, including security and smoke tests, follow `TODO.md` from "Beta Launch Blockers" onward.


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


## Barcode Scanning

The media scanner uses the phone camera through the browser. Camera access requires HTTPS in production or `localhost` for local testing. If camera permissions fail, use the manual UPC/EAN/ISBN entry field.

Metadata lookup is handled by Convex actions. ISBN/book lookup uses Open Library. UPC/EAN lookup uses UPCItemDB trial lookup in this first phase and should be replaced or supplemented with a production provider before public release.
