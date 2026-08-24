import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider } from 'convex/react';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import AuthGate from './components/AuthGate';
import './styles.css';
import { convex } from './convex';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingConvexConfig() {
  return (
    <main className="app">
      <section className="panel empty">
        <h1>Convex is not configured</h1>
        <p>Set VITE_CONVEX_URL in .env.local and run npx convex dev before starting the app.</p>
      </section>
    </main>
  );
}

root.render(
  convex && clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <AuthGate client={convex}><App /></AuthGate>
    </ClerkProvider>
  ) : convex ? (
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  ) : (
    <MissingConvexConfig />
  )
);
