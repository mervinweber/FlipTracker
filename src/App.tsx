import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { Download, Plus, Upload, Save, Trash2, Search, RefreshCw } from 'lucide-react';
import { exportInventory, importInventoryFile } from './utils/excel';
import { InventoryItem } from './types/inventory';

type Asset = {
  _id: Id<'assets'>;
  type: string;
  console?: string;
  title: string;
  edition?: string;
  estimatedLow?: number;
  estimatedHigh?: number;
  userLow?: number;
  userHigh?: number;
  valueSource?: string;
  needsValueCheck?: boolean;
  localLow?: number;
  localHigh?: number;
  priority?: string;
  strategy?: string;
  status?: string;
  purchasePrice?: number;
  soldPrice?: number;
  fees?: number;
  shipping?: number;
  condition?: string;
  complete?: boolean;
  manual?: boolean;
  barcode?: string;
  notes?: string;
  confidence?: string;
};

function effectiveLow(item: Asset) {
  return item.valueSource === 'User Override' ? item.userLow || 0 : item.estimatedLow || 0;
}

function effectiveHigh(item: Asset) {
  return item.valueSource === 'User Override' ? item.userHigh || 0 : item.estimatedHigh || 0;
}

function effectiveAverage(item: Asset) {
  return (effectiveLow(item) + effectiveHigh(item)) / 2;
}

function priorityFromValue(item: Asset) {
  const high = effectiveHigh(item);
  if (high >= 20) return 'List First';
  if (high >= 10) return 'Worth Listing';
  return 'Bundle';
}

function blankAsset(): Partial<Asset> {
  return {
    type: 'Video Game',
    console: '',
    title: '',
    status: 'Inventory',
    valueSource: 'Estimated',
    strategy: 'Flip Now',
  };
}

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toInventoryForExport(asset: Asset): InventoryItem {
  return {
    type: (asset.type as InventoryItem['type']) || 'Video Game',
    console: asset.console,
    title: asset.title,
    edition: asset.edition,
    estLow: asset.estimatedLow,
    estHigh: asset.estimatedHigh,
    userLow: asset.userLow,
    userHigh: asset.userHigh,
    valueSource: asset.valueSource as InventoryItem['valueSource'],
    needsValueCheck: asset.needsValueCheck,
    localLow: asset.localLow,
    localHigh: asset.localHigh,
    priority: asset.priority,
    status: asset.status,
    purchasePrice: asset.purchasePrice,
    soldPrice: asset.soldPrice,
    fees: asset.fees,
    shipping: asset.shipping,
    condition: asset.condition,
    complete: asset.complete,
    manual: asset.manual,
    notes: asset.notes,
    confidence: asset.confidence,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [query, setQuery] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<Partial<Asset> | null>(null);

  const dashboard = useQuery(api.reports.dashboard);
  const assets = useQuery(api.assets.list, {
    search: query || undefined,
    console: consoleFilter === 'All' ? undefined : consoleFilter,
    status: statusFilter === 'All' ? undefined : statusFilter,
  });

  const createAsset = useMutation(api.assets.create);
  const updateAsset = useMutation(api.assets.update);
  const removeAsset = useMutation(api.assets.remove);
  const importMany = useMutation(api.assets.importMany);

  const isLoading = assets === undefined || dashboard === undefined;
  const rows: Asset[] = assets || [];

  const consoles = useMemo(() => {
    const values = Array.from(new Set(rows.map((item) => item.console || '').filter(Boolean))).sort();
    return ['All', ...values];
  }, [rows]);

  async function saveAsset() {
    if (!editing?.title?.trim()) return;

    const patch = {
      type: editing.type || 'Video Game',
      console: editing.console || undefined,
      title: editing.title.trim(),
      edition: editing.edition || undefined,
      estimatedLow: editing.estimatedLow,
      estimatedHigh: editing.estimatedHigh,
      userLow: editing.userLow,
      userHigh: editing.userHigh,
      valueSource: editing.valueSource || 'Estimated',
      needsValueCheck: editing.needsValueCheck,
      localLow: editing.localLow,
      localHigh: editing.localHigh,
      priority: editing.priority || priorityFromValue(editing as Asset),
      strategy: editing.strategy || 'Flip Now',
      status: editing.status || 'Inventory',
      purchasePrice: editing.purchasePrice,
      soldPrice: editing.soldPrice,
      fees: editing.fees,
      shipping: editing.shipping,
      condition: editing.condition || undefined,
      complete: editing.complete,
      manual: editing.manual,
      barcode: editing.barcode || undefined,
      notes: editing.notes || undefined,
      confidence: editing.confidence || undefined,
    };

    if ('_id' in editing && editing._id) {
      await updateAsset({ id: editing._id as Id<'assets'>, ...patch });
    } else {
      await createAsset(patch);
    }

    setEditing(null);
  }

  async function deleteAsset(id: Id<'assets'>) {
    if (!confirm('Remove this item? Totals and reports will update automatically.')) return;
    await removeAsset({ id });
  }

  async function onImport(file?: File) {
    if (!file) return;
    const imported = await importInventoryFile(file);
    await importMany({
      assets: imported.map((item) => ({
        type: item.type || 'Video Game',
        console: item.console || undefined,
        title: item.title,
        edition: item.edition || undefined,
        estimatedLow: item.estLow,
        estimatedHigh: item.estHigh,
        userLow: item.userLow,
        userHigh: item.userHigh,
        valueSource: item.valueSource || 'Estimated',
        needsValueCheck: item.needsValueCheck,
        localLow: item.localLow,
        localHigh: item.localHigh,
        priority: item.priority,
        strategy: item.priority,
        status: item.status || 'Inventory',
        purchasePrice: item.purchasePrice,
        soldPrice: item.soldPrice,
        fees: item.fees,
        shipping: item.shipping,
        condition: item.condition || undefined,
        complete: item.complete,
        manual: item.manual,
        notes: item.notes,
        confidence: item.confidence,
      })),
    });
  }

  function openValueResearch(asset: Asset) {
    const search = encodeURIComponent(`${asset.title} ${asset.console || ''}`);
    window.open(`https://www.ebay.com/sch/i.html?_nkw=${search}&LH_Sold=1&LH_Complete=1`, '_blank');
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <h1>FlipTracker</h1>
          <p>Cloud-backed resale inventory powered by Convex.</p>
        </div>
        <div className="actions">
          <button onClick={() => setEditing(blankAsset())}><Plus size={16}/> Add Item</button>
          <label className="button"><Upload size={16}/> Import Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => onImport(e.target.files?.[0])}/></label>
          <button onClick={() => exportInventory(rows.map(toInventoryForExport))}><Download size={16}/> Export Excel</button>
        </div>
      </header>

      <section className="cards">
        <div className="card"><span>Total Assets</span><strong>{dashboard?.assetCount ?? '—'}</strong></div>
        <div className="card"><span>Collections</span><strong>{dashboard?.collectionCount ?? '—'}</strong></div>
        <div className="card"><span>Value Avg</span><strong>{dashboard ? `$${dashboard.estimatedValue.toFixed(0)}` : '—'}</strong></div>
        <div className="card"><span>Need Value Check</span><strong>{dashboard?.needsValueCheck ?? '—'}</strong></div>
      </section>

      <section className="panel controls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search inventory..." value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select value={consoleFilter} onChange={e => setConsoleFilter(e.target.value)}>{consoles.map(c => <option key={c}>{c}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{['All','Inventory','Listed','Sold','Hold','Bundle'].map(s => <option key={s}>{s}</option>)}</select>
        <button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/> Refresh</button>
      </section>

      <section className="panel">
        {isLoading ? (
          <p>Loading Convex data...</p>
        ) : rows.length === 0 ? (
          <div className="empty">
            <h2>No inventory yet</h2>
            <p>Import your spreadsheet or add your first item.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Console</th><th>Title</th><th>Value</th><th>Source</th><th>Strategy</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {rows
                .slice()
                .sort((a, b) => (a.console || '').localeCompare(b.console || '') || effectiveHigh(b) - effectiveHigh(a))
                .map((item) => (
                <tr key={item._id} className={item.needsValueCheck ? 'needsCheck' : ''}>
                  <td>{item.console}</td>
                  <td><strong>{item.title}</strong>{item.edition ? <small>{item.edition}</small> : null}</td>
                  <td>{effectiveLow(item) || effectiveHigh(item) ? `$${effectiveLow(item)}-$${effectiveHigh(item)}` : ''}</td>
                  <td>{item.valueSource || 'Estimated'}{item.needsValueCheck ? ' ⚠️' : ''}</td>
                  <td>{item.strategy || priorityFromValue(item)}</td>
                  <td>{item.status || 'Inventory'}</td>
                  <td>{item.notes}</td>
                  <td className="rowActions">
                    <button onClick={() => setEditing(item)}>Edit</button>
                    <button onClick={() => openValueResearch(item)}>Research</button>
                    <button className="danger" onClick={() => deleteAsset(item._id)}><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing ? (
        <div className="modalBackdrop">
          <section className="modal">
            <h2>{'_id' in editing ? 'Edit Item' : 'Add Item'}</h2>
            <div className="formGrid">
              <label>Type<input value={editing.type || ''} onChange={e => setEditing({...editing, type:e.target.value})}/></label>
              <label>Console<input value={editing.console || ''} onChange={e => setEditing({...editing, console:e.target.value})}/></label>
              <label>Title<input value={editing.title || ''} onChange={e => setEditing({...editing, title:e.target.value, needsValueCheck: '_id' in editing})}/></label>
              <label>Edition<input value={editing.edition || ''} onChange={e => setEditing({...editing, edition:e.target.value})}/></label>
              <label>Estimated Low<input type="number" value={editing.estimatedLow || ''} onChange={e => setEditing({...editing, estimatedLow:toNumber(e.target.value)})}/></label>
              <label>Estimated High<input type="number" value={editing.estimatedHigh || ''} onChange={e => setEditing({...editing, estimatedHigh:toNumber(e.target.value)})}/></label>
              <label>User Low<input type="number" value={editing.userLow || ''} onChange={e => setEditing({...editing, userLow:toNumber(e.target.value), valueSource:'User Override', needsValueCheck:false})}/></label>
              <label>User High<input type="number" value={editing.userHigh || ''} onChange={e => setEditing({...editing, userHigh:toNumber(e.target.value), valueSource:'User Override', needsValueCheck:false})}/></label>
              <label>Value Source<select value={editing.valueSource || 'Estimated'} onChange={e => setEditing({...editing, valueSource:e.target.value})}><option>Estimated</option><option>User Override</option></select></label>
              <label>Strategy<select value={editing.strategy || 'Flip Now'} onChange={e => setEditing({...editing, strategy:e.target.value})}>{['Flip Now','Watch','Hold','Bundle'].map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Status<select value={editing.status || 'Inventory'} onChange={e => setEditing({...editing, status:e.target.value})}>{['Inventory','Listed','Sold','Hold','Bundle'].map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Purchase Price<input type="number" value={editing.purchasePrice || ''} onChange={e => setEditing({...editing, purchasePrice:toNumber(e.target.value)})}/></label>
              <label>Sold Price<input type="number" value={editing.soldPrice || ''} onChange={e => setEditing({...editing, soldPrice:toNumber(e.target.value)})}/></label>
              <label>Condition<input value={editing.condition || ''} onChange={e => setEditing({...editing, condition:e.target.value})}/></label>
              <label>Barcode<input value={editing.barcode || ''} onChange={e => setEditing({...editing, barcode:e.target.value})}/></label>
              <label className="checkbox"><input type="checkbox" checked={!!editing.complete} onChange={e => setEditing({...editing, complete:e.target.checked})}/> Complete</label>
              <label className="checkbox"><input type="checkbox" checked={!!editing.manual} onChange={e => setEditing({...editing, manual:e.target.checked})}/> Manual</label>
              <label>Notes<textarea value={editing.notes || ''} onChange={e => setEditing({...editing, notes:e.target.value})}/></label>
            </div>
            <p className="hint">Changing a title marks it for value review. Enter User Low/High to make your own eBay research override the estimate.</p>
            <div className="actions right">
              <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={saveAsset}><Save size={16}/> Save</button>
            </div>
          </section>
        </div>
      ) : null}

      <p className="footer">Use the Research button to open eBay sold/completed results for a title.</p>
    </main>
  );
}
