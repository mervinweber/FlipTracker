import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { BadgeDollarSign, CheckCircle2, ExternalLink, FolderPlus, Link as LinkIcon, Pencil, RefreshCw, Save, Search, ShoppingBag, UserRound, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type CrossListing = {
  _id: Id<'crossListings'>;
  assetId: Id<'assets'>;
  platform: string;
  status: string;
  title: string;
  description?: string;
  listingUrl?: string;
  externalListingId?: string;
  sku?: string;
  linkedAccountId?: Id<'linkedAccounts'>;
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
  linkedAccountPlatform?: string;
  linkedAccountName?: string;
  linkedAccountLoginUrl?: string;
  linkedAccountProfileUrl?: string;
  linkedAccountStatus?: string;
};

type AssetOption = {
  _id: Id<'assets'>;
  title: string;
  type: string;
  storageLocation?: string;
  status?: string;
};

type Draft = {
  id?: Id<'crossListings'>;
  assetId: Id<'assets'> | '';
  platform: string;
  status: string;
  title: string;
  description: string;
  listingUrl: string;
  externalListingId: string;
  sku: string;
  linkedAccountId: Id<'linkedAccounts'> | '';
  category: string;
  platformCategory: string;
  condition: string;
  price: string;
  shippingPrice: string;
  fees: string;
  soldPrice: string;
  saleChannelDetail: string;
  notes: string;
};

type SoldDraft = {
  id: Id<'crossListings'>;
  title: string;
  soldPrice: string;
  fees: string;
  shippingPrice: string;
  saleChannelDetail: string;
  soldAt: string;
  notes: string;
};

const PLATFORM_OPTIONS = ['Poshmark', 'Mercari', 'Depop', 'Facebook Marketplace', 'OfferUp', 'Craigslist', 'Other'];
const STATUS_OPTIONS = ['Ready', 'Listed', 'Sold', 'Ended', 'Needs Review'];
type ItemFamily = 'media' | 'book' | 'videoGame' | 'card' | 'toy' | 'general';

const CATEGORY_MAP: Record<string, string[]> = {
  Poshmark: [
    'Women > Tops & Blouses',
    'Women > Dresses',
    'Men > Tops & Tees',
    'Kids > Clothes',
    'Home',
    'Electronics > Media',
    'Electronics > Video Games & Consoles',
    'Books',
    'Collectibles',
    'Toys',
    'Other',
  ],
  Mercari: [
    'Women > Clothing',
    'Men > Clothing',
    'Kids > Clothing',
    'Electronics > Movies & TV',
    'Electronics > Video Games',
    'Books',
    'Collectibles',
    'Toys & Games',
    'Home',
    'Other',
  ],
  Depop: [
    'Vintage',
    'Books & Media',
    'Electronics',
    'Games',
    'Collectibles',
    'Accessories',
    'Home',
    'Other',
  ],
  'Facebook Marketplace': ['Electronics', 'Books', 'Movies & TV', 'Video Games', 'Clothing', 'Home & Garden', 'Collectibles', 'Other'],
  OfferUp: ['Electronics', 'Books', 'Video Games', 'Home', 'Clothing', 'Collectibles', 'Other'],
  Craigslist: ['Electronics', 'Books', 'Video Games', 'Home', 'Clothing', 'Collectibles', 'Other'],
  Other: ['General Merchandise', 'Electronics', 'Books', 'Video Games', 'Clothing', 'Collectibles', 'Other'],
};

const TYPE_DEFAULT_CATEGORY: Record<string, Record<ItemFamily, string>> = {
  Poshmark: {
    media: 'Electronics > Media',
    book: 'Books',
    videoGame: 'Electronics > Video Games & Consoles',
    card: 'Collectibles',
    toy: 'Toys',
    general: 'Other',
  },
  Mercari: {
    media: 'Electronics > Movies & TV',
    book: 'Books',
    videoGame: 'Electronics > Video Games',
    card: 'Collectibles',
    toy: 'Toys & Games',
    general: 'Other',
  },
  Depop: {
    media: 'Books & Media',
    book: 'Books & Media',
    videoGame: 'Electronics',
    card: 'Collectibles',
    toy: 'Vintage',
    general: 'Other',
  },
  'Facebook Marketplace': {
    media: 'Movies & TV',
    book: 'Books',
    videoGame: 'Video Games',
    card: 'Collectibles',
    toy: 'Collectibles',
    general: 'Other',
  },
  OfferUp: {
    media: 'Books',
    book: 'Books',
    videoGame: 'Video Games',
    card: 'Collectibles',
    toy: 'Collectibles',
    general: 'Other',
  },
  Craigslist: {
    media: 'Books',
    book: 'Books',
    videoGame: 'Video Games',
    card: 'Collectibles',
    toy: 'Collectibles',
    general: 'Other',
  },
  Other: {
    media: 'Electronics',
    book: 'Books',
    videoGame: 'Video Games',
    card: 'Collectibles',
    toy: 'Collectibles',
    general: 'General Merchandise',
  },
};

function categoryOptions(platform: string) {
  return CATEGORY_MAP[platform] || CATEGORY_MAP.Other;
}

function typeDefaultCategory(platform: string, type?: string) {
  const family = itemFamily(type);
  return TYPE_DEFAULT_CATEGORY[platform]?.[family] || TYPE_DEFAULT_CATEGORY.Other[family] || '';
}

function itemFamily(type?: string): ItemFamily {
  const normalized = (type || '').toLowerCase();
  if (!normalized) return 'general';
  if (normalized.includes('book')) return 'book';
  if (normalized.includes('dvd') || normalized.includes('blu') || normalized.includes('cd') || normalized.includes('media')) return 'media';
  if (normalized.includes('game')) return 'videoGame';
  if (normalized.includes('pokemon') || normalized.includes('yu-gi') || normalized.includes('card') || normalized.includes('sport')) return 'card';
  if (normalized.includes('toy')) return 'toy';
  if (normalized.includes('general') || normalized.includes('misc')) return 'general';
  return 'general';
}

function resolvePlatformCategory(platform: string, type?: string, currentCategory = '') {
  const options = categoryOptions(platform);
  if (currentCategory && options.includes(currentCategory)) return currentCategory;
  return typeDefaultCategory(platform, type) || options[0] || '';
}

function platformCategoryLabel(platform: string) {
  return platform === 'Facebook Marketplace' ? 'Marketplace Category' : 'Platform Category';
}

function money(value?: number) {
  return value === undefined ? '' : `$${value.toFixed(2)}`;
}

function emptyDraft(seedAssetId: Id<'assets'> | '' = ''): Draft {
  return {
    assetId: seedAssetId,
    platform: 'Poshmark',
    status: 'Ready',
    title: '',
    description: '',
    listingUrl: '',
    externalListingId: '',
    sku: '',
    linkedAccountId: '',
    category: '',
    platformCategory: '',
    condition: '',
    price: '',
    shippingPrice: '',
    fees: '',
    soldPrice: '',
    saleChannelDetail: '',
    notes: '',
  };
}

export default function CrossListingsPanel({ initialAssetId, onSeedConsumed }: { initialAssetId?: Id<'assets'> | null; onSeedConsumed?: () => void; }) {
  const listings = useQuery(api.crossListings.list) as CrossListing[] | undefined;
  const assets = useQuery(api.assets.list, {}) as AssetOption[] | undefined;
  const linkedAccounts = useQuery(api.linkedAccounts.list) as Array<{ _id: Id<'linkedAccounts'>; platform: string; accountName: string; username?: string; loginUrl?: string; profileUrl?: string; status: string; }> | undefined;
  const createCrossListing = useMutation(api.crossListings.create);
  const updateCrossListing = useMutation(api.crossListings.update);
  const removeCrossListing = useMutation(api.crossListings.remove);
  const markSold = useMutation(api.crossListings.markSold);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<Id<'crossListings'> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [soldDraft, setSoldDraft] = useState<SoldDraft | null>(null);

  function setDraftFromAsset(asset: AssetOption, base?: Draft) {
    const nextPlatform = base?.platform || 'Poshmark';
    const suggestedPlatformCategory = resolvePlatformCategory(nextPlatform, asset.type, base?.platformCategory || '');
    setDraft((current) => ({
      ...emptyDraft(asset._id),
      ...current,
      ...base,
      assetId: asset._id,
      title: asset.title,
      category: asset.type,
      platform: nextPlatform,
      platformCategory: suggestedPlatformCategory || current.platformCategory || '',
      status: base?.status || 'Ready',
    }));
  }

  useEffect(() => {
    if (!initialAssetId || !assets?.length) return;
    const asset = assets.find((row) => row._id === initialAssetId);
    if (!asset) return;
    setDraftFromAsset(asset as AssetOption);
    setShowModal(true);
    onSeedConsumed?.();
  }, [assets, initialAssetId, onSeedConsumed]);

  const filtered = useMemo(() => {
    return (listings || []).filter((row) => {
      const haystack = [row.title, row.assetTitle, row.platform, row.status, row.assetLocation, row.sku, row.externalListingId, row.linkedAccountName].filter(Boolean).join(' ').toLowerCase();
      if (platformFilter !== 'All' && row.platform !== platformFilter) return false;
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (search && !haystack.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [listings, platformFilter, search, statusFilter]);

  const assetOptions = useMemo(() => assets || [], [assets]);
  const selectedAsset = useMemo(() => assetOptions.find((row) => row._id === draft.assetId), [assetOptions, draft.assetId]);
  const suggestedPlatformCategory = useMemo(
    () => resolvePlatformCategory(draft.platform, selectedAsset?.type || draft.category, draft.platformCategory),
    [draft.category, draft.platform, draft.platformCategory, selectedAsset?.type],
  );
  const platformAccounts = useMemo(() => (linkedAccounts || []).filter((account) => account.platform === draft.platform), [draft.platform, linkedAccounts]);
  const selectedLinkedAccount = useMemo(() => (linkedAccounts || []).find((account) => account._id === draft.linkedAccountId), [draft.linkedAccountId, linkedAccounts]);

  function openCreate(seedAssetId?: Id<'assets'>) {
    setEditingId(null);
    setSoldDraft(null);
    setDraft(emptyDraft(seedAssetId));
    setError('');
    setShowModal(true);
  }

  function openEdit(row: CrossListing) {
    setEditingId(row._id);
    setSoldDraft(null);
    const assetType = row.assetType || row.category;
    setDraft({
      id: row._id,
      assetId: row.assetId,
      platform: row.platform,
      status: row.status,
      title: row.title,
      description: row.description || '',
      listingUrl: row.listingUrl || '',
      externalListingId: row.externalListingId || '',
      sku: row.sku || '',
      linkedAccountId: row.linkedAccountId || '',
      category: row.category || '',
      platformCategory: resolvePlatformCategory(row.platform, assetType, row.platformCategory || ''),
      condition: row.condition || '',
      price: row.price?.toString() || '',
      shippingPrice: row.shippingPrice?.toString() || '',
      fees: row.fees?.toString() || '',
      soldPrice: row.soldPrice?.toString() || '',
      saleChannelDetail: row.saleChannelDetail || '',
      notes: row.notes || '',
    });
    setError('');
    setShowModal(true);
  }

  async function saveCrossListing() {
    if (!draft.assetId) {
      setError('Choose an inventory item first.');
      return;
    }
    if (!draft.title.trim()) {
      setError('Enter a title for the cross listing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        assetId: draft.assetId as Id<'assets'>,
        platform: draft.platform,
        status: draft.status,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        listingUrl: draft.listingUrl.trim() || undefined,
        externalListingId: draft.externalListingId.trim() || undefined,
        sku: draft.sku.trim() || undefined,
        linkedAccountId: draft.linkedAccountId || undefined,
        category: draft.category.trim() || undefined,
        platformCategory: resolvePlatformCategory(draft.platform, selectedAsset?.type || draft.category, draft.platformCategory.trim()) || undefined,
        condition: draft.condition.trim() || undefined,
        price: draft.price.trim() ? Number(draft.price) : undefined,
        shippingPrice: draft.shippingPrice.trim() ? Number(draft.shippingPrice) : undefined,
        fees: draft.fees.trim() ? Number(draft.fees) : undefined,
        soldPrice: draft.soldPrice.trim() ? Number(draft.soldPrice) : undefined,
        saleChannelDetail: draft.saleChannelDetail.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      };
      if (editingId) await updateCrossListing({ id: editingId, ...payload });
      else await createCrossListing(payload);
      setShowModal(false);
      setEditingId(null);
      setDraft(emptyDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the cross listing.');
    } finally {
      setBusy(false);
    }
  }

  function openSold(row: CrossListing) {
    setShowModal(false);
    setSoldDraft({
      id: row._id,
      title: row.title,
      soldPrice: row.soldPrice?.toFixed(2) || row.price?.toFixed(2) || '',
      fees: row.fees?.toFixed(2) || '',
      shippingPrice: row.shippingPrice?.toFixed(2) || '',
      saleChannelDetail: row.saleChannelDetail || row.platform,
      soldAt: row.soldAt ? new Date(row.soldAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: row.notes || '',
    });
    setError('');
  }

  async function saveSold() {
    if (!soldDraft) return;
    const soldPrice = Number(soldDraft.soldPrice);
    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      setError('Enter a valid sold price.');
      return;
    }
    const soldAt = soldDraft.soldAt ? new Date(`${soldDraft.soldAt}T12:00:00`).getTime() : Date.now();
    setBusy(true);
    setError('');
    try {
      await markSold({
        id: soldDraft.id,
        soldPrice,
        soldAt,
        fees: soldDraft.fees.trim() ? Number(soldDraft.fees) : undefined,
        shippingPrice: soldDraft.shippingPrice.trim() ? Number(soldDraft.shippingPrice) : undefined,
        saleChannelDetail: soldDraft.saleChannelDetail.trim() || undefined,
        notes: soldDraft.notes.trim() || undefined,
      });
      setSoldDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark listing sold.');
    } finally {
      setBusy(false);
    }
  }

  async function pushListing(row: CrossListing) {
    const nextCategory = resolvePlatformCategory(row.platform, row.assetType || row.category, row.platformCategory || '');
    const linkedAccountId = row.linkedAccountId || linkedAccounts?.find((account) => account.platform === row.platform)?._id;
    await updateCrossListing({
      id: row._id,
      status: 'Listed',
      listedAt: Date.now(),
      platformCategory: nextCategory || undefined,
      linkedAccountId,
    });
  }

  async function deleteListing(row: CrossListing) {
    if (!window.confirm(`Delete ${row.title}? This only removes the cross-listing record.`)) return;
    await removeCrossListing({ id: row._id });
  }

  return (
    <section className="crossListingsPage">
      <header className="panel crossListingsHeader">
        <div>
          <p className="eyebrow">Multi-marketplace workflow</p>
          <h2>Cross Listings</h2>
          <p>Track one inventory item across Poshmark, Mercari, Depop, and other resale channels without duplicating the core record.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => openCreate()}><FolderPlus size={16}/> Add Cross Listing</button>
          <button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/> Refresh</button>
        </div>
      </header>

      <section className="panel controls crossListingsControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search cross listings..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option>All</option>{PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
        <div className="panelHint"><ShoppingBag size={16}/><span>One inventory item can have separate prices and statuses on each channel.</span></div>
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader">
          <div><h2>Channel Queue</h2><p>{filtered.length} cross listing{filtered.length === 1 ? '' : 's'} in view</p></div>
        </div>
        {!listings ? <p>Loading cross listings...</p> : filtered.length === 0 ? <div className="empty"><h2>No cross listings yet</h2><p>Create one from inventory or add a new marketplace row here.</p></div> : (
          <div className="tableWrap">
            <table className="crossListingsTable">
              <thead>
                <tr>
                  <th>Platform</th><th>Inventory</th><th>Status</th><th>Price</th><th>Location</th><th>Notes</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row._id}>
                    <td><span className="consoleTag">{row.platform}</span></td>
                    <td><strong>{row.title}</strong><small>{row.assetTitle}{row.assetBarcode ? ` · ${row.assetBarcode}` : ''}{row.linkedAccountName ? ` · ${row.linkedAccountName}` : ''}</small></td>
                    <td>
                      <span className={badgeClass(row.status)}>{row.status}</span>
                      {row.saleChannelDetail || row.soldAt ? <small>{row.saleChannelDetail || row.platform}{row.soldAt ? ` · ${new Date(row.soldAt).toLocaleDateString()}` : ''}</small> : null}
                    </td>
                    <td>{row.soldPrice !== undefined ? money(row.soldPrice) : money(row.price)}</td>
                    <td>{row.assetLocation || ''}</td>
                    <td>{[row.platformCategory || row.category, row.notes].filter(Boolean).join(' · ')}</td>
                    <td className="tableActionsCell"><div className="rowActions">
                      <button onClick={() => openEdit(row)}><Pencil size={14}/> Edit</button>
                      {row.listingUrl ? <a className="button secondary" href={row.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open</a> : null}
                      {row.linkedAccountLoginUrl ? <a className="button secondary" href={row.linkedAccountLoginUrl} target="_blank" rel="noreferrer"><UserRound size={14}/> Login</a> : null}
                      {row.status !== 'Listed' ? <button className="secondary" onClick={() => pushListing(row)}><LinkIcon size={14}/> Push</button> : null}
                      {row.status !== 'Sold' ? <button className="secondary" onClick={() => openSold(row)}><BadgeDollarSign size={14}/> Sold</button> : <span className="statusPill success">Sold</span>}
                      <button className="danger iconButton" aria-label={`Delete ${row.title}`} onClick={() => deleteListing(row)}><Trash2 size={14}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal">
            <header className="modalHeader">
              <div><h2>{editingId ? 'Edit Cross Listing' : 'Create Cross Listing'}</h2><span className="statusPill">Poshmark / Mercari / Depop</span></div>
              <button className="iconButton secondary" aria-label="Close cross listing editor" onClick={() => setShowModal(false)}><X size={18}/></button>
            </header>
            <div className="formGrid">
              <label className="span2">Inventory Item<select value={draft.assetId} onChange={(event) => {
                const asset = assetOptions.find((row) => row._id === event.target.value);
                setDraft((current) => {
                  const nextAssetId = event.target.value as Id<'assets'>;
                  const nextType = asset?.type || current.category;
                  const nextPlatform = current.platform || 'Poshmark';
                  const nextPlatformCategory = resolvePlatformCategory(nextPlatform, nextType, current.platformCategory);
                  return {
                    ...current,
                    assetId: nextAssetId,
                    title: asset?.title || current.title,
                    category: nextType || current.category,
                    platformCategory: nextPlatformCategory,
                  };
                });
              }}><option value="">Choose inventory item</option>{assetOptions.map((asset) => <option key={asset._id} value={asset._id}>{asset.title}{asset.storageLocation ? ` · ${asset.storageLocation}` : ''}</option>)}</select></label>
              <label>Platform<select value={draft.platform} onChange={(event) => setDraft((current) => {
                const nextPlatform = event.target.value;
                const nextCategory = resolvePlatformCategory(nextPlatform, selectedAsset?.type || current.category, current.platformCategory);
                const nextLinkedAccount = platformAccounts.find((account) => account._id === current.linkedAccountId);
                return { ...current, platform: nextPlatform, platformCategory: nextCategory, linkedAccountId: nextLinkedAccount ? nextLinkedAccount._id : '' };
              })}>{PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
              <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="span2">Title<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Cross listing title"/></label>
              <label>Linked Account<select value={draft.linkedAccountId} onChange={(event) => setDraft((current) => {
                const nextAccountId = event.target.value as Id<'linkedAccounts'> | '';
                const nextAccount = (linkedAccounts || []).find((account) => account._id === nextAccountId);
                return {
                  ...current,
                  linkedAccountId: nextAccountId,
                  listingUrl: current.listingUrl || nextAccount?.profileUrl || '',
                };
              })}><option value="">Select linked account</option>{platformAccounts.map((account) => <option key={account._id} value={account._id}>{account.accountName}{account.username ? ` · ${account.username}` : ''} · {account.status}</option>)}</select></label>
              {selectedLinkedAccount ? <div className="span2 linkedAccountNotice"><CheckCircle2 size={14}/><span><strong>{selectedLinkedAccount.accountName}</strong><small>{selectedLinkedAccount.platform} · {selectedLinkedAccount.status}{selectedLinkedAccount.loginUrl || selectedLinkedAccount.profileUrl ? ' · linked access available' : ''}</small></span></div> : null}
              <label className="span2">Description<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Condition, flaws, shipping details, SKU, etc."/></label>
              <label>Listing URL<input value={draft.listingUrl} onChange={(event) => setDraft((current) => ({ ...current, listingUrl: event.target.value }))}/></label>
              <label>External ID<input value={draft.externalListingId} onChange={(event) => setDraft((current) => ({ ...current, externalListingId: event.target.value }))}/></label>
              <label>SKU<input value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))}/></label>
              <label>Category<input list="cross-listing-categories" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Marketplace category or department"/></label>
              <label>{platformCategoryLabel(draft.platform)}<select value={draft.platformCategory} onChange={(event) => setDraft((current) => ({ ...current, platformCategory: event.target.value }))}><option value="">Choose category</option>{categoryOptions(draft.platform).map((value) => <option key={value}>{value}</option>)}</select><small>Suggested: {suggestedPlatformCategory || 'Choose an inventory item first'}</small></label>
              <div className="categorySuggestionRow span2">
                <div>
                  <strong>Suggested category</strong>
                  <small>{suggestedPlatformCategory || 'Select an inventory item to generate a default.'}</small>
                </div>
                <button type="button" className="secondary" disabled={!suggestedPlatformCategory} onClick={() => setDraft((current) => ({ ...current, platformCategory: suggestedPlatformCategory }))}>Use suggested</button>
              </div>
              <label>Condition<input value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value }))}/></label>
              <label>Price<input type="number" inputMode="decimal" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}/></label>
              <label>Shipping<input type="number" inputMode="decimal" value={draft.shippingPrice} onChange={(event) => setDraft((current) => ({ ...current, shippingPrice: event.target.value }))}/></label>
              <label>Fees<input type="number" inputMode="decimal" value={draft.fees} onChange={(event) => setDraft((current) => ({ ...current, fees: event.target.value }))}/></label>
              <label>Sold Price<input type="number" inputMode="decimal" value={draft.soldPrice} onChange={(event) => setDraft((current) => ({ ...current, soldPrice: event.target.value }))}/></label>
              <label>Sold Elsewhere<select value={draft.saleChannelDetail} onChange={(event) => setDraft((current) => ({ ...current, saleChannelDetail: event.target.value }))}><option value="">Use platform name</option><option>Poshmark</option><option>Mercari</option><option>Depop</option><option>Facebook Marketplace</option><option>OfferUp</option><option>Craigslist</option><option>eBay</option><option>Whatnot</option><option>Shopify</option><option>Other</option></select></label>
              <label className="span2">Notes<textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}/></label>
            </div>
            <datalist id="cross-listing-categories">{categoryOptions(draft.platform).map((value) => <option key={value} value={value} />)}</datalist>
            {error ? <p className="setupNotice errorNotice">{error}</p> : null}
            <div className="actions right">
              <button className="secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button disabled={busy} onClick={saveCrossListing}><Save size={16}/>{busy ? 'Saving...' : 'Save Cross Listing'}</button>
            </div>
          </section>
        </div>
      ) : null}

      {soldDraft ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal soldListingModal">
            <header className="modalHeader">
              <div>
                <h2>Mark Sold</h2>
                <span className="statusPill warning">{soldDraft.title}</span>
              </div>
              <button className="iconButton secondary" aria-label="Close sold listing editor" onClick={() => setSoldDraft(null)}><X size={18}/></button>
            </header>
            <div className="formGrid">
              <label>Sold Price<input type="number" inputMode="decimal" value={soldDraft.soldPrice} onChange={(event) => setSoldDraft((current) => current ? { ...current, soldPrice: event.target.value } : current)} /></label>
              <label>Sold At<input type="date" value={soldDraft.soldAt} onChange={(event) => setSoldDraft((current) => current ? { ...current, soldAt: event.target.value } : current)} /></label>
              <label>Sold Channel<select value={soldDraft.saleChannelDetail} onChange={(event) => setSoldDraft((current) => current ? { ...current, saleChannelDetail: event.target.value } : current)}><option value="">Use platform</option><option>Poshmark</option><option>Mercari</option><option>Depop</option><option>Facebook Marketplace</option><option>OfferUp</option><option>Craigslist</option><option>eBay</option><option>Whatnot</option><option>Shopify</option><option>Other</option></select></label>
              <label>Fees<input type="number" inputMode="decimal" value={soldDraft.fees} onChange={(event) => setSoldDraft((current) => current ? { ...current, fees: event.target.value } : current)} /></label>
              <label>Shipping<input type="number" inputMode="decimal" value={soldDraft.shippingPrice} onChange={(event) => setSoldDraft((current) => current ? { ...current, shippingPrice: event.target.value } : current)} /></label>
              <label className="span2">Notes<textarea value={soldDraft.notes} onChange={(event) => setSoldDraft((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Sold elsewhere, buyer notes, package details, etc."/></label>
            </div>
            {error ? <p className="setupNotice errorNotice">{error}</p> : null}
            <div className="actions right">
              <button className="secondary" onClick={() => setSoldDraft(null)}>Cancel</button>
              <button disabled={busy} onClick={saveSold}><BadgeDollarSign size={16}/> Mark Sold</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function badgeClass(value?: string) {
  return `badge ${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
