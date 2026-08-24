import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertOwner, currentOwnerId } from "./ownership";

const optionalText = v.optional(v.string());

export const createScannedItem = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    mediaFormat: optionalText,
    edition: optionalText,
    upc: v.string(),
    barcodeType: optionalText,
    releaseYear: optionalText,
    releaseDate: optionalText,
    studio: optionalText,
    author: optionalText,
    rating: optionalText,
    coverImageUrl: optionalText,
    metadataSource: optionalText,
    metadataConfidence: optionalText,
    collectionId: v.optional(v.id("collections")),
    storageLocation: optionalText,
    purchasePrice: v.optional(v.number()),
    condition: v.string(),
    completeness: v.string(),
    ebayTitle: v.string(),
    ebayDescription: optionalText,
    ebayCategory: optionalText,
    ebayCondition: optionalText,
    ebayItemSpecifics: optionalText,
    ebayPrice: v.optional(v.number()),
    ebayShipping: optionalText,
    createDraft: v.boolean(),
    skuPrefix: v.string(),
    batchId: v.optional(v.id("intakeBatches")),
    scanToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const upc = args.upc.trim();
    if (!title) throw new Error("Title is required.");
    if (!upc) throw new Error("UPC/barcode is required.");
    if (args.purchasePrice !== undefined && args.purchasePrice < 0) throw new Error("Purchase price cannot be negative.");
    if (args.ebayPrice !== undefined && args.ebayPrice < 0) throw new Error("Listing price cannot be negative.");

    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    if (args.batchId) assertOwner(await ctx.db.get(args.batchId), ownerId, "Intake batch");
    if (args.collectionId) assertOwner(await ctx.db.get(args.collectionId), ownerId, "Collection");
    if (args.batchId && args.scanToken) {
      const prior = await ctx.db.query("intakeBatchItems")
        .withIndex("by_batchId_and_scanToken", (q) => q.eq("batchId", args.batchId!).eq("scanToken", args.scanToken!))
        .unique();
      if (prior) {
        assertOwner(prior, ownerId, "Intake item");
        return { assetId: prior.assetId, listingId: prior.listingId ?? null, sku: prior.sku, copyNumber: prior.copyNumber, batchItemId: prior._id };
      }
    }
    const existingCopies = (await ctx.db.query("assets").withIndex("by_upc", (q) => q.eq("upc", upc)).take(100))
      .filter((asset) => !ownerId || asset.ownerId === ownerId);
    const assetId = await ctx.db.insert("assets", {
      ownerId,
      type: args.type,
      title,
      edition: args.edition,
      mediaFormat: args.mediaFormat,
      upc,
      barcode: upc,
      barcodeType: args.barcodeType,
      releaseYear: args.releaseYear,
      releaseDate: args.releaseDate,
      studio: args.studio,
      author: args.author,
      rating: args.rating,
      coverImageUrl: args.coverImageUrl,
      metadataSource: args.metadataSource,
      metadataConfidence: args.metadataConfidence,
      metadataCheckedAt: now,
      collectionId: args.collectionId,
      intakeBatchId: args.batchId,
      storageLocation: args.storageLocation,
      purchasePrice: args.purchasePrice,
      condition: args.condition,
      completeness: args.completeness,
      complete: args.completeness === "Complete" || args.completeness === "Sealed",
      valueSource: "Estimated",
      needsValueCheck: true,
      status: "Inventory",
      listingRecommendation: "Review",
      strategy: "Review",
      ebayTitle: args.ebayTitle.trim().slice(0, 80),
      ebayDescription: args.ebayDescription,
      ebayCategory: args.ebayCategory,
      ebayCondition: args.ebayCondition,
      ebayItemSpecifics: args.ebayItemSpecifics,
      ebayPrice: args.ebayPrice,
      ebayShipping: args.ebayShipping,
      confidence: args.metadataConfidence,
      createdAt: now,
      updatedAt: now,
    });

    const prefix = args.skuPrefix.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 18) || "FT";
    const sku = `${prefix}-${String(assetId).slice(-8).toUpperCase()}`;
    if (!args.createDraft) {
      const copyNumber = existingCopies.length + 1;
      const batchItemId = args.batchId ? await ctx.db.insert("intakeBatchItems", {
        ownerId, batchId: args.batchId, scanToken: args.scanToken || String(assetId), barcode: upc,
        status: args.metadataConfidence === "Low" || args.mediaFormat === "Unknown" ? "Review" : "Saved",
        assetId, title, mediaFormat: args.mediaFormat, confidence: args.metadataConfidence, sku, copyNumber,
        createdAt: now, updatedAt: now,
      }) : null;
      if (args.batchId) await ctx.db.patch(args.batchId, { updatedAt: now });
      return { assetId, listingId: null, sku, copyNumber, batchItemId };
    }
    const mediaIdentity = `${args.type} ${args.mediaFormat ?? ""}`.trim().toLowerCase();
    const isSingleMediaCase = ["dvd", "blu-ray", "blu ray", "cd"].some((format) => mediaIdentity.includes(format));
    const isBookWithCover = mediaIdentity.includes("book") && Boolean(args.coverImageUrl);

    const listingId = await ctx.db.insert("marketplaceListings", {
      ownerId,
      assetId,
      intakeBatchId: args.batchId,
      platform: "eBay",
      status: "Draft",
      sku,
      title: args.ebayTitle.trim().slice(0, 80) || title.slice(0, 80),
      description: args.ebayDescription,
      category: args.ebayCategory,
      condition: args.ebayCondition,
      language: "English",
      bookTitle: mediaIdentity.includes("book") ? title : undefined,
      author: mediaIdentity.includes("book") ? args.author : undefined,
      itemSpecifics: args.ebayItemSpecifics,
      imageMode: args.condition.trim().toLowerCase() === "new"
        || args.completeness.trim().toLowerCase() === "sealed"
        || isBookWithCover
        ? "eBay Catalog"
        : "Actual Item Photo",
      shippingPreset: isSingleMediaCase ? "Single Media Mailer" : undefined,
      packageType: isSingleMediaCase ? "PACKAGE_THICK_ENVELOPE" : undefined,
      packageWeightOz: isSingleMediaCase ? 8 : undefined,
      packageLengthIn: isSingleMediaCase ? 10 : undefined,
      packageWidthIn: isSingleMediaCase ? 7 : undefined,
      packageHeightIn: isSingleMediaCase ? 1 : undefined,
      listedPrice: args.ebayPrice,
      currentPrice: args.ebayPrice,
      pricingStatus: args.ebayPrice !== undefined ? "Ready for eBay" : "Ready for Pricing",
      pricingSource: args.ebayPrice !== undefined ? "Bulk intake price" : undefined,
      pricingUpdatedAt: args.ebayPrice !== undefined ? now : undefined,
      notes: args.ebayShipping ? `Shipping plan: ${args.ebayShipping}` : undefined,
      createdAt: now,
      updatedAt: now,
    });

    if (args.ebayPrice !== undefined) {
      await ctx.db.insert("listingPriceHistory", {
        ownerId,
        listingId,
        assetId,
        date: now,
        price: args.ebayPrice,
        reason: "Initial bulk-intake draft price",
        createdAt: now,
      });
    }

    const copyNumber = existingCopies.length + 1;
    const batchItemId = args.batchId ? await ctx.db.insert("intakeBatchItems", {
      ownerId, batchId: args.batchId, scanToken: args.scanToken || String(assetId), barcode: upc,
      status: args.metadataConfidence === "Low" || args.mediaFormat === "Unknown" ? "Review" : "Saved",
      assetId, listingId, title, mediaFormat: args.mediaFormat, confidence: args.metadataConfidence, sku, copyNumber,
      createdAt: now, updatedAt: now,
    }) : null;
    if (args.batchId) await ctx.db.patch(args.batchId, { updatedAt: now });
    return { assetId, listingId, sku, copyNumber, batchItemId };
  },
});
