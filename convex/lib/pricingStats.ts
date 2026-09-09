function quantile(sorted: number[], percentile: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return quantile(sorted, 0.5);
}

export function removePriceOutliers<T>(items: T[], priceFor: (item: T) => number) {
  const valid = items.filter((item) => Number.isFinite(priceFor(item)) && priceFor(item) > 0);
  if (valid.length < 4) return valid;

  const prices = valid.map(priceFor).sort((left, right) => left - right);
  const firstQuartile = quantile(prices, 0.25);
  const thirdQuartile = quantile(prices, 0.75);
  const spread = thirdQuartile - firstQuartile;
  if (spread <= 0) return valid.filter((item) => priceFor(item) === firstQuartile);

  const lowFence = Math.max(0, firstQuartile - 1.5 * spread);
  const highFence = thirdQuartile + 1.5 * spread;
  const filtered = valid.filter((item) => priceFor(item) >= lowFence && priceFor(item) <= highFence);
  return filtered.length >= 2 ? filtered : valid;
}
