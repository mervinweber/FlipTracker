import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { applyOwnerFilter, assertOwner, currentOwnerId } from "./ownership";
import { calculateYearAccounting } from "../src/utils/accounting";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

async function closedYear(ctx: QueryCtx | MutationCtx, ownerId: string | undefined, year: number) {
  return await ctx.db.query("yearEndCloseouts")
    .withIndex("by_ownerId_and_year", (q) => q.eq("ownerId", ownerId).eq("year", year))
    .unique();
}

export const yearSummary = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const sales = applyOwnerFilter(await ctx.db.query("sales").collect(), ownerId);
    const adjustments = applyOwnerFilter(await ctx.db.query("inventoryAdjustments").collect(), ownerId)
      .filter((adjustment) => adjustment.adjustmentType === "Write Off");
    const current = calculateYearAccounting(sales, adjustments, args.year);
    const closeout = await closedYear(ctx, ownerId, args.year);
    return { year: args.year, locked: Boolean(closeout), current, closeout };
  },
});

export const listCloseouts = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    return applyOwnerFilter(await ctx.db.query("yearEndCloseouts").collect(), ownerId)
      .sort((a, b) => b.year - a.year);
  },
});

export const writeOffItem = mutation({
  args: {
    assetId: v.id("assets"),
    effectiveDate: v.string(),
    amount: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const asset = await ctx.db.get(args.assetId);
    assertOwner(asset, ownerId, "Inventory item");
    if (!validDate(args.effectiveDate)) throw new ConvexError("Enter a valid write-off date.");
    if (!Number.isFinite(args.amount) || args.amount <= 0) throw new ConvexError("Write-off amount must be greater than zero.");
    if (!args.reason.trim()) throw new ConvexError("Choose or enter a write-off reason.");
    const year = Number(args.effectiveDate.slice(0, 4));
    if (await closedYear(ctx, ownerId, year)) throw new ConvexError(`${year} is closed. This write-off cannot change a locked year.`);
    if (asset.status === "Sold") throw new ConvexError("A sold item cannot also be written off.");
    if (asset.status === "Written Off") throw new ConvexError("This item has already been written off.");
    const existing = await ctx.db.query("inventoryAdjustments").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).first();
    if (existing) throw new ConvexError("This item already has an accounting adjustment.");

    const listings = await ctx.db.query("marketplaceListings").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    const bundleLinks = await ctx.db.query("listingBundleItems").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    const bundleListings = (await Promise.all(bundleLinks.map((link) => ctx.db.get(link.listingId)))).filter((listing) => listing !== null);
    const protectedListing = [...listings, ...bundleListings].find((listing) => ["Draft", "Pending", "Active"].includes(listing.status));
    if (protectedListing) throw new ConvexError("End or remove the staged/live marketplace listing before writing off this item.");

    const now = Date.now();
    const adjustmentId = await ctx.db.insert("inventoryAdjustments", {
      ownerId,
      assetId: args.assetId,
      adjustmentType: "Write Off",
      effectiveDate: args.effectiveDate,
      amount: Math.round(args.amount * 100) / 100,
      reason: args.reason.trim().slice(0, 120),
      notes: args.notes?.trim().slice(0, 2_000) || undefined,
      createdAt: now,
    });
    await ctx.db.patch(args.assetId, {
      status: "Written Off",
      writtenOffDate: args.effectiveDate,
      writeOffAmount: Math.round(args.amount * 100) / 100,
      writeOffReason: args.reason.trim().slice(0, 120),
      needsValueCheck: false,
      updatedAt: now,
    });
    for (const listing of listings.filter((row) => ["Draft", "Pending"].includes(row.status))) {
      await ctx.db.patch(listing._id, { status: "Cancelled", updatedAt: now });
      await ctx.db.insert("listingEvents", {
        ownerId,
        listingId: listing._id,
        assetId: args.assetId,
        eventType: "written_off",
        source: "FlipTracker Accounting",
        message: `Inventory written off for $${args.amount.toFixed(2)}.`,
        fromStatus: listing.status,
        toStatus: "Cancelled",
        createdAt: now,
      });
    }
    return { adjustmentId, amount: Math.round(args.amount * 100) / 100, year };
  },
});

export const closeYear = mutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const currentYear = new Date().getUTCFullYear();
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year >= currentYear) {
      throw new ConvexError(`Only completed years before ${currentYear} can be closed.`);
    }
    const existing = await closedYear(ctx, ownerId, args.year);
    if (existing) return { id: existing._id, alreadyClosed: true, netProfit: existing.netProfit };
    const sales = applyOwnerFilter(await ctx.db.query("sales").collect(), ownerId);
    const adjustments = applyOwnerFilter(await ctx.db.query("inventoryAdjustments").collect(), ownerId)
      .filter((adjustment) => adjustment.adjustmentType === "Write Off");
    const totals = calculateYearAccounting(sales, adjustments, args.year);
    const id = await ctx.db.insert("yearEndCloseouts", { ownerId, ...totals, closedAt: Date.now() });
    return { id, alreadyClosed: false, netProfit: totals.netProfit };
  },
});
