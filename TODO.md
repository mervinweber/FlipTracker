# FlipTracker TODO

This file is the working checklist for the combined FlipTracker inventory, research, listing, and sales app.

## v0.9.1 Listing Speed

- [x] Add a compact Fast Review workflow for title, condition, price, shipping, photo status, and estimated net
- [x] Add Save & Next and Save, Stage & Next for continuous listing review
- [x] Remember item-family condition, shipping profile, policy, and image defaults locally without requiring Clerk
- [x] Add a Listings batch dashboard for photos, pricing, exceptions, ready items, and staged offers
- [x] Add a completed-intake handoff to Photos and Fast Review
- [x] Add confirmation-protected bulk publishing for selected staged offers with per-item failures left selected
- [ ] Measure scan-to-ready time across a real DVD/book batch and tune the remaining high-friction steps

## v0.9.2 Active Listing Maintenance

- [x] Fix the five-step listing editor navigation and long activity/error wrapping on phone layouts
- [x] Preserve actionable eBay/Convex revision details and route missing item specifics back to Category
- [x] Fill the required textbook Publication Name alias from the known Book Title
- [x] Add preview-and-confirm bulk percentage markdowns for active listings created through FlipTracker
- [x] Keep eBay app/Seller Hub listings out of Inventory API bulk markdowns
- [x] Record each successful bulk price change in listing Price History and report per-item failures
- [ ] Production-smoke one required-specific revision and a two-listing bulk markdown before using it on the full catalog

## v0.9.3 Stale Listing Manager

- [x] Add 30/60/90-day active-listing age buckets for FlipTracker-created eBay listings
- [x] Add reusable gentle, standard, clearance, and custom markdown strategies
- [x] Protect a seller-defined estimated profit floor using item cost, shipping, and fee assumptions
- [x] Preview every eligible and excluded listing with its age, old/new price, and exclusion reason
- [x] Keep all price changes confirmation-protected, bounded, and recorded in immutable price history
- [x] Validate desktop and 390px mobile layouts without overlap or horizontal clipping
- [ ] Production-smoke a two-listing strategy after deployment and verify both eBay prices and local price history

## v0.9.4 Daily Operations

- [x] Build one Today queue for ready-to-list, listing exceptions, eBay reconciliation, stale inventory, and orders awaiting shipment
- [x] Make Today actions open the fulfillment, blocker, reconciliation, review, publish, or stale-price workflow directly
- [x] Add reusable browser-local item-family templates for description, condition, completeness, shipping profile/policy, photo source, and pricing assumptions
- [x] Add profit-first sourcing rules with seller-defined minimum profit, ROI, liquidity, and maximum-buy calculations
- [ ] Add listing-quality scoring for title, required/recommended specifics, photo coverage, and estimated profit
- [x] Add a first post-sale pick/pack workflow with bin location, package profile, insurance prompt, carrier, tracking, and eBay label handoff
- [ ] Purchase eBay labels in-app and synchronize tracking without leaving FlipTracker
- [ ] Add template photo checklists and category-specific item-specific defaults
- [ ] Add card batches that preserve front/back pairing through identify, review, price, and publish
- [ ] Add throughput metrics for scanned, ready, published, sold, and shipped items per work session

## v0.9.5 Listings Workspace

- [x] Organize Listings into Queue, Active, Sold, and Needs Attention lifecycle views
- [x] Replace the always-visible dashboard stack with compact, stage-aware summary metrics
- [x] Show pricing, staging, publishing, synchronization, and maintenance controls only where they apply
- [x] Reduce each listing row to one primary next action plus a secondary actions menu
- [x] Collapse verbose eBay API errors into a compact row indicator with tap-open details
- [x] Keep Seller Connection available in a collapsed settings panel instead of occupying the daily workspace
- [x] Verify the simplified workspace at desktop and 390px mobile widths without horizontal overflow
- [ ] Measure the revised Queue workflow against a real 20-item listing batch and tune any remaining friction

## v0.9.6 Vinted Wardrobe

- [x] Add a dedicated Vinted tab with category, status, search, and price/title sort controls
- [x] Save a Vinted profile label and wardrobe URL without storing marketplace credentials
- [x] Open Vinted through the browser's existing authenticated session
- [x] Link existing FlipTracker inventory records to their direct Vinted item URLs
- [x] Show listing status, category, price, barcode, bin, notes, and inventory photo in a compact workspace
- [x] Add direct Open on Vinted actions for filtered wardrobe maintenance
- [x] Validate desktop and 390px mobile layouts without page overflow
- [ ] Test the workflow against a representative batch of real Vinted books and refine category assignments
- [ ] Apply for Vinted Pro Integrations API access if the seller account becomes eligible and automated synchronization is still valuable
- [ ] Add official Vinted Pro inventory import and status synchronization only after API allowlisting; do not scrape standard accounts

Prototype snapshot:

- Functional today: inventory, eBay seller linking, draft staging, sold sync, photo capture, and the Cross Listings queue shell.
- Prototype surfaces today: Poshmark, Mercari, and Depop cross-list records.
- Still pending: real user auth, per-user ownership, and direct marketplace APIs for the non-eBay channels.

## eBay Listing Factory

- [x] Recenter the primary workflow on eBay inventory, intake, photos, pricing, staging, publishing, and sold sync
- [x] Add Clothing as a first-class intake and listing type alongside books, games, movies, CDs, and cards
- [x] Replace exposed category-code boxes with automatic UPC/ISBN/type routing and an exception-only category finder
- [x] Add a five-step listing editor for item details, category specifics, shipping/photos, price/description, and payload preview
- [x] Replace raw package fields with item-aware shipping profiles while retaining an advanced weight/dimension override
- [x] Suggest a matching seller fulfillment policy from the selected package profile
- [x] Add structured clothing Brand, Department, Size, Color, Material, and Style item specifics
- [x] Add deterministic backend package and media-category fallbacks for older drafts
- [x] Add a listing-readiness validator that explains every blocking eBay aspect before staging
- [x] Add category-specific aspect discovery from the eBay Taxonomy API, beginning with clothing leaf categories
- [x] Add browser-local shipping-profile defaults per item family; migrate them to account settings when multi-user auth is activated
- [x] Add a one-screen keyboard-first exception queue for drafts blocked by photos, price, category, or required specifics
- [x] Code-split the listing factory and scanner to reduce the current large JavaScript bundle

## v0.6 Selling Readiness

- [x] Task 1: validate every locally knowable eBay blocker before staging
- [x] Task 2: fetch category-specific aspects and allowed values from eBay Taxonomy
- [x] Task 3: add a keyboard-first exception queue with Save and Next
- [x] Task 4: add shipping-policy eligibility and package-limit guardrails
- [x] Task 5: add safe listing-editor keyboard shortcuts
- [ ] Task 6: expand the new readiness regression suite with lifecycle and import-safety tests plus friendly errors
- [x] Task 7: code-split heavy workflows and smoke test desktop/mobile listing correction; complete production selling-path smoke after deployment
- [x] Task 8: document the release scope and release gate in `docs/V0.6_RELEASE_PLAN.md`

## v0.6.1 Release Hardening - Next

- [ ] Add Draft -> Staged -> Published -> Sold/Ended lifecycle regression tests
- [ ] Add import duplicate, partial-failure, and rollback tests
- [ ] Normalize friendly retry guidance for eBay/Convex action failures
- [ ] Verify offer staging and publishing remain idempotent after repeated clicks or interrupted requests
- [ ] Run and record the production smoke matrix for book, movie, game, card, clothing, and general merchandise
- [ ] Add a compact production health checklist for Convex, Vercel, eBay OAuth, policies, location, Taxonomy, publish, and sold sync

## Queued After v0.6.1

- [ ] v0.6.2: finish presets, exception retry/undo, completion summary, and throughput metrics (persisted batches and continuous scan mode are complete)
- [ ] v0.6.3: finish listing-quality scoring, photo checks, fee/profit preview, and bulk validation (exact eBay payload preview is complete)
- [ ] v0.6.4: saved comp snapshots, Product Research handoff, profit floors, and stale-price queue
- [ ] v0.6.5: unmatched eBay operations inbox, reconciliation, safe bulk revise/end/relist, and lifecycle audit
- [ ] v0.6.6: item-aware shipping recommendations, measured package presets, charge/cost preview, and fulfillment queue
- [ ] v0.8: finish specialized books, movies/games, clothing, and general-merchandise workflows; the human-confirmed Pokemon/Yu-Gi-Oh! card scanner foundation is complete
- [x] Add cached Pokemon TCG API and YGOPRODeck catalog adapters without making TCGplayer API access a launch dependency
- [x] Add optional Gemini card-identifier extraction, exact-print candidate review, variant fields, and confirmed-card inventory/eBay-draft creation
- [ ] Add card photo batches, reference-art rehosting, sports-card provider research, duplicate detection, and low-value lot rules
- [ ] v0.9: authentication and owner-scoped/eBay-tenant foundations are implemented; activate Clerk, claim legacy data, complete onboarding/backups/telemetry, and pass private-beta isolation tests
- [x] Document competitor workflow lessons in `docs/PRODUCT_BENCHMARKS.md`

## Completed Product Foundation

- [x] React, TypeScript, and Vite application scaffold
- [x] Convex backend for inventory, collections, research, reports, listings, and sales
- [x] Convex `useQuery` reads and mutation-backed add/edit/delete/import
- [x] Excel inventory import and export
- [x] User price overrides and `needsValueCheck` behavior
- [x] Add confirmation-protected bulk inventory deletion with linked draft/photo cleanup and active/sold safeguards
- [x] Add Listings queue-type filtering and select-all for the current filtered view
- [x] Add bulk purchase-cost editing with exact lot-total allocation and same-cost-per-item modes
- [x] Keep sold listing, inventory, sale values, and queue filters synchronized across the item lifecycle
- [x] Expose eBay's category-specific Type item specific in listing edit and preserve it during catalog-safe retries
- [x] Universal media model for games, DVDs, Blu-rays, CDs, books, and other media
- [x] Add General Merchandise inventory/listing entry points for non-media odds and ends
- [x] Add eBay Taxonomy category suggestions that save the selected leaf category ID on inventory and listing drafts
- [x] Add an aggregate Cards inventory filter plus Pokemon, sports, and Yu-Gi-Oh! card types
- [x] Show card-only sale format, game/sport, set, number, player, and team fields and automatically route eBay card categories
- [x] Mobile UPC/EAN/ISBN camera scanning with manual fallback
- [x] Layered ISBN-10/ISBN-13 book lookup with verified Open Library covers, optional Google Books fallback, and in-place metadata refresh
- [x] Ignore normal camera decode misses instead of displaying a scanner error
- [x] USB scanner bulk intake with serial lookup queue, duplicate-copy support, unique SKUs, and automatic internal eBay drafts
- [x] Metadata review and correction screen
- [x] Separate pasted AI listing copy, buyer-facing item disclosures, and private internal notes
- [x] Add one-click Gemini/OpenAI listing descriptions in inventory review and listing edit, using metadata, disclosures, and filtered buyer-relevant notes while keeping private workflow details out of provider context and public copy
- [x] Condition, completeness, storage bin, photo, and eBay preparation fields
- [x] Collections/purchase-lot foundation
- [x] Saved research/value-check workflow
- [x] Convert a saved sourcing analysis into an inventory item
- [x] Migrate legacy inline source photos to Convex file storage

## Completed Sales Tracker Merge

- [x] Use FlipTracker as the single combined application
- [x] Add Convex `marketplaceListings` table
- [x] Add Convex `listingPriceHistory` table
- [x] Add listing create, update, sold, and delete behavior
- [x] Preserve listing price changes with a reason and timestamp
- [x] Add confirmation-protected live eBay repricing by percentage, exact value, or calculated profit floor
- [x] Add confirmation-protected bulk percentage markdowns for active FlipTracker Inventory API listings
- [x] Revise active Inventory API listings from FlipTracker and explain that eBay's app/Seller Hub cannot edit those listings
- [x] Show eBay listing origin and import/deduplicate active eBay app or Seller Hub listings
- [x] Reprice native eBay fixed-price listings through Trading API while retaining Inventory API repricing for FlipTracker offers
- [ ] Safely merge GetItem into ReviseFixedPriceItem before enabling title, description, category, condition, shipping, specifics, and photo updates for native eBay listings
- [x] Add an account-wide eBay active/scheduled listing count with a configurable 200-listing planning target
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
- [x] Route sold-record reconciliation directly to sale closeout, bypass eBay publishing requirements, and archive completed sales without removing them from reporting
- [x] Preserve percentage markdowns when .99 charm pricing would otherwise round back to the unchanged listing price
- [x] Synchronize corrected listing closeouts with linked sale records
- [x] Default unsaved custom listing packages to 32 oz
- [x] Update inventory status and add a sale record when a listing becomes Sold
- [x] Refresh the authenticated seller's paid eBay orders, import sold amounts/fees/shipping, and close matched listings without duplicate sales
- [x] Sort marketplace listings by queue stage, status, or price
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
- [x] Capture or select up to 12 ordered photos directly during single-item scan review
- [x] Rotate staged and stored listing photos clockwise before eBay upload
- [x] Select a primary photo, remove mistakes, and advance to the next queued draft
- [x] Upload the stored photo set to eBay Picture Services and reuse cached eBay URLs

## Beta Launch Blockers - Engineering

- [x] Add optional Clerk sign-in and authenticated Convex provider wiring
- [x] Add owner IDs/indexes and enforce ownership on private reads and writes
- [x] Add an admin-protected first-owner migration for legacy records
- [x] Scope eBay OAuth, seller defaults, active imports, and sold imports by owner
- [ ] Configure Clerk issuer/public key, activate `convex/auth.config.ts`, and claim existing production data
- [ ] Set `FLIPTRACKER_AUTH_REQUIRED=true` only after the claim and isolation checks pass
- [ ] Verify a second beta account cannot see or mutate the first owner's records
- [ ] Add self-service account deletion, retention language, and a tested restore process

These must be completed in code before the beta URL is shared with other users.

- [ ] Add authentication provider integration and account-linking UI
- [ ] Add `convex/auth.config.ts` for the selected JWT provider
- [ ] Replace `ConvexProvider` with `ConvexProviderWithAuth`
- [ ] Add an owner/user identity field to user-owned tables
- [ ] Derive ownership from `ctx.auth.getUserIdentity()` in every Convex function
- [ ] Backfill the current inventory, collection, research, listing, history, and sales records to the first owner
- [ ] Add indexes needed for owner-scoped queries
- [ ] Reject unauthenticated reads and writes server-side
- [ ] Add a sign-in, sign-out, loading, and access-denied UI that makes linked accounts obvious
- [ ] Test two accounts and confirm neither can access the other's records
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
- [x] Find a production eBay leaf category by item keywords and apply its numeric ID before staging
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
- [ ] Add configurable category fee and shipping presets (the current media presets normalize boxes to eBay's US-compatible parcel package type)
- [x] Add an end-live-eBay-listing action with sold-elsewhere closeout flow
- [x] Import unmatched paid eBay order lines as idempotent generic sold records
- [x] Collapse Seller Connection defaults to preserve listing workspace space

## Owner Checklist - Accounts And Security

- [ ] Choose the beta authentication provider; Clerk is the current recommended default for a React/Vite + Convex beta
- [ ] Design the account-linking login experience so users can connect their marketplace and identity accounts cleanly
- [ ] Create the production auth application after the provider is selected
- [ ] Add local and production callback/origin URLs in the auth provider dashboard
- [ ] Rotate the Convex deploy key previously pasted into chat/terminal history
- [ ] Never put `CONVEX_DEPLOY_KEY` in a `VITE_` variable or expose it to browser code
- [ ] Enable multi-factor authentication on GitHub, Convex, Vercel, and the auth provider
- [ ] Decide who is invited to beta and keep the initial group small

## Owner Checklist - Local Verification

- [ ] Open Terminal and change into the project:

  ```bash
  cd /Users/mervinweber/Documents/FlipTrackerV2/FlipTracker
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
- [ ] Add a read-only eBay listing audit/reconciliation view for changes made outside FlipTracker
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
