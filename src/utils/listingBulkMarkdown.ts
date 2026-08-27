export type BulkMarkdownListing = {
  platform: string;
  status: string;
  externalListingId?: string;
  ebayOfferId?: string;
  listedPrice?: number;
  currentPrice?: number;
  listedDate?: string;
  purchasePrice?: number;
  shippingCharged?: number;
  shippingCost?: number;
};

export type MarkdownStrategy = {
  minimumAgeDays: number;
  percentage: number;
  feePercent: number;
  minimumProfit: number;
  charmPricing: boolean;
};

export type MarkdownAssessment<T extends BulkMarkdownListing> = {
  listing: T;
  ageDays?: number;
  currentPrice: number;
  newPrice?: number;
  estimatedProfit?: number;
  status: 'eligible' | 'too-new' | 'missing-date' | 'profit-protected' | 'invalid-price';
};

export function isFlipTrackerManagedActiveListing(listing: BulkMarkdownListing) {
  return listing.platform === 'eBay'
    && listing.status === 'Active'
    && Boolean(listing.externalListingId)
    && Boolean(listing.ebayOfferId);
}

export function calculateMarkdownPrice(currentPrice: number, percentage: number, charmPricing: boolean) {
  if (!Number.isFinite(currentPrice) || currentPrice < 0.99) return undefined;
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 90) return undefined;
  const discounted = currentPrice * (1 - percentage / 100);
  const exactPrice = Math.max(0.99, Math.round(discounted * 100) / 100);
  const charmPrice = Math.max(0.99, Math.ceil(discounted) - 0.01);
  // A listing already ending in .99 can round back to its current price.
  // Keep the requested percentage reduction in that case instead of excluding it.
  const nextPrice = charmPricing && charmPrice < currentPrice ? charmPrice : exactPrice;
  return nextPrice < currentPrice ? nextPrice : undefined;
}

export function listingAgeDays(listedDate: string | undefined, now = Date.now()) {
  if (!listedDate) return undefined;
  const listedAt = Date.parse(`${listedDate}T00:00:00`);
  if (!Number.isFinite(listedAt)) return undefined;
  return Math.max(0, Math.floor((now - listedAt) / 86_400_000));
}

export function estimatedNetProfit(listing: BulkMarkdownListing, price: number, feePercent: number) {
  const shippingCharged = listing.shippingCharged ?? 0;
  const gross = price + shippingCharged;
  return gross - (gross * feePercent / 100) - (listing.purchasePrice ?? 0) - (listing.shippingCost ?? 0);
}

export function assessMarkdownListing<T extends BulkMarkdownListing>(
  listing: T,
  strategy: MarkdownStrategy,
  now = Date.now(),
): MarkdownAssessment<T> {
  const currentPrice = listing.currentPrice ?? listing.listedPrice ?? 0;
  const ageDays = listingAgeDays(listing.listedDate, now);
  const strategyIsValid = Number.isFinite(strategy.minimumAgeDays)
    && strategy.minimumAgeDays >= 0
    && Number.isFinite(strategy.feePercent)
    && strategy.feePercent >= 0
    && strategy.feePercent <= 50
    && Number.isFinite(strategy.minimumProfit)
    && strategy.minimumProfit >= 0;
  if (!strategyIsValid) return { listing, ageDays, currentPrice, status: 'invalid-price' };
  if (ageDays === undefined) return { listing, currentPrice, status: 'missing-date' };
  if (ageDays < strategy.minimumAgeDays) return { listing, ageDays, currentPrice, status: 'too-new' };
  const newPrice = calculateMarkdownPrice(currentPrice, strategy.percentage, strategy.charmPricing);
  if (newPrice === undefined) return { listing, ageDays, currentPrice, status: 'invalid-price' };
  const estimatedProfit = estimatedNetProfit(listing, newPrice, strategy.feePercent);
  if (!Number.isFinite(estimatedProfit) || estimatedProfit < strategy.minimumProfit) {
    return { listing, ageDays, currentPrice, newPrice, estimatedProfit, status: 'profit-protected' };
  }
  return { listing, ageDays, currentPrice, newPrice, estimatedProfit, status: 'eligible' };
}
