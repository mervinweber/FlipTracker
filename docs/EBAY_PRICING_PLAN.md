# eBay Pricing Plan

## Decision

FlipTracker will pursue eBay listings as its first automated pricing source during the free beta.

The first integration candidate is eBay's Browse API, which retrieves active listings. Active listings represent seller asking prices, not completed-sale values. FlipTracker must label them as `Active eBay Listings` or `Asking Price Range` and must not present them as sold comps or verified market value.

The API does not require a paid data subscription, but production use is restricted. Sandbox testing is available with an eBay developer account; production Buy/Browse API access requires an eBay application review and may require eBay Partner Network approval and agreements. Approval is not guaranteed.

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
- Create an eBay Partner Network account if required for the production Browse API application.
- Build a reviewable sandbox proof of the search workflow.
- Submit the Buy API production-access/application growth check.
- Treat production approval as a dependency, not an assumption.
- Store eBay client credentials only in Convex environment variables.
- Obtain eBay application access tokens server-side through the client-credentials flow.
- Never expose eBay secrets through `VITE_` environment variables or browser requests.
- Start in the eBay sandbox where supported, then request production access.

Official references:

- Browse API: https://developer.ebay.com/api-docs/buy/static/api-browse.html
- OAuth client credentials: https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html
- Buy API production requirements: https://developer.ebay.com/api-docs/buy/buy-requirements.html
- Application growth check: https://developer.ebay.com/api-docs/static/gs_request-an-application-growth.html

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

## No-Approval Fallback

If eBay does not approve production Browse API access during beta:

- Keep one-click eBay active and sold/completed search links.
- Generate strong search queries from UPC, title, edition, format, region, and completeness.
- Let users enter or approve observed values manually.
- Build the review queue and value-history model now so an approved or paid provider can be connected later.
- Do not depend on unofficial scraping endpoints or unreviewed marketplace APIs for production.

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
