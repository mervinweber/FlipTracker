import { query } from "./_generated/server";
import { applyOwnerFilter, currentOwnerId } from "./ownership";

function low(a: any) { return a.valueSource === "User Override" ? (a.userLow || 0) : (a.estimatedLow || 0); }
function high(a: any) { return a.valueSource === "User Override" ? (a.userHigh || 0) : (a.estimatedHigh || 0); }

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await currentOwnerId(ctx);
    const assets = applyOwnerFilter(await ctx.db.query("assets").collect(), ownerId);
    const collections = applyOwnerFilter(await ctx.db.query("collections").collect(), ownerId);
    return {
      assetCount: assets.length,
      collectionCount: collections.length,
      estimatedValue: assets.reduce((s, a) => s + ((low(a) + high(a)) / 2), 0),
      invested: assets.reduce((s, a) => s + (a.purchasePrice || 0), 0),
      needsValueCheck: assets.filter((a) => a.needsValueCheck).length,
      twentyPlus: assets.filter((a) => high(a) >= 20).length,
      byConsole: assets.reduce<Record<string, number>>((acc, a) => {
        const key = a.console || "Unknown"; acc[key] = (acc[key] || 0) + 1; return acc;
      }, {}),
    };
  },
});
