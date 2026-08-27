import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessMarkdownListing, calculateMarkdownPrice, isFlipTrackerManagedActiveListing, listingAgeDays } from '../src/utils/listingBulkMarkdown.ts';

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

  it('calculates listing age from the seller-visible listed date', () => {
    assert.equal(listingAgeDays('2026-05-01', Date.parse('2026-06-30T12:00:00Z')), 60);
    assert.equal(listingAgeDays(undefined), undefined);
  });

  it('protects a minimum net profit after fees, cost, and shipping', () => {
    const listing = {
      platform: 'eBay', status: 'Active', externalListingId: '1', ebayOfferId: '2',
      listedDate: '2026-01-01', currentPrice: 19.99, purchasePrice: 10, shippingCost: 5,
    };
    const protectedRow = assessMarkdownListing(listing, {
      minimumAgeDays: 30, percentage: 10, feePercent: 15, minimumProfit: 2, charmPricing: true,
    }, Date.parse('2026-04-01T12:00:00Z'));
    assert.equal(protectedRow.status, 'profit-protected');
    assert.equal(protectedRow.newPrice, 17.99);
  });

  it('separates eligible, too-new, and missing-date listings', () => {
    const strategy = { minimumAgeDays: 30, percentage: 10, feePercent: 15, minimumProfit: 0, charmPricing: false };
    const base = { platform: 'eBay', status: 'Active', externalListingId: '1', ebayOfferId: '2', currentPrice: 20 };
    assert.equal(assessMarkdownListing({ ...base, listedDate: '2026-01-01' }, strategy, Date.parse('2026-04-01T12:00:00Z')).status, 'eligible');
    assert.equal(assessMarkdownListing({ ...base, listedDate: '2026-03-20' }, strategy, Date.parse('2026-04-01T12:00:00Z')).status, 'too-new');
    assert.equal(assessMarkdownListing(base, strategy, Date.parse('2026-04-01T12:00:00Z')).status, 'missing-date');
  });

  it('rejects incomplete or unsafe strategy inputs', () => {
    const listing = {
      platform: 'eBay', status: 'Active', externalListingId: '1', ebayOfferId: '2',
      listedDate: '2026-01-01', currentPrice: 20,
    };
    const now = Date.parse('2026-04-01T12:00:00Z');
    assert.equal(assessMarkdownListing(listing, {
      minimumAgeDays: Number.NaN, percentage: 10, feePercent: 15, minimumProfit: 0, charmPricing: false,
    }, now).status, 'invalid-price');
    assert.equal(assessMarkdownListing(listing, {
      minimumAgeDays: 30, percentage: 10, feePercent: 75, minimumProfit: 0, charmPricing: false,
    }, now).status, 'invalid-price');
    assert.equal(assessMarkdownListing(listing, {
      minimumAgeDays: 30, percentage: 10, feePercent: 15, minimumProfit: -1, charmPricing: false,
    }, now).status, 'invalid-price');
  });
});
