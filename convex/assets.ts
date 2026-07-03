import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { console: v.optional(v.string()), status: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.search?.trim()) {
      return await ctx.db
        .query("assets")
        .withSearchIndex("search_title", (q) => {
          let s = q.search("title", args.search!.trim());
          if (args.console && args.console !== "All") s = s.eq("console", args.console);
          if (args.status && args.status !== "All") s = s.eq("status", args.status);
          return s;
        })
        .take(250);
    }
    const rows = await ctx.db.query("assets").collect();
    return rows
      .filter((r) => !args.console || args.console === "All" || r.console === args.console)
      .filter((r) => !args.status || args.status === "All" || r.status === args.status)
      .sort((a, b) => (a.console || "").localeCompare(b.console || "") || (b.estimatedHigh || 0) - (a.estimatedHigh || 0));
  },
});

export const create = mutation({
  args: {
    type: v.string(), console: v.optional(v.string()), title: v.string(), edition: v.optional(v.string()),
    estimatedLow: v.optional(v.number()), estimatedHigh: v.optional(v.number()),
    userLow: v.optional(v.number()), userHigh: v.optional(v.number()), valueSource: v.optional(v.string()),
    needsValueCheck: v.optional(v.boolean()),
    localLow: v.optional(v.number()), localHigh: v.optional(v.number()), priority: v.optional(v.string()),
    strategy: v.optional(v.string()), status: v.optional(v.string()), purchasePrice: v.optional(v.number()),
    soldPrice: v.optional(v.number()), fees: v.optional(v.number()), shipping: v.optional(v.number()),
    condition: v.optional(v.string()), complete: v.optional(v.boolean()), manual: v.optional(v.boolean()),
    barcode: v.optional(v.string()), notes: v.optional(v.string()), confidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("assets", { ...args, needsValueCheck: args.needsValueCheck ?? false, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("assets"), type: v.optional(v.string()), console: v.optional(v.string()), title: v.optional(v.string()),
    edition: v.optional(v.string()), estimatedLow: v.optional(v.number()), estimatedHigh: v.optional(v.number()),
    userLow: v.optional(v.number()), userHigh: v.optional(v.number()), valueSource: v.optional(v.string()),
    needsValueCheck: v.optional(v.boolean()), localLow: v.optional(v.number()), localHigh: v.optional(v.number()),
    priority: v.optional(v.string()), strategy: v.optional(v.string()), status: v.optional(v.string()),
    purchasePrice: v.optional(v.number()), soldPrice: v.optional(v.number()), fees: v.optional(v.number()),
    shipping: v.optional(v.number()), condition: v.optional(v.string()), complete: v.optional(v.boolean()),
    manual: v.optional(v.boolean()), barcode: v.optional(v.string()), notes: v.optional(v.string()),
    confidence: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Asset not found");
    const titleChanged = patch.title !== undefined && patch.title !== existing.title;
    await ctx.db.patch(id, { ...patch, needsValueCheck: titleChanged ? (patch.needsValueCheck ?? true) : patch.needsValueCheck, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

export const importMany = mutation({
  args: {
    assets: v.array(v.object({
      type: v.string(), console: v.optional(v.string()), title: v.string(), edition: v.optional(v.string()),
      estimatedLow: v.optional(v.number()), estimatedHigh: v.optional(v.number()),
      userLow: v.optional(v.number()), userHigh: v.optional(v.number()), valueSource: v.optional(v.string()),
      needsValueCheck: v.optional(v.boolean()),
      localLow: v.optional(v.number()), localHigh: v.optional(v.number()), priority: v.optional(v.string()),
      strategy: v.optional(v.string()), status: v.optional(v.string()), purchasePrice: v.optional(v.number()),
      soldPrice: v.optional(v.number()), fees: v.optional(v.number()), shipping: v.optional(v.number()),
      condition: v.optional(v.string()), complete: v.optional(v.boolean()), manual: v.optional(v.boolean()),
      barcode: v.optional(v.string()), notes: v.optional(v.string()), confidence: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = [];

    for (const asset of args.assets) {
      ids.push(await ctx.db.insert("assets", {
        ...asset,
        needsValueCheck: asset.needsValueCheck ?? false,
        createdAt: now,
        updatedAt: now,
      }));
    }

    return { imported: ids.length, ids };
  },
});
