'use client';

import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer 
      role="contentinfo" 
      className="fixed bottom-0 left-0 right-0 h-20 flex items-center justify-center border-t border-white/5 bg-black/60 backdrop-blur-sm z-40"
    >
      <p className="text-center text-xs text-muted-foreground/60 font-mono tracking-wider">
        {t('footer.copyright')}
      </p>
    </footer>
  );
}
