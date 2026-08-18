import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentOwnerId } from "./ownership";

const platforms = ["eBay", "Poshmark", "Mercari", "Depop", "Facebook Marketplace", "OfferUp", "Craigslist", "Other"];
const statuses = ["Linked", "Needs Login", "Paused", "Disconnected"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    let rows = await ctx.db.query("linkedAccounts").order("desc").take(200);
    if (ownerId) rows = rows.filter((row) => row.ownerId === ownerId);
    return rows;
  },
});

export const create = mutation({
  args: {
    platform: v.string(),
    accountName: v.string(),
    username: v.optional(v.string()),
    loginUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    return await ctx.db.insert("linkedAccounts", { ownerId, ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("linkedAccounts"),
    platform: v.optional(v.string()),
    accountName: v.optional(v.string()),
    username: v.optional(v.string()),
    loginUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Linked account not found");
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("linkedAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export { platforms as platformOptions, statuses as statusOptions };
