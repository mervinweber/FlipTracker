import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listingOperationsIssue, shouldArchiveSaleByDefault } from '../src/utils/listingOperations.ts';

describe('sold listing operations', () => {
  it('asks imported sales only for missing acquisition cost', () => {
    const imported = { platform: 'eBay', status: 'Sold', ebayDraftStatus: 'Imported eBay sale', ebayLastError: 'Photo required' };
    assert.match(listingOperationsIssue(imported), /acquisition cost/i);
    assert.equal(listingOperationsIssue({ ...imported, purchasePrice: 0 }), '');
  });

  it('does not carry eBay publishing blockers into completed sales', () => {
    assert.equal(listingOperationsIssue({ platform: 'eBay', status: 'Sold', ebayLastError: 'Choose a leaf category and add a photo.' }), '');
  });

  it('keeps active listing reconciliation behavior', () => {
    assert.match(listingOperationsIssue({ platform: 'eBay', status: 'Active' }), /missing its eBay item ID/i);
    assert.equal(listingOperationsIssue({ platform: 'Mercari', status: 'Active', ebayLastError: 'Ignore me' }), '');
  });

  it('defaults completed and shipped imported sales to archived', () => {
    assert.equal(shouldArchiveSaleByDefault({ status: 'Sold', fulfillmentStatus: 'Completed' }), true);
    assert.equal(shouldArchiveSaleByDefault({ status: 'Sold', ebayDraftStatus: 'Imported eBay sale', fulfillmentStatus: 'Shipped' }), true);
    assert.equal(shouldArchiveSaleByDefault({ status: 'Sold', ebayDraftStatus: 'Imported eBay sale', fulfillmentStatus: 'Awaiting Shipment' }), false);
  });
});
