# Product Benchmarks

This note records workflow ideas worth adapting for FlipTracker. It is not a commitment to copy every feature from a general-purpose reseller suite. FlipTracker remains eBay-first and optimized for books, games, DVDs/Blu-rays, cards, clothing, and occasional general merchandise.

## eBay Seller Hub

Useful patterns:

- Organize the home view around work that needs attention: drafts, missing specifics, active listings, orders, and performance.
- Support narrow bulk operations and isolate failed records for correction instead of failing an entire batch.
- Treat required and recommended item specifics as a measurable listing-quality surface.
- Track staged drafts before they age out. eBay states that Seller Hub drafts are retained for 75 days after their latest update.
- Link out to Product Research for authoritative sold-price range, average shipping, sell-through, and trend research when the API cannot provide the same dataset.

Sources:

- [Seller Hub](https://www.ebay.com/sellercenter/selling/how-to-sell/seller-hub)
- [Bulk listing tools](https://www.ebay.com/sellercenter/listings/ebay-bulk-listing-tools)
- [Item specifics](https://www.ebay.com/sellercenter/listings/item-specifics)
- [Product Research](https://www.ebay.com/help/selling/selling-tools/product-research?id=4853)
- [Offers to Buyers](https://www.ebay.com/sellercenter/growth/seller-hub-discounts/offers-to-buyers-best-offer)

## ScoutIQ

Useful patterns:

- Keep the scanner open and show each result without forcing the operator in and out of the camera.
- Use configurable profit-based rules instead of a price-only buy/pass decision.
- Cache repeat lookups and degrade gracefully when a live lookup is unavailable.
- Show one compact demand signal rather than asking the user to interpret several raw metrics while scanning.

Source: [ScoutIQ features](https://www.scoutiq.co/features)

## Card Dealer Pro

Useful patterns:

- Make the batch the primary unit of work: scan, identify, review, price, validate, then list.
- Separate automated identification from human approval.
- Apply title, description, pricing, and marketplace presets across a batch.
- Validate every record before publish and leave exceptions in a correction queue.

Sources:

- [Card Dealer Pro workflow](https://www.carddealerpro.com/)
- [Card Dealer Pro getting started](https://support.carddealerpro.com/hc/en-us/categories/21367782711707-Getting-Started-with-Card-Dealer-Pro)

## Vendoo And List Perfectly

Useful patterns even though cross-listing is not the current priority:

- Keep one inventory record through Draft, Listed, and Sold states.
- Make stale inventory, custom labels, storage location, and platform status easy to filter.
- Offer templates, bulk edits, image management, and mark-sold actions from the inventory workspace.
- Report revenue, profit, average sale price, category, and source performance from the same lifecycle data.

Sources:

- [Vendoo inventory management](https://help.vendoo.co/en/articles/6260262-vendoo-inventory-management-tools)
- [Vendoo help center](https://help.vendoo.co/en/)
- [List Perfectly features](https://listperfectly.com/pricing/)

## FlipTracker Product Direction

The clearest opportunity is an eBay listing operating system, not another broad cross-listing tool:

1. Capture items quickly in a named batch.
2. Resolve only identification and listing-readiness exceptions.
3. Apply trusted presets for category, shipping, condition, description, and pricing.
4. Preview the exact eBay payload and publish with explicit confirmation.
5. Reconcile active, stale, sold, and unmatched eBay records back to one physical inventory item.
6. Measure throughput and profit so the workflow improves over time.

## Deliberately Deferred

- Direct Poshmark, Mercari, Depop, or Vinted automation.
- A paid market-data subscription before beta demand supports it.
- Fully automatic AI publishing without human review.
- Complex team and warehouse features before authenticated ownership exists.
