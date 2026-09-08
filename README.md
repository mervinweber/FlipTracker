# FlipTracker

An eBay-first resale inventory, listing, and profit tracker for books, games, DVDs, Blu-rays, cards, clothing, and other merchandise.

## Stack
- React + TypeScript + Vite
- Convex backend
- Vercel hosting
- Excel import/export backup

## This Build
Convex-backed inventory UI with schema, backend functions, docs, Excel import/export, value review, inventory write-offs, and year-end profit closeouts.

## Prototype Status
- Functional today: inventory management, eBay seller linking, draft staging, sold sync, sale closeout/archiving, inventory write-offs, year-end closeouts, and photo capture.
- Listing factory today: automatic media category routing, live eBay Taxonomy fields, readiness validation, an exception queue with Save & Next, package guardrails, photo capture, pricing, eBay staging, publishing, and sold sync.
- Still pending: real user authentication, per-user account ownership, deeper eBay category-aspect discovery, and broader automated test coverage.

## Project Docs
- `docs/PROJECT_MEMORY.md` is the project memory and restart point for future work.
- `docs/PRODUCT_IDENTITY.md` tracks brand, design language, and UI direction.
- `docs/GAME_METADATA_MODEL.md` tracks planned completeness, region, and condition fields.
- `docs/EBAY_PRICING_PLAN.md` defines the free-beta eBay active-listing pricing workflow and paid-provider decision gate.
- `docs/ROADMAP.md` tracks the version roadmap.
- `TODO.md` tracks near-term implementation tasks.

## Hosted Quick Guide

The deployed app includes a Quick Guide view at `/#guide`. A plain hosted reference is also available at `/README.md`.

## Inventory Accounting

- Every inventory record preserves the date it was added. New records also receive an editable acquired date, while linked marketplace records expose their listed date for markdown timing.
- Use **Write Off** on an eligible unsold Inventory row to record an item cost as a negative profit adjustment. Written-off records remain in history and cannot be listed or deleted.
- Expand **Business Year** on Inventory to review sales profit, write-offs, and net profit by calendar year.

## eBay Bundle Listings

- In Inventory, select 2-12 compatible unsold items and choose **Create eBay Bundle**.
- Review the generated 80-character title, itemized description, suggested lot price, condition, and shipping plan before creating the draft.
- FlipTracker combines actual photos already attached to every member, up to eBay's 12-photo limit. The Listings workspace can add more photos to the primary bundle record before staging.
- Bundle members remain linked through the listing lifecycle. Publishing marks every member Listed; an eBay sale marks every member Sold and uses their combined purchase cost for profit; ending or deleting an unpublished bundle returns its members to Inventory.
- A completed year can be closed once. Its immutable snapshot remains the official FlipTracker result for that year even when underlying historical records are later corrected.
- These totals are operational bookkeeping aids and are not tax advice.

## Next Step
Continue tightening the high-volume eBay intake and exception queues, then add authentication and per-user account ownership.
