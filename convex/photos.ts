import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { assertOwner, currentOwnerId } from "./ownership";

const MAX_PHOTOS = 12;

function recommendedPhotoCount(asset: { type: string; mediaFormat?: string; title: string }) {
  const identity = `${asset.type} ${asset.mediaFormat ?? ""} ${asset.title}`.toLowerCase();
  if (/\bbook\b|isbn/.test(identity)) return 2;
  if (/dvd|blu[ -]?ray|movie|cd|music/.test(identity)) return 3;
  if (/video game|\bgame\b|playstation|xbox|nintendo/.test(identity)) return 4;
  if (/card|tcg|ccg|pokemon|pokémon|yu-gi-oh|yugioh/.test(identity)) return 2;
  if (/clothing|apparel|shirt|pants|jeans|dress|jacket|coat|sweater|hoodie|shoe|boot/.test(identity)) return 5;
  return 4;
}

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
  handler: async (ctx) => {
    await currentOwnerId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: {
    assetId: v.id("assets"),
    storageId: v.id("_storage"),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const asset = await ctx.db.get(args.assetId);
    assertOwner(asset, ownerId, "Inventory item");
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    if (photos.length >= MAX_PHOTOS) throw new Error(`An item can have up to ${MAX_PHOTOS} photos.`);
    return await ctx.db.insert("assetPhotos", {
      ...args,
      ownerId: asset.ownerId,
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
    const ownerId = await currentOwnerId(ctx);
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return;
    assertOwner(photo, ownerId, "Photo");
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
    const ownerId = await currentOwnerId(ctx);
    const photo = await ctx.db.get(args.photoId);
    assertOwner(photo, ownerId, "Photo");
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
    const ownerId = await currentOwnerId(ctx);
    const selected = await ctx.db.get(args.photoId);
    assertOwner(selected, ownerId, "Photo");
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
    const ownerId = await currentOwnerId(ctx);
    assertOwner(await ctx.db.get(args.assetId), ownerId, "Inventory item");
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    return await Promise.all(photos.sort((a, b) => a.position - b.position).map(async (photo) => ({
      ...photo,
      url: await ctx.storage.getUrl(photo.storageId),
    })));
  },
});

async function targetForAsset(ctx: QueryCtx, assetId: Id<"assets">, ownerId?: string) {
  const asset = await ctx.db.get(assetId);
  if (!asset || (ownerId && asset.ownerId !== ownerId)) return null;
  const listings = await ctx.db.query("marketplaceListings").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
  const listing = listings.find((item) => item.platform.toLowerCase() === "ebay" && ["Draft", "Pending"].includes(item.status)) ?? listings[0];
  const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
  const primary = photos.sort((a, b) => a.position - b.position)[0];
  return {
    assetId: asset._id,
    listingId: listing?._id,
    title: asset.title,
    assetType: asset.type,
    edition: asset.edition,
    format: asset.mediaFormat || asset.console || asset.type,
    upc: asset.upc || asset.barcode,
    sku: listing?.sku,
    storageLocation: asset.storageLocation,
    condition: listing?.condition || asset.condition,
    photoCount: photos.length + (asset.photoDataUrl ? 1 : 0),
    primaryPhotoUrl: primary ? await ctx.storage.getUrl(primary.storageId) : asset.photoDataUrl,
    hasDraft: Boolean(listing),
    photosCompleteAt: listing?.photosCompleteAt,
  };
}

export const markComplete = mutation({
  args: { listingId: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const listing = await ctx.db.get(args.listingId);
    assertOwner(listing, ownerId, "Listing");
    const asset = await ctx.db.get(listing.assetId);
    assertOwner(asset, ownerId, "Inventory item");
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", listing.assetId)).collect();
    if (!photos.length && !asset.photoDataUrl) throw new Error("Add at least one actual item photo before completing this item.");
    const completedAt = Date.now();
    await ctx.db.patch(listing._id, { photosCompleteAt: completedAt, updatedAt: completedAt });
    return { completedAt, photoCount: photos.length + (asset.photoDataUrl ? 1 : 0) };
  },
});

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Could not read the legacy photo data.");
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

export const legacyPhotoAssets = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const rows = await ctx.db.query("assets").take(Math.min(Math.max(args.limit ?? 50, 1), 250));
    return rows.filter((asset) => Boolean(asset.photoDataUrl) && (!ownerId || asset.ownerId === ownerId));
  },
});

export const migrateLegacyPhotoAsset = internalMutation({
  args: {
    assetId: v.id("assets"),
    storageId: v.id("_storage"),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || !asset.photoDataUrl) return { migrated: false };
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", args.assetId)).collect();
    const ordered = photos.sort((a, b) => a.position - b.position);
    for (const photo of ordered) await ctx.db.patch(photo._id, { position: photo.position + 1 });
    await ctx.db.insert("assetPhotos", {
      ownerId: asset.ownerId,
      assetId: args.assetId,
      storageId: args.storageId,
      contentType: args.contentType?.slice(0, 80),
      filename: "legacy-photo",
      position: 0,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.assetId, { photoDataUrl: undefined, updatedAt: Date.now() });
    return { migrated: true };
  },
});

export const migrateLegacyPhotos = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const legacy: Array<{ _id: Id<"assets">; photoDataUrl?: string }> = await ctx.runQuery(api.photos.legacyPhotoAssets, { limit: args.limit ?? 50 });
    let migrated = 0;
    for (const asset of legacy) {
      if (!asset.photoDataUrl) continue;
      const { blob, contentType } = dataUrlToBlob(asset.photoDataUrl);
      const uploadUrl = await ctx.storage.generateUploadUrl();
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: blob });
      if (!response.ok) throw new Error("Legacy photo migration upload failed.");
      const result = await response.json() as { storageId: Id<"_storage"> };
      const outcome: { migrated: boolean } = await ctx.runMutation(internal.photos.migrateLegacyPhotoAsset, {
        assetId: asset._id,
        storageId: result.storageId,
        contentType,
      });
      if (outcome.migrated) migrated += 1;
    }
    return { migrated };
  },
});

export const queue = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const listings = await ctx.db.query("marketplaceListings").order("desc").take(500);
    const seen = new Set<string>();
    const results = [];
    for (const listing of listings) {
      if ((ownerId && listing.ownerId !== ownerId) || listing.platform.toLowerCase() !== "ebay" || !["Draft", "Pending"].includes(listing.status) || seen.has(listing.assetId)) continue;
      const asset = await ctx.db.get(listing.assetId);
      if (!asset || usesCatalogImage(listing, asset)) continue;
      seen.add(listing.assetId);
      const target = await targetForAsset(ctx, listing.assetId, ownerId);
      if (target && !listing.photosCompleteAt && target.photoCount < recommendedPhotoCount(asset)) results.push(target);
    }
    return results;
  },
});

export const findByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const code = args.code.trim();
    if (!code) return [];
    const assetIds = new Set<Id<"assets">>();
    const skuListings = await ctx.db.query("marketplaceListings").withIndex("by_sku", (q) => q.eq("sku", code)).collect();
    for (const listing of skuListings) if (!ownerId || listing.ownerId === ownerId) assetIds.add(listing.assetId);
    const upcAssets = await ctx.db.query("assets").withIndex("by_upc", (q) => q.eq("upc", code)).collect();
    const barcodeAssets = await ctx.db.query("assets").withIndex("by_barcode", (q) => q.eq("barcode", code)).collect();
    for (const asset of [...upcAssets, ...barcodeAssets]) if (!ownerId || asset.ownerId === ownerId) assetIds.add(asset._id);
    const targets = [];
    for (const assetId of [...assetIds].slice(0, 20)) {
      const target = await targetForAsset(ctx, assetId, ownerId);
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
