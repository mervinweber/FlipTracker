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

The app saves scanned items to inventory first. Generated eBay listing fields are stored on the asset and copied into an internal marketplace draft.

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

Each scan creates one physical `assets` record. Duplicate UPCs are allowed and receive separate copy numbers and SKUs. The asset and optional `marketplaceListings` draft are written in one mutation so partial intake records are not left behind.

## eBay Seller Workflow

```text
Internal eBay draft -> Seller-key gate -> eBay OAuth -> Inventory item -> Unpublished offer
```

OAuth authorization returns through `convex/http.ts`. Refresh and access tokens are stored only in `ebayConnections`; the browser receives connection status and policy names, never tokens. `ebaySettings` stores the selected marketplace, inventory location, payment/fulfillment/return policies, and per-format category defaults.

Creating an eBay draft writes or refreshes the SKU-backed Inventory API item, then creates or updates an unpublished offer. The publish endpoint is intentionally absent. The listing stores the returned offer ID, sync status, timestamp, and last error. A temporary `FLIPTRACKER_ADMIN_KEY` gate protects seller actions until full application authentication and owner scoping replace it.

## Security Boundary

Authentication and owner-scoped data are not implemented yet. Current inventory/listing functions are public application APIs without per-user authorization. Sensitive eBay actions require the private seller access key, use replay-resistant OAuth state, and keep tokens server-side, but this is only a single-seller private-beta boundary. A shared beta still requires an auth provider, `ConvexProviderWithAuth`, `convex/auth.config.ts`, owner fields/indexes, and server-side ownership checks on every user-data function.
