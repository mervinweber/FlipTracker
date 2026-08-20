import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applyOwnerFilter, currentOwnerId } from "./ownership";

const defaults = {
  source: v.optional(v.string()),
  purchaseTotal: v.optional(v.number()),
  defaultCondition: v.optional(v.string()),
  defaultCompleteness: v.optional(v.string()),
  defaultCollectionId: v.optional(v.id("collections")),
  defaultStorageLocation: v.optional(v.string()),
  defaultPurchasePrice: v.optional(v.number()),
  defaultListingPrice: v.optional(v.number()),
  defaultShippingPlan: v.optional(v.string()),
  defaultSkuPrefix: v.optional(v.string()),
  createDraft: v.optional(v.boolean()),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const batches = applyOwnerFilter(await ctx.db.query("intakeBatches").withIndex("by_updatedAt").order("desc").take(50), ownerId);
    return await Promise.all(batches.map(async (batch) => {
      const items = applyOwnerFilter(await ctx.db.query("intakeBatchItems").withIndex("by_batchId", (q) => q.eq("batchId", batch._id)).take(500), ownerId);
      return {
        ...batch,
        counts: {
          total: items.length,
          saved: items.filter((item) => item.status === "Saved").length,
          review: items.filter((item) => item.status === "Review").length,
          drafts: items.filter((item) => Boolean(item.listingId)).length,
        },
      };
    }));
  },
});

export const getItems = query({
  args: { batchId: v.optional(v.id("intakeBatches")) },
  handler: async (ctx, args) => {
    if (!args.batchId) return [];
    const ownerId = await currentOwnerId(ctx);
    return applyOwnerFilter(await ctx.db.query("intakeBatchItems").withIndex("by_batchId", (q) => q.eq("batchId", args.batchId!)).order("desc").take(500), ownerId);
  },
});

export const create = mutation({
  args: { name: v.string(), ...defaults },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Batch name is required.");
    if (args.purchaseTotal !== undefined && args.purchaseTotal < 0) throw new Error("Purchase total cannot be negative.");
    const now = Date.now();
    return await ctx.db.insert("intakeBatches", {
      ...args,
      name,
      ownerId: await currentOwnerId(ctx),
      status: "Active",
      createDraft: args.createDraft ?? true,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("intakeBatches"), name: v.optional(v.string()), ...defaults },
  handler: async (ctx, { id, ...patch }) => {
    const batch = await ctx.db.get(id);
    if (!batch) throw new Error("Intake batch not found.");
    if (patch.name !== undefined && !patch.name.trim()) throw new Error("Batch name is required.");
    if (patch.purchaseTotal !== undefined && patch.purchaseTotal < 0) throw new Error("Purchase total cannot be negative.");
    await ctx.db.patch(id, { ...patch, name: patch.name?.trim(), updatedAt: Date.now() });
  },
});

export const setStatus = mutation({
  args: { id: v.id("intakeBatches"), status: v.union(v.literal("Active"), v.literal("Paused"), v.literal("Completed")) },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.id);
    if (!batch) throw new Error("Intake batch not found.");
    const now = Date.now();
    await ctx.db.patch(args.id, { status: args.status, completedAt: args.status === "Completed" ? now : undefined, updatedAt: now });
  },
});
