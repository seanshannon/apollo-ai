
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryInterface } from '@/components/query-interface';
import { QueryHistory } from '@/components/query-history';
import { UserProfileDropdown } from '@/components/user-profile-dropdown';
import { History, Zap, Shield, Activity, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface DashboardClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    image?: string | null;
  };
}

export function DashboardClient({ user }: DashboardClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('query');
  const [selectedDatabase, setSelectedDatabase] = useState('sales');
  const [hasRunQuery, setHasRunQuery] = useState(false);
  const [isLandingState, setIsLandingState] = useState(true);

  const starImageUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/stars.png';

  // Manage body overflow based on landing state
  useEffect(() => {
    const body = document.getElementById('app-body');
    if (!body) return;

    if (isLandingState) {
      // Landing state: no scroll, locked to viewport
      body.style.overflowY = 'hidden';
      window.scrollTo(0, 0);
    } else {
      // Results state: enable scrolling
      body.style.overflowY = 'auto';
    }

    return () => {
      // Cleanup: restore auto overflow when component unmounts
      body.style.overflowY = 'auto';
    };
  }, [isLandingState]);

  const handleQueryStart = () => {
    setIsLandingState(false);
    setHasRunQuery(true);
  };

  const handleReset = () => {
    setIsLandingState(true);
    setHasRunQuery(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="bg-black relative w-full grid grid-rows-[auto_1fr_auto] min-h-dvh">
      {/* Animated star layers */}
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-slow opacity-30"
          style={{ backgroundImage: `url('${starImageUrl}')` }}
        />
      </div>
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-medium opacity-20"
          style={{ backgroundImage: `url('${starImageUrl}')` }}
        />
      </div>
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-fast opacity-10"
          style={{ backgroundImage: `url('${starImageUrl}')` }}
        />
      </div>

      {/* Scan line effect */}
      <div className="scan-line pointer-events-none" />
      
      {/* Header - Fixed */}
      <header 
        role="banner" 
        className="sticky top-0 z-50 border-b border-terminal-green/30 backdrop-blur-sm bg-black/50 w-full overflow-visible flex-shrink-0"
      >
        <div className="w-full px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-lg bg-terminal-green/10 shadow-terminal p-1" aria-hidden="true">
                <Image 
                  src="/picard-logo.png" 
                  alt="Picard.ai logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  style={{ filter: 'brightness(0) saturate(100%) invert(62%) sepia(98%) saturate(2477%) hue-rotate(163deg) brightness(101%) contrast(101%)' }}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-terminator text-terminal-green drop-shadow-terminal truncate">{t('header.appName')}</h1>
                <p className="text-xs sm:text-sm text-terminal-green/70 font-share-tech truncate" id="site-description">
                  {t('header.tagline')}
                </p>
              </div>
            </div>
            <nav aria-label="User navigation" className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <UserProfileDropdown user={user} />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - Grid Centered Hero */}
      <main 
        id="main-content" 
        role="main" 
        className="px-4 grid place-items-center relative z-10 w-full"
      >
        {/* Main UI Module (Query Card) */}
        <section
          id="queryCard"
          className="
            w-full
            max-w-[1100px] md:max-w-[1260px] xl:max-w-[1400px]
            rounded-2xl border border-terminal-green/30 bg-black/40 backdrop-blur
            shadow-[0_0_40px_rgba(0,255,255,0.15)]
            p-4 md:p-6 lg:p-8
            transform
            space-y-4 sm:space-y-5
          "
        >
          {/* Database Selector + Reset Button */}
          <div 
            id="database-selector" 
            aria-labelledby="database-selector-label"
            className="focus:outline-none"
            tabIndex={-1}
          >
            <Card className="bg-black/80 backdrop-blur-sm border-2 border-terminal-green/50 shadow-terminal">
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <label 
                    id="database-selector-label"
                    htmlFor="database-select"
                    className="text-sm sm:text-base font-medium text-terminal-green whitespace-nowrap font-orbitron tracking-wider"
                  >
                    [SELECT DATABASE]:
                  </label>
                  <div className="flex gap-2 flex-1">
                    <Select 
                      value={selectedDatabase} 
                      onValueChange={setSelectedDatabase}
                    >
                      <SelectTrigger 
                        id="database-select"
                        className="w-full sm:max-w-md bg-black/60 border-2 border-terminal-green text-terminal-green font-share-tech text-sm sm:text-base h-11"
                        aria-label="Select database to query"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent 
                        className="bg-black border-2 border-terminal-green"
                        role="listbox"
                      >
                        <SelectItem value="sales" className="text-terminal-green font-share-tech hover:bg-terminal-green/20">SALES DATABASE</SelectItem>
                        <SelectItem value="hr" className="text-terminal-green font-share-tech hover:bg-terminal-green/20">HR DATABASE</SelectItem>
                        <SelectItem value="inventory" className="text-terminal-green font-share-tech hover:bg-terminal-green/20">INVENTORY DATABASE</SelectItem>
                        <SelectItem value="finance" className="text-terminal-green font-share-tech hover:bg-terminal-green/20">FINANCE DATABASE</SelectItem>
                        <SelectItem value="customer_support" className="text-terminal-green font-share-tech hover:bg-terminal-green/20">CUSTOMER SUPPORT DATABASE</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasRunQuery && (
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="gap-2 border-2 border-terminal-green/50 text-terminal-green hover:bg-terminal-green/20 hover:border-terminal-green transition-all"
                        aria-label="Reset to landing state"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Reset</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Query Interface */}
          <QueryInterface 
            databaseId={selectedDatabase}
            onQueryStart={handleQueryStart}
            onReset={handleReset}
          />
        </section>
      </main>
    </div>
  );
}
