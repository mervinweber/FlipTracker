import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { ArrowRight, Barcode, Camera, CheckCircle2, ImagePlus, Images, MapPin, Search, Star, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { resizeForListing } from '../utils/listingPhotos';

type PhotoTarget = {
  assetId: Id<'assets'>;
  listingId?: Id<'marketplaceListings'>;
  title: string;
  edition?: string;
  format?: string;
  upc?: string;
  sku?: string;
  storageLocation?: string;
  condition?: string;
  photoCount: number;
  primaryPhotoUrl?: string | null;
  hasDraft: boolean;
};

export default function PhotoQueuePanel() {
  const queue = useQuery(api.photos.queue) as PhotoTarget[] | undefined;
  const [target, setTarget] = useState<PhotoTarget | null>(null);
  const [entryCode, setEntryCode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const matches = useQuery(api.photos.findByCode, lookupCode ? { code: lookupCode } : 'skip') as PhotoTarget[] | undefined;
  const photos = useQuery(api.photos.listForAsset, target ? { assetId: target.assetId } : 'skip');
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const removePhoto = useMutation(api.photos.remove);
  const makePrimary = useMutation(api.photos.makePrimary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControls = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (!matches || matches.length !== 1) return;
    setTarget(matches[0]);
  }, [matches]);

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setScannerError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setScannerError('Camera scanning needs the deployed HTTPS app. Enter the SKU or UPC manually if needed.');
      return;
    }
    void reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result, _error, controls) => {
      if (!result || cancelled) return;
      const code = result.getText().trim();
      controls.stop();
      setEntryCode(code);
      setLookupCode(code);
      setScannerOpen(false);
    }).then((controls) => {
      if (cancelled) controls.stop();
      else scannerControls.current = controls;
    }).catch(() => {
      if (!cancelled) setScannerError('Camera access failed. Check browser permission or enter the code manually.');
    });
    return () => {
      cancelled = true;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
  }, [scannerOpen]);

  function findRecord(event: FormEvent) {
    event.preventDefault();
    const code = entryCode.trim();
    if (!code) return;
    setTarget(null);
    setLookupCode(code);
    setError('');
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!target) return;
    const selected = Array.from(files);
    const room = 12 - (photos?.length ?? 0);
    if (room <= 0) {
      setError('This item already has the maximum of 12 photos.');
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
        await attachPhoto({ assetId: target.assetId, storageId: result.storageId, filename: file.name, contentType: blob.type || 'image/jpeg' });
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

  function chooseTarget(item: PhotoTarget) {
    setTarget(item);
    setLookupCode('');
    setEntryCode(item.sku || item.upc || '');
    setError('');
  }

  function nextItem() {
    const next = queue?.find((item) => item.assetId !== target?.assetId);
    setTarget(next ?? null);
    setEntryCode(next?.sku || next?.upc || '');
    setLookupCode('');
    setError('');
  }

  return (
    <section className="photoQueuePage">
      <header className="guideHeader photoQueueHeader">
        <div><p className="eyebrow">Mobile listing prep</p><h2>Photo Queue</h2><p>Match an existing physical copy, capture its eBay photos, then move to the next draft.</p></div>
        <div className="photoQueueCount"><Images size={20}/><strong>{queue?.length ?? 0}</strong><span>need photos</span></div>
      </header>

      <section className="photoLookupBand">
        <form onSubmit={findRecord} className="photoLookupForm"><Search size={19}/><input value={entryCode} onChange={(event) => setEntryCode(event.target.value)} placeholder="Scan or enter FlipTracker SKU / UPC" aria-label="Find inventory record by SKU or UPC"/><button type="submit">Find</button></form>
        <button className="secondary" onClick={() => setScannerOpen(true)}><Barcode size={17}/> Scan Code</button>
      </section>

      {matches && lookupCode && matches.length !== 1 ? <section className="panel photoMatches"><div className="panelHeader"><div><h2>{matches.length ? 'Choose the physical copy' : 'No matching record'}</h2><p>{matches.length ? 'The UPC belongs to more than one inventory item. Use the SKU or bin to choose correctly.' : `No inventory record matched ${lookupCode}. Scan it into inventory on the computer first.`}</p></div></div>{matches.map((item) => <button className="photoMatchRow secondary" key={item.assetId} onClick={() => chooseTarget(item)}><div><strong>{item.title}</strong><small>{[item.sku && `SKU ${item.sku}`, item.upc && `UPC ${item.upc}`, item.storageLocation && `Bin ${item.storageLocation}`].filter(Boolean).join(' · ')}</small></div><ArrowRight size={17}/></button>)}</section> : null}

      <div className="photoQueueLayout">
        <aside className="panel photoQueueList">
          <div className="panelHeader"><div><h2>Waiting For Photos</h2><p>Drafts using actual item photos.</p></div></div>
          {queue === undefined ? <p>Loading queue...</p> : queue.length === 0 ? <div className="empty compact"><CheckCircle2 size={26}/><p>Every queued draft has at least one actual photo.</p></div> : queue.map((item) => <button key={item.assetId} className={`photoQueueItem ${target?.assetId === item.assetId ? 'active' : ''}`} onClick={() => chooseTarget(item)}><div><strong>{item.title}</strong><small>{[item.format, item.sku && `SKU ${item.sku}`, item.upc].filter(Boolean).join(' · ')}</small></div>{item.storageLocation ? <span><MapPin size={13}/>{item.storageLocation}</span> : null}</button>)}
        </aside>

        <section className="panel photoWorkspace">
          {!target ? <div className="empty photoEmpty"><Camera size={42}/><h2>Select or scan an item</h2><p>Use the queue, FlipTracker SKU, or UPC. Scanning here finds the existing record and never creates a duplicate.</p></div> : <>
            <div className="photoTargetHeader"><div><p className="eyebrow">Current item</p><h2>{target.title}</h2><p>{[target.edition, target.format, target.condition].filter(Boolean).join(' · ')}</p><div className="photoTargetMeta">{target.sku ? <span>SKU {target.sku}</span> : null}{target.upc ? <span>UPC {target.upc}</span> : null}{target.storageLocation ? <span><MapPin size={13}/>{target.storageLocation}</span> : null}</div></div><span className="statusPill">{photos?.length ?? 0} / 12 photos</span></div>
            <div className="photoCaptureActions"><label className="button photoCaptureButton"><Camera size={18}/>{busy ? 'Uploading...' : 'Take Photo'}<input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={handleFiles}/></label><label className="button secondary photoCaptureButton"><ImagePlus size={18}/> Choose Photos<input type="file" accept="image/*" multiple hidden disabled={busy} onChange={handleFiles}/></label></div>
            {error ? <p className="setupNotice errorNotice">{error}</p> : null}
            <div className="photoGrid">{photos?.map((photo, index) => <article key={photo._id} className={`photoTile ${index === 0 ? 'primary' : ''}`}>{photo.url ? <img src={photo.url} alt={`${target.title} photo ${index + 1}`}/> : <div className="previewPlaceholder">Loading...</div>}<div className="photoTileBar"><span>{index === 0 ? <><Star size={13}/> Primary</> : `Photo ${index + 1}`}</span><div>{index !== 0 ? <button className="iconButton secondary" title="Make primary" aria-label="Make this the primary photo" onClick={() => makePrimary({ photoId: photo._id })}><Star size={15}/></button> : null}<button className="iconButton danger" title="Delete photo" aria-label="Delete photo" onClick={() => removePhoto({ photoId: photo._id })}><Trash2 size={15}/></button></div></div></article>)}</div>
            <div className="photoWorkflowFooter"><p>Recommended: front, back, spine, open case/disc, and any flaws.</p><button disabled={!photos?.length || busy} onClick={nextItem}>Done & Next <ArrowRight size={17}/></button></div>
          </>}
        </section>
      </div>

      {scannerOpen ? <div className="modalBackdrop"><section className="modal scannerModal"><header className="modalHeader"><div><h2>Find Existing Item</h2><span className="statusPill">SKU / UPC</span></div><button className="iconButton secondary" aria-label="Close scanner" onClick={() => setScannerOpen(false)}><X size={18}/></button></header><div className="cameraFrame"><video ref={videoRef} muted playsInline autoPlay/></div>{scannerError ? <p className="warningText">{scannerError}</p> : <p>Aim at the UPC barcode. For duplicate copies, enter or scan the FlipTracker SKU instead.</p>}</section></div> : null}
    </section>
  );
}
