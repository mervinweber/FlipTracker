export const EBAY_PHOTO_LIMIT = 12;

export type BundlePhotoGroup<T> = {
  bundlePosition: number;
  photos: T[];
};

export function selectBundlePhotos<T>(groups: BundlePhotoGroup<T>[], limit = EBAY_PHOTO_LIMIT) {
  const ordered = [...groups]
    .sort((left, right) => left.bundlePosition - right.bundlePosition)
    .flatMap((group) => group.photos);
  const safeLimit = Math.max(0, Math.floor(limit));

  return {
    included: ordered.slice(0, safeLimit),
    omitted: ordered.slice(safeLimit),
    total: ordered.length,
  };
}
