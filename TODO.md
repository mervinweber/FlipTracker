# FlipTracker TODO

This file is the working checklist for the combined FlipTracker inventory, research, listing, and sales app.

## Completed Product Foundation

- [x] React, TypeScript, and Vite application scaffold
- [x] Convex backend for inventory, collections, research, reports, listings, and sales
- [x] Convex `useQuery` reads and mutation-backed add/edit/delete/import
- [x] Excel inventory import and export
- [x] User price overrides and `needsValueCheck` behavior
- [x] Universal media model for games, DVDs, Blu-rays, CDs, books, and other media
- [x] Mobile UPC/EAN/ISBN camera scanning with manual fallback
- [x] Metadata review and correction screen
- [x] Condition, completeness, storage bin, photo, and eBay preparation fields
- [x] Collections/purchase-lot foundation
- [x] Saved research/value-check workflow

## Completed Sales Tracker Merge

- [x] Use FlipTracker as the single combined application
- [x] Add Convex `marketplaceListings` table
- [x] Add Convex `listingPriceHistory` table
- [x] Add listing create, update, sold, and delete behavior
- [x] Preserve listing price changes with a reason and timestamp
- [x] Add Inventory and Listings primary views
- [x] Create an internal eBay draft from an inventory item
- [x] Track platform, listing ID, URL, SKU, status, dates, prices, shipping, fees, and buyer
- [x] Add listing filters and active/sold dashboard metrics
- [x] Calculate sold net profit from sale, shipping income, item cost, fees, and shipping cost
- [x] Update inventory status and add a sale record when a listing becomes Sold
- [x] Import Sales Tracker JSON into inventory, marketplace listings, and price history
- [x] Export the filtered Listings view to CSV

## Beta Launch Blockers - Engineering

These must be completed in code before the beta URL is shared with other users.

- [ ] Add authentication provider integration
- [ ] Add `convex/auth.config.ts` for the selected JWT provider
- [ ] Replace `ConvexProvider` with `ConvexProviderWithAuth`
- [ ] Add an owner/user identity field to user-owned tables
- [ ] Derive ownership from `ctx.auth.getUserIdentity()` in every Convex function
- [ ] Backfill the current inventory, collection, research, listing, history, and sales records to the first owner
- [ ] Add indexes needed for owner-scoped queries
- [ ] Reject unauthenticated reads and writes server-side
- [ ] Add a sign-in, sign-out, loading, and access-denied UI
- [ ] Test two accounts and confirm neither can access the other's records
- [ ] Move captured photos from inline data URLs to Convex file storage
- [ ] Add friendly UI error handling for failed mutations/imports
- [ ] Add duplicate protection for repeated inventory/listing imports
- [ ] Add automated tests for listing price history and sold transitions
- [ ] Code-split the scanner and listing editor to reduce the current large JavaScript bundle
- [ ] Evaluate replacing `xlsx` or isolate spreadsheet parsing; `npm audit` reports a high-severity advisory with no available package fix
- [ ] Until spreadsheet parsing is replaced, accept imports only from trusted beta users and enforce practical file-size limits

## Owner Checklist - Accounts And Security

- [ ] Choose the beta authentication provider; Clerk is the current recommended default for a React/Vite + Convex beta
- [ ] Create the production auth application after the provider is selected
- [ ] Add local and production callback/origin URLs in the auth provider dashboard
- [ ] Rotate the Convex deploy key previously pasted into chat/terminal history
- [ ] Never put `CONVEX_DEPLOY_KEY` in a `VITE_` variable or expose it to browser code
- [ ] Enable multi-factor authentication on GitHub, Convex, Vercel, and the auth provider
- [ ] Decide who is invited to beta and keep the initial group small

## Owner Checklist - Local Verification

- [ ] Open Terminal and change into the project:

  ```bash
  cd /Users/mervinweber/Documents/FlipTracker
  ```

- [ ] Install dependencies:

  ```bash
  npm install
  ```

- [ ] Confirm `.env.local` contains the development Convex URL:

  ```text
  VITE_CONVEX_URL=https://YOUR-DEVELOPMENT-DEPLOYMENT.convex.cloud
  ```

- [ ] Start Convex and leave it running while developing:

  ```bash
  npx convex dev
  ```

- [ ] In a second Terminal window, start the app:

  ```bash
  npm run dev
  ```

- [ ] Open `http://localhost:5173/`
- [ ] Add one item manually
- [ ] Scan one UPC with a phone over the local network or use manual barcode entry
- [ ] Edit a title and confirm it becomes `Needs value check`
- [ ] Enter a user low/high override and confirm it becomes the effective value
- [ ] Create a listing draft from inventory
- [ ] Change the listing to Active and add its marketplace URL
- [ ] Change the current price and confirm Price History records it
- [ ] Mark the listing Sold and enter sale price, fees, shipping charged, and shipping cost
- [ ] Confirm sold revenue and net profit update
- [ ] Export inventory Excel and listing CSV, then open both files
- [ ] Test a Sales Tracker JSON import only after making a backup; imports currently create new records and do not deduplicate
- [ ] Run the production build:

  ```bash
  npm run build
  ```

## Owner Checklist - GitHub

- [ ] Review the branch changes and confirm no `.env.local`, deploy keys, API keys, or personal exports are staged
- [ ] Commit the combined app changes on `feature/media-barcode-workflow`
- [ ] Push the feature branch to GitHub
- [ ] Open a pull request into `main`
- [ ] Confirm the pull request build passes
- [ ] Merge only after authentication and ownership checks are complete for a shared beta
- [ ] Tag the first beta release, for example `v0.6.0-beta.1`

## Owner Checklist - Convex Production

- [ ] Open the Convex dashboard and confirm the correct FlipTracker project is selected
- [ ] Keep the existing development deployment for local testing
- [ ] Deploy the Convex functions and schema to production from the project folder:

  ```bash
  npx convex deploy
  ```

- [ ] Copy the production deployment URL printed by Convex or shown in Project Settings
- [ ] Confirm the production deployment contains these tables:
  `assets`, `collections`, `sales`, `valueHistory`, `researchChecks`, `marketplaceListings`, and `listingPriceHistory`
- [ ] Configure production auth environment values after auth is implemented
- [ ] Do not manually import development data into production until owner IDs are present
- [ ] If seed/import data is needed, export a backup first and test the import in development

## Owner Checklist - Vercel Production

- [ ] Import or open the GitHub repository in Vercel
- [ ] Set Framework Preset to Vite
- [ ] Set Build Command to `npm run build`
- [ ] Set Output Directory to `dist`
- [ ] Set the Production environment variable:

  ```text
  VITE_CONVEX_URL=https://YOUR-PRODUCTION-DEPLOYMENT.convex.cloud
  ```

- [ ] Set the Preview environment variable to the development Convex URL only if preview builds are allowed to use development data
- [ ] Add auth provider public environment variables after auth is implemented
- [ ] Do not add secret keys with a `VITE_` prefix
- [ ] Deploy and open the generated Vercel URL
- [ ] Add the Vercel production and preview domains to the auth provider's allowed origins/callback URLs
- [ ] Add a custom domain only after the Vercel URL passes smoke testing

## Owner Checklist - Production Smoke Test

- [ ] Sign in as the owner on desktop
- [ ] Sign in as the owner on the phone PWA
- [ ] Verify camera permission and barcode scanning over HTTPS
- [ ] Add, edit, research, list, sell, and delete test records
- [ ] Confirm updates sync between desktop and phone
- [ ] Confirm unauthenticated visitors cannot read or write any Convex data
- [ ] Confirm a second beta user sees only their own data
- [ ] Confirm Excel and CSV exports download correctly
- [ ] Confirm metadata lookup failures fall back to manual review
- [ ] Confirm the app works after refresh and direct navigation
- [ ] Delete the test records after verification

## Beta Operations

- [ ] Write a one-page beta feedback guide for testers
- [ ] Create a support/feedback email or GitHub issue template
- [ ] Record the production Convex project, Vercel project, auth application, and custom domain in `docs/PROJECT_MEMORY.md` without storing secrets
- [ ] Export inventory and listings weekly during beta
- [ ] Review Convex function errors and Vercel deployment logs weekly
- [ ] Track metadata provider rate limits; UPCItemDB Trial is not a production pricing source
- [ ] Define a rollback procedure: redeploy the previous Vercel build and do not roll back the Convex schema destructively

## Next Product Work

- [ ] Dedicated collection detail page and lot calculator
- [ ] Research tab with saved value history and sold-comp details
- [ ] Verified sold-comps pricing provider with confidence and source links
- [ ] Fee, shipping, and net-profit estimates in value research
- [ ] Richer game completeness and region fields
- [ ] Batch photo/spine recognition workflow
- [ ] Sourcing mode with Buy / Skip recommendation
- [ ] eBay OAuth and draft creation after the internal listing workflow is stable
- [ ] Read-only eBay listing audit before any automated edit/publish behavior
- [ ] Final logo, PWA icons, typography, and onboarding polish

## Known Beta Limitations

- UPCItemDB Trial metadata is best-effort and may return incomplete or incorrect editions
- Pricing recommendations are still heuristic until a sold-comps provider is added
- Photos are currently stored as compressed data URLs and should remain limited during development
- Listing imports create new records and do not deduplicate
- The app currently has no authentication or per-user ownership and must not be treated as a public multi-user beta yet
- The production build passes but currently reports a JavaScript bundle-size warning
- `npm audit --omit=dev` reports one high-severity issue in `xlsx` with no available fix; do not accept untrusted spreadsheet uploads during beta
