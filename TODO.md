# FlipTracker TODO

This file is the working checklist for the combined FlipTracker inventory, research, listing, and sales app.

## Completed Product Foundation

- [x] React, TypeScript, and Vite application scaffold
- [x] Convex backend for inventory, collections, research, reports, listings, and sales
- [x] Convex `useQuery` reads and mutation-backed add/edit/delete/import
- [x] Excel inventory import and export
- [x] User price overrides and `needsValueCheck` behavior
- [x] Universal media model for games, DVDs, Blu-rays, CDs, books, and other media
- [x] Add an aggregate Cards inventory filter plus Pokemon, sports, and Yu-Gi-Oh! card types and eBay category defaults
- [x] Mobile UPC/EAN/ISBN camera scanning with manual fallback
- [x] Ignore normal camera decode misses instead of displaying a scanner error
- [x] USB scanner bulk intake with serial lookup queue, duplicate-copy support, unique SKUs, and automatic internal eBay drafts
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
- [x] Distinguish API-staged offers from Seller Hub drafts and require confirmation before publishing live
- [x] Supply media-specific package-weight defaults for legacy listings while retaining manual overrides
- [x] Create/select a USPS Media Mail policy for eligible listings and document that games require parcel shipping
- [x] Preserve total and location-level eBay availability when refreshing staged offers
- [x] Capture, upload, select primary, and remove multiple photos inside the listing editor
- [x] Add a structured eBay Language selector and preserve it during inventory validation retries
- [x] Add eBay's required Book Title aspect with automatic inventory-title fallback
- [x] Capture book authors from metadata and require the Author aspect before eBay staging
- [x] Track platform, listing ID, URL, SKU, status, dates, prices, shipping, fees, and buyer
- [x] Add listing filters and active/sold dashboard metrics
- [x] Calculate sold net profit from sale, shipping income, item cost, fees, and shipping cost
- [x] Add a dedicated Record Sale closeout for eBay, other marketplaces, and local sales
- [x] Synchronize corrected listing closeouts with linked sale records
- [x] Default unsaved custom listing packages to 32 oz
- [x] Update inventory status and add a sale record when a listing becomes Sold
- [x] Import Sales Tracker JSON into inventory, marketplace listings, and price history
- [x] Export the filtered Listings view to CSV
- [x] Add a hosted in-app Quick Guide and `/README.md` for scanning, research, eBay listing, and sale tracking
- [x] Add eBay seller OAuth with replay-resistant callback state and server-only token storage
- [x] Load eBay business policies and inventory locations into seller setup
- [x] Create or refresh eBay Inventory API items and unpublished offers without publishing
- [x] Add a selectable Draft/Pending queue with explicit Ready for Pricing and Ready for eBay states
- [x] Add bulk pricing review with saved suggestions, sold-comps links, manual approval, and price history
- [x] Add bounded batch creation of unpublished eBay offers with per-item failure handling
- [x] Add per-listing eBay fulfillment-policy overrides and media package presets
- [x] Send package weight and dimensions to eBay for calculated or weight-aware shipping
- [x] Restrict eBay catalog imagery to new/sealed items with a product identifier
- [x] Require and upload an actual item photo to eBay Picture Services for used items
- [x] Allow metadata stock covers for books while retaining actual-photo requirements for used discs and games
- [x] Queue a reviewed single barcode scan directly as an internal eBay draft
- [x] Add guided Sandbox inventory-location and business-policy provisioning
- [x] Add a mobile photo queue that finds existing physical copies by SKU or UPC
- [x] Store up to 12 ordered item photos per asset in Convex file storage
- [x] Select a primary photo, remove mistakes, and advance to the next queued draft
- [x] Upload the stored photo set to eBay Picture Services and reuse cached eBay URLs

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
- [ ] Migrate legacy inline captured photos to Convex file storage
- [ ] Add friendly UI error handling for failed mutations/imports
- [ ] Add duplicate protection for repeated inventory/listing imports
- [ ] Add automated tests for listing price history and sold transitions
- [ ] Code-split the scanner and listing editor to reduce the current large JavaScript bundle
- [ ] Evaluate replacing `xlsx` or isolate spreadsheet parsing; `npm audit` reports a high-severity advisory with no available package fix
- [ ] Until spreadsheet parsing is replaced, accept imports only from trusted beta users and enforce practical file-size limits

## eBay Active-Listing Pricing

- [x] Choose eBay active listings as the free-beta automated pricing source
- [x] Document the provider and upgrade plan in `docs/EBAY_PRICING_PLAN.md`
- [x] Create an eBay Developers Program application
- [ ] Create an eBay Partner Network account if required for Browse API production access
- [x] Build the Browse API search proof in eBay Sandbox (Sandbox catalog coverage is sparse)
- [ ] Submit the free application growth check / Buy API production-access request
- [ ] Confirm production approval before depending on automated eBay pricing
- [x] Add server-side eBay client-credentials OAuth in a Convex action
- [x] Store eBay credentials only in Convex environment variables
- [x] Search the Browse API by UPC/GTIN, with title/edition fallback
- [ ] Normalize format, edition, condition, region, item price, and shipping
- [x] Label results as active asking prices, never sold comps
- [x] Calculate low, median, high, delivered median, match count, and confidence
- [ ] Add individual `Refresh Price` and match-review UI
- [x] Add checkbox selection and bounded `Find Fair Value` workflow
- [ ] Cache lookups and track stale/failed results
- [x] Preserve user overrides and require review before applying bulk changes
- [x] Keep a one-click eBay sold/completed search link for quick verification
- [x] Show Terapeak Product Research only when the working item value is $50 or more
- [ ] Make the Terapeak threshold configurable per user after authentication/settings exist
- [ ] Defer paid providers until beta usage and a paid subscription model justify the cost
- [ ] If production Browse access is denied, ship generated eBay search links plus manual review rather than unofficial scraping

## eBay Seller Draft Creation

- [x] Add eBay authorization-code OAuth through a Convex HTTP callback
- [x] Refresh expired access tokens from the server-only refresh token
- [x] Protect seller actions with a private beta seller key until user auth exists
- [x] Optionally remember the beta seller key per device and restore Seller Connection after refresh
- [x] Select and save eBay inventory location and payment/fulfillment/return policies
- [x] Create an enabled Production inventory location from Seller Connection without modifying business policies
- [x] Save default numeric category IDs for DVDs, Blu-rays, books, CDs, games, and other media
- [x] Create or update the SKU-backed eBay inventory item
- [x] Map resale conditions to current Inventory API enums and retain detailed eBay validation errors
- [x] Create or update an unpublished eBay offer and save its offer ID/status/error
- [x] Keep eBay publishing absent so a scan cannot accidentally create a live listing
- [x] Configure eBay Sandbox credentials and complete initial owner consent
- [ ] Reconnect the Sandbox seller once to grant the new account-policy scope
- [ ] Create the Sandbox inventory location and business policies from Seller Connection
- [ ] Smoke test one DVD and one book against an eBay Sandbox seller
- [ ] Configure Production credentials only after Sandbox succeeds
- [x] Upload captured item photos directly to eBay Picture Services for unpublished offers
- [x] Default scanned books with metadata covers to the stock-cover workflow even when their format is paperback or hardcover
- [x] Store new multi-photo captures in Convex storage for durable app-side photo management
- [ ] Migrate existing inline photos to Convex storage
- [ ] Add offer validation and listing-fee preview
- [x] Add bounded bulk upload for selected drafts with retryable per-item failures
- [ ] Add a separately confirmed publish action after user auth, photo upload, and validation are complete

## Sourcing Decision Engine

- [x] Add Convex sourcing analysis and sold-observation tables
- [x] Calculate shipping-inclusive average, median, and trimmed average sold prices
- [x] Calculate sell-through proxy, estimated days to sell, rarity, liquidity, profit, and ROI
- [x] Add deterministic Buy / Maybe / Pass recommendations with confidence and reasons
- [x] Add manual sold-price, active-count, sold-count, and cost entry
- [x] Add one-click eBay sold-search verification from each analysis
- [x] Add common, uncommon, niche, and low-confidence illustrative demo records
- [x] Add create, detail, and delete workflows in a dedicated Sourcing view
- [ ] Convert a saved sourcing analysis into a new inventory item
- [ ] Link a sourcing analysis to an existing inventory item
- [ ] Replace manual listing counts and sold observations with approved provider data when available
- [ ] Add stale-analysis dates and refresh reminders
- [ ] Add configurable category fee and shipping presets

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
  `assets`, `collections`, `sales`, `valueHistory`, `researchChecks`, `marketplaceListings`, `listingPriceHistory`, `ebayConnections`, `ebayOauthStates`, and `ebaySettings`
- [ ] Configure the eBay Convex environment variables from `SETUP.md`; never put eBay secrets in Vercel or a `VITE_` variable
- [ ] Register the production `.convex.site/ebay/callback` URL in the Production eBay RuName
- [ ] Configure production auth environment values after auth is implemented
- [ ] Do not manually import development data into production until owner IDs are present
- [ ] If seed/import data is needed, export a backup first and test the import in development

## Owner Checklist - Vercel Production

- [ ] Import or open the GitHub repository in Vercel
- [ ] Set Framework Preset to Vite
- [ ] Set Build Command to `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`
- [ ] Set Output Directory to `dist`
- [ ] Add a Convex Production Deploy Key as `CONVEX_DEPLOY_KEY`, scoped only to Vercel Production
- [ ] Generate a Convex Preview Deploy Key from the project Settings page and add it as `CONVEX_DEPLOY_KEY`, scoped only to Vercel Preview
- [ ] Let `npx convex deploy` provide `VITE_CONVEX_URL` during each production or preview build; do not hard-code a preview deployment URL
- [ ] For manual frontend-only builds, set the Production environment variable:

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
- [ ] Apply for eBay Marketplace Insights sold-history access after the active-listing workflow proves useful
- [ ] Fee, shipping, and net-profit estimates in value research
- [ ] Richer game completeness and region fields
- [ ] Batch photo/spine recognition workflow
- [x] Sourcing mode with Buy / Maybe / Pass recommendation
- [ ] Import and populate the category-specific Create Drafts template downloaded from eBay Seller Hub Reports
- [x] eBay OAuth and unpublished-offer creation after the internal listing workflow is stable
- [ ] Read-only eBay listing audit before any automated edit/publish behavior
- [ ] Final logo, PWA icons, typography, and onboarding polish

## Known Beta Limitations

- UPCItemDB Trial metadata is best-effort and may return incomplete or incorrect editions
- Pricing recommendations are still heuristic until a sold-comps provider is added
- Photos are currently stored as compressed data URLs and should remain limited during development
- Listing imports create new records and do not deduplicate
- The app currently has no authentication or per-user ownership and must not be treated as a public multi-user beta yet
- eBay seller actions have a temporary private seller-key gate, but this does not replace full user authentication and owner scoping
- Captured item photos remain inline data URLs in FlipTracker; used-item photos are uploaded to eBay Picture Services when an unpublished offer is created
- The production build passes but currently reports a JavaScript bundle-size warning
- `npm audit --omit=dev` reports one high-severity issue in `xlsx` with no available fix; do not accept untrusted spreadsheet uploads during beta
