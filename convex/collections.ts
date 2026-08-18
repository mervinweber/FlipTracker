import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentOwnerId } from "./ownership";

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("collections").order("desc").take(100),
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
    if (!existing) throw new Error("Collection not found");
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const assets = await ctx.db.query("assets").withIndex("by_collection", (q) => q.eq("collectionId", args.id)).take(250);
    for (const asset of assets) {
      await ctx.db.patch(asset._id, { collectionId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.delete(args.id);
  },
});
