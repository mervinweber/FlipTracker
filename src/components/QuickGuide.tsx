import { Barcode, Box, Camera, CircleDollarSign, ExternalLink, FileText, Gauge, Keyboard, LayoutList, Search, ShoppingBag } from 'lucide-react';

const steps = [
  { icon: Barcode, label: 'Scan', detail: 'Capture the UPC, EAN, or ISBN.' },
  { icon: Search, label: 'Review', detail: 'Confirm the exact title and edition.' },
  { icon: Box, label: 'Store', detail: 'Record condition, completeness, and bin.' },
  { icon: Camera, label: 'Photograph', detail: 'Attach the actual item photos from your phone.' },
  { icon: LayoutList, label: 'List', detail: 'Prepare and track the marketplace listing.' },
  { icon: CircleDollarSign, label: 'Sell', detail: 'Record fees, shipping, and profit.' },
];

export default function QuickGuide() {
  return (
    <section className="guidePage">
      <header className="guideHeader">
        <div><p className="eyebrow">Quick start</p><h2>Using FlipTracker</h2><p>Move books, games, movies, cards, and clothing from intake to a live eBay listing and completed sale.</p></div>
        <a className="button secondary" href="/README.md" target="_blank" rel="noreferrer"><FileText size={16}/> Open README</a>
      </header>

      <div className="workflowStrip" aria-label="FlipTracker workflow">
        {steps.map(({ icon: Icon, label, detail }, index) => (
          <div className="workflowStep" key={label}><span>{index + 1}</span><Icon size={20}/><div><strong>{label}</strong><small>{detail}</small></div></div>
        ))}
      </div>

      <div className="guideContent">
        <section><div className="guideNumber">1</div><div><h3>Scan or add an item</h3><ol>
          <li>Select <strong>Scan Media</strong> and allow camera access.</li>
          <li>Hold the UPC, EAN, or ISBN steady inside the camera view. Use manual barcode entry when the camera cannot read it.</li>
          <li>Review the returned title, format, release information, studio, rating, and cover image.</li>
          <li>Correct the exact title or edition before saving. Metadata providers can identify the wrong release.</li>
          <li>Enter condition, completeness, storage location/bin, purchase price, and an item photo.</li>
          <li>Select <strong>Save to Inventory</strong>.</li>
        </ol></div></section>

        <section><div className="guideNumber">2</div><div><h3>Scan a stack with a USB scanner</h3><ol>
          <li>Open <strong>Bulk Intake</strong> or select <strong>Scan Stack</strong>.</li>
          <li>Set the condition, completeness, collection, storage bin, cost, SKU prefix, and shipping defaults.</li>
          <li>For a small game lot without visible barcodes, use <strong>Photo Lot</strong>: choose one clear group photo, enter the item count and total paid, then review the AI-proposed title, platform, cost allocation, price, and description for every game.</li>
          <li>Leave <strong>Create eBay draft</strong> enabled, then scan each UPC. Most USB scanners type the code and press Enter automatically.</li>
          <li>Continue scanning while the queue processes. Every physical copy receives its own inventory record and unique SKU.</li>
          <li>Review amber rows, then use the Photos queue on your phone before finishing pricing in Listings.</li>
        </ol><p className="guideNote"><Keyboard size={15}/> Photo identification and prices are editable working estimates, not verified sold comps. All records remain internal drafts until you review photos and send them to eBay.</p></div></section>

        <section><div className="guideNumber">TCG</div><div><h3>Process Pokemon and Yu-Gi-Oh! cards</h3><ol>
          <li>Open <strong>Cards</strong>, choose Pokemon or Yu-Gi-Oh!, and set the session destination and minimum value for an individual listing.</li>
          <li>Take a clear front photo. Gemini reads the visible identifiers and immediately searches the catalog when configured; manual set-code and collector-number entry remains the fallback.</li>
          <li>Add the back photo and choose the exact printing when several variants are found. A single unambiguous catalog match is selected automatically. For older Yu-Gi-Oh! reprints, confirm `1st Edition` below the artwork and the tiny `1996` or `2020` bottom copyright mark.</li>
          <li>Review the catalog reference price, cost, bin, and Individual, Playset, Bundle, or Hold guidance.</li>
          <li>Select <strong>Save &amp; Start Next Card</strong>. The inventory record and both actual photos are saved together while session defaults remain ready for the next card.</li>
          <li>For eBay, create an internal draft. For Vinted, use the prepared title and description from the session tray for a quick manual listing.</li>
        </ol><p className="guideNote"><Camera size={15}/> Card recognition proposes candidates but never silently chooses a printing. Vinted-ready prep does not log in, scrape, or publish to Vinted.</p></div></section>

        <section><div className="guideNumber">3</div><div><h3>Add listing photos from your phone</h3><ol>
          <li>Open the same FlipTracker deployment on your phone and select <strong>Photos</strong>.</li>
          <li>Choose <strong>Start Photo Session</strong> for a stack, or scan an item's SKU label/UPC to open one record directly.</li>
          <li>If several copies share a UPC, choose the correct copy by its unique SKU and storage bin.</li>
          <li>Follow the item-specific shot guide. You can take photos individually or choose several existing photos at once.</li>
          <li>The session advances automatically at the recommended count. Use <strong>Complete &amp; Next</strong> to finish early, or Skip to leave the item in the queue.</li>
          <li>Select the strongest image as Primary, rotate sideways images, and remove mistakes before publishing.</li>
        </ol><p className="guideNote"><Camera size={15}/> Partial photo sets remain in the queue until the recommended count is reached or you explicitly complete them. Captures are stored in Convex and remain attached to the same inventory copy across devices.</p></div></section>

        <section><div className="guideNumber">4</div><div><h3>Make a sourcing decision</h3><ol>
          <li>Open <strong>Sourcing</strong> and select <strong>New Analysis</strong>.</li>
          <li>Enter the exact title, edition, condition, purchase cost, active listing count, and 90-day sold count.</li>
          <li>Enter several comparable sold prices, including shipping when it was charged separately.</li>
          <li>Set your minimum profit, target ROI, and minimum liquidity rules.</li>
          <li>Review median price, expected profit, ROI, sell-through, estimated days to sell, rarity, liquidity, and confidence.</li>
          <li>Use <strong>Pay up to</strong> as the maximum acquisition cost that still meets both profit and ROI targets.</li>
          <li>Treat Buy, Maybe, or Pass as a decision aid and verify the exact item on eBay before purchasing.</li>
        </ol><p className="guideNote"><Gauge size={15}/> Rarity means low supply. Liquidity means likely speed of sale. A rare item can still be slow and uncertain.</p></div></section>

        <section><div className="guideNumber">5</div><div><h3>Research the value</h3><ol>
          <li>From Inventory, select <strong>Sold Comps</strong> to open an eBay sold/completed-items search.</li>
          <li>For items valued at $50 or more, select <strong>Terapeak</strong> for deeper eBay Product Research.</li>
          <li>Compare the same format, edition, region, condition, and completeness.</li>
          <li>Select <strong>Log Value</strong> to save the observed low/high range, source, confidence, URL, and notes.</li>
          <li>Use User Low and User High when your research should override the estimate.</li>
        </ol><p className="guideNote">Changing the title, UPC, edition, condition, or completeness marks the item for another value check.</p></div></section>

        <section><div className="guideNumber">6</div><div><h3>Create the listing draft</h3><ol>
          <li>Open <strong>Listings</strong> and use its lifecycle views: Queue for draft work, Active for live-listing maintenance, Shipping for paid orders, Sold for completed-sale history, and Needs Attention for exceptions.</li>
          <li>Use <strong>Listing Templates</strong> to remember family defaults for books, movies, games, cards, clothing, and general items.</li>
          <li>Find the item in Inventory and select <strong>Draft</strong>.</li>
          <li>FlipTracker creates an internal eBay draft using the prepared title, description, category, condition, item specifics, and price.</li>
          <li>In the <strong>Queue</strong> view, select the drafts you want to process and choose <strong>Update Pricing</strong>.</li>
          <li>Check sold comps, enter each approved price, and apply the updates. Blank rows stay in Ready for Pricing.</li>
          <li>In eBay Seller Connection, enter the private seller key, connect the seller account, and save its location and business policies.</li>
          <li>Start with <strong>Fast Review</strong> to confirm the title, condition, price, shipping, photo status, and estimated net. Use Advanced only for category-specific exceptions.</li>
          <li>The full editor still provides Item, Category, Shipping &amp; Photos, Price &amp; Description, and eBay payload preview. FlipTracker automatically routes books, games, DVDs, Blu-rays, CDs, and cards.</li>
          <li>Use <strong>Selling Readiness</strong> to review incomplete drafts. Correct the first blocker, then use <strong>Save &amp; Next</strong> to continue through the queue.</li>
          <li>For clothing or general merchandise, use the category finder to select a precise eBay leaf category.</li>
          <li>Complete the required eBay category fields loaded from Taxonomy. FlipTracker checks them again before staging.</li>
          <li>Choose the human-readable shipping policy and package profile. FlipTracker fills a practical package weight and size, which you can override under Advanced package details.</li>
          <li>Use eBay Catalog for eligible new/sealed media and books with usable metadata art. Used discs and games require actual item photos.</li>
          <li>Choose <strong>Stage with eBay</strong> to create or refresh unpublished offers for the selected Ready for eBay rows.</li>
          <li>Add an SKU when useful; the storage location remains visible for fulfillment.</li>
        </ol><p className="guideNote"><ShoppingBag size={15}/> The eBay offer is not live. FlipTracker uploads the ordered photo set to eBay Picture Services, but every offer still needs a final Seller Hub review.</p></div></section>

        <section><div className="guideNumber">7</div><div><h3>Publish it to eBay</h3><ol>
          <li>Open the staged row and review its title, category, condition, specifics, price, selected policy, package profile, and photos.</li>
          <li>Select the rocket button to publish. FlipTracker asks for confirmation before making the listing live.</li>
          <li>For a prepared batch, select staged rows and use <strong>Publish Staged</strong>. Successful listings go live while failed rows remain selected for correction.</li>
          <li>Open the resulting eBay link and check the public listing, especially the shipping charge and mobile photo order.</li>
          <li>FlipTracker stores the eBay item ID and URL and moves the record into the Published queue.</li>
        </ol><p className="guideNote"><ShoppingBag size={15}/> Staging is not publishing. The listing only becomes purchasable after the separate Publish confirmation.</p></div></section>

        <section><div className="guideNumber">8</div><div><h3>Track price changes and the sale</h3><ol>
          <li>Edit Current Price whenever a listing is reduced and enter a reason. FlipTracker preserves the price history.</li>
          <li>When sold, change the listing status to <strong>Sold</strong>.</li>
          <li>Use the dollar button on a listing to record where it sold, sale price/date, what you paid, shipping income/cost, fees, buyer, order reference, and notes. Imported sold records open this same closeout directly and do not require eBay category, photo, or shipping details.</li>
          <li>Open <strong>Shipping</strong> to work every paid order by bin location, or print the compact pick list for a larger batch.</li>
          <li>Review the suggested package and service, confirm the measured weight, flag insurance, and mark the order Packed.</li>
          <li>Choose <strong>Buy Label on eBay</strong>. eBay remains authoritative for buyer address, service eligibility, and the final postage charge.</li>
          <li>Return to FlipTracker, enter the label cost and tracking number, then choose <strong>Submit Tracking to eBay</strong>. Repeated submissions reconcile the existing fulfillment instead of creating another shipment.</li>
          <li>Select <strong>Mark completed / archived</strong> when no fulfillment work remains. The record stays Sold so revenue and profit reporting remain accurate.</li>
          <li>FlipTracker updates inventory status, sales history, revenue, net profit, and fulfillment state.</li>
        </ol></div></section>

        <section><div className="guideNumber">9</div><div><h3>Back up and migrate data</h3><ol>
          <li>Use <strong>Export Excel</strong> from Inventory for an inventory backup.</li>
          <li>Use <strong>Export CSV</strong> from Listings for listing and sales records.</li>
          <li>Use <strong>Import Old JSON</strong> only for a Sales Tracker JSON export. It creates new records and does not deduplicate.</li>
        </ol><a className="guideLink" href="/README.md" target="_blank" rel="noreferrer">Open the hosted README <ExternalLink size={14}/></a></div></section>
      </div>
    </section>
  );
}
