import assert from 'node:assert/strict';
import test from 'node:test';
import { applySafeSpecificDefaults, assessListingQuality, photoChecklistFor } from '../src/utils/listingQuality.ts';

test('quality scoring separates a clean listing from a blocked listing', () => {
  const clean = assessListingQuality({ title: 'The Matrix DVD Widescreen Edition 1999 Tested', description: 'Complete DVD in good used condition. Disc is tested and includes the original case.', actualPhotoCount: 3, currentPrice: 12.99, purchasePrice: 1, shippingCost: 4, assetType: 'DVD' }, []);
  const blocked = assessListingQuality({ title: '', description: '', actualPhotoCount: 0, assetType: 'DVD' }, [{ field: 'title', step: 'details', message: 'Missing', severity: 'error', blocking: true }]);
  assert.equal(clean.grade, 'Ready');
  assert.ok(clean.score >= 90);
  assert.equal(blocked.grade, 'Blocked');
  assert.ok(blocked.score < clean.score);
});

test('photo guidance changes by listing family', () => {
  assert.equal(photoChecklistFor({ assetType: 'Book' }).recommendedCount, 2);
  assert.equal(photoChecklistFor({ assetType: 'Clothing' }).recommendedCount, 5);
  assert.match(photoChecklistFor({ assetType: 'Video Game' }).shots.join(' '), /cartridge/i);
});

test('safe item-specific defaults preserve seller values', () => {
  const movie = applySafeSpecificDefaults({ assetType: 'DVD', mediaFormat: 'DVD', itemSpecifics: 'Type: Documentary' });
  assert.match(movie.itemSpecifics || '', /Type: Documentary/);
  assert.match(movie.itemSpecifics || '', /Format: DVD/);
  assert.equal((movie.itemSpecifics || '').match(/^Type:/gm)?.length, 1);
  assert.match(applySafeSpecificDefaults({ assetType: 'Book' }).itemSpecifics || '', /Language: English/);
});
