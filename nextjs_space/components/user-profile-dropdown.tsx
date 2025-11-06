
'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import {
  User,
  Building2,
  Settings,
  Palette,
  Globe,
  Bell,
  LayoutDashboard,
  Lock,
  Key,
  Shield,
  History,
  Activity,
  BarChart3,
  Database,
  Zap,
  Code,
  Webhook,
  HelpCircle,
  MessageSquare,
  LogOut,
  Camera,
  Clock,
  Monitor,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ProfileEditDialog } from '@/components/profile-edit-dialog';
import { toast } from 'sonner';

interface UserProfileDropdownProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    image?: string | null;
  };
}

export function UserProfileDropdown({ user }: UserProfileDropdownProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  const handleDialogOpen = (dialogType: string) => {
    setActiveDialog(dialogType);
  };

  const handleDialogClose = () => {
    setActiveDialog(null);
  };

  const menuSections = [
    {
      title: t('profile.sections.information'),
      icon: User,
      items: [
        { icon: User, label: t('profile.menu.editName'), action: () => handleDialogOpen('name') },
        { icon: Camera, label: t('profile.menu.updatePicture'), action: () => handleDialogOpen('picture') },
        { icon: Building2, label: t('profile.menu.companyInfo'), action: () => handleDialogOpen('company') },
      ],
    },
    {
      title: t('profile.sections.preferences'),
      icon: Settings,
      items: [
        { 
          icon: Palette, 
          label: mounted ? (theme === 'dark' ? t('profile.menu.themeDark') : t('profile.menu.themeLight')) : t('common.loading'), 
          action: () => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            toast.success(t('profile.toasts.switchedTheme', { theme: newTheme }));
          }
        },
        { icon: Globe, label: t('profile.menu.language'), action: () => handleDialogOpen('language') },
        { icon: Bell, label: t('profile.menu.notifications'), action: () => handleDialogOpen('notifications') },
        { icon: LayoutDashboard, label: t('profile.menu.dashboardLayout'), action: () => toast.info(t('profile.toasts.dashboardComingSoon')) },
      ],
    },
    {
      title: t('profile.sections.security'),
      icon: Shield,
      items: [
        { icon: Lock, label: t('profile.menu.changePassword'), action: () => handleDialogOpen('password') },
        { icon: Key, label: t('profile.menu.twoFactor'), action: () => toast.info(t('profile.toasts.2faComingSoon')) },
        { icon: Clock, label: t('profile.menu.loginHistory'), action: () => toast.info(t('profile.toasts.loginHistoryComingSoon')) },
        { icon: Monitor, label: t('profile.menu.deviceManagement'), action: () => toast.info(t('profile.toasts.deviceMgmtComingSoon')) },
      ],
    },
    {
      title: t('profile.sections.activity'),
      icon: Activity,
      items: [
        { icon: History, label: t('profile.menu.recentActivity'), action: () => toast.info(t('profile.toasts.activityLogComingSoon')) },
        { icon: BarChart3, label: t('profile.menu.usageStatistics'), action: () => toast.info(t('profile.toasts.usageStatsComingSoon')) },
        { icon: Database, label: t('profile.menu.queryAnalytics'), action: () => router.push('/dashboard?tab=history') },
      ],
    },
    {
      title: t('profile.sections.integrations'),
      icon: Zap,
      items: [
        { icon: Code, label: t('profile.menu.apiKeys'), action: () => toast.info(t('profile.toasts.apiMgmtComingSoon')) },
        { icon: Webhook, label: t('profile.menu.integrations'), action: () => toast.info(t('profile.toasts.integrationsComingSoon')) },
      ],
    },
    {
      title: t('profile.sections.support'),
      icon: HelpCircle,
      items: [
        { icon: HelpCircle, label: t('profile.menu.helpCenter'), action: () => window.open('https://help.picard.ai', '_blank') },
        { icon: MessageSquare, label: t('profile.menu.contactSupport'), action: () => window.open('mailto:support@picard.ai', '_blank') },
      ],
    },
  ];

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
      {/* Fixed Position Container with CSS variable for positioning */}
      <div className="group relative fixed right-6 top-4 z-[100] [--anchor:5rem]">
        {/* Trigger Button */}
        <button 
          className="flex items-center gap-2 rounded-full p-1 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-terminal-green/50 transition-all"
          aria-haspopup="true"
          aria-label="Open profile menu"
        >
          <Avatar className="w-10 h-10 border-2 border-terminal-green/50 shadow-terminal">
            <AvatarImage src={user?.image || ''} alt={user?.name || 'User'} />
            <AvatarFallback className="bg-terminal-green/20 text-terminal-green font-orbitron font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="sr-only">Open profile menu</span>
        </button>

        {/* DROPDOWN - Auto-fits viewport, never clipped, last items always reachable */}
        <div
          className="invisible opacity-0 group-hover:visible group-hover:opacity-100 focus-within:visible focus-within:opacity-100
                     transition-opacity duration-150
                     fixed right-6 top-[var(--anchor)] z-[110]
                     w-[22rem] max-w-[92vw]
                     rounded-2xl bg-[#06121a]/95 backdrop-blur-xl
                     shadow-2xl ring-2 ring-terminal-green/40
                     border border-terminal-green/30
                     max-h-[calc(100vh-var(--anchor)-1rem)]
                     overflow-hidden"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Inner scroll container with safe padding */}
          <div className="h-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable] pb-6 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              {/* Profile Header */}
              <div className="px-5 py-4 border-b border-terminal-green/20">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 border-2 border-terminal-green shadow-terminal">
                    <AvatarImage src={user?.image || ''} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-terminal-green/20 text-terminal-green font-orbitron font-bold text-lg">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-terminal-green font-semibold font-orbitron">{user?.name}</p>
                    <p className="text-xs text-terminal-green/70 font-share-tech">{user?.email}</p>
                    {user?.role === 'ADMIN' && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-xs border-terminal-green/50 text-terminal-green bg-terminal-green/10"
                      >
                        ADMIN
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Sections */}
              <div className="px-5 py-4 space-y-4">
                {menuSections.map((section, sectionIdx) => (
                  <div key={section.title} className="space-y-3">
                    {sectionIdx > 0 && <Separator className="my-2 bg-terminal-green/20" />}
                    
                    <div className="flex items-center gap-2">
                      <section.icon className="w-4 h-4 text-terminal-green/70" aria-hidden="true" />
                      <p className="text-terminal-green/70 text-xs tracking-wide uppercase font-orbitron font-semibold">
                        {section.title}
                      </p>
                    </div>
                    
                    {section.items.map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all hover:bg-terminal-green/10 border border-transparent hover:border-terminal-green/30 group/item"
                        role="menuitem"
                      >
                        <item.icon className="w-4 h-4 text-terminal-green/60 group-hover/item:text-terminal-green transition-colors" aria-hidden="true" />
                        <span className="text-sm text-terminal-green/80 group-hover/item:text-terminal-green font-share-tech">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Sign Out Footer */}
              <div className="px-5 py-4 border-t border-terminal-green/20 bg-black/50">
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full border-terminal-green/50 text-terminal-green hover:bg-terminal-green hover:text-black transition-all font-orbitron tracking-wider"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('auth.signOut').toUpperCase()}
                </Button>
              </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialogs */}
      <ProfileEditDialog
        isOpen={activeDialog === 'name'}
        onClose={handleDialogClose}
        type="name"
      />
      <ProfileEditDialog
        isOpen={activeDialog === 'picture'}
        onClose={handleDialogClose}
        type="picture"
      />
      <ProfileEditDialog
        isOpen={activeDialog === 'company'}
        onClose={handleDialogClose}
        type="company"
      />
      <ProfileEditDialog
        isOpen={activeDialog === 'password'}
        onClose={handleDialogClose}
        type="password"
      />
      <ProfileEditDialog
        isOpen={activeDialog === 'notifications'}
        onClose={handleDialogClose}
        type="notifications"
      />
      <ProfileEditDialog
        isOpen={activeDialog === 'language'}
        onClose={handleDialogClose}
        type="language"
      />
    </>
  );
}
