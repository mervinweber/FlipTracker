import assert from 'node:assert/strict';
import test from 'node:test';
import { EBAY_PHOTO_LIMIT, selectBundlePhotos } from '../convex/lib/bundlePhotos.ts';

test('bundle photos keep member and photo order through the eBay limit', () => {
  const result = selectBundlePhotos([
    { bundlePosition: 1, photos: ['second-front', 'second-back'] },
    { bundlePosition: 0, photos: ['first-front', 'first-back'] },
  ]);

  assert.deepEqual(result.included, ['first-front', 'first-back', 'second-front', 'second-back']);
  assert.deepEqual(result.omitted, []);
  assert.equal(result.total, 4);
});

test('a 13-photo bundle keeps the extra photo visible but excludes it from eBay', () => {
  const photos = Array.from({ length: EBAY_PHOTO_LIMIT + 1 }, (_, index) => `photo-${index + 1}`);
  const result = selectBundlePhotos([
    { bundlePosition: 0, photos: photos.slice(0, 7) },
    { bundlePosition: 1, photos: photos.slice(7) },
  ]);

  assert.equal(result.included.length, 12);
  assert.deepEqual(result.included, photos.slice(0, 12));
  assert.deepEqual(result.omitted, ['photo-13']);
  assert.equal(result.total, 13);
});
