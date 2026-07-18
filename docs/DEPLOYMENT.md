# Deployment

## GitHub

```bash
git init
git add .
git commit -m "Initial FlipTracker Convex starter"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

## Convex Development

```bash
npm install
npx convex dev
```

## Convex Production

Run from the project folder after the schema/functions are ready:

```bash
npx convex deploy
```

Copy the production deployment URL from the command output or Convex dashboard. Development and production deployments contain separate data.

## Vercel

Import the GitHub repo.

Use:
- Framework: Vite
- Build: `npm run build`
- Output: `dist`

Add environment variables:
- `VITE_CONVEX_URL`

Use the production Convex URL for the Vercel Production environment. `CONVEX_DEPLOYMENT` is used by the local Convex CLI and is not a browser runtime variable. A Convex deploy key is sensitive and must never use the `VITE_` prefix.

## Beta Gate

Do not share the deployed app with other users until authentication, owner-scoped fields/indexes, and server-side authorization checks are implemented. A Vercel URL by itself does not protect Convex data.

See `TODO.md` for the complete Convex, Vercel, security, and production smoke-test checklist.
