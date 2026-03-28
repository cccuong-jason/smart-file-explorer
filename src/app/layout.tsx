import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { GlobalShortcutProvider } from '@/components/layout/global-shortcut-provider';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme-provider';

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
        <ToastProvider>
          <GlobalShortcutProvider />
          {children}
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
