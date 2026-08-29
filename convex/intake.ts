import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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

const photoLotItem = v.object({
  scanToken: v.string(),
  title: v.string(),
  console: v.optional(v.string()),
  edition: v.optional(v.string()),
  releaseYear: v.optional(v.string()),
  upc: v.optional(v.string()),
  condition: v.string(),
  completeness: v.string(),
  storageLocation: v.optional(v.string()),
  purchasePrice: v.optional(v.number()),
  estimatedLow: v.optional(v.number()),
  estimatedHigh: v.optional(v.number()),
  ebayTitle: v.string(),
  ebayDescription: v.string(),
  ebayPrice: v.optional(v.number()),
  confidence: v.optional(v.number()),
  reviewNotes: v.optional(v.string()),
});

export const createPhotoLot = mutation({
  args: {
    batchId: v.id("intakeBatches"),
    source: v.optional(v.string()),
    shippingPlan: v.optional(v.string()),
    skuPrefix: v.string(),
    createDraft: v.boolean(),
    items: v.array(photoLotItem),
  },
  handler: async (ctx, args) => {
    if (!args.items.length || args.items.length > 12) throw new Error("A photo lot must contain between 1 and 12 items.");
    const ownerId = await currentOwnerId(ctx);
    const batch = await ctx.db.get(args.batchId);
    assertOwner(batch, ownerId, "Intake batch");
    const duplicateTokens = new Set<string>();
    for (const item of args.items) {
      if (!item.title.trim()) throw new Error("Every photo-lot row needs a title.");
      if (!item.ebayTitle.trim()) throw new Error(`Add an eBay title for ${item.title || "each item"}.`);
      if (duplicateTokens.has(item.scanToken)) throw new Error("The photo lot contains a duplicate row token.");
      duplicateTokens.add(item.scanToken);
      if (item.purchasePrice !== undefined && item.purchasePrice < 0) throw new Error("Purchase price cannot be negative.");
      if (item.ebayPrice !== undefined && item.ebayPrice < 0) throw new Error("Listing price cannot be negative.");
    }

    const now = Date.now();
    const prefix = args.skuPrefix.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 18) || "FT-GAME";
    const created: Array<{ assetId: Id<"assets">; listingId: Id<"marketplaceListings"> | null; sku: string }> = [];
    let newPurchaseTotal = 0;
    for (const item of args.items) {
      const prior = await ctx.db.query("intakeBatchItems")
        .withIndex("by_batchId_and_scanToken", (q) => q.eq("batchId", args.batchId).eq("scanToken", item.scanToken))
        .unique();
      if (prior) {
        assertOwner(prior, ownerId, "Intake item");
        created.push({ assetId: prior.assetId, listingId: prior.listingId ?? null, sku: prior.sku });
        continue;
      }
      const upc = item.upc?.trim() || undefined;
      newPurchaseTotal += item.purchasePrice || 0;
      const existingCopies = upc
        ? (await ctx.db.query("assets").withIndex("by_upc", (q) => q.eq("upc", upc)).take(100)).filter((asset) => !ownerId || asset.ownerId === ownerId)
        : [];
      const confidenceLabel = item.confidence !== undefined && item.confidence >= 0.8 ? "High" : item.confidence !== undefined && item.confidence >= 0.55 ? "Medium" : "Low";
      const assetId = await ctx.db.insert("assets", {
        ownerId,
        type: "Video Game",
        console: item.console?.trim() || undefined,
        title: item.title.trim(),
        edition: item.edition?.trim() || undefined,
        mediaFormat: "Video Game",
        upc,
        barcode: upc,
        barcodeType: upc ? (upc.length === 12 ? "UPC-A" : "EAN / UPC") : undefined,
        releaseYear: item.releaseYear?.trim() || undefined,
        metadataSource: "Gemini photo lot review",
        metadataConfidence: confidenceLabel,
        metadataCheckedAt: now,
        intakeBatchId: args.batchId,
        storageLocation: item.storageLocation?.trim() || undefined,
        purchasePrice: item.purchasePrice,
        estimatedLow: item.estimatedLow,
        estimatedHigh: item.estimatedHigh,
        valueSource: "Estimated",
        needsValueCheck: true,
        condition: item.condition,
        completeness: item.completeness,
        complete: item.completeness === "Complete" || item.completeness === "Sealed",
        status: "Inventory",
        listingRecommendation: "Review",
        strategy: "Review",
        ebayTitle: item.ebayTitle.trim().slice(0, 80),
        ebayDescription: item.ebayDescription.trim(),
        ebayCategory: "Video Games & Consoles > Video Games",
        ebayCategoryId: "139973",
        ebayCondition: item.condition === "New" || item.completeness === "Sealed" ? "Brand New" : item.condition,
        ebayItemSpecifics: [item.console ? `Platform: ${item.console.trim()}` : "", upc ? `UPC: ${upc}` : ""].filter(Boolean).join("\n") || undefined,
        ebayPrice: item.ebayPrice,
        ebayShipping: args.shippingPlan?.trim() || undefined,
        notes: item.reviewNotes?.trim() || undefined,
        confidence: confidenceLabel,
        createdAt: now,
        updatedAt: now,
      });
      const sku = `${prefix}-${String(assetId).slice(-8).toUpperCase()}`;
      let listingId = null;
      if (args.createDraft) {
        listingId = await ctx.db.insert("marketplaceListings", {
          ownerId,
          assetId,
          intakeBatchId: args.batchId,
          platform: "eBay",
          status: "Draft",
          sku,
          title: item.ebayTitle.trim().slice(0, 80),
          description: item.ebayDescription.trim(),
          category: "Video Games & Consoles > Video Games",
          ebayCategoryId: "139973",
          condition: item.condition === "New" || item.completeness === "Sealed" ? "Brand New" : item.condition,
          language: "English",
          itemSpecifics: [item.console ? `Platform: ${item.console.trim()}` : "", upc ? `UPC: ${upc}` : ""].filter(Boolean).join("\n") || undefined,
          imageMode: (item.condition === "New" || item.completeness === "Sealed") && upc ? "eBay Catalog" : "Actual Item Photo",
          shippingPreset: "Single Game Parcel",
          packageType: "PACKAGE_THICK_ENVELOPE",
          packageWeightOz: 8,
          packageLengthIn: 10,
          packageWidthIn: 7,
          packageHeightIn: 1,
          listedPrice: item.ebayPrice,
          currentPrice: item.ebayPrice,
          pricingStatus: item.ebayPrice !== undefined ? "Ready for eBay" : "Ready for Pricing",
          pricingSource: item.ebayPrice !== undefined ? "AI working estimate - seller review required" : undefined,
          pricingUpdatedAt: item.ebayPrice !== undefined ? now : undefined,
          notes: args.shippingPlan ? `Shipping plan: ${args.shippingPlan}` : undefined,
          createdAt: now,
          updatedAt: now,
        });
        if (item.ebayPrice !== undefined) {
          await ctx.db.insert("listingPriceHistory", {
            ownerId, listingId, assetId, date: now, price: item.ebayPrice,
            reason: "Initial AI photo-lot working estimate", createdAt: now,
          });
        }
      }
      const reviewNeeded = confidenceLabel === "Low" || !item.console;
      await ctx.db.insert("intakeBatchItems", {
        ownerId, batchId: args.batchId, scanToken: item.scanToken, barcode: upc || `PHOTO-${item.scanToken.slice(0, 8)}`,
        status: reviewNeeded ? "Review" : "Saved", assetId, listingId: listingId || undefined,
        title: item.title.trim(), mediaFormat: item.console?.trim() || "Video Game", confidence: confidenceLabel,
        sku, copyNumber: existingCopies.length + 1, message: reviewNeeded ? (item.reviewNotes?.trim() || "Confirm the title and platform before publishing.") : undefined,
        createdAt: now, updatedAt: now,
      });
      created.push({ assetId, listingId, sku });
    }
    await ctx.db.patch(args.batchId, {
      source: args.source?.trim() || batch.source,
      purchaseTotal: Math.round(((batch.purchaseTotal || 0) + newPurchaseTotal) * 100) / 100,
      updatedAt: now,
    });
    return { created, count: created.length, draftCount: created.filter((item) => item.listingId).length };
  },
});
