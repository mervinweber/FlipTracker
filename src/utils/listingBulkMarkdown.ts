export type BulkMarkdownListing = {
  platform: string;
  status: string;
  externalListingId?: string;
  ebayOfferId?: string;
  listedPrice?: number;
  currentPrice?: number;
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
  const nextPrice = charmPricing
    ? Math.max(0.99, Math.ceil(discounted) - 0.01)
    : Math.max(0.99, Math.round(discounted * 100) / 100);
  return nextPrice < currentPrice ? nextPrice : undefined;
}
