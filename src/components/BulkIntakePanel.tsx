import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Barcode, Camera, CheckCircle2, CircleDashed, ExternalLink, ImagePlus, Images, Keyboard, LayoutList, Pause, Play, Plus, RotateCcw, Save, Trash2, WandSparkles, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { splitPhotoLotTotal } from '../utils/photoLot';
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

type PhotoLotRow = {
  id: string;
  title: string;
  console: string;
  edition: string;
  releaseYear: string;
  upc: string;
  condition: string;
  completeness: string;
  storageLocation: string;
  purchasePrice: string;
  estimatedLow?: number;
  estimatedHigh?: number;
  listingPrice: string;
  ebayTitle: string;
  ebayDescription: string;
  confidence: number;
  reviewNotes: string;
};

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDuration(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes < 60 ? `${minutes}m ${remainder}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

async function imageDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
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
  const identifyVideoGameLot = useAction(api.mediaLookup.identifyVideoGameLot);
  const createScannedItem = useMutation(api.intake.createScannedItem);
  const createPhotoLot = useMutation(api.intake.createPhotoLot);
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
  const [photoLotImage, setPhotoLotImage] = useState('');
  const [photoLotExpectedCount, setPhotoLotExpectedCount] = useState('3');
  const [photoLotTotal, setPhotoLotTotal] = useState('');
  const [photoLotSkuPrefix, setPhotoLotSkuPrefix] = useState('FT-GAME');
  const [photoLotShippingPlan, setPhotoLotShippingPlan] = useState('USPS Ground Advantage, buyer paid');
  const [photoLotRows, setPhotoLotRows] = useState<PhotoLotRow[]>([]);
  const [photoLotBusy, setPhotoLotBusy] = useState<'image' | 'identify' | 'save' | ''>('');
  const [photoLotError, setPhotoLotError] = useState('');
  const [photoLotNotice, setPhotoLotNotice] = useState('');
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

  async function selectPhotoLotImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoLotBusy('image');
    setPhotoLotError('');
    setPhotoLotNotice('');
    setPhotoLotRows([]);
    try {
      setPhotoLotImage(await imageDataUrl(file));
    } catch {
      setPhotoLotError('Could not read that photo. Use a JPEG, PNG, or WebP image.');
    } finally {
      setPhotoLotBusy('');
    }
  }

  async function analyzePhotoLot() {
    const expectedCount = Math.max(1, Math.min(12, Math.round(Number(photoLotExpectedCount) || 0)));
    if (!photoLotImage) {
      setPhotoLotError('Take or choose one clear group photo first.');
      return;
    }
    const adminKey = localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey') || '';
    if (!adminKey) {
      setPhotoLotError('Load your private access key in Seller Connection before using AI photo identification.');
      return;
    }
    setPhotoLotBusy('identify');
    setPhotoLotError('');
    setPhotoLotNotice('');
    try {
      const result = await identifyVideoGameLot({ adminKey, imageDataUrl: photoLotImage, expectedCount, condition, completeness });
      const allocatedCosts = splitPhotoLotTotal(photoLotTotal, result.items.length);
      const identified = result.items.map((item, index): PhotoLotRow => ({
        id: crypto.randomUUID(),
        title: item.title,
        console: item.console || '',
        edition: item.edition || '',
        releaseYear: item.releaseYear || '',
        upc: item.visibleBarcode || '',
        condition,
        completeness,
        storageLocation,
        purchasePrice: allocatedCosts[index],
        estimatedLow: item.estimatedLow,
        estimatedHigh: item.estimatedHigh,
        listingPrice: item.suggestedListPrice === undefined ? '' : item.suggestedListPrice.toFixed(2),
        ebayTitle: item.ebayTitle,
        ebayDescription: item.ebayDescription,
        confidence: item.confidence,
        reviewNotes: item.reviewNotes || '',
      }));
      setPhotoLotRows(identified);
      const countMessage = identified.length === expectedCount ? `${identified.length} games identified.` : `${identified.length} games identified; you expected ${expectedCount}.`;
      setPhotoLotNotice(`${countMessage} Review every row before creating records.${result.notes ? ` ${result.notes}` : ''}`);
    } catch (error) {
      setPhotoLotError(error instanceof Error ? error.message : 'The games could not be identified from this photo.');
    } finally {
      setPhotoLotBusy('');
    }
  }

  function updatePhotoLotRow(id: string, patch: Partial<PhotoLotRow>) {
    setPhotoLotRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function reallocatePhotoLotCost() {
    const costs = splitPhotoLotTotal(photoLotTotal, photoLotRows.length);
    setPhotoLotRows((current) => current.map((row, index) => ({ ...row, purchasePrice: costs[index] })));
  }

  async function savePhotoLot() {
    if (!activeBatchId || !batchCanScan) {
      setPhotoLotError('Start or select an active intake batch before creating the lot.');
      return;
    }
    if (!photoLotRows.length || photoLotRows.some((row) => !row.title.trim() || !row.ebayTitle.trim())) {
      setPhotoLotError('Every row needs an inventory title and eBay title.');
      return;
    }
    setPhotoLotBusy('save');
    setPhotoLotError('');
    setPhotoLotNotice('');
    try {
      const result = await createPhotoLot({
        batchId: activeBatchId as Id<'intakeBatches'>,
        source: batchSource.trim() || undefined,
        shippingPlan: photoLotShippingPlan.trim() || undefined,
        skuPrefix: photoLotSkuPrefix.trim() || 'FT-GAME',
        createDraft,
        items: photoLotRows.map((row) => ({
          scanToken: row.id,
          title: row.title.trim(),
          console: row.console.trim() || undefined,
          edition: row.edition.trim() || undefined,
          releaseYear: row.releaseYear.trim() || undefined,
          upc: row.upc.trim() || undefined,
          condition: row.condition,
          completeness: row.completeness,
          storageLocation: row.storageLocation.trim() || undefined,
          purchasePrice: optionalNumber(row.purchasePrice),
          estimatedLow: row.estimatedLow,
          estimatedHigh: row.estimatedHigh,
          ebayTitle: row.ebayTitle.trim(),
          ebayDescription: row.ebayDescription.trim(),
          ebayPrice: optionalNumber(row.listingPrice),
          confidence: row.confidence,
          reviewNotes: row.reviewNotes.trim() || undefined,
        })),
      });
      setPhotoLotRows([]);
      setPhotoLotImage('');
      setPhotoLotNotice(`${result.count} inventory records and ${result.draftCount} eBay drafts created. Open Photos to add each game's listing photos.`);
    } catch (error) {
      setPhotoLotError(error instanceof Error ? error.message : 'The reviewed photo lot could not be saved.');
    } finally {
      setPhotoLotBusy('');
    }
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

      <section className="panel photoLotPanel">
        <div className="panelHeader"><div><p className="eyebrow">AI-assisted intake</p><h2>Photo Lot</h2><p>Photograph several game fronts together, review the proposed records, then create inventory and eBay drafts in one pass.</p></div><span className="badge draft">Up to 12 games</span></div>
        <div className="photoLotStart">
          <div className="photoLotImage">
            {photoLotImage ? <img src={photoLotImage} alt="Game lot selected for identification"/> : <div><Images size={34}/><strong>One clear group photo</strong><small>Arrange front covers so every title and platform banner is readable.</small></div>}
            <label className="button secondary"><ImagePlus size={16}/>{photoLotImage ? 'Replace Photo' : 'Choose Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden disabled={Boolean(photoLotBusy)} onChange={selectPhotoLotImage}/></label>
          </div>
          <div className="photoLotInputs">
            <label>Number of games<input type="number" min="1" max="12" step="1" value={photoLotExpectedCount} onChange={(event) => setPhotoLotExpectedCount(event.target.value)}/></label>
            <label>Total paid for lot<input type="number" min="0" step="0.01" value={photoLotTotal} onChange={(event) => setPhotoLotTotal(event.target.value)} placeholder="15.00"/></label>
            <label>Game SKU prefix<input value={photoLotSkuPrefix} onChange={(event) => setPhotoLotSkuPrefix(event.target.value)} placeholder="FT-GAME"/></label>
            <label>Game shipping plan<input value={photoLotShippingPlan} onChange={(event) => setPhotoLotShippingPlan(event.target.value)}/></label>
            <p>Cost is split exactly across the identified games. You can adjust each row before saving.</p>
            <button disabled={!photoLotImage || Boolean(photoLotBusy)} onClick={analyzePhotoLot}><WandSparkles size={16}/>{photoLotBusy === 'identify' ? 'Identifying Games...' : 'Identify & Build Drafts'}</button>
          </div>
        </div>
        {photoLotError ? <p className="warningText">{photoLotError}</p> : null}
        {photoLotNotice ? <p className="photoLotNotice">{photoLotNotice}</p> : null}
        {photoLotRows.length ? <div className="photoLotReview">
          <div className="photoLotReviewHeader"><div><h3>Review before creating</h3><p>AI identification and price ranges are working estimates, not verified sold comps.</p></div><button className="secondary" onClick={reallocatePhotoLotCost}>Split ${optionalNumber(photoLotTotal)?.toFixed(2) || '0.00'} Again</button></div>
          {photoLotRows.map((row, index) => <article className="photoLotRow" key={row.id}>
            <header><span>{index + 1}</span><div><strong>{row.title || 'Untitled game'}</strong><small>{Math.round(row.confidence * 100)}% visual confidence{row.reviewNotes ? ` · ${row.reviewNotes}` : ''}</small></div><button className="iconButton danger" aria-label={`Remove ${row.title || `game ${index + 1}`}`} onClick={() => setPhotoLotRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={15}/></button></header>
            <div className="photoLotFields">
              <label>Game title<input value={row.title} onChange={(event) => updatePhotoLotRow(row.id, { title: event.target.value })}/></label>
              <label>Platform<input value={row.console} onChange={(event) => updatePhotoLotRow(row.id, { console: event.target.value })} placeholder="PlayStation 2, Xbox 360..."/></label>
              <label>Edition<input value={row.edition} onChange={(event) => updatePhotoLotRow(row.id, { edition: event.target.value })} placeholder="Greatest Hits, standard..."/></label>
              <label>UPC if visible<input inputMode="numeric" value={row.upc} onChange={(event) => updatePhotoLotRow(row.id, { upc: event.target.value.replace(/[^0-9Xx]/g, '').toUpperCase() })}/></label>
              <label>Condition<select value={row.condition} onChange={(event) => updatePhotoLotRow(row.id, { condition: event.target.value })}>{['New','Like New','Very Good','Good','Acceptable','For Parts'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Completeness<select value={row.completeness} onChange={(event) => updatePhotoLotRow(row.id, { completeness: event.target.value })}>{['Complete','Disc Only','Case Only','Case + Disc','No Manual','Sealed','Loose','Incomplete'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Allocated cost<input type="number" min="0" step="0.01" value={row.purchasePrice} onChange={(event) => updatePhotoLotRow(row.id, { purchasePrice: event.target.value })}/></label>
              <label>Working list price<input type="number" min="0" step="0.01" value={row.listingPrice} onChange={(event) => updatePhotoLotRow(row.id, { listingPrice: event.target.value })}/><small>{row.estimatedLow !== undefined || row.estimatedHigh !== undefined ? `AI range: $${row.estimatedLow?.toFixed(2) || '?'}–$${row.estimatedHigh?.toFixed(2) || '?'}` : 'No AI range returned'}</small></label>
              <label className="span2">eBay title <span>{row.ebayTitle.length}/80</span><input maxLength={80} value={row.ebayTitle} onChange={(event) => updatePhotoLotRow(row.id, { ebayTitle: event.target.value })}/></label>
              <label className="span2">Description<textarea value={row.ebayDescription} onChange={(event) => updatePhotoLotRow(row.id, { ebayDescription: event.target.value })}/></label>
              <label className="span2">Review notes<input value={row.reviewNotes} onChange={(event) => updatePhotoLotRow(row.id, { reviewNotes: event.target.value })} placeholder="Verify edition, inspect disc, missing manual..."/></label>
            </div>
          </article>)}
          <div className="actions right"><button className="secondary" disabled={Boolean(photoLotBusy)} onClick={() => setPhotoLotRows([])}>Discard Results</button><button disabled={Boolean(photoLotBusy) || !batchCanScan} onClick={savePhotoLot}><Save size={16}/>{photoLotBusy === 'save' ? 'Creating Records...' : `Create ${photoLotRows.length} Inventory + Draft Records`}</button></div>
        </div> : null}
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
        <div className="batchTimingGrid" aria-label="Batch throughput"><div><span>Session time</span><strong>{formatDuration(selectedBatch.timing.elapsedMs)}</strong></div><div><span>Average between scans</span><strong>{formatDuration(selectedBatch.timing.averageScanMs)}</strong></div><div><span>Staged ready</span><strong>{selectedBatch.counts.ready} / {selectedBatch.counts.total}</strong></div><div><span>Average scan to ready</span><strong>{formatDuration(selectedBatch.timing.averageScanToReadyMs)}</strong></div></div>
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
