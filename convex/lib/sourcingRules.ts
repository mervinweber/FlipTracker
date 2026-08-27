export type SourcingCompInput = { price: number; shipping?: number };

export type SourcingAnalysisInput = {
  purchaseCost: number;
  shippingCost: number;
  packagingCost: number;
  feePercent: number;
  targetProfit?: number;
  targetRoiPercent?: number;
  minimumLiquidity?: number;
  activeCount: number;
  soldCount90: number;
  soldPrices: SourcingCompInput[];
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(sorted: number[]) {
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rarityScore(activeCount: number) {
  if (activeCount <= 0) return 100;
  if (activeCount === 1) return 95;
  if (activeCount <= 3) return 85;
  if (activeCount <= 7) return 70;
  if (activeCount <= 15) return 50;
  if (activeCount <= 30) return 30;
  return 10;
}

export function calculateAnalysis(input: SourcingAnalysisInput) {
  const deliveredPrices = input.soldPrices
    .map((comp) => Math.max(0, comp.price) + Math.max(0, comp.shipping ?? 0))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  const compCount = deliveredPrices.length;
  const averageSold = compCount ? deliveredPrices.reduce((sum, price) => sum + price, 0) / compCount : 0;
  const trimCount = compCount >= 10 ? Math.max(1, Math.floor(compCount * 0.1)) : 0;
  const trimmed = trimCount ? deliveredPrices.slice(trimCount, -trimCount) : deliveredPrices;
  const trimmedAverageSold = trimmed.length ? trimmed.reduce((sum, price) => sum + price, 0) / trimmed.length : 0;
  const medianSold = median(deliveredPrices);
  const activeCount = Math.max(0, Math.round(input.activeCount));
  const soldCount90 = Math.max(0, Math.round(input.soldCount90));
  const sellThroughPercent = activeCount > 0 ? (soldCount90 / activeCount) * 100 : soldCount90 > 0 ? 999 : 0;
  const estimatedDaysToSell = soldCount90 > 0 ? Math.max(1, 90 * Math.max(activeCount, 1) / soldCount90) : undefined;
  const rarity = rarityScore(activeCount);
  const velocityScore = Math.min(100, soldCount90 * 5);
  const turnoverScore = Math.min(100, sellThroughPercent);
  const liquidity = round(turnoverScore * 0.65 + velocityScore * 0.35, 0);
  const confidence = compCount >= 8 && soldCount90 >= 10 ? "High" : compCount >= 3 && soldCount90 >= 3 ? "Medium" : "Low";
  const expectedSalePrice = medianSold || trimmedAverageSold;
  const expectedFees = expectedSalePrice * Math.max(0, input.feePercent) / 100;
  const expectedProfit = expectedSalePrice - expectedFees - Math.max(0, input.shippingCost) - Math.max(0, input.packagingCost) - Math.max(0, input.purchaseCost);
  const roiPercent = input.purchaseCost > 0 ? expectedProfit / input.purchaseCost * 100 : expectedProfit > 0 ? 999 : 0;
  const targetProfit = Math.max(0, input.targetProfit ?? 10);
  const targetRoiPercent = Math.max(0, input.targetRoiPercent ?? 50);
  const minimumLiquidity = Math.min(100, Math.max(0, input.minimumLiquidity ?? 40));
  const contributionBeforePurchase = expectedSalePrice - expectedFees - Math.max(0, input.shippingCost) - Math.max(0, input.packagingCost);
  const profitLimitedBuy = contributionBeforePurchase - targetProfit;
  const roiLimitedBuy = targetRoiPercent > 0 ? contributionBeforePurchase / (1 + targetRoiPercent / 100) : contributionBeforePurchase;
  const maximumBuyPrice = Math.max(0, Math.min(profitLimitedBuy, roiLimitedBuy));

  let recommendation = "Pass";
  if (compCount > 0 && soldCount90 > 0) {
    if (expectedProfit >= targetProfit && roiPercent >= targetRoiPercent && liquidity >= minimumLiquidity && confidence !== "Low") recommendation = "Buy";
    else if ((expectedProfit >= targetProfit * 0.5 && roiPercent >= targetRoiPercent * 0.5) || (rarity >= 80 && expectedProfit > 0)) recommendation = "Maybe";
  }

  const reasons = [
    `${compCount} observed sold price${compCount === 1 ? "" : "s"}`,
    `${round(sellThroughPercent, 0)}% sell-through proxy`,
    estimatedDaysToSell === undefined ? "no recent sales velocity" : `about ${round(estimatedDaysToSell, 0)} days to sell`,
    `$${round(expectedProfit).toFixed(2)} expected profit`,
    `${round(roiPercent, 0)}% ROI`,
    `$${round(maximumBuyPrice).toFixed(2)} maximum buy for ${round(targetProfit).toFixed(2)} profit / ${round(targetRoiPercent, 0)}% ROI targets`,
    `${confidence.toLowerCase()} confidence`,
  ];

  return {
    compCount,
    averageSold: round(averageSold),
    medianSold: round(medianSold),
    trimmedAverageSold: round(trimmedAverageSold),
    sellThroughPercent: round(sellThroughPercent),
    estimatedDaysToSell: estimatedDaysToSell === undefined ? undefined : round(estimatedDaysToSell, 1),
    rarityScore: rarity,
    liquidityScore: liquidity,
    confidence,
    expectedSalePrice: round(expectedSalePrice),
    expectedFees: round(expectedFees),
    expectedProfit: round(expectedProfit),
    roiPercent: round(roiPercent),
    maximumBuyPrice: round(maximumBuyPrice),
    recommendation,
    recommendationReason: reasons.join("; "),
  };
}
