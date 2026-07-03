import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("collections").order("desc").collect(),
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
    return await ctx.db.insert("collections", { ...args, createdAt: now, updatedAt: now });
  },
});
