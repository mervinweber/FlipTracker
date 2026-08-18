import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx | ActionCtx;

export async function currentOwnerId(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? undefined;
}

export function applyOwnerFilter<T extends { ownerId?: string }>(rows: T[], ownerId?: string) {
  return ownerId ? rows.filter((row) => row.ownerId === ownerId) : rows;
}
