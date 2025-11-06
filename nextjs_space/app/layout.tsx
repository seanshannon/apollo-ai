
import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import SessionProvider from '@/components/session-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { StarsBackground } from '@/components/stars-background';
import { SkipLinks } from '@/components/accessibility/skip-links';
import { AriaLiveAnnouncer } from '@/components/accessibility/aria-live-announcer';
import { I18nProviderWrapper } from '@/lib/i18n/i18nProvider';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Picard.ai - Natural Language Database Query',
  description: 'Democratizing data access through natural language intelligence',
  icons: {
    icon: '/picard-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-share-tech min-h-dvh" id="app-body">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <I18nProviderWrapper>
            <SessionProvider>
              <SkipLinks />
              <AriaLiveAnnouncer />
              <StarsBackground />
              {children}
              <Footer />
              <Toaster />
              <SonnerToaster />
            </SessionProvider>
          </I18nProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
