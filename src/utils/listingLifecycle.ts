export type ListingLifecycleInput = {
  platform?: string;
  status?: string;
  externalListingId?: string;
  ebayOfferId?: string;
  ebayDraftStatus?: string;
  fulfillmentStatus?: string;
};

export type ListingLifecycleStage =
  | 'queue'
  | 'ready'
  | 'staged'
  | 'active'
  | 'shipping'
  | 'sold'
  | 'archived'
  | 'closed';

export type ListingLifecycleSummary = {
  stage: ListingLifecycleStage;
  label: string;
  detail: string;
  className: string;
};

function normalized(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function summarizeListingLifecycle(listing: ListingLifecycleInput, queueLabel = ''): ListingLifecycleSummary {
  const status = normalized(listing.status);
  const fulfillment = normalized(listing.fulfillmentStatus);
  const platform = normalized(listing.platform);
  const isEbay = platform === 'ebay';

  if (status === 'sold' && fulfillment === 'completed') {
    return { stage: 'archived', label: 'Archived', detail: 'Sold and complete', className: 'archived' };
  }

  if (status === 'sold' && ['awaiting shipment', 'packed'].includes(fulfillment)) {
    return { stage: 'shipping', label: 'Ship', detail: listing.fulfillmentStatus || 'Awaiting shipment', className: 'shipping' };
  }

  if (status === 'sold') {
    return { stage: 'sold', label: 'Sold', detail: listing.fulfillmentStatus || 'Sale recorded', className: 'sold' };
  }

  if (status === 'active' || listing.externalListingId) {
    return { stage: 'active', label: 'Live', detail: isEbay && listing.externalListingId ? `eBay ${listing.externalListingId}` : 'Active listing', className: 'active' };
  }

  if (isEbay && listing.ebayOfferId) {
    return { stage: 'staged', label: 'Staged', detail: 'Ready to publish', className: 'staged' };
  }

  if (['draft', 'pending'].includes(status)) {
    const ready = /ready for ebay/i.test(queueLabel);
    return {
      stage: ready ? 'ready' : 'queue',
      label: ready ? 'Ready' : 'Queue',
      detail: queueLabel || (listing.status || 'Draft'),
      className: ready ? 'ready' : 'queue',
    };
  }

  return { stage: 'closed', label: listing.status || 'Closed', detail: listing.ebayDraftStatus || 'Not active', className: 'closed' };
}
