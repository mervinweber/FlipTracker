# Data Model

## collections
One purchase/source event.

Collections track purchase lot name, source, purchase date, purchase price, location, and notes. Assets can be assigned to a collection with `collectionId`, enabling collection-level value and estimated profit summaries.

## assets
One resale item. This is intentionally broader than games so we can later support cards, DVDs, Blu-rays, toys, and electronics.

Value fields include estimated ranges, local ranges, user override ranges, `valueSource`, and `needsValueCheck`. Title edits mark an asset for value review unless the saved patch explicitly clears the flag through a user override.

Assets include `storageLocation` for item-level bin/shelf/location tracking.

## sales
Sale events and fee/shipping details.

## valueHistory
Value snapshots over time.

## researchChecks
Research method, confidence, notes, and recommendation.

Saved value checks write to both `valueHistory` and `researchChecks`, then update the asset's user override value and clear `needsValueCheck`.


### Universal media fields
Assets now support media-oriented fields in addition to existing game fields: `mediaFormat`, `upc`, `barcode`, `barcodeType`, `releaseYear`, `releaseDate`, `studio`, `rating`, `coverImageUrl`, `photoDataUrl`, `metadataSource`, `metadataConfidence`, and `metadataCheckedAt`.

`console` remains for games and backwards compatibility. `mediaFormat` is the preferred display field for DVDs, Blu-rays, CDs, books, and other media.

### Condition and completeness
The older boolean `complete` and `manual` fields remain for existing game rows. New media intake uses a broader `completeness` field such as Complete, Disc Only, Case Only, Case + Disc, No Manual, Sealed, Loose, or Incomplete.

### Listing fields
Assets can store first-pass eBay listing preparation fields: `listingRecommendation`, `ebayTitle`, `ebayDescription`, `ebayCategory`, `ebayCondition`, `ebayItemSpecifics`, `ebayPrice`, and `ebayShipping`. These are generated locally from the review form and recalculated when title, UPC/barcode, edition, condition, completeness, or price inputs change. Actual eBay draft creation is intentionally deferred.

### Photos
The first barcode workflow stores a compressed `photoDataUrl` directly on the asset for fast PWA iteration. This should move to Convex file storage before heavy photo usage or production multi-user release.

## marketplaceListings

One marketplace listing attempt connected to an asset. It stores platform, lifecycle status, marketplace identifiers, listing content, original/current/sold prices, shipping and fee amounts, listed/sold dates, buyer, and notes.

An asset may have multiple marketplace listing records over time or across platforms. Listing status is deliberately separate from the asset's physical inventory status.

For eBay, `pricingStatus`, `pricingSource`, and `pricingUpdatedAt` preserve the reviewed queue state. `fulfillmentPolicyId` can override the seller default for one listing. `shippingPreset`, `packageType`, `packageWeightOz`, and the package dimension fields preserve reviewed shipment data sent with the eBay inventory item. `imageMode` chooses an actual item photo or an eligible eBay catalog match; `ebayImageUrl`, `ebayImageFingerprint`, and `ebayImageSource` preserve the Picture Services result and avoid duplicate uploads. `ebayCategoryId`, `ebayInventorySku`, `ebayOfferId`, `ebayDraftStatus`, `ebayDraftCreatedAt`, and `ebayLastError` preserve the unpublished-offer sync state without treating it as a live listing.

## ebayConnections

The single-seller beta's server-only eBay OAuth record. It stores environment, access/refresh tokens, scopes, expiry times, and connection timestamps. No public query returns the tokens.

## ebayOauthStates

Short-lived, single-use hashes for eBay OAuth CSRF protection. The callback consumes and deletes the matching state before exchanging the authorization code.

## ebaySettings

Seller defaults for marketplace/currency, inventory location, business policies, and numeric category IDs by media format. These defaults prepare offers consistently but do not publish them.

## listingPriceHistory

One immutable price event connected to a marketplace listing and its asset. Initial listing prices and later changes are stored with a timestamp and optional reason.

## sourcingAnalyses

One saved acquisition decision. It stores exact item identity, acquisition and fulfillment assumptions, active and 90-day sold counts, calculated market metrics, confidence, recommendation, and explanatory notes. `isDemo` and `demoKey` keep illustrative examples identifiable and make seeding repeatable.

Rarity is derived from active supply. Liquidity combines sell-through and recent sold velocity. They are intentionally separate because a scarce item is not necessarily fast-selling.

## sourcingComps

One observed sold-price input connected to a sourcing analysis. Item price, shipping, delivered price, source label, and observation time are preserved so users can inspect the evidence behind the summary. Each analysis is limited to 100 observations.

## Sales Tracker Migration

The Listings view accepts the JSON format exported by the old Sales Tracker app. Each imported item creates one new asset and one listing per platform, with price history copied to child records. The importer does not deduplicate and is limited to 200 source records per run.
