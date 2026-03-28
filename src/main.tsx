import React from 'react';
import ReactDOM from 'react-dom/client';
import AppProviders, { appMetadata } from '@/app/layout';
import Home from '@/app/page';

document.title = appMetadata.title;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element for the main window.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <Home />
    </AppProviders>
  </React.StrictMode>,
);
