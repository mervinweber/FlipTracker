import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Barcode, CheckCircle2, CircleDashed, ExternalLink, Keyboard, LayoutList, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import '../bulk-intake.css';

type LookupResult = {
  barcode: string;
  barcodeType: string;
  title: string;
  type: string;
  mediaFormat: string;
  edition?: string;
  releaseYear?: string;
  releaseDate?: string;
  studio?: string;
  author?: string;
  rating?: string;
  coverImageUrl?: string;
  source: string;
  confidence: string;
  notes?: string;
};

type QueueStatus = 'Queued' | 'Looking up' | 'Saving' | 'Saved' | 'Review';
type QueueRow = {
  id: number;
  barcode: string;
  status: QueueStatus;
  title?: string;
  format?: string;
  confidence?: string;
  sku?: string;
  copyNumber?: number;
  draftCreated?: boolean;
  message?: string;
};

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function categoryFor(type: string) {
  if (type === 'DVD' || type === 'Blu-ray') return 'Movies & TV > DVDs & Blu-ray Discs';
  if (type === 'CD') return 'Music > CDs';
  if (type === 'Book') return 'Books & Magazines > Books';
  if (type === 'Video Game') return 'Video Games & Consoles > Video Games';
  if (type === 'Sports Card') return 'Sports Mem, Cards & Fan Shop > Sports Trading Cards';
  if (type === 'Pokemon Card') return 'Collectible Card Games > Pokemon Trading Card Game';
  if (type === 'Yu-Gi-Oh! Card') return 'Collectible Card Games > Yu-Gi-Oh! Trading Card Game';
  return 'Everything Else > Other';
}

function listingFields(result: LookupResult, condition: string, completeness: string) {
  const format = result.mediaFormat === 'Unknown' ? result.type : result.mediaFormat;
  return {
    title: [result.title, result.edition, format, result.releaseYear].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80),
    description: [result.title, result.edition ? `Edition: ${result.edition}` : '', format ? `Format: ${format}` : '', result.author ? `Author: ${result.author}` : '', `Condition: ${condition}`, `Completeness: ${completeness}`, `UPC: ${result.barcode}`].filter(Boolean).join('\n'),
    specifics: [format ? `Format: ${format}` : '', result.studio ? `Studio/Publisher: ${result.studio}` : '', result.author ? `Author: ${result.author}` : '', result.rating ? `Rating: ${result.rating}` : '', result.releaseYear ? `Release Year: ${result.releaseYear}` : '', `UPC: ${result.barcode}`].filter(Boolean).join('\n'),
  };
}

function statusIcon(status: QueueStatus) {
  if (status === 'Saved') return <CheckCircle2 size={17}/>;
  if (status === 'Review') return <AlertTriangle size={17}/>;
  return <CircleDashed size={17}/>;
}

export default function BulkIntakePanel() {
  const collections = useQuery(api.collections.list) || [];
  const lookupByBarcode = useAction(api.mediaLookup.lookupByBarcode);
  const createScannedItem = useMutation(api.intake.createScannedItem);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pipelineRef = useRef<Promise<void>>(Promise.resolve());
  const rowIdRef = useRef(0);
  const lastScanRef = useRef({ barcode: '', at: 0 });
  const [barcode, setBarcode] = useState('');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [condition, setCondition] = useState('Good');
  const [completeness, setCompleteness] = useState('Complete');
  const [collectionId, setCollectionId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [shippingPlan, setShippingPlan] = useState('USPS Media Mail, buyer paid');
  const [skuPrefix, setSkuPrefix] = useState('FT-DVD');
  const [createDraft, setCreateDraft] = useState(true);

  function updateRow(id: number, patch: Partial<QueueRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  async function processScan(id: number, scannedBarcode: string) {
    try {
      updateRow(id, { status: 'Looking up' });
      const result = await lookupByBarcode({ barcode: scannedBarcode }) as LookupResult;
      const prepared = listingFields(result, condition, completeness);
      updateRow(id, { status: 'Saving', title: result.title, format: result.mediaFormat, confidence: result.confidence });
      const saved = await createScannedItem({
        type: result.type || 'Other Media', title: result.title, mediaFormat: result.mediaFormat || result.type,
        edition: result.edition, upc: result.barcode, barcodeType: result.barcodeType, releaseYear: result.releaseYear,
        releaseDate: result.releaseDate, studio: result.studio, author: result.author, rating: result.rating, coverImageUrl: result.coverImageUrl,
        metadataSource: result.source, metadataConfidence: result.confidence,
        collectionId: collectionId ? collectionId as Id<'collections'> : undefined,
        storageLocation: storageLocation.trim() || undefined, purchasePrice: optionalNumber(purchasePrice), condition, completeness,
        ebayTitle: prepared.title, ebayDescription: prepared.description, ebayCategory: categoryFor(result.type),
        ebayCondition: condition === 'New' || completeness === 'Sealed' ? 'Brand New' : condition,
        ebayItemSpecifics: prepared.specifics, ebayPrice: optionalNumber(listingPrice), ebayShipping: shippingPlan.trim() || undefined,
        createDraft, skuPrefix,
      });
      const review = result.confidence === 'Low' || result.mediaFormat === 'Unknown';
      updateRow(id, { status: review ? 'Review' : 'Saved', sku: saved.sku, copyNumber: saved.copyNumber, draftCreated: saved.listingId !== null, message: review ? (result.notes || 'Confirm title and format before publishing.') : undefined });
    } catch (error) {
      updateRow(id, { status: 'Review', message: error instanceof Error ? error.message : 'Scan could not be saved.' });
    } finally {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function enqueue(event?: FormEvent) {
    event?.preventDefault();
    const scannedBarcode = barcode.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (!scannedBarcode) return;
    const now = Date.now();
    if (lastScanRef.current.barcode === scannedBarcode && now - lastScanRef.current.at < 700) {
      setBarcode('');
      return;
    }
    lastScanRef.current = { barcode: scannedBarcode, at: now };
    const id = ++rowIdRef.current;
    setRows((current) => [{ id, barcode: scannedBarcode, status: 'Queued' }, ...current]);
    setBarcode('');
    pipelineRef.current = pipelineRef.current.then(() => processScan(id, scannedBarcode));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleScannerKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab' && barcode.trim()) {
      event.preventDefault();
      enqueue();
    }
  }

  function retry(row: QueueRow) {
    updateRow(row.id, { status: 'Queued', message: undefined });
    pipelineRef.current = pipelineRef.current.then(() => processScan(row.id, row.barcode));
  }

  const savedCount = rows.filter((row) => row.sku).length;
  const draftCount = rows.filter((row) => row.draftCreated).length;
  const reviewCount = rows.filter((row) => row.status === 'Review').length;
  const workingCount = rows.filter((row) => ['Queued', 'Looking up', 'Saving'].includes(row.status)).length;

  return (
    <section className="bulkIntakePage">
      <header className="guideHeader">
        <div><p className="eyebrow">USB scanner workflow</p><h2>Bulk Media Intake</h2><p>Scan physical copies into inventory and prepare eBay drafts without leaving the scanner field.</p></div>
        <div className="actions"><a className="button secondary" href="https://www.ebay.com/sh/reports" target="_blank" rel="noreferrer"><ExternalLink size={16}/> Seller Hub Reports</a><button className="secondary" onClick={() => { window.location.hash = '#listings'; }}><LayoutList size={16}/> Open Drafts</button></div>
      </header>

      <section className="bulkScannerBand">
        <div className="scannerReady"><Keyboard size={24}/><div><strong>{workingCount ? `${workingCount} processing` : 'Scanner ready'}</strong><span>USB scanner suffix: Enter or Tab</span></div></div>
        <form onSubmit={enqueue} className="bulkScanForm"><Barcode size={20}/><input ref={inputRef} autoFocus inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={handleScannerKey} placeholder="Scan UPC / EAN / ISBN" aria-label="USB barcode scanner input"/><button type="submit">Add Scan</button></form>
      </section>

      <section className="panel bulkDefaults">
        <div className="panelHeader"><div><h2>Defaults For This Stack</h2><p>Applied when each barcode reaches the front of the queue.</p></div></div>
        <div className="bulkDefaultsGrid">
          <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value)}>{['New','Like New','Very Good','Good','Acceptable','For Parts'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Completeness<select value={completeness} onChange={(event) => setCompleteness(event.target.value)}>{['Complete','Disc Only','Case Only','Case + Disc','Sealed','Incomplete'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Collection<select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">Unassigned</option>{collections.map((collection) => <option key={collection._id} value={collection._id}>{collection.name}</option>)}</select></label>
          <label>Storage bin<input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="DVD-A01"/></label>
          <label>Cost per item<input type="number" min="0" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} placeholder="0.50"/></label>
          <label>Default listing price<input type="number" min="0" step="0.01" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} placeholder="Leave blank for review"/></label>
          <label>SKU prefix<input value={skuPrefix} onChange={(event) => setSkuPrefix(event.target.value)} placeholder="FT-DVD"/></label>
          <label>Shipping plan<input value={shippingPlan} onChange={(event) => setShippingPlan(event.target.value)}/></label>
          <label className="checkRow bulkDraftToggle"><input type="checkbox" checked={createDraft} onChange={(event) => setCreateDraft(event.target.checked)}/><span><strong>Create eBay draft</strong><small>Internal FlipTracker draft with a unique SKU.</small></span></label>
        </div>
      </section>

      <section className="cards bulkIntakeCards"><div className="metric"><span>Scanned</span><strong>{rows.length}</strong></div><div className="metric"><span>Saved</span><strong>{savedCount}</strong></div><div className="metric"><span>Drafts</span><strong>{draftCount}</strong></div><div className="metric attention"><span>Needs Review</span><strong>{reviewCount}</strong></div></section>

      <section className="panel bulkQueuePanel">
        <div className="panelHeader"><div><h2>Scan Queue</h2><p>Low-confidence metadata is saved but held for review before eBay publishing.</p></div><button className="secondary" onClick={() => setRows((current) => current.filter((row) => row.status !== 'Saved'))}><Trash2 size={15}/> Clear Completed</button></div>
        {rows.length === 0 ? <div className="empty compact"><p>Ready for the first barcode.</p></div> : <div className="tableWrap"><table><thead><tr><th>Status</th><th>Barcode</th><th>Matched Item</th><th>SKU / Copy</th><th>Draft</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={row.status === 'Review' ? 'needsCheck' : ''}>
          <td><span className={`queueStatus ${row.status.toLowerCase().replace(/\s+/g, '-')}`}>{statusIcon(row.status)}{row.status}</span></td><td><strong>{row.barcode}</strong></td>
          <td><strong>{row.title || 'Waiting...'}</strong><small>{[row.format, row.confidence ? `${row.confidence} confidence` : ''].filter(Boolean).join(' · ')}</small>{row.message ? <small className="warningText">{row.message}</small> : null}</td>
          <td>{row.sku ? <><strong>{row.sku}</strong><small>Copy {row.copyNumber}</small></> : '—'}</td><td>{row.draftCreated ? <span className="badge draft">eBay Draft</span> : '—'}</td>
          <td>{row.status === 'Review' && !row.sku ? <button onClick={() => retry(row)}><RotateCcw size={14}/> Retry</button> : row.sku ? <button className="secondary" onClick={() => { window.location.hash = row.draftCreated ? '#listings' : '#inventory'; }}><ExternalLink size={14}/> Open</button> : '—'}</td>
        </tr>)}</tbody></table></div>}
      </section>
      <p className="directPublishNotice"><AlertTriangle size={16}/> Drafts are prepared inside FlipTracker. Direct eBay publishing stays disabled until seller OAuth and business policies are connected.</p>
    </section>
  );
}
