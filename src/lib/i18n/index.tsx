'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import vi from './dictionaries/vi.json';
import en from './dictionaries/en.json';

type Language = 'vi' | 'en';
type Translations = Record<string, string>;

const dictionaries: Record<Language, Translations> = {
  vi,
  en,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('vi'); // Default to vi

  useEffect(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('i18n_lang') as Language;
    if (saved && (saved === 'vi' || saved === 'en')) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('i18n_lang', lang);
  };

  const t = (key: string, variables?: Record<string, string | number>) => {
    let translation = dictionaries[language][key] || dictionaries['en'][key] || key;
    if (variables) {
      Object.keys(variables).forEach(vKey => {
        translation = translation.replace(`{${vKey}}`, String(variables[vKey]));
      });
    }
    return translation;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
