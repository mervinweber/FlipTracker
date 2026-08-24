import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Barcode, Camera, CheckCircle2, CircleDashed, ExternalLink, Images, Keyboard, LayoutList, Pause, Play, Plus, RotateCcw, Save, Trash2, WandSparkles, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
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
  id: string;
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
  const batches = useQuery(api.intakeBatches.list) || [];
  const lookupByBarcode = useAction(api.mediaLookup.lookupByBarcode);
  const createScannedItem = useMutation(api.intake.createScannedItem);
  const createBatch = useMutation(api.intakeBatches.create);
  const updateBatch = useMutation(api.intakeBatches.update);
  const setBatchStatus = useMutation(api.intakeBatches.setStatus);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControls = useRef<IScannerControls | null>(null);
  const pipelineRef = useRef<Promise<void>>(Promise.resolve());
  const lastScanRef = useRef({ barcode: '', at: 0 });
  const [barcode, setBarcode] = useState('');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [activeBatchId, setActiveBatchId] = useState('');
  const [batchName, setBatchName] = useState(`Intake ${new Date().toLocaleDateString()}`);
  const [batchSource, setBatchSource] = useState('');
  const [batchError, setBatchError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [condition, setCondition] = useState('Good');
  const [completeness, setCompleteness] = useState('Complete');
  const [collectionId, setCollectionId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [shippingPlan, setShippingPlan] = useState('USPS Media Mail, buyer paid');
  const [skuPrefix, setSkuPrefix] = useState('FT-DVD');
  const [createDraft, setCreateDraft] = useState(true);
  const batchItems = useQuery(api.intakeBatches.getItems, { batchId: activeBatchId ? activeBatchId as Id<'intakeBatches'> : undefined }) || [];

  useEffect(() => {
    if (activeBatchId || batches.length === 0) return;
    const batch = batches.find((candidate) => candidate.status === 'Active') || batches[0];
    selectBatch(String(batch._id));
  }, [activeBatchId, batches]);

  useEffect(() => {
    const persisted = batchItems.map((item) => ({
      id: item.scanToken,
      barcode: item.barcode,
      status: item.status as QueueStatus,
      title: item.title,
      format: item.mediaFormat,
      confidence: item.confidence,
      sku: item.sku,
      copyNumber: item.copyNumber,
      draftCreated: Boolean(item.listingId),
      message: item.message,
    }));
    setRows((current) => {
      const persistedIds = new Set(persisted.map((row) => row.id));
      const working = current.filter((row) => ['Queued', 'Looking up', 'Saving'].includes(row.status) && !persistedIds.has(row.id));
      return [...working, ...persisted];
    });
  }, [batchItems]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let cancelled = false;
    setCameraError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera scanning requires HTTPS and a browser with camera access.');
      return;
    }
    void (async () => {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (cancelled || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, videoRef.current, (result) => {
        if (!result || cancelled) return;
        enqueueBarcode(result.getText());
        navigator.vibrate?.(60);
      });
      if (cancelled) controls.stop();
      else scannerControls.current = controls;
    })().catch((error: unknown) => {
      if (cancelled) return;
      const name = error instanceof DOMException ? error.name : '';
      setCameraError(name === 'NotAllowedError' ? 'Camera permission is blocked. Allow it in browser settings, then retry.' : 'The camera could not start. Close other camera apps and retry.');
    });
    return () => {
      cancelled = true;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
  }, [cameraOpen, cameraAttempt]);

  function updateRow(id: string, patch: Partial<QueueRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function selectBatch(id: string) {
    setActiveBatchId(id);
    setRows([]);
    setBatchError('');
    const batch = batches.find((candidate) => String(candidate._id) === id);
    if (!batch) return;
    setBatchName(batch.name);
    setBatchSource(batch.source || '');
    setCondition(batch.defaultCondition || 'Good');
    setCompleteness(batch.defaultCompleteness || 'Complete');
    setCollectionId(batch.defaultCollectionId ? String(batch.defaultCollectionId) : '');
    setStorageLocation(batch.defaultStorageLocation || '');
    setPurchasePrice(batch.defaultPurchasePrice?.toString() || '');
    setListingPrice(batch.defaultListingPrice?.toString() || '');
    setShippingPlan(batch.defaultShippingPlan || 'USPS Media Mail, buyer paid');
    setSkuPrefix(batch.defaultSkuPrefix || 'FT-DVD');
    setCreateDraft(batch.createDraft);
  }

  function batchDefaults() {
    return {
      source: batchSource.trim() || undefined,
      defaultCondition: condition,
      defaultCompleteness: completeness,
      defaultCollectionId: collectionId ? collectionId as Id<'collections'> : undefined,
      defaultStorageLocation: storageLocation.trim() || undefined,
      defaultPurchasePrice: optionalNumber(purchasePrice),
      defaultListingPrice: optionalNumber(listingPrice),
      defaultShippingPlan: shippingPlan.trim() || undefined,
      defaultSkuPrefix: skuPrefix.trim() || undefined,
      createDraft,
    };
  }

  async function startBatch() {
    setBatchError('');
    try {
      const id = await createBatch({ name: batchName, ...batchDefaults() });
      setActiveBatchId(String(id));
      setRows([]);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'The intake batch could not be created.');
    }
  }

  async function saveBatchDefaults() {
    if (!activeBatchId) return;
    setBatchError('');
    try {
      await updateBatch({ id: activeBatchId as Id<'intakeBatches'>, name: batchName, ...batchDefaults() });
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'Batch defaults could not be saved.');
    }
  }

  async function processScan(id: string, scannedBarcode: string, targetBatchId: string) {
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
        createDraft, skuPrefix, batchId: targetBatchId as Id<'intakeBatches'>, scanToken: id,
      });
      const review = result.confidence === 'Low' || result.mediaFormat === 'Unknown';
      updateRow(id, { status: review ? 'Review' : 'Saved', sku: saved.sku, copyNumber: saved.copyNumber, draftCreated: saved.listingId !== null, message: review ? (result.notes || 'Confirm title and format before publishing.') : undefined });
    } catch (error) {
      updateRow(id, { status: 'Review', message: error instanceof Error ? error.message : 'Scan could not be saved.' });
    } finally {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function enqueueBarcode(rawBarcode: string) {
    if (!activeBatchId) {
      setBatchError('Start or select an intake batch before scanning.');
      return;
    }
    const scannedBarcode = rawBarcode.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (!scannedBarcode) return;
    const now = Date.now();
    if (lastScanRef.current.barcode === scannedBarcode && now - lastScanRef.current.at < 1200) return;
    lastScanRef.current = { barcode: scannedBarcode, at: now };
    const id = crypto.randomUUID();
    setRows((current) => [{ id, barcode: scannedBarcode, status: 'Queued' }, ...current]);
    pipelineRef.current = pipelineRef.current.then(() => processScan(id, scannedBarcode, activeBatchId));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function enqueue(event?: FormEvent) {
    event?.preventDefault();
    enqueueBarcode(barcode);
    setBarcode('');
  }

  function handleScannerKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab' && barcode.trim()) {
      event.preventDefault();
      enqueue();
    }
  }

  function retry(row: QueueRow) {
    if (!activeBatchId) return;
    updateRow(row.id, { status: 'Queued', message: undefined });
    pipelineRef.current = pipelineRef.current.then(() => processScan(row.id, row.barcode, activeBatchId));
  }

  const savedCount = rows.filter((row) => row.sku).length;
  const draftCount = rows.filter((row) => row.draftCreated).length;
  const reviewCount = rows.filter((row) => row.status === 'Review').length;
  const workingCount = rows.filter((row) => ['Queued', 'Looking up', 'Saving'].includes(row.status)).length;
  const selectedBatch = batches.find((batch) => String(batch._id) === activeBatchId);
  const batchCanScan = selectedBatch?.status === 'Active';
  const visibleRows = hideCompleted ? rows.filter((row) => row.status !== 'Saved') : rows;

  return (
    <section className="bulkIntakePage">
      <header className="guideHeader">
        <div><p className="eyebrow">USB scanner workflow</p><h2>Bulk Media Intake</h2><p>Scan physical copies into inventory and prepare eBay drafts without leaving the scanner field.</p></div>
        <div className="actions"><button className={cameraOpen ? 'active' : 'secondary'} disabled={!batchCanScan} onClick={() => setCameraOpen((open) => !open)}><Camera size={16}/>{cameraOpen ? 'Close Camera' : 'Camera Speed Mode'}</button><a className="button secondary" href="https://www.ebay.com/sh/reports" target="_blank" rel="noreferrer"><ExternalLink size={16}/> Seller Hub Reports</a><button className="secondary" onClick={() => { window.location.hash = '#listings'; }}><LayoutList size={16}/> Open Drafts</button></div>
      </header>

      <section className="panel intakeBatchPanel">
        <div className="panelHeader"><div><h2>Intake Batch</h2><p>Persist a stack so scanning can resume after a refresh or on another device.</p></div><span className={`badge ${selectedBatch?.status === 'Completed' ? 'sold' : 'draft'}`}>{selectedBatch?.status || 'Not started'}</span></div>
        <div className="intakeBatchGrid">
          <label>Open batch<select value={activeBatchId} onChange={(event) => selectBatch(event.target.value)}><option value="">New batch</option>{batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name} · {batch.status} · {batch.counts.total}</option>)}</select></label>
          <label>Batch name<input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="Saturday book lot"/></label>
          <label>Source<input value={batchSource} onChange={(event) => setBatchSource(event.target.value)} placeholder="Library sale, thrift store..."/></label>
          <div className="actions intakeBatchActions"><button onClick={startBatch}><Plus size={15}/> Start New</button>{activeBatchId ? <button className="secondary" onClick={saveBatchDefaults}><Save size={15}/> Save Defaults</button> : null}{selectedBatch?.status === 'Active' ? <button className="secondary" onClick={() => setBatchStatus({ id: selectedBatch._id, status: 'Paused' })}><Pause size={15}/> Pause</button> : selectedBatch?.status === 'Paused' ? <button className="secondary" onClick={() => setBatchStatus({ id: selectedBatch._id, status: 'Active' })}><Play size={15}/> Resume</button> : null}{selectedBatch && selectedBatch.status !== 'Completed' ? <button className="secondary" onClick={() => setBatchStatus({ id: selectedBatch._id, status: 'Completed' })}><CheckCircle2 size={15}/> Complete</button> : null}</div>
        </div>
        {batchError ? <p className="warningText">{batchError}</p> : null}
      </section>

      {cameraOpen ? <section className="panel speedCameraPanel"><header><div><strong>Continuous camera scanning</strong><small>Keep the barcode centered. Each accepted code vibrates and enters the same persisted queue as a USB scan.</small></div><button className="iconButton secondary" aria-label="Close camera" onClick={() => setCameraOpen(false)}><X size={17}/></button></header><div className="cameraFrame"><video ref={videoRef} muted playsInline autoPlay/></div>{cameraError ? <div className="actions"><p className="warningText">{cameraError}</p><button className="secondary" onClick={() => setCameraAttempt((attempt) => attempt + 1)}><RotateCcw size={14}/> Retry</button></div> : null}</section> : null}

      <section className="bulkScannerBand">
        <div className="scannerReady"><Keyboard size={24}/><div><strong>{workingCount ? `${workingCount} processing` : batchCanScan ? 'Scanner ready' : 'Select an active batch'}</strong><span>USB scanner suffix: Enter or Tab</span></div></div>
        <form onSubmit={enqueue} className="bulkScanForm"><Barcode size={20}/><input ref={inputRef} disabled={!batchCanScan} autoFocus inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={handleScannerKey} placeholder="Scan UPC / EAN / ISBN" aria-label="USB barcode scanner input"/><button type="submit" disabled={!batchCanScan}>Add Scan</button></form>
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

      {selectedBatch?.status === 'Completed' ? <section className="panel batchCompletionPanel">
        <div className="panelHeader"><div><p className="eyebrow">Batch complete</p><h2>{selectedBatch.name}</h2><p>{savedCount} items identified, {draftCount} listing drafts created, and {reviewCount} lookup exception{reviewCount === 1 ? '' : 's'} remain.</p></div><span className="badge sold"><CheckCircle2 size={14}/> Scanning finished</span></div>
        <div className="batchNextActions">
          <button onClick={() => { window.location.hash = '#photos'; }}><Images size={18}/><span><strong>Add item photos</strong><small>Work through drafts that require actual photos.</small></span></button>
          <button onClick={() => { window.location.hash = '#listings'; }}><WandSparkles size={18}/><span><strong>Fast review listings</strong><small>Approve routine details and isolate exceptions.</small></span></button>
          {reviewCount ? <button className="secondary" onClick={() => setHideCompleted(true)}><AlertTriangle size={18}/><span><strong>Resolve {reviewCount} scans</strong><small>Retry or correct low-confidence lookups.</small></span></button> : null}
        </div>
      </section> : null}

      <section className="panel bulkQueuePanel">
        <div className="panelHeader"><div><h2>Scan Queue</h2><p>Low-confidence metadata is saved but held for review before eBay publishing.</p></div><button className="secondary" onClick={() => setHideCompleted((hidden) => !hidden)}><Trash2 size={15}/>{hideCompleted ? 'Show Completed' : 'Hide Completed'}</button></div>
        {visibleRows.length === 0 ? <div className="empty compact"><p>{rows.length ? 'No exceptions in this batch.' : 'Ready for the first barcode.'}</p></div> : <div className="tableWrap"><table><thead><tr><th>Status</th><th>Barcode</th><th>Matched Item</th><th>SKU / Copy</th><th>Draft</th><th>Action</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id} className={row.status === 'Review' ? 'needsCheck' : ''}>
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
