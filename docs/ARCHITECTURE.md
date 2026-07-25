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

## Sourcing Decision Workflow

```text
Manual eBay observations + acquisition costs
                    |
                    v
Convex sourcing mutation -> deterministic metrics -> Sourcing dashboard
```

`sourcingAnalyses` stores the saved inputs and calculated decision snapshot. `sourcingComps` stores each observed sold price separately, including item price, shipping, and delivered total. The server calculates median and average sold price, sell-through proxy, estimated days to sell, rarity, liquidity, expected fees, profit, ROI, confidence, and Buy / Maybe / Pass.

This workflow is provider-independent and currently uses manual observations. The demo records are explicitly marked illustrative. An approved eBay or paid provider can later feed the same normalized calculation layer without changing the decision UI.

## USB Bulk Intake Workflow

```text
USB scanner -> focused keyboard input -> serial metadata queue -> atomic Convex mutation -> asset + optional internal eBay draft
```

Each scan creates one physical `assets` record. Duplicate UPCs are allowed and receive separate copy numbers and SKUs. The asset and optional `marketplaceListings` draft are written in one mutation so partial intake records are not left behind. Direct eBay publishing remains outside this transaction until seller OAuth and authenticated ownership are implemented.

## Security Boundary

Authentication and owner-scoped data are not implemented yet. Current Convex functions are public application APIs without per-user authorization. A shared beta requires an auth provider, `ConvexProviderWithAuth`, `convex/auth.config.ts`, owner fields/indexes, and server-side ownership checks on every user-data function.
