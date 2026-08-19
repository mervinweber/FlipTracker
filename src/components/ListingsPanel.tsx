import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, BadgeDollarSign, Calculator, Camera, CheckCircle2, ChevronDown, CircleStop, CloudUpload, DollarSign, Download, ExternalLink, Gauge, KeyRound, Link, LogOut, MapPin, Package, Pencil, Percent, Plus, RefreshCw, Rocket, Save, Search, Send, Settings, ShieldCheck, Sparkles, Tags, Trash2, Truck, Upload, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ListingPhotoManager from './ListingPhotoManager';
import EbayCategoryFinder from './EbayCategoryFinder';
import {
  EBAY_CATEGORY_CHOICES,
  EBAY_SHIPPING_PROFILES,
  categoryChoiceForKey,
  findSuggestedShippingPolicy,
  resolveEbayCategory,
  resolveShippingProfile,
  shippingProfileForKey,
  type EbayCategoryKey,
  type EbayShippingProfileKey,
} from '../config/ebayListingDefaults';

type Listing = {
  _id: Id<'marketplaceListings'>;
  assetId: Id<'assets'>;
  platform: string;
  salePlatform?: string;
  saleReference?: string;
  saleChannelDetail?: string;
  status: string;
  sku?: string;
  externalListingId?: string;
  listingUrl?: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  language?: string;
  bookTitle?: string;
  author?: string;
  cardProductType?: string;
  cardGame?: string;
  cardSport?: string;
  cardSet?: string;
  cardNumber?: string;
  cardPlayer?: string;
  cardTeam?: string;
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
  ebayCategoryId?: string;
  fulfillmentPolicyId?: string;
  shippingPreset?: string;
  packageType?: string;
  packageWeightOz?: number;
  packageLengthIn?: number;
  packageWidthIn?: number;
  packageHeightIn?: number;
  imageMode?: string;
  ebayImageUrl?: string;
  ebayImageSource?: string;
  ebayOfferId?: string;
  ebayInventorySku?: string;
  ebayDraftStatus?: string;
  ebayDraftCreatedAt?: number;
  ebayLastError?: string;
  pricingStatus?: string;
  pricingSource?: string;
  pricingUpdatedAt?: number;
  ebayOrderId?: string;
  ebayLastSyncedAt?: number;
  updatedAt: number;
  assetTitle: string;
  assetType?: string;
  assetBarcode?: string;
  mediaFormat?: string;
  assetAuthor?: string;
  needsValueCheck?: boolean;
  listingRecommendation?: string;
  suggestedPrice?: number;
  suggestionSource?: string;
  purchasePrice?: number;
  storageLocation?: string;
  photoUrl?: string;
  hasActualPhoto?: boolean;
  hasCatalogIdentifier?: boolean;
};

type PricingRow = {
  listingId: Id<'marketplaceListings'>;
  title: string;
  barcode?: string;
  format?: string;
  currentPrice?: number;
  suggestedPrice?: number;
  suggestionSource?: string;
  activeLow?: number;
  activeMedian?: number;
  activeHigh?: number;
  deliveredMedian?: number;
  matchCount?: number;
  pricingConfidence?: string;
  pricingWarning?: string;
  price: string;
};

const QUEUE_TYPES = ['Ready for Pricing', 'Needs Photo', 'Ready for eBay', 'Staged for eBay', 'Published', 'Sold'] as const;

type ActivePricingResult = {
  listingId: Id<'marketplaceListings'>;
  matchCount: number;
  low?: number;
  median?: number;
  high?: number;
  deliveredMedian?: number;
  suggestedPrice?: number;
  confidence: string;
  source?: string;
  warning?: string;
};

type RepriceMode = 'percentage' | 'exact' | 'profit';
type ListingEditorStep = 'details' | 'category' | 'shipping' | 'price';

const LISTING_EDITOR_STEPS: Array<{ id: ListingEditorStep; label: string }> = [
  { id: 'details', label: 'Item' },
  { id: 'category', label: 'Category' },
  { id: 'shipping', label: 'Shipping & photos' },
  { id: 'price', label: 'Price & description' },
];

type EbaySetup = {
  connected: boolean;
  environment: 'sandbox' | 'production';
  connectedAt?: number;
  settings: Record<string, string | number | undefined>;
  policies: {
    fulfillment: { id: string; name: string }[];
    payment: { id: string; name: string }[];
    returns: { id: string; name: string }[];
  };
  locations: { key: string; name: string }[];
  warning?: string;
};

type EbaySellerListingSummary = {
  activeCount: number;
  scheduledCount: number;
  checkedAt: number;
};

type ListingSort = 'Newest' | 'Queue' | 'Status' | 'Price High' | 'Price Low';

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Chinese',
  'Korean',
  'Portuguese',
  'Russian',
  'Arabic',
  'Multiple Languages',
];

function itemSpecificValue(itemSpecifics: string | undefined, name: string) {
  const normalized = name.toLowerCase();
  for (const line of itemSpecifics?.split('\n') || []) {
    const separator = line.indexOf(':');
    if (separator < 1 || line.slice(0, separator).trim().toLowerCase() !== normalized) continue;
    const value = line.slice(separator + 1).trim();
    if (value) return value;
  }
  return undefined;
}

function setItemSpecificValue(itemSpecifics: string | undefined, name: string, value: string) {
  const normalized = name.trim().toLowerCase();
  const lines = (itemSpecifics || '').split('\n').filter((line) => line.trim());
  const nextLine = value.trim() ? `${name}: ${value.trim()}` : '';
  const existingIndex = lines.findIndex((line) => {
    const separator = line.indexOf(':');
    return separator > 0 && line.slice(0, separator).trim().toLowerCase() === normalized;
  });
  if (existingIndex >= 0) {
    if (nextLine) lines[existingIndex] = nextLine;
    else lines.splice(existingIndex, 1);
  } else if (nextLine) {
    lines.unshift(nextLine);
  }
  return lines.join('\n');
}

type EbaySettings = {
  marketplaceId: string;
  currency: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  dvdCategoryId: string;
  blurayCategoryId: string;
  bookCategoryId: string;
  cdCategoryId: string;
  gameCategoryId: string;
  pokemonCardCategoryId: string;
  sportsCardCategoryId: string;
  yugiohCardCategoryId: string;
  otherCategoryId: string;
  activeListingTarget: string;
};

const EMPTY_EBAY_SETTINGS: EbaySettings = {
  marketplaceId: 'EBAY_US',
  currency: 'USD',
  merchantLocationKey: '',
  fulfillmentPolicyId: '',
  paymentPolicyId: '',
  returnPolicyId: '',
  dvdCategoryId: '',
  blurayCategoryId: '',
  bookCategoryId: '',
  cdCategoryId: '',
  gameCategoryId: '',
  pokemonCardCategoryId: '',
  sportsCardCategoryId: '',
  yugiohCardCategoryId: '',
  otherCategoryId: '',
  activeListingTarget: '200',
};

const EMPTY_SANDBOX_SETUP = {
  postalCode: '',
  country: 'US',
  locationKey: 'fliptracker-home',
  locationName: 'FlipTracker Inventory',
  mediaMailCost: '4.99',
};

const PLATFORMS = ['eBay', 'Mercari', 'Facebook Marketplace', 'Vinted', 'OfferUp', 'Craigslist', 'Poshmark', 'Depop', 'Etsy', 'Amazon', 'Other'];
const STATUSES = ['Draft', 'Active', 'Pending', 'Sold', 'Expired', 'Relisted', 'Cancelled'];
const CARD_PRODUCT_TYPES = ['Single Card', 'Card Lot', 'Complete Set', 'Sealed Pack', 'Sealed Box'];
const CARD_GAMES = ['Pokemon TCG', 'Yu-Gi-Oh! TCG', 'Magic: The Gathering', 'One Piece Card Game', 'Disney Lorcana', 'Other CCG'];
const CARD_SPORTS = ['Baseball', 'Basketball', 'Football', 'Ice Hockey', 'Soccer', 'Wrestling', 'Auto Racing', 'Golf', 'Boxing', 'Mixed Sports', 'Other'];
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

function readableActionError(error: unknown, fallback: string) {
  const data = error && typeof error === 'object' && 'data' in error
    ? (error as { data?: unknown }).data
    : undefined;
  if (typeof data === 'string' && data.trim()) return data;
  const raw = error instanceof Error ? error.message : fallback;
  const convexMessage = raw.match(/Uncaught ConvexError:\s*([^\n]+?)(?:\s+at handler|\s+Called by client|$)/)?.[1];
  return convexMessage || raw;
}

function priceEndingAt99(value: number) {
  return Math.max(0.99, Math.ceil(value) - 0.01);
}

function queueStatus(listing: Listing) {
  if (listing.status === 'Sold') return 'Sold';
  if (!['Draft', 'Pending', 'Active'].includes(listing.status)) return listing.status;
  if (listing.externalListingId || listing.status === 'Active') return 'Published';
  if (listing.ebayOfferId || ['eBay Draft Created', 'eBay Offer Staged'].includes(listing.pricingStatus || '')) return 'Staged for eBay';
  if ((listing.currentPrice ?? listing.listedPrice ?? 0) <= 0) return 'Ready for Pricing';
  const imageMode = listing.imageMode || (isNewCondition(listing.condition) ? 'eBay Catalog' : 'Actual Item Photo');
  const isBook = `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase().includes('book');
  const imageReady = imageMode === 'eBay Catalog'
    ? (isNewCondition(listing.condition) && listing.hasCatalogIdentifier) || (isBook && Boolean(listing.photoUrl))
    : listing.hasActualPhoto;
  return imageReady ? 'Ready for eBay' : 'Needs Photo';
}

function isNewCondition(condition?: string) {
  return ['new', 'brand new', 'sealed'].includes(condition?.trim().toLowerCase() || '');
}

function isBookListing(listing: Pick<Listing, 'assetType' | 'mediaFormat'>) {
  return `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase().includes('book');
}

function isCardListing(listing: Pick<Listing, 'assetType'>) {
  return Boolean(listing.assetType?.toLowerCase().includes('card'));
}

function isClothingListing(listing: Pick<Listing, 'assetType' | 'mediaFormat'>) {
  return /clothing|apparel|shirt|jeans|pants|dress|jacket|sweater|hoodie|coat|shoe/i.test(`${listing.assetType || ''} ${listing.mediaFormat || ''}`);
}

function defaultCardGame(type?: string) {
  if (type === 'Pokemon Card') return 'Pokemon TCG';
  if (type === 'Yu-Gi-Oh! Card') return 'Yu-Gi-Oh! TCG';
  return undefined;
}

function selectedCategoryRoute(listing: Pick<Listing, 'assetType' | 'assetBarcode' | 'cardProductType' | 'ebayCategoryId' | 'category'>) {
  const automatic = resolveEbayCategory({ itemType: listing.assetType, barcode: listing.assetBarcode, cardSaleFormat: listing.cardProductType });
  if ((!listing.ebayCategoryId || listing.ebayCategoryId === automatic.categoryId) && (!listing.category || listing.category === automatic.choice.categoryName)) return 'auto';
  return EBAY_CATEGORY_CHOICES.find((choice) => ('categoryId' in choice && choice.categoryId === listing.ebayCategoryId) || choice.categoryName === listing.category)?.key || 'auto';
}

function canUseCatalogImage(listing: Pick<Listing, 'assetType' | 'mediaFormat' | 'photoUrl' | 'condition' | 'hasCatalogIdentifier'>) {
  return (isNewCondition(listing.condition) && Boolean(listing.hasCatalogIdentifier))
    || (isBookListing(listing) && Boolean(listing.photoUrl));
}

function ebayResearchQuery(listing: Pick<Listing, 'assetBarcode' | 'title' | 'mediaFormat'>) {
  return listing.assetBarcode || `${listing.title} ${listing.mediaFormat || ''}`.trim();
}

function soldCompsUrl(listing: Pick<Listing, 'assetBarcode' | 'title' | 'mediaFormat'>) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayResearchQuery(listing))}&LH_Sold=1&LH_Complete=1`;
}

function terapeakUrl(listing: Pick<Listing, 'assetBarcode' | 'title' | 'mediaFormat'>) {
  return `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(ebayResearchQuery(listing))}`;
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

export default function ListingsPanel({ onAddOtherItem }: { onAddOtherItem: () => void }) {
  const listings = useQuery(api.listings.list) as Listing[] | undefined;
  const stats = useQuery(api.listings.stats);
  const updateListing = useMutation(api.listings.update);
  const removeListing = useMutation(api.listings.remove);
  const importSalesTracker = useMutation(api.listings.importSalesTracker);
  const applyQueuePricing = useMutation(api.listings.applyQueuePricing);
  const beginEbayOauth = useAction(api.ebay.beginOauth);
  const loadEbaySetup = useAction(api.ebay.loadSetup);
  const getSellerListingSummary = useAction(api.ebay.getSellerListingSummary);
  const syncSoldOrders = useAction(api.ebay.syncSoldOrders);
  const saveEbaySettings = useAction(api.ebay.saveSettings);
  const createInventoryLocation = useAction(api.ebay.createInventoryLocation);
  const ensureMediaMailPolicy = useAction(api.ebay.ensureMediaMailPolicy);
  const provisionSandboxDefaults = useAction(api.ebay.provisionSandboxDefaults);
  const lookupActivePricing = useAction(api.ebay.lookupActivePricing);
  const createEbayOffer = useAction(api.ebay.createUnpublishedOffer);
  const publishEbayOffer = useAction(api.ebay.publishOffer);
  const updateEbayPrice = useAction(api.ebay.updatePublishedPrice);
  const endEbayListing = useAction(api.ebay.endPublishedListing);
  const generateListingCopy = useAction(api.aiDescriptions.generateListingCopy);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [editorStep, setEditorStep] = useState<ListingEditorStep>('details');
  const [saleEditing, setSaleEditing] = useState<Listing | null>(null);
  const [endListingPrompt, setEndListingPrompt] = useState<Listing | null>(null);
  const [endListingBusy, setEndListingBusy] = useState(false);
  const [endListingError, setEndListingError] = useState('');
  const [repricing, setRepricing] = useState<Listing | null>(null);
  const [repriceMode, setRepriceMode] = useState<RepriceMode>('percentage');
  const [repricePercent, setRepricePercent] = useState('10');
  const [repriceExact, setRepriceExact] = useState('');
  const [repriceFeePercent, setRepriceFeePercent] = useState('15');
  const [repriceShippingCost, setRepriceShippingCost] = useState('5');
  const [repriceShippingCharged, setRepriceShippingCharged] = useState('0');
  const [repriceTargetProfit, setRepriceTargetProfit] = useState('5');
  const [repriceCharm, setRepriceCharm] = useState(true);
  const [repriceBusy, setRepriceBusy] = useState(false);
  const [repriceError, setRepriceError] = useState('');
  const markEditingPhotoReady = useCallback(() => {
    setEditing((current) => current && !current.hasActualPhoto ? { ...current, hasActualPhoto: true } : current);
  }, []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [queueType, setQueueType] = useState('All');
  const [sortBy, setSortBy] = useState<ListingSort>('Newest');
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey') || '');
  const [rememberSellerKey, setRememberSellerKey] = useState(() => Boolean(localStorage.getItem('fliptrackerRememberedSellerKey')));
  const autoLoadSellerSetup = useRef(Boolean(localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey')));
  const autoLoadAttempted = useRef(false);
  const [ebaySetup, setEbaySetup] = useState<EbaySetup | null>(null);
  const [sellerSetupExpanded, setSellerSetupExpanded] = useState(false);
  const [ebaySettings, setEbaySettings] = useState<EbaySettings>(EMPTY_EBAY_SETTINGS);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [sellerListingSummary, setSellerListingSummary] = useState<EbaySellerListingSummary | null>(null);
  const [sellerListingCountBusy, setSellerListingCountBusy] = useState(false);
  const [sellerListingCountError, setSellerListingCountError] = useState('');
  const [sellerSalesSyncBusy, setSellerSalesSyncBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState<Id<'marketplaceListings'> | null>(null);
  const [ebayNotice, setEbayNotice] = useState('');
  const [ebayError, setEbayError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'marketplaceListings'>>>(new Set());
  const [pricingRows, setPricingRows] = useState<PricingRow[] | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [sandboxSetup, setSandboxSetup] = useState(EMPTY_SANDBOX_SETUP);

  useEffect(() => {
    if (!editing && !saleEditing && !endListingPrompt && !repricing && !pricingRows) return;
    document.body.classList.add('modalOpen');
    return () => document.body.classList.remove('modalOpen');
  }, [editing, endListingPrompt, pricingRows, repricing, saleEditing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('ebay');
    if (!oauthResult) return;
    setEbayNotice(oauthResult === 'connected' ? 'eBay seller account connected. Load the setup below to choose policies.' : '');
    setEbayError(oauthResult === 'error' ? params.get('message') || 'eBay authorization failed.' : '');
    params.delete('ebay');
    params.delete('message');
    const nextQuery = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!autoLoadSellerSetup.current || autoLoadAttempted.current || !adminKey) return;
    autoLoadAttempted.current = true;
    void unlockEbaySetup();
  }, [adminKey]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (listings || []).filter((listing) => {
      const matchesQuery = !normalized || `${listing.title} ${listing.assetTitle} ${listing.sku || ''} ${listing.externalListingId || ''}`.toLowerCase().includes(normalized);
      return matchesQuery
        && (status === 'All' || listing.status === status)
        && (platform === 'All' || listing.platform === platform)
        && (queueType === 'All' || queueStatus(listing) === queueType);
    });
    const queueOrder = ['Ready for Pricing', 'Needs Photo', 'Ready for eBay', 'Staged for eBay', 'Published', 'Sold'];
    const statusOrder = ['Draft', 'Pending', 'Active', 'Sold', 'Ended'];
    const price = (listing: Listing) => listing.status === 'Sold' ? listing.soldPrice ?? 0 : listing.currentPrice ?? listing.listedPrice ?? 0;
    const rank = (values: string[], value: string) => {
      const index = values.indexOf(value);
      return index < 0 ? values.length : index;
    };
    return [...matches].sort((a, b) => {
      if (sortBy === 'Queue') return rank(queueOrder, queueStatus(a)) - rank(queueOrder, queueStatus(b)) || b.updatedAt - a.updatedAt;
      if (sortBy === 'Status') return rank(statusOrder, a.status) - rank(statusOrder, b.status) || b.updatedAt - a.updatedAt;
      if (sortBy === 'Price High') return price(b) - price(a) || b.updatedAt - a.updatedAt;
      if (sortBy === 'Price Low') return price(a) - price(b) || b.updatedAt - a.updatedAt;
      return b.updatedAt - a.updatedAt;
    });
  }, [listings, platform, query, queueType, sortBy, status]);

  const queueListings = useMemo(() => filtered.filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status)), [filtered]);
  const selectedListings = useMemo(() => (listings || []).filter((listing) => selectedIds.has(listing._id)), [listings, selectedIds]);
  const selectedReadyForEbay = useMemo(() => selectedListings.filter((listing) => queueStatus(listing) === 'Ready for eBay'), [selectedListings]);

  useEffect(() => {
    const visibleIds = new Set(queueListings.map((listing) => listing._id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [queueListings]);
  const sellerDefaultsReady = Boolean(
    ebaySettings.merchantLocationKey
    && ebaySettings.fulfillmentPolicyId
    && ebaySettings.paymentPolicyId
    && ebaySettings.returnPolicyId,
  );
  const activeListingTarget = Math.max(1, Math.round(Number(ebaySettings.activeListingTarget) || 200));
  const projectedEbayListings = (sellerListingSummary?.activeCount ?? 0) + (sellerListingSummary?.scheduledCount ?? 0);
  const roomToListingTarget = Math.max(0, activeListingTarget - projectedEbayListings);
  const listingTargetPercent = Math.min(100, (projectedEbayListings / activeListingTarget) * 100);
  const repricePreview = useMemo(() => {
    if (!repricing) return null;
    const currentPrice = repricing.currentPrice ?? repricing.listedPrice ?? 0;
    const feeRate = Number(repriceFeePercent) / 100;
    const shippingCost = Number(repriceShippingCost);
    const shippingCharged = Number(repriceShippingCharged);
    const targetProfit = Number(repriceTargetProfit);
    const purchaseCost = repricing.purchasePrice ?? 0;
    let rawPrice = 0;
    if (repriceMode === 'percentage') rawPrice = currentPrice * (1 - Number(repricePercent) / 100);
    if (repriceMode === 'exact') rawPrice = Number(repriceExact);
    if (repriceMode === 'profit' && feeRate >= 0 && feeRate < 1) {
      rawPrice = (purchaseCost + shippingCost + targetProfit) / (1 - feeRate) - shippingCharged;
      if (repriceCharm) rawPrice = priceEndingAt99(rawPrice);
    }
    const price = Math.round(rawPrice * 100) / 100;
    const marketplaceFees = (price + shippingCharged) * feeRate;
    const estimatedProfit = price + shippingCharged - marketplaceFees - purchaseCost - shippingCost;
    const changePercent = currentPrice > 0 ? ((price - currentPrice) / currentPrice) * 100 : 0;
    const percentage = Number(repricePercent);
    const modeInputsValid = repriceMode === 'percentage'
      ? percentage > 0 && percentage <= 90
      : repriceMode === 'exact'
        ? Number(repriceExact) >= 0.99
        : feeRate >= 0 && feeRate <= 0.5 && shippingCost >= 0 && shippingCharged >= 0 && targetProfit >= 0;
    const valid = Number.isFinite(price)
      && price >= 0.99
      && price !== currentPrice
      && modeInputsValid
      && Number.isFinite(marketplaceFees)
      && [feeRate, shippingCost, shippingCharged, targetProfit].every(Number.isFinite);
    return { currentPrice, price, marketplaceFees, estimatedProfit, changePercent, valid };
  }, [repricing, repriceCharm, repriceExact, repriceFeePercent, repriceMode, repricePercent, repriceShippingCharged, repriceShippingCost, repriceTargetProfit]);

  function patchEditing(patch: Partial<Listing>) {
    setEditing((current) => current ? { ...current, ...patch } : current);
  }

  function openListingEditor(listing: Listing) {
    const condition = listing.condition?.trim().toLowerCase() || '';
    const isBookWithCover = `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase().includes('book') && Boolean(listing.photoUrl);
    const imageMode = listing.imageMode || (["new", "brand new", "sealed"].includes(condition) || isBookWithCover ? 'eBay Catalog' : 'Actual Item Photo');
    const categoryResolution = resolveEbayCategory({ itemType: listing.assetType, barcode: listing.assetBarcode, cardSaleFormat: listing.cardProductType });
    const configuredProfile = EBAY_SHIPPING_PROFILES.find((profile) => profile.key === listing.shippingPreset || profile.label === listing.shippingPreset);
    const shippingProfile = configuredProfile || resolveShippingProfile({ itemType: listing.assetType, mediaFormat: listing.mediaFormat, title: listing.title });
    const suggestedPolicy = findSuggestedShippingPolicy(ebaySetup?.policies.fulfillment || [], shippingProfile);
    setSaleEditing(null);
    setDescriptionError('');
    setEditorStep('details');
    setEditing({
      ...listing,
      language: listing.language || itemSpecificValue(listing.itemSpecifics, 'Language') || 'English',
      bookTitle: (listing.bookTitle || itemSpecificValue(listing.itemSpecifics, 'Book Title') || (isBookListing(listing) ? listing.assetTitle : undefined))?.slice(0, 65),
      author: listing.author || itemSpecificValue(listing.itemSpecifics, 'Author') || listing.assetAuthor,
      imageMode,
      category: listing.category || categoryResolution.choice.categoryName,
      ebayCategoryId: listing.ebayCategoryId || categoryResolution.categoryId,
      fulfillmentPolicyId: listing.fulfillmentPolicyId || suggestedPolicy?.id,
      shippingPreset: shippingProfile.key,
      packageType: undefined,
      packageWeightOz: listing.packageWeightOz ?? shippingProfile.weight.value,
      packageLengthIn: listing.packageLengthIn ?? shippingProfile.dimensions.length,
      packageWidthIn: listing.packageWidthIn ?? shippingProfile.dimensions.width,
      packageHeightIn: listing.packageHeightIn ?? shippingProfile.dimensions.height,
    });
  }

  function openRepriceEditor(listing: Listing) {
    const currentPrice = listing.currentPrice ?? listing.listedPrice ?? 0;
    setEditing(null);
    setSaleEditing(null);
    setRepricing(listing);
    setRepriceMode('percentage');
    setRepricePercent('10');
    setRepriceExact(currentPrice.toFixed(2));
    setRepriceFeePercent('15');
    setRepriceShippingCost((listing.shippingCost ?? 5).toFixed(2));
    setRepriceShippingCharged((listing.shippingCharged ?? 0).toFixed(2));
    setRepriceTargetProfit('5.00');
    setRepriceCharm(true);
    setRepriceError('');
  }

  async function submitReprice() {
    if (!repricing || !repricePreview?.valid) {
      setRepriceError('Enter values that calculate to a different eBay price of at least $0.99.');
      return;
    }
    if (!adminKey) {
      setRepriceError('Unlock eBay seller tools before updating a live price.');
      return;
    }
    const reason = repriceMode === 'percentage'
      ? `${Number(repricePercent).toFixed(1)}% live eBay markdown from ${money(repricePreview.currentPrice)}`
      : repriceMode === 'profit'
        ? `Profit-floor update targeting ${money(Number(repriceTargetProfit))} profit at ${Number(repriceFeePercent).toFixed(1)}% estimated fees`
        : `Exact live eBay price change from ${money(repricePreview.currentPrice)}`;
    const confirmation = [
      `Update "${repricing.title}" on eBay?`,
      `${money(repricePreview.currentPrice)} → ${money(repricePreview.price)}`,
      `Estimated net profit: ${money(repricePreview.estimatedProfit)}`,
      'This changes the public live listing price immediately.',
    ].join('\n\n');
    if (!confirm(confirmation)) return;
    setRepriceBusy(true);
    setRepriceError('');
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await updateEbayPrice({
        adminKey,
        listingId: repricing._id,
        newPrice: repricePreview.price,
        reason,
      });
      setEbayNotice(`Updated live eBay listing ${result.listingId} from ${money(result.oldPrice)} to ${money(result.newPrice)}. The change was added to Price History.`);
      setRepricing(null);
    } catch (error) {
      setRepriceError(error instanceof Error ? error.message : 'Could not update the live eBay price.');
    } finally {
      setRepriceBusy(false);
    }
  }

  async function generateAiDescription() {
    if (!editing?.title.trim()) {
      setDescriptionError('Enter a listing title before generating the description.');
      return;
    }
    if (!adminKey) {
      setDescriptionError('Enter or load the Seller Access Key before using AI descriptions.');
      return;
    }
    setDescriptionBusy(true);
    setDescriptionError('');
    try {
      const result = await generateListingCopy({
        adminKey,
        title: editing.title.trim(),
        type: editing.assetType || undefined,
        mediaFormat: editing.mediaFormat || undefined,
        author: editing.author || editing.assetAuthor || undefined,
        barcode: editing.assetBarcode || undefined,
        condition: editing.condition || undefined,
        language: editing.language || undefined,
        itemSpecifics: editing.itemSpecifics || undefined,
        existingDescription: editing.description || undefined,
        internalNotes: editing.notes || undefined,
      });
      patchEditing({ description: result.text });
    } catch (error) {
      setDescriptionError(error instanceof Error ? error.message : 'Description generation failed.');
    } finally {
      setDescriptionBusy(false);
    }
  }

  function openSaleEditor(listing: Listing) {
    setEditing(null);
    setSaleEditing({
      ...listing,
      status: 'Sold',
      salePlatform: listing.salePlatform || listing.platform,
      soldDate: listing.soldDate || dateToday(),
      soldPrice: listing.soldPrice ?? listing.currentPrice ?? listing.listedPrice,
      shippingCharged: listing.shippingCharged ?? 0,
      shippingCost: listing.shippingCost ?? 0,
      fees: listing.fees ?? 0,
    });
  }

  function requestSaleEditor(listing: Listing) {
    if (listing.platform.toLowerCase() === 'ebay' && listing.status === 'Active' && listing.externalListingId) {
      setEndListingError('');
      setEndListingPrompt(listing);
      return;
    }
    openSaleEditor(listing);
  }

  async function finishEbayListing(recordSale: boolean) {
    if (!endListingPrompt || !adminKey) return;
    const listing = endListingPrompt;
    setEndListingBusy(true);
    setEndListingError('');
    setEbayError('');
    try {
      await endEbayListing({ adminKey, listingId: listing._id });
      setEndListingPrompt(null);
      setEbayNotice(`Ended ${listing.title} on eBay.${recordSale ? ' Add the sale details below.' : ''}`);
      void refreshSellerListingCount();
      if (recordSale) {
        openSaleEditor({
          ...listing,
          salePlatform: 'Other',
          saleChannelDetail: '',
          status: 'Cancelled',
        });
      }
    } catch (error) {
      const message = readableActionError(error, 'Could not end the eBay listing.');
      setEndListingError(message);
      setEbayError(message);
    } finally {
      setEndListingBusy(false);
    }
  }

  function patchSale(patch: Partial<Listing>) {
    setSaleEditing((current) => current ? { ...current, ...patch } : current);
  }

  async function saveSale() {
    if (!saleEditing || saleEditing.soldPrice === undefined || saleEditing.soldPrice < 0) return;
    await updateListing({
      id: saleEditing._id,
      salePlatform: saleEditing.salePlatform || saleEditing.platform,
      saleReference: saleEditing.saleReference?.trim() || undefined,
      saleChannelDetail: (saleEditing.salePlatform || saleEditing.platform) === 'Other' ? saleEditing.saleChannelDetail?.trim() || undefined : undefined,
      status: 'Sold',
      soldPrice: saleEditing.soldPrice,
      soldDate: saleEditing.soldDate || dateToday(),
      purchasePrice: saleEditing.purchasePrice,
      shippingCharged: saleEditing.shippingCharged,
      shippingCost: saleEditing.shippingCost,
      fees: saleEditing.fees,
      buyer: saleEditing.buyer?.trim() || undefined,
      notes: saleEditing.notes?.trim() || undefined,
    });
    setSaleEditing(null);
  }

  function selectShippingPreset(value: string) {
    const profile = shippingProfileForKey(value as EbayShippingProfileKey);
    const suggestedPolicy = findSuggestedShippingPolicy(ebaySetup?.policies.fulfillment || [], profile);
    patchEditing({
      shippingPreset: profile.key,
      packageType: undefined,
      packageWeightOz: profile.weight.value,
      packageLengthIn: profile.dimensions.length,
      packageWidthIn: profile.dimensions.width,
      packageHeightIn: profile.dimensions.height,
      fulfillmentPolicyId: suggestedPolicy?.id || editing?.fulfillmentPolicyId,
    });
  }

  function selectListingCategory(value: string) {
    if (!editing) return;
    if (value === 'auto') {
      const resolution = resolveEbayCategory({ itemType: editing.assetType, barcode: editing.assetBarcode, cardSaleFormat: editing.cardProductType });
      patchEditing({ category: resolution.choice.categoryName, ebayCategoryId: resolution.categoryId });
      return;
    }
    const choice = categoryChoiceForKey(value as EbayCategoryKey);
    patchEditing({ category: choice.categoryName, ebayCategoryId: choice.categoryId });
  }

  function optionalText(value: string) {
    return value.trim() || undefined;
  }

  function rememberSellerAccessKey() {
    sessionStorage.setItem('fliptrackerSellerKey', adminKey);
    if (rememberSellerKey) localStorage.setItem('fliptrackerRememberedSellerKey', adminKey);
    else localStorage.removeItem('fliptrackerRememberedSellerKey');
  }

  function changeRememberSellerKey(remember: boolean) {
    setRememberSellerKey(remember);
    if (remember && adminKey) localStorage.setItem('fliptrackerRememberedSellerKey', adminKey);
    else localStorage.removeItem('fliptrackerRememberedSellerKey');
  }

  function forgetSellerDevice() {
    sessionStorage.removeItem('fliptrackerSellerKey');
    localStorage.removeItem('fliptrackerRememberedSellerKey');
    setAdminKey('');
    setRememberSellerKey(false);
    setEbaySetup(null);
    setEbaySettings(EMPTY_EBAY_SETTINGS);
    setSellerListingSummary(null);
    setSellerListingCountError('');
    setEbayError('');
    setEbayNotice('Seller access was removed from this device. The eBay authorization stored in Convex was not revoked.');
  }

  function applyEbaySetup(setup: EbaySetup) {
    setEbaySetup(setup);
    setEbaySettings({
      marketplaceId: String(setup.settings.marketplaceId || 'EBAY_US'),
      currency: String(setup.settings.currency || 'USD'),
      merchantLocationKey: String(setup.settings.merchantLocationKey || ''),
      fulfillmentPolicyId: String(setup.settings.fulfillmentPolicyId || ''),
      paymentPolicyId: String(setup.settings.paymentPolicyId || ''),
      returnPolicyId: String(setup.settings.returnPolicyId || ''),
      dvdCategoryId: String(setup.settings.dvdCategoryId || ''),
      blurayCategoryId: String(setup.settings.blurayCategoryId || ''),
      bookCategoryId: String(setup.settings.bookCategoryId || ''),
      cdCategoryId: String(setup.settings.cdCategoryId || ''),
      gameCategoryId: String(setup.settings.gameCategoryId || ''),
      pokemonCardCategoryId: String(setup.settings.pokemonCardCategoryId || ''),
      sportsCardCategoryId: String(setup.settings.sportsCardCategoryId || ''),
      yugiohCardCategoryId: String(setup.settings.yugiohCardCategoryId || ''),
      otherCategoryId: String(setup.settings.otherCategoryId || ''),
      activeListingTarget: String(setup.settings.activeListingTarget || 200),
    });
  }

  async function refreshSellerListingCount(sellerKey = adminKey) {
    if (!sellerKey) return;
    setSellerListingCountBusy(true);
    setSellerListingCountError('');
    try {
      const summary = await getSellerListingSummary({ adminKey: sellerKey }) as EbaySellerListingSummary;
      setSellerListingSummary(summary);
    } catch (error) {
      setSellerListingCountError(error instanceof Error ? error.message : 'Could not load the eBay account listing count.');
    } finally {
      setSellerListingCountBusy(false);
    }
  }

  async function refreshEbaySales() {
    if (!adminKey) return;
    setSellerSalesSyncBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await syncSoldOrders({ adminKey, days: 90 });
      setEbayNotice(`eBay sales refreshed: ${result.updated} listing${result.updated === 1 ? '' : 's'} moved to Sold, ${result.matched} matched, ${result.imported} new sale record${result.imported === 1 ? '' : 's'} imported, and ${result.unmatched} could not be imported.`);
      void refreshSellerListingCount();
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not refresh sold eBay orders.');
    } finally {
      setSellerSalesSyncBusy(false);
    }
  }

  async function unlockEbaySetup() {
    if (!adminKey) return;
    setEbayBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      const setup = await loadEbaySetup({ adminKey }) as EbaySetup;
      rememberSellerAccessKey();
      applyEbaySetup(setup);
      setSellerSetupExpanded(!setup.connected || Boolean(setup.warning));
      void refreshSellerListingCount(adminKey);
      if (setup.warning) setEbayError(setup.warning);
    } catch (error) {
      setEbaySetup(null);
      setEbayError(error instanceof Error ? error.message : 'Could not load eBay setup.');
    } finally {
      setEbayBusy(false);
    }
  }

  async function connectEbay() {
    if (!adminKey) return;
    setEbayBusy(true);
    setEbayError('');
    try {
      rememberSellerAccessKey();
      const result = await beginEbayOauth({ adminKey, returnUrl: `${window.location.origin}${window.location.pathname}${window.location.search}#listings` });
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not start eBay authorization.');
      setEbayBusy(false);
    }
  }

  async function saveSetup() {
    setEbayBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      await saveEbaySettings({
        adminKey,
        marketplaceId: ebaySettings.marketplaceId,
        currency: ebaySettings.currency,
        merchantLocationKey: optionalText(ebaySettings.merchantLocationKey),
        fulfillmentPolicyId: optionalText(ebaySettings.fulfillmentPolicyId),
        paymentPolicyId: optionalText(ebaySettings.paymentPolicyId),
        returnPolicyId: optionalText(ebaySettings.returnPolicyId),
        dvdCategoryId: optionalText(ebaySettings.dvdCategoryId),
        blurayCategoryId: optionalText(ebaySettings.blurayCategoryId),
        bookCategoryId: optionalText(ebaySettings.bookCategoryId),
        cdCategoryId: optionalText(ebaySettings.cdCategoryId),
        gameCategoryId: optionalText(ebaySettings.gameCategoryId),
        pokemonCardCategoryId: optionalText(ebaySettings.pokemonCardCategoryId),
        sportsCardCategoryId: optionalText(ebaySettings.sportsCardCategoryId),
        yugiohCardCategoryId: optionalText(ebaySettings.yugiohCardCategoryId),
        otherCategoryId: optionalText(ebaySettings.otherCategoryId),
        activeListingTarget,
      });
      await unlockEbaySetup();
      setEbayNotice('eBay draft defaults saved.');
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not save eBay setup.');
    } finally {
      setEbayBusy(false);
    }
  }

  async function createSandboxSetup() {
    if (!adminKey) return;
    setEbayBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      await provisionSandboxDefaults({
        adminKey,
        postalCode: sandboxSetup.postalCode,
        country: sandboxSetup.country,
        locationKey: sandboxSetup.locationKey,
        locationName: sandboxSetup.locationName,
        mediaMailCost: Number(sandboxSetup.mediaMailCost),
      });
      const setup = await loadEbaySetup({ adminKey }) as EbaySetup;
      applyEbaySetup(setup);
      setEbayNotice('Sandbox inventory location and default selling policies are ready.');
      if (setup.warning) setEbayError(setup.warning);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not create Sandbox seller defaults.');
    } finally {
      setEbayBusy(false);
    }
  }

  async function createEbayInventoryLocation() {
    if (!adminKey) return;
    setEbayBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      const selectedPolicies = {
        fulfillmentPolicyId: ebaySettings.fulfillmentPolicyId,
        paymentPolicyId: ebaySettings.paymentPolicyId,
        returnPolicyId: ebaySettings.returnPolicyId,
      };
      const result = await createInventoryLocation({
        adminKey,
        postalCode: sandboxSetup.postalCode,
        country: sandboxSetup.country,
        locationKey: sandboxSetup.locationKey,
        locationName: sandboxSetup.locationName,
      });
      const setup = await loadEbaySetup({ adminKey }) as EbaySetup;
      applyEbaySetup(setup);
      setEbaySettings((current) => ({
        ...current,
        ...selectedPolicies,
        merchantLocationKey: result.locationKey,
      }));
      setEbayNotice(`${result.created ? 'Created' : 'Selected'} eBay inventory location ${result.locationKey}. Save Draft Defaults to finish setup.`);
      if (setup.warning) setEbayError(setup.warning);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not create the eBay inventory location.');
    } finally {
      setEbayBusy(false);
    }
  }

  async function createMediaMailPolicy(selectForEditing = false) {
    if (!adminKey) return;
    setEbayBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await ensureMediaMailPolicy({
        adminKey,
        buyerShippingCost: Number(sandboxSetup.mediaMailCost),
      });
      const setup = await loadEbaySetup({ adminKey }) as EbaySetup;
      applyEbaySetup(setup);
      if (selectForEditing) {
        setEditing((current) => current ? { ...current, fulfillmentPolicyId: result.fulfillmentPolicyId } : current);
      }
      setEbayNotice(`${result.created ? 'Created' : 'Selected'} FlipTracker Media Mail. ${selectForEditing ? 'Save the listing, then publish again.' : 'It is now the default for eligible media.'}`);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not prepare the Media Mail policy.');
    } finally {
      setEbayBusy(false);
    }
  }

  async function sendToEbay(listing: Listing) {
    if (!adminKey) {
      setEbayError('Unlock eBay seller tools first.');
      return;
    }
    if (!sellerDefaultsReady) {
      setEbayError('Choose and save an inventory location, shipping policy, payment policy, and return policy before staging eBay offers.');
      return;
    }
    setOfferBusy(listing._id);
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await createEbayOffer({ adminKey, listingId: listing._id });
      setEbayNotice(`${result.updated ? 'Updated' : 'Created'} staged eBay offer ${result.offerId} for SKU ${result.sku}. It is not live or visible in Seller Hub Drafts.`);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not stage the eBay offer.');
    } finally {
      setOfferBusy(null);
    }
  }

  async function publishToEbay(listing: Listing) {
    if (!adminKey || !sellerDefaultsReady || !listing.ebayOfferId) return;
    const price = money(listing.currentPrice ?? listing.listedPrice);
    if (!confirm(`Publish "${listing.title}" live on eBay for ${price}? Buyers will be able to see and purchase this listing.`)) return;
    setOfferBusy(listing._id);
    setEbayError('');
    setEbayNotice('');
    try {
      await createEbayOffer({ adminKey, listingId: listing._id });
      const result = await publishEbayOffer({ adminKey, listingId: listing._id });
      setEbayNotice(`Published eBay listing ${result.listingId}. Use the listing link in the row to open it.`);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not publish the eBay listing.');
    } finally {
      setOfferBusy(null);
    }
  }

  function toggleSelected(listingId: Id<'marketplaceListings'>) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }

  function toggleQueueView() {
    const queueIds = queueListings.map((listing) => listing._id);
    const allSelected = queueIds.length > 0 && queueIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(queueIds));
  }

  async function openPricingReview() {
    const baseRows = selectedListings
      .filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && queueStatus(listing) !== 'eBay Draft Created')
      .map((listing) => {
        const workingPrice = listing.currentPrice ?? listing.listedPrice ?? listing.suggestedPrice;
        return {
          listingId: listing._id,
          title: listing.title,
          barcode: listing.assetBarcode,
          format: listing.mediaFormat,
          currentPrice: listing.currentPrice ?? listing.listedPrice,
          suggestedPrice: listing.suggestedPrice,
          suggestionSource: listing.suggestionSource,
          price: workingPrice !== undefined ? workingPrice.toFixed(2) : '',
        };
      });
    if (!baseRows.length) {
      setEbayError('Select at least one Draft or Pending eBay listing to price.');
      return;
    }
    if (!adminKey) {
      setPricingRows(baseRows);
      setEbayError('Enter the Seller Access Key to retrieve live eBay asking prices. Saved estimates are shown instead.');
      return;
    }
    setQueueBusy(true);
    setEbayError('');
    try {
      const liveResults: ActivePricingResult[] = [];
      const listingIds = baseRows.map((row) => row.listingId);
      for (let offset = 0; offset < listingIds.length; offset += 25) {
        const batch = await lookupActivePricing({
          adminKey,
          listingIds: listingIds.slice(offset, offset + 25),
        }) as ActivePricingResult[];
        liveResults.push(...batch);
      }
      const byListing = new Map(liveResults.map((result) => [result.listingId, result]));
      setPricingRows(baseRows.map((row) => {
        const live = byListing.get(row.listingId);
        const approvedPrice = row.currentPrice ?? live?.suggestedPrice ?? row.suggestedPrice;
        return {
          ...row,
          suggestedPrice: live?.suggestedPrice ?? row.suggestedPrice,
          suggestionSource: live?.source ?? row.suggestionSource,
          activeLow: live?.low,
          activeMedian: live?.median,
          activeHigh: live?.high,
          deliveredMedian: live?.deliveredMedian,
          matchCount: live?.matchCount,
          pricingConfidence: live?.confidence,
          pricingWarning: live?.warning,
          price: approvedPrice !== undefined ? approvedPrice.toFixed(2) : '',
        };
      }));
    } catch (error) {
      setPricingRows(baseRows);
      setEbayError(error instanceof Error ? error.message : 'Could not retrieve active eBay pricing. Saved estimates are shown instead.');
    } finally {
      setQueueBusy(false);
    }
  }

  function patchPricingRow(listingId: Id<'marketplaceListings'>, price: string) {
    setPricingRows((current) => current?.map((row) => row.listingId === listingId ? { ...row, price } : row) ?? null);
  }

  async function saveQueuePricing() {
    if (!pricingRows) return;
    const validRows = pricingRows.filter((row) => Number.isFinite(Number(row.price)) && Number(row.price) > 0);
    if (!validRows.length) {
      setEbayError('Enter at least one approved price above zero.');
      return;
    }
    setQueueBusy(true);
    setEbayError('');
    try {
      const result = await applyQueuePricing({
        updates: validRows.map((row) => ({
          listingId: row.listingId,
          price: Number(row.price),
          source: row.suggestedPrice !== undefined && Number(row.price) === row.suggestedPrice
            ? row.suggestionSource || 'Inventory suggestion'
            : 'Manual comp review',
        })),
      });
      setPricingRows(null);
      setEbayNotice(`${result.updated} listing price${result.updated === 1 ? '' : 's'} updated.${validRows.length < pricingRows.length ? ' Unpriced rows remain in Ready for Pricing.' : ''} Items missing required photos remain in Needs Photo.`);
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not update queue pricing.');
    } finally {
      setQueueBusy(false);
    }
  }

  async function sendSelectedToEbay() {
    if (!adminKey) {
      setEbayError('Enter the Seller Access Key before sending drafts to eBay.');
      return;
    }
    if (!selectedReadyForEbay.length) {
      setEbayError('Selected listings need an approved price and an eligible catalog match or actual item photo before they can be sent to eBay.');
      return;
    }
    if (!sellerDefaultsReady) {
      setEbayError('Choose and save an inventory location, shipping policy, payment policy, and return policy before creating eBay drafts.');
      return;
    }
    if (!confirm(`Create or refresh ${selectedReadyForEbay.length} unpublished eBay offer${selectedReadyForEbay.length === 1 ? '' : 's'}? Nothing will be published.`)) return;
    setQueueBusy(true);
    setEbayError('');
    setEbayNotice('');
    const succeeded: Id<'marketplaceListings'>[] = [];
    const failures: string[] = [];
    for (const listing of selectedReadyForEbay) {
      try {
        await createEbayOffer({ adminKey, listingId: listing._id });
        succeeded.push(listing._id);
      } catch (error) {
        failures.push(`${listing.title}: ${error instanceof Error ? error.message : 'Upload failed'}`);
      }
    }
    if (succeeded.length) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of succeeded) next.delete(id);
        return next;
      });
      setEbayNotice(`${succeeded.length} unpublished eBay offer${succeeded.length === 1 ? '' : 's'} created or refreshed.`);
    }
    if (failures.length) setEbayError(`${failures.length} item${failures.length === 1 ? '' : 's'} failed. ${failures.slice(0, 3).join(' ')}`);
    setQueueBusy(false);
  }

  async function save() {
    if (!editing?.title.trim()) return;
    const soldDate = editing.status === 'Sold' ? editing.soldDate || dateToday() : editing.soldDate;
    const soldPrice = editing.status === 'Sold' ? editing.soldPrice ?? editing.currentPrice ?? editing.listedPrice : editing.soldPrice;
    await updateListing({
      id: editing._id,
      platform: editing.platform,
      saleChannelDetail: editing.platform === 'Other' ? editing.saleChannelDetail || undefined : undefined,
      status: editing.status,
      sku: editing.sku || undefined,
      externalListingId: editing.externalListingId || undefined,
      listingUrl: editing.listingUrl || undefined,
      title: editing.title.trim(),
      description: editing.description || undefined,
      category: editing.category || undefined,
      condition: editing.condition || undefined,
      language: editing.language || undefined,
      bookTitle: editing.bookTitle || undefined,
      author: editing.author || undefined,
      cardProductType: isCardListing(editing) ? editing.cardProductType || 'Single Card' : undefined,
      cardGame: isCardListing(editing) && editing.assetType !== 'Sports Card' ? editing.cardGame || defaultCardGame(editing.assetType) : undefined,
      cardSport: editing.assetType === 'Sports Card' ? editing.cardSport || undefined : undefined,
      cardSet: isCardListing(editing) ? editing.cardSet || undefined : undefined,
      cardNumber: isCardListing(editing) ? editing.cardNumber || undefined : undefined,
      cardPlayer: editing.assetType === 'Sports Card' ? editing.cardPlayer || undefined : undefined,
      cardTeam: editing.assetType === 'Sports Card' ? editing.cardTeam || undefined : undefined,
      itemSpecifics: editing.itemSpecifics || undefined,
      listedPrice: editing.listedPrice,
      currentPrice: editing.currentPrice,
      soldPrice,
      purchasePrice: editing.purchasePrice,
      shippingCharged: editing.shippingCharged,
      shippingCost: editing.shippingCost,
      fees: editing.fees,
      listedDate: editing.status === 'Active' || editing.status === 'Sold' ? editing.listedDate || dateToday() : editing.listedDate,
      soldDate,
      buyer: editing.buyer || undefined,
      notes: editing.notes || undefined,
      ebayCategoryId: editing.ebayCategoryId || undefined,
      fulfillmentPolicyId: editing.fulfillmentPolicyId || undefined,
      shippingPreset: editing.shippingPreset || undefined,
      packageType: editing.packageType || undefined,
      packageWeightOz: editing.packageWeightOz,
      packageLengthIn: editing.packageLengthIn,
      packageWidthIn: editing.packageWidthIn,
      packageHeightIn: editing.packageHeightIn,
      imageMode: editing.imageMode || undefined,
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
    const headers = ['Platform', 'Sale Channel Detail', 'Title', 'SKU', 'Status', 'Listed Price', 'Current Price', 'Sold Price', 'Purchase Cost', 'Listed Date', 'Sold Date', 'Shipping Charged', 'Shipping Cost', 'Fees', 'Buyer', 'Net Profit', 'URL'];
    const rows = filtered.map((listing) => [
      listing.platform, listing.saleChannelDetail || '', listing.title, listing.sku || '', listing.status, listing.listedPrice || '', listing.currentPrice || '', listing.soldPrice || '', listing.purchasePrice || '',
      listing.listedDate || '', listing.soldDate || '', listing.shippingCharged || '', listing.shippingCost || '', listing.fees || '', listing.buyer || '',
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
        <div className="metric"><span>eBay Account Active</span><strong>{sellerListingSummary?.activeCount ?? '-'}</strong></div>
        <div className="metric"><span>FlipTracker Active</span><strong>{stats?.activeCount ?? '-'}</strong></div>
        <div className="metric"><span>Active Value</span><strong>{stats ? money(stats.activeValue) : '-'}</strong></div>
        <div className="metric"><span>Sold Revenue</span><strong>{stats ? money(stats.soldRevenue) : '-'}</strong></div>
        <div className="metric"><span>Net Profit</span><strong className={stats && stats.soldNetProfit < 0 ? 'lossValue' : 'profitValue'}>{stats ? money(stats.soldNetProfit) : '-'}</strong></div>
        <div className="metric"><span>Avg. Days To Sell</span><strong>{stats ? stats.averageDaysToSell.toFixed(1) : '-'}</strong></div>
      </section>

      <section className="panel listingQueueBar">
        <div className="queueSummary">
          <div><p className="eyebrow">Listing queue</p><h2>Select, price, stage, then publish</h2><p>{queueListings.length} Draft/Pending in this view · {selectedIds.size} selected · {selectedReadyForEbay.length} selected and ready</p></div>
          <div className="queueSteps" aria-label="Listing queue stages"><span>1. Select</span><span>2. Find Fair Value</span><span>3. Stage with eBay</span><span>4. Publish</span></div>
        </div>
        <div className="actions queueActions">
          <button className="secondary" disabled={!queueListings.length || queueBusy} onClick={toggleQueueView}><CheckCircle2 size={16}/> {queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id)) ? 'Clear Selection' : 'Select All in View'}</button>
          <button disabled={!selectedIds.size || queueBusy} onClick={openPricingReview}><DollarSign size={16}/> {queueBusy ? 'Checking eBay...' : 'Find Fair Value'}</button>
          <button className="ebaySendButton" disabled={!selectedReadyForEbay.length || queueBusy || !sellerDefaultsReady} onClick={sendSelectedToEbay}><Send size={16}/> {queueBusy ? 'Working...' : `Stage with eBay${selectedReadyForEbay.length ? ` (${selectedReadyForEbay.length})` : ''}`}</button>
        </div>
        {ebayNotice ? <p className="setupNotice successNotice">{ebayNotice}</p> : null}
        {ebayError ? <p className="setupNotice errorNotice">{ebayError}</p> : null}
      </section>

      <section className="panel ebaySetupPanel">
        <div className="panelHeader">
          <div><h2>Link Your eBay Account</h2><p>{ebaySetup?.connected && !sellerSetupExpanded ? (sellerDefaultsReady ? 'Connected and ready. Expand to manage location, policies, categories, and account counts.' : 'Connected, but listing defaults need attention.') : 'Link the seller account, then choose its policies and inventory location before staging offers from FlipTracker.'}</p></div>
          <div className="ebayConnectionHeaderActions">
            {ebaySetup?.connected ? <span className="statusPill ebayConnected"><ShieldCheck size={14}/> Connected · {ebaySetup.environment}</span> : <span className="statusPill"><KeyRound size={14}/> Seller only</span>}
            {ebaySetup?.connected ? <button className="iconButton secondary setupCollapseButton" aria-expanded={sellerSetupExpanded} aria-label={sellerSetupExpanded ? 'Collapse eBay seller settings' : 'Expand eBay seller settings'} title={sellerSetupExpanded ? 'Collapse seller settings' : 'Manage seller settings'} onClick={() => setSellerSetupExpanded((expanded) => !expanded)}><ChevronDown size={18}/></button> : null}
          </div>
        </div>
        {!ebaySetup?.connected ? (
          <div className="ebayUnlockRow accountLinkRow">
            <div className="sellerKeyField">
              <label>Private Access Key<input type="password" autoComplete="off" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Enter the private beta seller key"/></label>
              <label className="rememberSellerKey" title="Stores the beta seller key in this browser only"><input type="checkbox" checked={rememberSellerKey} onChange={(event) => changeRememberSellerKey(event.target.checked)}/> Remember this account on this device</label>
            </div>
            <button className="secondary" disabled={!adminKey || ebayBusy} onClick={unlockEbaySetup}><Settings size={16}/> {ebayBusy ? 'Loading...' : 'Load Account Setup'}</button>
            <button disabled={!adminKey || ebayBusy} onClick={connectEbay}><Link size={16}/> Link eBay Account</button>
          </div>
        ) : null}
        {ebaySetup?.connected && sellerSetupExpanded ? (
          <>
          <div className={`sellerListingMeter ${projectedEbayListings >= activeListingTarget ? 'atTarget' : ''}`}>
            <div className="sellerListingMeterHeader">
              <div><span className="eyebrow">Account-wide eBay count</span><h3>{sellerListingSummary ? `${sellerListingSummary.activeCount} active listing${sellerListingSummary.activeCount === 1 ? '' : 's'}` : 'Count not checked yet'}</h3></div>
              <button className="secondary" disabled={sellerListingCountBusy} onClick={() => refreshSellerListingCount()}><RefreshCw size={16}/>{sellerListingCountBusy ? 'Checking...' : 'Refresh Count'}</button>
            </div>
            <div className="sellerListingMeterStats">
              <div><span>Active</span><strong>{sellerListingSummary?.activeCount ?? '-'}</strong></div>
              <div><span>Scheduled</span><strong>{sellerListingSummary?.scheduledCount ?? '-'}</strong></div>
              <div><span>Room to {activeListingTarget}</span><strong>{sellerListingSummary ? roomToListingTarget : '-'}</strong></div>
            </div>
            <div className="listingTargetTrack" role="progressbar" aria-label="eBay listing target usage" aria-valuemin={0} aria-valuemax={activeListingTarget} aria-valuenow={sellerListingSummary ? projectedEbayListings : 0}><span style={{ width: `${sellerListingSummary ? listingTargetPercent : 0}%` }}/></div>
            <p>{sellerListingSummary ? `Checked ${new Date(sellerListingSummary.checkedAt).toLocaleString()}. ` : ''}This is eBay's account-wide active count, including listings created outside FlipTracker. It is a planning guardrail, not eBay's monthly zero-insertion-fee usage.</p>
            {sellerListingCountError ? <div className="listingCountError"><p className="formError">{sellerListingCountError}</p><button onClick={connectEbay}><Link size={16}/> Authorize Account Count</button></div> : null}
          </div>
          <div className="ebaySettingsGrid ebayCoreSettingsGrid">
            <label>Inventory Location<select value={ebaySettings.merchantLocationKey} onChange={(event) => setEbaySettings((current) => ({ ...current, merchantLocationKey: event.target.value }))}><option value="">Choose location</option>{ebaySetup.locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}</select></label>
            <label>Default Shipping Policy<select value={ebaySettings.fulfillmentPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, fulfillmentPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.fulfillment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select><small>Individual listings can choose a different policy.</small></label>
            <label>Payment Policy<select value={ebaySettings.paymentPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, paymentPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.payment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <label>Return Policy<select value={ebaySettings.returnPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, returnPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.returns.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <label>Active Listing Target<input type="number" min="1" max="25000" step="1" value={ebaySettings.activeListingTarget} onChange={(event) => setEbaySettings((current) => ({ ...current, activeListingTarget: event.target.value }))}/></label>
            <label>Media Mail Buyer Charge<input type="number" min="0" step="0.01" value={sandboxSetup.mediaMailCost} onChange={(event) => setSandboxSetup((current) => ({ ...current, mediaMailCost: event.target.value }))}/></label>
            <div className="categoryRoutingSummary"><Tags size={18}/><div><strong>Automatic category routing</strong><small>ISBNs, UPCs, and item type route books, movies, games, CDs, and cards automatically. Choose a different category only while editing an exception.</small></div></div>
            <div className="actions ebaySetupActions"><button className="secondary" disabled={ebayBusy} onClick={unlockEbaySetup}><RefreshCw size={16}/> Refresh eBay Data</button><button className="secondary" disabled={ebayBusy || Number(sandboxSetup.mediaMailCost) < 0} onClick={() => createMediaMailPolicy()}><Truck size={16}/> Create/Select Media Mail</button><button disabled={ebayBusy} onClick={saveSetup}><Save size={16}/> Save Draft Defaults</button><button className="secondary forgetDeviceButton" disabled={ebayBusy} onClick={forgetSellerDevice}><LogOut size={16}/> Forget Device</button></div>
          </div>
          </>
        ) : null}
        {ebaySetup?.connected && sellerSetupExpanded && ebaySetup.environment === 'production' && !ebaySetup.locations.length ? (
          <div className="sandboxSetupPanel">
            <div><h3>Create Inventory Location</h3><p>Add the warehouse location eBay requires for Inventory API drafts. This does not change your business policies.</p></div>
            <div className="sandboxSetupGrid inventoryLocationSetupGrid">
              <label>Seller Postal Code<input value={sandboxSetup.postalCode} onChange={(event) => setSandboxSetup((current) => ({ ...current, postalCode: event.target.value }))} placeholder="29401"/></label>
              <label>Country<input maxLength={2} value={sandboxSetup.country} onChange={(event) => setSandboxSetup((current) => ({ ...current, country: event.target.value.toUpperCase() }))}/></label>
              <label>Location Key<input value={sandboxSetup.locationKey} onChange={(event) => setSandboxSetup((current) => ({ ...current, locationKey: event.target.value }))}/></label>
              <label>Location Name<input value={sandboxSetup.locationName} onChange={(event) => setSandboxSetup((current) => ({ ...current, locationName: event.target.value }))}/></label>
              <button disabled={ebayBusy || !sandboxSetup.postalCode.trim()} onClick={createEbayInventoryLocation}><MapPin size={16}/> {ebayBusy ? 'Creating...' : 'Create Location'}</button>
            </div>
          </div>
        ) : null}
        {ebaySetup?.connected && sellerSetupExpanded && ebaySetup.environment === 'sandbox' && !sellerDefaultsReady ? (
          <div className="sandboxSetupPanel">
            <div><h3>Prepare Sandbox Seller</h3><p>Create the warehouse location and basic Media Mail, payment, and return policies needed by eBay drafts.</p></div>
            <p className="ebaySafetyNote">If eBay returns a system error, <a href="https://developer.ebay.com/support/api-status" target="_blank" rel="noreferrer">check eBay Sandbox API status</a>. Seller policies cannot be prepared while its Account API is unavailable.</p>
            <div className="sandboxSetupGrid">
              <label>Seller Postal Code<input value={sandboxSetup.postalCode} onChange={(event) => setSandboxSetup((current) => ({ ...current, postalCode: event.target.value }))} placeholder="29401"/></label>
              <label>Country<input maxLength={2} value={sandboxSetup.country} onChange={(event) => setSandboxSetup((current) => ({ ...current, country: event.target.value.toUpperCase() }))}/></label>
              <label>Location Key<input value={sandboxSetup.locationKey} onChange={(event) => setSandboxSetup((current) => ({ ...current, locationKey: event.target.value }))}/></label>
              <label>Location Name<input value={sandboxSetup.locationName} onChange={(event) => setSandboxSetup((current) => ({ ...current, locationName: event.target.value }))}/></label>
              <label>Buyer Media Mail Charge<input type="number" min="0" step="0.01" value={sandboxSetup.mediaMailCost} onChange={(event) => setSandboxSetup((current) => ({ ...current, mediaMailCost: event.target.value }))}/></label>
              <button disabled={ebayBusy || !sandboxSetup.postalCode.trim()} onClick={createSandboxSetup}><Package size={16}/> {ebayBusy ? 'Preparing...' : 'Create Sandbox Defaults'}</button>
            </div>
            <p className="ebaySafetyNote">Reconnect eBay once after this update so the account connection includes policy-management permission.</p>
          </div>
        ) : null}
        {!ebaySetup?.connected || sellerSetupExpanded ? <p className="ebaySafetyNote">Staged Inventory API offers do not appear in Seller Hub Drafts. Review every field in FlipTracker, then use Publish to eBay to create the live listing.</p> : null}
      </section>

      <section className="panel listingControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search listings..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>{['All', ...STATUSES].map((value) => <option key={value}>{value}</option>)}</select>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)}>{['All', ...PLATFORMS].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by queue type" value={queueType} onChange={(event) => setQueueType(event.target.value)}><option value="All">Queue: All</option>{QUEUE_TYPES.map((value) => <option key={value} value={value}>{`Queue: ${value}`}</option>)}</select>
        <select aria-label="Sort listings" value={sortBy} onChange={(event) => setSortBy(event.target.value as ListingSort)}>{(['Newest', 'Queue', 'Status', 'Price High', 'Price Low'] as ListingSort[]).map((value) => <option key={value} value={value}>{`Sort: ${value}`}</option>)}</select>
        <div className="actions listingTools"><button className="secondary" disabled={sellerSalesSyncBusy || !ebaySetup?.connected} onClick={refreshEbaySales}><RefreshCw size={16}/>{sellerSalesSyncBusy ? 'Refreshing Sales...' : 'Sync eBay Sales'}</button><label className="button secondary"><Upload size={16}/> Import Old JSON<input type="file" accept="application/json,.json" hidden onChange={importOldJson}/></label><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div>
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader"><div><h2>Marketplace Listings</h2><p>{listings === undefined ? 'Loading Convex data...' : `${filtered.length} listing${filtered.length === 1 ? '' : 's'} in this view`}</p></div><button className="secondary" onClick={onAddOtherItem}><Plus size={16}/> Add Other Item</button></div>
        {listings === undefined ? <p className="panelMessage">Loading listings...</p> : filtered.length === 0 ? <div className="empty"><h2>No listings found</h2><p>Create a draft from an item in Inventory, then track it through sale.</p></div> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th className="selectColumn"><input type="checkbox" aria-label="Select all eligible listings in view" checked={queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id))} onChange={toggleQueueView}/></th><th>Platform</th><th>Title</th><th>Queue</th><th>Status</th><th>Price</th><th>Location</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((listing) => (
                <tr key={listing._id}>
                  <td className="selectColumn">{listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) ? <input type="checkbox" aria-label={`Select ${listing.title}`} checked={selectedIds.has(listing._id)} onChange={() => toggleSelected(listing._id)}/> : null}</td>
                  <td><span className="consoleTag">{listing.platform}</span></td>
                  <td><strong>{listing.title}</strong><small>{listing.assetTitle}{listing.sku ? ` · SKU ${listing.sku}` : ''}</small></td>
                  <td><span className={`queueBadge ${queueStatus(listing).toLowerCase().replace(/\s+/g, '-')}`}>{queueStatus(listing)}</span>{listing.pricingSource ? <small>{listing.pricingSource}</small> : null}</td>
                  <td><span className={`badge ${listing.status.toLowerCase()}`}>{listing.status}</span>{listing.ebayDraftStatus ? <small className="ebayDraftMeta">eBay: {listing.ebayDraftStatus}</small> : null}{listing.ebayOrderId ? <small>Order {listing.ebayOrderId}</small> : null}{listing.ebayLastError ? <small className="ebayDraftError">{listing.ebayLastError}</small> : null}</td>
                  <td className="valueCell">{money(listing.status === 'Sold' ? listing.soldPrice : listing.currentPrice ?? listing.listedPrice)}</td>
                  <td>{listing.storageLocation || ''}</td>
                  <td className="tableActionsCell"><div className="rowActions">
                    {listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && queueStatus(listing) === 'Ready for eBay' ? <button className="iconButton ebayUploadButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} aria-label={`Stage ${listing.title} with eBay`} title={!sellerDefaultsReady ? 'Complete eBay Seller Connection first' : 'Stage offer with eBay'} onClick={() => sendToEbay(listing)}><CloudUpload size={16}/></button> : null}
                    {listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && Boolean(listing.ebayOfferId) ? <button className="iconButton ebayPublishButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} aria-label={`Publish ${listing.title} on eBay`} title="Review and publish live on eBay" onClick={() => publishToEbay(listing)}><Rocket size={16}/></button> : null}
                    {listing.platform === 'eBay' && listing.status === 'Active' && Boolean(listing.ebayOfferId && listing.externalListingId) ? <button className="iconButton ebayRepriceButton" disabled={repriceBusy} aria-label={`Update live eBay price for ${listing.title}`} title="Update live eBay price" onClick={() => openRepriceEditor(listing)}><BadgeDollarSign size={16}/></button> : null}
                    {listing.platform === 'eBay' && listing.status === 'Active' && Boolean(listing.externalListingId) ? <button className="iconButton ebayEndButton" disabled={endListingBusy || !adminKey} aria-label={`End ${listing.title} on eBay`} title="End live eBay listing" onClick={() => { setEndListingError(''); setEndListingPrompt(listing); }}><CircleStop size={16}/></button> : null}
                    <button className="iconButton saleCloseButton" aria-label={`${listing.status === 'Sold' ? 'Edit sale for' : 'Record sale for'} ${listing.title}`} title={listing.status === 'Sold' ? 'Edit sale details' : 'Record sale'} onClick={() => requestSaleEditor(listing)}><DollarSign size={15}/></button>
                    <button className="iconButton" aria-label={`Edit ${listing.title}`} title="Edit listing" onClick={() => openListingEditor(listing)}><Pencil size={15}/></button>
                    {listing.listingUrl ? <a className="button iconButton secondary" href={listing.listingUrl} target="_blank" rel="noreferrer" aria-label="Open marketplace listing" title="Open marketplace listing"><ExternalLink size={15}/></a> : null}
                    <button className="danger iconButton" aria-label={`Delete ${listing.title}`} title="Delete listing" onClick={() => remove(listing)}><Trash2 size={15}/></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {repricing ? (
        <div className="modalBackdrop"><section className="modal repriceModal">
          <header className="modalHeader"><div><h2>Update Live eBay Price</h2><p>{repricing.title}</p></div><button className="iconButton secondary" aria-label="Close price update" onClick={() => setRepricing(null)}><X size={18}/></button></header>
          <div className="repriceCurrent"><span>Current public price</span><strong>{money(repricePreview?.currentPrice)}</strong><small>Original listing price: {money(repricing.listedPrice)}</small></div>
          <div className="repriceModes" role="tablist" aria-label="Price calculation method">
            <button type="button" className={repriceMode === 'percentage' ? 'active' : 'secondary'} onClick={() => setRepriceMode('percentage')}><Percent size={16}/> Percentage</button>
            <button type="button" className={repriceMode === 'exact' ? 'active' : 'secondary'} onClick={() => setRepriceMode('exact')}><BadgeDollarSign size={16}/> Exact Price</button>
            <button type="button" className={repriceMode === 'profit' ? 'active' : 'secondary'} onClick={() => setRepriceMode('profit')}><Calculator size={16}/> Profit Floor</button>
          </div>
          {repriceMode === 'percentage' ? <div className="repriceInputBand"><label>Reduce current price by<input type="number" inputMode="decimal" min="0.1" max="90" step="0.1" value={repricePercent} onChange={(event) => setRepricePercent(event.target.value)}/><span>%</span></label><small>A regular price update changes the visible eBay price. It does not create a crossed-out sale price.</small></div> : null}
          {repriceMode === 'exact' ? <div className="repriceInputBand"><label>New public price ($)<input type="number" inputMode="decimal" min="0.99" step="0.01" value={repriceExact} onChange={(event) => setRepriceExact(event.target.value)}/></label><small>Use this when you already know the exact amount you want buyers to see.</small></div> : null}
          {repriceMode === 'profit' ? <div className="repriceProfitGrid">
            <label>Item Cost<input type="number" value={repricing.purchasePrice ?? 0} disabled/></label>
            <label>Estimated eBay Fee %<input type="number" min="0" max="50" step="0.1" value={repriceFeePercent} onChange={(event) => setRepriceFeePercent(event.target.value)}/></label>
            <label>Estimated Shipping Cost<input type="number" min="0" step="0.01" value={repriceShippingCost} onChange={(event) => setRepriceShippingCost(event.target.value)}/></label>
            <label>Buyer Shipping Charge<input type="number" min="0" step="0.01" value={repriceShippingCharged} onChange={(event) => setRepriceShippingCharged(event.target.value)}/></label>
            <label>Target Net Profit<input type="number" min="0" step="0.01" value={repriceTargetProfit} onChange={(event) => setRepriceTargetProfit(event.target.value)}/></label>
            <label className="repriceCharm"><input type="checkbox" checked={repriceCharm} onChange={(event) => setRepriceCharm(event.target.checked)}/><span>Round up to a .99 price</span></label>
          </div> : null}
          <div className="repricePreview">
            <div><span>New eBay Price</span><strong>{money(repricePreview?.price)}</strong><small className={(repricePreview?.changePercent ?? 0) <= 0 ? 'profitValue' : 'warningText'}>{repricePreview ? `${repricePreview.changePercent > 0 ? '+' : ''}${repricePreview.changePercent.toFixed(1)}% from current` : ''}</small></div>
            <div><span>Estimated Fees</span><strong>{money(repricePreview?.marketplaceFees)}</strong><small>Using {Number(repriceFeePercent || 0).toFixed(1)}%</small></div>
            <div><span>Estimated Net Profit</span><strong className={(repricePreview?.estimatedProfit ?? 0) < 0 ? 'lossValue' : 'profitValue'}>{money(repricePreview?.estimatedProfit)}</strong><small>Price + buyer shipping − fees − cost − shipping</small></div>
          </div>
          <p className="ebaySafetyNote">This updates the active eBay listing immediately. Estimates do not include taxes, promoted-listing fees, refunds, or other adjustments.</p>
          {repriceError ? <p className="formError">{repriceError}</p> : null}
          <div className="actions modalActions"><button className="secondary" disabled={repriceBusy} onClick={() => setRepricing(null)}>Cancel</button><button disabled={repriceBusy || !repricePreview?.valid} onClick={submitReprice}><BadgeDollarSign size={16}/>{repriceBusy ? 'Updating eBay...' : 'Confirm Price Update'}</button></div>
        </section></div>
      ) : null}

      {pricingRows ? (
        <div className="modalBackdrop"><section className="modal wideModal pricingReviewModal">
          <header className="modalHeader"><div><h2>Update Pricing</h2><span className="statusPill">{pricingRows.length} selected listing{pricingRows.length === 1 ? '' : 's'}</span></div><button className="iconButton secondary" aria-label="Close pricing review" onClick={() => setPricingRows(null)}><X size={18}/></button></header>
          <p className="pricingIntro">FlipTracker uses the median of credible active eBay listings as an asking-price recommendation. These are active listings, not verified sold prices.</p>
          <div className="pricingReviewList">
            {pricingRows.map((row) => {
              const researchListing = { assetBarcode: row.barcode, title: row.title, mediaFormat: row.format };
              const workingValue = Number(row.price) || row.suggestedPrice || row.currentPrice || 0;
              return <article className="pricingReviewRow" key={row.listingId}>
                <div className="pricingIdentity"><strong>{row.title}</strong><small>{[row.format, row.barcode].filter(Boolean).join(' · ')}</small>{row.suggestedPrice !== undefined ? <span>Suggested {money(row.suggestedPrice)} · {row.suggestionSource}</span> : <span className="needsPrice"><AlertTriangle size={13}/> No reliable active match; check comps</span>}{row.pricingWarning ? <small className="warningText">{row.pricingWarning}</small> : null}</div>
                <div className="pricingCompare"><span>Active Range<strong>{row.activeLow !== undefined ? `${money(row.activeLow)}–${money(row.activeHigh)}` : 'Not available'}</strong></span><span>Median Delivered<strong>{row.deliveredMedian !== undefined ? money(row.deliveredMedian) : 'Review'}</strong></span><span>Confidence<strong>{row.pricingConfidence || 'Saved value'}</strong></span><span>Matches<strong>{row.matchCount ?? '—'}</strong></span></div>
                <label>Approved Price<input type="number" inputMode="decimal" min="0.01" step="0.01" value={row.price} onChange={(event) => patchPricingRow(row.listingId, event.target.value)} placeholder="0.00"/></label>
                <div className="actions pricingResearch"><a className="button secondary" href={soldCompsUrl(researchListing)} target="_blank" rel="noreferrer"><Search size={15}/> Sold Comps</a>{workingValue >= 50 ? <a className="button secondary" href={terapeakUrl(researchListing)} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Terapeak</a> : null}</div>
              </article>;
            })}
          </div>
          <div className="actions right"><button className="secondary" onClick={() => setPricingRows(null)}>Cancel</button><button disabled={queueBusy || !pricingRows.some((row) => Number(row.price) > 0)} onClick={saveQueuePricing}><DollarSign size={16}/> {queueBusy ? 'Updating...' : 'Apply Approved Prices'}</button></div>
        </section></div>
      ) : null}

      {endListingPrompt ? (
        <div className="modalBackdrop"><section className="modal endListingModal">
          <header className="modalHeader"><div><h2>End eBay Listing</h2><span className="statusPill">{endListingPrompt.title}</span></div><button className="iconButton secondary" disabled={endListingBusy} aria-label="Close end listing confirmation" onClick={() => setEndListingPrompt(null)}><X size={18}/></button></header>
          <div className="endListingQuestion">
            <CircleStop size={24}/>
            <div><h3>Did this item sell somewhere else?</h3><p>FlipTracker will first end the live eBay listing. Choose whether to return the item to inventory or continue into the sale form.</p></div>
          </div>
          {endListingError ? <p className="formError">{endListingError}</p> : null}
          <div className="actions right"><button className="secondary" disabled={endListingBusy} onClick={() => setEndListingPrompt(null)}>Cancel</button><button className="secondary" disabled={endListingBusy} onClick={() => finishEbayListing(false)}>{endListingBusy ? 'Ending...' : 'No, End Only'}</button><button disabled={endListingBusy} onClick={() => finishEbayListing(true)}><DollarSign size={16}/> {endListingBusy ? 'Ending...' : 'Yes, Record Sale'}</button></div>
        </section></div>
      ) : null}

      {saleEditing ? (
        <div className="modalBackdrop"><section className="modal saleCloseoutModal">
          <header className="modalHeader"><div><h2>Record Sale</h2><span className="statusPill">{saleEditing.assetTitle}</span></div><button className="iconButton secondary" aria-label="Close sale details" onClick={() => setSaleEditing(null)}><X size={18}/></button></header>
          <div className="saleCloseoutGrid">
            <label>Sold On<select value={saleEditing.salePlatform || saleEditing.platform} onChange={(event) => patchSale({ salePlatform: event.target.value })}>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Order / Reference<input value={saleEditing.saleReference || ''} onChange={(event) => patchSale({ saleReference: event.target.value })} placeholder="Optional order or sale reference"/></label>
            {(saleEditing.salePlatform || saleEditing.platform) === 'Other' ? <label className="span2">Sale Channel<input value={saleEditing.saleChannelDetail || ''} onChange={(event) => patchSale({ saleChannelDetail: event.target.value })} placeholder="Local shop, yard sale, convention..."/></label> : null}
            <label>Sold Date<input type="date" value={saleEditing.soldDate || ''} onChange={(event) => patchSale({ soldDate: event.target.value })}/></label>
            <label>Sale Price<input required type="number" min="0" step="0.01" value={saleEditing.soldPrice ?? ''} onChange={(event) => patchSale({ soldPrice: optionalNumber(event.target.value) })}/></label>
            <label>What You Paid<input type="number" min="0" step="0.01" value={saleEditing.purchasePrice ?? ''} onChange={(event) => patchSale({ purchasePrice: optionalNumber(event.target.value) })}/></label>
            <label>Shipping Charged<input type="number" min="0" step="0.01" value={saleEditing.shippingCharged ?? ''} onChange={(event) => patchSale({ shippingCharged: optionalNumber(event.target.value) })}/></label>
            <label>Actual Shipping Cost<input type="number" min="0" step="0.01" value={saleEditing.shippingCost ?? ''} onChange={(event) => patchSale({ shippingCost: optionalNumber(event.target.value) })}/></label>
            <label>Marketplace Fees<input type="number" min="0" step="0.01" value={saleEditing.fees ?? ''} onChange={(event) => patchSale({ fees: optionalNumber(event.target.value) })}/></label>
            <label className="span2">Buyer / Customer<input value={saleEditing.buyer || ''} onChange={(event) => patchSale({ buyer: event.target.value })} placeholder="Optional name or username"/></label>
            <label className="span2">Sale Notes<textarea value={saleEditing.notes || ''} onChange={(event) => patchSale({ notes: event.target.value })} placeholder="Pickup details, payment method, bundle notes, returns, or anything useful later."/></label>
          </div>
          <div className="saleProfitSummary"><span>Net Profit</span><strong className={netProfit(saleEditing) < 0 ? 'lossValue' : 'profitValue'}>{money(netProfit(saleEditing))}</strong><small>Sale + shipping charged − item cost − fees − shipping cost</small></div>
          <div className="actions right"><button className="secondary" onClick={() => setSaleEditing(null)}>Cancel</button><button disabled={saleEditing.soldPrice === undefined || saleEditing.soldPrice < 0} onClick={saveSale}><Save size={16}/> Save Sale</button></div>
        </section></div>
      ) : null}

      {editing ? (
        <div className="modalBackdrop"><section className="modal wideModal listingFactoryModal">
          <header className="modalHeader"><div><p className="eyebrow">eBay listing factory</p><h2>{editing.title || editing.assetTitle}</h2><span className="statusPill">{[editing.assetType, editing.assetBarcode].filter(Boolean).join(' · ') || 'Manual item'}</span></div><button className="iconButton secondary" aria-label="Close" onClick={() => setEditing(null)}><X size={18}/></button></header>
          <nav className="listingEditorSteps" aria-label="Listing editor sections">
            {LISTING_EDITOR_STEPS.map((step, index) => <button type="button" key={step.id} className={editorStep === step.id ? 'active' : 'secondary'} onClick={() => setEditorStep(step.id)}><span>{index + 1}</span>{step.label}</button>)}
          </nav>
          <div className="listingReadinessBar">
            <span className={editing.title.trim() ? 'ready' : 'missing'}>{editing.title.trim() ? 'Title ready' : 'Title needed'}</span>
            <span className={editing.ebayCategoryId ? 'ready' : 'missing'}>{editing.ebayCategoryId ? 'Category routed' : 'Check category'}</span>
            <span className={editing.fulfillmentPolicyId || ebaySettings.fulfillmentPolicyId ? 'ready' : 'missing'}>{editing.fulfillmentPolicyId || ebaySettings.fulfillmentPolicyId ? 'Shipping set' : 'Shipping needed'}</span>
            <span className={editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? 'ready' : 'missing' : editing.hasActualPhoto ? 'ready' : 'missing'}>{editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? 'Image ready' : 'Image needed' : editing.hasActualPhoto ? 'Photos ready' : 'Photo needed'}</span>
            <span className={(editing.currentPrice ?? editing.listedPrice ?? 0) > 0 ? 'ready' : 'missing'}>{(editing.currentPrice ?? editing.listedPrice ?? 0) > 0 ? 'Price ready' : 'Price needed'}</span>
          </div>
          <div className="formGrid listingFactoryForm">
            {editorStep === 'details' ? <>
            <label>Platform<select value={editing.platform} onChange={(event) => patchEditing({ platform: event.target.value })}>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={editing.status} onChange={(event) => patchEditing({ status: event.target.value })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
            {editing.platform === 'Other' ? <label className="span2">Sale Channel<input value={editing.saleChannelDetail || ''} onChange={(event) => patchEditing({ saleChannelDetail: event.target.value })} placeholder="Local shop, yard sale, convention..."/></label> : null}
            <label className="span2">Listing Title<input value={editing.title} onChange={(event) => patchEditing({ title: event.target.value })}/></label>
            <label>SKU<input value={editing.sku || ''} onChange={(event) => patchEditing({ sku: event.target.value })}/></label>
            <label>Marketplace Item ID<input value={editing.externalListingId || ''} onChange={(event) => patchEditing({ externalListingId: event.target.value })}/></label>
            <label className="span2">Listing URL<input type="url" value={editing.listingUrl || ''} onChange={(event) => patchEditing({ listingUrl: event.target.value })}/></label>
            <label>Condition<input value={editing.condition || ''} onChange={(event) => patchEditing({ condition: event.target.value, imageMode: isNewCondition(event.target.value) || (isBookListing(editing) && Boolean(editing.photoUrl)) ? editing.imageMode : 'Actual Item Photo' })}/></label>
            <label>Language<select value={editing.language || 'English'} onChange={(event) => patchEditing({ language: event.target.value })}>{editing.language && !LANGUAGE_OPTIONS.includes(editing.language) ? <option value={editing.language}>{editing.language}</option> : null}{LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language}</option>)}</select><small>Sent to eBay as the Language item specific.</small></label>
            </> : null}
            {editorStep === 'category' ? <>
            <div className="categoryAutoRoute span2"><Tags size={20}/><div><strong>Automatic category</strong><span>{editing.category || editing.assetType || 'eBay will use the item type and product identifier'}</span><small>{editing.ebayCategoryId ? `Leaf category ${editing.ebayCategoryId}` : editing.assetBarcode ? `Routed from ${editing.assetBarcode}` : 'Confirm an exception below only when the automatic category is not right.'}</small></div></div>
            <label className="span2">Category Route<select value={selectedCategoryRoute(editing)} onChange={(event) => selectListingCategory(event.target.value)}><option value="auto">Automatic for this item</option>{EBAY_CATEGORY_CHOICES.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}{choice.requiresLeafSelection ? ' — choose leaf category next' : ''}</option>)}</select><small>Books, movies, games, CDs, and cards route automatically. Clothing and general merchandise need a more specific leaf category.</small></label>
            <details className="advancedListingOptions span2"><summary>Choose a different eBay category</summary><div className="advancedListingBody"><EbayCategoryFinder query={[editing.title, editing.assetType, editing.mediaFormat].filter(Boolean).join(' ')} selectedCategoryId={editing.ebayCategoryId} onSelect={(suggestion) => patchEditing({ category: suggestion.categoryPath, ebayCategoryId: suggestion.categoryId })}/></div></details>
            <label className="span2">eBay Type<input list="ebay-type-suggestions" value={itemSpecificValue(editing.itemSpecifics, 'Type') || ''} onChange={(event) => patchEditing({ itemSpecifics: setItemSpecificValue(editing.itemSpecifics, 'Type', event.target.value) })} placeholder="Textbook, Handbook, Novel, Movie, TV Series..."/><small>This is eBay's category-specific Type, separate from FlipTracker's inventory format. Use the value that best describes this edition.</small></label>
            <datalist id="ebay-type-suggestions"><option value="Textbook"/><option value="Handbook"/><option value="Study Guide"/><option value="Reference"/><option value="Novel"/><option value="Movie"/><option value="TV Series"/><option value="Album"/><option value="Single"/><option value="Video Game"/></datalist>
            {isBookListing(editing) ? <label className="span2">Book Title<input maxLength={65} value={editing.bookTitle || ''} onChange={(event) => patchEditing({ bookTitle: event.target.value })}/><small>Required by eBay for book categories. Maximum 65 characters. {(editing.bookTitle || '').length}/65</small></label> : null}
            {isBookListing(editing) ? <label className="span2">Author<input value={editing.author || ''} onChange={(event) => patchEditing({ author: event.target.value })}/><small>Required by eBay for book categories. Confirm the credited author before staging.</small></label> : null}
            {isCardListing(editing) ? <div className="formSection span2"><h3>Card Details</h3><div className="sectionGrid">
              <label>Sale Format<select value={editing.cardProductType || 'Single Card'} onChange={(event) => patchEditing({ cardProductType: event.target.value, ebayCategoryId: undefined })}>{CARD_PRODUCT_TYPES.map(value => <option key={value}>{value}</option>)}</select><small>FlipTracker chooses the matching eBay card category.</small></label>
              {editing.assetType === 'Sports Card'
                ? <label>Sport<select value={editing.cardSport || ''} onChange={(event) => patchEditing({ cardSport: event.target.value })}><option value="">Select sport</option>{CARD_SPORTS.map(value => <option key={value}>{value}</option>)}</select></label>
                : <label>Card Game<select value={editing.cardGame || defaultCardGame(editing.assetType) || ''} onChange={(event) => patchEditing({ cardGame: event.target.value })}>{CARD_GAMES.map(value => <option key={value}>{value}</option>)}</select></label>}
              <label>Set<input value={editing.cardSet || ''} onChange={(event) => patchEditing({ cardSet: event.target.value })}/></label>
              <label>Card Number<input value={editing.cardNumber || ''} onChange={(event) => patchEditing({ cardNumber: event.target.value })}/></label>
              {editing.assetType === 'Sports Card' ? <label>Player / Athlete<input value={editing.cardPlayer || ''} onChange={(event) => patchEditing({ cardPlayer: event.target.value })}/></label> : null}
              {editing.assetType === 'Sports Card' ? <label>Team<input value={editing.cardTeam || ''} onChange={(event) => patchEditing({ cardTeam: event.target.value })}/></label> : null}
            </div></div> : null}
            {isClothingListing(editing) ? <div className="formSection span2"><h3>Clothing Details</h3><div className="sectionGrid">
              {['Brand', 'Department', 'Size', 'Color', 'Material'].map((name) => <label key={name}>{name}<input value={itemSpecificValue(editing.itemSpecifics, name) || ''} onChange={(event) => patchEditing({ itemSpecifics: setItemSpecificValue(editing.itemSpecifics, name, event.target.value) })}/></label>)}
              <label>Style / Model<input value={itemSpecificValue(editing.itemSpecifics, 'Style') || ''} onChange={(event) => patchEditing({ itemSpecifics: setItemSpecificValue(editing.itemSpecifics, 'Style', event.target.value) })}/></label>
            </div></div> : null}
            <label className="span2">Additional Item Specifics<textarea value={editing.itemSpecifics || ''} onChange={(event) => patchEditing({ itemSpecifics: event.target.value })}/><small>One per line in Name: Value format. Use this for details that are not already captured above.</small></label>
            </> : null}
            {editorStep === 'shipping' ? <>
            <div className="formSection span2 ebayDeliverySection"><h3><Package size={17}/> Shipping & Photos</h3><div className="sectionGrid">
              <label>eBay Shipping Policy<select value={editing.fulfillmentPolicyId || ''} onChange={(event) => patchEditing({ fulfillmentPolicyId: event.target.value || undefined })}>
                <option value="">Use seller default</option>
                {editing.fulfillmentPolicyId && !ebaySetup?.policies.fulfillment.some((policy) => policy.id === editing.fulfillmentPolicyId) ? <option value={editing.fulfillmentPolicyId}>Saved policy ({editing.fulfillmentPolicyId})</option> : null}
                {ebaySetup?.policies.fulfillment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
              </select><small>The fulfillment policy controls services, handling time, and buyer shipping charges.</small></label>
              {isBookListing(editing) || /dvd|blu|cd|music/i.test(`${editing.assetType || ''} ${editing.mediaFormat || ''}`) ? <div className="shippingPolicyHelper"><button type="button" className="secondary" disabled={ebayBusy} onClick={() => createMediaMailPolicy(true)}><Truck size={16}/> Use Media Mail</button><small>Creates or selects a USPS Media Mail policy. Save this listing afterward. Video games are not Media Mail eligible.</small></div> : null}
              <label>Package Profile<select value={editing.shippingPreset || resolveShippingProfile({ itemType: editing.assetType, mediaFormat: editing.mediaFormat, title: editing.title }).key} onChange={(event) => selectShippingPreset(event.target.value)}>{EBAY_SHIPPING_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select><small>{shippingProfileForKey((editing.shippingPreset || 'custom') as EbayShippingProfileKey).description}</small></label>
              <div className="packageSummary"><Package size={18}/><div><strong>{editing.packageWeightOz ?? '—'} oz</strong><span>{[editing.packageLengthIn, editing.packageWidthIn, editing.packageHeightIn].every(Boolean) ? `${editing.packageLengthIn} × ${editing.packageWidthIn} × ${editing.packageHeightIn} in` : 'Dimensions not set'}</span></div></div>
              <details className="advancedListingOptions span2"><summary>Adjust package weight or dimensions</summary><div className="advancedPackageGrid">
                <label>Weight (oz)<input type="number" min="0.1" step="0.1" value={editing.packageWeightOz ?? ''} onChange={(event) => patchEditing({ packageWeightOz: optionalNumber(event.target.value), shippingPreset: 'custom' })}/></label>
                <label>Length (in)<input type="number" min="0.1" step="0.1" value={editing.packageLengthIn ?? ''} onChange={(event) => patchEditing({ packageLengthIn: optionalNumber(event.target.value), shippingPreset: 'custom' })}/></label>
                <label>Width (in)<input type="number" min="0.1" step="0.1" value={editing.packageWidthIn ?? ''} onChange={(event) => patchEditing({ packageWidthIn: optionalNumber(event.target.value), shippingPreset: 'custom' })}/></label>
                <label>Height (in)<input type="number" min="0.1" step="0.1" value={editing.packageHeightIn ?? ''} onChange={(event) => patchEditing({ packageHeightIn: optionalNumber(event.target.value), shippingPreset: 'custom' })}/></label>
              </div></details>
              <label>eBay Image Source<select value={editing.imageMode || 'Actual Item Photo'} onChange={(event) => patchEditing({ imageMode: event.target.value })}><option>Actual Item Photo</option><option disabled={!canUseCatalogImage(editing)}>eBay Catalog</option></select><small>{isBookListing(editing) && editing.photoUrl ? 'The metadata cover can be used as the stock image for this book.' : isNewCondition(editing.condition) ? 'Catalog matching uses the UPC/EAN/ISBN.' : 'Used discs remain flagged for an actual photo.'}</small></label>
              <div className={`photoReadiness ${editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? 'ready' : 'missing' : editing.hasActualPhoto ? 'ready' : 'missing'}`}><Camera size={18}/><div><strong>{editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? isBookListing(editing) ? 'Stock book cover ready' : 'Catalog identifier ready' : 'Catalog image unavailable' : editing.hasActualPhoto ? 'Actual photo ready' : 'Actual photo required'}</strong><small>{editing.ebayImageSource ? `Last eBay image: ${editing.ebayImageSource}` : 'Photo selection comes from the linked inventory item.'}</small></div></div>
              <ListingPhotoManager assetId={editing.assetId} title={editing.title} onPhotoAttached={markEditingPhotoReady}/>
            </div></div>
            </> : null}
            {editorStep === 'price' ? <>
            <div className="formSection span2"><h3>Pricing & Dates</h3><div className="sectionGrid">
              <label>Original Price<input type="number" step="0.01" value={editing.listedPrice ?? ''} onChange={(event) => patchEditing({ listedPrice: optionalNumber(event.target.value) })}/></label>
              <label>Current Price<input type="number" step="0.01" value={editing.currentPrice ?? ''} onChange={(event) => patchEditing({ currentPrice: optionalNumber(event.target.value) })}/></label>
              <label>Price Change Reason<input value={priceChangeReason} onChange={(event) => setPriceChangeReason(event.target.value)} placeholder="Sale, markdown, relist..."/></label>
              <label>Listed Date<input type="date" value={editing.listedDate || ''} onChange={(event) => patchEditing({ listedDate: event.target.value })}/></label>
              <label>Sold Price<input type="number" step="0.01" value={editing.soldPrice ?? ''} onChange={(event) => patchEditing({ soldPrice: optionalNumber(event.target.value) })}/></label>
              <label>What You Paid<input type="number" min="0" step="0.01" value={editing.purchasePrice ?? ''} onChange={(event) => patchEditing({ purchasePrice: optionalNumber(event.target.value) })}/></label>
              <label>Sold Date<input type="date" value={editing.soldDate || ''} onChange={(event) => patchEditing({ soldDate: event.target.value })}/></label>
              <label>Shipping Charged<input type="number" step="0.01" value={editing.shippingCharged ?? ''} onChange={(event) => patchEditing({ shippingCharged: optionalNumber(event.target.value) })}/></label>
              <label>Actual Shipping Cost<input type="number" step="0.01" value={editing.shippingCost ?? ''} onChange={(event) => patchEditing({ shippingCost: optionalNumber(event.target.value) })}/></label>
              <label>Marketplace Fees<input type="number" step="0.01" value={editing.fees ?? ''} onChange={(event) => patchEditing({ fees: optionalNumber(event.target.value) })}/></label>
              <label>Buyer<input value={editing.buyer || ''} onChange={(event) => patchEditing({ buyer: event.target.value })}/></label>
            </div></div>
            <div className="aiCopyToolbar span2"><div><strong>eBay Description</strong><small>Builds editable buyer-facing copy from the listing and relevant notes.</small></div><button type="button" className="secondary" disabled={descriptionBusy || !editing.title.trim()} onClick={generateAiDescription}><Sparkles size={16}/>{descriptionBusy ? 'Generating...' : 'Generate with AI'}</button></div>
            {descriptionError ? <p className="formError span2">{descriptionError}</p> : null}
            <label className="span2">Editable Description<textarea value={editing.description || ''} onChange={(event) => patchEditing({ description: event.target.value })}/></label>
            <label className="span2">Internal Listing Notes<textarea value={editing.notes || ''} onChange={(event) => patchEditing({ notes: event.target.value })}/></label>
            <div className="formSection span2"><h3>Price History</h3><PriceHistory listingId={editing._id}/></div>
            </> : null}
          </div>
          <div className="listingFactoryFooter"><button className="secondary" onClick={() => setEditing(null)}>Cancel</button><div className="actions">{editorStep !== 'details' ? <button className="secondary" onClick={() => setEditorStep(LISTING_EDITOR_STEPS[Math.max(0, LISTING_EDITOR_STEPS.findIndex((step) => step.id === editorStep) - 1)].id)}>Back</button> : null}{editorStep !== 'price' ? <button onClick={() => setEditorStep(LISTING_EDITOR_STEPS[Math.min(LISTING_EDITOR_STEPS.length - 1, LISTING_EDITOR_STEPS.findIndex((step) => step.id === editorStep) + 1)].id)}>Continue</button> : <button onClick={save}><Save size={16}/> Save Listing</button>}</div></div>
        </section></div>
      ) : null}
    </>
  );
}
