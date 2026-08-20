import { ChangeEvent, useMemo, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { Camera, Check, ImagePlus, LoaderCircle, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import './card-scanner.css';

type CardGame = 'pokemon' | 'yugioh';
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
  imageUrl?: string;
  marketPrice?: number;
  confidence: number;
};

async function imageDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.78);
}

function money(value?: number) {
  return value === undefined ? '' : `$${value.toFixed(2)}`;
}

export default function CardScannerPanel() {
  const lookup = useAction(api.cardCatalog.lookup);
  const identify = useAction(api.cardCatalog.extractIdentityFromImage);
  const createCard = useMutation(api.cardIntake.createCard);
  const [game, setGame] = useState<CardGame>('pokemon');
  const [name, setName] = useState('');
  const [setCode, setSetCode] = useState('');
  const [collectorNumber, setCollectorNumber] = useState('');
  const [printedCode, setPrintedCode] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState<'identify' | 'search' | 'save' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('English');
  const [finish, setFinish] = useState('');
  const [edition, setEdition] = useState('');
  const [condition, setCondition] = useState('Used');
  const [storageLocation, setStorageLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [createDraft, setCreateDraft] = useState(true);
  const searchReady = useMemo(() => game === 'yugioh' ? Boolean(printedCode.trim() || name.trim()) : Boolean(setCode.trim() || collectorNumber.trim() || name.trim()), [game, printedCode, setCode, collectorNumber, name]);

  function changeGame(next: CardGame) {
    setGame(next);
    setCandidates([]);
    setSelected(null);
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
      setCandidates(result.candidates as Candidate[]);
      if (!result.candidates.length) setNotice('No exact candidates found. Check the printed code and try again.');
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Card lookup failed.');
    } finally {
      setBusy('');
    }
  }

  async function identifyPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const adminKey = localStorage.getItem('fliptrackerRememberedSellerKey') || sessionStorage.getItem('fliptrackerSellerKey') || '';
    if (!adminKey) {
      setError('Load your private access key in Seller Connection before using AI photo identification.');
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
      setNotice(`Photo read ${Math.round(result.confidence * 100)}% confidence. Review the identifiers, then search the catalog.`);
    } catch (identifyError) {
      setError(identifyError instanceof Error ? identifyError.message : 'Photo identification failed.');
    } finally {
      setBusy('');
    }
  }

  function selectCandidate(candidate: Candidate) {
    setSelected(candidate);
    if (candidate.marketPrice !== undefined && !listingPrice) setListingPrice(candidate.marketPrice.toFixed(2));
    setNotice('Candidate selected. Confirm printing details and condition before saving.');
  }

  async function saveCard() {
    if (!selected) return;
    setBusy('save');
    setError('');
    setNotice('');
    try {
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
        listingPrice: listingPrice === '' ? undefined : Number(listingPrice),
        createDraft,
      });
      setNotice(`${selected.name} saved as ${result.sku}${result.listingId ? ' with an eBay draft.' : '.'}`);
      setCandidates([]);
      setSelected(null);
      setName('');
      setSetCode('');
      setCollectorNumber('');
      setPrintedCode('');
      setFinish('');
      setEdition('');
      setPurchasePrice('');
      setListingPrice('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Card save failed.');
    } finally {
      setBusy('');
    }
  }

  return <section className="cardScannerWorkspace">
    <div className="panelHeader cardScannerHeader">
      <div><p className="eyebrow">TCG intake</p><h2>Card Scanner</h2><p>Read the card, match the exact printing, then create one inventory record and optional eBay draft.</p></div>
      <span className="statusPill"><ShieldCheck size={14}/> Confirmation required</span>
    </div>

    <div className="cardGameSwitch" role="group" aria-label="Card game">
      <button className={game === 'pokemon' ? '' : 'secondary'} onClick={() => changeGame('pokemon')}>Pokemon</button>
      <button className={game === 'yugioh' ? '' : 'secondary'} onClick={() => changeGame('yugioh')}>Yu-Gi-Oh!</button>
    </div>

    <div className="cardScannerColumns">
      <section className="cardScannerStage">
        <header><span>1</span><div><h3>Read identifiers</h3><p>Use a clear front photo or type the small printed code.</p></div></header>
        <label className="cardPhotoAction"><Camera size={22}/><strong>{busy === 'identify' ? 'Reading card...' : 'Identify From Photo'}</strong><small>AI extracts identifiers; it does not choose the final printing.</small><input type="file" accept="image/*" capture="environment" disabled={Boolean(busy)} onChange={identifyPhoto}/></label>
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
        {!candidates.length ? <div className="cardScannerEmpty"><ImagePlus size={28}/><p>Catalog matches will appear here.</p></div> : <div className="cardCandidateList">
          {candidates.map((candidate) => <button key={`${candidate.provider}-${candidate.providerId}-${candidate.printedCode || candidate.collectorNumber || candidate.setCode}`} className={`cardCandidate ${selected === candidate ? 'selected' : ''}`} onClick={() => selectCandidate(candidate)}>
            {candidate.imageUrl ? <img src={candidate.imageUrl} alt=""/> : <div className="cardImagePlaceholder">No preview</div>}
            <span><strong>{candidate.name}</strong><small>{[candidate.setName, candidate.printedCode || candidate.collectorNumber, candidate.rarity].filter(Boolean).join(' · ')}</small><small>{money(candidate.marketPrice)} catalog reference · {Math.round(candidate.confidence * 100)}% match</small></span>
            {selected === candidate ? <Check size={18}/> : null}
          </button>)}
        </div>}
      </section>

      <section className="cardScannerStage">
        <header><span>3</span><div><h3>Confirm and save</h3><p>Catalog prices are reference points, not eBay sold comps.</p></div></header>
        <div className="cardConfirmFields">
          <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Japanese</option><option>Spanish</option><option>French</option><option>German</option><option>Italian</option><option>Korean</option><option>Portuguese</option></select></label>
          <label>Finish<select value={finish} onChange={(event) => setFinish(event.target.value)}><option value="">Not specified</option><option>Non-Holo</option><option>Holofoil</option><option>Reverse Holofoil</option><option>Foil</option></select></label>
          <label>Edition<input value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="1st Edition, Unlimited..."/></label>
          <label>Condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option><option>Used</option></select></label>
          <label>Bin / Location<input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="CARD-A1"/></label>
          <label>Cost Paid<input type="number" min="0" step="0.01" inputMode="decimal" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)}/></label>
          <label>Starting Price<input type="number" min="0" step="0.01" inputMode="decimal" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)}/></label>
        </div>
        <label className="checkboxLabel"><input type="checkbox" checked={createDraft} onChange={(event) => setCreateDraft(event.target.checked)}/> Create internal eBay draft</label>
        <button disabled={!selected || Boolean(busy)} onClick={saveCard}>{busy === 'save' ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} Save Confirmed Card</button>
        <p className="cardPhotoReminder">Attach actual front and back photos in Photos before publishing to eBay.</p>
      </section>
    </div>
    {notice ? <p className="setupNotice successNotice">{notice}</p> : null}
    {error ? <p className="setupNotice errorNotice">{error}</p> : null}
  </section>;
}
