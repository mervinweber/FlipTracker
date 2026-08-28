import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeVintedListingUrl, suggestedVintedCategory, vintedListingId } from '../src/utils/vinted.ts';

describe('Vinted workspace helpers', () => {
  it('accepts item links from Vinted country domains and extracts the item id', () => {
    assert.equal(vintedListingId('https://www.vinted.com/items/9345765878-example-book?referrer=catalog'), '9345765878');
    assert.equal(vintedListingId('vinted.co.uk/items/123456789-game'), '123456789');
  });

  it('rejects profile links and unrelated hosts', () => {
    assert.equal(normalizeVintedListingUrl('https://www.vinted.com/member/123'), '');
    assert.equal(normalizeVintedListingUrl('https://example.com/items/123'), '');
  });

  it('suggests useful high-level categories from inventory facts', () => {
    assert.equal(suggestedVintedCategory('Book', 'A Novel'), 'Books');
    assert.equal(suggestedVintedCategory('Blu-ray', 'Example'), 'Movies & TV');
    assert.equal(suggestedVintedCategory('Video Game', 'Nintendo Switch'), 'Video Games');
  });
});
