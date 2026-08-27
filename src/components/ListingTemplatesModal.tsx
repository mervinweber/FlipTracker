import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { EBAY_SHIPPING_PROFILES } from '../config/ebayListingDefaults';
import {
  listingSpeedPresetFor,
  loadListingSpeedPresets,
  saveListingSpeedPreset,
  type ListingFamily,
  type ListingSpeedPreset,
} from '../utils/listingSpeedPresets';

const FAMILIES: Array<{ key: ListingFamily; label: string }> = [
  { key: 'book', label: 'Books' },
  { key: 'movie', label: 'Movies & music' },
  { key: 'game', label: 'Video games' },
  { key: 'card', label: 'Cards' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'general', label: 'General merchandise' },
];

const CONDITIONS = ['New', 'Like New', 'Very Good', 'Good', 'Acceptable', 'For Parts'];
const COMPLETENESS = ['Complete', 'Disc Only', 'Case Only', 'Case + Disc', 'No Manual', 'Sealed', 'Loose', 'Incomplete'];

type Props = {
  fulfillmentPolicies: Array<{ id: string; name: string }>;
  onClose: () => void;
};

function editablePreset(family: ListingFamily) {
  return { feePercent: 15, minimumProfit: 3, ...listingSpeedPresetFor({ assetType: family }, loadListingSpeedPresets()) };
}

export default function ListingTemplatesModal({ fulfillmentPolicies, onClose }: Props) {
  const [family, setFamily] = useState<ListingFamily>('book');
  const [draft, setDraft] = useState<ListingSpeedPreset>(() => editablePreset('book'));
  const [notice, setNotice] = useState('');

  function chooseFamily(nextFamily: ListingFamily) {
    setFamily(nextFamily);
    setDraft(editablePreset(nextFamily));
    setNotice('');
  }

  function patch(next: Partial<ListingSpeedPreset>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function save() {
    saveListingSpeedPreset(family, {
      ...draft,
      descriptionTemplate: draft.descriptionTemplate?.trim() || undefined,
      feePercent: Number.isFinite(draft.feePercent) ? draft.feePercent : 15,
      minimumProfit: Number.isFinite(draft.minimumProfit) ? draft.minimumProfit : 3,
    });
    setNotice(`${FAMILIES.find((entry) => entry.key === family)?.label} template saved on this browser.`);
  }

  return <div className="modalBackdrop"><section className="modal listingTemplatesModal">
    <header className="modalHeader"><div><p className="eyebrow">Reusable defaults</p><h2>Listing Templates</h2><p>Apply trusted choices when a new listing is missing them. Listing-specific values always win.</p></div><button className="iconButton secondary" aria-label="Close listing templates" onClick={onClose}><X size={18}/></button></header>
    <div className="templateFamilyTabs" role="tablist" aria-label="Item family">
      {FAMILIES.map((entry) => <button key={entry.key} className={family === entry.key ? 'active' : 'secondary'} onClick={() => chooseFamily(entry.key)}>{entry.label}</button>)}
    </div>
    <div className="templateFormGrid">
      <label>Condition<select value={draft.condition || ''} onChange={(event) => patch({ condition: event.target.value || undefined })}><option value="">No default</option>{CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Completeness<select value={draft.completeness || ''} onChange={(event) => patch({ completeness: event.target.value || undefined })}><option value="">No default</option>{COMPLETENESS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Shipping Profile<select value={draft.shippingPreset || ''} onChange={(event) => patch({ shippingPreset: event.target.value || undefined })}><option value="">Automatic</option>{EBAY_SHIPPING_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
      <label>eBay Shipping Policy<select value={draft.fulfillmentPolicyId || ''} onChange={(event) => patch({ fulfillmentPolicyId: event.target.value || undefined })}><option value="">Seller default</option>{fulfillmentPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
      <label>Photo Source<select value={draft.imageMode || ''} onChange={(event) => patch({ imageMode: event.target.value || undefined })}><option value="">Automatic</option><option>Actual Item Photo</option><option>eBay Catalog</option></select></label>
      <label>Estimated eBay Fee %<input type="number" min="0" max="50" step="0.1" value={draft.feePercent ?? 15} onChange={(event) => patch({ feePercent: Number(event.target.value) })}/></label>
      <label>Minimum Profit<input type="number" min="0" step="0.01" value={draft.minimumProfit ?? 3} onChange={(event) => patch({ minimumProfit: Number(event.target.value) })}/></label>
      <label className="templateDescription">Description Template<textarea value={draft.descriptionTemplate || ''} onChange={(event) => patch({ descriptionTemplate: event.target.value })} placeholder={'{title}\nCondition: {condition}\nCompleteness: {completeness}\nShips securely.'}/><small>Available tokens: {'{title}'}, {'{condition}'}, {'{completeness}'}, {'{format}'}, and {'{sku}'}.</small></label>
    </div>
    {notice ? <p className="setupNotice successNotice">{notice}</p> : null}
    <div className="actions modalActions"><button className="secondary" onClick={onClose}>Close</button><button onClick={save}><Save size={16}/> Save {FAMILIES.find((entry) => entry.key === family)?.label}</button></div>
  </section></div>;
}
