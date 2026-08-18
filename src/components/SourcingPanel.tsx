import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { BarChart3, ExternalLink, FlaskConical, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';

type Analysis = Doc<'sourcingAnalyses'>;

type Draft = {
  title: string;
  format: string;
  edition: string;
  condition: string;
  completeness: string;
  upc: string;
  purchaseCost: string;
  shippingCost: string;
  packagingCost: string;
  feePercent: string;
  activeCount: string;
  soldCount90: string;
  soldPrices: string;
  notes: string;
};

const blankDraft: Draft = {
  title: '',
  format: 'DVD',
  edition: '',
  condition: 'Good',
  completeness: 'Complete',
  upc: '',
  purchaseCost: '1.00',
  shippingCost: '4.63',
  packagingCost: '0.50',
  feePercent: '13.25',
  activeCount: '',
  soldCount90: '',
  soldPrices: '',
  notes: '',
};

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSoldPrices(value: string) {
  return value.split(/\n|,/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.replace(/[$,]/g, '').split('+').map((part) => Number(part.trim()));
    if (!Number.isFinite(parts[0]) || parts[0] <= 0 || (parts[1] !== undefined && (!Number.isFinite(parts[1]) || parts[1] < 0))) {
      throw new Error(`Could not read sold price "${line}". Use 24.99 or 24.99 + 4.50.`);
    }
    return { price: parts[0], shipping: parts[1] };
  });
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function recommendationClass(value: string) {
  return `decisionBadge ${value.toLowerCase()}`;
}

function ebaySoldUrl(analysis: Analysis) {
  const query = [analysis.title, analysis.edition, analysis.format].filter(Boolean).join(' ');
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

function AnalysisDetails({ id, onClose }: { id: Id<'sourcingAnalyses'>; onClose: () => void }) {
  const details = useQuery(api.sourcing.details, { id });
  if (details === undefined) return <div className="modalBackdrop"><section className="modal"><p>Loading analysis...</p></section></div>;
  if (details === null) return null;
  const { analysis, comps } = details;
  return (
    <div className="modalBackdrop">
      <section className="modal wideModal">
        <header className="modalHeader">
          <div><p className="eyebrow">Decision details</p><h2>{analysis.title}</h2><p>{[analysis.format, analysis.edition, analysis.condition, analysis.completeness].filter(Boolean).join(' · ')}</p></div>
          <button className="iconButton secondary" aria-label="Close details" onClick={onClose}><X size={18}/></button>
        </header>
        {analysis.isDemo ? <p className="demoNotice"><FlaskConical size={16}/> Illustrative demo data. These are not current eBay results.</p> : null}
        <div className="analysisSummary">
          <div><span>Recommendation</span><strong className={recommendationClass(analysis.recommendation)}>{analysis.recommendation}</strong></div>
          <div><span>Expected sale</span><strong>{money(analysis.expectedSalePrice)}</strong></div>
          <div><span>Expected profit</span><strong>{money(analysis.expectedProfit)}</strong></div>
          <div><span>ROI</span><strong>{analysis.roiPercent >= 999 ? '999%+' : `${analysis.roiPercent.toFixed(0)}%`}</strong></div>
          <div><span>Sell-through proxy</span><strong>{analysis.sellThroughPercent >= 999 ? '999%+' : `${analysis.sellThroughPercent.toFixed(0)}%`}</strong></div>
          <div><span>Days to sell</span><strong>{analysis.estimatedDaysToSell ? `~${analysis.estimatedDaysToSell.toFixed(0)}` : 'Unknown'}</strong></div>
          <div><span>Rarity</span><strong>{analysis.rarityScore}/100</strong></div>
          <div><span>Liquidity</span><strong>{analysis.liquidityScore}/100</strong></div>
        </div>
        <div className="detailColumns">
          <section><h3>Decision math</h3><dl className="detailList">
            <div><dt>Purchase cost</dt><dd>{money(analysis.purchaseCost)}</dd></div>
            <div><dt>Median delivered sold</dt><dd>{money(analysis.medianSold)}</dd></div>
            <div><dt>Average delivered sold</dt><dd>{money(analysis.averageSold)}</dd></div>
            <div><dt>Expected marketplace fees</dt><dd>{money(analysis.expectedFees)}</dd></div>
            <div><dt>Expected shipping</dt><dd>{money(analysis.shippingCost)}</dd></div>
            <div><dt>Packaging</dt><dd>{money(analysis.packagingCost)}</dd></div>
            <div><dt>Active / sold in 90 days</dt><dd>{analysis.activeCount} / {analysis.soldCount90}</dd></div>
            <div><dt>Confidence</dt><dd>{analysis.confidence}</dd></div>
          </dl></section>
          <section><h3>Why {analysis.recommendation}?</h3><p>{analysis.recommendationReason}</p><p>{analysis.notes}</p>
            <a className="button secondary inlineButton" href={ebaySoldUrl(analysis)} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Verify on eBay</a>
          </section>
        </div>
        <section className="compSection"><h3>Observed sold prices</h3>{comps.length === 0 ? <p>No sold-price observations were entered.</p> : <div className="compGrid">{comps.map((comp) => <div key={comp._id}><span>{money(comp.itemPrice)}{comp.shipping ? ` + ${money(comp.shipping)} shipping` : ''}</span><strong>{money(comp.deliveredPrice)}</strong></div>)}</div>}</section>
      </section>
    </div>
  );
}

export default function SourcingPanel() {
  const analyses = useQuery(api.sourcing.list);
  const create = useMutation(api.sourcing.create);
  const convertToInventory = useMutation(api.sourcing.convertToInventory);
  const remove = useMutation(api.sourcing.remove);
  const seedExamples = useMutation(api.sourcing.seedExamples);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<'sourcingAnalyses'> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const rows = analyses || [];
  const totals = useMemo(() => ({
    buy: rows.filter((row) => row.recommendation === 'Buy').length,
    maybe: rows.filter((row) => row.recommendation === 'Maybe').length,
    pass: rows.filter((row) => row.recommendation === 'Pass').length,
  }), [rows]);

  function field(name: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const soldPrices = parseSoldPrices(draft.soldPrices);
      if (!soldPrices.length) throw new Error('Enter at least one sold price observation.');
      await create({
        title: draft.title,
        format: draft.format || undefined,
        edition: draft.edition || undefined,
        condition: draft.condition || undefined,
        completeness: draft.completeness || undefined,
        upc: draft.upc || undefined,
        purchaseCost: number(draft.purchaseCost),
        shippingCost: number(draft.shippingCost),
        packagingCost: number(draft.packagingCost),
        feePercent: number(draft.feePercent),
        activeCount: number(draft.activeCount),
        soldCount90: number(draft.soldCount90),
        soldPrices,
        notes: draft.notes || undefined,
      });
      setDraft(blankDraft);
      setEditorOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the analysis.');
    } finally {
      setSaving(false);
    }
  }

  async function loadExamples() {
    setSeeding(true);
    setError('');
    try {
      await seedExamples({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the examples.');
    } finally {
      setSeeding(false);
    }
  }

  async function deleteAnalysis(row: Analysis) {
    if (!window.confirm(`Delete the analysis for ${row.title}?`)) return;
    await remove({ id: row._id });
  }

  return (
    <section className="sourcingPage">
      <header className="guideHeader">
        <div><p className="eyebrow">Sourcing decision engine</p><h2>Buy, Maybe, or Pass</h2><p>Turn observed sold prices, supply, costs, and sales velocity into a repeatable sourcing decision.</p></div>
        <div className="actions"><button className="secondary" onClick={loadExamples} disabled={seeding}><FlaskConical size={16}/>{seeding ? 'Loading...' : 'Load Demo Examples'}</button><button onClick={() => setEditorOpen(true)}><Plus size={16}/> New Analysis</button></div>
      </header>
      <p className="demoNotice"><BarChart3 size={16}/> Sold prices and listing counts are entered manually for now. Always verify the exact edition, condition, and shipping on eBay before buying.</p>
      {error ? <p className="warningText">{error}</p> : null}
      <div className="cards sourcingCards">
        <div className="metric"><span>Analyses</span><strong>{analyses === undefined ? '-' : rows.length}</strong></div>
        <div className="metric decisionBuy"><span>Buy</span><strong>{totals.buy}</strong></div>
        <div className="metric decisionMaybe"><span>Maybe</span><strong>{totals.maybe}</strong></div>
        <div className="metric decisionPass"><span>Pass</span><strong>{totals.pass}</strong></div>
      </div>
      <section className="panel sourcingTablePanel">
        <div className="panelHeader"><div><h2>Saved Decisions</h2><p>Median protects against outliers; rarity measures supply while liquidity measures likely sales speed.</p></div></div>
        {analyses === undefined ? <p>Loading sourcing analyses...</p> : rows.length === 0 ? <div className="empty"><h2>No analyses yet</h2><p>Load the examples to see the range, or enter your first set of sold observations.</p></div> : <div className="tableWrap"><table><thead><tr><th>Item</th><th>Market</th><th>Sold Price</th><th>Speed</th><th>Scores</th><th>Economics</th><th>Decision</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}>
          <td><strong>{row.title}</strong><small>{[row.format, row.edition].filter(Boolean).join(' · ')}</small>{row.isDemo ? <small className="demoLabel">Demo data</small> : null}</td>
          <td><strong>{row.activeCount} active</strong><small>{row.soldCount90} sold / 90 days</small><small>{row.compCount} price observations</small></td>
          <td><strong>{money(row.medianSold)} median</strong><small>{money(row.averageSold)} average</small></td>
          <td><strong>{row.sellThroughPercent >= 999 ? '999%+' : `${row.sellThroughPercent.toFixed(0)}%`} STR</strong><small>{row.estimatedDaysToSell ? `~${row.estimatedDaysToSell.toFixed(0)} days` : 'No velocity'}</small></td>
          <td><strong>Rarity {row.rarityScore}</strong><small>Liquidity {row.liquidityScore}</small><small>{row.confidence} confidence</small></td>
          <td><strong className={row.expectedProfit >= 0 ? 'profitValue' : 'lossValue'}>{money(row.expectedProfit)} profit</strong><small>{row.roiPercent >= 999 ? '999%+' : `${row.roiPercent.toFixed(0)}%`} ROI</small><small>{money(row.purchaseCost)} buy cost</small></td>
          <td><span className={recommendationClass(row.recommendation)}>{row.recommendation}</span></td>
          <td className="rowActions"><button onClick={() => setSelectedId(row._id)}><Search size={14}/> Details</button><button className="secondary" onClick={async () => { await convertToInventory({ id: row._id }); }}><Plus size={14}/> Inventory</button><button className="danger iconButton" aria-label={`Delete ${row.title}`} onClick={() => deleteAnalysis(row)}><Trash2 size={14}/></button></td>
        </tr>)}</tbody></table></div>}
      </section>

      {editorOpen ? <div className="modalBackdrop"><section className="modal wideModal"><header className="modalHeader"><div><p className="eyebrow">Manual market sample</p><h2>New Sourcing Analysis</h2></div><button className="iconButton secondary" aria-label="Close" onClick={() => setEditorOpen(false)}><X size={18}/></button></header>
        <form onSubmit={save} className="formGrid">
          <section className="formSection span2"><h3>Identify the exact item</h3><div className="sectionGrid"><label>Title<input required value={draft.title} onChange={(e) => field('title', e.target.value)}/></label><label>Format<select value={draft.format} onChange={(e) => field('format', e.target.value)}>{['Video Game','DVD','Blu-ray','CD','Book','Other Media'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Edition<input value={draft.edition} onChange={(e) => field('edition', e.target.value)} placeholder="Distributor, release, greatest hits..."/></label><label>UPC / ISBN<input value={draft.upc} onChange={(e) => field('upc', e.target.value)}/></label><label>Condition<select value={draft.condition} onChange={(e) => field('condition', e.target.value)}>{['New','Like New','Very Good','Good','Acceptable','For Parts'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Completeness<select value={draft.completeness} onChange={(e) => field('completeness', e.target.value)}>{['Complete','Disc Only','Case Only','Case + Disc','No Manual','Sealed','Loose','Incomplete'].map((value) => <option key={value}>{value}</option>)}</select></label></div></section>
          <section className="formSection"><h3>Costs and supply</h3><div className="sectionGrid"><label>Purchase cost<input type="number" min="0" step="0.01" value={draft.purchaseCost} onChange={(e) => field('purchaseCost', e.target.value)}/></label><label>Shipping cost<input type="number" min="0" step="0.01" value={draft.shippingCost} onChange={(e) => field('shippingCost', e.target.value)}/></label><label>Packaging cost<input type="number" min="0" step="0.01" value={draft.packagingCost} onChange={(e) => field('packagingCost', e.target.value)}/></label><label>Fee estimate %<input type="number" min="0" step="0.01" value={draft.feePercent} onChange={(e) => field('feePercent', e.target.value)}/></label><label>Active listings<input required type="number" min="0" step="1" value={draft.activeCount} onChange={(e) => field('activeCount', e.target.value)}/></label><label>Sold in last 90 days<input required type="number" min="0" step="1" value={draft.soldCount90} onChange={(e) => field('soldCount90', e.target.value)}/></label></div></section>
          <section className="formSection"><h3>Sold observations</h3><label>Sold prices, one per line<textarea required className="compInput" value={draft.soldPrices} onChange={(e) => field('soldPrices', e.target.value)} placeholder={'24.99\n22.50 + 4.50\n27.00'}/><small>Use price alone or price + shipping. The engine compares delivered totals.</small></label><label>Notes<textarea value={draft.notes} onChange={(e) => field('notes', e.target.value)} placeholder="Edition checks, red flags, source details..."/></label></section>
          {error ? <p className="warningText span2">{error}</p> : null}<div className="actions right span2"><button type="button" className="secondary" onClick={() => setEditorOpen(false)}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Calculating...' : 'Calculate & Save'}</button></div>
        </form>
      </section></div> : null}
      {selectedId ? <AnalysisDetails id={selectedId} onClose={() => setSelectedId(null)}/> : null}
    </section>
  );
}
