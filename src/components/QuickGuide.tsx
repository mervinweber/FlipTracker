import { Barcode, Box, CircleDollarSign, ExternalLink, FileText, Gauge, Keyboard, LayoutList, Search, ShoppingBag } from 'lucide-react';

const steps = [
  { icon: Barcode, label: 'Scan', detail: 'Capture the UPC, EAN, or ISBN.' },
  { icon: Search, label: 'Review', detail: 'Confirm the exact title and edition.' },
  { icon: Box, label: 'Store', detail: 'Record condition, completeness, and bin.' },
  { icon: LayoutList, label: 'List', detail: 'Prepare and track the marketplace listing.' },
  { icon: CircleDollarSign, label: 'Sell', detail: 'Record fees, shipping, and profit.' },
];

export default function QuickGuide() {
  return (
    <section className="guidePage">
      <header className="guideHeader">
        <div><p className="eyebrow">Quick start</p><h2>Using FlipTracker</h2><p>Move an item from barcode scan to inventory, marketplace listing, and completed sale.</p></div>
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
          <li>Leave <strong>Create eBay draft</strong> enabled, then scan each UPC. Most USB scanners type the code and press Enter automatically.</li>
          <li>Continue scanning while the queue processes. Every physical copy receives its own inventory record and unique SKU.</li>
          <li>Review amber rows before publishing, then open Listings to finish pricing and photos.</li>
        </ol><p className="guideNote"><Keyboard size={15}/> Configure the scanner suffix as Enter or Tab. Direct eBay publishing requires the future secure seller connection.</p></div></section>

        <section><div className="guideNumber">3</div><div><h3>Make a sourcing decision</h3><ol>
          <li>Open <strong>Sourcing</strong> and select <strong>New Analysis</strong>.</li>
          <li>Enter the exact title, edition, condition, purchase cost, active listing count, and 90-day sold count.</li>
          <li>Enter several comparable sold prices, including shipping when it was charged separately.</li>
          <li>Review median price, expected profit, ROI, sell-through, estimated days to sell, rarity, liquidity, and confidence.</li>
          <li>Treat Buy, Maybe, or Pass as a decision aid and verify the exact item on eBay before purchasing.</li>
        </ol><p className="guideNote"><Gauge size={15}/> Rarity means low supply. Liquidity means likely speed of sale. A rare item can still be slow and uncertain.</p></div></section>

        <section><div className="guideNumber">4</div><div><h3>Research the value</h3><ol>
          <li>From Inventory, select <strong>Research</strong> to open an eBay sold/completed-items search.</li>
          <li>Compare the same format, edition, region, condition, and completeness.</li>
          <li>Select <strong>Log Value</strong> to save the observed low/high range, source, confidence, URL, and notes.</li>
          <li>Use User Low and User High when your research should override the estimate.</li>
        </ol><p className="guideNote">Changing the title, UPC, edition, condition, or completeness marks the item for another value check.</p></div></section>

        <section><div className="guideNumber">5</div><div><h3>Create the listing draft</h3><ol>
          <li>Find the item in Inventory and select <strong>Draft</strong>.</li>
          <li>FlipTracker creates an internal eBay draft using the prepared title, description, category, condition, item specifics, and price.</li>
          <li>Open <strong>Listings</strong>, edit the draft, and verify every field before posting.</li>
          <li>Add an SKU when useful; the storage location remains visible for fulfillment.</li>
        </ol></div></section>

        <section><div className="guideNumber">6</div><div><h3>Post it to eBay</h3><ol>
          <li>Open eBay Seller Hub and start a new listing.</li>
          <li>Copy the prepared title, description, category, condition, item specifics, price, and shipping plan from the FlipTracker draft.</li>
          <li>Upload and review the actual item photos, then publish through eBay.</li>
          <li>Return to FlipTracker and enter the eBay item ID and listing URL.</li>
          <li>Change the status to <strong>Active</strong> and confirm the listed date and current price.</li>
        </ol><p className="guideNote"><ShoppingBag size={15}/> FlipTracker does not publish directly to eBay yet. eBay OAuth and draft creation are planned after the internal workflow is stable.</p></div></section>

        <section><div className="guideNumber">7</div><div><h3>Track price changes and the sale</h3><ol>
          <li>Edit Current Price whenever a listing is reduced and enter a reason. FlipTracker preserves the price history.</li>
          <li>When sold, change the listing status to <strong>Sold</strong>.</li>
          <li>Enter sold price, shipping charged, actual shipping cost, marketplace fees, buyer, and sold date.</li>
          <li>Save the listing. FlipTracker updates inventory status, sales history, revenue, and net profit.</li>
        </ol></div></section>

        <section><div className="guideNumber">8</div><div><h3>Back up and migrate data</h3><ol>
          <li>Use <strong>Export Excel</strong> from Inventory for an inventory backup.</li>
          <li>Use <strong>Export CSV</strong> from Listings for listing and sales records.</li>
          <li>Use <strong>Import Old JSON</strong> only for a Sales Tracker JSON export. It creates new records and does not deduplicate.</li>
        </ol><a className="guideLink" href="/README.md" target="_blank" rel="noreferrer">Open the hosted README <ExternalLink size={14}/></a></div></section>
      </div>
    </section>
  );
}
