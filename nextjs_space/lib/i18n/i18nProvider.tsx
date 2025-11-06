
'use client';

import { useEffect, useState, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './config';

interface I18nProviderWrapperProps {
  children: ReactNode;
}

export function I18nProviderWrapper({ children }: I18nProviderWrapperProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Fetch user's language preference from the API
    const fetchLanguagePreference = async () => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          const userLanguage = data.preferences?.language || 'en';
          
          // Update i18n language
          if (i18n.language !== userLanguage) {
            await i18n.changeLanguage(userLanguage);
          }
          
          // Store in localStorage for quick access
          localStorage.setItem('appLanguage', userLanguage);
          
          // Update HTML lang attribute
          document.documentElement.lang = userLanguage;
        }
      } catch (error) {
        console.error('Failed to fetch language preference:', error);
        // Fallback to localStorage or default
        const storedLanguage = localStorage.getItem('appLanguage') || 'en';
        await i18n.changeLanguage(storedLanguage);
        document.documentElement.lang = storedLanguage;
      } finally {
        setIsInitialized(true);
      }
    };

    fetchLanguagePreference();
  }, []);

  // Show loading state while initializing to prevent flash of untranslated content
  if (!isInitialized) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-terminal-green font-orbitron">Loading...</div>
    </div>;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
