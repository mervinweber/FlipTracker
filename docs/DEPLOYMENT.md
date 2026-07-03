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

## Convex

```bash
npm install
npx convex dev
```

## Vercel

Import the GitHub repo.

Use:
- Framework: Vite
- Build: `npm run build`
- Output: `dist`

Add environment variables:
- `VITE_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
