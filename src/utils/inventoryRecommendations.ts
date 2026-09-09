import type { ListingRecommendation } from '../types/inventory';

export type RecommendationInput = {
  type?: string;
  condition?: string;
  completeness?: string;
  valueSource?: string;
  userHigh?: number;
  estimatedHigh?: number;
};

function highValue(item: RecommendationInput) {
  return item.valueSource === 'User Override' ? item.userHigh || 0 : item.estimatedHigh || 0;
}

export function priorityFromValue(item: RecommendationInput) {
  const high = highValue(item);
  if (high >= 20) return 'List First';
  if (high >= 10) return 'Worth Listing';
  return 'Review';
}

export function recommendationFromAsset(item: RecommendationInput): ListingRecommendation {
  const high = highValue(item);
  const condition = (item.condition || '').toLowerCase();
  const completeness = (item.completeness || '').toLowerCase();
  if (condition.includes('parts') || completeness === 'case only') return 'Skip';
  if (high >= 12 || item.type === 'Book') return 'Sell Individually';
  return 'Review';
}
