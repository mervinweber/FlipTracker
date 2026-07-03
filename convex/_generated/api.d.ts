/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as assets from "../assets.js";
import type * as collections from "../collections.js";
import type * as reports from "../reports.js";
import type * as research from "../research.js";

declare const fullApi: ApiFromModules<{
  assets: typeof assets;
  collections: typeof collections;
  reports: typeof reports;
  research: typeof research;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
