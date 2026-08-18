import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ExternalLink, FolderPlus, Pencil, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type LinkedAccount = {
  _id: Id<'linkedAccounts'>;
  platform: string;
  accountName: string;
  username?: string;
  loginUrl?: string;
  profileUrl?: string;
  status: string;
  notes?: string;
};

type Draft = {
  id?: Id<'linkedAccounts'>;
  platform: string;
  accountName: string;
  username: string;
  loginUrl: string;
  profileUrl: string;
  status: string;
  notes: string;
};

const PLATFORM_OPTIONS = ['eBay', 'Poshmark', 'Mercari', 'Depop', 'Facebook Marketplace', 'OfferUp', 'Craigslist', 'Other'];
const STATUS_OPTIONS = ['Linked', 'Needs Login', 'Paused', 'Disconnected'];

function emptyDraft(): Draft {
  return { platform: 'eBay', accountName: '', username: '', loginUrl: '', profileUrl: '', status: 'Needs Login', notes: '' };
}

export default function LinkedAccountsPanel() {
  const accounts = useQuery(api.linkedAccounts.list) as LinkedAccount[] | undefined;
  const createAccount = useMutation(api.linkedAccounts.create);
  const updateAccount = useMutation(api.linkedAccounts.update);
  const removeAccount = useMutation(api.linkedAccounts.remove);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<Id<'linkedAccounts'> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => accounts || [], [accounts]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setShowModal(true);
  }

  function openEdit(row: LinkedAccount) {
    setEditingId(row._id);
    setDraft({
      id: row._id,
      platform: row.platform,
      accountName: row.accountName,
      username: row.username || '',
      loginUrl: row.loginUrl || '',
      profileUrl: row.profileUrl || '',
      status: row.status,
      notes: row.notes || '',
    });
    setShowModal(true);
  }

  async function saveAccount() {
    if (!draft.accountName.trim()) return;
    setBusy(true);
    try {
      const payload = {
        platform: draft.platform,
        accountName: draft.accountName.trim(),
        username: draft.username.trim() || undefined,
        loginUrl: draft.loginUrl.trim() || undefined,
        profileUrl: draft.profileUrl.trim() || undefined,
        status: draft.status,
        notes: draft.notes.trim() || undefined,
      };
      if (editingId) await updateAccount({ id: editingId, ...payload });
      else await createAccount(payload);
      setShowModal(false);
      setEditingId(null);
      setDraft(emptyDraft());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="crossListingsPage">
      <header className="panel crossListingsHeader">
        <div>
          <p className="eyebrow">Account linking</p>
          <h2>Linked Accounts</h2>
          <p>Keep the seller accounts you use for cross-listing in one place. Add login/profile URLs, notes, and connection status.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={openCreate}><FolderPlus size={16}/> Link Account</button>
          <button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/> Refresh</button>
        </div>
      </header>

      <section className="panel inventoryPanel">
        <div className="panelHeader">
          <div><h2>Accounts</h2><p>{filtered.length} linked account{filtered.length === 1 ? '' : 's'}</p></div>
        </div>
        {!accounts ? <p>Loading linked accounts...</p> : filtered.length === 0 ? <div className="empty"><h2>No linked accounts yet</h2><p>Add one for eBay, Poshmark, Mercari, or Depop to start routing cross-listing work.</p></div> : (
          <div className="tableWrap">
            <table className="crossListingsTable">
              <thead>
                <tr><th>Platform</th><th>Account</th><th>Status</th><th>Links</th><th>Notes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account._id}>
                    <td><span className="consoleTag">{account.platform}</span></td>
                    <td><strong>{account.accountName}</strong><small>{account.username || ''}</small></td>
                    <td><span className={badgeClass(account.status)}><ShieldCheck size={12}/> {account.status}</span></td>
                    <td>{account.loginUrl || account.profileUrl ? <div className="accountLinks">{account.loginUrl ? <a className="button secondary" href={account.loginUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Login</a> : null}{account.profileUrl ? <a className="button secondary" href={account.profileUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Profile</a> : null}</div> : ''}</td>
                    <td>{account.notes || ''}</td>
                    <td className="tableActionsCell"><div className="rowActions"><button onClick={() => openEdit(account)}><Pencil size={14}/> Edit</button><button className="danger iconButton" aria-label={`Delete ${account.accountName}`} onClick={() => removeAccount({ id: account._id })}><Trash2 size={14}/></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal ? (
        <div className="modalBackdrop">
          <section className="modal crossListingsModal">
            <header className="modalHeader">
              <div><h2>{editingId ? 'Edit Linked Account' : 'Link Account'}</h2><span className="statusPill">Seller / marketplace profile</span></div>
              <button className="iconButton secondary" aria-label="Close linked account editor" onClick={() => setShowModal(false)}><X size={18}/></button>
            </header>
            <div className="formGrid">
              <label>Platform<select value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value }))}>{PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
              <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="span2">Account Name<input value={draft.accountName} onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))} placeholder="Your account label"/></label>
              <label>Username<input value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} placeholder="Handle or seller name"/></label>
              <label>Login URL<input value={draft.loginUrl} onChange={(event) => setDraft((current) => ({ ...current, loginUrl: event.target.value }))} placeholder="https://..."/></label>
              <label>Profile URL<input value={draft.profileUrl} onChange={(event) => setDraft((current) => ({ ...current, profileUrl: event.target.value }))} placeholder="Public profile link"/></label>
              <label className="span2">Notes<textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="What this account is for, login notes, selling strategy..."/></label>
            </div>
            <div className="actions right">
              <button className="secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button disabled={busy} onClick={saveAccount}><Save size={16}/>{busy ? 'Saving...' : 'Save Account'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function badgeClass(value?: string) {
  return `badge ${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
