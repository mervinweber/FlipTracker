import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeListingLifecycle } from '../src/utils/listingLifecycle.ts';

test('listing lifecycle summarizes staged, live, shipping, and archived states', () => {
  assert.deepEqual(
    summarizeListingLifecycle({ platform: 'eBay', status: 'Draft', ebayOfferId: 'offer-1' }, 'Staged for eBay'),
    { stage: 'staged', label: 'Staged', detail: 'Ready to publish', className: 'staged' },
  );

  assert.equal(
    summarizeListingLifecycle({ platform: 'eBay', status: 'Active', externalListingId: '12345' }).label,
    'Live',
  );

  assert.equal(
    summarizeListingLifecycle({ platform: 'eBay', status: 'Sold', fulfillmentStatus: 'Awaiting Shipment' }).stage,
    'shipping',
  );

  assert.equal(
    summarizeListingLifecycle({ platform: 'eBay', status: 'Sold', fulfillmentStatus: 'Completed' }).label,
    'Archived',
  );
});
