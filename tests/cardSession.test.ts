import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCardListingCopy, cardDuplicateKey, countExactDuplicates, recommendCardDisposition } from '../src/utils/cardSession.ts';

const pokemon = {
  game: 'pokemon' as const,
  providerId: 'sv3pt5-25',
  name: 'Pikachu',
  setName: '151',
  setCode: 'sv3pt5',
  collectorNumber: '025/165',
  language: 'English',
  finish: 'Reverse Holofoil',
};

test('duplicate keys distinguish finish and language variants', () => {
  assert.equal(cardDuplicateKey(pokemon), cardDuplicateKey({ ...pokemon, name: '  PIKACHU ' }));
  assert.notEqual(cardDuplicateKey(pokemon), cardDuplicateKey({ ...pokemon, finish: 'Holofoil' }));
  assert.notEqual(cardDuplicateKey(pokemon), cardDuplicateKey({ ...pokemon, language: 'Japanese' }));
});

test('duplicate count only includes exact printings', () => {
  assert.equal(countExactDuplicates([pokemon, { ...pokemon }, { ...pokemon, finish: 'Holofoil' }], pokemon), 2);
});

test('recommendations protect valuable singles and group low-value duplicates', () => {
  assert.equal(recommendCardDisposition({ referencePrice: 12, exactCopies: 3 }).disposition, 'Sell Individually');
  assert.equal(recommendCardDisposition({ referencePrice: 2, exactCopies: 3 }).disposition, 'Playset');
  assert.equal(recommendCardDisposition({ referencePrice: 2, exactCopies: 2 }).disposition, 'Bundle');
  assert.equal(recommendCardDisposition({ exactCopies: 1 }).disposition, 'Hold');
});

test('listing copy includes exact identifiers and actual-photo language', () => {
  const copy = buildCardListingCopy(pokemon, 'Lightly Played');
  assert.match(copy.title, /Pikachu 151 .*025\/165/);
  assert.ok(copy.title.length <= 80);
  assert.match(copy.description, /Language: English/);
  assert.match(copy.description, /front and back photos/);
});
