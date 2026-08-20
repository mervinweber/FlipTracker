export type EbayPayloadPreviewListing = Readonly<Record<string, unknown>> & {
  title?: unknown;
  listingTitle?: unknown;
  ebayCategoryId?: unknown;
  categoryId?: unknown;
  category?: unknown;
  condition?: unknown;
  conditionId?: unknown;
  itemSpecifics?: unknown;
  specifics?: unknown;
  description?: unknown;
  listingDescription?: unknown;
  imageUrls?: unknown;
  photoUrls?: unknown;
  photos?: unknown;
  ebayImageUrl?: unknown;
  photoUrl?: unknown;
  currentPrice?: unknown;
  listedPrice?: unknown;
  price?: unknown;
  currency?: unknown;
  packageType?: unknown;
  packageWeightOz?: unknown;
  weightOz?: unknown;
  packageLengthIn?: unknown;
  packageWidthIn?: unknown;
  packageHeightIn?: unknown;
  lengthIn?: unknown;
  widthIn?: unknown;
  heightIn?: unknown;
  fulfillmentPolicyId?: unknown;
  shippingPolicyId?: unknown;
  paymentPolicyId?: unknown;
  returnPolicyId?: unknown;
  inventoryLocationKey?: unknown;
  merchantLocationKey?: unknown;
};

export type EbayPayloadPreviewSpecific = {
  name: string;
  values: string[];
};

export type EbayPayloadPreviewPhoto = {
  url: string;
  label: string;
};

export type EbayPayloadPreviewModel = {
  title: string;
  category: {
    id: string;
    label: string;
  };
  condition: {
    name: string;
    id: string;
  };
  specifics: EbayPayloadPreviewSpecific[];
  description: string;
  photos: EbayPayloadPreviewPhoto[];
  price: {
    amount?: number;
    currency: string;
    formatted: string;
  };
  package: {
    type: string;
    weight: string;
    dimensions: string;
  };
  policies: {
    fulfillment: string;
    payment: string;
    returns: string;
    inventoryLocation: string;
  };
};

const EMPTY_VALUE = 'Not provided';

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) || '';
}

function finiteNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeSpecificValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(text).filter(Boolean);
}

function addSpecific(
  target: Map<string, EbayPayloadPreviewSpecific>,
  rawName: unknown,
  rawValue: unknown,
): void {
  const name = text(rawName);
  const values = normalizeSpecificValues(rawValue);
  if (!name || values.length === 0) return;

  const key = name.toLocaleLowerCase();
  const existing = target.get(key);
  if (!existing) {
    target.set(key, { name, values: [...new Set(values)] });
    return;
  }

  existing.values = [...new Set([...existing.values, ...values])];
}

function parseSpecificObject(value: Record<string, unknown>, target: Map<string, EbayPayloadPreviewSpecific>): void {
  for (const [name, specificValue] of Object.entries(value)) {
    addSpecific(target, name, specificValue);
  }
}

function parseSpecificText(value: string, target: Map<string, EbayPayloadPreviewSpecific>): void {
  const trimmed = value.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parseSpecificObject(parsed as Record<string, unknown>, target);
        return;
      }
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
          const record = entry as Record<string, unknown>;
          addSpecific(target, record.name ?? record.Name, record.values ?? record.value ?? record.Value);
        }
        return;
      }
    } catch {
      // Fall through to line parsing so malformed JSON never breaks the preview.
    }
  }

  for (const line of trimmed.split(/\r?\n|;/)) {
    const separator = line.search(/[:=]/);
    if (separator < 1) continue;
    addSpecific(target, line.slice(0, separator), line.slice(separator + 1));
  }
}

/** Safely converts supported item-specific formats into stable display rows. */
export function parseEbayPayloadSpecifics(value: unknown): EbayPayloadPreviewSpecific[] {
  const specifics = new Map<string, EbayPayloadPreviewSpecific>();

  if (typeof value === 'string') {
    parseSpecificText(value, specifics);
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    parseSpecificObject(value as Record<string, unknown>, specifics);
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      addSpecific(specifics, record.name ?? record.Name, record.values ?? record.value ?? record.Value);
    }
  }

  return [...specifics.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function photoUrl(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const photo = value as Record<string, unknown>;
  return firstText(photo.url, photo.imageUrl, photo.src);
}

function collectPhotos(listing: EbayPayloadPreviewListing): EbayPayloadPreviewPhoto[] {
  const candidates: unknown[] = [];
  for (const source of [listing.imageUrls, listing.photoUrls, listing.photos]) {
    if (Array.isArray(source)) candidates.push(...source);
  }
  candidates.push(listing.ebayImageUrl, listing.photoUrl);

  const uniqueUrls = [...new Set(candidates.map(photoUrl).filter(Boolean))];
  return uniqueUrls.map((url, index) => ({
    url,
    label: index === 0 ? 'Primary photo' : `Photo ${index + 1}`,
  }));
}

function formatMeasurement(value: number | undefined, unit: string): string {
  return value === undefined ? '' : `${value} ${unit}`;
}

function formatPrice(amount: number | undefined, currency: string): string {
  if (amount === undefined) return EMPTY_VALUE;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Builds the exact, network-free view model consumed by EbayPayloadPreview. */
export function buildEbayPayloadPreview(
  listing: EbayPayloadPreviewListing,
): EbayPayloadPreviewModel {
  const categoryId = firstText(listing.ebayCategoryId, listing.categoryId);
  const categoryLabel = text(listing.category);
  const amount = finiteNumber(listing.currentPrice, listing.listedPrice, listing.price);
  const currency = firstText(listing.currency).toUpperCase() || 'USD';
  const weight = finiteNumber(listing.packageWeightOz, listing.weightOz);
  const length = finiteNumber(listing.packageLengthIn, listing.lengthIn);
  const width = finiteNumber(listing.packageWidthIn, listing.widthIn);
  const height = finiteNumber(listing.packageHeightIn, listing.heightIn);
  const dimensions = [length, width, height].every((value) => value !== undefined)
    ? `${length} × ${width} × ${height} in`
    : EMPTY_VALUE;

  return {
    title: firstText(listing.title, listing.listingTitle) || EMPTY_VALUE,
    category: {
      id: categoryId || EMPTY_VALUE,
      label: categoryLabel || EMPTY_VALUE,
    },
    condition: {
      name: firstText(listing.condition) || EMPTY_VALUE,
      id: firstText(listing.conditionId) || EMPTY_VALUE,
    },
    specifics: parseEbayPayloadSpecifics(listing.itemSpecifics ?? listing.specifics),
    description: firstText(listing.description, listing.listingDescription) || EMPTY_VALUE,
    photos: collectPhotos(listing),
    price: {
      amount,
      currency,
      formatted: formatPrice(amount, currency),
    },
    package: {
      type: firstText(listing.packageType) || EMPTY_VALUE,
      weight: formatMeasurement(weight, 'oz') || EMPTY_VALUE,
      dimensions,
    },
    policies: {
      fulfillment: firstText(listing.fulfillmentPolicyId, listing.shippingPolicyId) || EMPTY_VALUE,
      payment: firstText(listing.paymentPolicyId) || EMPTY_VALUE,
      returns: firstText(listing.returnPolicyId) || EMPTY_VALUE,
      inventoryLocation: firstText(listing.inventoryLocationKey, listing.merchantLocationKey) || EMPTY_VALUE,
    },
  };
}

