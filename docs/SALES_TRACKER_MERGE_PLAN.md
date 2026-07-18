# Sales Tracker Merge Plan

## Decision

Merge Sales Tracker into FlipTracker rather than maintaining two separate apps.

FlipTracker should become the combined resale operating system:

```text
Source / Scan / Research -> Inventory -> Listing Queue -> Active Listings -> Sold / Profit History
```

Sales Tracker should be treated as a feature reference and migration source, not the long-term base app.

## Repositories Reviewed

### FlipTracker

Path: `/Users/mervinweber/Documents/FlipTracker`

Current strengths:

- React/Vite PWA frontend.
- Convex backend with inventory, collections, research/value history, reports, and media lookup.
- Vercel/Convex deployment path already started.
- Existing game inventory workflow.
- Universal media model started for games, DVDs, Blu-rays, CDs, books, and other media.
- UPC/EAN/ISBN barcode scanner workflow started.
- Excel import/export.
- Storage location/bin tracking.
- Value overrides and needs-value-check behavior.
- eBay-ready title, description, category, condition, item specifics, price, and shipping prep fields.

Current gaps:

- Listing lifecycle is shallow.
- No dedicated active listings page.
- No platform tracking for eBay, Mercari, Facebook Marketplace, etc.
- No price reduction history.
- No days-listed metrics.
- No sold-date/sales-performance dashboard.
- Auth is still open.

### Sales Tracker

Path: `/Users/mervinweber/Documents/saletracker`

Current strengths:

- Clean listing lifecycle model.
- Tracks listing platforms.
- Tracks listed price, current price, sold price, listed date, sold date, and status.
- Tracks price history when current price changes.
- Has useful listing stats: active listing value, revenue, average days to sell.
- Has useful filters: search, status, platform, condition, price range.
- CSV and JSON export.
- Has a planned eBay browser automation boundary.

Current gaps:

- LocalStorage only, no backend sync.
- Separate Tailwind design system that does not match FlipTracker.
- No barcode workflow.
- No media metadata model.
- No collections/lots.
- No research/value history.
- Current working tree has `src/App.tsx` deleted, so the filesystem copy is not currently buildable without restoring the committed App file.

## Recommended Merge Architecture

Use FlipTracker as the base app and add Sales Tracker concepts into Convex.

### Data Model Direction

Keep `assets` as the core item table. Add listing lifecycle fields to assets only for simple state:

- `listingStatus`
- `listedPrice`
- `currentPrice`
- `soldDate`
- `listedDate`
- `sku`

Add separate child tables for reusable/history data:

### `marketplaceListings`

One asset can have one or more marketplace listings.

Suggested fields:

- `assetId`
- `platform`
- `externalListingId`
- `listingUrl`
- `status`
- `listedPrice`
- `currentPrice`
- `soldPrice`
- `listedDate`
- `soldDate`
- `shippingCharged`
- `shippingCost`
- `fees`
- `buyer`
- `notes`
- `createdAt`
- `updatedAt`

### `listingPriceHistory`

Tracks every price change without rewriting arrays on the asset.

Suggested fields:

- `listingId`
- `assetId`
- `date`
- `price`
- `reason`
- `createdAt`

### `listingAuditJobs`

Future home for eBay/Mercari listing audit suggestions.

Suggested fields:

- `platform`
- `status`
- `startedAt`
- `completedAt`
- `notes`

### `listingAuditSuggestions`

Future review queue for browser automation or API-generated suggestions.

Suggested fields:

- `jobId`
- `assetId`
- `listingId`
- `suggestionType`
- `currentValue`
- `suggestedValue`
- `reason`
- `confidence`
- `status`
- `createdAt`

## Feature Mapping

| Sales Tracker Feature | Merge Target In FlipTracker |
| --- | --- |
| Platforms | Add marketplace listing records |
| Active/Sold/Expired/Relisted/Pending | Listing status, separate from inventory status |
| Listed price/current price/sold price | Marketplace listing fields |
| Price history | `listingPriceHistory` table |
| Days listed | Derived from listed/sold dates |
| Revenue stats | Convex reports query |
| CSV export | Add listing export alongside Excel inventory export |
| JSON backup | Lower priority because Convex + Excel already covers portability |
| Dark/light theme | Lower priority; FlipTracker already has product UI direction |
| eBay browser automation scaffold | Keep as future `listing audit` track after eBay draft creation |

## Proposed Implementation Phases

### Phase A: Listing Lifecycle Foundation

- Add Convex `marketplaceListings` schema.
- Add Convex `listingPriceHistory` schema.
- Add listing mutations: create, update, mark sold, delete.
- Track price history when current price changes.
- Add listing status values: Draft, Active, Pending, Sold, Expired, Relisted, Cancelled.
- Add platform constants: eBay, Mercari, Facebook Marketplace, Vinted, OfferUp, Craigslist, Poshmark, Depop, Etsy, Amazon, Other.

### Phase B: UI Merge

- Add app-level view tabs: Inventory, Scan, Research, Listings, Collections, Reports.
- Add Listings page using Sales Tracker table ideas.
- Add listing form or listing drawer connected to an inventory asset.
- Add active/sold filters, platform filters, condition filters, and price range filters.
- Add listing stats cards: active listings, active listed value, sold revenue, average days to sell.

### Phase C: Inventory-To-Listing Workflow

- From any asset, generate an eBay-ready listing plan.
- Save the listing as Draft first.
- Let user mark Draft -> Active after manually posting.
- Record external URL/listing ID.
- Track current price reductions.
- Mark Sold and compute net profit.

### Phase D: Imports And Migration

- Add Sales Tracker JSON import path.
- Map `ListingItem` records into FlipTracker assets + marketplaceListings.
- Preserve priceHistory as `listingPriceHistory`.
- Keep existing Excel import/export working.

### Phase E: eBay Integration Later

- Add eBay draft creation after local listing workflow is stable.
- Keep browser automation read-only at first.
- Add review queue before any edit/publish action.
- Avoid credential capture and silent listing edits.

## Merge Recommendation

Do not try to mechanically merge both React apps.

The better path is:

1. Keep FlipTracker as the only deployed product.
2. Port Sales Tracker's listing lifecycle concepts into Convex.
3. Rebuild the useful Sales Tracker UI patterns in FlipTracker's existing visual system.
4. Add a Sales Tracker JSON importer only if there is real data to migrate.
5. Archive or freeze `saletracker` once its concepts are merged.

This avoids maintaining two persistence systems, two designs, and two deployment paths.

## Immediate Next Step

Build Phase A and B in FlipTracker:

- `marketplaceListings` and `listingPriceHistory` Convex tables.
- Listing CRUD mutations.
- Listings tab/page.
- Active/sold stats cards.
- Asset-to-listing draft workflow.
