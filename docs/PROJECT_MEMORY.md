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

- eBay seller connection added: authorization-code OAuth through Convex HTTP, server-only refresh/access token storage, automatic token refresh, seller business-policy/location setup, category defaults, and creation/update of unpublished Inventory API offers. Publishing is intentionally not implemented.
- Listings now has a selectable eBay queue: Ready for Pricing drafts go through sold-comp/manual price review, approved updates preserve price history, and Ready for eBay rows can be sent as a bounded batch of unpublished offers with per-item failure handling.
- eBay drafts support per-listing fulfillment policies plus single-media, small-stack, media-box, and custom package measurements. New/sealed media can request an eBay catalog image through UPC/EAN/ISBN matching. Used items require an actual captured photo, uploaded to eBay Picture Services; metadata cover art is not submitted for used listings.
- Marketplace listings include a structured Language selector. Media defaults to English, older manual Language specifics populate the selector, saved selections are authoritative, and eBay's catalog-safe inventory retry preserves the required Language aspect.
- Book listings include a structured Book Title aspect that defaults to the inventory title and remains present during eBay's catalog-safe inventory retry.
- Book ISBN lookup uses Open Library book data for author names, with edition author references as a fallback, and stores the result in the shared asset model. Book listings expose a required Author field, preserve it during eBay retries, and block staging with a clear correction message when older data has no author.
- Because full FlipTracker user authentication is still open, sensitive eBay actions are temporarily gated by a private `FLIPTRACKER_ADMIN_KEY`. This is a single-seller beta measure, not a multi-user authorization model.
- USB scanner Bulk Intake added: serial barcode queue, reusable stack defaults, duplicate-copy tracking, unique SKU generation, low-confidence review rows, and optional automatic internal eBay drafts.
- Cross-device photo workflow added: scan inventory at the computer, open Photos on a phone, identify the physical copy by SKU or UPC/bin, capture up to 12 ordered photos in Convex storage, choose a primary image, and advance through drafts needing photos.
- eBay draft creation uploads the complete stored photo set in order and caches eBay Picture Services URLs for retries. Legacy inline photos remain compatible pending migration.

- Dedicated Sourcing view added with manual sold observations, active/sold counts, shipping-inclusive median and average, sell-through proxy, estimated days to sell, rarity, liquidity, expected profit, ROI, confidence, and Buy / Maybe / Pass.
- Six illustrative sourcing records cover common liquid, common low-margin, uncommon liquid, niche low-supply, and rare low-confidence decisions. They are demo data, not live eBay market results.
- Hosted Quick Guide added at `/#guide`, with a plain `/README.md` reference covering scan, research, internal draft, manual eBay publishing, sale tracking, and backups.
- Sales Tracker's useful workflow is now merged into FlipTracker: marketplace listings, lifecycle statuses, listing prices/dates/platforms, price history, listing metrics, sold-profit tracking, CSV export, and old Sales Tracker JSON import.
- FlipTracker is the only product base. The separate Sales Tracker repo is now a migration/reference source and can be archived after its data is exported.
- Universal media barcode workflow started: camera UPC/EAN/ISBN scanning, manual barcode fallback, metadata lookup action, review form, condition/completeness, photo capture, heuristic listing recommendation, and eBay-ready draft fields saved on assets.
- Mobile camera scanning treats ordinary decode misses as an active scanning state; warnings are reserved for actual camera startup or permission failures.

- React + TypeScript + Vite app scaffold.
- Convex backend added for assets, collections, research/value history, and reports.
- Main inventory table reads from Convex with `useQuery`.
- Add/edit/delete inventory actions use Convex mutations.
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
