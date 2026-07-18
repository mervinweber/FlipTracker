import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Download, ExternalLink, Pencil, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Listing = {
  _id: Id<'marketplaceListings'>;
  assetId: Id<'assets'>;
  platform: string;
  status: string;
  sku?: string;
  externalListingId?: string;
  listingUrl?: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  itemSpecifics?: string;
  listedPrice?: number;
  currentPrice?: number;
  soldPrice?: number;
  shippingCharged?: number;
  shippingCost?: number;
  fees?: number;
  listedDate?: string;
  soldDate?: string;
  buyer?: string;
  notes?: string;
  assetTitle: string;
  assetType?: string;
  purchasePrice?: number;
  storageLocation?: string;
  photoUrl?: string;
};

const PLATFORMS = ['eBay', 'Mercari', 'Facebook Marketplace', 'Vinted', 'OfferUp', 'Craigslist', 'Poshmark', 'Depop', 'Etsy', 'Amazon', 'Other'];
const STATUSES = ['Draft', 'Active', 'Pending', 'Sold', 'Expired', 'Relisted', 'Cancelled'];

type SalesTrackerImportItem = {
  title: string;
  description?: string;
  category?: string;
  condition: string;
  platforms: string[];
  listedPrice: number;
  currentPrice: number;
  soldPrice?: number;
  listedDate: string;
  soldDate?: string;
  status: string;
  sku?: string;
  notes?: string;
  imageUrl?: string;
  priceHistory: { date: string; price: number; reason?: string }[];
};

function money(value?: number) {
  return `$${(value || 0).toFixed(2)}`;
}

function dateToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysListed(listing: Listing) {
  if (!listing.listedDate) return '';
  const end = listing.soldDate ? Date.parse(`${listing.soldDate}T00:00:00`) : Date.now();
  const start = Date.parse(`${listing.listedDate}T00:00:00`);
  return `${Math.max(0, Math.floor((end - start) / 86_400_000))}d`;
}

function netProfit(listing: Listing) {
  return (listing.soldPrice || 0) + (listing.shippingCharged || 0) - (listing.purchasePrice || 0) - (listing.fees || 0) - (listing.shippingCost || 0);
}

function optionalNumber(value: string) {
  return value === '' ? undefined : Number(value);
}

function PriceHistory({ listingId }: { listingId: Id<'marketplaceListings'> }) {
  const history = useQuery(api.listings.priceHistory, { listingId });
  if (!history?.length) return <p className="compactText">No price changes recorded yet.</p>;
  return (
    <div className="priceHistory">
      {history.map((entry) => (
        <div key={entry._id}><strong>{money(entry.price)}</strong><span>{new Date(entry.date).toLocaleDateString()} · {entry.reason || 'Price updated'}</span></div>
      ))}
    </div>
  );
}

export default function ListingsPanel() {
  const listings = useQuery(api.listings.list) as Listing[] | undefined;
  const stats = useQuery(api.listings.stats);
  const updateListing = useMutation(api.listings.update);
  const removeListing = useMutation(api.listings.remove);
  const importSalesTracker = useMutation(api.listings.importSalesTracker);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [priceChangeReason, setPriceChangeReason] = useState('');

  useEffect(() => {
    if (!editing) return;
    document.body.classList.add('modalOpen');
    return () => document.body.classList.remove('modalOpen');
  }, [editing]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (listings || []).filter((listing) => {
      const matchesQuery = !normalized || `${listing.title} ${listing.assetTitle} ${listing.sku || ''} ${listing.externalListingId || ''}`.toLowerCase().includes(normalized);
      return matchesQuery && (status === 'All' || listing.status === status) && (platform === 'All' || listing.platform === platform);
    });
  }, [listings, platform, query, status]);

  function patchEditing(patch: Partial<Listing>) {
    setEditing((current) => current ? { ...current, ...patch } : current);
  }

  async function save() {
    if (!editing?.title.trim()) return;
    const soldDate = editing.status === 'Sold' ? editing.soldDate || dateToday() : editing.soldDate;
    const soldPrice = editing.status === 'Sold' ? editing.soldPrice ?? editing.currentPrice ?? editing.listedPrice : editing.soldPrice;
    await updateListing({
      id: editing._id,
      platform: editing.platform,
      status: editing.status,
      sku: editing.sku || undefined,
      externalListingId: editing.externalListingId || undefined,
      listingUrl: editing.listingUrl || undefined,
      title: editing.title.trim(),
      description: editing.description || undefined,
      category: editing.category || undefined,
      condition: editing.condition || undefined,
      itemSpecifics: editing.itemSpecifics || undefined,
      listedPrice: editing.listedPrice,
      currentPrice: editing.currentPrice,
      soldPrice,
      shippingCharged: editing.shippingCharged,
      shippingCost: editing.shippingCost,
      fees: editing.fees,
      listedDate: editing.status === 'Active' || editing.status === 'Sold' ? editing.listedDate || dateToday() : editing.listedDate,
      soldDate,
      buyer: editing.buyer || undefined,
      notes: editing.notes || undefined,
      priceChangeReason: priceChangeReason || undefined,
    });
    setEditing(null);
    setPriceChangeReason('');
  }

  async function remove(listing: Listing) {
    if (!confirm(`Delete the ${listing.platform} listing for ${listing.assetTitle}? The inventory item will remain.`)) return;
    await removeListing({ id: listing._id });
  }

  function exportCsv() {
    const headers = ['Platform', 'Title', 'SKU', 'Status', 'Listed Price', 'Current Price', 'Sold Price', 'Listed Date', 'Sold Date', 'Shipping Charged', 'Shipping Cost', 'Fees', 'Net Profit', 'URL'];
    const rows = filtered.map((listing) => [
      listing.platform, listing.title, listing.sku || '', listing.status, listing.listedPrice || '', listing.currentPrice || '', listing.soldPrice || '',
      listing.listedDate || '', listing.soldDate || '', listing.shippingCharged || '', listing.shippingCost || '', listing.fees || '',
      listing.status === 'Sold' ? netProfit(listing).toFixed(2) : '', listing.listingUrl || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fliptracker-listings-${dateToday()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importOldJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const parsed = JSON.parse(await file.text()) as SalesTrackerImportItem[];
    if (!Array.isArray(parsed) || parsed.some((item) => !item.title || !Array.isArray(item.platforms))) {
      alert('This does not look like a Sales Tracker JSON export.');
      return;
    }
    if (!confirm(`Import ${parsed.length} Sales Tracker record${parsed.length === 1 ? '' : 's'}? This creates new inventory items and does not deduplicate.`)) return;
    const result = await importSalesTracker({ items: parsed });
    alert(`Imported ${result.assetCount} inventory items and ${result.listingCount} marketplace listings.`);
  }

  return (
    <>
      <section className="cards listingCards">
        <div className="metric"><span>Drafts</span><strong>{stats?.draftCount ?? '-'}</strong></div>
        <div className="metric"><span>Active Listings</span><strong>{stats?.activeCount ?? '-'}</strong></div>
        <div className="metric"><span>Active Value</span><strong>{stats ? money(stats.activeValue) : '-'}</strong></div>
        <div className="metric"><span>Sold Revenue</span><strong>{stats ? money(stats.soldRevenue) : '-'}</strong></div>
        <div className="metric"><span>Avg. Days To Sell</span><strong>{stats ? stats.averageDaysToSell.toFixed(1) : '-'}</strong></div>
      </section>

      <section className="panel listingControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search listings..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>{['All', ...STATUSES].map((value) => <option key={value}>{value}</option>)}</select>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)}>{['All', ...PLATFORMS].map((value) => <option key={value}>{value}</option>)}</select>
        <div className="actions listingTools"><label className="button secondary"><Upload size={16}/> Import Old JSON<input type="file" accept="application/json,.json" hidden onChange={importOldJson}/></label><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div>
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader"><div><h2>Marketplace Listings</h2><p>{listings === undefined ? 'Loading Convex data...' : `${filtered.length} listing${filtered.length === 1 ? '' : 's'} in this view`}</p></div></div>
        {listings === undefined ? <p className="panelMessage">Loading listings...</p> : filtered.length === 0 ? <div className="empty"><h2>No listings found</h2><p>Create a draft from an item in Inventory, then track it through sale.</p></div> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Platform</th><th>Title</th><th>Status</th><th>Price</th><th>Listed</th><th>Location</th><th>Net</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((listing) => (
                <tr key={listing._id}>
                  <td><span className="consoleTag">{listing.platform}</span></td>
                  <td><strong>{listing.title}</strong><small>{listing.assetTitle}{listing.sku ? ` · SKU ${listing.sku}` : ''}</small></td>
                  <td><span className={`badge ${listing.status.toLowerCase()}`}>{listing.status}</span></td>
                  <td className="valueCell">{money(listing.status === 'Sold' ? listing.soldPrice : listing.currentPrice ?? listing.listedPrice)}</td>
                  <td>{listing.listedDate || ''}<small>{daysListed(listing)}</small></td>
                  <td>{listing.storageLocation || ''}</td>
                  <td className={listing.status === 'Sold' && netProfit(listing) >= 0 ? 'profitValue' : ''}>{listing.status === 'Sold' ? money(netProfit(listing)) : ''}</td>
                  <td className="rowActions">
                    <button className="iconButton" aria-label={`Edit ${listing.title}`} title="Edit listing" onClick={() => setEditing(listing)}><Pencil size={15}/></button>
                    {listing.listingUrl ? <a className="button iconButton secondary" href={listing.listingUrl} target="_blank" rel="noreferrer" aria-label="Open marketplace listing" title="Open marketplace listing"><ExternalLink size={15}/></a> : null}
                    <button className="danger iconButton" aria-label={`Delete ${listing.title}`} title="Delete listing" onClick={() => remove(listing)}><Trash2 size={15}/></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? (
        <div className="modalBackdrop"><section className="modal wideModal">
          <header className="modalHeader"><div><h2>Edit Marketplace Listing</h2><span className="statusPill">{editing.assetTitle}</span></div><button className="iconButton secondary" aria-label="Close" onClick={() => setEditing(null)}><X size={18}/></button></header>
          <div className="formGrid">
            <label>Platform<select value={editing.platform} onChange={(event) => patchEditing({ platform: event.target.value })}>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={editing.status} onChange={(event) => patchEditing({ status: event.target.value })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="span2">Listing Title<input value={editing.title} onChange={(event) => patchEditing({ title: event.target.value })}/></label>
            <label>SKU<input value={editing.sku || ''} onChange={(event) => patchEditing({ sku: event.target.value })}/></label>
            <label>Marketplace Item ID<input value={editing.externalListingId || ''} onChange={(event) => patchEditing({ externalListingId: event.target.value })}/></label>
            <label className="span2">Listing URL<input type="url" value={editing.listingUrl || ''} onChange={(event) => patchEditing({ listingUrl: event.target.value })}/></label>
            <label>Category<input value={editing.category || ''} onChange={(event) => patchEditing({ category: event.target.value })}/></label>
            <label>Condition<input value={editing.condition || ''} onChange={(event) => patchEditing({ condition: event.target.value })}/></label>
            <div className="formSection span2"><h3>Pricing & Dates</h3><div className="sectionGrid">
              <label>Original Price<input type="number" step="0.01" value={editing.listedPrice ?? ''} onChange={(event) => patchEditing({ listedPrice: optionalNumber(event.target.value) })}/></label>
              <label>Current Price<input type="number" step="0.01" value={editing.currentPrice ?? ''} onChange={(event) => patchEditing({ currentPrice: optionalNumber(event.target.value) })}/></label>
              <label>Price Change Reason<input value={priceChangeReason} onChange={(event) => setPriceChangeReason(event.target.value)} placeholder="Sale, markdown, relist..."/></label>
              <label>Listed Date<input type="date" value={editing.listedDate || ''} onChange={(event) => patchEditing({ listedDate: event.target.value })}/></label>
              <label>Sold Price<input type="number" step="0.01" value={editing.soldPrice ?? ''} onChange={(event) => patchEditing({ soldPrice: optionalNumber(event.target.value) })}/></label>
              <label>Sold Date<input type="date" value={editing.soldDate || ''} onChange={(event) => patchEditing({ soldDate: event.target.value })}/></label>
              <label>Shipping Charged<input type="number" step="0.01" value={editing.shippingCharged ?? ''} onChange={(event) => patchEditing({ shippingCharged: optionalNumber(event.target.value) })}/></label>
              <label>Actual Shipping Cost<input type="number" step="0.01" value={editing.shippingCost ?? ''} onChange={(event) => patchEditing({ shippingCost: optionalNumber(event.target.value) })}/></label>
              <label>Marketplace Fees<input type="number" step="0.01" value={editing.fees ?? ''} onChange={(event) => patchEditing({ fees: optionalNumber(event.target.value) })}/></label>
              <label>Buyer<input value={editing.buyer || ''} onChange={(event) => patchEditing({ buyer: event.target.value })}/></label>
            </div></div>
            <label className="span2">Item Specifics<textarea value={editing.itemSpecifics || ''} onChange={(event) => patchEditing({ itemSpecifics: event.target.value })}/></label>
            <label className="span2">Description<textarea value={editing.description || ''} onChange={(event) => patchEditing({ description: event.target.value })}/></label>
            <label className="span2">Notes<textarea value={editing.notes || ''} onChange={(event) => patchEditing({ notes: event.target.value })}/></label>
            <div className="formSection span2"><h3>Price History</h3><PriceHistory listingId={editing._id}/></div>
          </div>
          <div className="actions right"><button className="secondary" onClick={() => setEditing(null)}>Cancel</button><button onClick={save}><Save size={16}/> Save Listing</button></div>
        </section></div>
      ) : null}
    </>
  );
}
