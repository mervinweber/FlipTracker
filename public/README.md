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
5. Review amber rows, then open **Listings** to select the queue, approve prices, and create unpublished eBay offers.

Direct eBay publishing is not enabled. FlipTracker can connect a seller account and prepare unpublished eBay offers, but a scan cannot make a listing live.

## Add photos from a phone

1. Open the same FlipTracker deployment on the phone and select **Photos**.
2. Scan the item's unique SKU label or UPC, or enter either code manually.
3. If multiple physical copies share a UPC, choose the correct record using its SKU and storage bin.
4. Capture the front, back, spine, discs, inserts, and visible flaws. Multiple existing photos can also be selected together.
5. Choose the strongest image as **Primary**, remove mistakes, then select **Done & Next**.

The photo queue contains internal eBay drafts that still need actual-item photos. New photos are compressed for upload, stored in Convex, and attached to that physical inventory copy across devices. FlipTracker does not have user accounts yet, so this workflow is currently intended for the single-owner private deployment.

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
3. In **eBay Seller Connection**, enter the private seller key and connect the eBay seller account.
4. Select the seller's inventory location, payment/shipping/return policies, and numeric category defaults, then save.
5. Select the drafts you want to process, then choose **Update Pricing**. Verify sold comps, enter each approved price, and apply the updates. Blank rows stay in **Ready for Pricing**.
6. Edit a draft to choose its eBay shipping policy and package preset. The policy controls the service and buyer charge; the package fields carry weight and dimensions.
7. For eligible new/sealed media and books, choose **eBay Catalog** and verify the barcode and artwork. Used discs and games require actual item photos.
8. Choose **Send to eBay Drafts**. FlipTracker uploads the ordered actual-photo set to eBay Picture Services, then creates or refreshes unpublished offers for selected **Ready for eBay** rows. Individual failures do not stop the rest of the batch.
9. Review the offer in Seller Hub, then finish and publish manually. Add the live eBay item ID and URL to FlipTracker.
10. Change the listing status to **Active** and confirm its listed date and current price.

FlipTracker does not call eBay's publish endpoint. Unpublished offer creation and live publication remain separate actions by design.

## Record a sale

1. Open **Listings** and select the dollar button on the item that sold.
2. Choose eBay or the marketplace where it sold. Choose **Other** to name a local shop, yard sale, convention, or another channel.
3. Enter sold price/date, what you paid, shipping charged, actual shipping cost, marketplace fees, buyer, order reference, and any useful notes.
4. Review the calculated net profit and save the sale. You can reopen the same closeout later to correct the amounts without creating a duplicate linked sale.

## Backups

- Use **Export Excel** for inventory.
- Use **Export CSV** for listings and sales.
- **Import Old JSON** accepts exports from the former Sales Tracker app. It creates new records and does not deduplicate.
