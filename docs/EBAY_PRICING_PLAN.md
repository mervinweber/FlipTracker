# eBay Pricing Plan

## Decision

FlipTracker will use eBay listings as its first automated pricing source during the free beta.

The first integration will use eBay's broadly available Browse API to retrieve active listings. Active listings represent seller asking prices, not completed-sale values. FlipTracker must label them as `Active eBay Listings` or `Asking Price Range` and must not present them as sold comps or verified market value.

Paid pricing providers are deferred until:

- The beta has enough active testers to evaluate lookup quality and operating costs.
- The scan, review, inventory, and listing workflows are polished.
- A paid FlipTracker subscription model is ready to support provider costs.

## Beta Pricing Workflow

```text
UPC / title / edition
        |
        v
eBay Browse API active listings
        |
        v
Normalize condition, format, shipping, and edition
        |
        v
Low / median / high asking price + match count
        |
        v
User review and optional value override
```

The existing eBay sold/completed search link remains available for manual verification.

## Phase 1 - eBay Developer Connection

- Create an eBay Developers Program application.
- Store eBay client credentials only in Convex environment variables.
- Obtain eBay application access tokens server-side through the client-credentials flow.
- Never expose eBay secrets through `VITE_` environment variables or browser requests.
- Start in the eBay sandbox where supported, then request production access.

Official references:

- Browse API: https://developer.ebay.com/api-docs/buy/static/api-browse.html
- OAuth client credentials: https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html

## Phase 2 - Active Listing Lookup

- Add a Convex action that searches eBay by UPC/GTIN when available.
- Fall back to normalized title, edition, media format, platform, and release year.
- Request relevant category, condition, price, shipping, item URL, image, and product identifiers.
- Exclude obvious mismatches such as lots, case-only listings, wrong formats, wrong regions, digital editions, and unrelated bundles when possible.
- Calculate shipping-inclusive prices as well as item-only asking prices.
- Return a bounded set of the strongest matches for user review.

## Phase 3 - Pricing Summary

For each lookup, calculate and display:

- Match count.
- Lowest asking price.
- Median asking price.
- Highest asking price after basic outlier removal.
- Median shipping-inclusive price.
- Condition and format distribution.
- Lookup query and timestamp.
- Confidence: High, Medium, or Low.
- Warning when fewer than three credible matches are available.

The suggested inventory estimate should remain a recommendation until the user approves it.

## Phase 4 - Review Queue

- Add `Refresh Price` on an individual item.
- Add selection checkboxes and `Refresh Selected` for controlled batches.
- Show current value beside suggested asking-price range.
- Allow Approve, Edit, or Ignore.
- Write approved values to value history with source `eBay Active Listings`.
- Keep `needsValueCheck` true for low-confidence matches.
- Never silently overwrite a user override.

## Phase 5 - Controlled Bulk Refresh

- Process small server-side batches instead of sending hundreds of requests at once.
- Cache UPC/title searches to reduce duplicate requests and respect eBay rate limits.
- Record lookup status and errors per item.
- Allow retrying only failed or stale items.
- Add a configurable refresh age, initially 30 days.
- Keep bulk application review-based during beta.

## Later Upgrade Path

The pricing provider layer should return one normalized result shape regardless of provider. Future sources can then be added without rewriting inventory:

- eBay Marketplace Insights sold history, if FlipTracker receives limited-release access.
- PriceCharting or another paid collector-data provider after monetization.
- Category-specific sources for books, movies, music, or cards when justified.

When actual sold data is available, FlipTracker should show active asking prices and sold prices separately rather than blending them without explanation.

## eBay Listing And Order Integration

Pricing research is separate from publishing:

- Browse API: active marketplace research.
- Inventory API: future offer/listing creation and publishing.
- Fulfillment API: future synchronization of the authenticated seller's completed orders.

The first beta milestone is active-listing research only. Direct listing publication remains later work because it requires seller OAuth, business policies, inventory locations, unique SKUs, and a careful review workflow.

## Success Criteria

The eBay beta pricing feature is ready when:

- UPC and title searches return clearly labeled active listings.
- Users can see and reject poor matches.
- Asking-price summaries include shipping and confidence.
- User overrides are never overwritten automatically.
- Manual sold-result verification remains one click away.
- Bulk refresh is bounded, cached, reviewable, and recoverable after partial failure.
