import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTodayOperations, todayOperationFor } from '../src/utils/todayOperations.ts';

const base = { _id: '1', title: 'Example', platform: 'eBay', status: 'Draft' };

describe('Today operations queue', () => {
  it('prioritizes fulfillment over listing work', () => {
    const fulfillment = todayOperationFor({ ...base, status: 'Sold', fulfillmentStatus: 'Awaiting Shipment', storageLocation: 'BIN-4' }, { blockingIssues: 0, queueStage: 'Sold' });
    assert.equal(fulfillment?.kind, 'fulfillment');
    assert.match(fulfillment?.detail || '', /BIN-4/);
  });

  it('routes exceptions, ready listings, and stale managed listings', () => {
    assert.equal(todayOperationFor(base, { blockingIssues: 2, queueStage: 'Ready for Pricing' })?.kind, 'exception');
    assert.equal(todayOperationFor(base, { blockingIssues: 0, queueStage: 'Ready for eBay' })?.kind, 'ready');
    assert.equal(todayOperationFor({ ...base, status: 'Active', listedDate: '2026-01-01', ebayOfferId: 'offer' }, { blockingIssues: 0, queueStage: 'Published' }, Date.parse('2026-04-01T12:00:00Z'))?.kind, 'stale');
  });

  it('returns one highest-priority task per listing and sorts the workday', () => {
    const rows = buildTodayOperations([
      { ...base, _id: 'ready', title: 'Ready item' },
      { ...base, _id: 'ship', title: 'Sold item', status: 'Sold', fulfillmentStatus: 'Packed' },
    ], (listing) => ({ blockingIssues: 0, queueStage: listing.status === 'Sold' ? 'Sold' : 'Ready for eBay' }));
    assert.deepEqual(rows.map((row) => row.kind), ['fulfillment', 'ready']);
  });
});
