import assert from 'node:assert/strict';
import test from 'node:test';
import { completeBookTitle, mergeBookMetadata, primaryAuthorsFromResponsibility } from '../convex/lib/bookMetadata.ts';

test('book titles retain useful subtitles but discard catalog responsibility statements', () => {
  assert.equal(completeBookTitle('Batman Vol. 1', 'The Court of Owls'), 'Batman Vol. 1: The Court of Owls');
  assert.equal(completeBookTitle('Batman: Haunted Knight', '/ Jeph Loeb & Tim Sale'), 'Batman: Haunted Knight');
  assert.equal(
    completeBookTitle('Batman haunted knight : the legends of the Dark Knight Halloween specials : three tales of Halloween in Gotham City'),
    'Batman Haunted Knight',
  );
  assert.deepEqual(
    primaryAuthorsFromResponsibility('/ Jeph Loeb & Tim Sale, storytellers ; Gregory Wright, colorist.'),
    ['Jeph Loeb', 'Tim Sale'],
  );
});

test('richer exact-ISBN metadata wins over generic or overlong catalog titles', () => {
  const generic = { title: 'Batman', source: 'Open Library', confidence: 'High', coverImageUrl: 'https://example.com/cover.jpg' };
  const rich = { title: 'Batman Vol. 5: Zero Year - Dark City (The New 52)', source: 'Google Books', confidence: 'High', author: 'Scott Snyder' };
  const merged = mergeBookMetadata(generic, rich);
  assert.equal(merged?.title, rich.title);
  assert.equal(merged?.author, rich.author);
  assert.equal(merged?.coverImageUrl, generic.coverImageUrl);
  assert.equal(merged?.source, 'Open Library + Google Books');

  const catalog = { title: 'Batman haunted knight: the legends of the Dark Knight Halloween specials: three tales of Halloween in Gotham City', source: 'Open Library', confidence: 'High' };
  const concise = { title: 'Batman: Haunted Knight', source: 'Google Books', confidence: 'High' };
  assert.equal(mergeBookMetadata(catalog, concise)?.title, 'Batman: Haunted Knight');
});
