export type FulfillmentOrderLine = {
  lineItemId?: string;
  legacyItemId?: string;
  sku?: string;
  quantity?: number;
};

export type ExistingShippingFulfillment = {
  fulfillmentId?: string;
  trackingNumber?: string;
  shippingCarrierCode?: string;
  lineItems?: Array<{ lineItemId?: string }>;
};

export function matchOrderLine(
  lineItems: FulfillmentOrderLine[],
  listing: { ebayOrderLineItemId?: string; externalListingId?: string; sku?: string },
) {
  return lineItems.find((item) => item.lineItemId === listing.ebayOrderLineItemId)
    ?? lineItems.find((item) => Boolean(listing.externalListingId) && item.legacyItemId === listing.externalListingId)
    ?? lineItems.find((item) => Boolean(listing.sku) && item.sku === listing.sku);
}

export function matchExistingFulfillment(
  fulfillments: ExistingShippingFulfillment[],
  lineItemId: string,
  trackingNumber: string,
) {
  return fulfillments.find((fulfillment) => fulfillment.trackingNumber === trackingNumber
    || fulfillment.lineItems?.some((item) => item.lineItemId === lineItemId));
}
