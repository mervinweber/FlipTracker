import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { Barcode, BookOpen, Camera, Download, FolderPlus, Gauge, ImagePlus, Keyboard, LayoutList, PackageSearch, Plus, RefreshCw, Save, Search, Tags, Trash2, Upload, X } from 'lucide-react';
import { exportInventory, importInventoryFile } from './utils/excel';
import { InventoryItem, ListingRecommendation } from './types/inventory';
import ListingsPanel from './components/ListingsPanel';
import QuickGuide from './components/QuickGuide';
import BulkIntakePanel from './components/BulkIntakePanel';
import SourcingPanel from './components/SourcingPanel';
import PhotoQueuePanel from './components/PhotoQueuePanel';

type AppView = 'Inventory' | 'Listings' | 'Bulk' | 'Photos' | 'Sourcing' | 'Guide';

function viewFromHash(): AppView {
  if (window.location.hash.toLowerCase() === '#guide') return 'Guide';
  if (window.location.hash.toLowerCase() === '#sourcing') return 'Sourcing';
  if (window.location.hash.toLowerCase() === '#photos') return 'Photos';
  if (window.location.hash.toLowerCase() === '#bulk') return 'Bulk';
  if (window.location.hash.toLowerCase() === '#listings') return 'Listings';
  return 'Inventory';
}

type Asset = {
  _id: Id<'assets'>;
  type: string;
  console?: string;
  title: string;
  edition?: string;
  mediaFormat?: string;
  upc?: string;
  barcode?: string;
  barcodeType?: string;
  releaseYear?: string;
  releaseDate?: string;
  studio?: string;
  rating?: string;
  coverImageUrl?: string;
  photoDataUrl?: string;
  metadataSource?: string;
  metadataConfidence?: string;
  metadataCheckedAt?: number;
  collectionId?: Id<'collections'>;
  storageLocation?: string;
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
  listingRecommendation?: ListingRecommendation | string;
  status?: string;
  purchasePrice?: number;
  soldPrice?: number;
  fees?: number;
  shipping?: number;
  condition?: string;
  completeness?: string;
  complete?: boolean;
  manual?: boolean;
  notes?: string;
  confidence?: string;
  ebayTitle?: string;
  ebayDescription?: string;
  ebayCategory?: string;
  ebayCondition?: string;
  ebayItemSpecifics?: string;
  ebayPrice?: number;
  ebayShipping?: string;
};

type Collection = {
  _id: Id<'collections'>;
  name: string;
  source?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  location?: string;
  notes?: string;
};

type ResearchDraft = {
  source: string;
  low?: number;
  high?: number;
  observedPrice?: number;
  url?: string;
  confidence: string;
  recommendation?: string;
  notes?: string;
};

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
  rating?: string;
  coverImageUrl?: string;
  source: string;
  confidence: string;
  notes?: string;
};

const MEDIA_TYPES = ['Video Game', 'DVD', 'Blu-ray', 'CD', 'Book', 'Other Media', 'Pokemon Card', 'Sports Card', 'Toy', 'Misc'];
const CONDITIONS = ['New', 'Like New', 'Very Good', 'Good', 'Acceptable', 'For Parts'];
const COMPLETENESS = ['Complete', 'Disc Only', 'Case Only', 'Case + Disc', 'No Manual', 'Sealed', 'Loose', 'Incomplete'];
const TERAPEAK_VALUE_THRESHOLD = 50;

function researchValue(item: Partial<Asset>, ...candidateValues: Array<number | undefined>) {
  const assetValue = item.valueSource === 'User Override'
    ? item.userHigh || item.userLow
    : item.estimatedHigh || item.estimatedLow;
  return Math.max(0, item.ebayPrice || 0, assetValue || 0, ...candidateValues.map(value => value || 0));
}

function shouldShowTerapeak(item: Partial<Asset>, ...candidateValues: Array<number | undefined>) {
  return researchValue(item, ...candidateValues) >= TERAPEAK_VALUE_THRESHOLD;
}

function researchQuery(item: Partial<Asset>) {
  const barcode = item.upc || item.barcode;
  return barcode || [item.title, item.edition, item.mediaFormat || item.console || item.type]
    .filter(Boolean)
    .join(' ');
}

function effectiveLow(item: Asset) {
  return item.valueSource === 'User Override' ? item.userLow || 0 : item.estimatedLow || 0;
}

function effectiveHigh(item: Asset) {
  return item.valueSource === 'User Override' ? item.userHigh || 0 : item.estimatedHigh || 0;
}

function effectiveAverage(item: Asset) {
  return (effectiveLow(item) + effectiveHigh(item)) / 2;
}

function priorityFromValue(item: Partial<Asset>) {
  const high = item.valueSource === 'User Override' ? item.userHigh || 0 : item.estimatedHigh || 0;
  if (high >= 20) return 'List First';
  if (high >= 10) return 'Worth Listing';
  return 'Bundle';
}

function recommendationFromAsset(item: Partial<Asset>): ListingRecommendation {
  const high = item.valueSource === 'User Override' ? item.userHigh || 0 : item.estimatedHigh || 0;
  const condition = (item.condition || '').toLowerCase();
  const complete = (item.completeness || '').toLowerCase();
  if (condition.includes('parts') || complete === 'case only') return 'Skip';
  if (high >= 12 || item.type === 'Book') return 'Sell Individually';
  if (high >= 5 || ['DVD', 'Blu-ray', 'CD'].includes(item.type || '')) return 'Bundle';
  return 'Review';
}

function ebayCategoryFor(item: Partial<Asset>) {
  if (item.type === 'Blu-ray') return 'Movies & TV > DVDs & Blu-ray Discs';
  if (item.type === 'DVD') return 'Movies & TV > DVDs & Blu-ray Discs';
  if (item.type === 'CD') return 'Music > CDs';
  if (item.type === 'Book') return 'Books & Magazines > Books';
  if (item.type === 'Video Game') return 'Video Games & Consoles > Video Games';
  return 'Everything Else > Other';
}

function ebayConditionFor(item: Partial<Asset>) {
  if (item.condition === 'New' || item.completeness === 'Sealed') return 'Brand New';
  if (item.condition === 'Like New') return 'Like New';
  if (item.condition === 'Very Good') return 'Very Good';
  if (item.condition === 'Acceptable') return 'Acceptable';
  if (item.condition === 'For Parts') return 'For parts or not working';
  return 'Good';
}

function generateEbayTitle(item: Partial<Asset>) {
  return [item.title, item.edition, item.mediaFormat || (item.type === 'Video Game' ? item.console : item.type), item.releaseYear]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function generateDescription(item: Partial<Asset>) {
  const lines = [
    `${item.title || 'Media item'}${item.edition ? ` - ${item.edition}` : ''}`,
    item.mediaFormat || item.type ? `Format: ${item.mediaFormat || item.type}` : '',
    item.condition ? `Condition: ${item.condition}` : '',
    item.completeness ? `Completeness: ${item.completeness}` : '',
    item.upc || item.barcode ? `UPC/Barcode: ${item.upc || item.barcode}` : '',
    item.storageLocation ? `Internal bin: ${item.storageLocation}` : '',
    item.notes ? `Notes: ${item.notes}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function listingSpecifics(item: Partial<Asset>) {
  return [
    item.mediaFormat ? `Format: ${item.mediaFormat}` : '',
    item.studio ? `Studio/Publisher: ${item.studio}` : '',
    item.rating ? `Rating: ${item.rating}` : '',
    item.releaseYear ? `Release Year: ${item.releaseYear}` : '',
    item.upc || item.barcode ? `UPC: ${item.upc || item.barcode}` : '',
  ].filter(Boolean).join('\n');
}

function listingDeliveryDefaults(item: Partial<Asset>) {
  const format = `${item.mediaFormat || ''} ${item.type || ''}`.toLowerCase();
  const isSingleMediaCase = format.includes('dvd') || format.includes('blu') || format.includes('cd');
  const isBookWithCover = format.includes('book') && Boolean(item.coverImageUrl);
  const isNew = ['new', 'brand new', 'sealed'].includes(item.condition?.trim().toLowerCase() || '') || item.completeness?.trim().toLowerCase() === 'sealed';
  return {
    imageMode: isNew || isBookWithCover ? 'eBay Catalog' : 'Actual Item Photo',
    shippingPreset: isSingleMediaCase ? 'Single Media Mailer' : undefined,
    packageType: isSingleMediaCase ? 'PACKAGE_THICK_ENVELOPE' : undefined,
    packageWeightOz: isSingleMediaCase ? 8 : undefined,
    packageLengthIn: isSingleMediaCase ? 10 : undefined,
    packageWidthIn: isSingleMediaCase ? 7 : undefined,
    packageHeightIn: isSingleMediaCase ? 1 : undefined,
  };
}

function recalcAsset(item: Partial<Asset>): Partial<Asset> {
  const next = { ...item };
  next.listingRecommendation = recommendationFromAsset(next);
  next.priority = next.priority || priorityFromValue(next);
  next.strategy = next.listingRecommendation === 'Sell Individually' ? 'Flip Now' : next.listingRecommendation || next.strategy || 'Review';
  next.ebayTitle = generateEbayTitle(next);
  next.ebayDescription = generateDescription(next);
  next.ebayCategory = ebayCategoryFor(next);
  next.ebayCondition = ebayConditionFor(next);
  next.ebayItemSpecifics = listingSpecifics(next);
  next.ebayPrice = next.valueSource === 'User Override' ? next.userHigh || next.userLow : next.estimatedHigh || next.estimatedLow;
  next.ebayShipping = next.ebayShipping || (['DVD', 'Blu-ray', 'CD', 'Book'].includes(next.type || '') ? 'USPS Media Mail, buyer paid' : 'Calculated shipping');
  return next;
}

function badgeClass(value?: string) {
  return `badge ${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function blankAsset(): Partial<Asset> {
  return recalcAsset({
    type: 'Video Game',
    console: '',
    title: '',
    status: 'Inventory',
    valueSource: 'Estimated',
    condition: 'Good',
    completeness: 'Complete',
    strategy: 'Flip Now',
  });
}

function blankCollection(): Partial<Collection> {
  return { name: '', source: '', location: '' };
}

function blankResearchDraft(): ResearchDraft {
  return { source: 'eBay Sold', confidence: 'Medium', recommendation: 'Review' };
}

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toInventoryForExport(asset: Asset, collectionName = ''): InventoryItem {
  return {
    type: (asset.type as InventoryItem['type']) || 'Video Game',
    console: asset.console,
    title: asset.title,
    edition: asset.edition,
    mediaFormat: asset.mediaFormat,
    upc: asset.upc,
    barcode: asset.barcode,
    barcodeType: asset.barcodeType,
    releaseYear: asset.releaseYear,
    releaseDate: asset.releaseDate,
    studio: asset.studio,
    rating: asset.rating,
    coverImageUrl: asset.coverImageUrl,
    photoDataUrl: asset.photoDataUrl,
    metadataSource: asset.metadataSource,
    metadataConfidence: asset.metadataConfidence,
    collectionName,
    storageLocation: asset.storageLocation,
    estLow: asset.estimatedLow,
    estHigh: asset.estimatedHigh,
    userLow: asset.userLow,
    userHigh: asset.userHigh,
    valueSource: asset.valueSource as InventoryItem['valueSource'],
    needsValueCheck: asset.needsValueCheck,
    localLow: asset.localLow,
    localHigh: asset.localHigh,
    priority: asset.priority,
    strategy: asset.strategy,
    listingRecommendation: asset.listingRecommendation as ListingRecommendation,
    status: asset.status,
    purchasePrice: asset.purchasePrice,
    soldPrice: asset.soldPrice,
    fees: asset.fees,
    shipping: asset.shipping,
    condition: asset.condition,
    completeness: asset.completeness,
    complete: asset.complete,
    manual: asset.manual,
    notes: asset.notes,
    confidence: asset.confidence,
    ebayTitle: asset.ebayTitle,
    ebayDescription: asset.ebayDescription,
    ebayCategory: asset.ebayCategory,
    ebayCondition: asset.ebayCondition,
    ebayItemSpecifics: asset.ebayItemSpecifics,
    ebayPrice: asset.ebayPrice,
    ebayShipping: asset.ebayShipping,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxSide = 720;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(viewFromHash);
  const [query, setQuery] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [collectionFilter, setCollectionFilter] = useState('All');
  const [editing, setEditing] = useState<Partial<Asset> | null>(null);
  const [editingCollection, setEditingCollection] = useState<Partial<Collection> | null>(null);
  const [researchAsset, setResearchAsset] = useState<Asset | null>(null);
  const [researchDraft, setResearchDraft] = useState<ResearchDraft>(blankResearchDraft());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanError, setScanError] = useState('');
  const [scannerAttempt, setScannerAttempt] = useState(0);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [createDraftAfterSave, setCreateDraftAfterSave] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControls = useRef<IScannerControls | null>(null);

  const dashboard = useQuery(api.reports.dashboard);
  const collections = useQuery(api.collections.list);
  const assets = useQuery(api.assets.list, {
    search: query || undefined,
    console: consoleFilter === 'All' ? undefined : consoleFilter,
    status: statusFilter === 'All' ? undefined : statusFilter,
    collectionId: collectionFilter !== 'All' && collectionFilter !== 'Unassigned' ? collectionFilter as Id<'collections'> : undefined,
    unassignedOnly: collectionFilter === 'Unassigned' ? true : undefined,
  });

  const createAsset = useMutation(api.assets.create);
  const updateAsset = useMutation(api.assets.update);
  const removeAsset = useMutation(api.assets.remove);
  const importMany = useMutation(api.assets.importMany);
  const createCollection = useMutation(api.collections.create);
  const updateCollection = useMutation(api.collections.update);
  const removeCollection = useMutation(api.collections.remove);
  const addValueCheck = useMutation(api.research.addValueCheck);
  const createListing = useMutation(api.listings.create);
  const lookupByBarcode = useAction(api.mediaLookup.lookupByBarcode);

  const isLoading = assets === undefined || dashboard === undefined || collections === undefined;
  const rows: Asset[] = assets || [];
  const collectionRows: Collection[] = collections || [];

  useEffect(() => {
    document.body.classList.toggle('modalOpen', editing !== null || editingCollection !== null || researchAsset !== null || scannerOpen);
    return () => document.body.classList.remove('modalOpen');
  }, [editing, editingCollection, researchAsset, scannerOpen]);

  useEffect(() => {
    const syncView = () => setActiveView(viewFromHash());
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  function changeView(view: AppView) {
    setActiveView(view);
    window.history.replaceState(null, '', view === 'Inventory' ? '#inventory' : `#${view.toLowerCase()}`);
  }

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setScanError('');

    if (!window.isSecureContext) {
      setScanError('Camera scanning requires HTTPS on a phone. Open the deployed Vercel app, or enter the barcode manually.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('This browser does not provide camera access. Try Safari or Chrome, or enter the barcode manually.');
      return;
    }

    void reader.decodeFromConstraints({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }, videoRef.current, (result, _error, controls) => {
      if (result && !cancelled) {
        const code = result.getText();
        setManualBarcode(code);
        controls.stop();
        void lookupBarcode(code);
      }
    }).then((controls) => {
      if (cancelled) controls.stop();
      else scannerControls.current = controls;
    }).catch((error: unknown) => {
      if (cancelled) return;
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setScanError('Camera permission is blocked. Allow camera access for this site in browser settings, then select Retry Camera.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setScanError('No usable camera was found on this device. Enter the barcode manually if needed.');
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        setScanError('The camera is busy in another app or browser tab. Close it there, then select Retry Camera.');
      } else {
        setScanError('The camera could not start. Close other camera apps, check browser permission, then select Retry Camera.');
      }
    });

    return () => {
      cancelled = true;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
  }, [scannerOpen, scannerAttempt]);

  const consoles = useMemo(() => {
    const values = Array.from(new Set(rows.map((item) => item.console || '').filter(Boolean))).sort();
    return ['All', ...values];
  }, [rows]);

  const collectionOptions = useMemo(() => ['All', 'Unassigned', ...collectionRows.map((collection) => collection._id)], [collectionRows]);

  const collectionSummaries = useMemo(() => {
    return collectionRows.map((collection) => {
      const collectionAssets = rows.filter((item) => item.collectionId === collection._id);
      const estimatedValue = collectionAssets.reduce((sum, item) => sum + effectiveAverage(item), 0);
      return { collection, assetCount: collectionAssets.length, estimatedValue, estimatedProfit: estimatedValue - (collection.purchasePrice || 0) };
    });
  }, [collectionRows, rows]);

  function collectionName(id?: Id<'collections'>) {
    if (!id) return '';
    return collectionRows.find((collection) => collection._id === id)?.name || '';
  }

  function updateEditing(patch: Partial<Asset>, shouldRecalc = true) {
    setEditing((current) => {
      const next = { ...(current || {}), ...patch };
      return shouldRecalc ? recalcAsset(next) : next;
    });
  }

  async function lookupBarcode(barcodeInput = manualBarcode) {
    const barcode = barcodeInput.trim();
    if (!barcode) return;
    setIsLookingUp(true);
    setScanError('');
    try {
      const result = await lookupByBarcode({ barcode }) as LookupResult;
      const draft = recalcAsset({
        ...blankAsset(),
        type: result.type || 'Other Media',
        mediaFormat: result.mediaFormat || result.type,
        title: result.title,
        edition: result.edition,
        barcode: result.barcode,
        upc: result.barcode,
        barcodeType: result.barcodeType,
        releaseYear: result.releaseYear,
        releaseDate: result.releaseDate,
        studio: result.studio,
        rating: result.rating,
        coverImageUrl: result.coverImageUrl,
        metadataSource: result.source,
        metadataConfidence: result.confidence,
        metadataCheckedAt: Date.now(),
        confidence: result.confidence,
        needsValueCheck: true,
        notes: result.notes,
      });
      scannerControls.current?.stop();
      setScannerOpen(false);
      setManualBarcode('');
      setCreateDraftAfterSave(true);
      setEditing(draft);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Lookup failed. Enter details manually.');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function saveAsset() {
    if (!editing?.title?.trim()) return;
    const prepared = recalcAsset(editing);
    const patch = {
      type: prepared.type || 'Video Game',
      console: prepared.console || undefined,
      title: prepared.title!.trim(),
      edition: prepared.edition || undefined,
      mediaFormat: prepared.mediaFormat || undefined,
      upc: prepared.upc || prepared.barcode || undefined,
      barcode: prepared.barcode || prepared.upc || undefined,
      barcodeType: prepared.barcodeType || undefined,
      releaseYear: prepared.releaseYear || undefined,
      releaseDate: prepared.releaseDate || undefined,
      studio: prepared.studio || undefined,
      rating: prepared.rating || undefined,
      coverImageUrl: prepared.coverImageUrl || undefined,
      photoDataUrl: prepared.photoDataUrl || undefined,
      metadataSource: prepared.metadataSource || undefined,
      metadataConfidence: prepared.metadataConfidence || undefined,
      metadataCheckedAt: prepared.metadataCheckedAt,
      collectionId: prepared.collectionId,
      storageLocation: prepared.storageLocation || undefined,
      estimatedLow: prepared.estimatedLow,
      estimatedHigh: prepared.estimatedHigh,
      userLow: prepared.userLow,
      userHigh: prepared.userHigh,
      valueSource: prepared.valueSource || 'Estimated',
      needsValueCheck: prepared.needsValueCheck,
      localLow: prepared.localLow,
      localHigh: prepared.localHigh,
      priority: prepared.priority || priorityFromValue(prepared),
      strategy: prepared.strategy || 'Review',
      listingRecommendation: prepared.listingRecommendation || recommendationFromAsset(prepared),
      status: prepared.status || 'Inventory',
      purchasePrice: prepared.purchasePrice,
      soldPrice: prepared.soldPrice,
      fees: prepared.fees,
      shipping: prepared.shipping,
      condition: prepared.condition || undefined,
      completeness: prepared.completeness || undefined,
      complete: prepared.complete,
      manual: prepared.manual,
      ebayTitle: prepared.ebayTitle || undefined,
      ebayDescription: prepared.ebayDescription || undefined,
      ebayCategory: prepared.ebayCategory || undefined,
      ebayCondition: prepared.ebayCondition || undefined,
      ebayItemSpecifics: prepared.ebayItemSpecifics || undefined,
      ebayPrice: prepared.ebayPrice,
      ebayShipping: prepared.ebayShipping || undefined,
      notes: prepared.notes || undefined,
      confidence: prepared.confidence || undefined,
    };

    if ('_id' in editing && editing._id) {
      await updateAsset({ id: editing._id as Id<'assets'>, ...patch });
    } else {
      const assetId = await createAsset(patch);
      if (createDraftAfterSave) {
        await createListingDraft({ ...prepared, ...patch, _id: assetId } as Asset);
      }
    }
    setCreateDraftAfterSave(false);
    setEditing(null);
  }

  async function saveCollection() {
    if (!editingCollection?.name?.trim()) return;
    const patch = {
      name: editingCollection.name.trim(),
      source: editingCollection.source || undefined,
      purchaseDate: editingCollection.purchaseDate || undefined,
      purchasePrice: editingCollection.purchasePrice,
      location: editingCollection.location || undefined,
      notes: editingCollection.notes || undefined,
    };
    if ('_id' in editingCollection && editingCollection._id) await updateCollection({ id: editingCollection._id as Id<'collections'>, ...patch });
    else await createCollection(patch);
    setEditingCollection(null);
  }

  async function deleteAsset(id: Id<'assets'>) {
    if (!confirm('Remove this item? Totals and reports will update automatically.')) return;
    await removeAsset({ id });
  }

  async function createListingDraft(asset: Asset) {
    const price = asset.ebayPrice ?? effectiveHigh(asset) ?? undefined;
    await createListing({
      assetId: asset._id,
      platform: 'eBay',
      status: 'Draft',
      title: asset.ebayTitle || generateEbayTitle(asset) || asset.title,
      description: asset.ebayDescription || generateDescription(asset),
      category: asset.ebayCategory || ebayCategoryFor(asset),
      condition: asset.ebayCondition || ebayConditionFor(asset),
      language: 'English',
      itemSpecifics: asset.ebayItemSpecifics || listingSpecifics(asset),
      listedPrice: price || undefined,
      currentPrice: price || undefined,
      notes: asset.ebayShipping ? `Shipping plan: ${asset.ebayShipping}` : undefined,
      ...listingDeliveryDefaults(asset),
    });
    changeView('Listings');
  }

  async function deleteCollection(id: Id<'collections'>) {
    if (!confirm('Remove this collection? Items will stay in inventory and become unassigned.')) return;
    await removeCollection({ id });
  }

  async function onImport(file?: File) {
    if (!file) return;
    const imported = await importInventoryFile(file);
    await importMany({
      assets: imported.map((item) => {
        const prepared = recalcAsset({
          type: item.type || 'Video Game',
          console: item.console || undefined,
          title: item.title,
          edition: item.edition || undefined,
          mediaFormat: item.mediaFormat || undefined,
          upc: item.upc || item.barcode || undefined,
          barcode: item.barcode || item.upc || undefined,
          barcodeType: item.barcodeType || undefined,
          releaseYear: item.releaseYear || undefined,
          releaseDate: item.releaseDate || undefined,
          studio: item.studio || undefined,
          rating: item.rating || undefined,
          coverImageUrl: item.coverImageUrl || undefined,
          metadataSource: item.metadataSource || undefined,
          metadataConfidence: item.metadataConfidence || undefined,
          storageLocation: item.storageLocation || undefined,
          estimatedLow: item.estLow,
          estimatedHigh: item.estHigh,
          userLow: item.userLow,
          userHigh: item.userHigh,
          valueSource: item.valueSource || 'Estimated',
          needsValueCheck: item.needsValueCheck,
          localLow: item.localLow,
          localHigh: item.localHigh,
          priority: item.priority,
          strategy: item.strategy,
          listingRecommendation: item.listingRecommendation,
          status: item.status || 'Inventory',
          purchasePrice: item.purchasePrice,
          soldPrice: item.soldPrice,
          fees: item.fees,
          shipping: item.shipping,
          condition: item.condition || undefined,
          completeness: item.completeness || undefined,
          complete: item.complete,
          manual: item.manual,
          ebayTitle: item.ebayTitle || undefined,
          ebayDescription: item.ebayDescription || undefined,
          ebayCategory: item.ebayCategory || undefined,
          ebayCondition: item.ebayCondition || undefined,
          ebayItemSpecifics: item.ebayItemSpecifics || undefined,
          ebayPrice: item.ebayPrice,
          ebayShipping: item.ebayShipping || undefined,
          notes: item.notes,
          confidence: item.confidence,
        });
        return { ...prepared, type: prepared.type || 'Video Game', title: item.title };
      }),
    });
  }

  function openQuickSoldComps(asset: Partial<Asset>) {
    const search = encodeURIComponent(researchQuery(asset));
    window.open(`https://www.ebay.com/sch/i.html?_nkw=${search}&LH_Sold=1&LH_Complete=1`, '_blank');
  }

  function openTerapeakResearch(asset: Partial<Asset>) {
    const search = encodeURIComponent(researchQuery(asset));
    window.open(`https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${search}`, '_blank');
  }

  function openResearchLog(asset: Asset) {
    setResearchAsset(asset);
    setResearchDraft({ ...blankResearchDraft(), low: effectiveLow(asset) || undefined, high: effectiveHigh(asset) || undefined, recommendation: asset.listingRecommendation || asset.strategy || priorityFromValue(asset) });
  }

  async function saveResearchLog() {
    if (!researchAsset) return;
    await addValueCheck({
      assetId: researchAsset._id,
      source: researchDraft.source,
      low: researchDraft.low,
      high: researchDraft.high,
      observedPrice: researchDraft.observedPrice,
      url: researchDraft.url || undefined,
      notes: researchDraft.notes || undefined,
      confidence: researchDraft.confidence,
      recommendation: researchDraft.recommendation || undefined,
    });
    setResearchAsset(null);
    setResearchDraft(blankResearchDraft());
  }

  async function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoDataUrl = await compressImage(file);
    updateEditing({ photoDataUrl }, false);
  }

  return (
    <main className="app">
      <header className="hero">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true"><Tags size={24}/></div>
          <div>
            <p className="eyebrow">Collector resale command center</p>
            <h1>FlipTracker</h1>
            <p>Track games, DVDs, Blu-rays, books, CDs, and resale media from scan to listing plan.</p>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => { setCreateDraftAfterSave(false); setScannerOpen(true); }}><Barcode size={16}/> Scan Media</button>
          <button onClick={() => changeView('Bulk')}><Keyboard size={16}/> Scan Stack</button>
          <button onClick={() => changeView('Photos')}><Camera size={16}/> Add Photos</button>
          <button onClick={() => { setCreateDraftAfterSave(false); setEditing(blankAsset()); }}><Plus size={16}/> Add Item</button>
          <button className="secondary" onClick={() => setEditingCollection(blankCollection())}><FolderPlus size={16}/> Add Collection</button>
          <label className="button"><Upload size={16}/> Import Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => onImport(e.target.files?.[0])}/></label>
          <button onClick={() => exportInventory(rows.map((item) => toInventoryForExport(item, collectionName(item.collectionId))))}><Download size={16}/> Export Excel</button>
        </div>
      </header>

      <nav className="viewTabs" aria-label="Primary views">
        <button className={activeView === 'Inventory' ? 'active' : 'secondary'} onClick={() => changeView('Inventory')}><PackageSearch size={17}/> Inventory</button>
        <button className={activeView === 'Listings' ? 'active' : 'secondary'} onClick={() => changeView('Listings')}><LayoutList size={17}/> Listings</button>
        <button className={activeView === 'Bulk' ? 'active' : 'secondary'} onClick={() => changeView('Bulk')}><Keyboard size={17}/> Bulk Intake</button>
        <button className={activeView === 'Photos' ? 'active' : 'secondary'} onClick={() => changeView('Photos')}><Camera size={17}/> Photos</button>
        <button className={activeView === 'Sourcing' ? 'active' : 'secondary'} onClick={() => changeView('Sourcing')}><Gauge size={17}/> Sourcing</button>
        <button className={activeView === 'Guide' ? 'active' : 'secondary'} onClick={() => changeView('Guide')}><BookOpen size={17}/> Quick Guide</button>
      </nav>

      {activeView === 'Inventory' ? <><section className="cards">
        <div className="metric"><span>Total Assets</span><strong>{dashboard?.assetCount ?? '-'}</strong></div>
        <div className="metric"><span>Collections</span><strong>{dashboard?.collectionCount ?? '-'}</strong></div>
        <div className="metric"><span>Estimated Value</span><strong>{dashboard ? `$${dashboard.estimatedValue.toFixed(0)}` : '-'}</strong></div>
        <div className="metric attention"><span>Need Value Check</span><strong>{dashboard?.needsValueCheck ?? '-'}</strong></div>
      </section>

      <section className="panel controls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search inventory..." value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select value={consoleFilter} onChange={e => setConsoleFilter(e.target.value)}>{consoles.map(c => <option key={c}>{c}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{['All','Inventory','Listed','Sold','Hold','Bundle'].map(s => <option key={s}>{s}</option>)}</select>
        <select value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}>{collectionOptions.map(c => <option key={c} value={c}>{c === 'All' || c === 'Unassigned' ? c : collectionName(c as Id<'collections'>)}</option>)}</select>
        <button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/> Refresh</button>
      </section>

      <section className="panel collectionPanel">
        <div className="panelHeader">
          <div><h2>Collections</h2><p>Track purchase lots, source, buy price, and estimated return.</p></div>
          <button className="secondary" onClick={() => setEditingCollection(blankCollection())}><FolderPlus size={16}/> Add Collection</button>
        </div>
        {collectionRows.length === 0 ? <div className="empty compact"><p>No collections yet. Create one for a purchase lot, marketplace pickup, or sourcing run.</p></div> : (
          <div className="collectionGrid">
            {collectionSummaries.map(({ collection, assetCount, estimatedValue, estimatedProfit }) => (
              <article className="collectionCard" key={collection._id}>
                <div><h3>{collection.name}</h3><p>{[collection.source, collection.location, collection.purchaseDate].filter(Boolean).join(' · ')}</p></div>
                <div className="collectionStats"><span>{assetCount} item{assetCount === 1 ? '' : 's'}</span><strong>${estimatedValue.toFixed(0)}</strong><small>Est. profit ${estimatedProfit.toFixed(0)}</small></div>
                <div className="rowActions"><button onClick={() => setCollectionFilter(collection._id)}>View</button><button className="secondary" onClick={() => setEditingCollection(collection)}>Edit</button><button className="danger iconButton" aria-label={`Delete ${collection.name}`} onClick={() => deleteCollection(collection._id)}><Trash2 size={14}/></button></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader"><div><h2>Inventory</h2><p>{isLoading ? 'Loading Convex data...' : `${rows.length} item${rows.length === 1 ? '' : 's'} in the current view`}</p></div></div>
        {isLoading ? <p>Loading Convex data...</p> : rows.length === 0 ? <div className="empty"><h2>No inventory yet</h2><p>Import your spreadsheet, add your first item, or scan media.</p></div> : (
          <div className="tableWrap">
            <table className="inventoryTable">
              <thead><tr><th>Format</th><th>Title</th><th>Collection</th><th>Location</th><th>Value</th><th>Source</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.slice().sort((a, b) => (a.console || a.mediaFormat || '').localeCompare(b.console || b.mediaFormat || '') || effectiveHigh(b) - effectiveHigh(a)).map((item) => (
                  <tr key={item._id} className={item.needsValueCheck ? 'needsCheck' : ''}>
                    <td><span className="consoleTag">{item.mediaFormat || item.console || item.type}</span></td>
                    <td><strong>{item.title}</strong>{item.edition ? <small>{item.edition}</small> : null}{item.upc || item.barcode ? <small>UPC {item.upc || item.barcode}</small> : null}</td>
                    <td>{item.collectionId ? <span className="consoleTag">{collectionName(item.collectionId)}</span> : ''}</td>
                    <td>{item.storageLocation}</td>
                    <td className="valueCell">{effectiveLow(item) || effectiveHigh(item) ? `$${effectiveLow(item)}-$${effectiveHigh(item)}` : ''}</td>
                    <td><span className={badgeClass(item.needsValueCheck ? 'Needs Check' : item.valueSource || 'Estimated')}>{item.needsValueCheck ? 'Needs Check' : item.valueSource || 'Estimated'}</span></td>
                    <td><span className={badgeClass(String(item.listingRecommendation || item.strategy || priorityFromValue(item)))}>{item.listingRecommendation || item.strategy || priorityFromValue(item)}</span></td>
                    <td><span className={badgeClass(item.status || 'Inventory')}>{item.status || 'Inventory'}</span></td>
                    <td className="tableActionsCell"><div className="rowActions"><button onClick={() => { setCreateDraftAfterSave(false); setEditing(item); }}>Edit</button><button title="Create an eBay draft in FlipTracker" onClick={() => createListingDraft(item)}><LayoutList size={14}/> Draft</button><button title="Open eBay completed and sold listings" onClick={() => openQuickSoldComps(item)}>Sold Comps</button>{shouldShowTerapeak(item) ? <button className="secondary" title="Open eBay Product Research for items valued at $50 or more" onClick={() => openTerapeakResearch(item)}>Terapeak</button> : null}<button className="secondary" onClick={() => openResearchLog(item)}>Log Value</button><button className="danger iconButton" aria-label={`Delete ${item.title}`} onClick={() => deleteAsset(item._id)}><Trash2 size={14}/></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section></> : activeView === 'Listings' ? <ListingsPanel/> : activeView === 'Bulk' ? <BulkIntakePanel/> : activeView === 'Photos' ? <PhotoQueuePanel/> : activeView === 'Sourcing' ? <SourcingPanel/> : <QuickGuide/>}

      {scannerOpen ? (
        <div className="modalBackdrop">
          <section className="modal scannerModal">
            <header className="modalHeader">
              <div><h2>Scan Media Barcode</h2><span className="statusPill">UPC / EAN / ISBN</span></div>
              <button className="iconButton secondary" aria-label="Close" onClick={() => setScannerOpen(false)}><X size={18}/></button>
            </header>
            <div className="scannerGrid">
              <div className="cameraFrame"><video ref={videoRef} muted playsInline autoPlay /></div>
              <div className="scannerPanel">
                <label>Manual Barcode<input inputMode="numeric" value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} placeholder="Scan or type UPC/EAN/ISBN"/></label>
                {scanError ? <p className="warningText">{scanError}</p> : <p>Aim at the full barcode and hold steady. You can also enter the code manually.</p>}
                <div className="actions right">{scanError ? <button className="secondary" onClick={() => setScannerAttempt((attempt) => attempt + 1)}><Camera size={16}/> Retry Camera</button> : null}<button className="secondary" onClick={() => { const barcode = manualBarcode.trim(); scannerControls.current?.stop(); setScannerOpen(false); setCreateDraftAfterSave(true); setEditing({ ...blankAsset(), barcode: barcode || undefined, upc: barcode || undefined }); }}>Manual Add</button><button onClick={() => lookupBarcode()} disabled={isLookingUp}><Search size={16}/>{isLookingUp ? 'Looking Up...' : 'Lookup'}</button></div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {editing ? (
        <div className="modalBackdrop">
          <section className="modal wideModal">
            <header className="modalHeader">
              <div><h2>{'_id' in editing ? 'Edit Item' : editing.barcode || editing.upc ? 'Review Scanned Item' : 'Add Item'}</h2>{editing.needsValueCheck ? <span className="statusPill warning">Value check needed</span> : <span className="statusPill">Value current</span>}</div>
              <button className="iconButton secondary" aria-label="Close" onClick={() => setEditing(null)}><X size={18}/></button>
            </header>
            <div className="reviewLayout">
              <aside className="mediaPreview">
                {editing.photoDataUrl || editing.coverImageUrl ? <img src={editing.photoDataUrl || editing.coverImageUrl} alt="Item preview" /> : <div className="previewPlaceholder"><Camera size={36}/><span>No photo yet</span></div>}
                <label className="button secondary photoButton"><ImagePlus size={16}/> Capture Photo<input type="file" accept="image/*" capture="environment" hidden onChange={onPhotoSelected}/></label>
                {editing.metadataSource ? <p className="lookupMeta">{editing.metadataSource} - {editing.metadataConfidence || 'Review'}</p> : null}
              </aside>
              <div className="formGrid">
                <label className="span2">Title<input value={editing.title || ''} onChange={e => updateEditing({ title:e.target.value, needsValueCheck: '_id' in editing })}/></label>
                <label>Type<select value={editing.type || 'Video Game'} onChange={e => updateEditing({ type:e.target.value })}>{MEDIA_TYPES.map(s => <option key={s}>{s}</option>)}</select></label>
                <label>Format<input value={editing.mediaFormat || ''} onChange={e => updateEditing({ mediaFormat:e.target.value })}/></label>
                <label>Console / Platform<input value={editing.console || ''} onChange={e => updateEditing({ console:e.target.value })}/></label>
                <label>Edition<input value={editing.edition || ''} onChange={e => updateEditing({ edition:e.target.value, needsValueCheck: '_id' in editing })}/></label>
                <label>UPC / Barcode<input value={editing.upc || editing.barcode || ''} onChange={e => updateEditing({ upc:e.target.value, barcode:e.target.value, needsValueCheck: '_id' in editing })}/></label>
                <label>Barcode Type<input value={editing.barcodeType || ''} onChange={e => updateEditing({ barcodeType:e.target.value }, false)}/></label>
                <label>Release Year<input value={editing.releaseYear || ''} onChange={e => updateEditing({ releaseYear:e.target.value })}/></label>
                <label>Release Date<input value={editing.releaseDate || ''} onChange={e => updateEditing({ releaseDate:e.target.value })}/></label>
                <label>Studio / Publisher<input value={editing.studio || ''} onChange={e => updateEditing({ studio:e.target.value })}/></label>
                <label>Rating<input value={editing.rating || ''} onChange={e => updateEditing({ rating:e.target.value })}/></label>
                <label>Status<select value={editing.status || 'Inventory'} onChange={e => updateEditing({ status:e.target.value }, false)}>{['Inventory','Listed','Sold','Hold','Bundle'].map(s => <option key={s}>{s}</option>)}</select></label>
                <label>Collection<select value={editing.collectionId || ''} onChange={e => updateEditing({ collectionId:e.target.value ? e.target.value as Id<'collections'> : undefined }, false)}><option value="">Unassigned</option>{collectionRows.map(collection => <option key={collection._id} value={collection._id}>{collection.name}</option>)}</select></label>
                <label>Storage Location / Bin<input value={editing.storageLocation || ''} onChange={e => updateEditing({ storageLocation:e.target.value }, false)}/></label>

                <div className="formSection span2"><h3>Condition & Completeness</h3><div className="sectionGrid">
                  <label>Condition<select value={editing.condition || 'Good'} onChange={e => updateEditing({ condition:e.target.value, needsValueCheck: '_id' in editing })}>{CONDITIONS.map(s => <option key={s}>{s}</option>)}</select></label>
                  <label>Completeness<select value={editing.completeness || 'Complete'} onChange={e => updateEditing({ completeness:e.target.value, complete:e.target.value === 'Complete' || e.target.value === 'Sealed', needsValueCheck: '_id' in editing })}>{COMPLETENESS.map(s => <option key={s}>{s}</option>)}</select></label>
                  <label className="checkRow"><input type="checkbox" checked={!!editing.complete} onChange={e => updateEditing({ complete:e.target.checked }, false)}/><span>Legacy Complete</span></label>
                  <label className="checkRow"><input type="checkbox" checked={!!editing.manual} onChange={e => updateEditing({ manual:e.target.checked }, false)}/><span>Game Manual Included</span></label>
                </div></div>

                <div className="formSection span2"><h3>Pricing</h3><div className="sectionGrid">
                  <label>Estimated Low<input type="number" value={editing.estimatedLow || ''} onChange={e => updateEditing({ estimatedLow:toNumber(e.target.value), needsValueCheck: '_id' in editing })}/></label>
                  <label>Estimated High<input type="number" value={editing.estimatedHigh || ''} onChange={e => updateEditing({ estimatedHigh:toNumber(e.target.value), needsValueCheck: '_id' in editing })}/></label>
                  <label>User Low<input type="number" value={editing.userLow || ''} onChange={e => updateEditing({ userLow:toNumber(e.target.value), valueSource:'User Override', needsValueCheck:false })}/></label>
                  <label>User High<input type="number" value={editing.userHigh || ''} onChange={e => updateEditing({ userHigh:toNumber(e.target.value), valueSource:'User Override', needsValueCheck:false })}/></label>
                  <label>Value Source<select value={editing.valueSource || 'Estimated'} onChange={e => updateEditing({ valueSource:e.target.value })}><option>Estimated</option><option>User Override</option></select></label>
                  <label>Recommendation<select value={editing.listingRecommendation || 'Review'} onChange={e => updateEditing({ listingRecommendation:e.target.value }, false)}>{['Sell Individually','Bundle','Skip','Review'].map(s => <option key={s}>{s}</option>)}</select></label>
                </div><div className="actions researchActions"><button type="button" className="secondary" onClick={() => openQuickSoldComps(editing)}><Search size={16}/> Sold Comps</button>{shouldShowTerapeak(editing) ? <button type="button" className="secondary" onClick={() => openTerapeakResearch(editing)}><Gauge size={16}/> Terapeak</button> : null}</div><label className="checkRow reviewToggle"><input type="checkbox" checked={!!editing.needsValueCheck} onChange={e => updateEditing({ needsValueCheck:e.target.checked }, false)}/><span><strong>Needs value check</strong><small>Included in the value review queue.</small></span></label></div>

                <div className="formSection span2"><h3>eBay Listing Draft Fields</h3><div className="sectionGrid">
                  <label className="span2">eBay Title<input value={editing.ebayTitle || ''} onChange={e => updateEditing({ ebayTitle:e.target.value }, false)}/></label>
                  <label>Category<input value={editing.ebayCategory || ''} onChange={e => updateEditing({ ebayCategory:e.target.value }, false)}/></label>
                  <label>Condition<input value={editing.ebayCondition || ''} onChange={e => updateEditing({ ebayCondition:e.target.value }, false)}/></label>
                  <label>Price<input type="number" value={editing.ebayPrice || ''} onChange={e => updateEditing({ ebayPrice:toNumber(e.target.value) }, false)}/></label>
                  <label>Shipping<input value={editing.ebayShipping || ''} onChange={e => updateEditing({ ebayShipping:e.target.value }, false)}/></label>
                  <label className="span2">Item Specifics<textarea value={editing.ebayItemSpecifics || ''} onChange={e => updateEditing({ ebayItemSpecifics:e.target.value }, false)}/></label>
                  <label className="span2">Description<textarea value={editing.ebayDescription || ''} onChange={e => updateEditing({ ebayDescription:e.target.value }, false)}/></label>
                </div>{!('_id' in editing) ? <label className="checkRow reviewToggle"><input type="checkbox" checked={createDraftAfterSave} onChange={e => setCreateDraftAfterSave(e.target.checked)}/><span><strong>Add to eBay draft queue</strong><small>Generate the listing now, then find fair value and select it from Listings.</small></span></label> : null}</div>

                <div className="formSection span2"><h3>Sale</h3><div className="sectionGrid"><label>Purchase Price<input type="number" value={editing.purchasePrice || ''} onChange={e => updateEditing({ purchasePrice:toNumber(e.target.value) }, false)}/></label><label>Sold Price<input type="number" value={editing.soldPrice || ''} onChange={e => updateEditing({ soldPrice:toNumber(e.target.value) }, false)}/></label></div></div>
                <label className="span2">Notes<textarea value={editing.notes || ''} onChange={e => updateEditing({ notes:e.target.value })}/></label>
              </div>
            </div>
            <div className="actions right"><button className="secondary" onClick={() => { setCreateDraftAfterSave(false); setEditing(null); }}>Cancel</button><button onClick={saveAsset}><Save size={16}/> {createDraftAfterSave && !('_id' in editing) ? 'Save & Queue' : 'Save to Inventory'}</button></div>
          </section>
        </div>
      ) : null}

      {editingCollection ? (
        <div className="modalBackdrop"><section className="modal"><header className="modalHeader"><div><h2>{'_id' in editingCollection ? 'Edit Collection' : 'Add Collection'}</h2><span className="statusPill">Purchase lot</span></div><button className="iconButton secondary" aria-label="Close" onClick={() => setEditingCollection(null)}><X size={18}/></button></header><div className="formGrid"><label className="span2">Name<input value={editingCollection.name || ''} onChange={e => setEditingCollection({...editingCollection, name:e.target.value})}/></label><label>Source<input value={editingCollection.source || ''} onChange={e => setEditingCollection({...editingCollection, source:e.target.value})}/></label><label>Purchase Date<input type="date" value={editingCollection.purchaseDate || ''} onChange={e => setEditingCollection({...editingCollection, purchaseDate:e.target.value})}/></label><label>Purchase Price<input type="number" value={editingCollection.purchasePrice || ''} onChange={e => setEditingCollection({...editingCollection, purchasePrice:toNumber(e.target.value)})}/></label><label>Location<input value={editingCollection.location || ''} onChange={e => setEditingCollection({...editingCollection, location:e.target.value})}/></label><label className="span2">Notes<textarea value={editingCollection.notes || ''} onChange={e => setEditingCollection({...editingCollection, notes:e.target.value})}/></label></div><div className="actions right"><button className="secondary" onClick={() => setEditingCollection(null)}>Cancel</button><button onClick={saveCollection}><Save size={16}/> Save</button></div></section></div>
      ) : null}

      {researchAsset ? (
        <div className="modalBackdrop"><section className="modal"><header className="modalHeader"><div><h2>Log Value Check</h2><span className="statusPill warning">{researchAsset.title}</span></div><button className="iconButton secondary" aria-label="Close" onClick={() => setResearchAsset(null)}><X size={18}/></button></header><div className="formGrid"><label>Source<input value={researchDraft.source} onChange={e => setResearchDraft({...researchDraft, source:e.target.value})}/></label><label>Confidence<select value={researchDraft.confidence} onChange={e => setResearchDraft({...researchDraft, confidence:e.target.value})}>{['High','Medium','Low'].map(c => <option key={c}>{c}</option>)}</select></label><label>Low<input type="number" value={researchDraft.low || ''} onChange={e => setResearchDraft({...researchDraft, low:toNumber(e.target.value)})}/></label><label>High<input type="number" value={researchDraft.high || ''} onChange={e => setResearchDraft({...researchDraft, high:toNumber(e.target.value)})}/></label><label>Observed Price<input type="number" value={researchDraft.observedPrice || ''} onChange={e => setResearchDraft({...researchDraft, observedPrice:toNumber(e.target.value)})}/></label><label>Recommendation<select value={researchDraft.recommendation || 'Review'} onChange={e => setResearchDraft({...researchDraft, recommendation:e.target.value})}>{['Sell Individually','Bundle','Skip','List First','Worth Listing','Hold','Review'].map(r => <option key={r}>{r}</option>)}</select></label><label className="span2">URL<input value={researchDraft.url || ''} onChange={e => setResearchDraft({...researchDraft, url:e.target.value})}/></label><label className="span2">Notes<textarea value={researchDraft.notes || ''} onChange={e => setResearchDraft({...researchDraft, notes:e.target.value})}/></label></div><div className="actions right"><button className="secondary" onClick={() => openQuickSoldComps(researchAsset)}>Sold Comps</button>{shouldShowTerapeak(researchAsset, researchDraft.low, researchDraft.high, researchDraft.observedPrice) ? <button className="secondary" onClick={() => openTerapeakResearch(researchAsset)}>Terapeak</button> : null}<button className="secondary" onClick={() => setResearchAsset(null)}>Cancel</button><button onClick={saveResearchLog}><Save size={16}/> Save Value</button></div></section></div>
      ) : null}

      <p className="footer">Scan saves to inventory first. Bulk Intake can create internal eBay drafts automatically; direct publishing requires an eBay seller connection.</p>
    </main>
  );
}
