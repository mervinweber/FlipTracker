export type OperationsListing = {
  platform: string;
  status: string;
  purchasePrice?: number;
  externalListingId?: string;
  ebayOfferId?: string;
  ebayDraftStatus?: string;
  ebayDraftCreatedAt?: number;
  ebayLastError?: string;
};

export function listingOperationsIssue(listing: OperationsListing, now = Date.now()) {
  if (listing.platform !== 'eBay') return '';

  // A completed sale is historical accounting data, not an eBay-ready listing.
  // Do not let stale publishing errors, categories, or photos block closeout.
  if (listing.status === 'Sold') {
    if (listing.ebayDraftStatus === 'Imported eBay sale' && listing.purchasePrice === undefined) {
      return 'Add acquisition cost to complete this imported sale.';
    }
    return '';
  }

  if (listing.ebayLastError) return listing.ebayLastError;
  if (listing.status === 'Active' && !listing.externalListingId) return 'Active locally but missing its eBay item ID.';
  if (listing.ebayOfferId && !listing.externalListingId && listing.ebayDraftCreatedAt && now - listing.ebayDraftCreatedAt > 14 * 86_400_000) {
    return 'Staged offer is more than 14 days old and should be reviewed or refreshed.';
  }
  return '';
}

export function shouldArchiveSaleByDefault(listing: Pick<OperationsListing, 'status' | 'ebayDraftStatus'> & { fulfillmentStatus?: string }) {
  if (listing.fulfillmentStatus === 'Completed') return true;
  return listing.status === 'Sold'
    && listing.ebayDraftStatus === 'Imported eBay sale'
    && listing.fulfillmentStatus === 'Shipped';
}
