import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ebaySpecificsStepForError, readableActionError } from '../src/utils/actionErrors.ts';

describe('action error messages', () => {
  it('extracts the useful Convex error detail', () => {
    const error = new Error('[CONVEX A(ebay:revisePublishedListing)] Server Error Uncaught ConvexError: Complete required eBay item specifics before staging: Publication Name. at handler Called by client');
    assert.equal(readableActionError(error, 'fallback'), 'Complete required eBay item specifics before staging: Publication Name.');
  });

  it('falls back when Convex only returns its generic wrapper', () => {
    assert.equal(readableActionError(new Error('[CONVEX A(ebay:test)] Server Error Called by client'), 'Could not update.'), 'Could not update.');
  });

  it('routes item-specific failures to category details', () => {
    assert.equal(ebaySpecificsStepForError('Complete required eBay item specifics: Publication Name.'), 'category');
  });
});
