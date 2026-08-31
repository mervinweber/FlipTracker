import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, BadgeDollarSign, Calculator, Camera, CheckCircle2, ChevronDown, CircleStop, Clock3, CloudUpload, DollarSign, Download, ExternalLink, Gauge, KeyRound, Link, ListChecks, ListTodo, LogOut, MapPin, MoreHorizontal, Package, PackageCheck, Pause, Pencil, Percent, Play, Plus, RefreshCw, Rocket, Save, ScanBarcode, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Tags, Trash2, Truck, Upload, WandSparkles, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ListingPhotoManager from './ListingPhotoManager';
import EbayCategoryFinder from './EbayCategoryFinder';
import ListingReadinessPanel from './ListingReadinessPanel';
import EbayCategoryAspects from './EbayCategoryAspects';
import EbayPayloadPreview from './EbayPayloadPreview';
import ListingTemplatesModal from './ListingTemplatesModal';
import { validateListingReadiness, type ListingReadinessStep } from '../utils/listingReadiness';
import { applyListingSpeedPreset, listingFamily, listingSpeedPresetFor, loadListingSpeedPresets, saveListingSpeedPreset } from '../utils/listingSpeedPresets';
import { ebaySpecificsStepForError, readableActionError } from '../utils/actionErrors';
import { assessMarkdownListing, isFlipTrackerManagedActiveListing, listingAgeDays } from '../utils/listingBulkMarkdown';
import { buildTodayOperations } from '../utils/todayOperations';
import { listingOperationsIssue, shouldArchiveSaleByDefault } from '../utils/listingOperations';
import { applySafeSpecificDefaults, assessListingQuality, photoChecklistFor } from '../utils/listingQuality';
import { fulfillmentEconomics, recommendFulfillment } from '../utils/fulfillment';
import { clearSellerSession, createSellerSession, formatSellerSessionDuration, loadSellerSession, pauseSellerSession, recordSellerSessionEvent, resumeSellerSession, saveSellerSession, sellerSessionElapsedMs, type SellerSession, type SellerSessionEvent } from '../utils/sellerSession';
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
  ebayListingOrigin?: string;
  ebayInventorySku?: string;
  ebayDraftStatus?: string;
  ebayDraftCreatedAt?: number;
  ebayLastError?: string;
  pricingStatus?: string;
  pricingSource?: string;
  pricingUpdatedAt?: number;
  ebayOrderId?: string;
  ebayOrderLineItemId?: string;
  ebayLastSyncedAt?: number;
  fulfillmentStatus?: string;
  packedAt?: number;
  shippedAt?: number;
  shippingCarrier?: string;
  shippingService?: string;
  trackingNumber?: string;
  trackingSubmittedAt?: number;
  ebayFulfillmentId?: string;
  insuranceRequired?: boolean;
  fulfillmentNotes?: string;
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
  actualPhotoCount?: number;
  hasCatalogIdentifier?: boolean;
  completeness?: string;
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

const MARKDOWN_STRATEGIES = [
  { key: 'gentle-30', label: '30 days · 5% off', minimumAgeDays: 30, percentage: 5 },
  { key: 'standard-60', label: '60 days · 10% off', minimumAgeDays: 60, percentage: 10 },
  { key: 'clearance-90', label: '90 days · 15% off', minimumAgeDays: 90, percentage: 15 },
  { key: 'custom', label: 'Custom review', minimumAgeDays: 30, percentage: 10 },
] as const;

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
type ListingWorkspaceView = 'Queue' | 'Active' | 'Shipping' | 'Sold' | 'Attention';
type ListingEditorStep = 'details' | 'shipping' | 'price';

const LISTING_EDITOR_STEPS: Array<{ id: ListingEditorStep; label: string }> = [
  { id: 'details', label: 'Item & category' },
  { id: 'shipping', label: 'Shipping & photos' },
  { id: 'price', label: 'Review & publish' },
];

function compactEditorStep(step: ListingReadinessStep | 'preview'): ListingEditorStep {
  if (step === 'category') return 'details';
  if (step === 'preview') return 'price';
  return step;
}

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

function htmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
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

function markdownStatusLabel(status: 'eligible' | 'too-new' | 'missing-date' | 'profit-protected' | 'invalid-price') {
  if (status === 'eligible') return 'Eligible';
  if (status === 'too-new') return 'Too new';
  if (status === 'missing-date') return 'Missing date';
  if (status === 'profit-protected') return 'Profit protected';
  return 'No lower price';
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

function ebayListingOrigin(listing: Listing) {
  if (listing.platform !== 'eBay') return '';
  if (listing.ebayOfferId) return 'FlipTracker API';
  if (listing.externalListingId) return 'eBay app / Seller Hub';
  return 'FlipTracker draft';
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
  const updateListing = useMutation(api.listings.update);
  const removeListing = useMutation(api.listings.remove);
  const importSalesTracker = useMutation(api.listings.importSalesTracker);
  const applyQueuePricing = useMutation(api.listings.applyQueuePricing);
  const beginEbayOauth = useAction(api.ebay.beginOauth);
  const loadEbaySetup = useAction(api.ebay.loadSetup);
  const getSellerListingSummary = useAction(api.ebay.getSellerListingSummary);
  const syncActiveListings = useAction(api.ebay.syncActiveListings);
  const syncSoldOrders = useAction(api.ebay.syncSoldOrders);
  const saveEbaySettings = useAction(api.ebay.saveSettings);
  const createInventoryLocation = useAction(api.ebay.createInventoryLocation);
  const ensureMediaMailPolicy = useAction(api.ebay.ensureMediaMailPolicy);
  const provisionSandboxDefaults = useAction(api.ebay.provisionSandboxDefaults);
  const lookupActivePricing = useAction(api.ebay.lookupActivePricing);
  const createEbayOffer = useAction(api.ebay.createUnpublishedOffer);
  const publishEbayOffer = useAction(api.ebay.publishOffer);
  const updateEbayPrice = useAction(api.ebay.updatePublishedPrice);
  const revisePublishedListing = useAction(api.ebay.revisePublishedListing);
  const endEbayListing = useAction(api.ebay.endPublishedListing);
  const submitShippingFulfillment = useAction(api.ebay.submitShippingFulfillment);
  const generateListingCopy = useAction(api.aiDescriptions.generateListingCopy);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [fastReviewing, setFastReviewing] = useState<Listing | null>(null);
  const [sellerSession, setSellerSession] = useState<SellerSession | null>(() => loadSellerSession(localStorage));
  const [sellerSessionSummary, setSellerSessionSummary] = useState<SellerSession | null>(null);
  const [sellerSessionNow, setSellerSessionNow] = useState(Date.now());
  const [sellerSessionBarcode, setSellerSessionBarcode] = useState('');
  const [sellerSessionMessage, setSellerSessionMessage] = useState('');
  const sellerSessionScanRef = useRef<HTMLInputElement>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [fulfillmentEditing, setFulfillmentEditing] = useState<Listing | null>(null);
  const [ebayErrorListing, setEbayErrorListing] = useState<Listing | null>(null);
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);
  const [fulfillmentError, setFulfillmentError] = useState('');
  const [rememberFastDefaults, setRememberFastDefaults] = useState(true);
  const listingActivity = useQuery(api.listings.activity, editing ? { listingId: editing._id } : 'skip');
  const [editorStep, setEditorStep] = useState<ListingEditorStep>('details');
  const [taxonomyMissingAspects, setTaxonomyMissingAspects] = useState<string[]>([]);
  const [exceptionWorkflow, setExceptionWorkflow] = useState(false);
  const [exceptionQueueExpanded, setExceptionQueueExpanded] = useState(false);
  const [operationsExpanded, setOperationsExpanded] = useState(false);
  const [saleEditing, setSaleEditing] = useState<Listing | null>(null);
  const [archiveSale, setArchiveSale] = useState(false);
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
  const [bulkMarkdownOpen, setBulkMarkdownOpen] = useState(false);
  const [bulkMarkdownStrategy, setBulkMarkdownStrategy] = useState('standard-60');
  const [bulkMarkdownAge, setBulkMarkdownAge] = useState('60');
  const [bulkMarkdownPercent, setBulkMarkdownPercent] = useState('10');
  const [bulkMarkdownFeePercent, setBulkMarkdownFeePercent] = useState('15');
  const [bulkMarkdownMinimumProfit, setBulkMarkdownMinimumProfit] = useState('3');
  const [bulkMarkdownCharm, setBulkMarkdownCharm] = useState(true);
  const [bulkMarkdownBusy, setBulkMarkdownBusy] = useState(false);
  const [bulkMarkdownProgress, setBulkMarkdownProgress] = useState('');
  const [bulkMarkdownError, setBulkMarkdownError] = useState('');
  const [bulkValidationOpen, setBulkValidationOpen] = useState(false);
  const [listingSaveBusy, setListingSaveBusy] = useState(false);
  const [listingSaveError, setListingSaveError] = useState('');
  const markEditingPhotoReady = useCallback(() => {
    setEditing((current) => current ? { ...current, hasActualPhoto: true, actualPhotoCount: (current.actualPhotoCount || 0) + 1 } : current);
  }, []);
  const [query, setQuery] = useState('');
  const [workspaceView, setWorkspaceView] = useState<ListingWorkspaceView>('Queue');
  const [status, setStatus] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [queueType, setQueueType] = useState('All');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('All');
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
  const [activeListingsSyncBusy, setActiveListingsSyncBusy] = useState(false);
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
    if (!editing && !fastReviewing && !saleEditing && !endListingPrompt && !repricing && !pricingRows && !bulkMarkdownOpen && !bulkValidationOpen && !templatesOpen && !fulfillmentEditing && !ebayErrorListing && !sellerSessionSummary) return;
    document.body.classList.add('modalOpen');
    return () => document.body.classList.remove('modalOpen');
  }, [bulkMarkdownOpen, bulkValidationOpen, ebayErrorListing, editing, endListingPrompt, fastReviewing, fulfillmentEditing, pricingRows, repricing, saleEditing, sellerSessionSummary, templatesOpen]);

  useEffect(() => {
    if (!sellerSession) {
      clearSellerSession(localStorage);
      return;
    }
    saveSellerSession(sellerSession, localStorage);
    if (!sellerSession.activeSince) return;
    const timer = window.setInterval(() => setSellerSessionNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [sellerSession]);

  useEffect(() => {
    if (!sellerSession?.activeSince || editing || fastReviewing || saleEditing) return;
    const frame = window.requestAnimationFrame(() => sellerSessionScanRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [editing, fastReviewing, saleEditing, sellerSession?.activeSince]);

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

  const filteredByControls = useMemo(() => {
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

  const queueListings = useMemo(() => filteredByControls.filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status)), [filteredByControls]);
  const selectedListings = useMemo(() => (listings || []).filter((listing) => selectedIds.has(listing._id)), [listings, selectedIds]);
  const flipTrackerManagedActiveListings = useMemo(() => (listings || []).filter(isFlipTrackerManagedActiveListing), [listings]);
  const activeAgeCounts = useMemo(() => ({
    days30: flipTrackerManagedActiveListings.filter((listing) => (listingAgeDays(listing.listedDate) ?? -1) >= 30).length,
    days60: flipTrackerManagedActiveListings.filter((listing) => (listingAgeDays(listing.listedDate) ?? -1) >= 60).length,
    days90: flipTrackerManagedActiveListings.filter((listing) => (listingAgeDays(listing.listedDate) ?? -1) >= 90).length,
  }), [flipTrackerManagedActiveListings]);
  const bulkMarkdownAssessments = useMemo(() => flipTrackerManagedActiveListings.map((listing) => assessMarkdownListing(listing, {
    minimumAgeDays: Number(bulkMarkdownAge),
    percentage: Number(bulkMarkdownPercent),
    feePercent: Number(bulkMarkdownFeePercent),
    minimumProfit: Number(bulkMarkdownMinimumProfit),
    charmPricing: bulkMarkdownCharm,
  })), [bulkMarkdownAge, bulkMarkdownCharm, bulkMarkdownFeePercent, bulkMarkdownMinimumProfit, bulkMarkdownPercent, flipTrackerManagedActiveListings]);
  const bulkMarkdownRows = useMemo(() => bulkMarkdownAssessments.flatMap((row) => (
    row.status === 'eligible' && row.newPrice !== undefined ? [{ ...row, newPrice: row.newPrice }] : []
  )), [bulkMarkdownAssessments]);
  const bulkMarkdownExcluded = useMemo(() => ({
    tooNew: bulkMarkdownAssessments.filter((row) => row.status === 'too-new').length,
    protected: bulkMarkdownAssessments.filter((row) => row.status === 'profit-protected').length,
    missingDate: bulkMarkdownAssessments.filter((row) => row.status === 'missing-date').length,
    invalid: bulkMarkdownAssessments.filter((row) => row.status === 'invalid-price').length,
  }), [bulkMarkdownAssessments]);
  const bulkMarkdownPreviewRows = useMemo(() => {
    const order = ['eligible', 'profit-protected', 'missing-date', 'too-new', 'invalid-price'];
    return [...bulkMarkdownAssessments].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.ageDays ?? -1) - (a.ageDays ?? -1));
  }, [bulkMarkdownAssessments]);

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
  const sellerReadinessDefaults = useMemo(() => ({
    fulfillmentPolicyId: ebaySettings.fulfillmentPolicyId,
    paymentPolicyId: ebaySettings.paymentPolicyId,
    returnPolicyId: ebaySettings.returnPolicyId,
    merchantLocationKey: ebaySettings.merchantLocationKey,
  }), [ebaySettings.fulfillmentPolicyId, ebaySettings.merchantLocationKey, ebaySettings.paymentPolicyId, ebaySettings.returnPolicyId]);
  const listingReadinessInput = useCallback((listing: Listing) => {
    const fulfillmentPolicyId = listing.fulfillmentPolicyId || ebaySettings.fulfillmentPolicyId;
    const fulfillmentPolicyName = ebaySetup?.policies.fulfillment.find((policy) => policy.id === fulfillmentPolicyId)?.name;
    return { ...listing, fulfillmentPolicyName };
  }, [ebaySettings.fulfillmentPolicyId, ebaySetup?.policies.fulfillment]);
  const readinessByListingId = useMemo(() => new Map(
    (listings || []).map((listing) => {
      const prepared = listingWithWorkflowDefaults(listing);
      return [listing._id, validateListingReadiness(listingReadinessInput(prepared), sellerReadinessDefaults)];
    }),
  ), [ebaySetup?.policies.fulfillment, listingReadinessInput, listings, sellerReadinessDefaults]);
  const qualityByListingId = useMemo(() => new Map(
    (listings || []).map((listing) => [listing._id, assessListingQuality(
      listingWithWorkflowDefaults(listing),
      readinessByListingId.get(listing._id) || [],
      listingSpeedPresetFor(listing)?.feePercent ?? 15,
    )]),
  ), [listings, readinessByListingId]);
  const blockingIssuesFor = useCallback((listing: Listing) => (
    readinessByListingId.get(listing._id) || validateListingReadiness(listingReadinessInput(listing), sellerReadinessDefaults)
  ).filter((issue) => issue.blocking), [listingReadinessInput, readinessByListingId, sellerReadinessDefaults]);
  const selectedReadyForEbay = useMemo(() => selectedListings.filter((listing) => (
    queueStatus(listing) === 'Ready for eBay' && !(readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking)
  )), [readinessByListingId, selectedListings]);
  const selectedStagedForEbay = useMemo(() => selectedListings.filter((listing) => (
    listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && Boolean(listing.ebayOfferId)
  )), [selectedListings]);
  const selectedBlockedCount = selectedListings.filter((listing) => (readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking)).length;
  const firstSelectedBlocked = selectedListings.find((listing) => (readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking));
  const editingReadinessIssues = useMemo(() => editing && editing.status !== 'Sold' ? validateListingReadiness({ ...listingReadinessInput(editing), missingCategoryAspects: taxonomyMissingAspects }, sellerReadinessDefaults) : [], [editing, listingReadinessInput, sellerReadinessDefaults, taxonomyMissingAspects]);
  const editingQuality = useMemo(() => editing ? assessListingQuality(editing, editingReadinessIssues, listingSpeedPresetFor(editing)?.feePercent ?? 15) : undefined, [editing, editingReadinessIssues]);
  const fastReviewIssues = useMemo(() => fastReviewing ? validateListingReadiness(listingReadinessInput(fastReviewing), sellerReadinessDefaults) : [], [fastReviewing, listingReadinessInput, sellerReadinessDefaults]);
  const fastReviewNet = useMemo(() => {
    if (!fastReviewing) return 0;
    const price = fastReviewing.currentPrice ?? fastReviewing.listedPrice ?? 0;
    const feeRate = (listingSpeedPresetFor(fastReviewing)?.feePercent ?? 15) / 100;
    return price - (price * feeRate) - (fastReviewing.purchasePrice ?? 0) - (fastReviewing.shippingCost ?? 0);
  }, [fastReviewing]);
  const fulfillmentRecommendation = useMemo(() => fulfillmentEditing ? recommendFulfillment(fulfillmentEditing) : null, [fulfillmentEditing]);
  const fulfillmentProfit = useMemo(() => fulfillmentEditing ? fulfillmentEconomics(fulfillmentEditing) : null, [fulfillmentEditing]);
  const exceptionListings = useMemo(() => (listings || []).filter((listing) => {
    if (listing.platform !== 'eBay' || !['Draft', 'Pending'].includes(listing.status)) return false;
    return (readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking && !['shippingPolicy', 'paymentPolicy', 'returnPolicy', 'inventoryLocation'].includes(issue.field));
  }), [listings, readinessByListingId]);
  const operationsListings = useMemo(() => (listings || [])
    .map((listing) => ({ listing, issue: listingOperationsIssue(listing) }))
    .filter((entry) => Boolean(entry.issue)), [listings]);
  const attentionIds = useMemo(() => new Set([
    ...exceptionListings.map((listing) => listing._id),
    ...operationsListings.map(({ listing }) => listing._id),
  ]), [exceptionListings, operationsListings]);
  const filtered = useMemo(() => filteredByControls.filter((listing) => {
    if (workspaceView === 'Queue') return ['Draft', 'Pending'].includes(listing.status);
    if (workspaceView === 'Active') return listing.status === 'Active';
    if (workspaceView === 'Shipping') return listing.status === 'Sold'
      && ['Awaiting Shipment', 'Packed'].includes(listing.fulfillmentStatus || '')
      && (fulfillmentFilter === 'All' || listing.fulfillmentStatus === fulfillmentFilter);
    if (workspaceView === 'Sold') return listing.status === 'Sold';
    return attentionIds.has(listing._id);
  }), [attentionIds, filteredByControls, fulfillmentFilter, workspaceView]);
  const shippingListings = useMemo(() => (listings || []).filter((listing) => listing.status === 'Sold' && ['Awaiting Shipment', 'Packed'].includes(listing.fulfillmentStatus || '')), [listings]);
  const workspaceCounts = useMemo(() => ({
    Queue: (listings || []).filter((listing) => ['Draft', 'Pending'].includes(listing.status)).length,
    Active: (listings || []).filter((listing) => listing.status === 'Active').length,
    Shipping: shippingListings.length,
    Sold: (listings || []).filter((listing) => listing.status === 'Sold').length,
    Attention: attentionIds.size,
  }), [attentionIds, listings, shippingListings.length]);
  const todayOperations = useMemo(() => buildTodayOperations(listings || [], (listing) => ({
    blockingIssues: (readinessByListingId.get(listing._id) || []).filter((issue) => issue.blocking && !['shippingPolicy', 'paymentPolicy', 'returnPolicy', 'inventoryLocation'].includes(issue.field)).length,
    queueStage: queueStatus(listing),
    operationsIssue: listingOperationsIssue(listing) || undefined,
  })), [listings, readinessByListingId]);
  const todayCounts = useMemo(() => ({
    fulfillment: todayOperations.filter((operation) => operation.kind === 'fulfillment').length,
    exception: todayOperations.filter((operation) => operation.kind === 'exception').length,
    ready: todayOperations.filter((operation) => operation.kind === 'ready').length,
    stale: todayOperations.filter((operation) => operation.kind === 'stale').length,
    reconcile: todayOperations.filter((operation) => operation.kind === 'reconcile').length,
  }), [todayOperations]);
  const batchCompletion = useMemo(() => {
    const draftRows = (listings || []).filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status));
    return {
      total: draftRows.length,
      needsPhotos: draftRows.filter((listing) => queueStatus(listing) === 'Needs Photo').length,
      needsPricing: draftRows.filter((listing) => queueStatus(listing) === 'Ready for Pricing').length,
      exceptions: draftRows.filter((listing) => (readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking && !['shippingPolicy', 'paymentPolicy', 'returnPolicy', 'inventoryLocation'].includes(issue.field))).length,
      ready: draftRows.filter((listing) => queueStatus(listing) === 'Ready for eBay' && !(readinessByListingId.get(listing._id) || []).some((issue) => issue.blocking)).length,
      staged: draftRows.filter((listing) => Boolean(listing.ebayOfferId)).length,
    };
  }, [listings, readinessByListingId]);
  const sellerSessionElapsed = sellerSession ? sellerSessionElapsedMs(sellerSession, sellerSessionNow) : 0;
  const bulkValidationListings = useMemo(() => {
    const selectedQueueListings = selectedListings.filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status));
    return selectedQueueListings.length ? selectedQueueListings : queueListings;
  }, [queueListings, selectedListings]);
  const bulkValidationRows = useMemo(() => bulkValidationListings.map((listing) => ({
    listing,
    quality: qualityByListingId.get(listing._id)!,
    blockers: (readinessByListingId.get(listing._id) || []).filter((issue) => issue.blocking),
  })), [bulkValidationListings, qualityByListingId, readinessByListingId]);
  const bulkValidationClean = bulkValidationRows.filter((row) => row.blockers.length === 0);
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

  function listingWithWorkflowDefaults(listing: Listing) {
    const condition = listing.condition?.trim().toLowerCase() || '';
    const isBookWithCover = `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase().includes('book') && Boolean(listing.photoUrl);
    const imageMode = listing.imageMode || (["new", "brand new", "sealed"].includes(condition) || isBookWithCover ? 'eBay Catalog' : 'Actual Item Photo');
    const categoryResolution = resolveEbayCategory({ itemType: listing.assetType, barcode: listing.assetBarcode, cardSaleFormat: listing.cardProductType });
    const configuredProfile = EBAY_SHIPPING_PROFILES.find((profile) => profile.key === listing.shippingPreset || profile.label === listing.shippingPreset);
    const shippingProfile = configuredProfile || resolveShippingProfile({ itemType: listing.assetType, mediaFormat: listing.mediaFormat, title: listing.title });
    const suggestedPolicy = findSuggestedShippingPolicy(ebaySetup?.policies.fulfillment || [], shippingProfile);
    const withPreset = applyListingSpeedPreset(listing, loadListingSpeedPresets());
    const presetProfile = EBAY_SHIPPING_PROFILES.find((profile) => profile.key === withPreset.shippingPreset || profile.label === withPreset.shippingPreset) || shippingProfile;
    const presetPolicy = withPreset.fulfillmentPolicyId || findSuggestedShippingPolicy(ebaySetup?.policies.fulfillment || [], presetProfile)?.id || suggestedPolicy?.id;
    return applySafeSpecificDefaults({
      ...withPreset,
      language: withPreset.language || itemSpecificValue(withPreset.itemSpecifics, 'Language') || 'English',
      bookTitle: (withPreset.bookTitle || itemSpecificValue(withPreset.itemSpecifics, 'Book Title') || (isBookListing(withPreset) ? withPreset.assetTitle : undefined))?.slice(0, 65),
      author: withPreset.author || itemSpecificValue(withPreset.itemSpecifics, 'Author') || withPreset.assetAuthor,
      imageMode: withPreset.imageMode || imageMode,
      category: withPreset.category || categoryResolution.choice.categoryName,
      ebayCategoryId: withPreset.ebayCategoryId || categoryResolution.categoryId,
      fulfillmentPolicyId: presetPolicy,
      shippingPreset: presetProfile.key,
      packageType: undefined,
      packageWeightOz: withPreset.packageWeightOz ?? presetProfile.weight.value,
      packageLengthIn: withPreset.packageLengthIn ?? presetProfile.dimensions.length,
      packageWidthIn: withPreset.packageWidthIn ?? presetProfile.dimensions.width,
      packageHeightIn: withPreset.packageHeightIn ?? presetProfile.dimensions.height,
    } satisfies Listing);
  }

  function openListingEditor(listing: Listing, initialStep: ListingReadinessStep | 'preview' = 'details', fromExceptionQueue = false) {
    if (listing.status === 'Sold') {
      openSaleEditor(listing);
      return;
    }
    setSaleEditing(null);
    setFastReviewing(null);
    setExceptionWorkflow(fromExceptionQueue);
    setTaxonomyMissingAspects([]);
    setDescriptionError('');
    setListingSaveError('');
    setEditorStep(compactEditorStep(initialStep));
    setEditing(listingWithWorkflowDefaults(listing));
  }

  function openFulfillmentEditor(listing: Listing) {
    const recommendation = recommendFulfillment(listing);
    setEditing(null);
    setSaleEditing(null);
    setFulfillmentError('');
    setFulfillmentEditing({
      ...listing,
      fulfillmentStatus: listing.fulfillmentStatus || 'Awaiting Shipment',
      shippingPreset: listing.shippingPreset || recommendation.profileKey,
      packageWeightOz: listing.packageWeightOz || recommendation.weightOz,
      packageLengthIn: listing.packageLengthIn || recommendation.dimensions.length,
      packageWidthIn: listing.packageWidthIn || recommendation.dimensions.width,
      packageHeightIn: listing.packageHeightIn || recommendation.dimensions.height,
      shippingCarrier: listing.shippingCarrier || recommendation.carrier,
      shippingService: listing.shippingService || recommendation.service,
      insuranceRequired: listing.insuranceRequired ?? recommendation.insuranceRecommended,
    });
  }

  function applyFulfillmentProfile(profileKey: string) {
    const profile = shippingProfileForKey(profileKey as EbayShippingProfileKey);
    setFulfillmentEditing((current) => current ? {
      ...current,
      shippingPreset: profile.key,
      packageWeightOz: profile.weight.value,
      packageLengthIn: profile.dimensions.length,
      packageWidthIn: profile.dimensions.width,
      packageHeightIn: profile.dimensions.height,
    } : current);
  }

  async function saveFulfillment() {
    if (!fulfillmentEditing) return;
    const now = Date.now();
    setFulfillmentBusy(true);
    setFulfillmentError('');
    try {
      await updateListing({
        id: fulfillmentEditing._id,
        fulfillmentStatus: fulfillmentEditing.fulfillmentStatus || 'Awaiting Shipment',
        packedAt: fulfillmentEditing.fulfillmentStatus === 'Packed' ? fulfillmentEditing.packedAt || now : fulfillmentEditing.packedAt,
        shippedAt: fulfillmentEditing.fulfillmentStatus === 'Shipped' ? fulfillmentEditing.shippedAt || now : fulfillmentEditing.shippedAt,
        shippingCarrier: fulfillmentEditing.shippingCarrier?.trim() || undefined,
        shippingService: fulfillmentEditing.shippingService?.trim() || undefined,
        trackingNumber: fulfillmentEditing.trackingNumber?.trim() || undefined,
        shippingCost: fulfillmentEditing.shippingCost,
        shippingPreset: fulfillmentEditing.shippingPreset,
        packageWeightOz: fulfillmentEditing.packageWeightOz,
        packageLengthIn: fulfillmentEditing.packageLengthIn,
        packageWidthIn: fulfillmentEditing.packageWidthIn,
        packageHeightIn: fulfillmentEditing.packageHeightIn,
        insuranceRequired: Boolean(fulfillmentEditing.insuranceRequired),
        fulfillmentNotes: fulfillmentEditing.fulfillmentNotes?.trim() || undefined,
      });
      setEbayNotice(`${fulfillmentEditing.title} marked ${fulfillmentEditing.fulfillmentStatus || 'Awaiting Shipment'}.`);
      setFulfillmentEditing(null);
    } catch (error) {
      setFulfillmentError(readableActionError(error, 'Could not update fulfillment.'));
    } finally {
      setFulfillmentBusy(false);
    }
  }

  async function submitFulfillmentTracking() {
    if (!fulfillmentEditing || !adminKey) return;
    if (!fulfillmentEditing.ebayOrderId) {
      setFulfillmentError('This sale is not linked to an eBay order. Sync eBay Sales before submitting tracking.');
      return;
    }
    if (!fulfillmentEditing.shippingCarrier?.trim() || !fulfillmentEditing.trackingNumber?.trim()) {
      setFulfillmentError('Choose a carrier and enter the tracking number from the purchased label.');
      return;
    }
    setFulfillmentBusy(true);
    setFulfillmentError('');
    try {
      const result = await submitShippingFulfillment({
        adminKey,
        listingId: fulfillmentEditing._id,
        carrier: fulfillmentEditing.shippingCarrier.trim(),
        service: fulfillmentEditing.shippingService?.trim() || undefined,
        trackingNumber: fulfillmentEditing.trackingNumber.trim(),
        shippingCost: fulfillmentEditing.shippingCost,
      });
      setEbayNotice(result.alreadySubmitted ? `${fulfillmentEditing.title} was already shipped on eBay and is now reconciled.` : `${fulfillmentEditing.title} tracking submitted to eBay.`);
      setFulfillmentEditing(null);
    } catch (error) {
      setFulfillmentError(readableActionError(error, 'Could not submit tracking to eBay.'));
    } finally {
      setFulfillmentBusy(false);
    }
  }

  function printShippingPickList() {
    const rows = shippingListings
      .slice()
      .sort((a, b) => (a.storageLocation || 'ZZZ').localeCompare(b.storageLocation || 'ZZZ') || a.title.localeCompare(b.title));
    const popup = window.open('', '_blank');
    if (!popup) {
      setEbayError('Allow pop-ups to print the shipping pick list.');
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>FlipTracker Shipping Pick List</title><style>body{font:14px system-ui;margin:28px;color:#111}h1{font-size:22px}p{color:#555}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px 7px;border-bottom:1px solid #bbb;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase}.check{font-size:20px;width:28px}.location{font-weight:800}.meta{font-size:11px;color:#555}</style></head><body><h1>FlipTracker Shipping Pick List</h1><p>${rows.length} order${rows.length === 1 ? '' : 's'} awaiting shipment · ${htmlEscape(new Date().toLocaleString())}</p><table><thead><tr><th></th><th>Location</th><th>Item</th><th>Order</th><th>Package</th></tr></thead><tbody>${rows.map((listing) => { const recommendation = recommendFulfillment(listing); return `<tr><td class="check">□</td><td class="location">${htmlEscape(listing.storageLocation || 'Unassigned')}</td><td><strong>${htmlEscape(listing.title)}</strong><div class="meta">${htmlEscape(listing.sku || '')}</div></td><td>${htmlEscape(listing.ebayOrderId || '')}<div class="meta">${htmlEscape(listing.buyer || '')}</div></td><td>${htmlEscape(recommendation.profileLabel)}<div class="meta">${htmlEscape(`${recommendation.weightOz} oz · ${recommendation.service}`)}</div></td></tr>`; }).join('')}</tbody></table><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
    popup.document.close();
  }

  function openTodayOperation(operation: typeof todayOperations[number]) {
    const listing = operation.listing;
    if (operation.kind === 'fulfillment') {
      openFulfillmentEditor(listing);
      return;
    }
    if (operation.kind === 'stale') {
      openActiveListingManager('standard-60');
      return;
    }
    if (operation.kind === 'exception') {
      const step = (readinessByListingId.get(listing._id) || []).find((issue) => issue.blocking)?.step || 'details';
      openListingEditor(listing, step, true);
      return;
    }
    if (operation.kind === 'ready') {
      if (listing.ebayOfferId) openListingEditor(listing, 'preview');
      else openFastReview(listing);
      return;
    }
    if (listing.status === 'Sold') openSaleEditor(listing);
    else openListingEditor(listing);
  }

  function openFastReview(listing?: Listing) {
    const target = listing || queueListings[0];
    if (!target) {
      setEbayError('There are no Draft or Pending listings in this view.');
      return;
    }
    setEditing(null);
    setSaleEditing(null);
    setListingSaveError('');
    setFastReviewing(listingWithWorkflowDefaults(target));
  }

  function recordSessionEvent(event: SellerSessionEvent, count = 1) {
    setSellerSession((current) => {
      if (!current) return current;
      let next = current;
      for (let index = 0; index < count; index += 1) next = recordSellerSessionEvent(next, event);
      return next;
    });
  }

  function focusSellerSessionScanner() {
    if (!sellerSession?.activeSince) return;
    window.requestAnimationFrame(() => sellerSessionScanRef.current?.focus());
  }

  function startSellerSession() {
    const next = createSellerSession();
    setSellerSession(next);
    setSellerSessionNow(next.startedAt);
    setSellerSessionMessage('Session started. Scan a queued item or review the next one.');
    if (queueListings.length) openFastReview(queueListings[0]);
  }

  function toggleSellerSessionPause() {
    if (!sellerSession) return;
    const now = Date.now();
    const next = sellerSession.activeSince ? pauseSellerSession(sellerSession, now) : resumeSellerSession(sellerSession, now);
    setSellerSession(next);
    setSellerSessionNow(now);
    setSellerSessionMessage(next.activeSince ? 'Session resumed. Scanner is ready.' : 'Session paused. Your progress is saved.');
  }

  function finishSellerSession() {
    if (!sellerSession) return;
    const finished = pauseSellerSession(sellerSession, Date.now());
    setSellerSessionSummary(finished);
    setSellerSession(null);
    setSellerSessionBarcode('');
    setSellerSessionMessage('');
    setFastReviewing(null);
  }

  function scanSellerSessionBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = sellerSessionBarcode.trim().toLowerCase();
    if (!value || !sellerSession?.activeSince) return;
    const match = (listings || []).find((listing) => (
      listing.platform === 'eBay'
      && ['Draft', 'Pending'].includes(listing.status)
      && [listing.assetBarcode, listing.sku].some((candidate) => candidate?.trim().toLowerCase() === value)
    ));
    setSellerSessionBarcode('');
    if (!match) {
      setSellerSessionMessage(`No queued listing matches ${value}. Use Scan Stack to add a new item.`);
      window.requestAnimationFrame(() => sellerSessionScanRef.current?.focus());
      return;
    }
    setSellerSessionMessage(`Opened ${match.title}.`);
    openFastReview(match);
  }

  function patchFastReview(patch: Partial<Listing>) {
    setFastReviewing((current) => current ? { ...current, ...patch } : current);
  }

  function selectFastShippingPreset(value: string) {
    const profile = shippingProfileForKey(value as EbayShippingProfileKey);
    const suggestedPolicy = findSuggestedShippingPolicy(ebaySetup?.policies.fulfillment || [], profile);
    patchFastReview({
      shippingPreset: profile.key,
      fulfillmentPolicyId: suggestedPolicy?.id || fastReviewing?.fulfillmentPolicyId,
      packageWeightOz: profile.weight.value,
      packageLengthIn: profile.dimensions.length,
      packageWidthIn: profile.dimensions.width,
      packageHeightIn: profile.dimensions.height,
    });
  }

  function openRepriceEditor(listing: Listing) {
    const currentPrice = listing.currentPrice ?? listing.listedPrice ?? 0;
    const template = listingSpeedPresetFor(listing);
    setEditing(null);
    setSaleEditing(null);
    setRepricing(listing);
    setRepriceMode('percentage');
    setRepricePercent('10');
    setRepriceExact(currentPrice.toFixed(2));
    setRepriceFeePercent(String(template?.feePercent ?? 15));
    setRepriceShippingCost((listing.shippingCost ?? 5).toFixed(2));
    setRepriceShippingCharged((listing.shippingCharged ?? 0).toFixed(2));
    setRepriceTargetProfit((template?.minimumProfit ?? 5).toFixed(2));
    setRepriceCharm(true);
    setRepriceError('');
  }

  function selectBulkMarkdownStrategy(strategyKey: string) {
    const strategy = MARKDOWN_STRATEGIES.find((option) => option.key === strategyKey) || MARKDOWN_STRATEGIES[1];
    setBulkMarkdownStrategy(strategy.key);
    if (strategy.key !== 'custom') {
      setBulkMarkdownAge(String(strategy.minimumAgeDays));
      setBulkMarkdownPercent(String(strategy.percentage));
    }
  }

  function openActiveListingManager(strategyKey = bulkMarkdownStrategy) {
    selectBulkMarkdownStrategy(strategyKey);
    setBulkMarkdownError('');
    setBulkMarkdownProgress('');
    setBulkMarkdownOpen(true);
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

  async function submitBulkMarkdown() {
    const percentage = Number(bulkMarkdownPercent);
    const age = Number(bulkMarkdownAge);
    const feePercent = Number(bulkMarkdownFeePercent);
    const minimumProfit = Number(bulkMarkdownMinimumProfit);
    if (!adminKey) {
      setBulkMarkdownError('Load the connected eBay seller account before updating live prices.');
      return;
    }
    if (!Number.isFinite(age) || age < 0 || !Number.isFinite(percentage) || percentage <= 0 || percentage > 90
      || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 50
      || !Number.isFinite(minimumProfit) || minimumProfit < 0) {
      setBulkMarkdownError('Enter a valid age, a markdown from 0.1% to 90%, fees from 0% to 50%, and a non-negative profit floor.');
      return;
    }
    if (!bulkMarkdownRows.length) {
      setBulkMarkdownError('No eligible stale listings would receive a lower price without crossing the protected profit floor.');
      return;
    }
    const totalBefore = bulkMarkdownRows.reduce((sum, row) => sum + row.currentPrice, 0);
    const totalAfter = bulkMarkdownRows.reduce((sum, row) => sum + row.newPrice, 0);
    if (!confirm([
      `Update ${bulkMarkdownRows.length} FlipTracker-created live eBay listing${bulkMarkdownRows.length === 1 ? '' : 's'}?`,
      `${age}+ days · ${percentage.toFixed(1)}% markdown · ${money(totalBefore)} total → ${money(totalAfter)} total`,
      `Minimum estimated profit: ${money(minimumProfit)} after ${feePercent.toFixed(1)}% estimated fees.`,
      'These public eBay prices change immediately. Listings created in the eBay app or Seller Hub are excluded.',
    ].join('\n\n'))) return;

    setBulkMarkdownBusy(true);
    setBulkMarkdownError('');
    setBulkMarkdownProgress(`Updating 0 of ${bulkMarkdownRows.length}...`);
    setEbayError('');
    setEbayNotice('');
    const failures: string[] = [];
    let completed = 0;
    const batchSize = 4;
    for (let index = 0; index < bulkMarkdownRows.length; index += batchSize) {
      const batch = bulkMarkdownRows.slice(index, index + batchSize);
      const results = await Promise.allSettled(batch.map((row) => updateEbayPrice({
        adminKey,
        listingId: row.listing._id,
        newPrice: row.newPrice,
        reason: `${percentage.toFixed(1)}% stale-listing markdown after ${age} days`,
      })));
      results.forEach((result, resultIndex) => {
        if (result.status === 'rejected') failures.push(`${batch[resultIndex].listing.title}: ${readableActionError(result.reason, 'eBay rejected the price update.')}`);
      });
      completed += batch.length;
      setBulkMarkdownProgress(`Updated ${completed - failures.length} of ${bulkMarkdownRows.length}; ${failures.length} failed.`);
    }

    const succeeded = bulkMarkdownRows.length - failures.length;
    if (succeeded) setEbayNotice(`Updated ${succeeded} stale FlipTracker-created live eBay price${succeeded === 1 ? '' : 's'} by ${percentage.toFixed(1)}%.`);
    if (failures.length) {
      const message = `${failures.length} price update${failures.length === 1 ? '' : 's'} failed. ${failures.slice(0, 3).join(' ')}`;
      setBulkMarkdownError(message);
      setEbayError(message);
    } else {
      setBulkMarkdownOpen(false);
    }
    setBulkMarkdownBusy(false);
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
    setArchiveSale(shouldArchiveSaleByDefault(listing));
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
      fulfillmentStatus: archiveSale ? 'Completed' : saleEditing.fulfillmentStatus === 'Completed' ? 'Shipped' : saleEditing.fulfillmentStatus,
    });
    setEbayNotice(`${saleEditing.title} sale updated${archiveSale ? ' and archived' : ''}.`);
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

  async function refreshActiveEbayListings() {
    if (!adminKey) return;
    setActiveListingsSyncBusy(true);
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await syncActiveListings({ adminKey });
      setEbayNotice(`Active eBay listings synced: ${result.checked} live on eBay, ${result.imported} imported, ${result.updated} refreshed, and ${result.reconciled} moved to reconciliation.`);
      void refreshSellerListingCount();
    } catch (error) {
      setEbayError(error instanceof Error ? error.message : 'Could not sync active eBay listings.');
    } finally {
      setActiveListingsSyncBusy(false);
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
    const blockers = blockingIssuesFor(listing);
    if (blockers.length) {
      setEbayError(`${blockers.length} listing issue${blockers.length === 1 ? '' : 's'} must be fixed before staging. ${blockers.slice(0, 3).map((issue) => issue.message).join(' ')}`);
      openListingEditor(listing, blockers[0].step, true);
      return;
    }
    setOfferBusy(listing._id);
    setEbayError('');
    setEbayNotice('');
    try {
      const result = await createEbayOffer({ adminKey, listingId: listing._id });
      setEbayNotice(`${result.updated ? 'Updated' : 'Created'} staged eBay offer ${result.offerId} for SKU ${result.sku}. It is not live or visible in Seller Hub Drafts.`);
      recordSessionEvent('staged');
      focusSellerSessionScanner();
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
      recordSessionEvent('published');
      focusSellerSessionScanner();
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

  async function saveFastReview(stageAfterSave = false) {
    if (!fastReviewing?.title.trim()) {
      setListingSaveError('Enter a buyer-facing title.');
      return;
    }
    const price = fastReviewing.currentPrice ?? fastReviewing.listedPrice;
    if (!price || price <= 0) {
      setListingSaveError('Enter a listing price greater than $0.');
      return;
    }
    const blockers = validateListingReadiness(listingReadinessInput(fastReviewing), sellerReadinessDefaults).filter((issue) => issue.blocking);
    if (stageAfterSave && blockers.length) {
      setListingSaveError(`This listing still needs attention: ${blockers.slice(0, 3).map((issue) => issue.message).join(' ')}`);
      return;
    }
    if (stageAfterSave && (!adminKey || !sellerDefaultsReady)) {
      setListingSaveError('Load the seller account and complete its defaults before staging.');
      return;
    }
    setListingSaveBusy(true);
    setListingSaveError('');
    try {
      await updateListing({
        id: fastReviewing._id,
        title: fastReviewing.title.trim(),
        description: fastReviewing.description || undefined,
        condition: fastReviewing.condition || undefined,
        completeness: fastReviewing.completeness || undefined,
        language: fastReviewing.language || undefined,
        bookTitle: fastReviewing.bookTitle || undefined,
        author: fastReviewing.author || undefined,
        ebayCategoryId: fastReviewing.ebayCategoryId || undefined,
        category: fastReviewing.category || undefined,
        listedPrice: fastReviewing.listedPrice ?? price,
        currentPrice: price,
        fulfillmentPolicyId: fastReviewing.fulfillmentPolicyId || undefined,
        shippingPreset: fastReviewing.shippingPreset || undefined,
        packageWeightOz: fastReviewing.packageWeightOz,
        packageLengthIn: fastReviewing.packageLengthIn,
        packageWidthIn: fastReviewing.packageWidthIn,
        packageHeightIn: fastReviewing.packageHeightIn,
        imageMode: fastReviewing.imageMode || undefined,
      });
      if (rememberFastDefaults) {
        saveListingSpeedPreset(listingFamily(fastReviewing), {
          condition: fastReviewing.condition,
          completeness: fastReviewing.completeness,
          shippingPreset: fastReviewing.shippingPreset,
          fulfillmentPolicyId: fastReviewing.fulfillmentPolicyId,
          imageMode: fastReviewing.imageMode,
        });
      }
      if (stageAfterSave) {
        await createEbayOffer({ adminKey, listingId: fastReviewing._id });
        setEbayNotice(`Saved and staged ${fastReviewing.title}. It is not live yet.`);
      }
      recordSessionEvent('reviewed');
      if (stageAfterSave) recordSessionEvent('staged');
      const currentIndex = queueListings.findIndex((listing) => listing._id === fastReviewing._id);
      const next = queueListings[currentIndex + 1] || queueListings.find((listing) => listing._id !== fastReviewing._id);
      if (next) setFastReviewing(listingWithWorkflowDefaults(next));
      else {
        setFastReviewing(null);
        setSellerSessionMessage('Every queued item in this view has been reviewed. Scan another item or finish the session.');
        focusSellerSessionScanner();
      }
    } catch (error) {
      setListingSaveError(readableActionError(error, 'Could not save this fast review.'));
    } finally {
      setListingSaveBusy(false);
    }
  }

  async function sendSelectedToEbay() {
    if (!adminKey) {
      setEbayError('Enter the Seller Access Key before sending drafts to eBay.');
      return;
    }
    if (!selectedReadyForEbay.length) {
      setEbayError(selectedBlockedCount
        ? `${selectedBlockedCount} selected listing${selectedBlockedCount === 1 ? '' : 's'} need attention before staging. Open a listing to review every blocking issue.`
        : 'Selected listings need an approved price and an eligible catalog match or actual item photo before they can be sent to eBay.');
      return;
    }
    if (!sellerDefaultsReady) {
      setEbayError('Choose and save an inventory location, shipping policy, payment policy, and return policy before creating eBay drafts.');
      return;
    }
    if (!confirm(`Create or refresh ${selectedReadyForEbay.length} unpublished eBay offer${selectedReadyForEbay.length === 1 ? '' : 's'}?${selectedBlockedCount ? ` ${selectedBlockedCount} blocked selection${selectedBlockedCount === 1 ? '' : 's'} will be skipped.` : ''} Nothing will be published.`)) return;
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
      recordSessionEvent('staged', succeeded.length);
      focusSellerSessionScanner();
    }
    if (failures.length) setEbayError(`${failures.length} item${failures.length === 1 ? '' : 's'} failed. ${failures.slice(0, 3).join(' ')}`);
    setQueueBusy(false);
  }

  async function publishSelectedStaged() {
    if (!adminKey || !sellerDefaultsReady) {
      setEbayError('Load the connected seller account before publishing.');
      return;
    }
    if (!selectedStagedForEbay.length) {
      setEbayError('Select at least one staged eBay listing to publish.');
      return;
    }
    if (!confirm(`Publish ${selectedStagedForEbay.length} staged listing${selectedStagedForEbay.length === 1 ? '' : 's'} live on eBay? Buyers will be able to purchase every successful listing.`)) return;
    setQueueBusy(true);
    setEbayError('');
    setEbayNotice('');
    const succeeded: Id<'marketplaceListings'>[] = [];
    const failures: string[] = [];
    for (const listing of selectedStagedForEbay) {
      try {
        await createEbayOffer({ adminKey, listingId: listing._id });
        await publishEbayOffer({ adminKey, listingId: listing._id });
        succeeded.push(listing._id);
      } catch (error) {
        failures.push(`${listing.title}: ${readableActionError(error, 'Publish failed')}`);
      }
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });
    if (succeeded.length) setEbayNotice(`${succeeded.length} listing${succeeded.length === 1 ? '' : 's'} published live on eBay.`);
    if (succeeded.length) {
      recordSessionEvent('published', succeeded.length);
      focusSellerSessionScanner();
    }
    if (failures.length) setEbayError(`${failures.length} listing${failures.length === 1 ? '' : 's'} failed and remain selected. ${failures.slice(0, 3).join(' ')}`);
    setQueueBusy(false);
  }

  async function save() {
    if (!editing?.title.trim()) return;
    const updatesLiveEbay = editing.platform === 'eBay' && editing.status === 'Active' && Boolean(editing.externalListingId);
    if (updatesLiveEbay && !adminKey) {
      setListingSaveError('Load your private access key in Seller Connection before revising this live eBay listing.');
      return;
    }
    setListingSaveBusy(true);
    setListingSaveError('');
    const soldDate = editing.status === 'Sold' ? editing.soldDate || dateToday() : editing.soldDate;
    const soldPrice = editing.status === 'Sold' ? editing.soldPrice ?? editing.currentPrice ?? editing.listedPrice : editing.soldPrice;
    try {
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
      if (updatesLiveEbay) {
        const result = await revisePublishedListing({ adminKey, listingId: editing._id });
        setEbayNotice(`Updated live eBay listing ${result.listingId} through the ${result.revisionSource}.`);
      }
      const savedListingId = editing._id;
      if (['Draft', 'Pending'].includes(editing.status)) recordSessionEvent('reviewed');
      const nextException = exceptionWorkflow ? exceptionListings.find((listing) => listing._id !== savedListingId) : undefined;
      if (nextException) {
        const nextStep = (readinessByListingId.get(nextException._id) || []).find((issue) => issue.blocking)?.step || 'details';
        openListingEditor(nextException, nextStep, true);
      } else if (sellerSession?.activeSince) {
        const currentIndex = queueListings.findIndex((listing) => listing._id === savedListingId);
        const next = queueListings[currentIndex + 1] || queueListings.find((listing) => listing._id !== savedListingId);
        setEditing(null);
        setExceptionWorkflow(false);
        if (next) openFastReview(next);
        else focusSellerSessionScanner();
      } else {
        setEditing(null);
        setExceptionWorkflow(false);
      }
      setPriceChangeReason('');
    } catch (error) {
      const message = readableActionError(error, editing.ebayLastError || 'Could not update this listing. Check its required eBay details and try again.');
      setListingSaveError(message);
      const requiredStep = ebaySpecificsStepForError(message);
      if (requiredStep) setEditorStep(compactEditorStep(requiredStep));
    } finally {
      setListingSaveBusy(false);
    }
  }

  useEffect(() => {
    if (!editing) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
        return;
      }
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const index = LISTING_EDITOR_STEPS.findIndex((step) => step.id === editorStep);
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        setEditorStep(LISTING_EDITOR_STEPS[Math.max(0, Math.min(LISTING_EDITOR_STEPS.length - 1, index + offset))].id);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [editing, editorStep, exceptionListings, exceptionWorkflow, readinessByListingId]);

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
      <section className="panel listingWorkspaceHeader">
        <div className="listingWorkspaceTitle"><div><p className="eyebrow">Selling workspace</p><h2>Listings</h2><p>Work one stage at a time. Setup and maintenance stay available without crowding the queue.</p></div><div className="listingWorkspaceActions">
          {ebaySetup?.connected ? <span className="statusPill ebayConnected"><ShieldCheck size={14}/> eBay connected</span> : <span className="statusPill attention"><AlertTriangle size={14}/> eBay setup needed</span>}
          <details className="listingUtilityMenu listingWorkspaceMenu"><summary aria-label="Open listing workspace settings" title="Workspace settings"><MoreHorizontal size={18}/></summary><div><button className="secondary" onClick={() => setTemplatesOpen(true)}><Tags size={16}/> Listing templates</button><button className="secondary" aria-expanded={sellerSetupExpanded} onClick={() => setSellerSetupExpanded((expanded) => !expanded)}><Settings size={16}/> eBay settings</button></div></details>
        </div></div>
      </section>

      <nav className="listingWorkspaceTabs" aria-label="Listing lifecycle views">
        {(['Queue', 'Active', 'Shipping', 'Sold', 'Attention'] as ListingWorkspaceView[]).map((view) => <button key={view} className={workspaceView === view ? 'active' : 'secondary'} onClick={() => { setWorkspaceView(view); setStatus('All'); setQueueType('All'); setFulfillmentFilter('All'); setSelectedIds(new Set()); }}><span>{view === 'Attention' ? 'Needs Attention' : view === 'Active' ? 'Tracked active' : view}</span><b>{workspaceCounts[view]}</b></button>)}
      </nav>

      {workspaceView === 'Shipping' ? <section className="panel shippingWorkspacePanel">
        <div className="shippingWorkspaceHeader"><div><p className="eyebrow">Fulfillment queue</p><h2>Pick, pack, buy label, submit tracking</h2><p>Work by bin location, retain the listing package, and send purchased-label tracking back to eBay.</p></div><div className="actions"><button className="secondary" disabled={sellerSalesSyncBusy || !ebaySetup?.connected} onClick={refreshEbaySales}><RefreshCw size={16}/>{sellerSalesSyncBusy ? 'Syncing...' : 'Sync Orders'}</button><button className="secondary" disabled={!shippingListings.length} onClick={printShippingPickList}><Download size={16}/> Print Pick List</button></div></div>
        <div className="shippingWorkspaceMetrics"><div><span>To pick</span><strong>{shippingListings.filter((listing) => listing.fulfillmentStatus === 'Awaiting Shipment').length}</strong></div><div><span>Packed</span><strong>{shippingListings.filter((listing) => listing.fulfillmentStatus === 'Packed').length}</strong></div><div><span>Insurance review</span><strong>{shippingListings.filter((listing) => listing.insuranceRequired || (listing.soldPrice || 0) >= 100).length}</strong></div><div><span>Buyer shipping</span><strong>{money(shippingListings.reduce((sum, listing) => sum + (listing.shippingCharged || 0), 0))}</strong></div></div>
        <p className="shippingApiNote"><ShieldCheck size={15}/> eBay’s public Fulfillment API accepts carrier and tracking. Outbound label purchase remains in eBay Labels, then FlipTracker submits and records the shipment.</p>
      </section> : null}

      {workspaceView === 'Attention' && todayOperations.length ? <section className={`panel todayOperationsPanel ${todayOperations.length ? 'hasWork' : ''}`}>
        <div className="todayOperationsHeader">
          <div><p className="eyebrow">Today</p><h2>{todayOperations.length ? `${todayOperations.length} action${todayOperations.length === 1 ? '' : 's'} move the business forward` : 'Today queue is clear'}</h2><p>Finish sold orders first, then clear listing blockers, publish ready work, and review aging inventory.</p></div>
          <button className="secondary" onClick={() => setWorkspaceView('Queue')}><ListTodo size={16}/> Open Queue</button>
        </div>
        <div className="todayOperationMetrics" aria-label="Today's seller work">
          <div className={todayCounts.fulfillment ? 'attention' : ''}><span>Ship</span><strong>{todayCounts.fulfillment}</strong></div>
          <div className={todayCounts.exception ? 'attention' : ''}><span>Fix</span><strong>{todayCounts.exception}</strong></div>
          <div><span>Reconcile</span><strong>{todayCounts.reconcile}</strong></div>
          <div className={todayCounts.ready ? 'ready' : ''}><span>Stage / Publish</span><strong>{todayCounts.ready}</strong></div>
          <div><span>Stale</span><strong>{todayCounts.stale}</strong></div>
        </div>
        {todayOperations.length ? <div className="todayOperationList">{todayOperations.slice(0, 6).map((operation) => <button key={`${operation.kind}-${operation.listing._id}`} className={`todayOperationRow ${operation.kind}`} onClick={() => openTodayOperation(operation)}><span className="todayOperationIcon">{operation.kind === 'fulfillment' ? <PackageCheck size={17}/> : operation.kind === 'stale' ? <Clock3 size={17}/> : operation.kind === 'ready' ? <Rocket size={17}/> : operation.kind === 'reconcile' ? <RefreshCw size={17}/> : <ListTodo size={17}/>}</span><span><strong>{operation.label}</strong><small>{operation.listing.title}</small></span><span>{operation.detail}</span><b>Open</b></button>)}</div> : <p className="todayClear"><CheckCircle2 size={18}/> No known listing, reconciliation, pricing, or fulfillment work is waiting.</p>}
        {todayOperations.length > 6 ? <p className="compactText">Showing the first 6 actions in priority order. Complete one to reveal the next.</p> : null}
      </section> : null}

      {workspaceView === 'Queue' ? <section className="panel listingQueueBar">
        <div className="queueSummary">
          <div><p className="eyebrow">Listing queue</p><h2>Scan, review exceptions, then publish</h2><p>{queueListings.length} Draft/Pending in this view · {selectedIds.size} selected · {selectedReadyForEbay.length} ready · {selectedStagedForEbay.length} staged</p></div>
          <div className="queueProgressStrip" aria-label="Listing batch completion">
            <button onClick={() => setQueueType('All')}><strong>{batchCompletion.total}</strong><span>Total</span></button>
            <button className={batchCompletion.needsPhotos ? 'attention' : ''} onClick={() => setQueueType('Needs Photo')}><strong>{batchCompletion.needsPhotos}</strong><span>Photos</span></button>
            <button className={batchCompletion.needsPricing ? 'attention' : ''} onClick={() => setQueueType('Ready for Pricing')}><strong>{batchCompletion.needsPricing}</strong><span>Pricing</span></button>
            <button className={batchCompletion.exceptions ? 'attention' : ''} onClick={() => setExceptionQueueExpanded(true)}><strong>{batchCompletion.exceptions}</strong><span>Fix</span></button>
            <button className="ready" onClick={() => setQueueType('Ready for eBay')}><strong>{batchCompletion.ready}</strong><span>Ready</span></button>
            <button className="staged" onClick={() => setQueueType('Staged for eBay')}><strong>{batchCompletion.staged}</strong><span>Staged</span></button>
          </div>
        </div>
        <div className={`queueCommandBar ${selectedIds.size ? 'hasSelection' : ''}`}>
          <span className="queueCommandStatus">{selectedIds.size ? `${selectedIds.size} selected · ${selectedBlockedCount ? `${selectedBlockedCount} need fixes` : 'validation passed'}` : `${batchCompletion.ready} ready · ${batchCompletion.exceptions} need fixes`}</span>
          <div className="actions queueActions">
            {!selectedIds.size ? !sellerSession ? <button className="fastReviewButton" disabled={!queueListings.length || queueBusy} onClick={startSellerSession}><Play size={16}/> Start Session</button> : !sellerSession.activeSince ? <button className="fastReviewButton" disabled={!queueListings.length || queueBusy} onClick={toggleSellerSessionPause}><Play size={16}/> Resume Session</button> : <button className="fastReviewButton" disabled={!queueListings.length || queueBusy} onClick={() => openFastReview()}><WandSparkles size={16}/> Review Next</button> : firstSelectedBlocked ? <button disabled={queueBusy} onClick={() => openListingEditor(firstSelectedBlocked, (readinessByListingId.get(firstSelectedBlocked._id) || []).find((issue) => issue.blocking)?.step || 'details', true)}><ListChecks size={16}/> Fix {selectedBlockedCount}</button> : selectedReadyForEbay.length ? <button className="ebaySendButton" disabled={queueBusy || !sellerDefaultsReady} onClick={sendSelectedToEbay}><Send size={16}/> {queueBusy ? 'Working...' : `Stage ${selectedReadyForEbay.length}`}</button> : selectedStagedForEbay.length ? <button className="ebayPublishButton" disabled={queueBusy || !sellerDefaultsReady} onClick={publishSelectedStaged}><Rocket size={16}/> {queueBusy ? 'Working...' : `Publish ${selectedStagedForEbay.length}`}</button> : <button onClick={() => setBulkValidationOpen(true)}><ListChecks size={16}/> Review Selection</button>}
            <details className="listingUtilityMenu queueMoreMenu"><summary aria-label="More queue actions" title="More queue actions"><MoreHorizontal size={18}/></summary><div><button className="secondary" disabled={!queueListings.length || queueBusy} onClick={toggleQueueView}><CheckCircle2 size={16}/> {queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id)) ? 'Clear selection' : 'Select all in view'}</button><button className="secondary" disabled={!queueListings.length || queueBusy} onClick={() => setBulkValidationOpen(true)}><ListChecks size={16}/> Quality report</button>{selectedIds.size ? <button className="secondary" disabled={queueBusy} onClick={openPricingReview}><DollarSign size={16}/> Find fair value</button> : null}</div></details>
          </div>
        </div>
        {sellerSession ? <div className={`sellerSessionBar ${sellerSession.activeSince ? 'active' : 'paused'}`}>
          <div className="sellerSessionStatus"><span className="sellerSessionIndicator"/><div><strong>{sellerSession.activeSince ? 'Seller session active' : 'Seller session paused'}</strong><small>{formatSellerSessionDuration(sellerSessionElapsed)} elapsed</small></div></div>
          <div className="sellerSessionMetrics" aria-label="Seller session progress"><span><strong>{sellerSession.reviewed}</strong> reviewed</span><span><strong>{sellerSession.staged}</strong> staged</span><span><strong>{sellerSession.published}</strong> published</span></div>
          <form className="sellerSessionScanner" onSubmit={scanSellerSessionBarcode}><ScanBarcode size={17}/><input ref={sellerSessionScanRef} value={sellerSessionBarcode} disabled={!sellerSession.activeSince} onChange={(event) => setSellerSessionBarcode(event.target.value)} placeholder={sellerSession.activeSince ? 'Scan UPC or SKU' : 'Resume to scan'} aria-label="Scan queued UPC or SKU"/><button type="submit" disabled={!sellerSession.activeSince || !sellerSessionBarcode.trim()}>Open</button></form>
          <div className="sellerSessionActions"><button className="iconButton secondary" onClick={toggleSellerSessionPause} aria-label={sellerSession.activeSince ? 'Pause seller session' : 'Resume seller session'} title={sellerSession.activeSince ? 'Pause session' : 'Resume session'}>{sellerSession.activeSince ? <Pause size={17}/> : <Play size={17}/>}</button><button className="iconButton secondary sellerSessionFinish" onClick={finishSellerSession} aria-label="Finish seller session" title="Finish session"><CircleStop size={17}/></button></div>
          {sellerSessionMessage ? <p className="sellerSessionMessage" aria-live="polite">{sellerSessionMessage}</p> : null}
        </div> : null}
        {ebayNotice ? <p className="setupNotice successNotice">{ebayNotice}</p> : null}
        {ebayError ? <p className="setupNotice errorNotice">{ebayError}</p> : null}
      </section> : null}

      {workspaceView === 'Active' ? <section className="panel activeMaintenancePanel">
        <div className="activeMaintenanceHeader"><div><p className="eyebrow">Active inventory</p><h2>Stale Listing Manager</h2><p>Review age-based price changes with a protected profit floor before updating eBay.</p></div><button className="bulkMarkdownButton" disabled={!flipTrackerManagedActiveListings.length} onClick={() => openActiveListingManager()}><Clock3 size={16}/> Review Active Listings</button></div>
        <div className="activeMaintenanceMetrics" aria-label="FlipTracker active listing age">
          <div><span>FlipTracker API</span><strong>{flipTrackerManagedActiveListings.length}</strong></div>
          <button onClick={() => openActiveListingManager('gentle-30')}><span>30+ Days</span><strong>{activeAgeCounts.days30}</strong></button>
          <button onClick={() => openActiveListingManager('standard-60')}><span>60+ Days</span><strong>{activeAgeCounts.days60}</strong></button>
          <button onClick={() => openActiveListingManager('clearance-90')}><span>90+ Days</span><strong>{activeAgeCounts.days90}</strong></button>
        </div>
      </section> : null}

      {(!ebaySetup?.connected || sellerSetupExpanded) ? <section className="panel ebaySetupPanel">
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
      </section> : null}

      {workspaceView === 'Attention' && exceptionListings.length ? <section className={`panel exceptionQueuePanel ${exceptionListings.length ? 'hasExceptions' : ''}`}>
        <div className="panelHeader">
          <div><p className="eyebrow">Selling readiness</p><h2>{exceptionListings.length ? `${exceptionListings.length} listing${exceptionListings.length === 1 ? '' : 's'} need attention` : 'No listing exceptions'}</h2><p>{exceptionListings.length ? 'Correct missing category details, photos, pricing, or package data in one continuous queue.' : 'Every draft has the item-level information FlipTracker can validate locally.'}</p></div>
          {exceptionListings.length ? <button className="secondary" onClick={() => setExceptionQueueExpanded((expanded) => !expanded)}><ListChecks size={16}/>{exceptionQueueExpanded ? 'Collapse' : 'Review Queue'}</button> : <span className="statusPill ebayConnected"><CheckCircle2 size={14}/> Ready</span>}
        </div>
        {exceptionListings.length && exceptionQueueExpanded ? <div className="exceptionQueueList">
          {exceptionListings.slice(0, 12).map((listing) => {
            const blockers = (readinessByListingId.get(listing._id) || []).filter((issue) => issue.blocking && !['shippingPolicy', 'paymentPolicy', 'returnPolicy', 'inventoryLocation'].includes(issue.field));
            return <button key={listing._id} className="exceptionQueueRow" onClick={() => openListingEditor(listing, blockers[0]?.step || 'details', true)}><div><strong>{listing.title}</strong><small>{[listing.assetType, listing.sku ? `SKU ${listing.sku}` : undefined].filter(Boolean).join(' · ')}</small></div><div className="exceptionReasons">{blockers.slice(0, 3).map((issue) => <span key={`${issue.step}-${issue.field}`}>{issue.message}</span>)}{blockers.length > 3 ? <span>+{blockers.length - 3} more</span> : null}</div><span className="reviewException">Review</span></button>;
          })}
          {exceptionListings.length > 12 ? <p className="compactText">Showing the first 12. Save and Next continues through the remaining queue.</p> : null}
        </div> : null}
      </section> : null}

      {workspaceView === 'Attention' && operationsListings.length ? <section className={`panel operationsInboxPanel ${operationsListings.length ? 'hasOperations' : ''}`}>
        <div className="panelHeader">
          <div><p className="eyebrow">eBay operations</p><h2>{operationsListings.length ? `${operationsListings.length} item${operationsListings.length === 1 ? '' : 's'} need reconciliation` : 'Operations inbox is clear'}</h2><p>{operationsListings.length ? 'Review sync failures, imported sales, and stale or incomplete eBay links.' : 'No known eBay lifecycle or synchronization problems need attention.'}</p></div>
          {operationsListings.length ? <button className="secondary" onClick={() => setOperationsExpanded((expanded) => !expanded)}><AlertTriangle size={16}/>{operationsExpanded ? 'Collapse' : 'Review Inbox'}</button> : <span className="statusPill ebayConnected"><CheckCircle2 size={14}/> Healthy</span>}
        </div>
        {operationsListings.length && operationsExpanded ? <div className="operationsInboxList">{operationsListings.slice(0, 12).map(({ listing, issue }) => <button key={listing._id} className="operationsInboxRow" onClick={() => listing.status === 'Sold' ? openSaleEditor(listing) : openListingEditor(listing)}><div><strong>{listing.title}</strong><small>{[listing.status, listing.externalListingId ? `eBay ${listing.externalListingId}` : undefined, listing.sku ? `SKU ${listing.sku}` : undefined].filter(Boolean).join(' · ')}</small></div><span>{issue}</span><b>{listing.status === 'Sold' ? 'Add Cost' : 'Review'}</b></button>)}</div> : null}
      </section> : null}

      {workspaceView === 'Attention' && !workspaceCounts.Attention ? <section className="panel attentionClearPanel"><CheckCircle2 size={22}/><div><h2>Nothing needs attention</h2><p>There are no listing blockers, imported-sale reviews, or eBay synchronization problems waiting.</p></div></section> : null}

      <section className="panel listingControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search listings..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)}>{['All', ...PLATFORMS].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Sort listings" value={sortBy} onChange={(event) => setSortBy(event.target.value as ListingSort)}>{(['Newest', 'Queue', 'Status', 'Price High', 'Price Low'] as ListingSort[]).map((value) => <option key={value} value={value}>{`Sort: ${value}`}</option>)}</select>
        <details className="listingFilterMenu"><summary><SlidersHorizontal size={16}/> Filters</summary><div>{workspaceView === 'Attention' ? <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{['All', ...STATUSES].map((value) => <option key={value}>{value}</option>)}</select></label> : null}{workspaceView === 'Queue' ? <label>Queue Stage<select aria-label="Filter by queue type" value={queueType} onChange={(event) => setQueueType(event.target.value)}><option value="All">All stages</option>{QUEUE_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}{workspaceView === 'Shipping' ? <label>Fulfillment Stage<select value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)}><option value="All">All open shipments</option><option>Awaiting Shipment</option><option>Packed</option></select></label> : null}{!['Queue', 'Attention', 'Shipping'].includes(workspaceView) ? <p>No additional filters for this stage.</p> : null}</div></details>
        <div className="actions listingTools">
          {workspaceView === 'Active' || workspaceView === 'Attention' ? <button className="secondary" disabled={activeListingsSyncBusy || !ebaySetup?.connected} onClick={refreshActiveEbayListings}><RefreshCw size={16}/>{activeListingsSyncBusy ? 'Syncing...' : 'Sync Active'}</button> : null}
          {workspaceView === 'Sold' || workspaceView === 'Attention' ? <button className="secondary" disabled={sellerSalesSyncBusy || !ebaySetup?.connected} onClick={refreshEbaySales}><RefreshCw size={16}/>{sellerSalesSyncBusy ? 'Syncing...' : 'Sync Sales'}</button> : null}
          {workspaceView === 'Active' ? <button className="secondary bulkMarkdownButton" disabled={!flipTrackerManagedActiveListings.length || bulkMarkdownBusy} onClick={() => openActiveListingManager()}><Clock3 size={16}/> Review Prices</button> : null}
          <details className="listingUtilityMenu"><summary aria-label="More listing tools" title="More listing tools"><MoreHorizontal size={18}/></summary><div><label className="button secondary"><Upload size={16}/> Import Old JSON<input type="file" accept="application/json,.json" hidden onChange={importOldJson}/></label><button className="secondary" onClick={exportCsv}><Download size={16}/> Export This View</button></div></details>
        </div>
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader"><div><h2>{workspaceView === 'Attention' ? 'Needs Attention' : workspaceView === 'Shipping' ? 'Orders Awaiting Shipment' : `${workspaceView} Listings`}</h2><p>{listings === undefined ? 'Loading Convex data...' : `${filtered.length} ${workspaceView === 'Shipping' ? 'order' : 'listing'}${filtered.length === 1 ? '' : 's'} in this view`}</p></div>{workspaceView !== 'Shipping' ? <button className="secondary" onClick={onAddOtherItem}><Plus size={16}/> Add Item</button> : null}</div>
        {listings === undefined ? <p className="panelMessage">Loading listings...</p> : filtered.length === 0 ? <div className="empty"><h2>{workspaceView === 'Shipping' ? 'No orders awaiting shipment' : 'No listings found'}</h2><p>{workspaceView === 'Shipping' ? 'Sync eBay Sales to import paid orders. Packed and awaiting-shipment orders will appear here.' : 'Create a draft from an item in Inventory, then track it through sale.'}</p></div> : (
          <div className="tableWrap">
            <table className="listingLifecycleTable">
              <thead><tr><th className="selectColumn">{workspaceView === 'Queue' ? <input type="checkbox" aria-label="Select all eligible listings in view" checked={queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id))} onChange={toggleQueueView}/> : null}</th><th>Item</th><th>{workspaceView === 'Shipping' ? 'Fulfillment' : 'Readiness'}</th><th>Price</th><th>Location</th><th>Action</th></tr></thead>
              <tbody>{filtered.map((listing) => (
                <tr key={listing._id}>
                  <td className="selectColumn">{workspaceView === 'Queue' && listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) ? <input type="checkbox" aria-label={`Select ${listing.title}`} checked={selectedIds.has(listing._id)} onChange={() => toggleSelected(listing._id)}/> : null}</td>
                  <td className="listingIdentityCell"><div className="listingIdentityHeader"><span className="consoleTag">{listing.platform}</span><span className={`badge ${listing.status.toLowerCase()}`}>{listing.status}</span></div><strong>{listing.title}</strong><small>{listing.assetTitle}{listing.sku ? ` · SKU ${listing.sku}` : ''}</small>{listing.platform === 'eBay' ? <small className="listingOrigin">Created with: {ebayListingOrigin(listing)}</small> : null}</td>
                  <td className="listingStateCell">{workspaceView === 'Shipping' ? <><div className="queueQualityLine"><span className="queueBadge ready-for-ebay">{listing.fulfillmentStatus || 'Awaiting Shipment'}</span></div><small>{listing.shippingService || recommendFulfillment(listing).service}</small>{listing.ebayOrderId ? <small>Order {listing.ebayOrderId}</small> : <small className="warningText">Sync order before tracking</small>}</> : <><div className="queueQualityLine"><span className={`queueBadge ${queueStatus(listing).toLowerCase().replace(/\s+/g, '-')}`}>{queueStatus(listing)}</span>{qualityByListingId.get(listing._id) ? <button className={`qualityScore ${qualityByListingId.get(listing._id)!.grade.toLowerCase().replace(/\s+/g, '-')}`} title={qualityByListingId.get(listing._id)!.checks.map((check) => `${check.label}: ${check.message}`).join('\n')} onClick={() => openListingEditor(listing, qualityByListingId.get(listing._id)!.checks.find((check) => check.status !== 'pass')?.key === 'photos' ? 'shipping' : 'details')}><Gauge size={13}/>{qualityByListingId.get(listing._id)!.score}</button> : null}</div>{listing.pricingSource ? <small>{listing.pricingSource}</small> : null}{listing.fulfillmentStatus ? <small className="fulfillmentStatus">{listing.fulfillmentStatus === 'Completed' ? 'Archived' : `Fulfillment: ${listing.fulfillmentStatus}`}</small> : null}{listing.ebayDraftStatus ? <small className="ebayDraftMeta">eBay: {listing.ebayDraftStatus}</small> : null}{listing.ebayOrderId ? <small>Order {listing.ebayOrderId}</small> : null}{listing.status !== 'Sold' && listing.ebayLastError ? <button className="ebayErrorTrigger" onClick={() => setEbayErrorListing(listing)}><AlertTriangle size={13}/> eBay issue</button> : null}</>}</td>
                  <td className="valueCell listingPriceCell">{money(listing.status === 'Sold' ? listing.soldPrice : listing.currentPrice ?? listing.listedPrice)}</td>
                  <td className="listingLocationCell">{listing.storageLocation || <span className="mutedValue">—</span>}</td>
                  <td className="tableActionsCell"><div className="rowActions simplifiedRowActions">
                    {listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && Boolean(listing.ebayOfferId) ? <button className="rowPrimaryAction ebayPublishButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} onClick={() => publishToEbay(listing)}><Rocket size={15}/> Publish</button> : listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && queueStatus(listing) === 'Ready for eBay' ? <button className="rowPrimaryAction ebayUploadButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} onClick={() => sendToEbay(listing)}><CloudUpload size={15}/> Stage</button> : listing.status === 'Active' && listing.platform === 'eBay' && listing.externalListingId ? <button className="rowPrimaryAction ebayRepriceButton" disabled={repriceBusy} onClick={() => openRepriceEditor(listing)}><BadgeDollarSign size={15}/> Price</button> : listing.status === 'Sold' && ['Awaiting Shipment', 'Packed'].includes(listing.fulfillmentStatus || '') ? <button className="rowPrimaryAction fulfillmentButton" onClick={() => openFulfillmentEditor(listing)}><PackageCheck size={15}/> Ship</button> : listing.status === 'Sold' ? <button className="rowPrimaryAction saleCloseButton" onClick={() => openSaleEditor(listing)}><DollarSign size={15}/> Sale</button> : <button className="rowPrimaryAction fastReviewRowButton" onClick={() => openFastReview(listing)}><WandSparkles size={15}/> Review</button>}
                    <details className="rowActionMenu"><summary aria-label={`More actions for ${listing.title}`} title="More actions"><MoreHorizontal size={17}/></summary><div>
                      <button className="secondary" onClick={() => openListingEditor(listing)}><Pencil size={15}/> Edit record</button>
                      {listing.status !== 'Sold' ? <button className="secondary" onClick={() => requestSaleEditor(listing)}><DollarSign size={15}/> Record sale</button> : null}
                      {listing.status === 'Sold' ? <button className="secondary" onClick={() => openFulfillmentEditor(listing)}><PackageCheck size={15}/> Fulfillment</button> : null}
                      {listing.platform === 'eBay' && listing.status === 'Active' && listing.externalListingId ? <button className="secondary" disabled={endListingBusy || !adminKey} onClick={() => { setEndListingError(''); setEndListingPrompt(listing); }}><CircleStop size={15}/> End listing</button> : null}
                      {listing.listingUrl ? <a className="button secondary" href={listing.listingUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open listing</a> : null}
                      <button className="danger" onClick={() => remove(listing)}><Trash2 size={15}/> Delete</button>
                    </div></details>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {bulkValidationOpen ? <div className="modalBackdrop"><section className="modal bulkValidationModal" role="dialog" aria-modal="true" aria-labelledby="bulk-validation-title">
        <header className="modalHeader"><div><p className="eyebrow">Batch quality review</p><h2 id="bulk-validation-title">{bulkValidationRows.length} listing{bulkValidationRows.length === 1 ? '' : 's'} validated</h2><p>{selectedListings.length ? 'Current Queue selection' : 'Current Queue view'}</p></div><button className="iconButton secondary" aria-label="Close batch validation" onClick={() => setBulkValidationOpen(false)}><X size={18}/></button></header>
        <div className="bulkValidationSummary"><div className="ready"><span>Clean</span><strong>{bulkValidationClean.length}</strong></div><div className="attention"><span>Exceptions</span><strong>{bulkValidationRows.length - bulkValidationClean.length}</strong></div><div><span>Average quality</span><strong>{bulkValidationRows.length ? Math.round(bulkValidationRows.reduce((total, row) => total + row.quality.score, 0) / bulkValidationRows.length) : 0}</strong></div><div><span>Recommended photos</span><strong>{bulkValidationRows.reduce((total, row) => total + Math.max(0, row.quality.recommendedPhotoCount - (row.listing.actualPhotoCount || 0)), 0)}</strong></div></div>
        <div className="bulkValidationList">{bulkValidationRows.map(({ listing, quality, blockers }) => <button key={listing._id} className={blockers.length ? 'exception' : 'clean'} onClick={() => { setBulkValidationOpen(false); openListingEditor(listing, blockers[0]?.step || 'preview', Boolean(blockers.length)); }}><span className={`qualityScore ${quality.grade.toLowerCase().replace(/\s+/g, '-')}`}><Gauge size={14}/>{quality.score}</span><span><strong>{listing.title}</strong><small>{quality.grade} · {listing.actualPhotoCount || 0}/{quality.recommendedPhotoCount} photos</small></span><span>{blockers.length ? blockers.slice(0, 2).map((issue) => issue.message).join(' ') : quality.checks.filter((check) => check.status === 'warning').slice(0, 2).map((check) => check.message).join(' ') || 'Ready for staging review.'}</span><b>{blockers.length ? 'Fix' : 'Review'}</b></button>)}</div>
        <div className="modalActions"><button className="secondary" onClick={() => setBulkValidationOpen(false)}>Close</button><button disabled={!bulkValidationClean.length} onClick={() => { setSelectedIds(new Set(bulkValidationClean.map((row) => row.listing._id))); setBulkValidationOpen(false); }}><CheckCircle2 size={16}/> Select {bulkValidationClean.length} Clean</button></div>
      </section></div> : null}

      {ebayErrorListing ? <div className="modalBackdrop"><section className="modal ebayErrorModal" role="dialog" aria-modal="true" aria-labelledby="ebay-error-title">
        <header className="modalHeader"><div><p className="eyebrow">eBay listing issue</p><h2 id="ebay-error-title">{ebayErrorListing.title}</h2></div><button className="iconButton secondary" aria-label="Close eBay error" onClick={() => setEbayErrorListing(null)}><X size={18}/></button></header>
        <div className="ebayErrorMessage"><AlertTriangle size={20}/><p>{ebayErrorListing.ebayLastError}</p></div>
        <div className="modalActions"><button className="secondary" onClick={() => setEbayErrorListing(null)}>Close</button><button onClick={() => { const listing = ebayErrorListing; setEbayErrorListing(null); openListingEditor(listing); }}><Pencil size={16}/> Review listing</button></div>
      </section></div> : null}

      {templatesOpen ? <ListingTemplatesModal fulfillmentPolicies={ebaySetup?.policies.fulfillment || []} onClose={() => setTemplatesOpen(false)}/> : null}

      {fulfillmentEditing ? <div className="modalBackdrop"><section className="modal fulfillmentModal">
        <header className="modalHeader"><div><p className="eyebrow">Pick, pack, ship</p><h2>{fulfillmentEditing.title}</h2><p>{[fulfillmentEditing.storageLocation ? `Location ${fulfillmentEditing.storageLocation}` : undefined, fulfillmentEditing.sku ? `SKU ${fulfillmentEditing.sku}` : undefined, fulfillmentEditing.ebayOrderId ? `Order ${fulfillmentEditing.ebayOrderId}` : undefined].filter(Boolean).join(' · ')}</p></div><button className="iconButton secondary" aria-label="Close fulfillment" disabled={fulfillmentBusy} onClick={() => setFulfillmentEditing(null)}><X size={18}/></button></header>
        <div className="fulfillmentStatusPicker" role="group" aria-label="Fulfillment status">{['Awaiting Shipment', 'Packed', 'Shipped', 'Completed'].map((value) => <button key={value} className={fulfillmentEditing.fulfillmentStatus === value ? 'active' : 'secondary'} onClick={() => setFulfillmentEditing((current) => current ? { ...current, fulfillmentStatus: value } : current)}>{value === 'Awaiting Shipment' ? <ListTodo size={16}/> : value === 'Packed' ? <Package size={16}/> : value === 'Shipped' ? <Truck size={16}/> : <CheckCircle2 size={16}/>} {value}</button>)}</div>
        <div className="fulfillmentSummary">
          <div><span>Sold for</span><strong>{money(fulfillmentEditing.soldPrice)}</strong></div>
          <div><span>Package</span><strong>{fulfillmentEditing.packageWeightOz ? `${fulfillmentEditing.packageWeightOz} oz` : 'Confirm weight'}</strong><small>{[fulfillmentEditing.packageLengthIn, fulfillmentEditing.packageWidthIn, fulfillmentEditing.packageHeightIn].every(Boolean) ? `${fulfillmentEditing.packageLengthIn} × ${fulfillmentEditing.packageWidthIn} × ${fulfillmentEditing.packageHeightIn} in` : fulfillmentEditing.shippingPreset || 'No saved profile'}</small></div>
          <div><span>Buyer shipping</span><strong>{money(fulfillmentEditing.shippingCharged)}</strong></div>
          <div><span>Label cost</span><strong>{fulfillmentEditing.shippingCost !== undefined ? money(fulfillmentEditing.shippingCost) : 'Enter after purchase'}</strong><small>{fulfillmentProfit ? `${fulfillmentProfit.shippingMargin >= 0 ? '+' : ''}${money(fulfillmentProfit.shippingMargin)} shipping margin` : ''}</small></div>
        </div>
        {fulfillmentRecommendation ? <div className="shippingRecommendation"><Truck size={20}/><div><span>Recommended starting point</span><strong>{fulfillmentRecommendation.service} · {fulfillmentRecommendation.profileLabel}</strong><p>{fulfillmentRecommendation.reason}</p>{fulfillmentRecommendation.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div><button className="secondary" onClick={() => setFulfillmentEditing((current) => current ? { ...current, shippingCarrier: fulfillmentRecommendation.carrier, shippingService: fulfillmentRecommendation.service } : current)}>Use</button></div> : null}
        <div className="fulfillmentFormGrid">
          <label>Package Profile<select value={fulfillmentEditing.shippingPreset || fulfillmentRecommendation?.profileKey || 'custom'} onChange={(event) => applyFulfillmentProfile(event.target.value)}>{EBAY_SHIPPING_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
          <label>Shipping Service<input value={fulfillmentEditing.shippingService || ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, shippingService: event.target.value } : current)} placeholder="USPS Media Mail"/></label>
          <label>Carrier<select value={fulfillmentEditing.shippingCarrier || ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, shippingCarrier: event.target.value || undefined } : current)}><option value="">Choose after label purchase</option>{['USPS','UPS','FedEx','DHL','Other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Tracking Number<input value={fulfillmentEditing.trackingNumber || ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, trackingNumber: event.target.value } : current)} placeholder="Paste from purchased label"/></label>
          <label>Label Cost<input type="number" min="0" step="0.01" value={fulfillmentEditing.shippingCost ?? ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, shippingCost: optionalNumber(event.target.value) } : current)} placeholder="Actual postage paid"/></label>
          <label>Package Weight (oz)<input type="number" min="0.1" step="0.1" value={fulfillmentEditing.packageWeightOz ?? ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, packageWeightOz: optionalNumber(event.target.value), shippingPreset: 'custom' } : current)}/></label>
          <details className="fulfillmentMeasurements"><summary>Package measurements</summary><div><label>Length (in)<input type="number" min="0.1" step="0.1" value={fulfillmentEditing.packageLengthIn ?? ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, packageLengthIn: optionalNumber(event.target.value), shippingPreset: 'custom' } : current)}/></label><label>Width (in)<input type="number" min="0.1" step="0.1" value={fulfillmentEditing.packageWidthIn ?? ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, packageWidthIn: optionalNumber(event.target.value), shippingPreset: 'custom' } : current)}/></label><label>Height (in)<input type="number" min="0.1" step="0.1" value={fulfillmentEditing.packageHeightIn ?? ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, packageHeightIn: optionalNumber(event.target.value), shippingPreset: 'custom' } : current)}/></label></div></details>
          <label className="checkRow fulfillmentInsurance"><input type="checkbox" checked={Boolean(fulfillmentEditing.insuranceRequired)} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, insuranceRequired: event.target.checked } : current)}/><span><strong>Insurance or additional coverage needed</strong><small>Automatically suggested at $100 or more. Confirm carrier limits before purchase.</small></span></label>
          <label className="fulfillmentNotes">Packing Notes<textarea value={fulfillmentEditing.fulfillmentNotes || ''} onChange={(event) => setFulfillmentEditing((current) => current ? { ...current, fulfillmentNotes: event.target.value } : current)} placeholder="Box, padding, signature, damage protection, or handoff notes..."/></label>
        </div>
        {fulfillmentProfit ? <div className="fulfillmentEconomics"><span>Estimated order net after item cost, fees, and label</span><strong>{money(fulfillmentProfit.estimatedNet)}</strong></div> : null}
        <p className="ebaySafetyNote">Purchase the label in eBay so buyer address, eligible services, and postage remain authoritative. Return here, enter the final label cost and tracking, then submit shipment.</p>
        {fulfillmentError ? <p className="formError">{fulfillmentError}</p> : null}
        <div className="actions modalActions"><a className="button secondary" href={`${ebaySetup?.environment === 'sandbox' ? 'https://www.sandbox.ebay.com' : 'https://www.ebay.com'}/sh/ord/?filter=status:AWAITING_SHIPMENT`} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Buy Label on eBay</a><button className="secondary" disabled={fulfillmentBusy} onClick={saveFulfillment}><Save size={16}/> Save Progress</button><button disabled={fulfillmentBusy || !adminKey || !fulfillmentEditing.ebayOrderId || !fulfillmentEditing.shippingCarrier || !fulfillmentEditing.trackingNumber} onClick={submitFulfillmentTracking}><Send size={16}/>{fulfillmentBusy ? 'Submitting...' : 'Submit Tracking to eBay'}</button></div>
      </section></div> : null}

      {sellerSessionSummary ? <div className="modalBackdrop"><section className="modal sellerSessionSummaryModal">
        <header className="modalHeader"><div><p className="eyebrow">Seller session complete</p><h2>Stack processed</h2><p>Your progress is saved to each listing.</p></div><button className="iconButton secondary" aria-label="Close session summary" onClick={() => setSellerSessionSummary(null)}><X size={18}/></button></header>
        <div className="sellerSessionSummaryGrid"><div><span>Time</span><strong>{formatSellerSessionDuration(sellerSessionElapsedMs(sellerSessionSummary))}</strong></div><div><span>Reviewed</span><strong>{sellerSessionSummary.reviewed}</strong></div><div><span>Staged</span><strong>{sellerSessionSummary.staged}</strong></div><div><span>Published</span><strong>{sellerSessionSummary.published}</strong></div></div>
        <p className="sellerSessionSummaryNote">Queue has {queueListings.length} item{queueListings.length === 1 ? '' : 's'} remaining in the current view.</p>
        <div className="modalActions"><button className="secondary" onClick={() => setSellerSessionSummary(null)}>Done</button>{queueListings.length ? <button onClick={() => { setSellerSessionSummary(null); startSellerSession(); }}><Play size={16}/> Start Another Session</button> : null}</div>
      </section></div> : null}

      {fastReviewing ? (
        <div className="modalBackdrop"><section className="modal wideModal fastReviewModal">
          <header className="modalHeader"><div><p className="eyebrow">Fast listing review</p><h2>{fastReviewing.assetTitle}</h2><span className="statusPill">{[fastReviewing.assetType, fastReviewing.sku ? `SKU ${fastReviewing.sku}` : undefined].filter(Boolean).join(' · ')}</span></div><button className="iconButton secondary" aria-label="Close fast review" onClick={() => setFastReviewing(null)}><X size={18}/></button></header>
          <div className="fastReviewProgress"><span>{Math.max(1, queueListings.findIndex((listing) => listing._id === fastReviewing._id) + 1)} of {queueListings.length}</span><strong>{listingFamily(fastReviewing)} workflow</strong><small>Only routine selling choices are shown here.</small></div>
          <div className="fastReviewLayout">
            <section className="fastReviewPhoto">
              {fastReviewing.ebayImageUrl || fastReviewing.photoUrl ? <img src={fastReviewing.ebayImageUrl || fastReviewing.photoUrl} alt={fastReviewing.title}/> : <div className="fastReviewPhotoMissing"><Camera size={32}/><strong>No image yet</strong><span>Add actual photos from the phone queue.</span></div>}
              <button className="secondary" onClick={() => { setFastReviewing(null); window.location.hash = '#photos'; }}><Camera size={16}/> Open Photo Queue</button>
            </section>
            <section className="fastReviewFields">
              <label>eBay Title<input value={fastReviewing.title} maxLength={80} onChange={(event) => patchFastReview({ title: event.target.value })}/><small>{fastReviewing.title.length}/80 characters</small></label>
              <div className="fastReviewFieldRow">
                <label>Condition<select value={fastReviewing.condition || ''} onChange={(event) => patchFastReview({ condition: event.target.value })}><option value="">Choose condition</option>{['New','Like New','Very Good','Good','Acceptable','For Parts'].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Price<input type="number" inputMode="decimal" min="0.99" step="0.01" value={fastReviewing.currentPrice ?? fastReviewing.listedPrice ?? ''} onChange={(event) => patchFastReview({ currentPrice: optionalNumber(event.target.value) })}/></label>
              </div>
              <label>Completeness<select value={fastReviewing.completeness || ''} onChange={(event) => patchFastReview({ completeness: event.target.value || undefined })}><option value="">No completeness value</option>{['Complete','Disc Only','Case Only','Case + Disc','No Manual','Sealed','Loose','Incomplete'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <div className="fastReviewFieldRow">
                <label>Shipping Profile<select value={fastReviewing.shippingPreset || 'custom'} onChange={(event) => selectFastShippingPreset(event.target.value)}>{EBAY_SHIPPING_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
                <label>eBay Shipping Policy<select value={fastReviewing.fulfillmentPolicyId || ''} onChange={(event) => patchFastReview({ fulfillmentPolicyId: event.target.value || undefined })}><option value="">Use seller default</option>{ebaySetup?.policies.fulfillment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
              </div>
              <div className="fastReviewSummary">
                <div><span>Package</span><strong>{fastReviewing.packageWeightOz ?? '—'} oz</strong></div>
                <div><span>Item cost</span><strong>{money(fastReviewing.purchasePrice)}</strong></div>
                <div><span>Estimated net</span><strong className={fastReviewNet < 0 ? 'lossValue' : 'profitValue'}>{money(fastReviewNet)}</strong><small>after {listingSpeedPresetFor(fastReviewing)?.feePercent ?? 15}% fee estimate{fastReviewing.shippingCost ? ' and saved shipping cost' : ''}</small></div>
              </div>
              <label className="checkRow fastPresetToggle"><input type="checkbox" checked={rememberFastDefaults} onChange={(event) => setRememberFastDefaults(event.target.checked)}/><span><strong>Remember these defaults for {listingFamily(fastReviewing)} items</strong><small>Condition, completeness, shipping profile, policy, and image source stay on this browser.</small></span></label>
            </section>
          </div>
          <section className={`fastReviewReadiness ${fastReviewIssues.some((issue) => issue.blocking) ? 'blocked' : 'ready'}`}>
            <div><strong>{fastReviewIssues.some((issue) => issue.blocking) ? `${fastReviewIssues.filter((issue) => issue.blocking).length} item${fastReviewIssues.filter((issue) => issue.blocking).length === 1 ? '' : 's'} need attention` : 'Ready to stage'}</strong><span>{fastReviewIssues.length ? fastReviewIssues.slice(0, 3).map((issue) => issue.message).join(' ') : 'Category, shipping, photo, price, and required details pass local checks.'}</span></div>
            {fastReviewIssues.length ? <button className="secondary" onClick={() => openListingEditor(fastReviewing, fastReviewIssues[0].step, true)}>Open Full Editor</button> : null}
          </section>
          {listingSaveError ? <p className="formError listingSaveError">{listingSaveError}</p> : null}
          <div className="listingFactoryFooter"><button className="secondary" disabled={listingSaveBusy} onClick={() => setFastReviewing(null)}>Close</button><div className="actions"><button className="secondary" disabled={listingSaveBusy} onClick={() => openListingEditor(fastReviewing)}>Advanced</button><button disabled={listingSaveBusy} onClick={() => saveFastReview(false)}><Save size={16}/> {listingSaveBusy ? 'Saving...' : 'Save & Next'}</button><button className="ebaySendButton" disabled={listingSaveBusy || fastReviewIssues.some((issue) => issue.blocking) || !sellerDefaultsReady} onClick={() => saveFastReview(true)}><CloudUpload size={16}/> Save, Stage & Next</button></div></div>
        </section></div>
      ) : null}

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

      {bulkMarkdownOpen ? (
        <div className="modalBackdrop"><section className="modal bulkMarkdownModal">
          <header className="modalHeader"><div><p className="eyebrow">Active listing maintenance</p><h2>Stale Listing Manager</h2><p>{flipTrackerManagedActiveListings.length} active listing{flipTrackerManagedActiveListings.length === 1 ? '' : 's'} created through FlipTracker</p></div><button className="iconButton secondary" disabled={bulkMarkdownBusy} aria-label="Close stale listing manager" onClick={() => setBulkMarkdownOpen(false)}><X size={18}/></button></header>
          <div className="markdownStrategyPicker" role="group" aria-label="Markdown strategy">
            {MARKDOWN_STRATEGIES.map((strategy) => <button key={strategy.key} className={bulkMarkdownStrategy === strategy.key ? 'active' : 'secondary'} onClick={() => selectBulkMarkdownStrategy(strategy.key)}>{strategy.label}</button>)}
          </div>
          <div className="bulkMarkdownControls">
            <label>Minimum listing age<input type="number" inputMode="numeric" min="0" max="3650" step="1" value={bulkMarkdownAge} onChange={(event) => { setBulkMarkdownStrategy('custom'); setBulkMarkdownAge(event.target.value); }}/><small>Days since the saved listed date</small></label>
            <label>Price reduction<div className="percentInput"><input type="number" inputMode="decimal" min="0.1" max="90" step="0.1" value={bulkMarkdownPercent} onChange={(event) => { setBulkMarkdownStrategy('custom'); setBulkMarkdownPercent(event.target.value); }}/><span>%</span></div></label>
            <label>Estimated eBay fee %<input type="number" inputMode="decimal" min="0" max="50" step="0.1" value={bulkMarkdownFeePercent} onChange={(event) => setBulkMarkdownFeePercent(event.target.value)}/></label>
            <label>Minimum estimated profit<input type="number" inputMode="decimal" min="0" step="0.01" value={bulkMarkdownMinimumProfit} onChange={(event) => setBulkMarkdownMinimumProfit(event.target.value)}/></label>
            <label className="repriceCharm"><input type="checkbox" checked={bulkMarkdownCharm} onChange={(event) => setBulkMarkdownCharm(event.target.checked)}/><span>Use a .99 price when it still lowers the listing</span></label>
          </div>
          <div className="bulkMarkdownSummary"><div><span>Eligible</span><strong>{bulkMarkdownRows.length}</strong></div><div><span>Profit Protected</span><strong>{bulkMarkdownExcluded.protected}</strong></div><div><span>Too New</span><strong>{bulkMarkdownExcluded.tooNew}</strong></div><div><span>Missing Date</span><strong>{bulkMarkdownExcluded.missingDate}</strong></div><div><span>No Lower Price</span><strong>{bulkMarkdownExcluded.invalid}</strong></div><div><span>Current Total</span><strong>{money(bulkMarkdownRows.reduce((sum, row) => sum + row.currentPrice, 0))}</strong></div><div><span>New Total</span><strong>{money(bulkMarkdownRows.reduce((sum, row) => sum + row.newPrice, 0))}</strong></div></div>
          <div className="bulkMarkdownPreview" aria-label="Bulk markdown preview">
            {bulkMarkdownPreviewRows.slice(0, 20).map((row) => <div key={row.listing._id} className={`markdownPreviewRow ${row.status}`}><span><strong>{row.listing.title}</strong><small>{row.ageDays === undefined ? 'No listed date' : `${row.ageDays} days active`} · eBay {row.listing.externalListingId}</small></span><span className="markdownOutcome"><em>{markdownStatusLabel(row.status)}</em><b>{row.newPrice === undefined ? money(row.currentPrice) : `${money(row.currentPrice)} → ${money(row.newPrice)}`}</b>{row.estimatedProfit !== undefined ? <small>Est. profit {money(row.estimatedProfit)}</small> : null}</span></div>)}
            {bulkMarkdownPreviewRows.length > 20 ? <p>Showing 20 of {bulkMarkdownPreviewRows.length} managed active listings.</p> : null}
            {!bulkMarkdownPreviewRows.length ? <p>No active Inventory API listings created by FlipTracker were found.</p> : null}
          </div>
          <p className="ebaySafetyNote">Profit estimates use saved purchase cost, shipping charged, shipping cost, and the fee assumption above. Missing costs are treated as $0. Only Eligible rows change; eBay app and Seller Hub listings remain excluded.</p>
          {bulkMarkdownProgress ? <p className="bulkMarkdownProgress">{bulkMarkdownProgress}</p> : null}
          {bulkMarkdownError ? <p className="formError">{bulkMarkdownError}</p> : null}
          <div className="actions modalActions"><button className="secondary" disabled={bulkMarkdownBusy} onClick={() => setBulkMarkdownOpen(false)}>Cancel</button><button disabled={bulkMarkdownBusy || !bulkMarkdownRows.length || !adminKey} onClick={submitBulkMarkdown}><Percent size={16}/>{bulkMarkdownBusy ? 'Updating eBay...' : `Apply to ${bulkMarkdownRows.length} Eligible Listings`}</button></div>
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
            <label className="span2 saleArchiveOption"><input type="checkbox" checked={archiveSale} onChange={(event) => setArchiveSale(event.target.checked)}/><span><strong>Mark completed / archived</strong><small>Keeps the record Sold for revenue and profit reporting while removing it from operational follow-up.</small></span></label>
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
          {editing.platform === 'eBay' && editing.status === 'Active' && editing.ebayOfferId ? <p className="ebaySafetyNote"><strong>Created with FlipTracker API:</strong> eBay's app and Seller Hub cannot revise this listing. Make changes here and use Save &amp; Update eBay. Use End Listing or Record Sale for status changes.</p> : null}
          {editing.platform === 'eBay' && editing.status === 'Active' && editing.externalListingId && !editing.ebayOfferId ? <p className="ebaySafetyNote"><strong>Created with eBay app / Seller Hub:</strong> FlipTracker reads the live item first and preserves its eBay-managed values before updating the fields reviewed here.</p> : null}
          <div className="formGrid listingFactoryForm">
            <div className="span2 listingReadinessPanelWrap"><ListingReadinessPanel issues={editingReadinessIssues} quality={editingQuality} onNavigate={(step) => setEditorStep(compactEditorStep(step))}/></div>
            {editorStep === 'details' ? <>
            <label>Platform<select value={editing.platform} onChange={(event) => patchEditing({ platform: event.target.value })}>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={editing.status} disabled={editing.platform === 'eBay' && editing.status === 'Active' && Boolean(editing.externalListingId)} onChange={(event) => patchEditing({ status: event.target.value })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
            {editing.platform === 'Other' ? <label className="span2">Sale Channel<input value={editing.saleChannelDetail || ''} onChange={(event) => patchEditing({ saleChannelDetail: event.target.value })} placeholder="Local shop, yard sale, convention..."/></label> : null}
            <label className="span2">Listing Title<input value={editing.title} onChange={(event) => patchEditing({ title: event.target.value })}/></label>
            <label>SKU<input value={editing.sku || ''} onChange={(event) => patchEditing({ sku: event.target.value })}/></label>
            <label>Marketplace Item ID<input value={editing.externalListingId || ''} onChange={(event) => patchEditing({ externalListingId: event.target.value })}/></label>
            <label className="span2">Listing URL<input type="url" value={editing.listingUrl || ''} onChange={(event) => patchEditing({ listingUrl: event.target.value })}/></label>
            <label>Condition<input value={editing.condition || ''} onChange={(event) => patchEditing({ condition: event.target.value, imageMode: isNewCondition(event.target.value) || (isBookListing(editing) && Boolean(editing.photoUrl)) ? editing.imageMode : 'Actual Item Photo' })}/></label>
            <label>Language<select value={editing.language || 'English'} onChange={(event) => patchEditing({ language: event.target.value })}>{editing.language && !LANGUAGE_OPTIONS.includes(editing.language) ? <option value={editing.language}>{editing.language}</option> : null}{LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language}</option>)}</select><small>Sent to eBay as the Language item specific.</small></label>
            </> : null}
            {editorStep === 'details' ? <>
            <div className="categoryAutoRoute span2"><Tags size={20}/><div><strong>Automatic category</strong><span>{editing.category || editing.assetType || 'eBay will use the item type and product identifier'}</span><small>{editing.ebayCategoryId ? `Leaf category ${editing.ebayCategoryId}` : editing.assetBarcode ? `Routed from ${editing.assetBarcode}` : 'Confirm an exception below only when the automatic category is not right.'}</small></div></div>
            <label className="span2">Category Route<select value={selectedCategoryRoute(editing)} onChange={(event) => selectListingCategory(event.target.value)}><option value="auto">Automatic for this item</option>{EBAY_CATEGORY_CHOICES.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}{choice.requiresLeafSelection ? ' — choose leaf category next' : ''}</option>)}</select><small>Books, movies, games, CDs, and cards route automatically. Clothing and general merchandise need a more specific leaf category.</small></label>
            <details className="advancedListingOptions span2"><summary>Choose a different eBay category</summary><div className="advancedListingBody"><EbayCategoryFinder query={[editing.title, editing.assetType, editing.mediaFormat].filter(Boolean).join(' ')} selectedCategoryId={editing.ebayCategoryId} onSelect={(suggestion) => patchEditing({ category: suggestion.categoryPath, ebayCategoryId: suggestion.categoryId })}/></div></details>
            <div className="span2"><EbayCategoryAspects categoryId={editing.ebayCategoryId} marketplaceId={ebaySettings.marketplaceId || 'EBAY_US'} itemSpecifics={editing.itemSpecifics} onChange={(itemSpecifics) => patchEditing({ itemSpecifics })} onMissingRequiredChange={setTaxonomyMissingAspects}/></div>
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
              <div className="photoChecklist span2"><div><strong>{photoChecklistFor(editing).recommendedCount} recommended photos</strong><small>{editing.actualPhotoCount || 0} actual item photos saved</small></div><ul>{photoChecklistFor(editing).shots.map((shot, index) => <li key={shot} className={index < (editing.actualPhotoCount || 0) ? 'complete' : ''}>{index < (editing.actualPhotoCount || 0) ? <CheckCircle2 size={14}/> : <Camera size={14}/>} {shot}</li>)}</ul></div>
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
            <details className="advancedListingOptions span2 payloadReview" open><summary>Review the exact eBay payload</summary><div className="advancedListingBody"><EbayPayloadPreview listing={{
              ...editing,
              paymentPolicyId: ebaySettings.paymentPolicyId,
              returnPolicyId: ebaySettings.returnPolicyId,
              inventoryLocationKey: ebaySettings.merchantLocationKey,
              photoUrls: [editing.photoUrl, editing.ebayImageUrl].filter(Boolean),
            }}/></div></details>
            </> : null}
          </div>
          {editorStep === 'price' ? <details className="listingActivity"><summary>Listing activity</summary><div><strong>FlipTracker and eBay lifecycle changes</strong></div>{listingActivity === undefined ? <p>Loading activity...</p> : listingActivity.length ? <ol>{listingActivity.slice(0, 8).map((event) => <li key={event._id}><span>{event.message || event.eventType}</span><small>{event.source} · {new Date(event.createdAt).toLocaleString()}</small></li>)}</ol> : <p>No activity has been recorded for this older listing yet.</p>}</details> : null}
          {listingSaveError ? <p className="formError listingSaveError">{listingSaveError}</p> : null}
          <div className="listingFactoryFooter"><button className="secondary" disabled={listingSaveBusy} onClick={() => { setEditing(null); setExceptionWorkflow(false); }}>Cancel</button><div className="actions">{editorStep !== 'details' ? <button className="secondary" disabled={listingSaveBusy} onClick={() => setEditorStep(LISTING_EDITOR_STEPS[Math.max(0, LISTING_EDITOR_STEPS.findIndex((step) => step.id === editorStep) - 1)].id)}>Back</button> : null}{editorStep !== 'price' ? <button disabled={listingSaveBusy} onClick={() => setEditorStep(LISTING_EDITOR_STEPS[Math.min(LISTING_EDITOR_STEPS.length - 1, LISTING_EDITOR_STEPS.findIndex((step) => step.id === editorStep) + 1)].id)}>Continue</button> : <button disabled={listingSaveBusy} onClick={save}><Save size={16}/> {listingSaveBusy ? 'Updating...' : exceptionWorkflow ? 'Save & Next' : editing.platform === 'eBay' && editing.status === 'Active' && editing.externalListingId ? 'Save & Update eBay' : 'Save Listing'}</button>}</div></div>
        </section></div>
      ) : null}
    </>
  );
}
