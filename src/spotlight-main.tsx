import React from 'react';
import ReactDOM from 'react-dom/client';
import AppProviders from '@/app/layout';
import SpotlightShell from '@/app/spotlight/layout';
import SpotlightPage from '@/app/spotlight/page';

document.title = 'Spotlight Search';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element for the spotlight window.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <SpotlightShell>
        <SpotlightPage />
      </SpotlightShell>
    </AppProviders>
  </React.StrictMode>,
);
