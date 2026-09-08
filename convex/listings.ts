import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { applyOwnerFilter, assertOwner, currentOwnerId } from "./ownership";

function midpoint(low?: number, high?: number) {
  if (low !== undefined && high !== undefined) return Math.round(((low + high) / 2) * 100) / 100;
  return low ?? high;
}

function bundleFamily(asset: { type?: string; mediaFormat?: string; cardGame?: string }) {
  const identity = `${asset.type ?? ""} ${asset.mediaFormat ?? ""}`.toLowerCase();
  if (identity.includes("book")) return "books";
  if (identity.includes("dvd") || identity.includes("blu-ray") || identity.includes("blu ray")) return "movies";
  if (/\bcd\b|music/.test(identity)) return "music";
  if (identity.includes("game")) return "video-games";
  if (identity.includes("card")) return `cards:${(asset.cardGame || asset.type || "cards").toLowerCase()}`;
  if (identity.includes("clothing") || identity.includes("apparel")) return "clothing";
  return `other:${(asset.type || asset.mediaFormat || "general").toLowerCase()}`;
}

const listingFields = {
  platform: v.string(),
  salePlatform: v.optional(v.string()),
  saleReference: v.optional(v.string()),
  saleChannelDetail: v.optional(v.string()),
  status: v.string(),
  sku: v.optional(v.string()),
  externalListingId: v.optional(v.string()),
  listingUrl: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  condition: v.optional(v.string()),
  language: v.optional(v.string()),
  bookTitle: v.optional(v.string()),
  author: v.optional(v.string()),
  cardProductType: v.optional(v.string()),
  cardGame: v.optional(v.string()),
  cardSport: v.optional(v.string()),
  cardSet: v.optional(v.string()),
  cardNumber: v.optional(v.string()),
  cardPlayer: v.optional(v.string()),
  cardTeam: v.optional(v.string()),
  itemSpecifics: v.optional(v.string()),
  listedPrice: v.optional(v.number()),
  currentPrice: v.optional(v.number()),
  soldPrice: v.optional(v.number()),
  shippingCharged: v.optional(v.number()),
  shippingCost: v.optional(v.number()),
  fees: v.optional(v.number()),
  listedDate: v.optional(v.string()),
  soldDate: v.optional(v.string()),
  buyer: v.optional(v.string()),
  notes: v.optional(v.string()),
  ebayCategoryId: v.optional(v.string()),
  fulfillmentPolicyId: v.optional(v.string()),
  shippingPreset: v.optional(v.string()),
  packageType: v.optional(v.string()),
  packageWeightOz: v.optional(v.number()),
  packageLengthIn: v.optional(v.number()),
  packageWidthIn: v.optional(v.number()),
  packageHeightIn: v.optional(v.number()),
  imageMode: v.optional(v.string()),
  fulfillmentStatus: v.optional(v.string()),
  packedAt: v.optional(v.number()),
  shippedAt: v.optional(v.number()),
  shippingCarrier: v.optional(v.string()),
  shippingService: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  trackingSubmittedAt: v.optional(v.number()),
  ebayFulfillmentId: v.optional(v.string()),
  insuranceRequired: v.optional(v.boolean()),
  fulfillmentNotes: v.optional(v.string()),
  pricingStatus: v.optional(v.string()),
  pricingSource: v.optional(v.string()),
};

const listingPatch = {
  platform: v.optional(v.string()),
  salePlatform: v.optional(v.string()),
  saleReference: v.optional(v.string()),
  saleChannelDetail: v.optional(v.string()),
  status: v.optional(v.string()),
  sku: v.optional(v.string()),
  externalListingId: v.optional(v.string()),
  listingUrl: v.optional(v.string()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  condition: v.optional(v.string()),
  language: v.optional(v.string()),
  bookTitle: v.optional(v.string()),
  author: v.optional(v.string()),
  cardProductType: v.optional(v.string()),
  cardGame: v.optional(v.string()),
  cardSport: v.optional(v.string()),
  cardSet: v.optional(v.string()),
  cardNumber: v.optional(v.string()),
  cardPlayer: v.optional(v.string()),
  cardTeam: v.optional(v.string()),
  itemSpecifics: v.optional(v.string()),
  listedPrice: v.optional(v.number()),
  currentPrice: v.optional(v.number()),
  soldPrice: v.optional(v.number()),
  shippingCharged: v.optional(v.number()),
  shippingCost: v.optional(v.number()),
  fees: v.optional(v.number()),
  listedDate: v.optional(v.string()),
  soldDate: v.optional(v.string()),
  buyer: v.optional(v.string()),
  notes: v.optional(v.string()),
  ebayCategoryId: v.optional(v.string()),
  fulfillmentPolicyId: v.optional(v.string()),
  shippingPreset: v.optional(v.string()),
  packageType: v.optional(v.string()),
  packageWeightOz: v.optional(v.number()),
  packageLengthIn: v.optional(v.number()),
  packageWidthIn: v.optional(v.number()),
  packageHeightIn: v.optional(v.number()),
  imageMode: v.optional(v.string()),
  fulfillmentStatus: v.optional(v.string()),
  packedAt: v.optional(v.number()),
  shippedAt: v.optional(v.number()),
  shippingCarrier: v.optional(v.string()),
  shippingService: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  trackingSubmittedAt: v.optional(v.number()),
  ebayFulfillmentId: v.optional(v.string()),
  insuranceRequired: v.optional(v.boolean()),
  fulfillmentNotes: v.optional(v.string()),
  pricingStatus: v.optional(v.string()),
  pricingSource: v.optional(v.string()),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const listings = applyOwnerFilter(await ctx.db.query("marketplaceListings").order("desc").take(500), ownerId);
    return await Promise.all(
      listings.map(async (listing) => {
        const asset = await ctx.db.get(listing.assetId);
        const bundleLinks = await ctx.db.query("listingBundleItems").withIndex("by_listingId", (q) => q.eq("listingId", listing._id)).collect();
        const bundleAssets = bundleLinks.length
          ? (await Promise.all(bundleLinks.sort((a, b) => a.position - b.position).map((link) => ctx.db.get(link.assetId)))).filter((row) => row !== null)
          : asset ? [asset] : [];
        const photos = (await Promise.all(bundleAssets.map((row) => ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", row._id)).collect()))).flat();
        const primaryPhoto = photos.sort((a, b) => a.position - b.position)[0];
        const primaryPhotoUrl = primaryPhoto ? await ctx.storage.getUrl(primaryPhoto.storageId) : undefined;
        return {
          ...listing,
          assetTitle: asset?.title ?? "Missing inventory item",
          assetType: asset?.type,
          purchasePrice: bundleAssets.reduce((sum, row) => sum + (row.purchasePrice || 0), 0),
          bundleCount: bundleAssets.length,
          bundleTitles: bundleAssets.map((row) => row.title),
          completeness: asset?.completeness,
          storageLocation: asset?.storageLocation,
          photoUrl: primaryPhotoUrl || asset?.photoDataUrl || asset?.coverImageUrl,
          hasActualPhoto: Boolean(primaryPhoto || bundleAssets.some((row) => row.photoDataUrl)),
          actualPhotoCount: photos.length + bundleAssets.filter((row) => row.photoDataUrl).length,
          hasCatalogIdentifier: Boolean(asset?.upc || asset?.barcode),
          assetBarcode: asset?.upc || asset?.barcode,
          mediaFormat: asset?.mediaFormat,
          assetAuthor: asset?.author,
          cardProductType: listing.cardProductType || asset?.cardProductType,
          cardGame: listing.cardGame || asset?.cardGame,
          cardSport: listing.cardSport || asset?.cardSport,
          cardSet: listing.cardSet || asset?.cardSet,
          cardNumber: listing.cardNumber || asset?.cardNumber,
          cardPlayer: listing.cardPlayer || asset?.cardPlayer,
          cardTeam: listing.cardTeam || asset?.cardTeam,
          needsValueCheck: asset?.needsValueCheck,
          listingRecommendation: asset?.listingRecommendation,
          suggestedPrice: asset?.ebayPrice
            ?? midpoint(asset?.userLow, asset?.userHigh)
            ?? midpoint(asset?.estimatedLow, asset?.estimatedHigh),
          suggestionSource: asset?.ebayPrice !== undefined
            ? "Prepared eBay price"
            : asset?.userLow !== undefined || asset?.userHigh !== undefined
              ? "User value range"
              : asset?.estimatedLow !== undefined || asset?.estimatedHigh !== undefined
                ? "Estimated value range"
                : undefined,
        };
      }),
    );
  },
});

export const priceHistory = query({
  args: { listingId: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    assertOwner(await ctx.db.get(args.listingId), ownerId, "Listing");
    return applyOwnerFilter(await ctx.db
      .query("listingPriceHistory")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100), ownerId);
  },
});

export const activity = query({
  args: { listingId: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    assertOwner(await ctx.db.get(args.listingId), ownerId, "Listing");
    return applyOwnerFilter(await ctx.db.query("listingEvents")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(50), ownerId);
  },
});

export const recordEvent = internalMutation({
  args: {
    listingId: v.id("marketplaceListings"),
    eventType: v.string(),
    source: v.string(),
    message: v.optional(v.string()),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;
    return await ctx.db.insert("listingEvents", {
      ownerId: listing.ownerId,
      listingId: listing._id,
      assetId: listing.assetId,
      eventType: args.eventType,
      source: args.source,
      message: args.message,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const listings = applyOwnerFilter(await ctx.db.query("marketplaceListings").order("desc").take(1000), ownerId);
    const active = listings.filter((listing) => listing.status === "Active");
    const sold = listings.filter((listing) => listing.status === "Sold");
    const soldWithDates = sold.filter((listing) => listing.listedDate && listing.soldDate);
    const totalDays = soldWithDates.reduce((sum, listing) => {
      const listedAt = Date.parse(`${listing.listedDate}T00:00:00`);
      const soldAt = Date.parse(`${listing.soldDate}T00:00:00`);
      return sum + Math.max(0, Math.round((soldAt - listedAt) / 86_400_000));
    }, 0);

    const soldWithAssets = await Promise.all(sold.map(async (listing) => {
      const links = await ctx.db.query("listingBundleItems").withIndex("by_listingId", (q) => q.eq("listingId", listing._id)).collect();
      const assetIds = links.length ? links.map((link) => link.assetId) : [listing.assetId];
      const assets = (await Promise.all(assetIds.map((assetId) => ctx.db.get(assetId)))).filter((asset) => asset !== null);
      return { listing, purchasePrice: assets.reduce((sum, asset) => sum + (asset.purchasePrice ?? 0), 0) };
    }));

    return {
      draftCount: listings.filter((listing) => listing.status === "Draft").length,
      activeCount: active.length,
      activeValue: active.reduce((sum, listing) => sum + (listing.currentPrice ?? listing.listedPrice ?? 0), 0),
      soldCount: sold.length,
      soldRevenue: sold.reduce((sum, listing) => sum + (listing.soldPrice ?? 0), 0),
      soldNetProfit: soldWithAssets.reduce((sum, { listing, purchasePrice }) => sum
        + (listing.soldPrice ?? 0)
        + (listing.shippingCharged ?? 0)
        - purchasePrice
        - (listing.fees ?? 0)
        - (listing.shippingCost ?? 0), 0),
      averageDaysToSell: soldWithDates.length ? totalDays / soldWithDates.length : 0,
    };
  },
});

export const create = mutation({
  args: { assetId: v.id("assets"), ...listingFields },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    const ownerId = await currentOwnerId(ctx);
    assertOwner(asset, ownerId, "Inventory item");
    const now = Date.now();
    const listingId = await ctx.db.insert("marketplaceListings", {
      ownerId,
      ...args,
      fulfillmentStatus: args.fulfillmentStatus ?? (args.status === "Sold" ? (args.platform.toLowerCase() === "ebay" ? "Awaiting Shipment" : "Completed") : undefined),
      currentPrice: args.currentPrice ?? args.listedPrice,
      pricingStatus: args.pricingStatus ?? (args.currentPrice !== undefined || args.listedPrice !== undefined ? "Ready for eBay" : "Ready for Pricing"),
      pricingUpdatedAt: args.currentPrice !== undefined || args.listedPrice !== undefined ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    const initialPrice = args.currentPrice ?? args.listedPrice;
    if (initialPrice !== undefined) {
      await ctx.db.insert("listingPriceHistory", {
        ownerId,
        listingId,
        assetId: args.assetId,
        date: now,
        price: initialPrice,
        reason: "Initial listing price",
        createdAt: now,
      });
    }
    await ctx.db.insert("listingEvents", {
      ownerId,
      listingId,
      assetId: args.assetId,
      eventType: "created",
      source: "FlipTracker",
      toStatus: args.status,
      message: `${args.platform} listing created in ${args.status}.`,
      createdAt: now,
    });
    if (args.status === "Active") {
      await ctx.db.patch(args.assetId, { status: "Listed", updatedAt: now });
    } else if (args.status === "Sold") {
      const soldPrice = args.soldPrice ?? args.currentPrice ?? args.listedPrice ?? 0;
      const soldDate = args.soldDate ?? new Date(now).toISOString().slice(0, 10);
      await ctx.db.patch(args.assetId, {
        status: "Sold",
        soldPrice,
        fees: args.fees,
        shipping: args.shippingCost,
        needsValueCheck: false,
        valueSource: "Actual Sale",
        updatedAt: now,
      });
      await ctx.db.insert("sales", {
        ownerId,
        assetId: args.assetId,
        listingId,
        platform: args.salePlatform ?? args.platform,
        reference: args.saleReference,
        saleChannelDetail: args.saleChannelDetail,
        soldDate,
        soldPrice,
        purchasePrice: asset.purchasePrice,
        shippingCharged: args.shippingCharged,
        fees: args.fees,
        shipping: args.shippingCost,
        buyer: args.buyer,
        notes: args.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
    return listingId;
  },
});

export const createBundle = mutation({
  args: { assetIds: v.array(v.id("assets")), ...listingFields },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    if (args.platform.toLowerCase() !== "ebay" || args.status !== "Draft") throw new Error("Bundles must begin as an eBay draft.");
    const uniqueAssetIds = [...new Set(args.assetIds)];
    if (uniqueAssetIds.length < 2 || uniqueAssetIds.length > 12) throw new Error("Choose between 2 and 12 inventory items for a bundle.");
    const assets = [];
    for (const assetId of uniqueAssetIds) {
      const asset = await ctx.db.get(assetId);
      assertOwner(asset, ownerId, "Inventory item");
      if (["Sold", "Written Off"].includes(asset.status || "")) throw new Error(`${asset.title} is already closed and cannot be bundled.`);
      const linked = await ctx.db.query("listingBundleItems").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
      const linkedListings = await Promise.all(linked.map((row) => ctx.db.get(row.listingId)));
      if (linkedListings.some((row) => row && ["Draft", "Pending", "Active"].includes(row.status))) throw new Error(`${asset.title} is already assigned to another open bundle.`);
      const directListings = await ctx.db.query("marketplaceListings").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).collect();
      if (directListings.some((row) => ["Draft", "Pending", "Active"].includes(row.status))) throw new Error(`${asset.title} already has an open listing.`);
      assets.push(asset);
    }
    const family = bundleFamily(assets[0]);
    if (assets.some((asset) => bundleFamily(asset) !== family)) throw new Error("Bundle items must use one compatible category family.");

    const now = Date.now();
    const { assetIds, ...fields } = args;
    void assetIds;
    const listingId = await ctx.db.insert("marketplaceListings", {
      ownerId,
      assetId: uniqueAssetIds[0],
      ...fields,
      currentPrice: fields.currentPrice ?? fields.listedPrice,
      pricingStatus: fields.pricingStatus ?? (fields.currentPrice !== undefined || fields.listedPrice !== undefined ? "Ready for eBay" : "Ready for Pricing"),
      pricingUpdatedAt: fields.currentPrice !== undefined || fields.listedPrice !== undefined ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    for (let position = 0; position < uniqueAssetIds.length; position += 1) {
      await ctx.db.insert("listingBundleItems", { ownerId, listingId, assetId: uniqueAssetIds[position], position, createdAt: now });
      await ctx.db.patch(uniqueAssetIds[position], { status: fields.status === "Active" ? "Listed" : "Bundle", updatedAt: now });
    }
    const initialPrice = fields.currentPrice ?? fields.listedPrice;
    if (initialPrice !== undefined) await ctx.db.insert("listingPriceHistory", { ownerId, listingId, assetId: uniqueAssetIds[0], date: now, price: initialPrice, reason: "Initial bundle price", createdAt: now });
    await ctx.db.insert("listingEvents", { ownerId, listingId, assetId: uniqueAssetIds[0], eventType: "bundle_created", source: "FlipTracker", toStatus: fields.status, message: `${uniqueAssetIds.length}-item eBay bundle created.`, createdAt: now });
    return { listingId, itemCount: assets.length };
  },
});

export const update = mutation({
  args: {
    id: v.id("marketplaceListings"),
    priceChangeReason: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    completeness: v.optional(v.string()),
    ...listingPatch,
  },
  handler: async (ctx, { id, priceChangeReason, purchasePrice, completeness, ...patch }) => {
    const existing = await ctx.db.get(id);
    const ownerId = await currentOwnerId(ctx);
    assertOwner(existing, ownerId, "Listing");
    const bundleLinks = await ctx.db.query("listingBundleItems").withIndex("by_listingId", (q) => q.eq("listingId", id)).collect();
    const memberIds = bundleLinks.length ? bundleLinks.sort((a, b) => a.position - b.position).map((row) => row.assetId) : [existing.assetId];
    const memberAssets = (await Promise.all(memberIds.map((assetId) => ctx.db.get(assetId)))).filter((row) => row !== null);

    const now = Date.now();
    const monetaryValues = [purchasePrice, patch.soldPrice, patch.shippingCharged, patch.shippingCost, patch.fees];
    if (monetaryValues.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
      throw new Error("Sale amounts must be zero or higher.");
    }
    if (patch.currentPrice !== undefined && patch.currentPrice !== existing.currentPrice) {
      await ctx.db.insert("listingPriceHistory", {
        ownerId: existing.ownerId,
        listingId: id,
        assetId: existing.assetId,
        date: now,
        price: patch.currentPrice,
        reason: priceChangeReason || "Price updated",
        createdAt: now,
      });
    }

    const pricingPatch = patch.currentPrice !== undefined && patch.currentPrice > 0 && ["Draft", "Pending"].includes(patch.status ?? existing.status)
      ? { pricingStatus: "Ready for eBay", pricingSource: patch.pricingSource ?? "Manual listing edit", pricingUpdatedAt: now }
      : {};
    const fulfillmentPatch = (patch.status ?? existing.status) === "Sold" && !patch.fulfillmentStatus && !existing.fulfillmentStatus
      ? { fulfillmentStatus: (patch.salePlatform ?? existing.salePlatform ?? existing.platform).toLowerCase() === "ebay" ? "Awaiting Shipment" : "Completed" }
      : {};
    await ctx.db.patch(id, { ...patch, ...pricingPatch, ...fulfillmentPatch, updatedAt: now });
    if (patch.status !== undefined && patch.status !== existing.status) {
      await ctx.db.insert("listingEvents", {
        ownerId: existing.ownerId,
        listingId: id,
        assetId: existing.assetId,
        eventType: "status_changed",
        source: "FlipTracker",
        fromStatus: existing.status,
        toStatus: patch.status,
        message: `Listing moved from ${existing.status} to ${patch.status}.`,
        createdAt: now,
      });
    }
    if (patch.currentPrice !== undefined && patch.currentPrice !== existing.currentPrice) {
      await ctx.db.insert("listingEvents", {
        ownerId: existing.ownerId,
        listingId: id,
        assetId: existing.assetId,
        eventType: "price_changed",
        source: "FlipTracker",
        message: priceChangeReason || "Listing price updated.",
        metadata: JSON.stringify({ from: existing.currentPrice ?? existing.listedPrice, to: patch.currentPrice }),
        createdAt: now,
      });
    }
    if (patch.fulfillmentStatus !== undefined && patch.fulfillmentStatus !== existing.fulfillmentStatus) {
      await ctx.db.insert("listingEvents", {
        ownerId: existing.ownerId,
        listingId: id,
        assetId: existing.assetId,
        eventType: "fulfillment_changed",
        source: "FlipTracker",
        message: `Fulfillment moved from ${existing.fulfillmentStatus || "Not started"} to ${patch.fulfillmentStatus}.`,
        metadata: JSON.stringify({ carrier: patch.shippingCarrier, trackingNumber: patch.trackingNumber }),
        createdAt: now,
      });
    }
    if ((purchasePrice !== undefined && memberIds.length === 1) || completeness !== undefined) {
      await ctx.db.patch(existing.assetId, { ...(purchasePrice !== undefined && memberIds.length === 1 ? { purchasePrice } : {}), ...(completeness !== undefined ? { completeness } : {}), updatedAt: now });
    }
    const nextStatus = patch.status ?? existing.status;
    if (nextStatus === "Active") {
      for (const assetId of memberIds) await ctx.db.patch(assetId, { status: "Listed", updatedAt: now });
    }
    if (nextStatus === "Sold") {
      const soldPrice = patch.soldPrice ?? patch.currentPrice ?? existing.currentPrice ?? existing.listedPrice ?? 0;
      const soldDate = patch.soldDate ?? new Date(now).toISOString().slice(0, 10);
      const fees = patch.fees ?? existing.fees;
      const shipping = patch.shippingCost ?? existing.shippingCost;
      const salePlatform = patch.salePlatform ?? existing.salePlatform ?? existing.platform;
      const saleRecord = {
        assetId: existing.assetId,
        listingId: id,
        platform: salePlatform,
        reference: patch.saleReference ?? existing.saleReference,
        saleChannelDetail: patch.saleChannelDetail ?? existing.saleChannelDetail,
        soldDate,
        soldPrice,
        purchasePrice: purchasePrice ?? memberAssets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0),
        shippingCharged: patch.shippingCharged ?? existing.shippingCharged,
        fees,
        shipping,
        buyer: patch.buyer ?? existing.buyer,
        notes: patch.notes ?? existing.notes,
        updatedAt: now,
      };
      for (let index = 0; index < memberIds.length; index += 1) await ctx.db.patch(memberIds[index], {
        status: "Sold",
        ...(index === 0 ? { soldPrice, fees, shipping, valueSource: "Actual Sale" } : {}),
        needsValueCheck: false,
        ...(purchasePrice !== undefined && memberIds.length === 1 ? { purchasePrice } : {}),
        updatedAt: now,
      });
      const linkedSale = await ctx.db
        .query("sales")
        .withIndex("by_listingId", (q) => q.eq("listingId", id))
        .unique();
      if (linkedSale) {
        await ctx.db.patch(linkedSale._id, saleRecord);
      } else {
        const legacySales = await ctx.db
          .query("sales")
          .withIndex("by_asset", (q) => q.eq("assetId", existing.assetId))
          .collect();
        const legacyMatch = legacySales.find((sale) => !sale.listingId
          && sale.soldDate === soldDate
          && (sale.platform ?? existing.platform) === salePlatform);
        if (legacyMatch) {
          await ctx.db.patch(legacyMatch._id, saleRecord);
        } else {
          await ctx.db.insert("sales", { ownerId: existing.ownerId, ...saleRecord, createdAt: now });
        }
      }
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) return null;
    const ownerId = await currentOwnerId(ctx);
    assertOwner(listing, ownerId, "Listing");
    const bundleLinks = await ctx.db.query("listingBundleItems").withIndex("by_listingId", (q) => q.eq("listingId", args.id)).collect();
    const history = await ctx.db
      .query("listingPriceHistory")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.id))
      .take(500);
    for (const entry of history) await ctx.db.delete(entry._id);
    const events = await ctx.db.query("listingEvents").withIndex("by_listingId", (q) => q.eq("listingId", args.id)).take(500);
    for (const event of events) await ctx.db.delete(event._id);
    for (const link of bundleLinks) {
      if (["Draft", "Pending", "Cancelled"].includes(listing.status)) {
        const asset = await ctx.db.get(link.assetId);
        if (asset?.status === "Bundle") await ctx.db.patch(link.assetId, { status: "Inventory", updatedAt: Date.now() });
      }
      await ctx.db.delete(link._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const applyQueuePricing = mutation({
  args: {
    updates: v.array(v.object({
      listingId: v.id("marketplaceListings"),
      price: v.number(),
      source: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const ownerId = await currentOwnerId(ctx);
    if (!args.updates.length) throw new Error("Choose at least one priced listing.");
    if (args.updates.length > 100) throw new Error("Update up to 100 listings at a time.");
    const now = Date.now();
    for (const update of args.updates) {
      if (!Number.isFinite(update.price) || update.price <= 0) throw new Error("Every approved listing needs a price above zero.");
      const listing = await ctx.db.get(update.listingId);
      if (!listing) throw new Error("A selected listing no longer exists.");
      assertOwner(listing, ownerId, "Listing");
      if (listing.platform.toLowerCase() !== "ebay" || !["Draft", "Pending"].includes(listing.status)) {
        throw new Error(`${listing.title} is not an eBay Draft or Pending listing.`);
      }
      const normalizedPrice = Math.round(update.price * 100) / 100;
      const previousPrice = listing.currentPrice ?? listing.listedPrice;
      if (previousPrice !== normalizedPrice) {
        await ctx.db.insert("listingPriceHistory", {
          ownerId: listing.ownerId,
          listingId: listing._id,
          assetId: listing.assetId,
          date: now,
          price: normalizedPrice,
          reason: "Pricing queue review",
          createdAt: now,
        });
      }
      await ctx.db.patch(listing._id, {
        listedPrice: listing.listedPrice ?? normalizedPrice,
        currentPrice: normalizedPrice,
        pricingStatus: "Ready for eBay",
        pricingSource: update.source,
        pricingUpdatedAt: now,
        ebayLastError: undefined,
        updatedAt: now,
      });
    }
    return { updated: args.updates.length };
  },
});

export const importSalesTracker = mutation({
  args: {
    items: v.array(v.object({
      title: v.string(),
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      condition: v.string(),
      platforms: v.array(v.string()),
      listedPrice: v.number(),
      currentPrice: v.number(),
      soldPrice: v.optional(v.number()),
      listedDate: v.string(),
      soldDate: v.optional(v.string()),
      status: v.string(),
      sku: v.optional(v.string()),
      notes: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      priceHistory: v.array(v.object({ date: v.string(), price: v.number(), reason: v.optional(v.string()) })),
    })),
  },
  handler: async (ctx, args) => {
    if (args.items.length > 200) throw new Error("Import up to 200 Sales Tracker records at a time.");
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    let listingCount = 0;
    for (const item of args.items) {
      const assetId = await ctx.db.insert("assets", {
        ownerId,
        type: "Misc",
        title: item.title,
        coverImageUrl: item.imageUrl,
        estimatedLow: item.currentPrice,
        estimatedHigh: item.currentPrice,
        valueSource: "Estimated",
        needsValueCheck: true,
        status: item.status === "Sold" ? "Sold" : item.status === "Active" ? "Listed" : "Inventory",
        soldPrice: item.soldPrice,
        condition: item.condition,
        ebayTitle: item.title.slice(0, 80),
        ebayDescription: item.description,
        ebayCategory: item.category,
        ebayPrice: item.currentPrice,
        notes: item.notes,
        createdAt: now,
        updatedAt: now,
      });

      for (const platform of item.platforms.length ? item.platforms : ["Other"]) {
        const listingId = await ctx.db.insert("marketplaceListings", {
          ownerId,
          assetId,
          platform,
          status: item.status,
          sku: item.sku,
          title: item.title,
          description: item.description,
          category: item.category,
          condition: item.condition,
          listedPrice: item.listedPrice,
          currentPrice: item.currentPrice,
          soldPrice: item.soldPrice,
          listedDate: item.listedDate,
          soldDate: item.soldDate,
          notes: item.notes,
          createdAt: now,
          updatedAt: now,
        });
        listingCount += 1;
        const history = item.priceHistory.length ? item.priceHistory : [{ date: item.listedDate, price: item.listedPrice, reason: "Imported initial price" }];
        for (const entry of history.slice(0, 100)) {
          const parsedDate = Date.parse(entry.date);
          await ctx.db.insert("listingPriceHistory", {
            ownerId,
            listingId,
            assetId,
            date: Number.isNaN(parsedDate) ? now : parsedDate,
            price: entry.price,
            reason: entry.reason || "Imported from Sales Tracker",
            createdAt: now,
          });
        }
      }
    }
    return { assetCount: args.items.length, listingCount };
  },
});
