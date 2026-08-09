# Roadmap

FlipTracker should grow deliberately from a focused personal resale tracker into a polished collector/reseller platform.

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
- [ ] Convert a saved sourcing analysis into an inventory item
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

## v0.6 AI Photo Recognition
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
- [ ] Migrate legacy inline asset photos to Convex file storage
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
- [ ] Migrate legacy inline source photos to Convex storage
- [ ] Add an eBay offer validation/fee preview screen
- [x] Add bounded bulk offer creation with per-item failure handling
- [ ] Add a separately confirmed publish action only after auth and photo validation
