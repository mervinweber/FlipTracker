import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Camera, CheckCircle2, CloudUpload, DollarSign, Download, ExternalLink, KeyRound, Link, LogOut, MapPin, Package, Pencil, RefreshCw, Rocket, Save, Search, Send, Settings, ShieldCheck, Trash2, Truck, Upload, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ListingPhotoManager from './ListingPhotoManager';

type Listing = {
  _id: Id<'marketplaceListings'>;
  assetId: Id<'assets'>;
  platform: string;
  status: string;
  sku?: string;
  externalListingId?: string;
  listingUrl?: string;
  title: string;
  description?: string;
  category?: string;
  condition?: string;
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
  assetTitle: string;
  assetType?: string;
  assetBarcode?: string;
  mediaFormat?: string;
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

type EbaySetup = {
  connected: boolean;
  environment: 'sandbox' | 'production';
  connectedAt?: number;
  settings: Record<string, string | undefined>;
  policies: {
    fulfillment: { id: string; name: string }[];
    payment: { id: string; name: string }[];
    returns: { id: string; name: string }[];
  };
  locations: { key: string; name: string }[];
  warning?: string;
};

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
  otherCategoryId: string;
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
  otherCategoryId: '',
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
const SHIPPING_PRESETS = {
  'Single Media Mailer': { packageType: 'PACKAGE_THICK_ENVELOPE', packageWeightOz: 8, packageLengthIn: 10, packageWidthIn: 7, packageHeightIn: 1 },
  '2-4 Media Mailer': { packageType: 'PARCEL_OR_PADDED_ENVELOPE', packageWeightOz: 32, packageLengthIn: 10, packageWidthIn: 8, packageHeightIn: 3 },
  'Media Box': { packageType: 'MAILING_BOX', packageWeightOz: 64, packageLengthIn: 12, packageWidthIn: 10, packageHeightIn: 6 },
} as const;

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

function queueStatus(listing: Listing) {
  if (listing.externalListingId || listing.status === 'Active') return 'Published';
  if (listing.ebayOfferId || ['eBay Draft Created', 'eBay Offer Staged'].includes(listing.pricingStatus || '')) return 'Staged for eBay';
  if (!['Draft', 'Pending'].includes(listing.status)) return listing.status;
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

function canUseCatalogImage(listing: Pick<Listing, 'assetType' | 'mediaFormat' | 'photoUrl' | 'condition' | 'hasCatalogIdentifier'>) {
  return (isNewCondition(listing.condition) && Boolean(listing.hasCatalogIdentifier))
    || (isBookListing(listing) && Boolean(listing.photoUrl));
}

function defaultPackageWeightOz(listing: Pick<Listing, 'assetType' | 'mediaFormat'>) {
  const format = `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase();
  if (format.includes('cd') || format.includes('music')) return 6;
  if (format.includes('dvd') || format.includes('blu') || format.includes('game')) return 8;
  return 16;
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

export default function ListingsPanel() {
  const listings = useQuery(api.listings.list) as Listing[] | undefined;
  const stats = useQuery(api.listings.stats);
  const updateListing = useMutation(api.listings.update);
  const removeListing = useMutation(api.listings.remove);
  const importSalesTracker = useMutation(api.listings.importSalesTracker);
  const applyQueuePricing = useMutation(api.listings.applyQueuePricing);
  const beginEbayOauth = useAction(api.ebay.beginOauth);
  const loadEbaySetup = useAction(api.ebay.loadSetup);
  const saveEbaySettings = useAction(api.ebay.saveSettings);
  const createInventoryLocation = useAction(api.ebay.createInventoryLocation);
  const ensureMediaMailPolicy = useAction(api.ebay.ensureMediaMailPolicy);
  const provisionSandboxDefaults = useAction(api.ebay.provisionSandboxDefaults);
  const lookupActivePricing = useAction(api.ebay.lookupActivePricing);
  const createEbayOffer = useAction(api.ebay.createUnpublishedOffer);
  const publishEbayOffer = useAction(api.ebay.publishOffer);
  const [editing, setEditing] = useState<Listing | null>(null);
  const markEditingPhotoReady = useCallback(() => {
    setEditing((current) => current && !current.hasActualPhoto ? { ...current, hasActualPhoto: true } : current);
  }, []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey') || '');
  const [rememberSellerKey, setRememberSellerKey] = useState(() => Boolean(localStorage.getItem('fliptrackerRememberedSellerKey')));
  const autoLoadSellerSetup = useRef(Boolean(localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey')));
  const autoLoadAttempted = useRef(false);
  const [ebaySetup, setEbaySetup] = useState<EbaySetup | null>(null);
  const [ebaySettings, setEbaySettings] = useState<EbaySettings>(EMPTY_EBAY_SETTINGS);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState<Id<'marketplaceListings'> | null>(null);
  const [ebayNotice, setEbayNotice] = useState('');
  const [ebayError, setEbayError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'marketplaceListings'>>>(new Set());
  const [pricingRows, setPricingRows] = useState<PricingRow[] | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [sandboxSetup, setSandboxSetup] = useState(EMPTY_SANDBOX_SETUP);

  useEffect(() => {
    if (!editing && !pricingRows) return;
    document.body.classList.add('modalOpen');
    return () => document.body.classList.remove('modalOpen');
  }, [editing, pricingRows]);

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
    return (listings || []).filter((listing) => {
      const matchesQuery = !normalized || `${listing.title} ${listing.assetTitle} ${listing.sku || ''} ${listing.externalListingId || ''}`.toLowerCase().includes(normalized);
      return matchesQuery && (status === 'All' || listing.status === status) && (platform === 'All' || listing.platform === platform);
    });
  }, [listings, platform, query, status]);

  const queueListings = useMemo(() => filtered.filter((listing) => listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status)), [filtered]);
  const selectedListings = useMemo(() => (listings || []).filter((listing) => selectedIds.has(listing._id)), [listings, selectedIds]);
  const selectedReadyForEbay = useMemo(() => selectedListings.filter((listing) => queueStatus(listing) === 'Ready for eBay'), [selectedListings]);
  const sellerDefaultsReady = Boolean(
    ebaySettings.merchantLocationKey
    && ebaySettings.fulfillmentPolicyId
    && ebaySettings.paymentPolicyId
    && ebaySettings.returnPolicyId,
  );

  function patchEditing(patch: Partial<Listing>) {
    setEditing((current) => current ? { ...current, ...patch } : current);
  }

  function openListingEditor(listing: Listing) {
    const condition = listing.condition?.trim().toLowerCase() || '';
    const isBookWithCover = `${listing.assetType || ''} ${listing.mediaFormat || ''}`.toLowerCase().includes('book') && Boolean(listing.photoUrl);
    const imageMode = listing.imageMode || (["new", "brand new", "sealed"].includes(condition) || isBookWithCover ? 'eBay Catalog' : 'Actual Item Photo');
    setEditing({
      ...listing,
      imageMode,
      packageType: listing.packageType || 'PACKAGE_THICK_ENVELOPE',
      packageWeightOz: listing.packageWeightOz ?? defaultPackageWeightOz(listing),
    });
  }

  function selectShippingPreset(value: string) {
    if (value === 'Custom') {
      patchEditing({ shippingPreset: value });
      return;
    }
    if (!value) {
      patchEditing({
        shippingPreset: undefined,
        packageType: undefined,
        packageWeightOz: undefined,
        packageLengthIn: undefined,
        packageWidthIn: undefined,
        packageHeightIn: undefined,
      });
      return;
    }
    patchEditing({ shippingPreset: value, ...SHIPPING_PRESETS[value as keyof typeof SHIPPING_PRESETS] });
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
    setEbayError('');
    setEbayNotice('Seller access was removed from this device. The eBay authorization stored in Convex was not revoked.');
  }

  function applyEbaySetup(setup: EbaySetup) {
    setEbaySetup(setup);
    setEbaySettings({
      marketplaceId: setup.settings.marketplaceId || 'EBAY_US',
      currency: setup.settings.currency || 'USD',
      merchantLocationKey: setup.settings.merchantLocationKey || '',
      fulfillmentPolicyId: setup.settings.fulfillmentPolicyId || '',
      paymentPolicyId: setup.settings.paymentPolicyId || '',
      returnPolicyId: setup.settings.returnPolicyId || '',
      dvdCategoryId: setup.settings.dvdCategoryId || '',
      blurayCategoryId: setup.settings.blurayCategoryId || '',
      bookCategoryId: setup.settings.bookCategoryId || '',
      cdCategoryId: setup.settings.cdCategoryId || '',
      gameCategoryId: setup.settings.gameCategoryId || '',
      otherCategoryId: setup.settings.otherCategoryId || '',
    });
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
        otherCategoryId: optionalText(ebaySettings.otherCategoryId),
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
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of queueIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
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
      const liveResults = await lookupActivePricing({
        adminKey,
        listingIds: baseRows.map((row) => row.listingId),
      }) as ActivePricingResult[];
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
      status: editing.status,
      sku: editing.sku || undefined,
      externalListingId: editing.externalListingId || undefined,
      listingUrl: editing.listingUrl || undefined,
      title: editing.title.trim(),
      description: editing.description || undefined,
      category: editing.category || undefined,
      condition: editing.condition || undefined,
      itemSpecifics: editing.itemSpecifics || undefined,
      listedPrice: editing.listedPrice,
      currentPrice: editing.currentPrice,
      soldPrice,
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
    const headers = ['Platform', 'Title', 'SKU', 'Status', 'Listed Price', 'Current Price', 'Sold Price', 'Listed Date', 'Sold Date', 'Shipping Charged', 'Shipping Cost', 'Fees', 'Net Profit', 'URL'];
    const rows = filtered.map((listing) => [
      listing.platform, listing.title, listing.sku || '', listing.status, listing.listedPrice || '', listing.currentPrice || '', listing.soldPrice || '',
      listing.listedDate || '', listing.soldDate || '', listing.shippingCharged || '', listing.shippingCost || '', listing.fees || '',
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
        <div className="metric"><span>Active Listings</span><strong>{stats?.activeCount ?? '-'}</strong></div>
        <div className="metric"><span>Active Value</span><strong>{stats ? money(stats.activeValue) : '-'}</strong></div>
        <div className="metric"><span>Sold Revenue</span><strong>{stats ? money(stats.soldRevenue) : '-'}</strong></div>
        <div className="metric"><span>Avg. Days To Sell</span><strong>{stats ? stats.averageDaysToSell.toFixed(1) : '-'}</strong></div>
      </section>

      <section className="panel listingQueueBar">
        <div className="queueSummary">
          <div><p className="eyebrow">Listing queue</p><h2>Select, price, stage, then publish</h2><p>{queueListings.length} Draft/Pending in this view · {selectedIds.size} selected · {selectedReadyForEbay.length} selected and ready</p></div>
          <div className="queueSteps" aria-label="Listing queue stages"><span>1. Select</span><span>2. Find Fair Value</span><span>3. Stage with eBay</span><span>4. Publish</span></div>
        </div>
        <div className="actions queueActions">
          <button className="secondary" disabled={!queueListings.length || queueBusy} onClick={toggleQueueView}><CheckCircle2 size={16}/> {queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id)) ? 'Clear View' : 'Select Queue'}</button>
          <button disabled={!selectedIds.size || queueBusy} onClick={openPricingReview}><DollarSign size={16}/> {queueBusy ? 'Checking eBay...' : 'Find Fair Value'}</button>
          <button className="ebaySendButton" disabled={!selectedReadyForEbay.length || queueBusy || !sellerDefaultsReady} onClick={sendSelectedToEbay}><Send size={16}/> {queueBusy ? 'Working...' : `Stage with eBay${selectedReadyForEbay.length ? ` (${selectedReadyForEbay.length})` : ''}`}</button>
        </div>
        {ebayNotice ? <p className="setupNotice successNotice">{ebayNotice}</p> : null}
        {ebayError ? <p className="setupNotice errorNotice">{ebayError}</p> : null}
      </section>

      <section className="panel ebaySetupPanel">
        <div className="panelHeader">
          <div><h2>eBay Seller Connection</h2><p>Authorize one seller account, choose its policies, then stage and publish offers from FlipTracker.</p></div>
          {ebaySetup?.connected ? <span className="statusPill ebayConnected"><ShieldCheck size={14}/> Connected · {ebaySetup.environment}</span> : <span className="statusPill"><KeyRound size={14}/> Seller only</span>}
        </div>
        {!ebaySetup?.connected ? (
          <div className="ebayUnlockRow">
            <div className="sellerKeyField">
              <label>Seller Access Key<input type="password" autoComplete="off" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Enter the private beta seller key"/></label>
              <label className="rememberSellerKey" title="Stores the beta seller key in this browser only"><input type="checkbox" checked={rememberSellerKey} onChange={(event) => changeRememberSellerKey(event.target.checked)}/> Remember on this device</label>
            </div>
            <button className="secondary" disabled={!adminKey || ebayBusy} onClick={unlockEbaySetup}><Settings size={16}/> {ebayBusy ? 'Loading...' : 'Load Setup'}</button>
            <button disabled={!adminKey || ebayBusy} onClick={connectEbay}><Link size={16}/> Connect eBay</button>
          </div>
        ) : null}
        {ebaySetup?.connected ? (
          <div className="ebaySettingsGrid">
            <label>Inventory Location<select value={ebaySettings.merchantLocationKey} onChange={(event) => setEbaySettings((current) => ({ ...current, merchantLocationKey: event.target.value }))}><option value="">Choose location</option>{ebaySetup.locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}</select></label>
            <label>Shipping Policy<select value={ebaySettings.fulfillmentPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, fulfillmentPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.fulfillment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <label>Payment Policy<select value={ebaySettings.paymentPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, paymentPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.payment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <label>Return Policy<select value={ebaySettings.returnPolicyId} onChange={(event) => setEbaySettings((current) => ({ ...current, returnPolicyId: event.target.value }))}><option value="">Choose policy</option>{ebaySetup.policies.returns.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <label>DVD Category ID<input inputMode="numeric" value={ebaySettings.dvdCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, dvdCategoryId: event.target.value }))}/></label>
            <label>Blu-ray Category ID<input inputMode="numeric" value={ebaySettings.blurayCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, blurayCategoryId: event.target.value }))}/></label>
            <label>Book Category ID<input inputMode="numeric" value={ebaySettings.bookCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, bookCategoryId: event.target.value }))}/></label>
            <label>CD Category ID<input inputMode="numeric" value={ebaySettings.cdCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, cdCategoryId: event.target.value }))}/></label>
            <label>Game Category ID<input inputMode="numeric" value={ebaySettings.gameCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, gameCategoryId: event.target.value }))}/></label>
            <label>Other Media Category ID<input inputMode="numeric" value={ebaySettings.otherCategoryId} onChange={(event) => setEbaySettings((current) => ({ ...current, otherCategoryId: event.target.value }))}/></label>
            <label>Media Mail Buyer Charge<input type="number" min="0" step="0.01" value={sandboxSetup.mediaMailCost} onChange={(event) => setSandboxSetup((current) => ({ ...current, mediaMailCost: event.target.value }))}/></label>
            <div className="actions ebaySetupActions"><button className="secondary" disabled={ebayBusy} onClick={unlockEbaySetup}><RefreshCw size={16}/> Refresh eBay Data</button><button className="secondary" disabled={ebayBusy || Number(sandboxSetup.mediaMailCost) < 0} onClick={() => createMediaMailPolicy()}><Truck size={16}/> Create/Select Media Mail</button><button disabled={ebayBusy} onClick={saveSetup}><Save size={16}/> Save Draft Defaults</button><button className="secondary forgetDeviceButton" disabled={ebayBusy} onClick={forgetSellerDevice}><LogOut size={16}/> Forget Device</button></div>
          </div>
        ) : null}
        {ebaySetup?.connected && ebaySetup.environment === 'production' && !ebaySetup.locations.length ? (
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
        {ebaySetup?.connected && ebaySetup.environment === 'sandbox' && !sellerDefaultsReady ? (
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
        <p className="ebaySafetyNote">Staged Inventory API offers do not appear in Seller Hub Drafts. Review every field in FlipTracker, then use Publish to eBay to create the live listing.</p>
      </section>

      <section className="panel listingControls">
        <div className="searchWrap"><Search size={16}/><input className="search" placeholder="Search listings..." value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>{['All', ...STATUSES].map((value) => <option key={value}>{value}</option>)}</select>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)}>{['All', ...PLATFORMS].map((value) => <option key={value}>{value}</option>)}</select>
        <div className="actions listingTools"><label className="button secondary"><Upload size={16}/> Import Old JSON<input type="file" accept="application/json,.json" hidden onChange={importOldJson}/></label><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div>
      </section>

      <section className="panel inventoryPanel">
        <div className="panelHeader"><div><h2>Marketplace Listings</h2><p>{listings === undefined ? 'Loading Convex data...' : `${filtered.length} listing${filtered.length === 1 ? '' : 's'} in this view`}</p></div></div>
        {listings === undefined ? <p className="panelMessage">Loading listings...</p> : filtered.length === 0 ? <div className="empty"><h2>No listings found</h2><p>Create a draft from an item in Inventory, then track it through sale.</p></div> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th className="selectColumn"><input type="checkbox" aria-label="Select all queued listings in view" checked={queueListings.length > 0 && queueListings.every((listing) => selectedIds.has(listing._id))} onChange={toggleQueueView}/></th><th>Platform</th><th>Title</th><th>Queue</th><th>Status</th><th>Price</th><th>Location</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((listing) => (
                <tr key={listing._id}>
                  <td className="selectColumn">{listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) ? <input type="checkbox" aria-label={`Select ${listing.title}`} checked={selectedIds.has(listing._id)} onChange={() => toggleSelected(listing._id)}/> : null}</td>
                  <td><span className="consoleTag">{listing.platform}</span></td>
                  <td><strong>{listing.title}</strong><small>{listing.assetTitle}{listing.sku ? ` · SKU ${listing.sku}` : ''}</small></td>
                  <td><span className={`queueBadge ${queueStatus(listing).toLowerCase().replace(/\s+/g, '-')}`}>{queueStatus(listing)}</span>{listing.pricingSource ? <small>{listing.pricingSource}</small> : null}</td>
                  <td><span className={`badge ${listing.status.toLowerCase()}`}>{listing.status}</span>{listing.ebayDraftStatus ? <small className="ebayDraftMeta">eBay: {listing.ebayDraftStatus}</small> : null}{listing.ebayLastError ? <small className="ebayDraftError">{listing.ebayLastError}</small> : null}</td>
                  <td className="valueCell">{money(listing.status === 'Sold' ? listing.soldPrice : listing.currentPrice ?? listing.listedPrice)}</td>
                  <td>{listing.storageLocation || ''}</td>
                  <td className="tableActionsCell"><div className="rowActions">
                    {listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && queueStatus(listing) === 'Ready for eBay' ? <button className="iconButton ebayUploadButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} aria-label={`Stage ${listing.title} with eBay`} title={!sellerDefaultsReady ? 'Complete eBay Seller Connection first' : 'Stage offer with eBay'} onClick={() => sendToEbay(listing)}><CloudUpload size={16}/></button> : null}
                    {listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && Boolean(listing.ebayOfferId) ? <button className="iconButton ebayPublishButton" disabled={offerBusy === listing._id || queueBusy || !sellerDefaultsReady} aria-label={`Publish ${listing.title} on eBay`} title="Review and publish live on eBay" onClick={() => publishToEbay(listing)}><Rocket size={16}/></button> : null}
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

      {editing ? (
        <div className="modalBackdrop"><section className="modal wideModal">
          <header className="modalHeader"><div><h2>Edit Marketplace Listing</h2><span className="statusPill">{editing.assetTitle}</span></div><button className="iconButton secondary" aria-label="Close" onClick={() => setEditing(null)}><X size={18}/></button></header>
          <div className="formGrid">
            <label>Platform<select value={editing.platform} onChange={(event) => patchEditing({ platform: event.target.value })}>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={editing.status} onChange={(event) => patchEditing({ status: event.target.value })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="span2">Listing Title<input value={editing.title} onChange={(event) => patchEditing({ title: event.target.value })}/></label>
            <label>SKU<input value={editing.sku || ''} onChange={(event) => patchEditing({ sku: event.target.value })}/></label>
            <label>Marketplace Item ID<input value={editing.externalListingId || ''} onChange={(event) => patchEditing({ externalListingId: event.target.value })}/></label>
            <label className="span2">Listing URL<input type="url" value={editing.listingUrl || ''} onChange={(event) => patchEditing({ listingUrl: event.target.value })}/></label>
            <label>Category<input value={editing.category || ''} onChange={(event) => patchEditing({ category: event.target.value })}/></label>
            <label>eBay Category ID<input inputMode="numeric" value={editing.ebayCategoryId || ''} onChange={(event) => patchEditing({ ebayCategoryId: event.target.value })}/></label>
            <label>Condition<input value={editing.condition || ''} onChange={(event) => patchEditing({ condition: event.target.value, imageMode: isNewCondition(event.target.value) || (isBookListing(editing) && Boolean(editing.photoUrl)) ? editing.imageMode : 'Actual Item Photo' })}/></label>
            <div className="formSection span2 ebayDeliverySection"><h3><Package size={17}/> Shipping & Photos</h3><div className="sectionGrid">
              <label>eBay Shipping Policy<select value={editing.fulfillmentPolicyId || ''} onChange={(event) => patchEditing({ fulfillmentPolicyId: event.target.value || undefined })}>
                <option value="">Use seller default</option>
                {editing.fulfillmentPolicyId && !ebaySetup?.policies.fulfillment.some((policy) => policy.id === editing.fulfillmentPolicyId) ? <option value={editing.fulfillmentPolicyId}>Saved policy ({editing.fulfillmentPolicyId})</option> : null}
                {ebaySetup?.policies.fulfillment.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
              </select><small>The fulfillment policy controls services, handling time, and buyer shipping charges.</small></label>
              {isBookListing(editing) || /dvd|blu|cd|music/i.test(`${editing.assetType || ''} ${editing.mediaFormat || ''}`) ? <div className="shippingPolicyHelper"><button type="button" className="secondary" disabled={ebayBusy} onClick={() => createMediaMailPolicy(true)}><Truck size={16}/> Use Media Mail</button><small>Creates or selects a USPS Media Mail policy. Save this listing afterward. Video games are not Media Mail eligible.</small></div> : null}
              <label>Package Preset<select value={editing.shippingPreset || 'Custom'} onChange={(event) => selectShippingPreset(event.target.value)}><option value="">No package data</option>{Object.keys(SHIPPING_PRESETS).map((name) => <option key={name}>{name}</option>)}<option>Custom</option></select></label>
              <label>Package Type<select value={editing.packageType || ''} onChange={(event) => patchEditing({ packageType: event.target.value || undefined, shippingPreset: 'Custom' })}><option value="">Not specified</option><option value="PACKAGE_THICK_ENVELOPE">Thick envelope</option><option value="PARCEL_OR_PADDED_ENVELOPE">Parcel or padded envelope</option><option value="MAILING_BOX">Mailing box</option></select></label>
              <label>Weight (oz)<input type="number" min="0.1" step="0.1" value={editing.packageWeightOz ?? ''} onChange={(event) => patchEditing({ packageWeightOz: optionalNumber(event.target.value), shippingPreset: 'Custom' })}/></label>
              <label>Length (in)<input type="number" min="0.1" step="0.1" value={editing.packageLengthIn ?? ''} onChange={(event) => patchEditing({ packageLengthIn: optionalNumber(event.target.value), shippingPreset: 'Custom' })}/></label>
              <label>Width (in)<input type="number" min="0.1" step="0.1" value={editing.packageWidthIn ?? ''} onChange={(event) => patchEditing({ packageWidthIn: optionalNumber(event.target.value), shippingPreset: 'Custom' })}/></label>
              <label>Height (in)<input type="number" min="0.1" step="0.1" value={editing.packageHeightIn ?? ''} onChange={(event) => patchEditing({ packageHeightIn: optionalNumber(event.target.value), shippingPreset: 'Custom' })}/></label>
              <label>eBay Image Source<select value={editing.imageMode || 'Actual Item Photo'} onChange={(event) => patchEditing({ imageMode: event.target.value })}><option>Actual Item Photo</option><option disabled={!canUseCatalogImage(editing)}>eBay Catalog</option></select><small>{isBookListing(editing) && editing.photoUrl ? 'The metadata cover can be used as the stock image for this book.' : isNewCondition(editing.condition) ? 'Catalog matching uses the UPC/EAN/ISBN.' : 'Used discs remain flagged for an actual photo.'}</small></label>
              <div className={`photoReadiness ${editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? 'ready' : 'missing' : editing.hasActualPhoto ? 'ready' : 'missing'}`}><Camera size={18}/><div><strong>{editing.imageMode === 'eBay Catalog' ? canUseCatalogImage(editing) ? isBookListing(editing) ? 'Stock book cover ready' : 'Catalog identifier ready' : 'Catalog image unavailable' : editing.hasActualPhoto ? 'Actual photo ready' : 'Actual photo required'}</strong><small>{editing.ebayImageSource ? `Last eBay image: ${editing.ebayImageSource}` : 'Photo selection comes from the linked inventory item.'}</small></div></div>
              <ListingPhotoManager assetId={editing.assetId} title={editing.title} onPhotoAttached={markEditingPhotoReady}/>
            </div></div>
            <div className="formSection span2"><h3>Pricing & Dates</h3><div className="sectionGrid">
              <label>Original Price<input type="number" step="0.01" value={editing.listedPrice ?? ''} onChange={(event) => patchEditing({ listedPrice: optionalNumber(event.target.value) })}/></label>
              <label>Current Price<input type="number" step="0.01" value={editing.currentPrice ?? ''} onChange={(event) => patchEditing({ currentPrice: optionalNumber(event.target.value) })}/></label>
              <label>Price Change Reason<input value={priceChangeReason} onChange={(event) => setPriceChangeReason(event.target.value)} placeholder="Sale, markdown, relist..."/></label>
              <label>Listed Date<input type="date" value={editing.listedDate || ''} onChange={(event) => patchEditing({ listedDate: event.target.value })}/></label>
              <label>Sold Price<input type="number" step="0.01" value={editing.soldPrice ?? ''} onChange={(event) => patchEditing({ soldPrice: optionalNumber(event.target.value) })}/></label>
              <label>Sold Date<input type="date" value={editing.soldDate || ''} onChange={(event) => patchEditing({ soldDate: event.target.value })}/></label>
              <label>Shipping Charged<input type="number" step="0.01" value={editing.shippingCharged ?? ''} onChange={(event) => patchEditing({ shippingCharged: optionalNumber(event.target.value) })}/></label>
              <label>Actual Shipping Cost<input type="number" step="0.01" value={editing.shippingCost ?? ''} onChange={(event) => patchEditing({ shippingCost: optionalNumber(event.target.value) })}/></label>
              <label>Marketplace Fees<input type="number" step="0.01" value={editing.fees ?? ''} onChange={(event) => patchEditing({ fees: optionalNumber(event.target.value) })}/></label>
              <label>Buyer<input value={editing.buyer || ''} onChange={(event) => patchEditing({ buyer: event.target.value })}/></label>
            </div></div>
            <label className="span2">Item Specifics<textarea value={editing.itemSpecifics || ''} onChange={(event) => patchEditing({ itemSpecifics: event.target.value })}/></label>
            <label className="span2">Description<textarea value={editing.description || ''} onChange={(event) => patchEditing({ description: event.target.value })}/></label>
            <label className="span2">Notes<textarea value={editing.notes || ''} onChange={(event) => patchEditing({ notes: event.target.value })}/></label>
            <div className="formSection span2"><h3>Price History</h3><PriceHistory listingId={editing._id}/></div>
          </div>
          <div className="actions right"><button className="secondary" onClick={() => setEditing(null)}>Cancel</button><button onClick={save}><Save size={16}/> Save Listing</button></div>
        </section></div>
      ) : null}
    </>
  );
}
