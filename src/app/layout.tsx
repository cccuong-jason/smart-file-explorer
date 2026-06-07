import './globals.css';
import { GlobalShortcutProvider } from '@/components/layout/global-shortcut-provider';
import { AppMonitoring } from '@/components/telemetry/app-monitoring';
import { Toaster } from '@/components/retroui/Sonner';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme-provider';
import { IconContext } from '@phosphor-icons/react';

export const appMetadata = {
  title: "Smart File Explorer",
  description: "A client-side file explorer with AI capabilities - Explore, Search, and Analyze your local files securely.",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  }
};

export default function AppProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <IconContext.Provider value={{ weight: 'bold' }}>
          <AppMonitoring />
          <GlobalShortcutProvider />
          {children}
          <Toaster closeButton richColors />
        </IconContext.Provider>
      </I18nProvider>
    </ThemeProvider>
  );
}
