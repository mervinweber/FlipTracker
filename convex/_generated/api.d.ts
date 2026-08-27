/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiDescriptions from "../aiDescriptions.js";
import type * as assets from "../assets.js";
import type * as cardCatalog from "../cardCatalog.js";
import type * as cardIntake from "../cardIntake.js";
import type * as collections from "../collections.js";
import type * as crossListings from "../crossListings.js";
import type * as ebay from "../ebay.js";
import type * as ebayTaxonomy from "../ebayTaxonomy.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as intakeBatches from "../intakeBatches.js";
import type * as lib_ebayNativeRevision from "../lib/ebayNativeRevision.js";
import type * as lib_sourcingRules from "../lib/sourcingRules.js";
import type * as linkedAccounts from "../linkedAccounts.js";
import type * as listings from "../listings.js";
import type * as mediaLookup from "../mediaLookup.js";
import type * as ownership from "../ownership.js";
import type * as photos from "../photos.js";
import type * as reports from "../reports.js";
import type * as research from "../research.js";
import type * as sourcing from "../sourcing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiDescriptions: typeof aiDescriptions;
  assets: typeof assets;
  cardCatalog: typeof cardCatalog;
  cardIntake: typeof cardIntake;
  collections: typeof collections;
  crossListings: typeof crossListings;
  ebay: typeof ebay;
  ebayTaxonomy: typeof ebayTaxonomy;
  http: typeof http;
  intake: typeof intake;
  intakeBatches: typeof intakeBatches;
  "lib/ebayNativeRevision": typeof lib_ebayNativeRevision;
  "lib/sourcingRules": typeof lib_sourcingRules;
  linkedAccounts: typeof linkedAccounts;
  listings: typeof listings;
  mediaLookup: typeof mediaLookup;
  ownership: typeof ownership;
  photos: typeof photos;
  reports: typeof reports;
  research: typeof research;
  sourcing: typeof sourcing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
