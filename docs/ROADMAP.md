# Roadmap

FlipTracker should grow deliberately from a focused personal resale tracker into a polished collector/reseller platform.

## Current Delivery Sequence

1. `v0.6.1` - reliability, idempotency, and production smoke testing
2. `v0.6.2` - continuous scanning, first-class batches, and reusable intake presets
3. `v0.6.3` - exact eBay preview, listing-quality checks, and bulk validation
4. `v0.6.4` - comp snapshots, profit floors, repricing, and stale-listing decisions
5. `v0.6.5` - eBay reconciliation, unmatched records, and active-inventory operations
6. `v0.6.6` - shipping recommendations, package economics, and fulfillment queue
7. `v0.8` - specialized book, media, card, clothing, and general-merchandise workflows
8. `v0.9` - authentication, owner-scoped data, onboarding, and private beta

See `docs/PRODUCT_BENCHMARKS.md` for the product research behind this sequence.

## Product Lessons From Underpriced

Underpriced is useful as a reference because it frames the reseller workflow around fast buy/skip decisions, not just inventory storage. Publicly visible ideas worth adapting for FlipTracker:

- Sourcing mode should answer "buy or skip?" quickly.
- Research should show sold comps, estimated fees, shipping drag, net profit, ROI, and confidence/red flags together.
- Saved analyses should become inventory records without duplicate entry.
- Every AI or automated estimate should include verification links and confidence signals.
- Free utility-style calculators can later become focused in-app tools: break-even price, ROI, promoted listings ROI, shipping estimate, and fee comparison.
- Mobile/PWA use matters because decisions happen at thrift stores, garage sales, and marketplace pickups.

## v0.2 Convex Integration
- [x] Add Convex dependency
- [x] Add schema
- [x] Add assets API
- [x] Add collections API
- [x] Add value history/research API
- [x] Add reports API
- [x] Convert main UI reads to Convex `useQuery`
- [x] Convert main UI writes to Convex `useMutation`
- [x] Add Excel import to Convex mutation
- [x] Preserve Excel export from Convex inventory rows
- [x] Preserve user value overrides and needs-value-check behavior
- [ ] Add auth strategy
- [ ] Deploy to Vercel

## v0.3 Collections
- [x] Collections panel with purchase lot cards
- [x] Purchase lots/collections table foundation
- [x] Attach assets to collections
- [x] Add item-level storage location / bin tracking
- [x] Collection-level purchase price and source
- [x] Collection profitability summary
- [ ] Dedicated collection detail page
- [ ] Lot calculator foundation

## v0.4 eBay Research Workflow
- [x] Saved research modal connected to `research.addValueCheck`
- [x] Store sold-comps notes and value history
- [x] Add external sold-search link per item
- [x] Add current sold-comps workflow foundation
- [x] Add quick sold-comps links for all items and surface Terapeak research at $50+
- [ ] Show sold-comp count, confidence level, and verification links for each value check
- [ ] Add fee, shipping, and net-profit estimate fields to value research
- [ ] Add red flags for low comps, high shipping drag, missing parts, region mismatch, or low sell-through confidence
- [ ] Track confidence and next review date
- [ ] Strategy dashboard: Flip Now / Watch / Hold / Bundle
- [ ] Research tab with saved value history

## v0.5 Barcode Scanner
- [x] Barcode scanner prototype using `@zxing/browser`
- [x] Support UPC-A, EAN-13, EAN-8, and ISBN inputs
- [ ] Confirm UPC-E normalization and edge-case handling
- [x] Add manual barcode entry fallback for camera failures
- [x] Store raw barcode on inventory items
- [x] First lookup flow for DVDs, Blu-rays, books, CDs, games, and other media
- [x] Auto-fill title, type, format, and identifier metadata into a review screen
- [x] Save lookup provider, confidence, and timestamp
- [x] Save-to-inventory review workflow
- [ ] Add sourcing mode for quick buy/skip decisions while shopping
- [x] Convert a saved sourcing analysis into an inventory item
- [x] Mark low-confidence scans and changed value inputs as needing value check
- [x] Manual fallback when lookup fails
- [x] Add serial USB scanner queue with per-stack defaults and automatic internal eBay drafts
- [x] Assign a unique SKU to every scanned physical copy, including duplicate UPCs

## v0.5.1 Barcode Value Assist
- [x] Choose eBay active listings as the initial free-beta pricing source
- [x] Document the eBay pricing plan and paid-provider decision gate
- [x] Connect server-side eBay Browse API credentials
- [x] Build and demonstrate the search workflow in eBay Sandbox (real catalog coverage requires Production)
- [ ] Apply for eBay Buy/Browse API production access and complete the application growth check
- [x] Use barcode lookup results to seed eBay active-listing research
- [ ] Suggest estimated low/high values with source and confidence
- [ ] Cache lookup/value results in Convex to reduce repeat calls and API usage
- [ ] Keep API keys, rate limits, and provider calls server-side in Convex actions
- [x] Add bounded bulk pricing approval with a review-before-apply queue
- [ ] Keep active asking prices separate from manual or future automated sold comps

## Future Track - AI Photo Recognition
- [ ] Photo/spine import workflow
- [ ] Identify titles from shelf/spine photos
- [ ] Confidence review queue
- [ ] Analyze screenshots from marketplace listings as sourcing candidates
- [ ] Keep AI identification editable with source/confidence metadata
- [ ] Add missing games from new photos

## v0.7 Collection Analyzer
- [x] Add standalone sourcing decision foundation with Buy / Maybe / Pass
- [x] Calculate sold median/average, sell-through, days to sell, rarity, liquidity, profit, ROI, and confidence
- [x] Save manual sold observations and illustrative common/uncommon examples in Convex
- [ ] "Should I buy this lot?" calculator
- [ ] Suggested max offer calculator
- [ ] Estimate list-first / bundle / hold split
- [ ] Identify risk from missing completeness, region, or low confidence
- [ ] Compare expected value against purchase price
- [ ] Include platform fee, shipping, packaging, and time-cost assumptions in lot math
- [ ] Output a buy/skip recommendation with reasons
- [ ] Convert accepted sourcing analyses into inventory or collection-lot candidates

## v1.0 Public Release
- [ ] Authentication and user-owned data
- [ ] Production deployment
- [ ] Polished product identity
- [ ] Complete onboarding/import workflow
- [ ] Data export and backup confidence
- [ ] Public-facing documentation

## Future Tracks
- [ ] Richer game completeness model: disc only, case only, manual only, CIB, sealed, loose cartridge, replacement artwork
- [ ] Region metadata: NTSC, PAL, NTSC-J, region-free, unknown
- [ ] Storage organization filters: bin, shelf, room, listed rack, review pile
- [x] eBay listing integration research
- [x] Push inventory item to an unpublished eBay offer
- [ ] Listing utilities: title helper, category/item-specific checklist, cross-platform copy generator
- [ ] Calculator library: break-even price, ROI, margin vs markup, promoted listing ROI, tax/export summaries
- [ ] Sourcing history: save skipped items so bad buys can be learned from later
- [x] USB/Bluetooth barcode scanner support as keyboard input for desktop bulk intake
- [ ] Add a paid pricing provider only after beta demand and subscription revenue justify the recurring cost


## v0.5.2 Media Listing Prep
- [x] Expand item model beyond games to DVDs, Blu-rays, CDs, books, and other media
- [x] Add condition and completeness review fields for scanned media
- [x] Add heuristic Sell Individually / Bundle / Skip recommendation
- [x] Add eBay-ready title, description, category, condition, item specifics, price, and shipping settings
- [x] Recalculate recommendation and listing details when key item/value fields change
- [ ] Add verified pricing provider and sold-comp averaging
- [x] Add eBay unpublished-offer creation after scanning workflow is stable

## v0.5.3 Sales Tracker Merge
- [x] Review Sales Tracker repo and choose FlipTracker as the combined app base
- [x] Document merge strategy in `docs/SALES_TRACKER_MERGE_PLAN.md`
- [x] Add marketplace listing lifecycle tables to Convex
- [x] Add active listing, sold listing, platform, date, and price history fields
- [x] Add Listings page using Sales Tracker's useful table/stats/filter patterns
- [x] Add asset-to-listing draft workflow
- [x] Add Sales Tracker JSON importer if there is existing listing data to preserve
- [x] Add listings CSV export and sold-profit reporting

## v0.5.4 Private Beta Hardening

- [ ] Add authentication and user-owned data
- [ ] Backfill existing records to the first owner
- [x] Store new multi-photo captures in Convex file storage
- [x] Add a mobile SKU/UPC photo queue for desktop-scanned inventory
- [x] Migrate legacy inline asset photos to Convex file storage
- [ ] Add mutation/import error states and duplicate protection
- [ ] Add listing lifecycle tests
- [ ] Code-split the scanner and listing editor
- [ ] Complete production Convex and Vercel smoke tests

## v0.5.5 eBay Seller Drafts

- [x] Add eBay authorization-code OAuth callback through Convex HTTP actions
- [x] Store and refresh seller tokens only in Convex

- [x] Add temporary private seller-key gate before full user authentication
- [x] Load eBay payment, fulfillment, return, and inventory-location choices
- [x] Store media category defaults and listing-level category overrides
- [x] Create or refresh SKU-backed eBay inventory items
- [x] Create or refresh unpublished eBay offers without publishing
- [x] Preserve eBay offer ID, sync status, timestamp, and errors on the listing
- [x] Add selectable Ready for Pricing and Ready for eBay queue states
- [x] Apply approved prices in bulk while preserving listing price history
- [x] Update active eBay prices by percentage, exact value, or calculated profit floor with confirmation and history
- [x] Track account-wide eBay active and scheduled listings against a configurable planning target
- [x] Add conditional card details and route eBay categories by card family and sale format
- [x] Add per-listing fulfillment-policy selection and reusable media package presets
- [x] Send package weight/dimensions with the eBay inventory item
- [x] Use eBay catalog matching only for eligible new/sealed media
- [x] Upload actual used-item photos to eBay Picture Services
- [x] Upload captured item photos to eBay Media/Picture Services
- [x] Allow metadata stock covers for books while requiring actual photos for used discs and games
- [x] Add guided Sandbox location and business-policy setup
- [x] Queue a reviewed single barcode scan directly as an internal eBay draft
- [x] Add bounded active-listing fair-value lookup with explicit approval
- [x] Store new source photos in Convex storage with ordering and a primary image
- [x] Upload the complete stored photo set to eBay and cache uploaded URLs
- [x] Migrate legacy inline source photos to Convex storage
- [ ] Add an eBay offer validation/fee preview screen
- [x] Add bounded bulk offer creation with per-item failure handling
- [ ] Add a separately confirmed publish action only after auth and photo validation

## v0.5.6 eBay Listing Factory

- [x] Make eBay the primary listing workflow and de-emphasize prototype cross-listing controls
- [x] Add guided Item, Category, Shipping/Photos, and Price/Description steps
- [x] Route known media/card categories automatically without exposing numeric category setup fields
- [x] Add exception-only category search for clothing and general merchandise
- [x] Add shipping profiles with policy hints and advanced package overrides
- [x] Add Clothing intake and structured listing specifics
- [x] Preserve old drafts and explicit package/category overrides
- [x] Validate required category aspects before staging instead of waiting for an eBay error
- [x] Fetch category-specific aspects and allowed values for clothing
- [x] Add a high-throughput exception queue and keyboard shortcuts
- [ ] Add saved per-user listing presets after authentication is complete

## v0.6 Selling Readiness

- [x] Validate title, category, price, photos, seller defaults, package data, and known required specifics before staging
- [x] Load required category aspects and allowed values from eBay Taxonomy
- [x] Add an exception queue grouped by category, photo, price, shipping, and specifics blockers
- [x] Add shipping-policy eligibility and package-limit guardrails
- [x] Add keyboard shortcuts plus Save and Next correction flow
- [ ] Add readiness, lifecycle, and import-safety tests
- [x] Code-split scanner, spreadsheet tools, and listing-heavy modules
- [ ] Smoke test books, movies, games, cards, clothing, and general merchandise before release

## v0.6.1 Release Hardening

Goal: make the current listing factory dependable enough for a full week of real selling.

- [ ] Add listing lifecycle tests for Draft -> Staged -> Published -> Sold/Ended
- [ ] Add import deduplication and rollback tests
- [ ] Make eBay action errors actionable and retry-safe
- [ ] Verify staging and publishing are idempotent for repeated clicks and network retries
- [ ] Run the production smoke matrix for a book, DVD/Blu-ray, game, card, clothing item, and general merchandise item
- [ ] Add a release checklist showing Convex deployment, Vercel build, OAuth, seller defaults, and sold-sync health
- [x] Reconcile stale TODO entries that were completed by v0.6

Release gate: no known lifecycle transition can create a duplicate offer, duplicate sale, or orphaned inventory record.

## v0.6.2 Speed Intake And Batches

Goal: reduce touches per item when scanning a stack.

- [x] Make an intake batch a first-class record with name, source, purchase cost, defaults, progress, and persisted scan items
- [x] Add continuous camera Speed Mode that keeps the scanner open between items
- [ ] Add reusable presets by item family for condition, completeness, bin, shipping profile, description, and draft behavior
- [ ] Show duplicate-copy count, lookup confidence, and exception reason inline during scanning
- [x] Add pause/resume controls and retry-safe scan tokens
- [ ] Add retry-failed-lookup and undo-last-scan controls
- [ ] Add a batch completion screen: scanned, identified, needs review, ready for photos, ready for pricing, and ready for eBay
- [ ] Record scan-to-ready time so workflow improvements can be measured

## v0.6.3 Listing Quality And Preview

Goal: show exactly what eBay will receive before the seller commits.

- [x] Add an eBay payload preview for title, category, condition, specifics, description, photos, price, quantity, package, and policies
- [ ] Add title-length and keyword guidance without silently rewriting seller text
- [ ] Score required/recommended item-specific coverage by category
- [ ] Add photo order, rotation, missing-angle, and low-resolution checks
- [ ] Add a fee/profit preview using clearly labeled estimates and seller-configurable assumptions
- [ ] Support bulk validation with successful rows separated from exceptions
- [ ] Track eBay draft/staged age and warn before records become stale

## v0.6.4 Pricing And Offers Workspace

Goal: turn research and repricing into a repeatable daily queue.

- [ ] Save comp snapshots with query, condition, sample size, median, range, shipping, confidence, and timestamp
- [x] Deep-link each record into eBay Product Research with a normalized query
- [x] Keep active asking-price signals separate from seller-entered or verified sold data
- [x] Calculate minimum acceptable price from cost, fees, shipping, and target profit
- [x] Add bounded bulk price refresh with review-before-apply and immutable price history
- [ ] Add stale-listing rules by age, views/watchers when available, price, category, and margin
- [ ] Investigate eBay-supported Offers to Buyers capabilities; do not automate until API support and margin safeguards are verified

## v0.6.5 Active Inventory Operations

Goal: make FlipTracker the reliable source of truth after publication.

- [ ] Add an operations inbox for unmatched sales, ended listings, quantity conflicts, sync failures, and missing inventory links
- [x] Import unmatched eBay paid-order lines as reviewable sold records without creating duplicates
- [ ] Reconcile local and eBay status, price, quantity, URL, SKU, and listing ID
- [ ] Add safe bulk revise, end, and relist workflows with per-item outcomes
- [ ] Add stale inventory views and a configurable review cadence
- [ ] Surface orders awaiting shipment and preserve tracking/shipping state when eBay APIs permit
- [ ] Add a lifecycle audit trail showing who/what changed each state

## v0.6.6 Shipping And Fulfillment

Goal: make shipping selection understandable and hard to misconfigure.

- [x] Put item-aware package and service recommendations before advanced policy/package overrides
- [ ] Save seller-measured package profiles by item family and quantity range (built-in profiles exist)
- [ ] Preview buyer charge, estimated label cost, dimensional-weight risk, insurance, and net shipping impact
- [x] Block known Media Mail and Standard Envelope eligibility/package errors before staging
- [ ] Expand plain-language guidance for Priority Mail, UPS, FedEx, insurance, and dimensional weight
- [ ] Add packing and insurance prompts for high-value items
- [ ] Add post-sale packing queue, label/tracking handoff, and shipped confirmation where supported

## v0.8 Vertical Listing Intelligence

- [ ] Books: continuous ISBN intake, edition/cover confidence, author/title normalization, and lot grouping
- [ ] Movies and games: edition, region, completeness, disc count, and bundle recommendations
- [x] Cards foundation: phone photo/manual identifier capture, human-approved catalog match, and persisted set/card/provider/language/rarity/finish/edition fields
- [ ] Cards completion: image batches, reference-image rehosting, sports-card provider, duplicate detection, and low-value lot rules
- [ ] Clothing: reusable measurement templates, size/brand/category presets, and photo checklist
- [ ] General merchandise: category suggestion, measured shipping, and flexible specifics

## v0.9 Private Beta

- [x] Add optional Clerk authentication gate and owner-scoped Convex data foundation
- [x] Add an admin-protected first-owner migration for existing single-owner records
- [x] Scope eBay OAuth tokens, seller settings, active imports, and sold imports by owner
- [x] Add listing lifecycle activity and an operations inbox
- [x] Support safe revisions for active listings created in the eBay app/Seller Hub
- [ ] Add onboarding for eBay OAuth, seller defaults, shipping profiles, first scan, and first test listing
- [ ] Add backup/export, error telemetry, privacy terms, and account deletion
- [ ] Activate Clerk in development and production, claim legacy data, and pass two-account isolation testing
- [ ] Invite a small beta group only after ownership and production smoke tests pass

## v0.9.1 Listing Speed

Goal: make an ordinary book, movie, or game require only scan, photograph, and approve.

- [x] Add compact Fast Review while retaining the full editor for exceptions
- [x] Add browser-local item-family presets that work in legacy single-user mode
- [x] Add Save & Next and Save, Stage & Next listing-factory actions
- [x] Add batch completion counts and direct handoff from intake to photos and listings
- [x] Add selected staged-offer publishing with explicit confirmation and per-item outcomes
- [ ] Add undo-last-scan and retry-all-failed controls to bulk intake
- [ ] Add a configurable description template per item family
- [ ] Record scan-to-ready time and compare it across books, movies, games, cards, and clothing

## v0.9.2 Active Listing Maintenance

Goal: maintain a FlipTracker-created eBay catalog without opening every listing individually.

- [x] Add a bulk percentage markdown preview for active Inventory API listings created by FlipTracker
- [x] Exclude eBay app and Seller Hub listings from Inventory API bulk changes
- [x] Process bulk price changes in bounded batches with individual failure reporting and price-history records
- [x] Keep long revision errors and activity history readable in the mobile listing editor
- [x] Route missing required item-specific failures back to the Category step
- [x] Map the known book title into eBay's required Publication Name alias for textbook categories
- [ ] Add stale-listing selection rules by listing age, price, category, and protected profit floor
- [ ] Add reusable markdown strategies such as 30/60/90-day reductions without automatic execution
