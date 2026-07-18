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

- Sales Tracker's useful workflow is now merged into FlipTracker: marketplace listings, lifecycle statuses, listing prices/dates/platforms, price history, listing metrics, sold-profit tracking, CSV export, and old Sales Tracker JSON import.
- FlipTracker is the only product base. The separate Sales Tracker repo is now a migration/reference source and can be archived after its data is exported.
- Universal media barcode workflow started: camera UPC/EAN/ISBN scanning, manual barcode fallback, metadata lookup action, review form, condition/completeness, photo capture, heuristic listing recommendation, and eBay-ready draft fields saved on assets.

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
- Research button opens an eBay sold/completed search.
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
- What is the right first eBay integration: sold-comps research, draft listing creation, or full listing publish?
- Should FlipTracker have a dedicated sourcing mode separate from inventory mode?
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
- The production build passes with a bundle-size warning; scanner and listing code should be split before broader release.
- `xlsx` currently has a high-severity npm advisory with no available upstream fix. Excel remains required, so beta imports should be trusted-only while a replacement or isolation strategy is evaluated.

## Next Practical Steps

1. Finish the Convex UI migration polish.
2. Decide on product identity: logo direction, palette, typography, UI language.
3. Add a dedicated collection detail page and lot calculator.
4. Add saved eBay research/value history display and richer comp fields.
5. Pick and implement auth.
6. Add richer game metadata: completeness, region, platform variants.
7. Add item-level storage location / bin tracking once schema and import/export can persist it.
8. Add barcode scanner intake, starting with raw barcode capture and manual fallback before automatic value population.
