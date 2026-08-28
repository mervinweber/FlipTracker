import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { BookOpen, ExternalLink, Link2, LogIn, PackageSearch, Pencil, Plus, Save, Search, ShieldCheck, Tags, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { normalizeVintedListingUrl, suggestedVintedCategory, VINTED_CATEGORIES, VINTED_HOME_URL, vintedListingId } from '../utils/vinted';

type VintedListing = {
  _id: Id<'crossListings'>;
  platform: string;
  assetId: Id<'assets'>;
  linkedAccountId?: Id<'linkedAccounts'>;
  status: string;
  title: string;
  listingUrl?: string;
  externalListingId?: string;
  platformCategory?: string;
  category?: string;
  condition?: string;
  price?: number;
  notes?: string;
  updatedAt: number;
  assetTitle: string;
  assetType?: string;
  assetLocation?: string;
  assetBarcode?: string;
  assetPhotoUrl?: string;
};

type VintedAccount = {
  _id: Id<'linkedAccounts'>;
  platform: string;
  accountName: string;
  username?: string;
  loginUrl?: string;
  profileUrl?: string;
  status: string;
  notes?: string;
};

type AssetOption = {
  _id: Id<'assets'>;
  title: string;
  type: string;
  storageLocation?: string;
};

type ListingDraft = {
  id?: Id<'crossListings'>;
  assetId: Id<'assets'> | '';
  title: string;
  status: string;
  category: string;
  listingUrl: string;
  price: string;
  condition: string;
  notes: string;
};

type AccountDraft = {
  id?: Id<'linkedAccounts'>;
  accountName: string;
  username: string;
  profileUrl: string;
  status: string;
  notes: string;
};

const VINTED_STATUSES = ['Listed', 'Ready', 'Sold', 'Ended', 'Needs Review'];

function blankListing(account?: VintedAccount): ListingDraft {
  return { assetId: '', title: '', status: 'Listed', category: '', listingUrl: '', price: '', condition: '', notes: account ? `Vinted account: ${account.accountName}` : '' };
}

function blankAccount(): AccountDraft {
  return { accountName: 'My Vinted', username: '', profileUrl: '', status: 'Linked', notes: '' };
}

function money(value?: number) {
  return value === undefined ? 'No price' : `$${value.toFixed(2)}`;
}

function badgeClass(value: string) {
  return `badge ${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export default function VintedPanel() {
  const allListings = useQuery(api.crossListings.list) as VintedListing[] | undefined;
  const allAccounts = useQuery(api.linkedAccounts.list) as VintedAccount[] | undefined;
  const assets = useQuery(api.assets.list, {}) as AssetOption[] | undefined;
  const createListing = useMutation(api.crossListings.create);
  const updateListing = useMutation(api.crossListings.update);
  const createAccount = useMutation(api.linkedAccounts.create);
  const updateAccount = useMutation(api.linkedAccounts.update);

  const listings = useMemo(() => (allListings || []).filter((row) => row.platform === 'Vinted'), [allListings]);
  const account = useMemo(() => (allAccounts || []).find((row) => row.platform === 'Vinted'), [allAccounts]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState('Newest');
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => Array.from(new Set(listings.map((row) => row.platformCategory || row.category || 'Other'))).sort(), [listings]);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const rows = listings.filter((row) => {
      const category = row.platformCategory || row.category || 'Other';
      if (categoryFilter !== 'All' && category !== categoryFilter) return false;
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      return !normalized || [row.title, row.assetTitle, row.assetBarcode, row.assetLocation, category].filter(Boolean).join(' ').toLowerCase().includes(normalized);
    });
    return [...rows].sort((a, b) => {
      if (sort === 'Title') return a.title.localeCompare(b.title);
      if (sort === 'Price High') return (b.price || 0) - (a.price || 0);
      if (sort === 'Price Low') return (a.price || 0) - (b.price || 0);
      return b.updatedAt - a.updatedAt;
    });
  }, [categoryFilter, listings, search, sort, statusFilter]);

  const listedCount = listings.filter((row) => row.status === 'Listed').length;
  const bookCount = listings.filter((row) => (row.platformCategory || row.category) === 'Books').length;
  const soldCount = listings.filter((row) => row.status === 'Sold').length;

  function openCreateListing() {
    setError('');
    setListingDraft(blankListing(account));
  }

  function openEditListing(row: VintedListing) {
    setError('');
    setListingDraft({
      id: row._id,
      assetId: row.assetId,
      title: row.title,
      status: row.status,
      category: row.platformCategory || row.category || 'Other',
      listingUrl: row.listingUrl || '',
      price: row.price?.toString() || '',
      condition: row.condition || '',
      notes: row.notes || '',
    });
  }

  function openAccountEditor() {
    setError('');
    setAccountDraft(account ? {
      id: account._id,
      accountName: account.accountName,
      username: account.username || '',
      profileUrl: account.profileUrl || '',
      status: account.status,
      notes: account.notes || '',
    } : blankAccount());
  }

  async function saveVintedAccount() {
    if (!accountDraft?.accountName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        platform: 'Vinted',
        accountName: accountDraft.accountName.trim(),
        username: accountDraft.username.trim() || undefined,
        loginUrl: VINTED_HOME_URL,
        profileUrl: accountDraft.profileUrl.trim() || undefined,
        status: accountDraft.status,
        notes: accountDraft.notes.trim() || undefined,
      };
      if (accountDraft.id) await updateAccount({ id: accountDraft.id, ...payload });
      else await createAccount(payload);
      setAccountDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the Vinted profile.');
    } finally {
      setBusy(false);
    }
  }

  async function saveVintedListing() {
    if (!listingDraft?.assetId) {
      setError('Choose the matching FlipTracker inventory item.');
      return;
    }
    if (!listingDraft.title.trim()) {
      setError('Enter a title for the Vinted item.');
      return;
    }
    const normalizedUrl = normalizeVintedListingUrl(listingDraft.listingUrl);
    if (listingDraft.listingUrl.trim() && !normalizedUrl) {
      setError('Enter a Vinted item URL containing /items/ and its item number.');
      return;
    }
    const price = listingDraft.price.trim() ? Number(listingDraft.price) : undefined;
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setError('Enter a valid listing price.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        assetId: listingDraft.assetId as Id<'assets'>,
        platform: 'Vinted',
        status: listingDraft.status,
        title: listingDraft.title.trim(),
        listingUrl: normalizedUrl || undefined,
        externalListingId: normalizedUrl ? vintedListingId(normalizedUrl) : undefined,
        linkedAccountId: account?._id,
        category: listingDraft.category,
        platformCategory: listingDraft.category,
        condition: listingDraft.condition.trim() || undefined,
        price,
        notes: listingDraft.notes.trim() || undefined,
        listedAt: listingDraft.status === 'Listed' ? Date.now() : undefined,
      };
      if (listingDraft.id) await updateListing({ id: listingDraft.id, ...payload });
      else await createListing(payload);
      setListingDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the Vinted listing.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="vintedPage">
    <header className="panel vintedHeader">
      <div><p className="eyebrow">Vinted workspace</p><h2>Vinted Wardrobe</h2><p>Find a category, open the exact item, and return without searching through the full wardrobe.</p></div>
      <div className="actions"><button className="secondary" onClick={openAccountEditor}><ShieldCheck size={16}/>{account ? 'Profile Settings' : 'Set Up Vinted'}</button><button onClick={openCreateListing}><Plus size={16}/> Add Vinted Link</button></div>
    </header>

    <section className="panel vintedAccountBar">
      <div className="vintedAccountIdentity"><span className={account ? 'vintedAccountMark connected' : 'vintedAccountMark'}><ShieldCheck size={18}/></span><div><strong>{account?.accountName || 'Vinted profile not saved'}</strong><small>{account?.username ? `@${account.username}` : 'Use your browser session to sign in securely.'}</small></div></div>
      <div className="actions"><a className="button secondary" href={account?.loginUrl || VINTED_HOME_URL} target="_blank" rel="noreferrer"><LogIn size={15}/> Open Vinted</a>{account?.profileUrl ? <a className="button secondary" href={account.profileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open Wardrobe</a> : null}</div>
    </section>

    <section className="vintedMetrics" aria-label="Vinted listing summary">
      <div><span>All items</span><strong>{listings.length}</strong></div><div><span>Listed</span><strong>{listedCount}</strong></div><div><span>Books</span><strong>{bookCount}</strong></div><div><span>Sold</span><strong>{soldCount}</strong></div>
    </section>

    <section className="panel vintedFilters">
      <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search title, barcode, or bin..." value={search} onChange={(event) => setSearch(event.target.value)}/></div>
      <select aria-label="Filter Vinted category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <select aria-label="Filter Vinted status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{VINTED_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
      <select aria-label="Sort Vinted listings" value={sort} onChange={(event) => setSort(event.target.value)}><option>Newest</option><option>Title</option><option>Price High</option><option>Price Low</option></select>
    </section>

    {categories.length ? <nav className="vintedCategoryTabs" aria-label="Vinted categories"><button className={categoryFilter === 'All' ? 'active' : 'secondary'} onClick={() => setCategoryFilter('All')}>All <b>{listings.length}</b></button>{categories.map((category) => <button key={category} className={categoryFilter === category ? 'active' : 'secondary'} onClick={() => setCategoryFilter(category)}>{category} <b>{listings.filter((row) => (row.platformCategory || row.category || 'Other') === category).length}</b></button>)}</nav> : null}

    <section className="panel vintedInventoryPanel">
      <div className="panelHeader"><div><h2>{categoryFilter === 'All' ? 'Wardrobe Items' : categoryFilter}</h2><p>{filtered.length} item{filtered.length === 1 ? '' : 's'} in this view</p></div></div>
      {allListings === undefined ? <p className="panelMessage">Loading Vinted listings...</p> : filtered.length === 0 ? <div className="empty"><BookOpen size={28}/><h2>No matching Vinted items</h2><p>Add a Vinted item link or clear the current filters.</p></div> : <div className="vintedListingList">{filtered.map((row) => <article className="vintedListingRow" key={row._id}>
        <div className="vintedThumb">{row.assetPhotoUrl ? <img src={row.assetPhotoUrl} alt=""/> : <PackageSearch size={22}/>}</div>
        <div className="vintedListingInfo"><div className="vintedListingBadges"><span className={badgeClass(row.status)}>{row.status}</span><span className="vintedCategoryBadge">{row.platformCategory || row.category || 'Other'}</span></div><h3>{row.title}</h3><p>{[row.assetType, row.assetBarcode, row.assetLocation ? `Bin ${row.assetLocation}` : ''].filter(Boolean).join(' · ')}</p>{row.notes ? <small>{row.notes}</small> : null}</div>
        <strong className="vintedPrice">{money(row.price)}</strong>
        <div className="vintedRowActions">{row.listingUrl ? <a className="button" href={row.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open on Vinted</a> : <button onClick={() => openEditListing(row)}><Link2 size={15}/> Add Link</button>}<button className="secondary iconButton" aria-label={`Edit ${row.title}`} title="Edit Vinted record" onClick={() => openEditListing(row)}><Pencil size={15}/></button></div>
      </article>)}</div>}
    </section>

    {listingDraft ? <div className="modalBackdrop"><section className="modal vintedModal" role="dialog" aria-modal="true" aria-labelledby="vinted-listing-title">
      <header className="modalHeader"><div><p className="eyebrow">Vinted item link</p><h2 id="vinted-listing-title">{listingDraft.id ? 'Edit Vinted Item' : 'Add Vinted Item'}</h2></div><button className="iconButton secondary" aria-label="Close Vinted item editor" onClick={() => setListingDraft(null)}><X size={18}/></button></header>
      <div className="formGrid">
        <label className="span2">FlipTracker Inventory Item<select value={listingDraft.assetId} onChange={(event) => { const asset = (assets || []).find((row) => row._id === event.target.value); setListingDraft((current) => current ? { ...current, assetId:event.target.value as Id<'assets'>, title:asset?.title || current.title, category:suggestedVintedCategory(asset?.type, asset?.title) } : current); }}><option value="">Choose an inventory item</option>{(assets || []).map((asset) => <option key={asset._id} value={asset._id}>{asset.title}{asset.storageLocation ? ` · ${asset.storageLocation}` : ''}</option>)}</select></label>
        <label className="span2">Vinted Item URL<input value={listingDraft.listingUrl} onChange={(event) => setListingDraft((current) => current ? { ...current, listingUrl:event.target.value } : current)} placeholder="https://www.vinted.com/items/..."/></label>
        <label className="span2">Title<input value={listingDraft.title} onChange={(event) => setListingDraft((current) => current ? { ...current, title:event.target.value } : current)}/></label>
        <label>Category<select value={listingDraft.category} onChange={(event) => setListingDraft((current) => current ? { ...current, category:event.target.value } : current)}><option value="">Choose category</option>{VINTED_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Status<select value={listingDraft.status} onChange={(event) => setListingDraft((current) => current ? { ...current, status:event.target.value } : current)}>{VINTED_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Price<input type="number" min="0" step="0.01" inputMode="decimal" value={listingDraft.price} onChange={(event) => setListingDraft((current) => current ? { ...current, price:event.target.value } : current)}/></label>
        <label>Condition<input value={listingDraft.condition} onChange={(event) => setListingDraft((current) => current ? { ...current, condition:event.target.value } : current)} placeholder="Good, Very Good..."/></label>
        <label className="span2">Notes<textarea value={listingDraft.notes} onChange={(event) => setListingDraft((current) => current ? { ...current, notes:event.target.value } : current)} placeholder="Private workflow notes"/></label>
      </div>
      {error ? <p className="setupNotice errorNotice">{error}</p> : null}
      <div className="actions right"><button className="secondary" onClick={() => setListingDraft(null)}>Cancel</button><button disabled={busy} onClick={saveVintedListing}><Save size={16}/>{busy ? 'Saving...' : 'Save Vinted Item'}</button></div>
    </section></div> : null}

    {accountDraft ? <div className="modalBackdrop"><section className="modal vintedModal" role="dialog" aria-modal="true" aria-labelledby="vinted-account-title">
      <header className="modalHeader"><div><p className="eyebrow">Vinted profile</p><h2 id="vinted-account-title">Profile Settings</h2></div><button className="iconButton secondary" aria-label="Close Vinted profile settings" onClick={() => setAccountDraft(null)}><X size={18}/></button></header>
      <div className="vintedSecurityNote"><ShieldCheck size={18}/><span>FlipTracker stores your wardrobe link, not your Vinted password. Sign in on Vinted using the browser window.</span></div>
      <div className="formGrid">
        <label>Account Label<input value={accountDraft.accountName} onChange={(event) => setAccountDraft((current) => current ? { ...current, accountName:event.target.value } : current)}/></label>
        <label>Username<input value={accountDraft.username} onChange={(event) => setAccountDraft((current) => current ? { ...current, username:event.target.value } : current)} placeholder="Seller handle"/></label>
        <label className="span2">Wardrobe / Profile URL<input value={accountDraft.profileUrl} onChange={(event) => setAccountDraft((current) => current ? { ...current, profileUrl:event.target.value } : current)} placeholder="https://www.vinted.com/member/..."/></label>
        <label>Status<select value={accountDraft.status} onChange={(event) => setAccountDraft((current) => current ? { ...current, status:event.target.value } : current)}><option>Linked</option><option>Needs Login</option><option>Paused</option></select></label>
        <label className="span2">Notes<textarea value={accountDraft.notes} onChange={(event) => setAccountDraft((current) => current ? { ...current, notes:event.target.value } : current)}/></label>
      </div>
      {error ? <p className="setupNotice errorNotice">{error}</p> : null}
      <div className="actions right"><a className="button secondary" href={VINTED_HOME_URL} target="_blank" rel="noreferrer"><LogIn size={15}/> Open Vinted Login</a><button disabled={busy} onClick={saveVintedAccount}><Save size={16}/>{busy ? 'Saving...' : 'Save Profile'}</button></div>
    </section></div> : null}
  </section>;
}
