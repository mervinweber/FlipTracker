# FlipTracker Quick Start

FlipTracker tracks games, DVDs, Blu-rays, CDs, books, and other resale media from intake through sale.

## Scan an item

1. Select **Scan Media**.
2. Allow camera access and center the UPC, EAN, or ISBN in view.
3. Use manual barcode entry if the camera cannot read it.
4. Review and correct the title, edition, format, release information, studio, rating, and cover.
5. Enter condition, completeness, storage location/bin, purchase price, and an item photo.
6. Select **Save to Inventory**.

## Scan a stack with a USB scanner

1. Open **Bulk Intake** or select **Scan Stack**.
2. Set the condition, completeness, collection, storage bin, cost per item, SKU prefix, and shipping defaults.
3. Leave **Create eBay draft** enabled and scan each UPC. Configure the scanner to send Enter or Tab after the code.
4. Keep scanning while the queue works. Each physical copy receives a separate inventory record and unique SKU.
5. Review amber rows, then open **Listings** to finish pricing, photos, and the manual eBay posting step.

Direct eBay publishing is not enabled yet. It requires secure seller OAuth, eBay business policies, and authenticated FlipTracker users.

## Research the value

1. Select **Sold Comps** on any inventory item to open eBay's completed and sold listings.
2. When the working value is $50 or more, select **Terapeak** for deeper eBay Product Research.
3. Compare the same edition, region, condition, and completeness.
4. Select **Log Value** to save the range, source, confidence, URL, and notes.
5. Enter User Low and User High to override the estimate after your own research.

Changing the title, UPC, edition, condition, or completeness marks the item for another value check.

## Decide whether to buy

1. Open **Sourcing** and select **New Analysis**.
2. Enter the exact title, edition, condition, purchase cost, active listing count, and sold count for the last 90 days.
3. Enter comparable sold prices one per line. Use `24.99 + 4.50` when shipping was charged separately.
4. Review median price, expected profit, ROI, sell-through, estimated days to sell, rarity, liquidity, and confidence.
5. Open **Details** to inspect the calculation and verify the item on eBay before buying.

**Load Demo Examples** adds clearly labeled illustrative records showing common, uncommon, niche, and low-confidence outcomes. They are not current eBay market data. Rarity measures supply; liquidity measures likely sales speed.

## Create and post an eBay listing

1. Select **Draft** on the inventory item.
2. Open **Listings** and review the prepared title, description, category, condition, item specifics, price, and shipping plan.
3. Open eBay Seller Hub and create a new listing.
4. Copy the prepared information from FlipTracker, upload the actual photos, and publish through eBay.
5. Return to FlipTracker and add the eBay item ID and listing URL.
6. Change the listing status to **Active** and confirm its listed date and current price.

FlipTracker prepares and tracks listings but does not publish directly to eBay yet.

## Record a sale

1. Change the listing status to **Sold**.
2. Enter sold price, shipping charged, actual shipping cost, marketplace fees, buyer, and sold date.
3. Save. FlipTracker records the sale and calculates net profit.

## Backups

- Use **Export Excel** for inventory.
- Use **Export CSV** for listings and sales.
- **Import Old JSON** accepts exports from the former Sales Tracker app. It creates new records and does not deduplicate.
