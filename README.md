# FlipTracker

An eBay-first resale inventory, listing, and profit tracker for books, games, DVDs, Blu-rays, cards, clothing, and other merchandise.

## Stack
- React + TypeScript + Vite
- Convex backend
- Vercel hosting
- Excel import/export backup

## This Build
Convex-backed inventory UI with schema, backend functions, docs, Excel import/export, and value-review workflow.

## Prototype Status
- Functional today: inventory management, eBay seller linking, draft staging, sold sync, and photo capture.
- Listing factory today: automatic media category routing, category-specific item details, package profiles, photo capture, pricing, eBay staging, publishing, and sold sync.
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

## Next Step
Continue tightening the high-volume eBay intake and exception queues, then add authentication and per-user account ownership.
