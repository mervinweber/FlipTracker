import { ChangeEvent, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Camera, ImagePlus, RotateCw, Star, Trash2 } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { resizeForListing, rotatePhotoClockwise } from '../utils/listingPhotos';

type ListingPhotoManagerProps = {
  assetId: Id<'assets'>;
  listingId?: Id<'marketplaceListings'>;
  title: string;
  onPhotoAttached?: () => void;
};

const EBAY_PHOTO_LIMIT = 12;

export default function ListingPhotoManager({ assetId, listingId, title, onPhotoAttached }: ListingPhotoManagerProps) {
  const assetPhotos = useQuery(api.photos.listForAsset, listingId ? 'skip' : { assetId });
  const listingPhotos = useQuery(api.photos.listForListing, listingId ? { listingId } : 'skip');
  const photos = listingId ? listingPhotos : assetPhotos;
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const removePhoto = useMutation(api.photos.remove);
  const replacePhoto = useMutation(api.photos.replace);
  const makePrimary = useMutation(api.photos.makePrimary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const totalPhotoCount = photos?.length ?? 0;
  const includedPhotoCount = photos?.filter((photo) => !('includedInEbay' in photo) || photo.includedInEbay).length ?? 0;
  const omittedPhotoCount = Math.max(0, totalPhotoCount - includedPhotoCount);

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    const room = EBAY_PHOTO_LIMIT - includedPhotoCount;
    if (room <= 0) {
      setError('This listing already has the maximum of 12 photos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      for (const file of selected.slice(0, room)) {
        const blob = await resizeForListing(file);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
        if (!response.ok) throw new Error('Photo upload failed. Check the connection and try again.');
        const result = await response.json() as { storageId: Id<'_storage'> };
        await attachPhoto({ assetId, storageId: result.storageId, filename: file.name, contentType: blob.type || 'image/jpeg' });
        onPhotoAttached?.();
      }
      if (selected.length > room) setError(`Only the first ${room} photos were added because eBay supports up to 12.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not save the photos.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) await uploadFiles(event.target.files);
    event.target.value = '';
  }

  async function rotateStoredPhoto(photo: NonNullable<typeof photos>[number]) {
    if (!photo.url) return;
    setBusy(true);
    setError('');
    try {
      const source = await fetch(photo.url);
      if (!source.ok) throw new Error('Could not load the photo for rotation.');
      const blob = await rotatePhotoClockwise(await source.blob());
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
      if (!response.ok) throw new Error('Could not save the rotated photo.');
      const result = await response.json() as { storageId: Id<'_storage'> };
      await replacePhoto({ photoId: photo._id, storageId: result.storageId, contentType: blob.type || 'image/jpeg' });
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Could not rotate the photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="listingPhotoManager">
      <div className="listingPhotoHeader"><div><strong>Listing Photos</strong><small>{listingId ? 'Includes every bundle item, ordered by item and photo. eBay receives the first 12.' : 'First image is primary. These upload to eBay in this order.'}</small></div><span className="statusPill">{listingId ? `${includedPhotoCount} / ${EBAY_PHOTO_LIMIT} for eBay` : `${totalPhotoCount} / ${EBAY_PHOTO_LIMIT}`}</span></div>
      {listingId && omittedPhotoCount > 0 ? <p className="setupNotice">This listing has {omittedPhotoCount} photo{omittedPhotoCount === 1 ? '' : 's'} beyond the first {EBAY_PHOTO_LIMIT}; reorder or remove earlier photos to control which images are sent.</p> : null}
      <div className="photoCaptureActions"><label className="button photoCaptureButton"><Camera size={18}/>{busy ? 'Uploading...' : 'Take Photo'}<input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={handleFiles}/></label><label className="button secondary photoCaptureButton"><ImagePlus size={18}/> Choose Photos<input type="file" accept="image/*" multiple hidden disabled={busy} onChange={handleFiles}/></label></div>
      {omittedPhotoCount ? <p className="setupNotice warningNotice"><strong>{omittedPhotoCount} photo{omittedPhotoCount === 1 ? '' : 's'} will not be sent to eBay.</strong> Remove unneeded earlier photos from the bundle members to change which 12 are included.</p> : null}
      {error ? <p className="setupNotice errorNotice">{error}</p> : null}
      {photos === undefined ? <p className="compactText">Loading photos...</p> : photos.length === 0 ? <div className="listingPhotoEmpty"><Camera size={24}/><span>No actual item photos yet.</span></div> : <div className="photoGrid listingPhotoGrid">{photos.map((photo, index) => {
        const assetTitle = 'assetTitle' in photo && typeof photo.assetTitle === 'string' ? photo.assetTitle : undefined;
        const includedInEbay = !('includedInEbay' in photo) || photo.includedInEbay;
        return <article key={photo._id} className={`photoTile ${index === 0 ? 'primary' : ''} ${includedInEbay ? '' : 'excludedFromEbay'}`}>
          {photo.url ? <img src={photo.url} alt={`${assetTitle || title} photo ${index + 1}`}/> : <div className="previewPlaceholder">Loading...</div>}
          {assetTitle ? <div className="photoAssetLabel" title={assetTitle}>{assetTitle}</div> : null}
          <div className="photoTileBar"><span>{includedInEbay ? index === 0 ? <><Star size={13}/> Primary</> : `Photo ${index + 1}` : 'Not sent'}</span><div><button type="button" className="iconButton secondary" title="Rotate clockwise" aria-label={`Rotate photo ${index + 1} clockwise`} disabled={busy} onClick={() => rotateStoredPhoto(photo)}><RotateCw size={15}/></button>{!listingId && index !== 0 ? <button type="button" className="iconButton secondary" title="Make primary" aria-label="Make this the primary photo" disabled={busy} onClick={() => makePrimary({ photoId: photo._id })}><Star size={15}/></button> : null}<button type="button" className="iconButton danger" title="Delete photo" aria-label="Delete photo" disabled={busy} onClick={() => removePhoto({ photoId: photo._id })}><Trash2 size={15}/></button></div></div>
        </article>;
      })}</div>}
    </div>
  );
}
