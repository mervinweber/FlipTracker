import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type CompInput = { price: number; shipping?: number };

type AnalysisInput = {
  title: string;
  format?: string;
  edition?: string;
  condition?: string;
  completeness?: string;
  upc?: string;
  purchaseCost: number;
  shippingCost: number;
  packagingCost: number;
  feePercent: number;
  activeCount: number;
  soldCount90: number;
  soldPrices: CompInput[];
  notes?: string;
};

const analysisArgs = {
  assetId: v.optional(v.id("assets")),
  title: v.string(),
  format: v.optional(v.string()),
  edition: v.optional(v.string()),
  condition: v.optional(v.string()),
  completeness: v.optional(v.string()),
  upc: v.optional(v.string()),
  purchaseCost: v.number(),
  shippingCost: v.number(),
  packagingCost: v.number(),
  feePercent: v.number(),
  activeCount: v.number(),
  soldCount90: v.number(),
  soldPrices: v.array(v.object({ price: v.number(), shipping: v.optional(v.number()) })),
  notes: v.optional(v.string()),
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

export function calculateAnalysis(input: AnalysisInput) {
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

  let recommendation = "Pass";
  if (compCount > 0 && soldCount90 > 0) {
    if (expectedProfit >= 10 && roiPercent >= 50 && liquidity >= 40 && confidence !== "Low") recommendation = "Buy";
    else if ((expectedProfit >= 5 && roiPercent >= 25) || (rarity >= 80 && expectedProfit > 0)) recommendation = "Maybe";
  }

  const reasons = [
    `${compCount} observed sold price${compCount === 1 ? "" : "s"}`,
    `${round(sellThroughPercent, 0)}% sell-through proxy`,
    estimatedDaysToSell === undefined ? "no recent sales velocity" : `about ${round(estimatedDaysToSell, 0)} days to sell`,
    `$${round(expectedProfit).toFixed(2)} expected profit`,
    `${round(roiPercent, 0)}% ROI`,
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
    recommendation,
    recommendationReason: reasons.join("; "),
  };
}

async function insertAnalysis(
  ctx: MutationCtx,
  input: AnalysisInput & { assetId?: Id<"assets">; isDemo: boolean; demoKey?: string; sourceLabel: string },
) {
  if (input.soldPrices.length > 100) throw new Error("Use no more than 100 sold-price observations per analysis.");
  if (!input.title.trim()) throw new Error("Title is required.");
  if ([input.purchaseCost, input.shippingCost, input.packagingCost, input.feePercent, input.activeCount, input.soldCount90].some((value) => value < 0)) {
    throw new Error("Counts, costs, and percentages cannot be negative.");
  }
  const now = Date.now();
  const metrics = calculateAnalysis(input);
  const analysisId = await ctx.db.insert("sourcingAnalyses", {
    assetId: input.assetId,
    demoKey: input.demoKey,
    isDemo: input.isDemo,
    title: input.title.trim(),
    format: input.format,
    edition: input.edition,
    condition: input.condition,
    completeness: input.completeness,
    upc: input.upc,
    sourceLabel: input.sourceLabel,
    purchaseCost: round(input.purchaseCost),
    shippingCost: round(input.shippingCost),
    packagingCost: round(input.packagingCost),
    feePercent: round(input.feePercent),
    activeCount: Math.round(input.activeCount),
    soldCount90: Math.round(input.soldCount90),
    ...metrics,
    notes: input.notes,
    analyzedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  for (const comp of input.soldPrices) {
    const itemPrice = round(Math.max(0, comp.price));
    const shipping = round(Math.max(0, comp.shipping ?? 0));
    await ctx.db.insert("sourcingComps", {
      analysisId,
      source: input.sourceLabel,
      itemPrice,
      shipping,
      deliveredPrice: round(itemPrice + shipping),
      observedAt: now,
      createdAt: now,
    });
  }
  return analysisId;
}

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("sourcingAnalyses").withIndex("by_analyzedAt").order("desc").take(250),
});

export const details = query({
  args: { id: v.id("sourcingAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.id);
    if (!analysis) return null;
    const comps = await ctx.db.query("sourcingComps").withIndex("by_analysisId", (q) => q.eq("analysisId", args.id)).take(100);
    return { analysis, comps };
  },
});

export const create = mutation({
  args: analysisArgs,
  handler: async (ctx, args) => await insertAnalysis(ctx, { ...args, isDemo: false, sourceLabel: "Manual eBay Sold Sample" }),
});

export const remove = mutation({
  args: { id: v.id("sourcingAnalyses") },
  handler: async (ctx, args) => {
    const comps = await ctx.db.query("sourcingComps").withIndex("by_analysisId", (q) => q.eq("analysisId", args.id)).take(100);
    for (const comp of comps) await ctx.db.delete(comp._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

const demoInputs: Array<AnalysisInput & { demoKey: string; sourceLabel: string }> = [
  {
    demoKey: "common-mario-kart-wii",
    sourceLabel: "Illustrative Demo Data",
    title: "Mario Kart Wii",
    format: "Wii",
    edition: "Standard",
    condition: "Very Good",
    completeness: "Complete",
    purchaseCost: 3,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 180,
    soldCount90: 360,
    soldPrices: [22.5, 24.99, 25, 25.5, 26, 27.49, 28, 29.99].map((price) => ({ price })),
    notes: "Common, liquid example with enough margin at a low acquisition cost. Values are illustrative, not current eBay data.",
  },
  {
    demoKey: "common-dark-knight-dvd",
    sourceLabel: "Illustrative Demo Data",
    title: "The Dark Knight",
    format: "DVD",
    edition: "Widescreen",
    condition: "Good",
    completeness: "Complete",
    purchaseCost: 0.5,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 420,
    soldCount90: 150,
    soldPrices: [3.5, 3.99, 4.25, 4.5, 4.99, 5, 5.25, 5.99].map((price) => ({ price })),
    notes: "Common low-dollar media example where shipping and fees erase the margin. Values are illustrative.",
  },
  {
    demoKey: "uncommon-ncaa-football-14-ps3",
    sourceLabel: "Illustrative Demo Data",
    title: "NCAA Football 14",
    format: "PlayStation 3",
    edition: "Standard",
    condition: "Very Good",
    completeness: "Complete",
    purchaseCost: 8,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 28,
    soldCount90: 75,
    soldPrices: [35, 36.99, 38, 39.5, 40, 41.99, 42, 44.99].map((price) => ({ price })),
    notes: "Uncommon but liquid game example with strong expected margin. Values are illustrative.",
  },
  {
    demoKey: "niche-godzilla-vs-megalon-dvd",
    sourceLabel: "Illustrative Demo Data",
    title: "Godzilla vs. Megalon",
    format: "DVD",
    edition: "Media Blasters",
    condition: "Very Good",
    completeness: "Complete",
    purchaseCost: 8,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 3,
    soldCount90: 6,
    soldPrices: [28, 31.5, 34.99, 35, 39.99, 44.99].map((price) => ({ price })),
    notes: "Niche collectible example with low supply and enough observed demand. Verify the exact distributor and edition. Values are illustrative.",
  },
  {
    demoKey: "rare-slow-rad-dvd",
    sourceLabel: "Illustrative Demo Data",
    title: "Rad",
    format: "DVD",
    edition: "Out-of-print example",
    condition: "Good",
    completeness: "Complete",
    purchaseCost: 20,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 2,
    soldCount90: 1,
    soldPrices: [{ price: 49.99 }],
    notes: "Scarce but low-confidence example. Rarity alone does not justify an automatic Buy. Values are illustrative.",
  },
  {
    demoKey: "common-black-snake-moan-dvd",
    sourceLabel: "Illustrative Demo Data",
    title: "Black Snake Moan",
    format: "DVD",
    edition: "Standard",
    condition: "Good",
    completeness: "Complete",
    purchaseCost: 1,
    shippingCost: 4.63,
    packagingCost: 0.5,
    feePercent: 13.25,
    activeCount: 95,
    soldCount90: 45,
    soldPrices: [4, 4.25, 4.5, 4.99, 5, 5.25, 5.5, 5.99].map((price) => ({ price })),
    notes: "Recognizable title but weak single-item economics. Values are illustrative.",
  },
];

export const seedExamples = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const demo of demoInputs) {
      const existing = await ctx.db.query("sourcingAnalyses").withIndex("by_demoKey", (q) => q.eq("demoKey", demo.demoKey)).unique();
      if (existing) continue;
      await insertAnalysis(ctx, { ...demo, isDemo: true });
      inserted += 1;
    }
    return { inserted, total: demoInputs.length };
  },
});
