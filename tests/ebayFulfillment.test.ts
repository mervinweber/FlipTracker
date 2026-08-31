import assert from 'node:assert/strict';
import test from 'node:test';
import { matchExistingFulfillment, matchOrderLine } from '../convex/lib/ebayFulfillment.ts';

test('matches an eBay order line by saved line id, listing id, then SKU', () => {
  const lines = [
    { lineItemId: 'line-a', legacyItemId: 'item-a', sku: 'SKU-A' },
    { lineItemId: 'line-b', legacyItemId: 'item-b', sku: 'SKU-B' },
  ];
  assert.equal(matchOrderLine(lines, { ebayOrderLineItemId: 'line-b', externalListingId: 'item-a', sku: 'SKU-A' })?.lineItemId, 'line-b');
  assert.equal(matchOrderLine(lines, { externalListingId: 'item-a' })?.lineItemId, 'line-a');
  assert.equal(matchOrderLine(lines, { sku: 'SKU-B' })?.lineItemId, 'line-b');
});

test('detects an existing shipment by tracking or assigned line item', () => {
  const fulfillments = [
    { fulfillmentId: 'fulfillment-a', trackingNumber: 'TRACK-A', lineItems: [{ lineItemId: 'line-a' }] },
  ];
  assert.equal(matchExistingFulfillment(fulfillments, 'other', 'TRACK-A')?.fulfillmentId, 'fulfillment-a');
  assert.equal(matchExistingFulfillment(fulfillments, 'line-a', 'other')?.fulfillmentId, 'fulfillment-a');
  assert.equal(matchExistingFulfillment(fulfillments, 'line-b', 'TRACK-B'), undefined);
});
