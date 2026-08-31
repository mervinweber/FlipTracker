import { resolveShippingProfile, shippingProfileForKey, type EbayShippingProfileKey } from '../config/ebayListingDefaults.ts';

export type FulfillmentListing = {
  assetType?: string;
  mediaFormat?: string;
  title?: string;
  soldPrice?: number;
  purchasePrice?: number;
  shippingCharged?: number;
  shippingCost?: number;
  fees?: number;
  shippingPreset?: string;
  packageWeightOz?: number;
  packageLengthIn?: number;
  packageWidthIn?: number;
  packageHeightIn?: number;
};

export type FulfillmentRecommendation = {
  profileKey: EbayShippingProfileKey;
  profileLabel: string;
  packageStyle: string;
  weightOz: number;
  dimensions: { length: number; width: number; height: number };
  carrier: 'USPS' | 'UPS';
  service: string;
  reason: string;
  insuranceRecommended: boolean;
  warnings: string[];
};

function validPositive(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function recommendFulfillment(listing: FulfillmentListing): FulfillmentRecommendation {
  const resolved = resolveShippingProfile(listing);
  const savedProfile = shippingProfileForKey((listing.shippingPreset || resolved.key) as EbayShippingProfileKey);
  const weightOz = validPositive(listing.packageWeightOz, savedProfile.weight.value);
  const dimensions = {
    length: validPositive(listing.packageLengthIn, savedProfile.dimensions.length),
    width: validPositive(listing.packageWidthIn, savedProfile.dimensions.width),
    height: validPositive(listing.packageHeightIn, savedProfile.dimensions.height),
  };
  const identity = `${listing.assetType || ''} ${listing.mediaFormat || ''} ${listing.title || ''}`.toLowerCase();
  const soldPrice = listing.soldPrice || 0;
  const warnings: string[] = [];
  let carrier: 'USPS' | 'UPS' = 'USPS';
  let service = 'USPS Ground Advantage';
  let reason = 'Reliable tracked service for a standard parcel.';

  const isCard = /card|pokemon|pokémon|yu-gi-oh|yugioh|tcg|ccg/.test(identity);
  const isMediaMailEligible = /book|dvd|blu[- ]?ray|cd|music/.test(identity) && !/video game|game disc|software/.test(identity);
  const volume = dimensions.length * dimensions.width * dimensions.height;

  if (isCard && weightOz <= 3 && soldPrice > 0 && soldPrice <= 20) {
    service = 'eBay Standard Envelope';
    reason = 'Low-value trading card within the 3 oz envelope limit.';
    warnings.push('Confirm the card, envelope thickness, and order value remain eligible in eBay Labels.');
  } else if (isMediaMailEligible) {
    service = 'USPS Media Mail';
    reason = 'The item appears eligible media; confirm no advertising or ineligible inserts are included.';
  } else if (weightOz >= 48 || volume > 1_728) {
    carrier = 'UPS';
    service = 'UPS Ground';
    reason = 'Compare UPS Ground for this heavier or bulkier package.';
  } else if (weightOz > 16) {
    service = 'USPS Ground Advantage';
    reason = 'Tracked parcel service; compare UPS Ground before purchase if the box is dense.';
  }

  if (/video game|game disc|software/.test(identity)) warnings.push('Video games and software are not eligible for USPS Media Mail.');
  if (savedProfile.requiresMeasuredValues) warnings.push('Custom packages must be weighed and measured before buying the label.');

  return {
    profileKey: savedProfile.key,
    profileLabel: savedProfile.label,
    packageStyle: savedProfile.packageStyle,
    weightOz,
    dimensions,
    carrier,
    service,
    reason,
    insuranceRecommended: soldPrice >= 100,
    warnings,
  };
}

export function fulfillmentEconomics(listing: FulfillmentListing) {
  const soldPrice = listing.soldPrice || 0;
  const shippingCharged = listing.shippingCharged || 0;
  const shippingCost = listing.shippingCost || 0;
  const fees = listing.fees || 0;
  const purchasePrice = listing.purchasePrice || 0;
  return {
    shippingMargin: Math.round((shippingCharged - shippingCost) * 100) / 100,
    estimatedNet: Math.round((soldPrice + shippingCharged - shippingCost - fees - purchasePrice) * 100) / 100,
  };
}
