import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applyOwnerFilter, assertOwner, currentOwnerId } from "./ownership";

export const list = query({
  args: {},
  handler: async (ctx) => applyOwnerFilter(await ctx.db.query("collections").order("desc").take(100), await currentOwnerId(ctx)),
});

export const create = mutation({
  args: {
    name: v.string(),
    source: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("collections", { ...args, ownerId: await currentOwnerId(ctx), createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    assertOwner(existing, await currentOwnerId(ctx), "Collection");
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    assertOwner(await ctx.db.get(args.id), ownerId, "Collection");
    const assets = await ctx.db.query("assets").withIndex("by_collection", (q) => q.eq("collectionId", args.id)).take(250);
    for (const asset of assets) {
      if (ownerId && asset.ownerId !== ownerId) continue;
      await ctx.db.patch(asset._id, { collectionId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.delete(args.id);
  },
});
