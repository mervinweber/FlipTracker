export type ListingFamily = 'book' | 'movie' | 'game' | 'card' | 'clothing' | 'general';

export type ListingSpeedPreset = {
  condition?: string;
  completeness?: string;
  shippingPreset?: string;
  fulfillmentPolicyId?: string;
  imageMode?: string;
  descriptionTemplate?: string;
  feePercent?: number;
  minimumProfit?: number;
};

export type ListingSpeedPresets = Partial<Record<ListingFamily, ListingSpeedPreset>>;

const STORAGE_KEY = 'fliptrackerListingSpeedPresetsV1';

function compact(value?: string | null) {
  return (value || '').toLowerCase();
}

export function listingFamily(item: { assetType?: string | null; mediaFormat?: string | null; title?: string | null }): ListingFamily {
  const identity = compact(`${item.assetType || ''} ${item.mediaFormat || ''} ${item.title || ''}`);
  if (/\bbook\b|isbn/.test(identity)) return 'book';
  if (/dvd|blu[ -]?ray|movie|cd|music/.test(identity)) return 'movie';
  if (/video game|\bgame\b|playstation|xbox|nintendo/.test(identity)) return 'game';
  if (/card|tcg|ccg|pokemon|pokémon|yu-gi-oh|yugioh/.test(identity)) return 'card';
  if (/clothing|apparel|shirt|pants|jeans|dress|jacket|coat|sweater|hoodie|shoe|boot/.test(identity)) return 'clothing';
  return 'general';
}

export function loadListingSpeedPresets(storage: Pick<Storage, 'getItem'> = localStorage): ListingSpeedPresets {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as ListingSpeedPresets : {};
  } catch {
    return {};
  }
}

export function saveListingSpeedPreset(
  family: ListingFamily,
  preset: ListingSpeedPreset,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
) {
  const current = loadListingSpeedPresets(storage);
  const next = { ...current, [family]: { ...current[family], ...preset } };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function listingSpeedPresetFor(
  item: { assetType?: string | null; mediaFormat?: string | null; title?: string | null },
  presets = loadListingSpeedPresets(),
) {
  return presets[listingFamily(item)];
}

export function renderListingTemplate(
  template: string | undefined,
  listing: {
    title?: string | null;
    condition?: string | null;
    mediaFormat?: string | null;
    assetType?: string | null;
    sku?: string | null;
    completeness?: string | null;
  },
) {
  if (!template?.trim()) return undefined;
  const values: Record<string, string> = {
    title: listing.title?.trim() || '',
    condition: listing.condition?.trim() || '',
    format: listing.mediaFormat?.trim() || listing.assetType?.trim() || '',
    sku: listing.sku?.trim() || '',
    completeness: listing.completeness?.trim() || '',
  };
  return template.replace(/\{(title|condition|format|sku|completeness)\}/gi, (_match, token: string) => values[token.toLowerCase()] || '').replace(/[ \t]+\n/g, '\n').trim();
}

export function applyListingSpeedPreset<T extends {
  assetType?: string | null;
  mediaFormat?: string | null;
  title?: string | null;
  condition?: string;
  completeness?: string;
  description?: string;
  shippingPreset?: string;
  fulfillmentPolicyId?: string;
  imageMode?: string;
}>(listing: T, presets: ListingSpeedPresets): T {
  const preset = presets[listingFamily(listing)];
  if (!preset) return listing;
  const condition = listing.condition || preset.condition;
  const completeness = listing.completeness || preset.completeness;
  const templateContext = { ...listing, condition, completeness };
  return {
    ...listing,
    condition,
    completeness,
    description: listing.description || renderListingTemplate(preset.descriptionTemplate, templateContext),
    shippingPreset: listing.shippingPreset || preset.shippingPreset,
    fulfillmentPolicyId: listing.fulfillmentPolicyId || preset.fulfillmentPolicyId,
    imageMode: listing.imageMode || preset.imageMode,
  };
}
