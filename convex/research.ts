import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentOwnerId } from "./ownership";

export const addValueCheck = mutation({
  args: {
    assetId: v.id("assets"),
    source: v.string(),
    low: v.optional(v.number()),
    high: v.optional(v.number()),
    observedPrice: v.optional(v.number()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    confidence: v.string(),
    recommendation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    await ctx.db.insert("valueHistory", {
      ownerId,
      assetId: args.assetId, source: args.source, low: args.low, high: args.high,
      observedPrice: args.observedPrice, url: args.url, notes: args.notes, checkedAt: now,
    });
    await ctx.db.insert("researchChecks", {
      ownerId,
      assetId: args.assetId, method: args.source, confidence: args.confidence,
      recommendation: args.recommendation, notes: args.notes, createdAt: now,
    });
    await ctx.db.patch(args.assetId, {
      userLow: args.low, userHigh: args.high, valueSource: "User Override",
      needsValueCheck: false, lastValueCheckAt: now, updatedAt: now,
    });
  },
});

export const historyForAsset = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) =>
    await ctx.db.query("valueHistory").withIndex("by_asset", (q) => q.eq("assetId", args.assetId)).collect(),
});
