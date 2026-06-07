import React from 'react';
import ReactDOM from 'react-dom/client';

import AppProviders from '@/app/layout';
import TrayActivityShell from '@/app/tray-activity/layout';
import TrayActivityPage from '@/app/tray-activity/page';

document.title = 'Tray Activity';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element for the tray activity window.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders>
      <TrayActivityShell>
        <TrayActivityPage />
      </TrayActivityShell>
    </AppProviders>
  </React.StrictMode>,
);
