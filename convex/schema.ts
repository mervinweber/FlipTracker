import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  collections: defineTable({
    name: v.string(),
    source: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_purchaseDate", ["purchaseDate"]),

  assets: defineTable({
    type: v.string(),
    console: v.optional(v.string()),
    title: v.string(),
    edition: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    estimatedLow: v.optional(v.number()),
    estimatedHigh: v.optional(v.number()),
    userLow: v.optional(v.number()),
    userHigh: v.optional(v.number()),
    valueSource: v.optional(v.string()),
    needsValueCheck: v.optional(v.boolean()),
    lastValueCheckAt: v.optional(v.number()),
    localLow: v.optional(v.number()),
    localHigh: v.optional(v.number()),
    priority: v.optional(v.string()),
    strategy: v.optional(v.string()),
    status: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    soldPrice: v.optional(v.number()),
    fees: v.optional(v.number()),
    shipping: v.optional(v.number()),
    condition: v.optional(v.string()),
    complete: v.optional(v.boolean()),
    manual: v.optional(v.boolean()),
    barcode: v.optional(v.string()),
    notes: v.optional(v.string()),
    confidence: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_console", ["console"])
    .index("by_status", ["status"])
    .index("by_collection", ["collectionId"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["type", "console", "status"] }),

  sales: defineTable({
    assetId: v.id("assets"),
    platform: v.optional(v.string()),
    soldDate: v.optional(v.string()),
    soldPrice: v.number(),
    fees: v.optional(v.number()),
    shipping: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_asset", ["assetId"]),

  valueHistory: defineTable({
    assetId: v.id("assets"),
    source: v.string(),
    low: v.optional(v.number()),
    high: v.optional(v.number()),
    observedPrice: v.optional(v.number()),
    url: v.optional(v.string()),
    notes: v.optional(v.string()),
    checkedAt: v.number(),
  }).index("by_asset", ["assetId"]),

  researchChecks: defineTable({
    assetId: v.id("assets"),
    method: v.string(),
    confidence: v.string(),
    recommendation: v.optional(v.string()),
    notes: v.optional(v.string()),
    nextReviewAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_asset", ["assetId"]),
});
