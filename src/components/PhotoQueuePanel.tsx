import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { ArrowRight, Barcode, Camera, CheckCircle2, CircleStop, ImagePlus, Images, MapPin, Pause, Play, RotateCw, Search, SkipForward, Star, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { resizeForListing, rotatePhotoClockwise } from '../utils/listingPhotos';
import { photoChecklistFor } from '../utils/listingQuality';
import { clearPhotoSession, completePhotoTarget, createPhotoSession, formatPhotoSessionDuration, loadPhotoSession, pausePhotoSession, photoSessionElapsedMs, recordPhotoUpload, resumePhotoSession, savePhotoSession, skipPhotoTarget, type PhotoSession } from '../utils/photoSession';

type PhotoTarget = {
  assetId: Id<'assets'>;
  listingId?: Id<'marketplaceListings'>;
  title: string;
  assetType?: string;
  edition?: string;
  format?: string;
  upc?: string;
  sku?: string;
  storageLocation?: string;
  condition?: string;
  photoCount: number;
  primaryPhotoUrl?: string | null;
  hasDraft: boolean;
  photosCompleteAt?: number;
};

export default function PhotoQueuePanel() {
  const queue = useQuery(api.photos.queue) as PhotoTarget[] | undefined;
  const legacyPhotoCount = useQuery(api.photos.legacyPhotoAssets, { limit: 250 })?.length ?? 0;
  const [target, setTarget] = useState<PhotoTarget | null>(null);
  const [entryCode, setEntryCode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const matches = useQuery(api.photos.findByCode, lookupCode ? { code: lookupCode } : 'skip') as PhotoTarget[] | undefined;
  const photos = useQuery(api.photos.listForAsset, target ? { assetId: target.assetId } : 'skip');
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const removePhoto = useMutation(api.photos.remove);
  const replacePhoto = useMutation(api.photos.replace);
  const makePrimary = useMutation(api.photos.makePrimary);
  const markPhotosComplete = useMutation(api.photos.markComplete);
  const migrateLegacyPhotos = useAction(api.photos.migrateLegacyPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [photoSession, setPhotoSession] = useState<PhotoSession | null>(() => loadPhotoSession(localStorage));
  const [photoSessionSummary, setPhotoSessionSummary] = useState<PhotoSession | null>(null);
  const [photoSessionNow, setPhotoSessionNow] = useState(Date.now());
  const [sessionMessage, setSessionMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControls = useRef<IScannerControls | null>(null);
  const lookupInputRef = useRef<HTMLInputElement | null>(null);
  const photoGuide = useMemo(() => target ? photoChecklistFor({ assetType: target.assetType, mediaFormat: target.format, title: target.title }) : null, [target]);
  const currentPhotoCount = Math.max(target?.photoCount ?? 0, photos?.length ?? 0);
  const sessionElapsed = photoSession ? photoSessionElapsedMs(photoSession, photoSessionNow) : 0;
  const sessionPaused = Boolean(photoSession && !photoSession.activeSince);

  useEffect(() => {
    if (!matches || matches.length !== 1) return;
    setTarget(matches[0]);
  }, [matches]);

  useEffect(() => {
    if (!photoSession) {
      clearPhotoSession(localStorage);
      return;
    }
    savePhotoSession(photoSession, localStorage);
    if (!photoSession.activeSince) return;
    const timer = window.setInterval(() => setPhotoSessionNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [photoSession]);

  useEffect(() => {
    if (!photoSession?.activeSince || target || !queue?.length) return;
    const next = queue.find((item) => !photoSession.skippedAssetIds.includes(item.assetId));
    if (next) chooseTarget(next);
  }, [photoSession?.activeSince, photoSession?.skippedAssetIds, queue, target]);

  useEffect(() => {
    if (!photoSession?.activeSince || target) return;
    const frame = window.requestAnimationFrame(() => lookupInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [photoSession?.activeSince, target]);

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

  function nextAvailableTarget(excludedAssetId?: Id<'assets'>, skippedAssetIds = photoSession?.skippedAssetIds ?? []) {
    return queue?.find((item) => item.assetId !== excludedAssetId && !skippedAssetIds.includes(item.assetId));
  }

  function moveToTarget(next?: PhotoTarget) {
    setTarget(next ?? null);
    setEntryCode(next?.sku || next?.upc || '');
    setLookupCode('');
    setError('');
  }

  function startPhotoSession() {
    const nextSession = createPhotoSession(queue?.length ?? 0);
    setPhotoSession(nextSession);
    setPhotoSessionNow(nextSession.startedAt);
    setSessionMessage('Photo session started. Complete the shot guide, then continue through the stack.');
    moveToTarget(queue?.[0]);
  }

  function togglePhotoSessionPause() {
    if (!photoSession) return;
    const now = Date.now();
    const next = photoSession.activeSince ? pausePhotoSession(photoSession, now) : resumePhotoSession(photoSession, now);
    setPhotoSession(next);
    setPhotoSessionNow(now);
    setSessionMessage(next.activeSince ? 'Session resumed.' : 'Session paused. Progress is saved on this device.');
  }

  function finishPhotoSession() {
    if (!photoSession) return;
    const finished = pausePhotoSession(photoSession, Date.now());
    setPhotoSessionSummary(finished);
    setPhotoSession(null);
    setSessionMessage('');
  }

  async function completeCurrentTarget(automatic = false, count = currentPhotoCount) {
    if (!target?.listingId || !photoGuide || count < 1) {
      setError('Add at least one actual item photo before completing this item.');
      return;
    }
    if (!automatic && count < photoGuide.recommendedCount && !confirm(`This ${photoGuide.family} has ${count} of ${photoGuide.recommendedCount} recommended photos. Complete it anyway?`)) return;
    setBusy(true);
    setError('');
    try {
      await markPhotosComplete({ listingId: target.listingId });
      setPhotoSession((current) => current ? completePhotoTarget(current) : current);
      const next = nextAvailableTarget(target.assetId);
      setSessionMessage(`${target.title} completed with ${count} photo${count === 1 ? '' : 's'}.${next ? ' Next item opened.' : ' No more unskipped items are waiting.'}`);
      moveToTarget(next);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Could not complete this photo item.');
    } finally {
      setBusy(false);
    }
  }

  function skipCurrentTarget() {
    if (!photoSession || !target) return;
    const nextSession = skipPhotoTarget(photoSession, target.assetId);
    setPhotoSession(nextSession);
    const next = nextAvailableTarget(target.assetId, nextSession.skippedAssetIds);
    setSessionMessage(`${target.title} skipped for this session.${next ? ' Next item opened.' : ' No more unskipped items are waiting.'}`);
    moveToTarget(next);
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
      let uploaded = 0;
      for (const file of selected.slice(0, room)) {
        const blob = await resizeForListing(file);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
        if (!response.ok) throw new Error('Photo upload failed. Check the connection and try again.');
        const result = await response.json() as { storageId: Id<'_storage'> };
        await attachPhoto({ assetId: target.assetId, storageId: result.storageId, filename: file.name, contentType: blob.type || 'image/jpeg' });
        uploaded += 1;
      }
      if (uploaded) setPhotoSession((current) => current ? recordPhotoUpload(current, uploaded) : current);
      if (selected.length > room) setError(`Only the first ${room} photos were added because eBay supports up to 12.`);
      const projectedCount = currentPhotoCount + uploaded;
      if (photoSession?.activeSince && photoGuide && projectedCount >= photoGuide.recommendedCount) {
        await completeCurrentTarget(true, projectedCount);
      }
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
    if (!photo.url || busy) return;
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

  function chooseTarget(item: PhotoTarget) {
    setTarget(item);
    setLookupCode('');
    setEntryCode(item.sku || item.upc || '');
    setError('');
  }

  return (
    <section className="photoQueuePage">
      <header className="guideHeader photoQueueHeader">
        <div><p className="eyebrow">Mobile listing prep</p><h2>Photo Queue</h2><p>Match an existing physical copy, capture its eBay photos, then move to the next draft.</p></div>
        <div className="photoQueueHeaderActions"><div className="photoQueueCount"><Images size={20}/><strong>{queue?.length ?? 0}</strong><span>need photos</span></div>{!photoSession ? <button disabled={!queue?.length} onClick={startPhotoSession}><Play size={16}/> Start Photo Session</button> : null}{legacyPhotoCount > 0 ? <button className="secondary" onClick={async () => { await migrateLegacyPhotos({ limit: legacyPhotoCount }); }}><Camera size={16}/> Migrate Legacy Photos ({legacyPhotoCount})</button> : null}</div>
      </header>

      {photoSession ? <section className={`photoSessionBar ${photoSession.activeSince ? 'active' : 'paused'}`}>
        <div className="photoSessionStatus"><span/><div><strong>{photoSession.activeSince ? 'Photo session active' : 'Photo session paused'}</strong><small>{formatPhotoSessionDuration(sessionElapsed)} elapsed</small></div></div>
        <div className="photoSessionMetrics"><span><strong>{photoSession.completed}</strong> completed</span><span><strong>{photoSession.photosAdded}</strong> photos</span><span><strong>{Math.max(0, photoSession.initialTotal - photoSession.completed)}</strong> remaining</span></div>
        <div className="photoSessionActions"><button className="iconButton secondary" onClick={togglePhotoSessionPause} aria-label={photoSession.activeSince ? 'Pause photo session' : 'Resume photo session'} title={photoSession.activeSince ? 'Pause session' : 'Resume session'}>{photoSession.activeSince ? <Pause size={17}/> : <Play size={17}/>}</button><button className="iconButton secondary" onClick={finishPhotoSession} aria-label="Finish photo session" title="Finish session"><CircleStop size={17}/></button></div>
        {sessionMessage ? <p aria-live="polite">{sessionMessage}</p> : null}
      </section> : null}

      <section className="photoLookupBand">
        <form onSubmit={findRecord} className="photoLookupForm"><Search size={19}/><input ref={lookupInputRef} value={entryCode} onChange={(event) => setEntryCode(event.target.value)} placeholder="Scan or enter FlipTracker SKU / UPC" aria-label="Find inventory record by SKU or UPC"/><button type="submit">Find</button></form>
        <button className="secondary" onClick={() => setScannerOpen(true)}><Barcode size={17}/> Scan Code</button>
      </section>

      {matches && lookupCode && matches.length !== 1 ? <section className="panel photoMatches"><div className="panelHeader"><div><h2>{matches.length ? 'Choose the physical copy' : 'No matching record'}</h2><p>{matches.length ? 'The UPC belongs to more than one inventory item. Use the SKU or bin to choose correctly.' : `No inventory record matched ${lookupCode}. Scan it into inventory on the computer first.`}</p></div></div>{matches.map((item) => <button className="photoMatchRow secondary" key={item.assetId} onClick={() => chooseTarget(item)}><div><strong>{item.title}</strong><small>{[item.sku && `SKU ${item.sku}`, item.upc && `UPC ${item.upc}`, item.storageLocation && `Bin ${item.storageLocation}`].filter(Boolean).join(' · ')}</small></div><ArrowRight size={17}/></button>)}</section> : null}

      <div className="photoQueueLayout">
        <aside className="panel photoQueueList">
          <div className="panelHeader"><div><h2>Waiting For Photos</h2><p>Drafts using actual item photos.</p></div></div>
          {queue === undefined ? <p>Loading queue...</p> : queue.length === 0 ? <div className="empty compact"><CheckCircle2 size={26}/><p>Every queued draft has completed its photo workflow.</p></div> : queue.map((item) => { const guide = photoChecklistFor({ assetType: item.assetType, mediaFormat: item.format, title: item.title }); return <button key={item.assetId} className={`photoQueueItem ${target?.assetId === item.assetId ? 'active' : ''}`} onClick={() => chooseTarget(item)}><div><strong>{item.title}</strong><small>{[item.format, item.sku && `SKU ${item.sku}`, item.upc].filter(Boolean).join(' · ')}</small></div><span className="photoQueueItemProgress">{item.photoCount}/{guide.recommendedCount} core photos</span>{item.storageLocation ? <span><MapPin size={13}/>{item.storageLocation}</span> : null}</button>; })}
        </aside>

        <section className="panel photoWorkspace">
          {!target ? <div className="empty photoEmpty"><Camera size={42}/><h2>Select or scan an item</h2><p>Use the queue, FlipTracker SKU, or UPC. Scanning here finds the existing record and never creates a duplicate.</p></div> : <>
            <div className="photoTargetHeader"><div><p className="eyebrow">Current item</p><h2>{target.title}</h2><p>{[target.edition, target.format, target.condition].filter(Boolean).join(' · ')}</p><div className="photoTargetMeta">{target.sku ? <span>SKU {target.sku}</span> : null}{target.upc ? <span>UPC {target.upc}</span> : null}{target.storageLocation ? <span><MapPin size={13}/>{target.storageLocation}</span> : null}</div></div><span className="statusPill">{currentPhotoCount} / 12 photos</span></div>
            {photoGuide ? <section className="photoShotGuide"><div><strong>{photoGuide.recommendedCount} core photos</strong><small>{photoGuide.family} checklist · additional condition details are encouraged</small></div><ol>{photoGuide.shots.map((shot, index) => <li key={shot} className={index < currentPhotoCount ? 'complete' : index < photoGuide.recommendedCount ? 'core' : ''}>{index < currentPhotoCount ? <CheckCircle2 size={15}/> : <Camera size={15}/>}<span>{shot}</span>{index >= photoGuide.recommendedCount ? <small>Optional</small> : null}</li>)}</ol></section> : null}
            <div className="photoCaptureActions"><label className={`button photoCaptureButton ${sessionPaused ? 'disabled' : ''}`}><Camera size={18}/>{busy ? 'Uploading...' : 'Take Photo'}<input type="file" accept="image/*" capture="environment" hidden disabled={busy || sessionPaused} onChange={handleFiles}/></label><label className={`button secondary photoCaptureButton ${sessionPaused ? 'disabled' : ''}`}><ImagePlus size={18}/> Choose Photos<input type="file" accept="image/*" multiple hidden disabled={busy || sessionPaused} onChange={handleFiles}/></label></div>
            {error ? <p className="setupNotice errorNotice">{error}</p> : null}
            <div className="photoGrid">{photos?.map((photo, index) => <article key={photo._id} className={`photoTile ${index === 0 ? 'primary' : ''}`}>{photo.url ? <img src={photo.url} alt={`${target.title} photo ${index + 1}`}/> : <div className="previewPlaceholder">Loading...</div>}<div className="photoTileBar"><span>{index === 0 ? <><Star size={13}/> Primary</> : `Photo ${index + 1}`}</span><div><button className="iconButton secondary" title="Rotate clockwise" aria-label={`Rotate photo ${index + 1} clockwise`} disabled={busy} onClick={() => rotateStoredPhoto(photo)}><RotateCw size={15}/></button>{index !== 0 ? <button className="iconButton secondary" title="Make primary" aria-label="Make this the primary photo" disabled={busy} onClick={() => makePrimary({ photoId: photo._id })}><Star size={15}/></button> : null}<button className="iconButton danger" title="Delete photo" aria-label="Delete photo" disabled={busy} onClick={() => removePhoto({ photoId: photo._id })}><Trash2 size={15}/></button></div></div></article>)}</div>
            <div className="photoWorkflowFooter"><p>{currentPhotoCount >= (photoGuide?.recommendedCount ?? 1) ? 'Core photo checklist complete.' : `${Math.max(0, (photoGuide?.recommendedCount ?? 1) - currentPhotoCount)} core photo${Math.max(0, (photoGuide?.recommendedCount ?? 1) - currentPhotoCount) === 1 ? '' : 's'} remaining.`}</p><div className="actions">{photoSession ? <button className="secondary" disabled={busy || sessionPaused} onClick={skipCurrentTarget}><SkipForward size={16}/> Skip</button> : null}<button disabled={!currentPhotoCount || busy || sessionPaused} onClick={() => completeCurrentTarget(false)}>Complete & Next <ArrowRight size={17}/></button></div></div>
          </>}
        </section>
      </div>

      {scannerOpen ? <div className="modalBackdrop"><section className="modal scannerModal"><header className="modalHeader"><div><h2>Find Existing Item</h2><span className="statusPill">SKU / UPC</span></div><button className="iconButton secondary" aria-label="Close scanner" onClick={() => setScannerOpen(false)}><X size={18}/></button></header><div className="cameraFrame"><video ref={videoRef} muted playsInline autoPlay/></div>{scannerError ? <p className="warningText">{scannerError}</p> : <p>Aim at the UPC barcode. For duplicate copies, enter or scan the FlipTracker SKU instead.</p>}</section></div> : null}
      {photoSessionSummary ? <div className="modalBackdrop"><section className="modal photoSessionSummaryModal"><header className="modalHeader"><div><p className="eyebrow">Photo session complete</p><h2>Stack photographed</h2><p>Every completed item remains attached to its original inventory record.</p></div><button className="iconButton secondary" aria-label="Close photo session summary" onClick={() => setPhotoSessionSummary(null)}><X size={18}/></button></header><div className="photoSessionSummaryGrid"><div><span>Time</span><strong>{formatPhotoSessionDuration(photoSessionElapsedMs(photoSessionSummary))}</strong></div><div><span>Items</span><strong>{photoSessionSummary.completed}</strong></div><div><span>Photos</span><strong>{photoSessionSummary.photosAdded}</strong></div><div><span>Skipped</span><strong>{photoSessionSummary.skippedAssetIds.length}</strong></div></div><p>{queue?.length ?? 0} item{queue?.length === 1 ? '' : 's'} remain in the photo queue.</p><div className="modalActions"><button className="secondary" onClick={() => setPhotoSessionSummary(null)}>Done</button>{queue?.length ? <button onClick={() => { setPhotoSessionSummary(null); startPhotoSession(); }}><Play size={16}/> Start Another Session</button> : null}</div></section></div> : null}
    </section>
  );
}
