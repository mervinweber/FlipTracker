import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOwner, currentOwnerId } from "./ownership";

const platforms = ["Poshmark", "Mercari", "Depop", "Facebook Marketplace", "OfferUp", "Craigslist", "Other"];
const statuses = ["Ready", "Listed", "Sold", "Ended", "Needs Review"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    let rows = await ctx.db.query("crossListings").order("desc").take(500);
    if (ownerId) rows = rows.filter((row) => row.ownerId === ownerId);
    return await Promise.all(rows.map(async (row) => {
      const asset = await ctx.db.get(row.assetId);
      const linkedAccount = row.linkedAccountId ? await ctx.db.get(row.linkedAccountId) : undefined;
      const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", row.assetId)).collect();
      const primaryPhoto = photos.sort((a, b) => a.position - b.position)[0];
      const photoUrl = primaryPhoto ? await ctx.storage.getUrl(primaryPhoto.storageId) : undefined;
      return {
        ...row,
        assetTitle: asset?.title ?? "Missing inventory item",
        assetType: asset?.type,
        assetStatus: asset?.status,
        assetLocation: asset?.storageLocation,
        assetPhotoUrl: photoUrl || asset?.photoDataUrl || asset?.coverImageUrl,
        assetBarcode: asset?.upc || asset?.barcode,
        photoCount: photos.length + (asset?.photoDataUrl ? 1 : 0),
        linkedAccountPlatform: linkedAccount?.platform,
        linkedAccountName: linkedAccount?.accountName,
        linkedAccountLoginUrl: linkedAccount?.loginUrl,
        linkedAccountProfileUrl: linkedAccount?.profileUrl,
        linkedAccountStatus: linkedAccount?.status,
      };
    }));
  },
});

export const create = mutation({
  args: {
    assetId: v.id("assets"),
    platform: v.string(),
    status: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    listingUrl: v.optional(v.string()),
    externalListingId: v.optional(v.string()),
    sku: v.optional(v.string()),
    linkedAccountId: v.optional(v.id("linkedAccounts")),
    category: v.optional(v.string()),
    platformCategory: v.optional(v.string()),
    condition: v.optional(v.string()),
    price: v.optional(v.number()),
    shippingPrice: v.optional(v.number()),
    fees: v.optional(v.number()),
    soldPrice: v.optional(v.number()),
    saleChannelDetail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    assertOwner(asset, ownerId, "Inventory item");
    if (args.linkedAccountId) assertOwner(await ctx.db.get(args.linkedAccountId), ownerId, "Linked account");
    return await ctx.db.insert("crossListings", {
      ownerId,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("crossListings"),
    platform: v.optional(v.string()),
    status: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    listingUrl: v.optional(v.string()),
    externalListingId: v.optional(v.string()),
    sku: v.optional(v.string()),
    linkedAccountId: v.optional(v.id("linkedAccounts")),
    category: v.optional(v.string()),
    platformCategory: v.optional(v.string()),
    condition: v.optional(v.string()),
    price: v.optional(v.number()),
    shippingPrice: v.optional(v.number()),
    fees: v.optional(v.number()),
    soldPrice: v.optional(v.number()),
    saleChannelDetail: v.optional(v.string()),
    notes: v.optional(v.string()),
    soldAt: v.optional(v.number()),
    listedAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    const ownerId = await currentOwnerId(ctx);
    assertOwner(existing, ownerId, "Cross listing");
    if (patch.linkedAccountId) assertOwner(await ctx.db.get(patch.linkedAccountId), ownerId, "Linked account");
    const now = Date.now();
    await ctx.db.patch(id, { ...patch, updatedAt: now });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("crossListings") },
  handler: async (ctx, args) => {
    assertOwner(await ctx.db.get(args.id), await currentOwnerId(ctx), "Cross listing");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const markSold = mutation({
  args: {
    id: v.id("crossListings"),
    soldPrice: v.number(),
    soldAt: v.optional(v.number()),
    fees: v.optional(v.number()),
    shippingPrice: v.optional(v.number()),
    saleChannelDetail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    assertOwner(existing, await currentOwnerId(ctx), "Cross listing");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "Sold",
      soldPrice: args.soldPrice,
      soldAt: args.soldAt ?? now,
      fees: args.fees,
      shippingPrice: args.shippingPrice,
      saleChannelDetail: args.saleChannelDetail,
      notes: args.notes ?? existing.notes,
      updatedAt: now,
    });
    return args.id;
  },
});

export { platforms as platformOptions, statuses as statusOptions };
