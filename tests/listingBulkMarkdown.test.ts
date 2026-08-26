import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateMarkdownPrice, isFlipTrackerManagedActiveListing } from '../src/utils/listingBulkMarkdown.ts';

describe('bulk eBay markdown', () => {
  it('only includes active Inventory API listings created by FlipTracker', () => {
    assert.equal(isFlipTrackerManagedActiveListing({ platform: 'eBay', status: 'Active', externalListingId: '123', ebayOfferId: '456' }), true);
    assert.equal(isFlipTrackerManagedActiveListing({ platform: 'eBay', status: 'Active', externalListingId: '123' }), false);
    assert.equal(isFlipTrackerManagedActiveListing({ platform: 'eBay', status: 'Sold', externalListingId: '123', ebayOfferId: '456' }), false);
  });

  it('calculates exact and charm-price markdowns', () => {
    assert.equal(calculateMarkdownPrice(24.99, 10, false), 22.49);
    assert.equal(calculateMarkdownPrice(24.99, 10, true), 22.99);
  });

  it('rejects invalid or unchanged markdowns', () => {
    assert.equal(calculateMarkdownPrice(10, 0, false), undefined);
    assert.equal(calculateMarkdownPrice(0.5, 10, false), undefined);
    assert.equal(calculateMarkdownPrice(0.99, 1, true), undefined);
  });
});
