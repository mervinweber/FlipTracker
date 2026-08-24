import { SignInButton, UserButton, useAuth, useUser } from '@clerk/clerk-react';
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';

function LoadingAccount() {
  return <main className="authShell"><section className="authPanel"><p>Checking your FlipTracker account...</p></section></main>;
}

function SignInScreen() {
  return (
    <main className="authShell">
      <section className="authPanel">
        <div className="authBrand"><ShieldCheck size={28}/><span>FlipTracker</span></div>
        <h1>Your resale workspace</h1>
        <p>Sign in to access your inventory, photos, listings, pricing history, and connected seller accounts.</p>
        <SignInButton mode="modal"><button className="authSignIn"><LogIn size={18}/> Sign in</button></SignInButton>
      </section>
    </main>
  );
}

function AccountMenu() {
  const { user } = useUser();
  return (
    <div className="accountMenu" title={user?.primaryEmailAddress?.emailAddress || 'FlipTracker account'}>
      <span>{user?.firstName || user?.username || 'Account'}</span>
      <UserButton afterSignOutUrl="/"/>
    </div>
  );
}

function AccountBootstrap() {
  const accountStatus = useQuery(api.ownership.status);
  const ensureProfile = useMutation(api.ownership.ensureProfile);
  const claimLegacyData = useMutation(api.ownership.claimLegacyData);
  const [adminKey, setAdminKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void ensureProfile(); }, [ensureProfile]);
  if (!accountStatus?.needsLegacyClaim) return null;

  async function claim() {
    if (!adminKey) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await claimLegacyData({ adminKey });
      setMessage(`${result.total} existing records assigned to this account.`);
      setAdminKey('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not assign the existing records.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="legacyClaimBanner">
      <div><strong>Assign the existing FlipTracker data</strong><span>Use the current Seller Access Key once to make this signed-in account the owner of the existing inventory and listings.</span></div>
      <div className="legacyClaimActions"><label><KeyRound size={15}/><input type="password" autoComplete="off" placeholder="Seller Access Key" value={adminKey} onChange={(event) => setAdminKey(event.target.value)}/></label><button disabled={busy || !adminKey} onClick={claim}>{busy ? 'Assigning...' : 'Assign Data'}</button></div>
      {message ? <p>{message}</p> : null}
    </aside>
  );
}

export default function AuthGate({ client, children }: { client: ConvexReactClient; children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <AuthLoading><LoadingAccount/></AuthLoading>
      <Unauthenticated><SignInScreen/></Unauthenticated>
      <Authenticated><AccountMenu/><AccountBootstrap/>{children}</Authenticated>
    </ConvexProviderWithClerk>
  );
}
