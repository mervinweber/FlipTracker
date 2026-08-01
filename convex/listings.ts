import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function midpoint(low?: number, high?: number) {
  if (low !== undefined && high !== undefined) return Math.round(((low + high) / 2) * 100) / 100;
  return low ?? high;
}

const listingFields = {
  platform: v.string(),
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
  pricingStatus: v.optional(v.string()),
  pricingSource: v.optional(v.string()),
};

const listingPatch = {
  platform: v.optional(v.string()),
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
  pricingStatus: v.optional(v.string()),
  pricingSource: v.optional(v.string()),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("marketplaceListings").order("desc").take(500);
    return await Promise.all(
      listings.map(async (listing) => {
        const asset = await ctx.db.get(listing.assetId);
        const photos = await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", listing.assetId)).collect();
        const primaryPhoto = photos.sort((a, b) => a.position - b.position)[0];
        const primaryPhotoUrl = primaryPhoto ? await ctx.storage.getUrl(primaryPhoto.storageId) : undefined;
        return {
          ...listing,
          assetTitle: asset?.title ?? "Missing inventory item",
          assetType: asset?.type,
          purchasePrice: asset?.purchasePrice,
          storageLocation: asset?.storageLocation,
          photoUrl: primaryPhotoUrl || asset?.photoDataUrl || asset?.coverImageUrl,
          hasActualPhoto: Boolean(primaryPhoto || asset?.photoDataUrl),
          actualPhotoCount: photos.length + (asset?.photoDataUrl ? 1 : 0),
          hasCatalogIdentifier: Boolean(asset?.upc || asset?.barcode),
          assetBarcode: asset?.upc || asset?.barcode,
          mediaFormat: asset?.mediaFormat,
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
  handler: async (ctx, args) =>
    await ctx.db
      .query("listingPriceHistory")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100),
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("marketplaceListings").order("desc").take(1000);
    const active = listings.filter((listing) => listing.status === "Active");
    const sold = listings.filter((listing) => listing.status === "Sold");
    const soldWithDates = sold.filter((listing) => listing.listedDate && listing.soldDate);
    const totalDays = soldWithDates.reduce((sum, listing) => {
      const listedAt = Date.parse(`${listing.listedDate}T00:00:00`);
      const soldAt = Date.parse(`${listing.soldDate}T00:00:00`);
      return sum + Math.max(0, Math.round((soldAt - listedAt) / 86_400_000));
    }, 0);

    return {
      draftCount: listings.filter((listing) => listing.status === "Draft").length,
      activeCount: active.length,
      activeValue: active.reduce((sum, listing) => sum + (listing.currentPrice ?? listing.listedPrice ?? 0), 0),
      soldCount: sold.length,
      soldRevenue: sold.reduce((sum, listing) => sum + (listing.soldPrice ?? 0), 0),
      averageDaysToSell: soldWithDates.length ? totalDays / soldWithDates.length : 0,
    };
  },
});

export const create = mutation({
  args: { assetId: v.id("assets"), ...listingFields },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Inventory item not found");

    const now = Date.now();
    const listingId = await ctx.db.insert("marketplaceListings", {
      ...args,
      currentPrice: args.currentPrice ?? args.listedPrice,
      pricingStatus: args.pricingStatus ?? (args.currentPrice !== undefined || args.listedPrice !== undefined ? "Ready for eBay" : "Ready for Pricing"),
      pricingUpdatedAt: args.currentPrice !== undefined || args.listedPrice !== undefined ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    const initialPrice = args.currentPrice ?? args.listedPrice;
    if (initialPrice !== undefined) {
      await ctx.db.insert("listingPriceHistory", {
        listingId,
        assetId: args.assetId,
        date: now,
        price: initialPrice,
        reason: "Initial listing price",
        createdAt: now,
      });
    }
    if (args.status === "Active") {
      await ctx.db.patch(args.assetId, { status: "Listed", updatedAt: now });
    }
    return listingId;
  },
});

export const update = mutation({
  args: {
    id: v.id("marketplaceListings"),
    priceChangeReason: v.optional(v.string()),
    ...listingPatch,
  },
  handler: async (ctx, { id, priceChangeReason, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Listing not found");

    const now = Date.now();
    if (patch.currentPrice !== undefined && patch.currentPrice !== existing.currentPrice) {
      await ctx.db.insert("listingPriceHistory", {
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
    await ctx.db.patch(id, { ...patch, ...pricingPatch, updatedAt: now });
    const nextStatus = patch.status ?? existing.status;
    if (nextStatus === "Active") {
      await ctx.db.patch(existing.assetId, { status: "Listed", updatedAt: now });
    }
    if (nextStatus === "Sold" && existing.status !== "Sold") {
      const soldPrice = patch.soldPrice ?? patch.currentPrice ?? existing.currentPrice ?? existing.listedPrice ?? 0;
      const soldDate = patch.soldDate ?? new Date(now).toISOString().slice(0, 10);
      const fees = patch.fees ?? existing.fees;
      const shipping = patch.shippingCost ?? existing.shippingCost;
      await ctx.db.patch(existing.assetId, { status: "Sold", soldPrice, fees, shipping, updatedAt: now });
      await ctx.db.insert("sales", {
        assetId: existing.assetId,
        platform: patch.platform ?? existing.platform,
        soldDate,
        soldPrice,
        fees,
        shipping,
        notes: patch.notes ?? existing.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) return null;
    const history = await ctx.db
      .query("listingPriceHistory")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.id))
      .take(500);
    for (const entry of history) await ctx.db.delete(entry._id);
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
    if (!args.updates.length) throw new Error("Choose at least one priced listing.");
    if (args.updates.length > 100) throw new Error("Update up to 100 listings at a time.");
    const now = Date.now();
    for (const update of args.updates) {
      if (!Number.isFinite(update.price) || update.price <= 0) throw new Error("Every approved listing needs a price above zero.");
      const listing = await ctx.db.get(update.listingId);
      if (!listing) throw new Error("A selected listing no longer exists.");
      if (listing.platform.toLowerCase() !== "ebay" || !["Draft", "Pending"].includes(listing.status)) {
        throw new Error(`${listing.title} is not an eBay Draft or Pending listing.`);
      }
      const normalizedPrice = Math.round(update.price * 100) / 100;
      const previousPrice = listing.currentPrice ?? listing.listedPrice;
      if (previousPrice !== normalizedPrice) {
        await ctx.db.insert("listingPriceHistory", {
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
    let listingCount = 0;
    for (const item of args.items) {
      const assetId = await ctx.db.insert("assets", {
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
