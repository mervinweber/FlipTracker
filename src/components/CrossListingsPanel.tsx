import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { BadgeDollarSign, CheckCircle2, Copy, Download, ExternalLink, FolderPlus, Link as LinkIcon, PackageSearch, RefreshCw, Save, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  buildCrossListDescription,
  buildCrossListClipboardPack,
  buildDepopCsv,
  CROSS_LIST_CATEGORY_OPTIONS,
  CROSS_LIST_PLATFORMS,
  CROSS_LIST_STATUSES,
  defaultCrossListCategory,
  downloadText,
  normalizeCrossListCondition,
  publicCrossListPhotoUrls,
  crossListTitleLimit,
} from '../utils/crossListHandoff';

type CrossListing = {
  _id: Id<'crossListings'>;
  assetId: Id<'assets'>;
  sourceType?: string;
  sourceListingId?: Id<'marketplaceListings'>;
  sourcePlatform?: string;
  sourceStatus?: string;
  sourceSnapshotJson?: string;
  handoffStatus?: string;
  handoffNotes?: string;
  lastPreparedAt?: number;
  platform: string;
  status: string;
  title: string;
  description?: string;
  listingUrl?: string;
  externalListingId?: string;
  sku?: string;
  category?: string;
  platformCategory?: string;
  condition?: string;
  price?: number;
  shippingPrice?: number;
  fees?: number;
  soldPrice?: number;
  soldAt?: number;
  saleChannelDetail?: string;
  notes?: string;
  assetTitle: string;
  assetType?: string;
  assetStatus?: string;
  assetLocation?: string;
  assetBarcode?: string;
  assetPhotoUrl?: string;
  photoCount?: number;
  photoUrls?: string[];
  sourceListingTitle?: string;
  sourceExternalListingId?: string;
  sourceListingUrl?: string;
};

type AssetOption = {
  _id: Id<'assets'>;
  title: string;
  type: string;
  mediaFormat?: string;
  status?: string;
  storageLocation?: string;
};

type SourceListingOption = {
  _id: Id<'marketplaceListings'>;
  platform: string;
  status: string;
  title: string;
  currentPrice?: number;
  listedPrice?: number;
  sku?: string;
  externalListingId?: string;
  assetTitle?: string;
  assetType?: string;
  mediaFormat?: string;
  bundleCount?: number;
};

type EditDraft = {
  id: Id<'crossListings'>;
  platform: string;
  assetType?: string;
  title: string;
  description: string;
  platformCategory: string;
  condition: string;
  price: string;
  shippingPrice: string;
  listingUrl: string;
  externalListingId: string;
  sku: string;
  notes: string;
};

type SoldDraft = {
  id: Id<'crossListings'>;
  title: string;
  sourceType?: string;
  sourcePlatform?: string;
  sourceStatus?: string;
  soldPrice: string;
  fees: string;
  shippingPrice: string;
  soldAt: string;
  saleChannelDetail: string;
  notes: string;
};

type ListedDraft = {
  id: Id<'crossListings'>;
  title: string;
  listingUrl: string;
  externalListingId: string;
  notes: string;
};

function money(value?: number) {
  return value === undefined ? '' : `$${value.toFixed(2)}`;
}

function sourceLabel(row: CrossListing) {
  if (row.sourceType === 'ebayBundle') return 'eBay Bundle';
  if (row.sourceType === 'ebayListing') return 'eBay Listing';
  return 'Inventory';
}

function badgeClass(value?: string) {
  return `badge ${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function rowNeeds(row: CrossListing) {
  const needs: string[] = [];
  if (!row.title?.trim()) needs.push('title');
  if (row.title && row.title.length > crossListTitleLimit(row.platform)) needs.push('shorter title');
  if (!row.price || row.price <= 0) needs.push('price');
  if (!row.description?.trim()) needs.push('description');
  if (!publicCrossListPhotoUrls(row.photoUrls).length) needs.push('public photo');
  return needs;
}

function sellUrl(platform: string) {
  if (platform === 'Mercari') return 'https://www.mercari.com/sell/';
  if (platform === 'Depop') return 'https://www.depop.com/sellinghub/bulklisting/';
  if (platform === 'Vinted') return 'https://www.vinted.com/items/new';
  return '';
}

async function copyText(text: string, label: string, setMessage: (message: string) => void) {
  await navigator.clipboard.writeText(text || '');
  setMessage(`${label} copied.`);
}

export default function CrossListingsPanel() {
  const rows = useQuery(api.crossListings.list) as CrossListing[] | undefined;
  const assets = useQuery(api.assets.list, {}) as AssetOption[] | undefined;
  const sourceListings = useQuery(api.crossListings.sourceListings) as SourceListingOption[] | undefined;
  const createFromAsset = useMutation(api.crossListings.createFromAsset);
  const createFromMarketplaceListing = useMutation(api.crossListings.createFromMarketplaceListing);
  const updateCrossListing = useMutation(api.crossListings.update);
  const removeCrossListing = useMutation(api.crossListings.remove);
  const markSold = useMutation(api.crossListings.markSold);
  const prepareHandoff = useMutation(api.crossListings.prepareHandoff);

  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'crossListings'>>>(new Set());
  const [sourceMode, setSourceMode] = useState<'asset' | 'listing' | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [sourceListingId, setSourceListingId] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('Mercari');
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [soldDraft, setSoldDraft] = useState<SoldDraft | null>(null);
  const [listedDraft, setListedDraft] = useState<ListedDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    return (rows || []).filter((row) => {
      const haystack = [row.title, row.assetTitle, row.assetBarcode, row.platform, row.status, row.platformCategory, row.sku, row.sourceExternalListingId, row.notes].filter(Boolean).join(' ').toLowerCase();
      if (platformFilter !== 'All' && row.platform !== platformFilter) return false;
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (sourceFilter !== 'All' && sourceLabel(row) !== sourceFilter) return false;
      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [platformFilter, rows, search, sourceFilter, statusFilter]);

  const selectedRows = useMemo(() => filtered.filter((row) => selectedIds.has(row._id)), [filtered, selectedIds]);
  const depopReady = selectedRows.filter((row) => row.platform === 'Depop');
  const dashboard = useMemo(() => {
    const base = rows || [];
    const needsPhotos = base.filter((row) => row.status === 'Needs Review' && rowNeeds(row).includes('public photo')).length;
    return {
      total: base.length,
      ready: base.filter((row) => row.status === 'Ready').length,
      needsReview: base.filter((row) => row.status === 'Needs Review').length,
      needsPhotos,
      needsPrice: base.filter((row) => row.status === 'Needs Review' && rowNeeds(row).includes('price')).length,
      listed: base.filter((row) => row.status === 'Listed').length,
      sold: base.filter((row) => row.status === 'Sold').length,
    };
  }, [rows]);

  function toggleSelected(id: Id<'crossListings'>) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleViewSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = filtered.length > 0 && filtered.every((row) => next.has(row._id));
      if (allSelected) filtered.forEach((row) => next.delete(row._id));
      else filtered.forEach((row) => next.add(row._id));
      return next;
    });
  }

  async function createSourceListing() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (sourceMode === 'asset') {
        if (!sourceAssetId) throw new Error('Choose an inventory item.');
        await createFromAsset({ assetId: sourceAssetId as Id<'assets'>, platform: sourcePlatform });
      } else {
        if (!sourceListingId) throw new Error('Choose an eBay listing.');
        await createFromMarketplaceListing({ listingId: sourceListingId as Id<'marketplaceListings'>, platform: sourcePlatform });
      }
      setSourceMode(null);
      setSourceAssetId('');
      setSourceListingId('');
      setMessage(`${sourcePlatform} cross-list row created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create cross-list row.');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: CrossListing) {
    setEditDraft({
      id: row._id,
      platform: row.platform,
      assetType: row.assetType || row.category,
      title: row.title,
      description: row.description || '',
      platformCategory: row.platformCategory || defaultCrossListCategory(row.platform, row.assetType),
      condition: row.condition || normalizeCrossListCondition(undefined, row.assetType),
      price: row.price?.toFixed(2) || '',
      shippingPrice: row.shippingPrice?.toFixed(2) || '',
      listingUrl: row.listingUrl || '',
      externalListingId: row.externalListingId || '',
      sku: row.sku || '',
      notes: row.notes || '',
    });
    setError('');
  }

  async function saveEdit() {
    if (!editDraft) return;
    setBusy(true);
    setError('');
    try {
      await updateCrossListing({
        id: editDraft.id,
        title: editDraft.title.trim(),
        description: editDraft.description.trim() || undefined,
        platformCategory: editDraft.platformCategory || undefined,
        condition: editDraft.condition.trim() || undefined,
        price: editDraft.price.trim() ? Number(editDraft.price) : undefined,
        shippingPrice: editDraft.shippingPrice.trim() ? Number(editDraft.shippingPrice) : undefined,
        listingUrl: editDraft.listingUrl.trim() || undefined,
        externalListingId: editDraft.externalListingId.trim() || undefined,
        sku: editDraft.sku.trim() || undefined,
        notes: editDraft.notes.trim() || undefined,
      });
      setEditDraft(null);
      setMessage('Cross-list row saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save row.');
    } finally {
      setBusy(false);
    }
  }

  function openSold(row: CrossListing) {
    setSoldDraft({
      id: row._id,
      title: row.title,
      sourceType: row.sourceType,
      sourcePlatform: row.sourcePlatform,
      sourceStatus: row.sourceStatus,
      soldPrice: row.soldPrice?.toFixed(2) || row.price?.toFixed(2) || '',
      fees: row.fees?.toFixed(2) || '',
      shippingPrice: row.shippingPrice?.toFixed(2) || '',
      soldAt: row.soldAt ? new Date(row.soldAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      saleChannelDetail: row.saleChannelDetail || row.platform,
      notes: row.notes || '',
    });
    setError('');
  }

  async function saveSold() {
    if (!soldDraft) return;
    const soldPrice = Number(soldDraft.soldPrice);
    if (!Number.isFinite(soldPrice) || soldPrice < 0) return setError('Enter a valid sold price.');
    setBusy(true);
    setError('');
    try {
      await markSold({
        id: soldDraft.id,
        soldPrice,
        soldAt: soldDraft.soldAt ? new Date(`${soldDraft.soldAt}T12:00:00`).getTime() : undefined,
        fees: soldDraft.fees.trim() ? Number(soldDraft.fees) : undefined,
        shippingPrice: soldDraft.shippingPrice.trim() ? Number(soldDraft.shippingPrice) : undefined,
        saleChannelDetail: soldDraft.saleChannelDetail.trim() || undefined,
        notes: soldDraft.notes.trim() || undefined,
        closeSource: true,
      });
      setSoldDraft(null);
      setMessage('Sold record saved. If the source eBay listing was active, it is flagged to end on eBay.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark sold.');
    } finally {
      setBusy(false);
    }
  }

  function openListed(row: CrossListing) {
    setListedDraft({
      id: row._id,
      title: row.title,
      listingUrl: row.listingUrl || '',
      externalListingId: row.externalListingId || '',
      notes: row.notes || '',
    });
    setError('');
  }

  async function saveListed() {
    if (!listedDraft) return;
    setBusy(true);
    setError('');
    try {
      await updateCrossListing({
        id: listedDraft.id,
        status: 'Listed',
        listedAt: Date.now(),
        handoffStatus: 'Listed',
        listingUrl: listedDraft.listingUrl.trim() || undefined,
        externalListingId: listedDraft.externalListingId.trim() || undefined,
        notes: listedDraft.notes.trim() || undefined,
      });
      setListedDraft(null);
      setMessage('Marketplace listing logged.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log marketplace listing.');
    } finally {
      setBusy(false);
    }
  }

  async function prepareSelected() {
    if (!selectedIds.size) return;
    await prepareHandoff({ ids: [...selectedIds] });
    setMessage(`${selectedIds.size} row${selectedIds.size === 1 ? '' : 's'} prepared for marketplace handoff.`);
  }

  function exportDepopCsv() {
    if (!depopReady.length) return setError('Select at least one Depop row first.');
    const csv = buildDepopCsv(depopReady.map((row) => ({
      title: row.title,
      description: row.description,
      type: row.assetType || row.category,
      condition: row.condition,
      price: row.price,
      sku: row.sku,
      barcode: row.assetBarcode,
      photoUrls: row.photoUrls,
      platformCategory: row.platformCategory,
      notes: row.notes,
    })));
    downloadText(`fliptracker-depop-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setMessage(`Exported ${depopReady.length} Depop row${depopReady.length === 1 ? '' : 's'}.`);
  }

  function copyPack(row: CrossListing) {
    return copyText(buildCrossListClipboardPack({
      platform: row.platform,
      title: row.title,
      description: row.description,
      type: row.assetType || row.category,
      condition: row.condition,
      price: row.price,
      sku: row.sku,
      barcode: row.assetBarcode,
      platformCategory: row.platformCategory,
      notes: row.notes,
    }), `${row.platform} handoff pack`, setMessage);
  }

  async function deleteRow(row: CrossListing) {
    if (!window.confirm(`Delete ${row.title}? This only removes the cross-list row.`)) return;
    await removeCrossListing({ id: row._id });
  }

  return (
    <section className="crossListingsPage">
      <header className="panel crossListingsHeader">
        <div>
          <p className="eyebrow">Marketplace handoff</p>
          <h2>Cross-List Queue</h2>
          <p>Create marketplace-ready rows from inventory or eBay listings, then copy, export, open the selling page, or log the live URL.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setSourceMode('asset')}><PackageSearch size={16}/> From Inventory</button>
          <button className="secondary" onClick={() => setSourceMode('listing')}><FolderPlus size={16}/> From eBay Listing</button>
          <button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/> Refresh</button>
        </div>
      </header>

      <section className="panel controls crossListingsControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search title, SKU, UPC, source ID..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option>All</option>{CROSS_LIST_PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{CROSS_LIST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All</option><option>Inventory</option><option>eBay Listing</option><option>eBay Bundle</option></select>
      </section>

      <section className="crossListDashboard" aria-label="Cross-list status dashboard">
        <button onClick={() => setStatusFilter('All')}><span>Total</span><strong>{dashboard.total}</strong></button>
        <button className="ready" onClick={() => setStatusFilter('Ready')}><span>Ready</span><strong>{dashboard.ready}</strong></button>
        <button className="attention" onClick={() => setStatusFilter('Needs Review')}><span>Needs Review</span><strong>{dashboard.needsReview}</strong></button>
        <button className={dashboard.needsPhotos ? 'attention' : ''} onClick={() => setStatusFilter('Needs Review')}><span>Needs Photos</span><strong>{dashboard.needsPhotos}</strong></button>
        <button className={dashboard.needsPrice ? 'attention' : ''} onClick={() => setStatusFilter('Needs Review')}><span>Needs Price</span><strong>{dashboard.needsPrice}</strong></button>
        <button onClick={() => setStatusFilter('Listed')}><span>Listed</span><strong>{dashboard.listed}</strong></button>
        <button onClick={() => setStatusFilter('Sold')}><span>Sold</span><strong>{dashboard.sold}</strong></button>
      </section>

      <section className="queueCommandBar crossListCommandBar">
        <span className="queueCommandStatus">{filtered.length} in view · {selectedIds.size} selected</span>
        <div className="actions">
          <button className="secondary" disabled={!filtered.length} onClick={toggleViewSelection}>{filtered.length && filtered.every((row) => selectedIds.has(row._id)) ? 'Clear View' : 'Select View'}</button>
          <button disabled={!selectedIds.size} onClick={prepareSelected}><CheckCircle2 size={16}/> Prepare</button>
          <button className="secondary" disabled={!depopReady.length} onClick={exportDepopCsv}><Download size={16}/> Depop CSV</button>
        </div>
      </section>
      {message ? <p className="setupNotice successNotice">{message}</p> : null}
      {error ? <p className="setupNotice errorNotice">{error}</p> : null}

      <section className="panel inventoryPanel">
        {!rows ? <p>Loading cross-list rows...</p> : filtered.length === 0 ? <div className="empty"><h2>No cross-list rows in this view</h2><p>Create from Inventory or from an existing eBay listing.</p></div> : (
          <div className="tableWrap">
            <table className="crossListingsTable">
              <thead>
                <tr><th className="selectionCell">Select</th><th>Platform</th><th>Item</th><th>Source</th><th>Status</th><th>Price</th><th>Handoff</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row._id}>
                    <td className="selectionCell"><input type="checkbox" checked={selectedIds.has(row._id)} onChange={() => toggleSelected(row._id)} aria-label={`Select ${row.title}`}/></td>
                    <td><span className="consoleTag">{row.platform}</span></td>
                    <td className="listingIdentityCell"><strong>{row.title}</strong><small>{row.assetTitle}{row.assetBarcode ? ` · ${row.assetBarcode}` : ''}{row.photoCount ? ` · ${row.photoCount} photo${row.photoCount === 1 ? '' : 's'}` : ' · photos needed'}</small></td>
                    <td><span className="statusPill">{sourceLabel(row)}</span><small>{row.sourceExternalListingId ? `eBay ${row.sourceExternalListingId}` : row.sourceStatus || row.assetStatus || ''}</small></td>
                    <td><span className={badgeClass(row.status)}>{row.status}</span>{row.status === 'Needs Review' ? <small className="warningText">{row.handoffNotes || `Needs ${rowNeeds(row).join(', ') || 'review'}`}</small> : null}</td>
                    <td>{row.soldPrice !== undefined ? money(row.soldPrice) : money(row.price)}{row.shippingPrice !== undefined ? <small>Ship {money(row.shippingPrice)}</small> : null}</td>
                    <td><strong>{row.platformCategory || defaultCrossListCategory(row.platform, row.assetType || row.category)}</strong><small>{row.handoffStatus || 'Not prepared'}{row.lastPreparedAt ? ` · ${new Date(row.lastPreparedAt).toLocaleDateString()}` : ''}</small></td>
                    <td className="tableActionsCell"><div className="rowActions">
                      <button onClick={() => openEdit(row)}><Save size={14}/> Review</button>
                      <button className="secondary" onClick={() => copyPack(row)}><Copy size={14}/> Copy Pack</button>
                      <button className="secondary" onClick={() => copyText(row.title, 'Title', setMessage)}><Copy size={14}/> Title</button>
                      <button className="secondary" onClick={() => copyText(buildCrossListDescription({ description: row.description, barcode: row.assetBarcode, notes: row.notes }), 'Description', setMessage)}><Copy size={14}/> Desc</button>
                      <button className="secondary" onClick={() => copyText(row.price !== undefined ? row.price.toFixed(2) : '', 'Price', setMessage)}><Copy size={14}/> Price</button>
                      <button className="secondary" onClick={() => copyText(row.sku || row.assetBarcode || '', 'SKU', setMessage)}><Copy size={14}/> SKU</button>
                      {sellUrl(row.platform) ? <a className="button secondary" href={sellUrl(row.platform)} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Sell</a> : null}
                      {row.listingUrl ? <a className="button secondary" href={row.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Live</a> : null}
                      {row.status !== 'Listed' ? <button className="secondary" onClick={() => openListed(row)}><LinkIcon size={14}/> Listed</button> : null}
                      {row.status !== 'Sold' ? <button className="secondary" onClick={() => openSold(row)}><BadgeDollarSign size={14}/> Sold</button> : null}
                      <button className="danger iconButton" aria-label={`Delete ${row.title}`} onClick={() => deleteRow(row)}><Trash2 size={14}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sourceMode ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal">
            <header className="modalHeader"><div><h2>{sourceMode === 'asset' ? 'Create from Inventory' : 'Create from eBay Listing'}</h2><p>Creates one prepared marketplace row. eBay bundles stay bundled.</p></div><button className="iconButton secondary" onClick={() => setSourceMode(null)} aria-label="Close source picker"><X size={18}/></button></header>
            <div className="formGrid">
              <label>Marketplace<select value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value)}>{CROSS_LIST_PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
              {sourceMode === 'asset' ? (
                <label className="span2">Inventory Item<select value={sourceAssetId} onChange={(event) => setSourceAssetId(event.target.value)}><option value="">Choose inventory item</option>{(assets || []).map((asset) => <option key={asset._id} value={asset._id}>{asset.title}{asset.storageLocation ? ` · ${asset.storageLocation}` : ''}</option>)}</select></label>
              ) : (
                <label className="span2">eBay Listing<select value={sourceListingId} onChange={(event) => setSourceListingId(event.target.value)}><option value="">Choose listing</option>{(sourceListings || []).filter((listing) => listing.platform === 'eBay').map((listing) => <option key={listing._id} value={listing._id}>{listing.title}{listing.bundleCount && listing.bundleCount > 1 ? ` · ${listing.bundleCount}-item bundle` : ''}{listing.currentPrice || listing.listedPrice ? ` · ${money(listing.currentPrice || listing.listedPrice)}` : ''}</option>)}</select></label>
              )}
            </div>
            <div className="actions right"><button className="secondary" onClick={() => setSourceMode(null)}>Cancel</button><button disabled={busy} onClick={createSourceListing}><ShoppingBag size={16}/>{busy ? 'Creating...' : 'Create Cross-List Row'}</button></div>
          </section>
        </div>
      ) : null}

      {editDraft ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal">
            <header className="modalHeader"><div><h2>Review Cross-List Row</h2><p>Adjust the marketplace-facing details before handoff.</p></div><button className="iconButton secondary" onClick={() => setEditDraft(null)} aria-label="Close editor"><X size={18}/></button></header>
            <div className="formGrid">
              <div className="crossListPreview span2">
                <div><span>Title</span><strong>{editDraft.title || 'Untitled'}</strong><small>{editDraft.title.length}/{crossListTitleLimit(editDraft.platform)} characters</small></div>
                <div><span>Price</span><strong>{editDraft.price ? money(Number(editDraft.price)) : 'No price'}</strong><small>{editDraft.platformCategory || defaultCrossListCategory(editDraft.platform, editDraft.assetType)}</small></div>
                <p>{buildCrossListDescription({ description: editDraft.description, notes: editDraft.notes }).slice(0, 260) || 'No description yet.'}</p>
              </div>
              <label className="span2">Title<input value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}/></label>
              <label className="span2">Description<textarea value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}/></label>
              <label>Category<select value={editDraft.platformCategory} onChange={(event) => setEditDraft({ ...editDraft, platformCategory: event.target.value })}><option value="">Choose category</option>{(CROSS_LIST_CATEGORY_OPTIONS[editDraft.platform as keyof typeof CROSS_LIST_CATEGORY_OPTIONS] || []).map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Condition<input value={editDraft.condition} onChange={(event) => setEditDraft({ ...editDraft, condition: event.target.value })}/></label>
              <label>Price<input type="number" inputMode="decimal" value={editDraft.price} onChange={(event) => setEditDraft({ ...editDraft, price: event.target.value })}/></label>
              <label>Shipping<input type="number" inputMode="decimal" value={editDraft.shippingPrice} onChange={(event) => setEditDraft({ ...editDraft, shippingPrice: event.target.value })}/></label>
              <label>SKU<input value={editDraft.sku} onChange={(event) => setEditDraft({ ...editDraft, sku: event.target.value })}/></label>
              <label>Listing URL<input value={editDraft.listingUrl} onChange={(event) => setEditDraft({ ...editDraft, listingUrl: event.target.value })}/></label>
              <label>External ID<input value={editDraft.externalListingId} onChange={(event) => setEditDraft({ ...editDraft, externalListingId: event.target.value })}/></label>
              <label className="span2">Notes<textarea value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })}/></label>
            </div>
            <div className="actions right"><button className="secondary" onClick={() => setEditDraft(null)}>Cancel</button><button disabled={busy} onClick={saveEdit}><Save size={16}/>{busy ? 'Saving...' : 'Save Row'}</button></div>
          </section>
        </div>
      ) : null}

      {listedDraft ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal soldListingModal">
            <header className="modalHeader"><div><h2>Log Marketplace Listing</h2><p>{listedDraft.title}</p></div><button className="iconButton secondary" onClick={() => setListedDraft(null)} aria-label="Close listed editor"><X size={18}/></button></header>
            <div className="formGrid">
              <label className="span2">Listing URL<input value={listedDraft.listingUrl} onChange={(event) => setListedDraft({ ...listedDraft, listingUrl: event.target.value })} placeholder="Paste the marketplace listing link"/></label>
              <label>External ID<input value={listedDraft.externalListingId} onChange={(event) => setListedDraft({ ...listedDraft, externalListingId: event.target.value })} placeholder="Optional marketplace ID"/></label>
              <label className="span2">Notes<textarea value={listedDraft.notes} onChange={(event) => setListedDraft({ ...listedDraft, notes: event.target.value })} placeholder="Any handoff notes, buyer-facing changes, or marketplace-specific details"/></label>
            </div>
            <div className="actions right"><button className="secondary" onClick={() => setListedDraft(null)}>Cancel</button><button disabled={busy} onClick={saveListed}><LinkIcon size={16}/>{busy ? 'Saving...' : 'Mark Listed'}</button></div>
          </section>
        </div>
      ) : null}

      {soldDraft ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal soldListingModal">
            <header className="modalHeader"><div><h2>Mark Sold</h2><p>{soldDraft.title}</p></div><button className="iconButton secondary" onClick={() => setSoldDraft(null)} aria-label="Close sold editor"><X size={18}/></button></header>
            <div className="formGrid">
              <label>Sold Price<input type="number" inputMode="decimal" value={soldDraft.soldPrice} onChange={(event) => setSoldDraft({ ...soldDraft, soldPrice: event.target.value })}/></label>
              <label>Sold At<input type="date" value={soldDraft.soldAt} onChange={(event) => setSoldDraft({ ...soldDraft, soldAt: event.target.value })}/></label>
              <label>Channel<input value={soldDraft.saleChannelDetail} onChange={(event) => setSoldDraft({ ...soldDraft, saleChannelDetail: event.target.value })}/></label>
              <label>Fees<input type="number" inputMode="decimal" value={soldDraft.fees} onChange={(event) => setSoldDraft({ ...soldDraft, fees: event.target.value })}/></label>
              <label>Shipping<input type="number" inputMode="decimal" value={soldDraft.shippingPrice} onChange={(event) => setSoldDraft({ ...soldDraft, shippingPrice: event.target.value })}/></label>
              <label className="span2">Notes<textarea value={soldDraft.notes} onChange={(event) => setSoldDraft({ ...soldDraft, notes: event.target.value })}/></label>
            </div>
            <p className="setupNotice warningNotice">
              {soldDraft.sourceType === 'ebayBundle' ? 'This closes every item in the bundle and splits the sale amount across the member records. ' : ''}
              This also closes the linked inventory record.
              {soldDraft.sourcePlatform === 'eBay' && soldDraft.sourceStatus === 'Active' ? ' The source eBay listing is still live until you end it on eBay, so FlipTracker will flag it after saving.' : ''}
            </p>
            <div className="actions right"><button className="secondary" onClick={() => setSoldDraft(null)}>Cancel</button><button disabled={busy} onClick={saveSold}><BadgeDollarSign size={16}/>{busy ? 'Saving...' : 'Mark Sold'}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
