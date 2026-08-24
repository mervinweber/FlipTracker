export type ListingFamily = 'book' | 'movie' | 'game' | 'card' | 'clothing' | 'general';

export type ListingSpeedPreset = {
  condition?: string;
  shippingPreset?: string;
  fulfillmentPolicyId?: string;
  imageMode?: string;
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

export function applyListingSpeedPreset<T extends {
  assetType?: string | null;
  mediaFormat?: string | null;
  title?: string | null;
  condition?: string;
  shippingPreset?: string;
  fulfillmentPolicyId?: string;
  imageMode?: string;
}>(listing: T, presets: ListingSpeedPresets): T {
  const preset = presets[listingFamily(listing)];
  if (!preset) return listing;
  return {
    ...listing,
    condition: listing.condition || preset.condition,
    shippingPreset: listing.shippingPreset || preset.shippingPreset,
    fulfillmentPolicyId: listing.fulfillmentPolicyId || preset.fulfillmentPolicyId,
    imageMode: listing.imageMode || preset.imageMode,
  };
}

