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

## Cross-Device Photo Workflow

```text
Desktop USB intake -> internal eBay draft -> phone Photos queue -> SKU/UPC match -> Convex storage -> eBay Picture Services
```

`assetPhotos` stores ordered references to Convex file storage, keeping each physical copy's photos separate even when several assets share a UPC. The mobile queue finds Draft/Pending eBay listings that require actual photos. SKU is the preferred identifier; UPC lookup can return multiple copies and requires the user to choose by SKU and bin.

The browser resizes new captures before requesting a Convex upload URL. Single-item scan review can stage up to 12 photos before the asset exists; immediately after the inventory record is created, those photos are uploaded and attached in their reviewed order. The listing editor and mobile queue can add or manage the same stored photo set later. Users can choose the primary image, delete mistakes, and move directly to the next queued item. During eBay draft creation, stored images are uploaded in order and the resulting eBay URLs are cached for safe retries. Legacy inline `photoDataUrl` records remain readable until a separate migration removes them.

## eBay Seller Workflow

```text
Internal eBay draft -> Ready for Pricing -> Pricing approval -> Ready for eBay -> Seller-key gate -> eBay OAuth -> Inventory item -> Staged offer -> Confirmed publish -> Active listing
```

OAuth authorization returns through `convex/http.ts`. Refresh and access tokens are stored only in `ebayConnections`; the browser receives connection status and policy names, never tokens. `ebaySettings` stores the selected marketplace, inventory location, payment/fulfillment/return policies, and per-format category defaults.

Book drafts can use ISBN-based eBay catalog matching instead of forwarding third-party metadata image URLs when no actual item photos exist. Once the seller attaches actual photos, those photos become authoritative and are uploaded even if an older draft still requests catalog art. Open Library book data supplies author names during ISBN lookup, with edition author references used as a fallback, then stored on the asset. Media drafts default Language to English but expose a per-listing selector. Book Title and Author are separate required eBay aspects; Book Title defaults to the inventory title, while a missing Author blocks staging for correction. Older free-form values populate the structured fields; after the listing is saved, the structured selections are authoritative. Inventory item creation removes duplicate UPC/EAN/ISBN aspects and retries eBay error `25001` once with core product fields plus required Language, Book Title, and Author aspects when present. The retry retains any eBay Picture Services URLs so a generic catalog validation fallback cannot silently stage a photo-less offer, and preserves the detailed error if the reduced request also fails.

Queue pricing is an explicit review action. It writes the approved current/listed price, records price history, and marks the internal draft Ready for eBay; blank rows remain Ready for Pricing. A bounded batch then writes or refreshes each SKU-backed Inventory API item and creates or updates its staged offer, continuing past individual failures. The inventory payload includes the selected fulfillment policy and reviewed package measurements. Eligible new/sealed media and books may request an eBay catalog match by GTIN. Used discs and games must provide actual captured photos, which the action uploads to eBay Picture Services and fingerprints for safe retries. A separate confirmation-protected action refreshes the staged offer and calls eBay's publish endpoint; successful publication stores the live listing ID and URL and marks the listing Active. A temporary `FLIPTRACKER_ADMIN_KEY` gate protects seller actions until full application authentication and owner scoping replace it.

Active Inventory API listings can be repriced through a separate seller-key-gated action using eBay's bulk price/quantity endpoint. The browser calculates either a percentage reduction, an exact target, or a conservative profit-floor target from acquisition cost, estimated marketplace fees, shipping income/cost, and desired net profit. It previews the public price and estimated profit, then requires confirmation. Convex updates local `currentPrice` and inserts `listingPriceHistory` only after eBay reports a successful offer update, preventing local and marketplace prices from drifting after a rejected request.

The Listings view retrieves the seller's account-wide active and scheduled listing totals through the Trading API `GetMyeBaySelling` call. This count includes listings created outside FlipTracker and is intentionally separate from local marketplace-listing totals. A configurable target defaults to 200 and acts only as a planning warning. It does not represent or attempt to calculate eBay's monthly zero-insertion-fee usage, because renewals, relists, category rules, and account billing allowances make that a separate Seller Hub figure.

Older listings without package data receive conservative media defaults during eBay synchronization: 16 oz for books, 8 oz for DVDs/Blu-rays/games, and 6 oz for CDs. Explicit listing-level package measurements override these defaults.

Card fields are conditional in both inventory review and marketplace editing. Pokemon and Yu-Gi-Oh! cards send the eBay `Game` aspect; sports cards send `Sport`, plus set, card number, player, and team when available. Sale format routes the offer to eBay's current single-card, lot, complete-set, sealed-pack, or sealed-box category. Non-card records neither display nor send these fields, and an explicit listing-level category ID remains available as an advanced override.

Inventory synchronization repeats total ship-to-home quantity and a quantity distribution for the selected `merchantLocationKey` on every replace request. Offer refresh retries error `25604` once after a short delay to account for Inventory Service propagation without creating another offer.

## Security Boundary

Authentication and owner-scoped data are not implemented yet. Current inventory/listing functions are public application APIs without per-user authorization. Sensitive eBay actions require the private seller access key, use replay-resistant OAuth state, and keep tokens server-side, but this is only a single-seller private-beta boundary. A shared beta still requires an auth provider, `ConvexProviderWithAuth`, `convex/auth.config.ts`, owner fields/indexes, and server-side ownership checks on every user-data function.
