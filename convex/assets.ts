import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const assetInput = {
  type: v.string(),
  console: v.optional(v.string()),
  title: v.string(),
  edition: v.optional(v.string()),
  mediaFormat: v.optional(v.string()),
  upc: v.optional(v.string()),
  barcodeType: v.optional(v.string()),
  releaseYear: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
  studio: v.optional(v.string()),
  author: v.optional(v.string()),
  rating: v.optional(v.string()),
  cardProductType: v.optional(v.string()),
  cardGame: v.optional(v.string()),
  cardSport: v.optional(v.string()),
  cardSet: v.optional(v.string()),
  cardNumber: v.optional(v.string()),
  cardPlayer: v.optional(v.string()),
  cardTeam: v.optional(v.string()),
  coverImageUrl: v.optional(v.string()),
  photoDataUrl: v.optional(v.string()),
  metadataSource: v.optional(v.string()),
  metadataConfidence: v.optional(v.string()),
  metadataCheckedAt: v.optional(v.number()),
  collectionId: v.optional(v.id("collections")),
  storageLocation: v.optional(v.string()),
  estimatedLow: v.optional(v.number()),
  estimatedHigh: v.optional(v.number()),
  userLow: v.optional(v.number()),
  userHigh: v.optional(v.number()),
  valueSource: v.optional(v.string()),
  needsValueCheck: v.optional(v.boolean()),
  localLow: v.optional(v.number()),
  localHigh: v.optional(v.number()),
  priority: v.optional(v.string()),
  strategy: v.optional(v.string()),
  listingRecommendation: v.optional(v.string()),
  status: v.optional(v.string()),
  purchasePrice: v.optional(v.number()),
  soldPrice: v.optional(v.number()),
  fees: v.optional(v.number()),
  shipping: v.optional(v.number()),
  condition: v.optional(v.string()),
  completeness: v.optional(v.string()),
  complete: v.optional(v.boolean()),
  manual: v.optional(v.boolean()),
  aiDescription: v.optional(v.string()),
  itemDisclosures: v.optional(v.string()),
  barcode: v.optional(v.string()),
  ebayTitle: v.optional(v.string()),
  ebayDescription: v.optional(v.string()),
  ebayCategory: v.optional(v.string()),
  ebayCategoryId: v.optional(v.string()),
  ebayCondition: v.optional(v.string()),
  ebayItemSpecifics: v.optional(v.string()),
  ebayPrice: v.optional(v.number()),
  ebayShipping: v.optional(v.string()),
  notes: v.optional(v.string()),
  confidence: v.optional(v.string()),
};

const assetPatch = {
  type: v.optional(v.string()),
  console: v.optional(v.string()),
  title: v.optional(v.string()),
  edition: v.optional(v.string()),
  mediaFormat: v.optional(v.string()),
  upc: v.optional(v.string()),
  barcodeType: v.optional(v.string()),
  releaseYear: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
  studio: v.optional(v.string()),
  author: v.optional(v.string()),
  rating: v.optional(v.string()),
  cardProductType: v.optional(v.string()),
  cardGame: v.optional(v.string()),
  cardSport: v.optional(v.string()),
  cardSet: v.optional(v.string()),
  cardNumber: v.optional(v.string()),
  cardPlayer: v.optional(v.string()),
  cardTeam: v.optional(v.string()),
  coverImageUrl: v.optional(v.string()),
  photoDataUrl: v.optional(v.string()),
  metadataSource: v.optional(v.string()),
  metadataConfidence: v.optional(v.string()),
  metadataCheckedAt: v.optional(v.number()),
  collectionId: v.optional(v.id("collections")),
  storageLocation: v.optional(v.string()),
  estimatedLow: v.optional(v.number()),
  estimatedHigh: v.optional(v.number()),
  userLow: v.optional(v.number()),
  userHigh: v.optional(v.number()),
  valueSource: v.optional(v.string()),
  needsValueCheck: v.optional(v.boolean()),
  localLow: v.optional(v.number()),
  localHigh: v.optional(v.number()),
  priority: v.optional(v.string()),
  strategy: v.optional(v.string()),
  listingRecommendation: v.optional(v.string()),
  status: v.optional(v.string()),
  purchasePrice: v.optional(v.number()),
  soldPrice: v.optional(v.number()),
  fees: v.optional(v.number()),
  shipping: v.optional(v.number()),
  condition: v.optional(v.string()),
  completeness: v.optional(v.string()),
  complete: v.optional(v.boolean()),
  manual: v.optional(v.boolean()),
  aiDescription: v.optional(v.string()),
  itemDisclosures: v.optional(v.string()),
  barcode: v.optional(v.string()),
  ebayTitle: v.optional(v.string()),
  ebayDescription: v.optional(v.string()),
  ebayCategory: v.optional(v.string()),
  ebayCategoryId: v.optional(v.string()),
  ebayCondition: v.optional(v.string()),
  ebayItemSpecifics: v.optional(v.string()),
  ebayPrice: v.optional(v.number()),
  ebayShipping: v.optional(v.string()),
  notes: v.optional(v.string()),
  confidence: v.optional(v.string()),
};

function matchesMediaType(type: string, filter?: string) {
  if (!filter || filter === "All") return true;
  if (filter === "Cards") return type.toLowerCase().includes("card");
  return type === filter;
}

export const list = query({
  args: {
    console: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    unassignedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.search?.trim()) {
      const searched = await ctx.db
        .query("assets")
        .withSearchIndex("search_title", (q) => {
          let s = q.search("title", args.search!.trim());
          if (args.console && args.console !== "All") s = s.eq("console", args.console);
          if (args.status && args.status !== "All") s = s.eq("status", args.status);
          return s;
        })
        .take(250);
      return searched
        .filter((r) => matchesMediaType(r.type, args.mediaType))
        .filter((r) => !args.collectionId || r.collectionId === args.collectionId)
        .filter((r) => !args.unassignedOnly || !r.collectionId);
    }

    if (args.collectionId) {
      const rows = await ctx.db.query("assets").withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId)).take(250);
      return rows
        .filter((r) => matchesMediaType(r.type, args.mediaType))
        .filter((r) => !args.console || args.console === "All" || r.console === args.console)
        .filter((r) => !args.status || args.status === "All" || r.status === args.status)
        .sort((a, b) => (a.console || "").localeCompare(b.console || "") || (b.estimatedHigh || 0) - (a.estimatedHigh || 0));
    }

    const rows = await ctx.db.query("assets").take(250);
    return rows
      .filter((r) => matchesMediaType(r.type, args.mediaType))
      .filter((r) => !args.console || args.console === "All" || r.console === args.console)
      .filter((r) => !args.status || args.status === "All" || r.status === args.status)
      .filter((r) => !args.unassignedOnly || !r.collectionId)
      .sort((a, b) => (a.console || "").localeCompare(b.console || "") || (b.estimatedHigh || 0) - (a.estimatedHigh || 0));
  },
});

export const create = mutation({
  args: assetInput,
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("assets", { ...args, needsValueCheck: args.needsValueCheck ?? false, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: { id: v.id("assets"), ...assetPatch },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Asset not found");

    const valueInputsChanged =
      (patch.title !== undefined && patch.title !== existing.title) ||
      (patch.edition !== undefined && patch.edition !== existing.edition) ||
      (patch.barcode !== undefined && patch.barcode !== existing.barcode) ||
      (patch.upc !== undefined && patch.upc !== existing.upc) ||
      (patch.condition !== undefined && patch.condition !== existing.condition) ||
      (patch.completeness !== undefined && patch.completeness !== existing.completeness) ||
      patch.userLow !== undefined ||
      patch.userHigh !== undefined ||
      patch.estimatedLow !== undefined ||
      patch.estimatedHigh !== undefined;

    await ctx.db.patch(id, {
      ...patch,
      needsValueCheck: valueInputsChanged ? (patch.needsValueCheck ?? true) : patch.needsValueCheck,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => {
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.id)).collect();
    for (const photo of photos) {
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const removeMany = mutation({
  args: { ids: v.array(v.id("assets")) },
  handler: async (ctx, args) => {
    const ids = [...new Set(args.ids)];
    if (!ids.length) return { deleted: 0, deletedListings: 0, blocked: undefined };
    if (ids.length > 100) throw new Error("Bulk delete supports up to 100 inventory items at a time.");

    const records = [];
    for (const id of ids) {
      const asset = await ctx.db.get(id);
      if (!asset) continue;
      const sales = await ctx.db.query("sales").withIndex("by_asset", (q) => q.eq("assetId", id)).take(1);
      const listings = await ctx.db.query("marketplaceListings").withIndex("by_assetId", (q) => q.eq("assetId", id)).collect();
      const protectedListing = listings.find((listing) =>
        !["Draft", "Pending"].includes(listing.status) || Boolean(listing.ebayOfferId || listing.externalListingId),
      );
      if (sales.length || protectedListing) {
        return {
          deleted: 0,
          deletedListings: 0,
          blocked: `Cannot bulk delete "${asset.title}" because it has a sale, staged eBay offer, or active/sold listing. No selected items were deleted.`,
        };
      }
      records.push({ asset, listings });
    }

    let deletedListings = 0;
    for (const { asset, listings } of records) {
      for (const listing of listings) {
        const history = await ctx.db.query("listingPriceHistory").withIndex("by_listingId", (q) => q.eq("listingId", listing._id)).collect();
        for (const entry of history) await ctx.db.delete(entry._id);
        await ctx.db.delete(listing._id);
        deletedListings += 1;
      }

      const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", asset._id)).collect();
      for (const photo of photos) {
        await ctx.storage.delete(photo.storageId);
        await ctx.db.delete(photo._id);
      }
      const valueHistory = await ctx.db.query("valueHistory").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).collect();
      for (const entry of valueHistory) await ctx.db.delete(entry._id);
      const researchChecks = await ctx.db.query("researchChecks").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).collect();
      for (const check of researchChecks) await ctx.db.delete(check._id);
      const analyses = await ctx.db.query("sourcingAnalyses").withIndex("by_assetId", (q) => q.eq("assetId", asset._id)).collect();
      for (const analysis of analyses) await ctx.db.patch(analysis._id, { assetId: undefined });
      await ctx.db.delete(asset._id);
    }

    return { deleted: records.length, deletedListings, blocked: undefined };
  },
});

export const importMany = mutation({
  args: { assets: v.array(v.object(assetInput)) },
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
