import { ChangeEvent, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Camera, ImagePlus, Star, Trash2 } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

async function resizeForListing(file: File) {
  let image: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};
  if ('createImageBitmap' in window) {
    const bitmap = await window.createImageBitmap(file);
    image = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(file);
    const element = new Image();
    await new Promise<void>((resolve, reject) => {
      element.onload = () => resolve();
      element.onerror = () => reject(new Error('This browser could not read the selected photo.'));
      element.src = objectUrl;
    });
    image = element;
    width = element.naturalWidth;
    height = element.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    cleanup();
    return file;
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  cleanup();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', 0.84));
}

export default function ListingPhotoManager({ assetId, title, onPhotoAttached }: { assetId: Id<'assets'>; title: string; onPhotoAttached?: () => void }) {
  const photos = useQuery(api.photos.listForAsset, { assetId });
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const removePhoto = useMutation(api.photos.remove);
  const makePrimary = useMutation(api.photos.makePrimary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    const room = 12 - (photos?.length ?? 0);
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

  return (
    <div className="listingPhotoManager">
      <div className="listingPhotoHeader"><div><strong>Listing Photos</strong><small>First image is primary. These upload to eBay in this order.</small></div><span className="statusPill">{photos?.length ?? 0} / 12</span></div>
      <div className="photoCaptureActions"><label className="button photoCaptureButton"><Camera size={18}/>{busy ? 'Uploading...' : 'Take Photo'}<input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={handleFiles}/></label><label className="button secondary photoCaptureButton"><ImagePlus size={18}/> Choose Photos<input type="file" accept="image/*" multiple hidden disabled={busy} onChange={handleFiles}/></label></div>
      {error ? <p className="setupNotice errorNotice">{error}</p> : null}
      {photos === undefined ? <p className="compactText">Loading photos...</p> : photos.length === 0 ? <div className="listingPhotoEmpty"><Camera size={24}/><span>No actual item photos yet.</span></div> : <div className="photoGrid listingPhotoGrid">{photos.map((photo, index) => <article key={photo._id} className={`photoTile ${index === 0 ? 'primary' : ''}`}>{photo.url ? <img src={photo.url} alt={`${title} photo ${index + 1}`}/> : <div className="previewPlaceholder">Loading...</div>}<div className="photoTileBar"><span>{index === 0 ? <><Star size={13}/> Primary</> : `Photo ${index + 1}`}</span><div>{index !== 0 ? <button type="button" className="iconButton secondary" title="Make primary" aria-label="Make this the primary photo" onClick={() => makePrimary({ photoId: photo._id })}><Star size={15}/></button> : null}<button type="button" className="iconButton danger" title="Delete photo" aria-label="Delete photo" onClick={() => removePhoto({ photoId: photo._id })}><Trash2 size={15}/></button></div></div></article>)}</div>}
    </div>
  );
}
