import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

const MAX_PHOTOS = 12;

function normalized(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function usesCatalogImage(listing: { imageMode?: string; condition?: string }, asset: { type: string; mediaFormat?: string; coverImageUrl?: string }) {
  if (listing.imageMode) return listing.imageMode === "eBay Catalog";
  const condition = normalized(listing.condition);
  const isNew = ["new", "brand new", "sealed"].includes(condition);
  const isBookWithCover = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase().includes("book") && Boolean(asset.coverImageUrl);
  return isNew || isBookWithCover;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const attach = mutation({
  args: {
    assetId: v.id("assets"),
    storageId: v.id("_storage"),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Inventory item not found.");
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    if (photos.length >= MAX_PHOTOS) throw new Error(`An item can have up to ${MAX_PHOTOS} photos.`);
    return await ctx.db.insert("assetPhotos", {
      ...args,
      filename: args.filename?.slice(0, 120),
      contentType: args.contentType?.slice(0, 80),
      position: photos.length,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { photoId: v.id("assetPhotos") },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return;
    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(photo._id);
    const remaining = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", photo.assetId)).collect();
    for (const [position, item] of remaining.sort((a, b) => a.position - b.position).entries()) {
      if (item.position !== position) await ctx.db.patch(item._id, { position });
    }
  },
});

export const replace = mutation({
  args: {
    photoId: v.id("assetPhotos"),
    storageId: v.id("_storage"),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) throw new Error("Photo not found.");
    await ctx.db.patch(photo._id, {
      storageId: args.storageId,
      contentType: args.contentType?.slice(0, 80),
      ebayImageUrl: undefined,
      ebayUploadedAt: undefined,
    });
    await ctx.storage.delete(photo.storageId);
  },
});

export const makePrimary = mutation({
  args: { photoId: v.id("assetPhotos") },
  handler: async (ctx, args) => {
    const selected = await ctx.db.get(args.photoId);
    if (!selected) throw new Error("Photo not found.");
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", selected.assetId)).collect();
    const ordered = photos.sort((a, b) => a.position - b.position);
    for (const photo of ordered) {
      const position = photo._id === selected._id ? 0 : ordered.filter((candidate) => candidate._id !== selected._id && candidate.position < photo.position).length + 1;
      if (photo.position !== position) await ctx.db.patch(photo._id, { position });
    }
  },
});

export const listForAsset = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    return await Promise.all(photos.sort((a, b) => a.position - b.position).map(async (photo) => ({
      ...photo,
      url: await ctx.storage.getUrl(photo.storageId),
    })));
  },
});

async function targetForAsset(ctx: QueryCtx, assetId: Id<"assets">) {
  const asset = await ctx.db.get(assetId);
  if (!asset) return null;
  const listings = await ctx.db.query("marketplaceListings").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
  const listing = listings.find((item) => item.platform.toLowerCase() === "ebay" && ["Draft", "Pending"].includes(item.status)) ?? listings[0];
  const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
  const primary = photos.sort((a, b) => a.position - b.position)[0];
  return {
    assetId: asset._id,
    listingId: listing?._id,
    title: asset.title,
    edition: asset.edition,
    format: asset.mediaFormat || asset.console || asset.type,
    upc: asset.upc || asset.barcode,
    sku: listing?.sku,
    storageLocation: asset.storageLocation,
    condition: listing?.condition || asset.condition,
    photoCount: photos.length + (asset.photoDataUrl ? 1 : 0),
    primaryPhotoUrl: primary ? await ctx.storage.getUrl(primary.storageId) : asset.photoDataUrl,
    hasDraft: Boolean(listing),
  };
}

export const queue = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("marketplaceListings").order("desc").take(500);
    const seen = new Set<string>();
    const results = [];
    for (const listing of listings) {
      if (listing.platform.toLowerCase() !== "ebay" || !["Draft", "Pending"].includes(listing.status) || seen.has(listing.assetId)) continue;
      const asset = await ctx.db.get(listing.assetId);
      if (!asset || usesCatalogImage(listing, asset)) continue;
      seen.add(listing.assetId);
      const target = await targetForAsset(ctx, listing.assetId);
      if (target && target.photoCount === 0) results.push(target);
    }
    return results;
  },
});

export const findByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim();
    if (!code) return [];
    const assetIds = new Set<Id<"assets">>();
    const skuListings = await ctx.db.query("marketplaceListings").withIndex("by_sku", (q) => q.eq("sku", code)).collect();
    for (const listing of skuListings) assetIds.add(listing.assetId);
    const upcAssets = await ctx.db.query("assets").withIndex("by_upc", (q) => q.eq("upc", code)).collect();
    const barcodeAssets = await ctx.db.query("assets").withIndex("by_barcode", (q) => q.eq("barcode", code)).collect();
    for (const asset of [...upcAssets, ...barcodeAssets]) assetIds.add(asset._id);
    const targets = [];
    for (const assetId of [...assetIds].slice(0, 20)) {
      const target = await targetForAsset(ctx, assetId);
      if (target) targets.push(target);
    }
    return targets;
  },
});

export const markEbayUploaded = internalMutation({
  args: {
    photoId: v.id("assetPhotos"),
    ebayImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.photoId, { ebayImageUrl: args.ebayImageUrl, ebayUploadedAt: Date.now() });
  },
});
