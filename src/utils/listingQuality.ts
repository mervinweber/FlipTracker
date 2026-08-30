import type { ListingReadinessIssue, ListingReadinessInput } from './listingReadiness.ts';
import { listingFamily, type ListingFamily } from './listingSpeedPresets.ts';

export type ListingQualityInput = ListingReadinessInput & {
  description?: string | null;
  actualPhotoCount?: number | null;
  purchasePrice?: number | null;
  shippingCost?: number | null;
  shippingCharged?: number | null;
};

export type ListingQualityCheck = {
  key: 'readiness' | 'title' | 'description' | 'photos' | 'profit';
  label: string;
  status: 'pass' | 'warning' | 'blocker';
  message: string;
  deduction: number;
};

export type ListingQualityAssessment = {
  score: number;
  grade: 'Ready' | 'Good' | 'Needs work' | 'Blocked';
  family: ListingFamily;
  recommendedPhotoCount: number;
  photoChecklist: string[];
  estimatedProfit?: number;
  checks: ListingQualityCheck[];
};

const PHOTO_CHECKLISTS: Record<ListingFamily, string[]> = {
  book: ['Front cover', 'Back cover / ISBN', 'Spine', 'Wear or markings'],
  movie: ['Front cover', 'Back cover / UPC', 'Disc surface', 'Case or artwork flaws'],
  game: ['Front cover', 'Back cover / UPC', 'Disc or cartridge', 'Manual / inserts', 'Case flaws'],
  card: ['Card front', 'Card back', 'Corners / surface detail'],
  clothing: ['Front', 'Back', 'Brand / size tag', 'Material / care tag', 'Any flaw', 'Measurements'],
  general: ['Front', 'Back', 'Model / serial label', 'Included parts', 'Any flaw'],
};

const RECOMMENDED_PHOTO_COUNTS: Record<ListingFamily, number> = {
  book: 2,
  movie: 3,
  game: 4,
  card: 2,
  clothing: 5,
  general: 4,
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function priceFor(listing: ListingQualityInput) {
  return listing.currentPrice ?? listing.listedPrice ?? listing.price ?? 0;
}

export function photoChecklistFor(listing: Pick<ListingQualityInput, 'assetType' | 'itemType' | 'mediaFormat' | 'title'>) {
  const family = listingFamily(listing);
  return {
    family,
    recommendedCount: RECOMMENDED_PHOTO_COUNTS[family],
    shots: PHOTO_CHECKLISTS[family],
  };
}

export function assessListingQuality(
  listing: ListingQualityInput,
  readinessIssues: readonly ListingReadinessIssue[],
  feePercent = 15,
): ListingQualityAssessment {
  const photoGuide = photoChecklistFor(listing);
  const blockers = readinessIssues.filter((issue) => issue.blocking).length;
  const warnings = readinessIssues.length - blockers;
  const title = clean(listing.title);
  const description = clean(listing.description);
  const photoCount = Math.max(0, listing.actualPhotoCount ?? (listing.hasActualPhoto ? 1 : 0));
  const resolvedPrice = priceFor(listing);
  const hasCostInputs = listing.purchasePrice !== undefined || listing.shippingCost !== undefined;
  const estimatedProfit = resolvedPrice > 0 && hasCostInputs
    ? resolvedPrice + (listing.shippingCharged ?? 0) - (resolvedPrice + (listing.shippingCharged ?? 0)) * feePercent / 100 - (listing.purchasePrice ?? 0) - (listing.shippingCost ?? 0)
    : undefined;
  const checks: ListingQualityCheck[] = [];

  checks.push({
    key: 'readiness',
    label: 'Required fields',
    status: blockers ? 'blocker' : warnings ? 'warning' : 'pass',
    message: blockers ? `${blockers} blocking issue${blockers === 1 ? '' : 's'}` : warnings ? `${warnings} recommended field${warnings === 1 ? '' : 's'} missing` : 'All locally required fields pass',
    deduction: Math.min(55, blockers * 15 + warnings * 4),
  });
  const titleStatus = !title || title.length > 80 ? 'blocker' : title.length < 35 ? 'warning' : 'pass';
  checks.push({
    key: 'title',
    label: 'Title',
    status: titleStatus,
    message: !title ? 'Title is missing' : title.length > 80 ? `${title.length}/80 characters` : title.length < 35 ? `${title.length}/80 characters; add useful edition or format terms` : `${title.length}/80 characters`,
    deduction: titleStatus === 'blocker' ? 15 : titleStatus === 'warning' ? 5 : 0,
  });
  const descriptionStatus = description.length < 40 ? 'warning' : 'pass';
  checks.push({
    key: 'description',
    label: 'Description',
    status: descriptionStatus,
    message: descriptionStatus === 'pass' ? 'Buyer-facing description is present' : 'Add condition, completeness, and item-specific disclosures',
    deduction: descriptionStatus === 'warning' ? 6 : 0,
  });
  const catalogMode = /catalog/i.test(clean(listing.imageMode));
  const photoStatus = catalogMode || photoCount >= photoGuide.recommendedCount ? 'pass' : photoCount > 0 ? 'warning' : 'blocker';
  checks.push({
    key: 'photos',
    label: 'Photos',
    status: photoStatus,
    message: catalogMode ? 'Eligible catalog-image workflow selected' : `${photoCount}/${photoGuide.recommendedCount} recommended photos`,
    deduction: photoStatus === 'blocker' ? 15 : photoStatus === 'warning' ? 6 : 0,
  });
  const profitStatus = estimatedProfit === undefined ? 'warning' : estimatedProfit < 3 ? 'warning' : 'pass';
  checks.push({
    key: 'profit',
    label: 'Estimated profit',
    status: profitStatus,
    message: estimatedProfit === undefined ? 'Add item or shipping cost to preview profit' : `$${estimatedProfit.toFixed(2)} after ${feePercent}% estimated fees`,
    deduction: profitStatus === 'warning' ? 5 : 0,
  });

  const score = Math.max(0, 100 - checks.reduce((total, check) => total + check.deduction, 0));
  const grade = blockers || checks.some((check) => check.status === 'blocker')
    ? 'Blocked'
    : score >= 90 ? 'Ready' : score >= 75 ? 'Good' : 'Needs work';
  return { score, grade, family: photoGuide.family, recommendedPhotoCount: photoGuide.recommendedCount, photoChecklist: photoGuide.shots, estimatedProfit, checks };
}

function parseSpecifics(value?: string | null) {
  const lines = clean(value).split('\n').map((line) => line.trim()).filter(Boolean);
  const names = new Set(lines.map((line) => line.split(':', 1)[0].trim().toLowerCase()));
  return { lines, names };
}

export function applySafeSpecificDefaults<T extends {
  assetType?: string | null;
  itemType?: string | null;
  mediaFormat?: string | null;
  title?: string | null;
  itemSpecifics?: string | null;
}>(listing: T): T {
  const family = listingFamily(listing);
  const { lines, names } = parseSpecifics(listing.itemSpecifics);
  const additions: Array<[string, string | undefined]> = [];
  if (family === 'book') additions.push(['Language', 'English']);
  if (family === 'movie') {
    additions.push(['Type', 'Movie']);
    additions.push(['Format', clean(listing.mediaFormat) || undefined]);
  }
  if (family === 'game') {
    additions.push(['Type', 'Video Game']);
    additions.push(['Format', clean(listing.mediaFormat) || undefined]);
  }
  for (const [name, value] of additions) {
    if (value && !names.has(name.toLowerCase())) lines.push(`${name}: ${value}`);
  }
  return { ...listing, itemSpecifics: lines.length ? lines.join('\n') : listing.itemSpecifics };
}
