import assert from 'node:assert/strict';
import test from 'node:test';
import { applySmartPreparation, buildSmartPreparationPlan, recommendedSmartChangeKeys } from '../src/utils/smartListingPreparation.ts';

test('smart preparation recommends missing defaults and copy without overwriting seller values', () => {
  const original = { title: 'The Matrix DVD', description: '', currentPrice: 12.99 };
  const defaults = { ...original, language: 'English', shippingPreset: 'dvd-standard', packageWeightOz: 8 };
  const plan = buildSmartPreparationPlan(original, defaults, {
    title: 'The Matrix DVD Widescreen Edition 1999',
    description: 'Pre-owned DVD in the condition shown. Includes the original case.',
    confidence: 0.9,
    provider: 'gemini',
  }, { suggestedPrice: 14.99, confidence: 'High', matchCount: 8 });
  const selected = recommendedSmartChangeKeys(plan);
  const applied = applySmartPreparation(original, plan, selected);

  assert.equal(applied.title, original.title);
  assert.equal(applied.currentPrice, original.currentPrice);
  assert.equal(applied.description, 'Pre-owned DVD in the condition shown. Includes the original case.');
  assert.equal(applied.language, 'English');
  assert.equal(applied.shippingPreset, 'dvd-standard');
});

test('smart preparation recommends replacing a generic title and adding a missing market price', () => {
  const original = { title: 'Unknown', description: 'Existing seller description that is already long enough to remain authoritative.' };
  const plan = buildSmartPreparationPlan(original, original, {
    title: 'Pokemon Pikachu 025/165 Reverse Holo English',
    description: 'AI replacement description.',
    confidence: 0.88,
  }, { suggestedPrice: 6.99, confidence: 'Medium', matchCount: 4 });
  const selected = recommendedSmartChangeKeys(plan);
  const applied = applySmartPreparation(original, plan, selected);

  assert.equal(applied.title, 'Pokemon Pikachu 025/165 Reverse Holo English');
  assert.equal(applied.description, original.description);
  assert.equal(applied.currentPrice, 6.99);
  assert.match(String(applied.pricingSource), /4 active eBay matches/);
});

test('optional AI and market changes apply only after explicit selection', () => {
  const original = { title: 'Seller title', description: 'Seller description with deliberate wording.', currentPrice: 19.99 };
  const plan = buildSmartPreparationPlan(original, original, {
    title: 'Suggested title',
    description: 'Suggested description',
    confidence: 0.7,
  }, { suggestedPrice: 17.99, confidence: 'Low', matchCount: 2 });
  const selected = new Set(plan.changes.map((change) => change.key));
  const applied = applySmartPreparation(original, plan, selected);

  assert.equal(applied.title, 'Suggested title');
  assert.equal(applied.description, 'Suggested description');
  assert.equal(applied.currentPrice, 17.99);
});

