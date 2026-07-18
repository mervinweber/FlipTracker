# Architecture

```text
GitHub -> Vercel -> React/Vite/PWA -> Convex
```

Vercel hosts the frontend. Convex stores assets, collections, sales, value history, research checks, and dashboard reports.

The main React UI reads inventory and dashboard data with Convex `useQuery`, and add/edit/delete/import actions write through Convex mutations.

Excel import/export stays as a backup and data portability layer. Import parses spreadsheets in the browser and sends rows to `assets.importMany`; export serializes the current Convex query rows.


## Media Barcode Workflow

```text
Phone camera / manual UPC -> React scanner -> Convex mediaLookup action -> review form -> Convex assets
```

The PWA uses `@zxing/browser` for camera barcode scanning and keeps a manual barcode fallback. Metadata lookup currently runs through a Convex action: Open Library for ISBN/book metadata and UPCItemDB trial lookup for UPC/EAN media metadata when available.

The app saves scanned items to inventory first. Generated eBay listing fields are stored on the asset, but eBay draft creation is intentionally deferred until the scan/review workflow is stable.

## Combined Inventory And Sales Workflow

```text
Scan / Add -> Inventory Asset -> Internal Listing Draft -> Active Marketplace Listing -> Sold -> Profit History
```

`assets` remains the source of truth for the physical item. `marketplaceListings` stores each marketplace attempt, while `listingPriceHistory` preserves price changes. A sold listing updates the asset's inventory status and writes a normalized `sales` record for future reporting.

The old Sales Tracker frontend is not merged mechanically. Its useful lifecycle, metrics, filters, CSV export, and JSON migration concepts are rebuilt in FlipTracker's React and Convex architecture.

## Security Boundary

Authentication and owner-scoped data are not implemented yet. Current Convex functions are public application APIs without per-user authorization. A shared beta requires an auth provider, `ConvexProviderWithAuth`, `convex/auth.config.ts`, owner fields/indexes, and server-side ownership checks on every user-data function.
