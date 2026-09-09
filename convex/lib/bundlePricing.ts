export type MemberPricing = {
  fallbackValue?: number;
  summary?: {
    suggestedPrice?: number;
    low?: number;
    high?: number;
    median?: number;
    matchCount?: number;
  };
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function charmPrice(value: number) {
  if (value <= 1) return roundMoney(value);
  return roundMoney(Math.max(0.99, Math.floor(value) + 0.99));
}

export function aggregateBundlePricing(members: MemberPricing[], discountRate = 0.1) {
  const values = members.map((member) => member.summary?.suggestedPrice ?? member.fallbackValue)
    .filter((value): value is number => Number.isFinite(value) && (value ?? 0) > 0);
  const pricedBySearch = members.filter((member) => Number.isFinite(member.summary?.suggestedPrice) && (member.summary?.suggestedPrice ?? 0) > 0).length;
  const fallbackMembers = values.length - pricedBySearch;
  const missingMembers = members.length - values.length;
  const discountMultiplier = 1 - discountRate;
  const componentValue = roundMoney(values.reduce((sum, value) => sum + value, 0));
  const rangedMembers = members.map((member) => ({
    low: member.summary?.low ?? member.fallbackValue,
    high: member.summary?.high ?? member.fallbackValue,
  })).filter((member) => Number.isFinite(member.low) && Number.isFinite(member.high));
  const matchCount = members.reduce((sum, member) => sum + (member.summary?.matchCount ?? 0), 0);
  return {
    componentValue,
    suggestedPrice: componentValue > 0 ? charmPrice(componentValue * discountMultiplier) : undefined,
    low: rangedMembers.length ? roundMoney(rangedMembers.reduce((sum, member) => sum + (member.low ?? 0), 0) * discountMultiplier) : undefined,
    high: rangedMembers.length ? roundMoney(rangedMembers.reduce((sum, member) => sum + (member.high ?? 0), 0) * discountMultiplier) : undefined,
    matchCount,
    pricedBySearch,
    fallbackMembers,
    missingMembers,
    confidence: missingMembers === 0 && pricedBySearch === members.length
      ? "High"
      : missingMembers === 0 || pricedBySearch >= Math.ceil(members.length / 2) ? "Medium" : "Low",
  };
}
