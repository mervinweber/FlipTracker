import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx | ActionCtx;

export async function currentOwnerId(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return identity.tokenIdentifier;
  if (process.env.FLIPTRACKER_AUTH_REQUIRED === "true") {
    throw new ConvexError("Sign in to access FlipTracker.");
  }
  return undefined;
}

export function applyOwnerFilter<T extends { ownerId?: string }>(rows: T[], ownerId?: string) {
  return ownerId ? rows.filter((row) => row.ownerId === ownerId) : rows;
}

export async function requireOwnerId(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in to access FlipTracker.");
  return identity.tokenIdentifier;
}

export function assertOwner<T extends { ownerId?: string }>(
  record: T | null | undefined,
  ownerId: string | undefined,
  resource = "Record",
): asserts record is T {
  if (!record || (ownerId && record.ownerId !== ownerId)) throw new ConvexError(`${resource} not found.`);
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { authenticated: false, authRequired: process.env.FLIPTRACKER_AUTH_REQUIRED === "true", needsLegacyClaim: false };
    const ownerId = identity.tokenIdentifier;
    const profile = await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
    const legacyAsset = await ctx.db.query("assets").withIndex("by_ownerId", (q) => q.eq("ownerId", undefined)).first();
    return {
      authenticated: true,
      authRequired: process.env.FLIPTRACKER_AUTH_REQUIRED === "true",
      needsLegacyClaim: Boolean(legacyAsset) && !profile?.legacyDataClaimedAt,
      profile,
    };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in to create a FlipTracker profile.");
    const ownerId = identity.tokenIdentifier;
    const now = Date.now();
    const existing = await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
    const profile = {
      ownerId,
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, profile);
      return existing._id;
    }
    return await ctx.db.insert("users", { ...profile, createdAt: now });
  },
});

export const claimLegacyData = mutation({
  args: { adminKey: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.FLIPTRACKER_ADMIN_KEY;
    if (!expected || args.adminKey !== expected) throw new ConvexError("Seller access key is incorrect.");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in before claiming existing FlipTracker data.");
    const ownerId = identity.tokenIdentifier;
    const claimedProfile = (await ctx.db.query("users").collect()).find((profile) => profile.legacyDataClaimedAt && profile.ownerId !== ownerId);
    if (claimedProfile) throw new ConvexError("The existing FlipTracker data has already been assigned to another account.");

    const tables = [
      "intakeBatches", "intakeBatchItems", "collections", "assets", "assetPhotos", "sales",
      "linkedAccounts", "crossListings", "marketplaceListings", "listingPriceHistory", "listingEvents",
      "sourcingAnalyses", "sourcingComps", "valueHistory", "researchChecks",
      "ebayConnections", "ebayOauthStates", "ebaySettings",
    ] as const;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await (ctx.db as any).query(table).collect() as Array<{ _id: unknown; ownerId?: string }>;
      const unowned = rows.filter((row) => !row.ownerId);
      for (const row of unowned) {
        const ownerPatch = table === "ebayConnections" || table === "ebaySettings"
          ? { ownerId, singletonKey: `seller:${(row as { environment?: string }).environment ?? "sandbox"}:${ownerId}` }
          : { ownerId };
        await ctx.db.patch(row._id as any, ownerPatch);
      }
      counts[table] = unowned.length;
    }

    const now = Date.now();
    const existing = await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
    const profile = {
      ownerId,
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      legacyDataClaimedAt: now,
      updatedAt: now,
    };
    if (existing) await ctx.db.patch(existing._id, profile);
    else await ctx.db.insert("users", { ...profile, createdAt: now });
    return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
  },
});
