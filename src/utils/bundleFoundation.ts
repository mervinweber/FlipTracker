export type BundleFoundationInput = {
  title?: string;
  currentPrice?: number;
  listedPrice?: number;
  purchasePrice?: number;
  actualPhotoCount?: number;
  bundleCount?: number;
  bundleTitles?: string[];
  bundleMembers?: Array<{
    title: string;
    purchasePrice?: number;
    barcode?: string;
  }>;
  bundleCostMissingCount?: number;
};

export type BundleFoundationSummary = {
  isBundle: boolean;
  count: number;
  titleSummary: string;
  costTotal: number;
  missingCostCount: number;
  photoCount: number;
  price?: number;
  issues: string[];
};

export function summarizeBundleTitles(titles: string[] | undefined, visibleCount = 3) {
  const cleaned = (titles || []).map((title) => title.trim()).filter(Boolean);
  if (!cleaned.length) return '';
  const visible = cleaned.slice(0, visibleCount).join(' | ');
  const remaining = cleaned.length - visibleCount;
  return remaining > 0 ? `${visible} | +${remaining} more` : visible;
}

export function summarizeBundleFoundation(listing: BundleFoundationInput): BundleFoundationSummary {
  const members = listing.bundleMembers || [];
  const count = listing.bundleCount || members.length || 0;
  const isBundle = count > 1;
  const costTotal = isBundle
    ? members.reduce((sum, member) => sum + (member.purchasePrice || 0), 0)
    : listing.purchasePrice || 0;
  const missingCostCount = isBundle
    ? listing.bundleCostMissingCount ?? members.filter((member) => member.purchasePrice === undefined).length
    : 0;
  const photoCount = listing.actualPhotoCount || 0;
  const price = listing.currentPrice ?? listing.listedPrice;
  const issues: string[] = [];

  if (isBundle && missingCostCount > 0) issues.push(`${missingCostCount} member cost${missingCostCount === 1 ? '' : 's'} missing`);
  if (isBundle && photoCount === 0) issues.push('No actual photos attached');
  if (isBundle && (!price || price <= 0)) issues.push('Bundle price not set');
  if (isBundle && (listing.title || '').trim().length > 80) issues.push('eBay title is over 80 characters');

  return {
    isBundle,
    count,
    titleSummary: summarizeBundleTitles(listing.bundleTitles || members.map((member) => member.title)),
    costTotal,
    missingCostCount,
    photoCount,
    price,
    issues,
  };
}
