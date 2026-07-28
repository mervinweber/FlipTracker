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
- Build: `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`
- Output: `dist`

Add `CONVEX_DEPLOY_KEY` twice with environment-specific values:

1. Generate a Production Deploy Key from the production deployment's Settings page in Convex. Add it to Vercel for **Production only**.
2. Generate a Preview Deploy Key from the Convex project's Settings page. Add it to Vercel for **Preview only**.

The Convex command supplies `VITE_CONVEX_URL` to the Vite build automatically. Production deploys update the production backend. Preview deploys create an isolated backend for the Git branch and do not share production or development data. `CONVEX_DEPLOYMENT` remains a local CLI setting. Deploy keys are sensitive and must never use a `VITE_` prefix.

If a feature preview reports that no Convex deployment configuration was found, check that the Preview-scoped `CONVEX_DEPLOY_KEY` exists. A Production-only key is intentionally unavailable to preview builds.

## Beta Gate

Do not share the deployed app with other users until authentication, owner-scoped fields/indexes, and server-side authorization checks are implemented. A Vercel URL by itself does not protect Convex data.

See `TODO.md` for the complete Convex, Vercel, security, and production smoke-test checklist.
