import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOwner, currentOwnerId } from "./ownership";
import type { Doc, Id } from "./_generated/dataModel";

const platforms = ["Mercari", "Depop"];
const statuses = ["Ready", "Listed", "Sold", "Ended", "Needs Review"];

function applyOwner<T extends { ownerId?: string }>(rows: T[], ownerId?: string) {
  return ownerId ? rows.filter((row) => row.ownerId === ownerId) : rows;
}

function family(asset?: Pick<Doc<"assets">, "type" | "mediaFormat"> | null) {
  const value = `${asset?.type ?? ""} ${asset?.mediaFormat ?? ""}`.toLowerCase();
  if (value.includes("book") || value.includes("graphic novel") || value.includes("manga")) return "book";
  if (value.includes("dvd") || value.includes("blu") || value.includes("cd") || value.includes("movie")) return "media";
  if (value.includes("game")) return "videoGame";
  if (value.includes("card") || value.includes("pokemon") || value.includes("yu-gi") || value.includes("sports")) return "card";
  if (value.includes("cloth") || value.includes("apparel") || value.includes("shirt") || value.includes("jean")) return "clothing";
  return "general";
}

function defaultCategory(platform: string, asset?: Pick<Doc<"assets">, "type" | "mediaFormat"> | null) {
  const assetFamily = family(asset);
  if (platform === "Mercari") {
    if (assetFamily === "book") return "Books";
    if (assetFamily === "media") return "Electronics > Movies & TV";
    if (assetFamily === "videoGame") return "Electronics > Video Games";
    if (assetFamily === "card") return "Collectibles > Trading Cards";
    if (assetFamily === "clothing") return "Men > Clothing";
    return "Other";
  }
  if (assetFamily === "book") return "Books & Media";
  if (assetFamily === "media") return "Film / DVDs";
  if (assetFamily === "videoGame") return "Video Games";
  if (assetFamily === "card") return "Collectibles";
  if (assetFamily === "clothing") return "Menswear";
  return "Everything Else";
}

function normalizeCondition(condition?: string, asset?: Pick<Doc<"assets">, "type" | "mediaFormat"> | null) {
  const value = (condition || "").toLowerCase();
  if (family(asset) === "clothing") {
    if (value.includes("tag")) return "New with tags";
    if (value.includes("new")) return "New without tags";
    if (value.includes("like")) return "Like new";
    if (value.includes("fair") || value.includes("acceptable") || value.includes("poor")) return "Fair";
    return "Good";
  }
  if (value.includes("new") || value.includes("sealed") || value.includes("like") || value.includes("very good")) return "Like New";
  if (value.includes("acceptable") || value.includes("fair") || value.includes("poor")) return "Acceptable";
  return "Good";
}

function statusFor(fields: { title?: string; description?: string; price?: number; photoCount?: number }) {
  return fields.title?.trim() && fields.description?.trim() && fields.price && fields.price > 0 && fields.photoCount
    ? "Ready"
    : "Needs Review";
}

function priceFromAsset(asset: Doc<"assets">) {
  if (asset.ebayPrice !== undefined) return asset.ebayPrice;
  if (asset.userLow !== undefined && asset.userHigh !== undefined) return Math.round(((asset.userLow + asset.userHigh) / 2) * 100) / 100;
  if (asset.userLow !== undefined) return asset.userLow;
  if (asset.userHigh !== undefined) return asset.userHigh;
  if (asset.estimatedLow !== undefined && asset.estimatedHigh !== undefined) return Math.round(((asset.estimatedLow + asset.estimatedHigh) / 2) * 100) / 100;
  return asset.estimatedLow ?? asset.estimatedHigh;
}

async function assetPhotoUrls(ctx: any, assetIds: Id<"assets">[]) {
  const urls: string[] = [];
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId);
    const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q: any) => q.eq("assetId", assetId)).collect();
    for (const photo of photos.sort((a: any, b: any) => a.position - b.position)) {
      const url = await ctx.storage.getUrl(photo.storageId);
      if (url) urls.push(url);
    }
    if (asset?.photoDataUrl) urls.push(asset.photoDataUrl);
    if (asset?.coverImageUrl) urls.push(asset.coverImageUrl);
  }
  return [...new Set(urls)];
}

async function listingMembers(ctx: any, listing: Doc<"marketplaceListings">) {
  const links = await ctx.db.query("listingBundleItems").withIndex("by_listingId", (q: any) => q.eq("listingId", listing._id)).collect();
  if (!links.length) {
    const asset = await ctx.db.get(listing.assetId);
    return asset ? [asset] : [];
  }
  return (await Promise.all(links.sort((a: any, b: any) => a.position - b.position).map((link: any) => ctx.db.get(link.assetId)))).filter(Boolean);
}

function snapshotFromAssets(assets: Doc<"assets">[], listing?: Doc<"marketplaceListings">) {
  return JSON.stringify({
    sourceListingId: listing?._id,
    sourcePlatform: listing?.platform,
    sourceStatus: listing?.status,
    sourceTitle: listing?.title,
    sourcePrice: listing?.currentPrice ?? listing?.listedPrice,
    bundleCount: assets.length,
    members: assets.map((asset) => ({
      assetId: asset._id,
      title: asset.title,
      type: asset.type,
      mediaFormat: asset.mediaFormat,
      barcode: asset.upc || asset.barcode,
      purchasePrice: asset.purchasePrice,
    })),
  });
}

async function rowForAsset(ctx: any, asset: Doc<"assets">, platform: string, overrides: any = {}) {
  const photoUrls = await assetPhotoUrls(ctx, [asset._id]);
  const price = overrides.price ?? priceFromAsset(asset);
  const description = overrides.description ?? asset.ebayDescription ?? asset.aiDescription ?? asset.itemDisclosures ?? asset.notes;
  return {
    assetId: asset._id,
    sourceType: "inventory",
    sourceSnapshotJson: snapshotFromAssets([asset]),
    platform,
    status: overrides.status ?? statusFor({ title: asset.ebayTitle || asset.title, description, price, photoCount: photoUrls.length }),
    title: (overrides.title || asset.ebayTitle || asset.title).slice(0, 120),
    description,
    sku: overrides.sku || asset.upc || asset.barcode,
    category: asset.type,
    platformCategory: overrides.platformCategory || defaultCategory(platform, asset),
    condition: overrides.condition || normalizeCondition(asset.condition, asset),
    price,
    shippingPrice: overrides.shippingPrice,
    notes: overrides.notes || `Prepared from inventory${asset.storageLocation ? ` · Location ${asset.storageLocation}` : ""}`,
  };
}

async function rowForListing(ctx: any, listing: Doc<"marketplaceListings">, platform: string, overrides: any = {}) {
  const members = await listingMembers(ctx, listing);
  const primary = members[0];
  const photoUrls = await assetPhotoUrls(ctx, members.map((asset: Doc<"assets">) => asset._id));
  const price = overrides.price ?? listing.currentPrice ?? listing.listedPrice;
  const description = overrides.description ?? listing.description;
  const barcodes = members.map((asset: Doc<"assets">) => asset.upc || asset.barcode).filter(Boolean);
  const bundleNote = members.length > 1 ? `Bundle members: ${members.map((asset: Doc<"assets">) => asset.title).join("; ")}` : "";
  const identifierNote = barcodes.length ? `Identifiers: ${barcodes.join(", ")}` : "";
  return {
    assetId: listing.assetId,
    sourceType: members.length > 1 ? "ebayBundle" : "ebayListing",
    sourceListingId: listing._id,
    sourcePlatform: listing.platform,
    sourceStatus: listing.status,
    sourceSnapshotJson: snapshotFromAssets(members, listing),
    platform,
    status: overrides.status ?? statusFor({ title: listing.title, description, price, photoCount: photoUrls.length }),
    title: (overrides.title || listing.title).slice(0, 120),
    description,
    sku: overrides.sku || listing.sku,
    category: listing.category || primary?.type,
    platformCategory: overrides.platformCategory || defaultCategory(platform, primary),
    condition: overrides.condition || normalizeCondition(listing.condition || primary?.condition, primary),
    price,
    shippingPrice: overrides.shippingPrice ?? listing.shippingCharged,
    notes: [overrides.notes, bundleNote, identifierNote, listing.externalListingId ? `Source eBay item ${listing.externalListingId}` : ""].filter(Boolean).join("\n"),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    let rows = await ctx.db.query("crossListings").order("desc").take(500);
    rows = applyOwner(rows, ownerId);
    return await Promise.all(rows.map(async (row) => {
      const asset = await ctx.db.get(row.assetId);
      const sourceListing = row.sourceListingId ? await ctx.db.get(row.sourceListingId) : undefined;
      const linkedAccount = row.linkedAccountId ? await ctx.db.get(row.linkedAccountId) : undefined;
      let assetIds = [row.assetId];
      if (sourceListing) {
        const members = await listingMembers(ctx, sourceListing);
        assetIds = members.map((member: Doc<"assets">) => member._id);
      }
      const photoUrls = await assetPhotoUrls(ctx, assetIds);
      return {
        ...row,
        assetTitle: asset?.title ?? "Missing inventory item",
        assetType: asset?.type,
        assetStatus: asset?.status,
        assetLocation: asset?.storageLocation,
        assetPhotoUrl: photoUrls[0] || asset?.photoDataUrl || asset?.coverImageUrl,
        assetBarcode: asset?.upc || asset?.barcode,
        photoCount: photoUrls.length,
        photoUrls,
        sourceListingTitle: sourceListing?.title,
        sourceExternalListingId: sourceListing?.externalListingId,
        sourceListingUrl: sourceListing?.listingUrl,
        linkedAccountPlatform: linkedAccount?.platform,
        linkedAccountName: linkedAccount?.accountName,
        linkedAccountLoginUrl: linkedAccount?.loginUrl,
        linkedAccountProfileUrl: linkedAccount?.profileUrl,
        linkedAccountStatus: linkedAccount?.status,
      };
    }));
  },
});

export const sourceListings = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const rows = applyOwner(await ctx.db.query("marketplaceListings").order("desc").take(500), ownerId);
    return await Promise.all(rows.map(async (listing) => {
      const members = await listingMembers(ctx, listing);
      const primary = members[0];
      return {
        _id: listing._id,
        assetId: listing.assetId,
        platform: listing.platform,
        status: listing.status,
        title: listing.title,
        currentPrice: listing.currentPrice,
        listedPrice: listing.listedPrice,
        sku: listing.sku,
        externalListingId: listing.externalListingId,
        listingUrl: listing.listingUrl,
        assetTitle: primary?.title,
        assetType: primary?.type,
        mediaFormat: primary?.mediaFormat,
        bundleCount: members.length,
      };
    }));
  },
});

const createArgs = {
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
  listedAt: v.optional(v.number()),
  sourceType: v.optional(v.string()),
  sourceListingId: v.optional(v.id("marketplaceListings")),
  sourcePlatform: v.optional(v.string()),
  sourceStatus: v.optional(v.string()),
  sourceSnapshotJson: v.optional(v.string()),
  handoffStatus: v.optional(v.string()),
  handoffNotes: v.optional(v.string()),
  lastPreparedAt: v.optional(v.number()),
};

export const create = mutation({
  args: createArgs,
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    assertOwner(asset, ownerId, "Inventory item");
    if (args.linkedAccountId) assertOwner(await ctx.db.get(args.linkedAccountId), ownerId, "Linked account");
    if (args.sourceListingId) assertOwner(await ctx.db.get(args.sourceListingId), ownerId, "Source listing");
    return await ctx.db.insert("crossListings", {
      ownerId,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createFromAsset = mutation({
  args: { assetId: v.id("assets"), platform: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const asset = await ctx.db.get(args.assetId);
    assertOwner(asset, ownerId, "Inventory item");
    if (!platforms.includes(args.platform)) throw new Error("Choose Mercari or Depop.");
    const now = Date.now();
    const row = await rowForAsset(ctx, asset!, args.platform);
    return await ctx.db.insert("crossListings", { ownerId, ...row, createdAt: now, updatedAt: now });
  },
});

export const bulkCreateFromAssets = mutation({
  args: { assetIds: v.array(v.id("assets")), platforms: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (!args.assetIds.length) throw new Error("Select at least one inventory item.");
    if (args.assetIds.length > 100) throw new Error("Create up to 100 cross-list rows at a time.");
    const targetPlatforms = args.platforms.filter((platform) => platforms.includes(platform));
    if (!targetPlatforms.length) throw new Error("Choose Mercari or Depop.");
    const ownerId = await currentOwnerId(ctx);
    const now = Date.now();
    let created = 0;
    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      assertOwner(asset, ownerId, "Inventory item");
      for (const platform of targetPlatforms) {
        const row = await rowForAsset(ctx, asset!, platform);
        await ctx.db.insert("crossListings", { ownerId, ...row, createdAt: now, updatedAt: now });
        created += 1;
      }
    }
    return { created };
  },
});

export const createFromMarketplaceListing = mutation({
  args: { listingId: v.id("marketplaceListings"), platform: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const listing = await ctx.db.get(args.listingId);
    assertOwner(listing, ownerId, "Source listing");
    if (!platforms.includes(args.platform)) throw new Error("Choose Mercari or Depop.");
    const now = Date.now();
    const row = await rowForListing(ctx, listing!, args.platform);
    return await ctx.db.insert("crossListings", { ownerId, ...row, createdAt: now, updatedAt: now });
  },
});

export const bulkCreateFromMarketplaceListings = mutation({
  args: { listingIds: v.array(v.id("marketplaceListings")), platforms: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (!args.listingIds.length) throw new Error("Select at least one listing.");
    if (args.listingIds.length > 100) throw new Error("Create up to 100 cross-list rows at a time.");
    const targetPlatforms = args.platforms.filter((platform) => platforms.includes(platform));
    if (!targetPlatforms.length) throw new Error("Choose Mercari or Depop.");
    const ownerId = await currentOwnerId(ctx);
    const now = Date.now();
    let created = 0;
    for (const listingId of args.listingIds) {
      const listing = await ctx.db.get(listingId);
      assertOwner(listing, ownerId, "Source listing");
      for (const platform of targetPlatforms) {
        const row = await rowForListing(ctx, listing!, platform);
        await ctx.db.insert("crossListings", { ownerId, ...row, createdAt: now, updatedAt: now });
        created += 1;
      }
    }
    return { created };
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
    handoffStatus: v.optional(v.string()),
    handoffNotes: v.optional(v.string()),
    lastPreparedAt: v.optional(v.number()),
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

export const prepareHandoff = mutation({
  args: { ids: v.array(v.id("crossListings")) },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const now = Date.now();
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      assertOwner(row, ownerId, "Cross listing");
      await ctx.db.patch(id, { handoffStatus: "Prepared", lastPreparedAt: now, updatedAt: now });
    }
    return { prepared: args.ids.length };
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
    closeSource: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    const ownerId = await currentOwnerId(ctx);
    assertOwner(existing, ownerId, "Cross listing");
    const now = Date.now();
    const soldAt = args.soldAt ?? now;
    await ctx.db.patch(args.id, {
      status: "Sold",
      soldPrice: args.soldPrice,
      soldAt,
      fees: args.fees,
      shippingPrice: args.shippingPrice,
      saleChannelDetail: args.saleChannelDetail,
      notes: args.notes ?? existing.notes,
      updatedAt: now,
    });

    if (args.closeSource ?? true) {
      await ctx.db.patch(existing.assetId, {
        status: "Sold",
        soldPrice: args.soldPrice,
        fees: args.fees,
        shipping: args.shippingPrice,
        updatedAt: now,
      });
      if (existing.sourceListingId) {
        const listing = await ctx.db.get(existing.sourceListingId);
        assertOwner(listing, ownerId, "Source listing");
        await ctx.db.patch(existing.sourceListingId, {
          salePlatform: existing.platform,
          saleChannelDetail: args.saleChannelDetail || existing.platform,
          soldPrice: args.soldPrice,
          soldDate: new Date(soldAt).toISOString().slice(0, 10),
          status: listing?.status === "Active" ? "Active" : "Sold",
          ebayLastError: listing?.platform === "eBay" && listing.status === "Active" ? "Cross-list sold elsewhere. End the live eBay listing to avoid double-selling." : listing?.ebayLastError,
          updatedAt: now,
        });
      }
    }
    return args.id;
  },
});

export { platforms as platformOptions, statuses as statusOptions };
