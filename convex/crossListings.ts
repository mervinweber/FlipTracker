import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOwner, currentOwnerId } from "./ownership";
import type { Doc, Id } from "./_generated/dataModel";

const platforms = ["Mercari", "Depop", "Vinted"];
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
  if (platform === "Vinted") {
    if (assetFamily === "book") return "Entertainment > Books";
    if (assetFamily === "media") return "Entertainment > Movies & TV";
    if (assetFamily === "videoGame") return "Entertainment > Video Games";
    if (assetFamily === "card") return "Entertainment > Collectibles";
    if (assetFamily === "clothing") return "Clothing";
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

function publicPhotoCount(photoUrls: string[] = []) {
  return photoUrls.filter((url) => /^https:\/\//i.test(url)).length;
}

function titleLimit(platform: string) {
  if (platform === "Mercari") return 80;
  if (platform === "Depop") return 80;
  return 80;
}

function statusFor(fields: { platform: string; title?: string; description?: string; price?: number; photoUrls?: string[] }) {
  return fields.title?.trim()
    && fields.title.trim().length <= titleLimit(fields.platform)
    && fields.description?.trim()
    && fields.price
    && fields.price > 0
    && publicPhotoCount(fields.photoUrls)
    ? "Ready"
    : "Needs Review";
}

function splitAmount(amount: number | undefined, count: number) {
  if (amount === undefined || count <= 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
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

async function findOpenDuplicate(
  ctx: any,
  ownerId: string | undefined,
  fields: { platform: string; assetId: Id<"assets">; sourceListingId?: Id<"marketplaceListings">; sourceType?: string },
) {
  const rows = fields.sourceListingId
    ? await ctx.db.query("crossListings").withIndex("by_sourceListingId", (q: any) => q.eq("sourceListingId", fields.sourceListingId)).collect()
    : await ctx.db.query("crossListings").withIndex("by_assetId", (q: any) => q.eq("assetId", fields.assetId)).collect();
  return rows.find((row: Doc<"crossListings">) => row.ownerId === ownerId
    && row.platform === fields.platform
    && row.sourceListingId === fields.sourceListingId
    && row.sourceType === fields.sourceType
    && !["Sold", "Ended"].includes(row.status));
}

async function upsertCrossListing(ctx: any, ownerId: string | undefined, row: any, now: number) {
  const existing = await findOpenDuplicate(ctx, ownerId, row);
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...row,
      status: existing.status === "Listed" ? existing.status : row.status,
      listedAt: existing.listedAt,
      soldAt: existing.soldAt,
      soldPrice: existing.soldPrice,
      fees: existing.fees,
      listingUrl: existing.listingUrl,
      externalListingId: existing.externalListingId,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    return { id: existing._id, created: false };
  }
  const id = await ctx.db.insert("crossListings", { ownerId, ...row, createdAt: now, updatedAt: now });
  return { id, created: true };
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
    status: overrides.status ?? statusFor({ platform, title: asset.ebayTitle || asset.title, description, price, photoUrls }),
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
    status: overrides.status ?? statusFor({ platform, title: listing.title, description, price, photoUrls }),
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
    const result = await upsertCrossListing(ctx, ownerId, args, now);
    return result.id;
  },
});

export const createFromAsset = mutation({
  args: { assetId: v.id("assets"), platform: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const asset = await ctx.db.get(args.assetId);
    assertOwner(asset, ownerId, "Inventory item");
    if (!platforms.includes(args.platform)) throw new Error("Choose Mercari, Depop, or Vinted.");
    const now = Date.now();
    const row = await rowForAsset(ctx, asset!, args.platform);
    const result = await upsertCrossListing(ctx, ownerId, row, now);
    return result.id;
  },
});

export const bulkCreateFromAssets = mutation({
  args: { assetIds: v.array(v.id("assets")), platforms: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (!args.assetIds.length) throw new Error("Select at least one inventory item.");
    if (args.assetIds.length > 100) throw new Error("Create up to 100 cross-list rows at a time.");
    const targetPlatforms = args.platforms.filter((platform) => platforms.includes(platform));
    if (!targetPlatforms.length) throw new Error("Choose Mercari, Depop, or Vinted.");
    const ownerId = await currentOwnerId(ctx);
    const now = Date.now();
    let created = 0;
    let updated = 0;
    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      assertOwner(asset, ownerId, "Inventory item");
      for (const platform of targetPlatforms) {
        const row = await rowForAsset(ctx, asset!, platform);
        const result = await upsertCrossListing(ctx, ownerId, row, now);
        if (result.created) created += 1;
        else updated += 1;
      }
    }
    return { created, updated };
  },
});

export const createFromMarketplaceListing = mutation({
  args: { listingId: v.id("marketplaceListings"), platform: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    const listing = await ctx.db.get(args.listingId);
    assertOwner(listing, ownerId, "Source listing");
    if (!platforms.includes(args.platform)) throw new Error("Choose Mercari, Depop, or Vinted.");
    const now = Date.now();
    const row = await rowForListing(ctx, listing!, args.platform);
    const result = await upsertCrossListing(ctx, ownerId, row, now);
    return result.id;
  },
});

export const bulkCreateFromMarketplaceListings = mutation({
  args: { listingIds: v.array(v.id("marketplaceListings")), platforms: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (!args.listingIds.length) throw new Error("Select at least one listing.");
    if (args.listingIds.length > 100) throw new Error("Create up to 100 cross-list rows at a time.");
    const targetPlatforms = args.platforms.filter((platform) => platforms.includes(platform));
    if (!targetPlatforms.length) throw new Error("Choose Mercari, Depop, or Vinted.");
    const ownerId = await currentOwnerId(ctx);
    const now = Date.now();
    let created = 0;
    let updated = 0;
    for (const listingId of args.listingIds) {
      const listing = await ctx.db.get(listingId);
      assertOwner(listing, ownerId, "Source listing");
      for (const platform of targetPlatforms) {
        const row = await rowForListing(ctx, listing!, platform);
        const result = await upsertCrossListing(ctx, ownerId, row, now);
        if (result.created) created += 1;
        else updated += 1;
      }
    }
    return { created, updated };
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
      let assetIds = [row.assetId];
      if (row.sourceListingId) {
        const listing = await ctx.db.get(row.sourceListingId);
        if (listing) assetIds = (await listingMembers(ctx, listing)).map((asset: Doc<"assets">) => asset._id);
      }
      const photoUrls = await assetPhotoUrls(ctx, assetIds);
      const missing = [
        !row.title?.trim() ? "title" : "",
        row.title && row.title.length > titleLimit(row.platform) ? "shorter title" : "",
        !row.description?.trim() ? "description" : "",
        !row.price || row.price <= 0 ? "price" : "",
        !publicPhotoCount(photoUrls) ? "public photo" : "",
      ].filter(Boolean);
      if (missing.length) {
        await ctx.db.patch(id, {
          status: "Needs Review",
          handoffStatus: "Needs Review",
          handoffNotes: `Missing ${missing.join(", ")} before ${row.platform} handoff.`,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(id, { status: "Ready", handoffStatus: "Prepared", handoffNotes: undefined, lastPreparedAt: now, updatedAt: now });
      }
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
      let listing: Doc<"marketplaceListings"> | null = null;
      let members: Doc<"assets">[] = [];
      if (existing.sourceListingId) {
        listing = await ctx.db.get(existing.sourceListingId);
        assertOwner(listing, ownerId, "Source listing");
        members = listing ? await listingMembers(ctx, listing) : [];
      }
      if (!members.length) {
        const asset = await ctx.db.get(existing.assetId);
        assertOwner(asset, ownerId, "Inventory item");
        if (asset) members = [asset];
      }
      const soldPriceAllocations = splitAmount(args.soldPrice, members.length);
      const feeAllocations = splitAmount(args.fees, members.length);
      const shippingAllocations = splitAmount(args.shippingPrice, members.length);
      for (let index = 0; index < members.length; index += 1) {
        await ctx.db.patch(members[index]._id, {
          status: "Sold",
          soldPrice: soldPriceAllocations[index],
          ...(args.fees !== undefined ? { fees: feeAllocations[index] } : {}),
          ...(args.shippingPrice !== undefined ? { shipping: shippingAllocations[index] } : {}),
          valueSource: "Actual Sale",
          needsValueCheck: false,
          updatedAt: now,
        });
      }
      if (listing && existing.sourceListingId) {
        const saleRecord = {
          assetId: listing.assetId,
          listingId: listing._id,
          platform: existing.platform,
          reference: existing.externalListingId,
          saleChannelDetail: args.saleChannelDetail || existing.platform,
          soldDate: new Date(soldAt).toISOString().slice(0, 10),
          soldPrice: args.soldPrice,
          purchasePrice: members.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0),
          shippingCharged: args.shippingPrice,
          fees: args.fees,
          shipping: args.shippingPrice,
          notes: args.notes ?? existing.notes,
          updatedAt: now,
        };
        await ctx.db.patch(existing.sourceListingId, {
          salePlatform: existing.platform,
          saleChannelDetail: args.saleChannelDetail || existing.platform,
          soldPrice: args.soldPrice,
          soldDate: saleRecord.soldDate,
          fees: args.fees,
          shippingCost: args.shippingPrice,
          status: "Sold",
          ebayLastError: listing.platform === "eBay" && listing.status === "Active" ? "Cross-list sold elsewhere. End the live eBay listing to avoid double-selling." : listing.ebayLastError,
          updatedAt: now,
        });
        const linkedSale = await ctx.db.query("sales").withIndex("by_listingId", (q: any) => q.eq("listingId", listing._id)).unique();
        if (linkedSale) await ctx.db.patch(linkedSale._id, saleRecord);
        else await ctx.db.insert("sales", { ownerId, ...saleRecord, createdAt: now });
      } else if (members[0]) {
        const saleRecord = {
          assetId: members[0]._id,
          platform: existing.platform,
          reference: existing.externalListingId,
          saleChannelDetail: args.saleChannelDetail || existing.platform,
          soldDate: new Date(soldAt).toISOString().slice(0, 10),
          soldPrice: args.soldPrice,
          purchasePrice: members[0].purchasePrice,
          shippingCharged: args.shippingPrice,
          fees: args.fees,
          shipping: args.shippingPrice,
          notes: args.notes ?? existing.notes,
          updatedAt: now,
        };
        const legacySales = await ctx.db.query("sales").withIndex("by_asset", (q: any) => q.eq("assetId", members[0]._id)).collect();
        const legacyMatch = legacySales.find((sale: Doc<"sales">) => !sale.listingId
          && sale.soldDate === saleRecord.soldDate
          && (sale.platform ?? existing.platform) === existing.platform);
        if (legacyMatch) await ctx.db.patch(legacyMatch._id, saleRecord);
        else await ctx.db.insert("sales", { ownerId, ...saleRecord, createdAt: now });
      }
    }
    return args.id;
  },
});

export { platforms as platformOptions, statuses as statusOptions };
