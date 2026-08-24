import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyListingSpeedPreset, listingFamily, loadListingSpeedPresets, saveListingSpeedPreset } from '../src/utils/listingSpeedPresets.ts';

function memoryStorage(seed = '') {
  let value = seed;
  return {
    getItem: () => value || null,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe('listing speed presets', () => {
  it('groups the primary selling families', () => {
    assert.equal(listingFamily({ assetType: 'Book' }), 'book');
    assert.equal(listingFamily({ mediaFormat: 'Blu-ray' }), 'movie');
    assert.equal(listingFamily({ assetType: 'Video Game' }), 'game');
    assert.equal(listingFamily({ assetType: 'Pokemon Card' }), 'card');
    assert.equal(listingFamily({ title: 'Mens denim jacket', assetType: 'Clothing' }), 'clothing');
  });

  it('stores one family without replacing another', () => {
    const storage = memoryStorage();
    saveListingSpeedPreset('book', { condition: 'Good', shippingPreset: 'single-book' }, storage);
    saveListingSpeedPreset('movie', { condition: 'Very Good' }, storage);
    assert.deepEqual(loadListingSpeedPresets(storage), {
      book: { condition: 'Good', shippingPreset: 'single-book' },
      movie: { condition: 'Very Good' },
    });
  });

  it('fills missing values without overriding listing-specific choices', () => {
    const listing = applyListingSpeedPreset(
      { assetType: 'Book', title: 'Example', condition: 'Acceptable', shippingPreset: undefined },
      { book: { condition: 'Good', shippingPreset: 'single-book' } },
    );
    assert.equal(listing.condition, 'Acceptable');
    assert.equal(listing.shippingPreset, 'single-book');
  });
});
