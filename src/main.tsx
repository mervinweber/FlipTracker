import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider } from 'convex/react';
import App from './App';
import './styles.css';
import { convex } from './convex';

const root = ReactDOM.createRoot(document.getElementById('root')!);

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
  convex ? (
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  ) : (
    <MissingConvexConfig />
  )
);
