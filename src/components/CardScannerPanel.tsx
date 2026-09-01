import { ChangeEvent, useMemo, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { Camera, Check, Copy, ImagePlus, Layers3, LoaderCircle, RotateCw, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { buildCardListingCopy, cardDuplicateKey, countExactDuplicates, recommendCardDisposition, type CardGame, type CardIdentity } from '../utils/cardSession';
import { resizeForListing, rotatePhotoClockwise } from '../utils/listingPhotos';
import './card-scanner.css';

type Candidate = {
  provider: string;
  providerId: string;
  game: CardGame;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  printedCode?: string;
  rarity?: string;
  finish?: string;
  edition?: string;
  sourceUrl?: string;
  imageUrl?: string;
  marketPrice?: number;
  confidence: number;
};

type CapturedPhoto = { file: File; previewUrl: string };
type Destination = 'inventory' | 'ebay' | 'vinted';
type SessionCard = CardIdentity & {
  sku: string;
  title: string;
  description: string;
  price?: number;
  destination: Destination;
  disposition: string;
  photoCount: number;
};

async function imageDataUrl(file: File) {
  const blob = await resizeForListing(file);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This browser could not read the card photo.'));
    reader.readAsDataURL(blob);
  });
}

function money(value?: number) {
  return value === undefined ? '' : `$${value.toFixed(2)}`;
}

function destinationLabel(destination: Destination) {
  if (destination === 'ebay') return 'eBay draft';
  if (destination === 'vinted') return 'Vinted prep';
  return 'Inventory';
}

function rankCandidates(candidates: Candidate[], rarity?: string, finish?: string, edition?: string, copyrightYear?: string) {
  return [...candidates].sort((left, right) => {
    const score = (candidate: Candidate) => {
      const reprint2020 = /2020 date reprint/i.test(candidate.setName || '');
      return Number(candidate.rarity === rarity)
        + Number(candidate.finish === finish)
        + Number(candidate.edition === edition)
        + Number(copyrightYear === '2020' && reprint2020)
        + Number(copyrightYear === '1996' && !reprint2020);
    };
    return score(right) - score(left);
  });
}

export default function CardScannerPanel() {
  const lookup = useAction(api.cardCatalog.lookup);
  const identify = useAction(api.cardCatalog.extractIdentityFromImage);
  const createCard = useMutation(api.cardIntake.createCard);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attach);
  const [game, setGame] = useState<CardGame>('pokemon');
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [collectorNumber, setCollectorNumber] = useState('');
  const [printedCode, setPrintedCode] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<CapturedPhoto | null>(null);
  const [backPhoto, setBackPhoto] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState<'identify' | 'search' | 'save' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('English');
  const [finish, setFinish] = useState('');
  const [edition, setEdition] = useState('');
  const [suggestedRarity, setSuggestedRarity] = useState<{ value: string; confidence: number } | null>(null);
  const [suggestedFinish, setSuggestedFinish] = useState<{ value: string; confidence: number } | null>(null);
  const [suggestedCopyrightYear, setSuggestedCopyrightYear] = useState('');
  const [condition, setCondition] = useState('Near Mint');
  const [storageLocation, setStorageLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [destination, setDestination] = useState<Destination>('vinted');
  const [minimumSinglePrice, setMinimumSinglePrice] = useState('5');
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const searchReady = useMemo(() => game === 'yugioh' ? Boolean(printedCode.trim() || name.trim()) : Boolean(setCode.trim() || collectorNumber.trim() || name.trim()), [game, printedCode, setCode, collectorNumber, name]);

  const currentIdentity = useMemo<CardIdentity | null>(() => selected ? {
    game,
    providerId: selected.providerId,
    name: selected.name,
    setName: selected.setName,
    setCode: selected.setCode,
    collectorNumber: selected.collectorNumber,
    printedCode: selected.printedCode,
    rarity: selected.rarity,
    language,
    finish: finish || undefined,
    edition: edition || undefined,
  } : null, [selected, game, language, finish, edition]);

  const recommendation = useMemo(() => {
    if (!currentIdentity) return null;
    const exactCopies = countExactDuplicates(sessionCards, currentIdentity) + 1;
    const enteredPrice = listingPrice === '' ? undefined : Number(listingPrice);
    return {
      exactCopies,
      ...recommendCardDisposition({
        referencePrice: Number.isFinite(enteredPrice) ? enteredPrice : selected?.marketPrice,
        exactCopies,
        minimumSinglePrice: Number(minimumSinglePrice) || 5,
      }),
    };
  }, [currentIdentity, sessionCards, listingPrice, selected, minimumSinglePrice]);

  const duplicateGroups = useMemo(() => new Set(sessionCards.map(cardDuplicateKey)).size, [sessionCards]);
  const catalogVariantCount = useMemo(() => new Set(candidates.map((candidate) => [candidate.rarity, candidate.finish].filter(Boolean).join('|')).filter(Boolean)).size, [candidates]);

  function replacePhoto(side: 'front' | 'back', next: CapturedPhoto | null) {
    const current = side === 'front' ? frontPhoto : backPhoto;
    if (current) URL.revokeObjectURL(current.previewUrl);
    if (side === 'front') setFrontPhoto(next);
    else setBackPhoto(next);
  }

  function clearCurrentCard() {
    replacePhoto('front', null);
    replacePhoto('back', null);
    setCandidates([]);
    setSelected(null);
    setName('');
    setSetCode('');
    setCollectorNumber('');
    setPrintedCode('');
    setFinish('');
    setEdition('');
    setSuggestedRarity(null);
    setSuggestedFinish(null);
    setSuggestedCopyrightYear('');
    setPurchasePrice('');
    setListingPrice('');
  }

  function changeGame(next: CardGame) {
    setGame(next);
    clearCurrentCard();
    setError('');
    setNotice('');
  }

  async function runLookup() {
    if (!searchReady) return;
    setBusy('search');
    setError('');
    setNotice('');
    setSelected(null);
    try {
      const result = await lookup({ game, name: name.trim() || undefined, setCode: setCode.trim() || undefined, collectorNumber: collectorNumber.trim() || undefined, printedCode: printedCode.trim() || undefined });
      const nextCandidates = rankCandidates(result.candidates as Candidate[], suggestedRarity?.value, suggestedFinish?.value, edition, suggestedCopyrightYear);
      setCandidates(nextCandidates);
      if (!result.candidates.length) setNotice('No exact candidates found. Check the printed code and try again.');
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Card lookup failed.');
    } finally {
      setBusy('');
    }
  }

  async function identifyPhoto(file: File) {
    const adminKey = localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey') || '';
    if (!adminKey) {
      setNotice('Front photo saved. Load your private access key to use AI identification, or enter the printed identifiers manually.');
      return;
    }
    setBusy('identify');
    setError('');
    setNotice('');
    try {
      const result = await identify({ adminKey, game, imageDataUrl: await imageDataUrl(file) });
      setName(result.name || '');
      setPrintedCode(result.printedCode || '');
      setSetCode(result.setCode || '');
      setCollectorNumber(result.collectorNumber || '');
      setSuggestedRarity(result.rarity ? { value: result.rarity, confidence: result.rarityConfidence || 0 } : null);
      setSuggestedFinish(result.finish ? { value: result.finish, confidence: result.finishConfidence || 0 } : null);
      if (result.edition) setEdition(result.edition);
      setSuggestedCopyrightYear(result.copyrightYear || '');
      const rarityNote = result.rarity ? ` Possible ${result.rarity} (${Math.round((result.rarityConfidence || 0) * 100)}% visual confidence); confirm the foil pattern yourself.` : '';
      const finishNote = result.finish ? ` Possible ${result.finish} treatment (${Math.round((result.finishConfidence || 0) * 100)}% visual confidence).` : '';
      const printNote = result.edition || result.copyrightYear ? ` Printed marks suggest ${[result.edition, result.copyrightYear ? `copyright ${result.copyrightYear}` : ''].filter(Boolean).join(', ')}.` : '';
      const lookupArgs = {
        game,
        name: result.name || undefined,
        setCode: result.setCode || undefined,
        collectorNumber: result.collectorNumber || undefined,
        printedCode: result.printedCode || undefined,
      };
      const canLookup = game === 'yugioh' ? Boolean(lookupArgs.printedCode || lookupArgs.name) : Boolean(lookupArgs.setCode || lookupArgs.collectorNumber || lookupArgs.name);
      if (!canLookup) {
        setNotice(`Front read at ${Math.round(result.confidence * 100)}% confidence.${rarityNote}${finishNote}${printNote} The identifiers were not clear enough for an automatic catalog search.`);
        return;
      }
      const catalog = await lookup(lookupArgs);
      const nextCandidates = rankCandidates(catalog.candidates as Candidate[], result.rarity, result.finish, result.edition, result.copyrightYear);
      setCandidates(nextCandidates);
      if (nextCandidates.length === 1) {
        selectCandidate(nextCandidates[0]);
        setNotice(`Card identified and matched automatically at ${Math.round(result.confidence * 100)}% photo confidence.${rarityNote}${finishNote}${printNote} Confirm the selected printing before saving.`);
      } else if (nextCandidates.length > 1) {
        setNotice(`Card identified and ${nextCandidates.length} catalog variants found automatically.${rarityNote}${finishNote}${printNote} Choose the exact printing before saving.`);
      } else {
        setNotice(`Card identifiers were read, but no catalog match was found automatically. Review the code and retry the search.`);
      }
    } catch (identifyError) {
      setError(identifyError instanceof Error ? identifyError.message : 'Photo identification or catalog lookup failed.');
    } finally {
      setBusy('');
    }
  }

  async function capturePhoto(side: 'front' | 'back', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    replacePhoto(side, { file, previewUrl: URL.createObjectURL(file) });
    if (side === 'front') await identifyPhoto(file);
  }

  async function rotateCaptured(side: 'front' | 'back') {
    const current = side === 'front' ? frontPhoto : backPhoto;
    if (!current || busy) return;
    try {
      const rotated = await rotatePhotoClockwise(await resizeForListing(current.file));
      const file = new File([rotated], current.file.name || `${side}-card.jpg`, { type: rotated.type || 'image/jpeg' });
      replacePhoto(side, { file, previewUrl: URL.createObjectURL(file) });
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Could not rotate the photo.');
    }
  }

  function selectCandidate(candidate: Candidate) {
    setSelected(candidate);
    if (candidate.edition && !edition) setEdition(candidate.edition);
    if (candidate.finish) setFinish(candidate.finish);
    if (candidate.marketPrice !== undefined && !listingPrice) setListingPrice(candidate.marketPrice.toFixed(2));
    setNotice('Candidate selected. Confirm printing details, photos, and condition before saving.');
  }

  async function uploadPhoto(assetId: Id<'assets'>, captured: CapturedPhoto) {
    const blob = await resizeForListing(captured.file);
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    if (!response.ok) throw new Error('Photo upload failed. Check the connection and try again.');
    const result = await response.json() as { storageId: Id<'_storage'> };
    await attachPhoto({ assetId, storageId: result.storageId, filename: captured.file.name, contentType: blob.type || 'image/jpeg' });
  }

  async function saveCard() {
    if (!selected || !currentIdentity) return;
    if (!frontPhoto || !backPhoto) {
      setError('Add clear front and back photos before saving this card.');
      return;
    }
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const numericPrice = listingPrice === '' ? undefined : Number(listingPrice);
      const copy = buildCardListingCopy(currentIdentity, condition);
      const result = await createCard({
        game,
        provider: selected.provider,
        providerId: selected.providerId,
        name: selected.name,
        setName: selected.setName,
        setCode: selected.setCode,
        collectorNumber: selected.collectorNumber,
        printedCode: selected.printedCode,
        rarity: selected.rarity,
        language,
        finish: finish || undefined,
        edition: edition || undefined,
        imageUrl: selected.imageUrl,
        identificationMethod: 'Seller-confirmed catalog match',
        identificationConfidence: selected.confidence,
        condition,
        storageLocation: storageLocation || undefined,
        purchasePrice: purchasePrice === '' ? undefined : Number(purchasePrice),
        listingPrice: numericPrice,
        createDraft: destination === 'ebay',
      });
      let photoWarning = '';
      let uploadedPhotos = 0;
      try {
        await uploadPhoto(result.assetId, frontPhoto);
        uploadedPhotos += 1;
        await uploadPhoto(result.assetId, backPhoto);
        uploadedPhotos += 1;
      } catch (photoError) {
        photoWarning = ` The inventory record was saved, but its photos need attention: ${photoError instanceof Error ? photoError.message : 'upload failed'}`;
      }
      setSessionCards((current) => [...current, {
        ...currentIdentity,
        sku: result.sku,
        title: copy.title,
        description: copy.description,
        price: numericPrice,
        destination,
        disposition: recommendation?.disposition || 'Review',
        photoCount: uploadedPhotos,
      }]);
      setNotice(`${selected.name} saved as ${result.sku} for ${destinationLabel(destination)}.${photoWarning}`);
      clearCurrentCard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Card save failed.');
    } finally {
      setBusy('');
    }
  }

  async function copyListing(card: SessionCard) {
    await navigator.clipboard.writeText(`${card.title}\n\n${card.description}`);
    setNotice(`${card.name} listing copy copied.`);
  }

  return <section className="cardScannerWorkspace">
    <div className="panelHeader cardScannerHeader">
      <div><p className="eyebrow">TCG rapid intake</p><h2>Pokemon &amp; Yu-Gi-Oh! Card Session</h2><p>Photograph both sides, confirm the exact printing, and keep moving through the stack.</p></div>
      <span className="statusPill"><ShieldCheck size={14}/> Seller-confirmed matches</span>
    </div>

    <div className="cardSessionToolbar">
      <div className="cardGameSwitch" role="group" aria-label="Card game">
        <button className={game === 'pokemon' ? '' : 'secondary'} onClick={() => changeGame('pokemon')}>Pokemon</button>
        <button className={game === 'yugioh' ? '' : 'secondary'} onClick={() => changeGame('yugioh')}>Yu-Gi-Oh!</button>
      </div>
      <label>Save destination<select value={destination} onChange={(event) => setDestination(event.target.value as Destination)}><option value="vinted">Vinted-ready inventory</option><option value="ebay">Inventory + eBay draft</option><option value="inventory">Inventory only</option></select></label>
      <label>Minimum single value<input type="number" min="0" step="0.5" inputMode="decimal" value={minimumSinglePrice} onChange={(event) => setMinimumSinglePrice(event.target.value)}/></label>
      <div className="cardSessionMetric"><span>Saved this session</span><strong>{sessionCards.length}</strong><small>{duplicateGroups} exact printing{duplicateGroups === 1 ? '' : 's'}</small></div>
    </div>

    <div className="cardScannerColumns">
      <section className="cardScannerStage">
        <header><span>1</span><div><h3>Photograph and identify</h3><p>Use the front for identification and retain both sides for the listing.</p></div></header>
        <div className="cardPhotoPair">
          {(['front', 'back'] as const).map((side) => {
            const photo = side === 'front' ? frontPhoto : backPhoto;
            return <div className="cardPhotoSlot" key={side}>
              <label className={photo ? 'hasPhoto' : ''}>
                {photo ? <img src={photo.previewUrl} alt={`${side} of card`}/> : <><Camera size={22}/><strong>{side === 'front' && busy === 'identify' ? 'Reading front...' : `Add ${side}`}</strong><small>{side === 'front' ? 'Identifies the card' : 'Records condition'}</small></>}
                <input type="file" accept="image/*" capture="environment" disabled={Boolean(busy)} onChange={(event) => capturePhoto(side, event)}/>
              </label>
              {photo ? <div className="cardPhotoTools"><button className="iconButton secondary" title={`Rotate ${side}`} onClick={() => rotateCaptured(side)}><RotateCw size={16}/></button><button className="iconButton danger" title={`Remove ${side}`} onClick={() => replacePhoto(side, null)}><Trash2 size={16}/></button></div> : null}
            </div>;
          })}
        </div>
        <div className="cardIdentityFields">
          <label>Card Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional but helpful"/></label>
          {game === 'yugioh' ? <label>Printed Set Code<input value={printedCode} onChange={(event) => setPrintedCode(event.target.value.toUpperCase())} placeholder="LOB-001"/></label> : <>
            <label>Set Code<input value={setCode} onChange={(event) => setSetCode(event.target.value)} placeholder="sv3pt5"/></label>
            <label>Collector Number<input value={collectorNumber} onChange={(event) => setCollectorNumber(event.target.value)} placeholder="025/165"/></label>
          </>}
        </div>
        <button disabled={!searchReady || Boolean(busy)} onClick={runLookup}>{busy === 'search' ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} Search Catalog</button>
      </section>

      <section className="cardScannerStage">
        <header><span>2</span><div><h3>Choose exact printing</h3><p>Compare set, number, rarity, and artwork.</p></div></header>
        {suggestedRarity ? <div className="cardRarityHint"><Sparkles size={16}/><span>Photo suggestion: <strong>{suggestedRarity.value}</strong> ({Math.round(suggestedRarity.confidence * 100)}%). Use this only as a clue.</span></div> : null}
        {suggestedFinish ? <div className="cardRarityHint"><Sparkles size={16}/><span>Finish suggestion: <strong>{suggestedFinish.value}</strong> ({Math.round(suggestedFinish.confidence * 100)}%). Confirm the pattern under good light.</span></div> : null}
        {suggestedCopyrightYear ? <div className="cardRarityHint"><Search size={16}/><span>Bottom copyright detected: <strong>{suggestedCopyrightYear}</strong>. For pre-2020 Yu-Gi-Oh! sets, 2020 usually identifies the later date reprint.</span></div> : null}
        {catalogVariantCount > 1 ? <div className="cardRarityWarning"><ShieldCheck size={16}/><span><strong>{catalogVariantCount} variants share this card number.</strong> {game === 'yugioh' ? 'Compare the name foil, artwork foil, border texture, and anniversary watermark.' : 'Compare normal, reverse foil, Poke Ball, and Master Ball patterns before choosing.'}</span></div> : null}
        {!candidates.length ? <div className="cardScannerEmpty"><ImagePlus size={28}/><p>Catalog matches will appear here.</p></div> : <div className="cardCandidateList">
          {candidates.map((candidate) => <button key={`${candidate.provider}-${candidate.providerId}-${candidate.printedCode || candidate.collectorNumber || candidate.setCode}-${candidate.rarity || 'unknown'}`} className={`cardCandidate ${selected === candidate ? 'selected' : ''}`} onClick={() => selectCandidate(candidate)}>
            {candidate.imageUrl ? <img src={candidate.imageUrl} alt=""/> : <div className="cardImagePlaceholder">No preview</div>}
            <span><strong>{candidate.name}</strong><small>{[candidate.setName, candidate.printedCode || candidate.collectorNumber, candidate.rarity, candidate.finish, candidate.edition].filter(Boolean).join(' · ')}</small><small>{candidate.marketPrice !== undefined ? `${money(candidate.marketPrice)} catalog reference` : 'No catalog price'} · {Math.round(candidate.confidence * 100)}% match</small></span>
            {selected === candidate ? <Check size={18}/> : null}
          </button>)}
        </div>}
      </section>

      <section className="cardScannerStage">
        <header><span>3</span><div><h3>Confirm and save</h3><p>Defaults stay in place while each saved card clears for the next one.</p></div></header>
        {recommendation ? <div className={`cardRecommendation ${recommendation.disposition === 'Sell Individually' ? 'positive' : ''}`}><Layers3 size={18}/><div><strong>{recommendation.disposition}</strong><small>{recommendation.exactCopies} exact {recommendation.exactCopies === 1 ? 'copy' : 'copies'} in this session. {recommendation.reason}</small></div></div> : null}
        <div className="cardConfirmFields">
          <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Japanese</option><option>Spanish</option><option>French</option><option>German</option><option>Italian</option><option>Korean</option><option>Portuguese</option></select></label>
          <label>Finish<select value={finish} onChange={(event) => setFinish(event.target.value)}><option value="">Not specified</option><option>Normal</option><option>Non-Holo</option><option>Holofoil</option><option>Reverse Holofoil</option><option>Poke Ball Reverse Holo</option><option>Master Ball Reverse Holo</option><option>Foil</option></select></label>
          <label>Edition<input value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="1st Edition, Unlimited..."/></label>
          <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select></label>
          <label>Bin / Location<input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="CARD-A1"/></label>
          <label>Cost Paid<input type="number" min="0" step="0.01" inputMode="decimal" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)}/></label>
          <label>Starting Price<input type="number" min="0" step="0.01" inputMode="decimal" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)}/></label>
        </div>
        <button disabled={!selected || !frontPhoto || !backPhoto || Boolean(busy)} onClick={saveCard}>{busy === 'save' ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} Save &amp; Start Next Card</button>
        <p className="cardPhotoReminder">Catalog prices are references, not verified sold comps. Front and back photos are saved as actual item photos.</p>
      </section>
    </div>

    {notice ? <p className="setupNotice successNotice">{notice}</p> : null}
    {error ? <p className="setupNotice errorNotice">{error}</p> : null}

    {sessionCards.length ? <section className="cardSessionResults">
      <div className="panelHeader"><div><p className="eyebrow">Current session</p><h3>Saved Cards</h3><p>Use the duplicate guidance now; all records and photos are already stored.</p></div></div>
      <div className="cardSessionList">{[...sessionCards].reverse().map((card) => <article key={card.sku}>
        <div><strong>{card.title}</strong><small>{card.sku} · {destinationLabel(card.destination)} · {card.photoCount}/2 photos</small></div>
        <span className="statusPill">{card.disposition}</span>
        <span>{money(card.price) || 'Price needed'}</span>
        <button className="iconButton secondary" title="Copy title and description" onClick={() => copyListing(card)}><Copy size={16}/></button>
      </article>)}</div>
    </section> : null}
  </section>;
}
