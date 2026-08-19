# Project Memory

This is the working memory for FlipTracker. Read this first when picking the project back up after a break or starting a new chat.

## Product Intent

FlipTracker is a resale inventory and research app for collectors and resellers. It starts with video games, then expands to cards, DVDs, Blu-rays, toys, electronics, and other collectibles.

The product should feel like a serious tool for making buying, listing, and collection-management decisions. It is not just a spreadsheet replacement; it should eventually help answer questions like:

- What do I own?
- What is it worth?
- What should I list first?
- What needs more research?
- Should I buy this lot?
- How much can I safely offer?
- What is ready to push to eBay?

## Built So Far

- FlipTracker is now explicitly eBay-first. The primary navigation emphasizes Inventory, Listings, Bulk Intake, Photos, Sourcing, and Guide; the earlier cross-listing prototype remains in the codebase but is no longer promoted in the core listing path.
- Listings uses a four-step eBay Listing Factory: Item, Category, Shipping & Photos, then Price & Description. A readiness strip keeps title, category, shipping, image, and price blockers visible without displaying every field at once.
- Books, DVDs/Blu-rays, CDs, video games, and cards receive deterministic eBay category routing from item type and product identifiers. Clothing and general merchandise intentionally require a leaf-category choice through the eBay category finder.
- Shipping now starts with item-aware profiles for single media, multi-item media, trading cards, lightweight clothing, boxed clothing, and custom packages. Weight and dimensions remain available as advanced overrides, and explicit listing values remain authoritative in the backend.
- v0.6 adds a shared listing-readiness validator used by the editor and staging workflow. It checks local title/category/price/photo/package/seller-policy requirements plus known book, card, clothing, Media Mail, and Standard Envelope rules before an offer reaches eBay.
- Listings now include a focused exception queue. Review opens the first blocking step, the editor summarizes every issue in a collapsible panel, and Save & Next advances through the remaining corrections. `Cmd/Ctrl+S` saves and `Alt+Left/Right` changes editor steps.
- The category step loads eBay Taxonomy aspects and allowed values for the chosen leaf category. Known structured FlipTracker fields are not duplicated. Very large allowed-value lists are bounded for Convex transport and exposed as editable suggestions. The staging action independently rechecks all current required eBay aspects.
- Heavy workspaces, camera scanning, and spreadsheet utilities are lazy-loaded. The initial production chunk dropped below Vite's prior 500 kB warning threshold.
- Clothing is a first-class inventory type with structured eBay specifics for Brand, Department, Size, Color, Material, and Style.

- Inventory and Listings can add `General Merchandise` records for non-media odds and ends. Both routes use the normal asset review form, while the Listings route also queues an internal marketplace draft.
- Inventory and listing editors include an eBay Taxonomy category finder. It searches Production eBay by item keywords, displays ranked leaf-category breadcrumbs, and saves the chosen numeric category ID through inventory, draft creation, and Excel export.
- Inventory items separate pasted AI listing copy, buyer-facing item disclosures, and private internal notes. AI copy and disclosures compose into the eBay description; internal notes never do.
- Inventory supports an aggregate Cards filter while preserving Pokemon Card, Sports Card, and Yu-Gi-Oh! Card as distinct item types. Seller Connection stores separate eBay category defaults for those three card markets.
- eBay seller connection added: authorization-code OAuth through Convex HTTP, server-only refresh/access token storage, automatic token refresh, seller business-policy/location setup, category defaults, and creation/update of unpublished Inventory API offers. Publishing is intentionally not implemented.
- Listings now has a selectable eBay queue: Ready for Pricing drafts go through sold-comp/manual price review, approved updates preserve price history, and Ready for eBay rows can be sent as a bounded batch of unpublished offers with per-item failure handling.
- eBay drafts support per-listing fulfillment policies plus single-media, small-stack, media-box, and custom package measurements. New/sealed media can request an eBay catalog image through UPC/EAN/ISBN matching. Used items require an actual captured photo, uploaded to eBay Picture Services; metadata cover art is not submitted for used listings.
- Marketplace listings include a structured Language selector. Media defaults to English, older manual Language specifics populate the selector, saved selections are authoritative, and eBay's catalog-safe inventory retry preserves the required Language aspect.
- Book listings include a structured Book Title aspect that defaults to the inventory title and remains present during eBay's catalog-safe inventory retry.
- The separate eBay Book Title item specific is capped at 65 characters in both the editor and staging action; the full inventory/listing title remains unchanged.
- The eBay `25001` catalog-safe inventory retry must retain `product.imageUrls`; removing accepted Picture Services URLs can stage an offer that later fails publishing with eBay's "Add at least 1 photo" error.
- Attached actual-item photos override a listing's older eBay Catalog image choice. Catalog matching is attempted only when no actual photos exist, preventing uncommon ISBNs with no eBay catalog art from staging photo-less offers.
- Seller-facing eBay staging and publishing failures use `ConvexError` so production clients receive the actionable eBay explanation instead of Convex's redacted generic server-error wrapper.
- Book ISBN lookup uses Open Library book, edition, and search data across equivalent ISBN-10 and ISBN-13 values. An optional Google Books API key supplies a second metadata and cover source. Missing Open Library covers are represented honestly instead of storing a blank placeholder URL, and existing books can refresh ISBN metadata in place. Book listings expose a required Author field, preserve it during eBay retries, and block staging with a clear correction message when older data has no author.
- Because full FlipTracker user authentication is still open, sensitive eBay actions are temporarily gated by a private `FLIPTRACKER_ADMIN_KEY`. This is a single-seller beta measure, not a multi-user authorization model.
- AI listing descriptions are generated by a provider-neutral Convex action supporting Gemini and OpenAI. The action is gated by the same beta seller key and keeps provider keys server-side. Gemini is the recommended free beta provider and defaults to `gemini-2.5-flash-lite`; OpenAI remains optional. Generated copy is always editable, and internal notes are filtered to buyer-relevant condition facts before they leave Convex.
- USB scanner Bulk Intake added: serial barcode queue, reusable stack defaults, duplicate-copy tracking, unique SKU generation, low-confidence review rows, and optional automatic internal eBay drafts.
- Cross-device photo workflow added: scan inventory at the computer, open Photos on a phone, identify the physical copy by SKU or UPC/bin, capture up to 12 ordered photos in Convex storage, choose a primary image, and advance through drafts needing photos.
- eBay draft creation uploads the complete stored photo set in order and caches eBay Picture Services URLs for retries. Legacy inline photos remain compatible pending migration.

- Dedicated Sourcing view added with manual sold observations, active/sold counts, shipping-inclusive median and average, sell-through proxy, estimated days to sell, rarity, liquidity, expected profit, ROI, confidence, and Buy / Maybe / Pass.
- Six illustrative sourcing records cover common liquid, common low-margin, uncommon liquid, niche low-supply, and rare low-confidence decisions. They are demo data, not live eBay market results.
- Hosted Quick Guide added at `/#guide`, with a plain `/README.md` reference covering scan, research, internal draft, manual eBay publishing, sale tracking, and backups.
- Sales Tracker's useful workflow is now merged into FlipTracker: marketplace listings, lifecycle statuses, listing prices/dates/platforms, price history, listing metrics, sold-profit tracking, CSV export, and old Sales Tracker JSON import.
- Listings include a dedicated Record Sale closeout for eBay and non-eBay channels. It captures sale price/date, acquisition cost, shipping income/cost, fees, buyer, order reference, custom channel details, and notes; shows net profit before saving; and keeps the linked sale record synchronized when corrected.
- Active eBay listings have a confirmation-protected live repricing workflow. Sellers can reduce by percentage, enter an exact price, or calculate a conservative profit floor from item cost, fee percentage, shipping income/cost, and target net profit. Local current price and immutable price history update only after eBay confirms success; ordinary repricing changes the public price but does not create a crossed-out Discounts Manager sale.
- The Listings view shows an account-wide eBay active count plus scheduled listings using `GetMyeBaySelling`, so manual and FlipTracker-created listings are both included. The default planning target is 200 and can be changed in Seller Connection. This meter is not the monthly zero-insertion-fee allowance counter; Seller Hub remains authoritative for allowance usage and billing-period renewals.
- Listings can explicitly refresh the authenticated seller's last 90 days of paid, non-cancelled eBay orders through the Fulfillment API. Order lines match FlipTracker by eBay listing ID first and SKU second, then update the listing/asset to Sold and upsert the linked sale with sold price, allocated buyer-paid shipping, allocated marketplace fees, buyer identifier, and eBay order ID. Repeated refreshes do not duplicate sales. The seller must reconnect eBay once after this feature is deployed to grant the read-only fulfillment scope.
- Marketplace Listings can be sorted by newest update, queue stage, status, price high-to-low, or price low-to-high; filtering and CSV export continue to use the resulting view.
- Custom listing packages default to 32 oz when no saved weight exists. Explicit presets and previously saved package weights remain authoritative.
- FlipTracker is the only product base. The separate Sales Tracker repo is now a migration/reference source and can be archived after its data is exported.
- Universal media barcode workflow started: camera UPC/EAN/ISBN scanning, manual barcode fallback, metadata lookup action, review form, condition/completeness, photo capture, heuristic listing recommendation, and eBay-ready draft fields saved on assets.
- Mobile camera scanning treats ordinary decode misses as an active scanning state; warnings are reserved for actual camera startup or permission failures.

- React + TypeScript + Vite app scaffold.
- Convex backend added for assets, collections, research/value history, and reports.
- Main inventory table reads from Convex with `useQuery`.
- Add/edit/delete inventory actions use Convex mutations.
- Inventory supports confirmation-protected bulk deletion for up to 100 selected records. The mutation cleans up linked Draft/Pending listings, price history, research/value history, and stored photos, but refuses the entire batch when any selected record is tied to a sale, staged eBay offer, external listing, Active listing, or Sold listing.
- Find Fair Value batches selected eBay draft pricing lookups into sequential groups of 25, matching the bounded Convex/eBay action while presenting one combined pricing review to the user.
- Listings can be filtered by workflow queue type, and Select All in View targets only eligible Draft/Pending eBay rows currently visible under the active search and filters. Changing the view drops hidden selections so bulk pricing or staging cannot accidentally include them.
- Selected inventory records can receive purchase cost in one atomic batch, either by splitting an entered lot total or assigning the same per-item cost. Split totals are calculated in cents and distribute any remainder across the first records so the assigned costs exactly match the amount paid.
- Inventory is the physical-item source of truth, with marketplace listings and sales retained as linked lifecycle records. Sold takes precedence over external-listing/staged indicators in queue filters; recording or syncing a sale marks the asset Sold, stores the actual sold price, clears value-review state, and repeat eBay syncs repair stale asset lifecycle fields.
- eBay's category-specific `Type` aspect is edited through a dedicated listing field, remains visible in the raw additional item specifics, and is retained with Language/Book Title/Author during eBay's reduced catalog-validation retry. It is distinct from FlipTracker's inventory media type.
- Dashboard cards use Convex report data.
- Excel import writes to Convex through `assets.importMany`.
- Excel export still works from current Convex query rows.
- Value override fields are preserved.
- Editing a title marks the item as needing value review.
- Users can manually mark an item as needing a value check.
- Sold Comps opens an eBay sold/completed search.
- Quick Sold Comps is available for every item. Terapeak Product Research is intentionally shown only when the working estimated, override, observed, or draft price reaches $50.
- First product identity pass added: brand mark, design tokens, metric cards, and status/strategy badges.
- Game metadata planning started in `docs/GAME_METADATA_MODEL.md`.
- Collections panel added with collection create/edit/delete, asset assignment, purchase price/source/location, and estimated profit summaries.
- Storage location added to assets for bin/shelf tracking.
- Saved value-check modal added; it writes value history/research checks and applies user override values.

## Current Architecture

```text
React/Vite/PWA -> Convex
GitHub -> Vercel -> React/Vite/PWA -> Convex
```

Convex is the current application backend. Excel import/export remains a portability and recovery path.

## Important Decisions

- Keep Excel import/export working even as the app moves to Convex.
- Treat inventory data carefully; avoid destructive schema or migration changes without a clear plan.
- Use Convex queries/mutations for the active UI.
- Keep docs updated as roadmap, setup, data model, or architecture decisions change.
- Avoid hosted backends other than Convex/Vercel unless explicitly approved.
- Design the app like a product from the start, not a rough internal utility.
- Use Underpriced as a product reference for fast reseller buy/skip decisions, fee/shipping-aware profit checks, confidence/red-flag signals, and saved sourcing analyses.
- Treat barcode scanning as two separate features: camera/barcode capture first, then metadata/value lookup through provider-backed services.
- Pursue eBay Browse API active listings as the first automated pricing signal during free beta. It has no data subscription fee, but production access requires eBay approval and is not guaranteed. Clearly label results as asking prices, preserve manual sold-result verification, and do not silently overwrite user values.
- Defer PriceCharting and other paid pricing providers until tester demand, product polish, and a paid FlipTracker subscription can support the cost.
- Keep sourcing decisions deterministic and inspectable. Median reduces outlier impact; rarity and liquidity remain separate; low confidence prevents an automatic Buy even when a single comp looks profitable.
- Keep eBay creation and eBay publishing separate. FlipTracker may create an unpublished offer after explicit seller authorization, but publishing remains absent until photos, category validation, account ownership, and a final confirmation step are reliable.

## Coding Conventions

- Frontend: React + TypeScript + Vite.
- Backend: Convex functions in `convex/`.
- Generated Convex files live in `convex/_generated/` and should be regenerated with `npx convex dev` after backend/schema changes.
- Inventory data types live in `src/types/`.
- Spreadsheet handling lives in `src/utils/excel.ts`.
- Track next steps in `TODO.md`.
- Larger product or architecture notes belong in `docs/`.

## Current Product Questions

- Which auth provider should FlipTracker use?
- Should this stay single-user for a while or become multi-user early?
- How should existing single-user data migrate once user ownership is added?
- What is the best game completeness model: flags, enum, or contents checklist?
- Should region be a simple field or a normalized value list?
- Should storage location start as a single free-text field or split into area/bin/shelf fields?
- When should eBay publishing be enabled, and what validation/confirmation checklist must block it?
- How should a saved sourcing decision be converted into inventory without duplicate entry?
- Which calculators belong in-app first: break-even, ROI, fee/shipping, promoted listing ROI, or lot analyzer?
- Should completeness be a single required field or a checklist of included parts?
- Which barcode metadata providers should be used for UPC/EAN/ISBN lookup?
- Should barcode value lookup use eBay sold comps, PriceCharting-style providers, or both?

## Outstanding Issues

- GitHub Issue #1 tracks future auth, richer game metadata, and eBay listing integration.
- Auth is not implemented yet.
- Collections page is not implemented yet.
- Dedicated collection detail page is not implemented yet.
- Saved research/value-check history display is not implemented yet.
- Production deployment and auth strategy are still open.
- Current Convex functions are not authenticated or owner-scoped. Do not share a public beta until this is fixed.
- eBay seller writes are protected by a temporary seller key, but the rest of the app remains unscoped. Replace this gate with real authenticated ownership before adding beta users.
- New captures use Convex file storage and ordered `assetPhotos` records. Existing legacy inline photos still need migration.
- The production build passes with a bundle-size warning; scanner and listing code should be split before broader release.
- `xlsx` currently has a high-severity npm advisory with no available upstream fix. Excel remains required, so beta imports should be trusted-only while a replacement or isolation strategy is evaluated.

## Next Practical Steps

1. Finish the Convex UI migration polish.
2. Decide on product identity: logo direction, palette, typography, UI language.
3. Convert accepted sourcing decisions into inventory records.
4. Add a dedicated collection detail page and lot calculator.
5. Add saved eBay research/value history display and richer comp fields.
6. Configure and smoke test the eBay Sandbox seller connection with one DVD and one book.
7. Pick and implement auth.
8. Migrate legacy inline photos, then add final photo validation before enabling publish.
9. Add richer game metadata: completeness, region, platform variants.
