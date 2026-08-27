export type TodayOperationKind = 'fulfillment' | 'exception' | 'reconcile' | 'ready' | 'stale';

function listingAgeDays(listedDate: string | undefined, now: number) {
  if (!listedDate) return undefined;
  const listedAt = Date.parse(`${listedDate}T00:00:00`);
  if (!Number.isFinite(listedAt)) return undefined;
  return Math.max(0, Math.floor((now - listedAt) / 86_400_000));
}

export type TodayOperationListing = {
  _id: string;
  title: string;
  platform: string;
  status: string;
  listedDate?: string;
  externalListingId?: string;
  ebayOfferId?: string;
  fulfillmentStatus?: string;
  storageLocation?: string;
};

export type TodayOperation = {
  listing: TodayOperationListing;
  kind: TodayOperationKind;
  priority: number;
  label: string;
  detail: string;
};

export type TodayOperationContext = {
  blockingIssues: number;
  queueStage: string;
  operationsIssue?: string;
};

export function todayOperationFor<T extends TodayOperationListing>(
  listing: T,
  context: TodayOperationContext,
  now = Date.now(),
): TodayOperation & { listing: T } | undefined {
  if (listing.status === 'Sold' && ['Awaiting Shipment', 'Packed'].includes(listing.fulfillmentStatus || '')) {
    return {
      listing,
      kind: 'fulfillment',
      priority: 1,
      label: listing.fulfillmentStatus === 'Packed' ? 'Ship packed order' : 'Pick and pack',
      detail: [listing.storageLocation, listing.fulfillmentStatus].filter(Boolean).join(' · ') || 'Sold order needs fulfillment',
    };
  }
  if (listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && context.blockingIssues > 0) {
    return { listing, kind: 'exception', priority: 2, label: 'Fix listing', detail: `${context.blockingIssues} blocking issue${context.blockingIssues === 1 ? '' : 's'}` };
  }
  if (context.operationsIssue) {
    return { listing, kind: 'reconcile', priority: 3, label: 'Reconcile eBay', detail: context.operationsIssue };
  }
  if (listing.platform === 'eBay' && ['Draft', 'Pending'].includes(listing.status) && ['Ready for eBay', 'Staged for eBay'].includes(context.queueStage)) {
    return {
      listing,
      kind: 'ready',
      priority: 4,
      label: context.queueStage === 'Staged for eBay' ? 'Ready to publish' : 'Ready to stage',
      detail: context.queueStage,
    };
  }
  const ageDays = listingAgeDays(listing.listedDate, now);
  if (listing.platform === 'eBay' && listing.status === 'Active' && listing.ebayOfferId && ageDays !== undefined && ageDays >= 60) {
    return { listing, kind: 'stale', priority: 5, label: 'Review stale price', detail: `${ageDays} days active` };
  }
  return undefined;
}

export function buildTodayOperations<T extends TodayOperationListing>(
  listings: T[],
  contextFor: (listing: T) => TodayOperationContext,
  now = Date.now(),
) {
  return listings.flatMap((listing) => {
    const operation = todayOperationFor(listing, contextFor(listing), now);
    return operation ? [operation] : [];
  }).sort((a, b) => a.priority - b.priority || b.listing.status.localeCompare(a.listing.status) || a.listing.title.localeCompare(b.listing.title));
}
