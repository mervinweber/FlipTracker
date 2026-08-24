import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { currentOwnerId } from "./ownership";

const optionalText = v.optional(v.string());

function ebaySingletonKey(ownerId?: string) {
  return `seller:${process.env.EBAY_ENVIRONMENT?.toLowerCase() === "production" ? "production" : "sandbox"}${ownerId ? `:${ownerId}` : ""}`;
}

export const createCard = mutation({
  args: {
    game: v.union(v.literal("pokemon"), v.literal("yugioh")),
    provider: v.string(),
    providerId: v.string(),
    name: v.string(),
    setName: optionalText,
    setCode: optionalText,
    collectorNumber: optionalText,
    printedCode: optionalText,
    rarity: optionalText,
    language: v.string(),
    finish: optionalText,
    edition: optionalText,
    imageUrl: optionalText,
    identificationMethod: v.string(),
    identificationConfidence: v.number(),
    condition: v.string(),
    storageLocation: optionalText,
    purchasePrice: v.optional(v.number()),
    listingPrice: v.optional(v.number()),
    createDraft: v.boolean(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Confirm the card name before saving.");
    if (args.identificationConfidence < 0 || args.identificationConfidence > 1) throw new Error("Identification confidence must be between 0 and 1.");
    if (args.purchasePrice !== undefined && args.purchasePrice < 0) throw new Error("Purchase price cannot be negative.");
    if (args.listingPrice !== undefined && args.listingPrice < 0) throw new Error("Listing price cannot be negative.");
    const now = Date.now();
    const ownerId = await currentOwnerId(ctx);
    const type = args.game === "pokemon" ? "Pokemon Card" : "Yu-Gi-Oh! Card";
    const identifier = args.printedCode || [args.setCode, args.collectorNumber].filter(Boolean).join("-") || args.providerId;
    const assetId = await ctx.db.insert("assets", {
      ownerId,
      type,
      title: name,
      mediaFormat: "Trading Card",
      barcode: identifier,
      barcodeType: "Card identifier",
      cardProductType: "Single Card",
      cardGame: args.game === "pokemon" ? "Pokemon" : "Yu-Gi-Oh!",
      cardSet: args.setName || args.setCode,
      cardNumber: args.collectorNumber || args.printedCode,
      cardProvider: args.provider,
      cardProviderId: args.providerId,
      cardLanguage: args.language,
      cardRarity: args.rarity,
      cardFinish: args.finish,
      cardEdition: args.edition,
      cardIdentificationMethod: args.identificationMethod,
      cardIdentificationConfidence: args.identificationConfidence,
      coverImageUrl: args.imageUrl,
      metadataSource: args.provider,
      metadataConfidence: args.identificationConfidence >= 0.9 ? "High" : args.identificationConfidence >= 0.7 ? "Medium" : "Low",
      metadataCheckedAt: now,
      storageLocation: args.storageLocation,
      purchasePrice: args.purchasePrice,
      condition: args.condition,
      completeness: "Single Card",
      complete: true,
      valueSource: "Estimated",
      needsValueCheck: true,
      status: "Inventory",
      listingRecommendation: "Review",
      strategy: "Review",
      ebayTitle: [name, args.setName, args.printedCode || args.collectorNumber, args.rarity, args.finish].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 80),
      ebayDescription: [`Card: ${name}`, args.setName ? `Set: ${args.setName}` : "", identifier ? `Card number/code: ${identifier}` : "", args.rarity ? `Rarity: ${args.rarity}` : "", args.finish ? `Finish: ${args.finish}` : "", `Language: ${args.language}`, `Condition: ${args.condition}`, "Review the actual front and back photos for condition details."].filter(Boolean).join("\n"),
      ebayCondition: args.condition,
      ebayPrice: args.listingPrice,
      confidence: args.identificationConfidence >= 0.9 ? "High" : args.identificationConfidence >= 0.7 ? "Medium" : "Low",
      createdAt: now,
      updatedAt: now,
    });
    const sku = `FT-CARD-${String(assetId).slice(-8).toUpperCase()}`;
    if (!args.createDraft) return { assetId, listingId: null, sku };
    const settings = await ctx.db.query("ebaySettings").withIndex("by_singletonKey", (q) => q.eq("singletonKey", ebaySingletonKey(ownerId))).unique();
    const ebayCategoryId = args.game === "pokemon" ? settings?.pokemonCardCategoryId : settings?.yugiohCardCategoryId;
    const itemSpecifics = [
      `Game: ${args.game === "pokemon" ? "Pokemon TCG" : "Yu-Gi-Oh! TCG"}`,
      args.setName ? `Set: ${args.setName}` : "",
      identifier ? `Card Number: ${identifier}` : "",
      args.rarity ? `Rarity: ${args.rarity}` : "",
      args.finish ? `Finish: ${args.finish}` : "",
      args.edition ? `Edition: ${args.edition}` : "",
      `Language: ${args.language}`,
    ].filter(Boolean).join("\n");
    const listingId = await ctx.db.insert("marketplaceListings", {
      ownerId,
      assetId,
      platform: "eBay",
      status: "Draft",
      sku,
      title: [name, args.setName, identifier, args.rarity, args.finish].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 80),
      description: `Card: ${name}\n${itemSpecifics}\nCondition: ${args.condition}\nReview the actual front and back photos for condition details.`,
      category: args.game === "pokemon" ? "Collectible Card Games > Pokemon" : "Collectible Card Games > Yu-Gi-Oh!",
      condition: args.condition,
      language: args.language,
      cardProductType: "Single Card",
      cardGame: args.game === "pokemon" ? "Pokemon" : "Yu-Gi-Oh!",
      cardSet: args.setName || args.setCode,
      cardNumber: args.collectorNumber || args.printedCode,
      cardProvider: args.provider,
      cardProviderId: args.providerId,
      cardLanguage: args.language,
      cardRarity: args.rarity,
      cardFinish: args.finish,
      cardEdition: args.edition,
      itemSpecifics,
      listedPrice: args.listingPrice,
      currentPrice: args.listingPrice,
      ebayCategoryId,
      shippingPreset: "trading-card",
      packageType: "LETTER",
      packageWeightOz: 3,
      packageLengthIn: 7,
      packageWidthIn: 5,
      packageHeightIn: 0.25,
      imageMode: "Actual Item Photo",
      pricingStatus: args.listingPrice !== undefined ? "Ready for eBay" : "Ready for Pricing",
      pricingSource: args.listingPrice !== undefined ? "Card intake price" : undefined,
      pricingUpdatedAt: args.listingPrice !== undefined ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    if (args.listingPrice !== undefined) await ctx.db.insert("listingPriceHistory", { ownerId, listingId, assetId, date: now, price: args.listingPrice, reason: "Initial card-intake draft price", createdAt: now });
    return { assetId, listingId, sku };
  },
});
