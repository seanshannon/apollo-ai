
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

interface ProfileEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'name' | 'picture' | 'company' | 'password' | 'notifications' | 'language';
}

export function ProfileEditDialog({ isOpen, onClose, type }: ProfileEditDialogProps) {
  const { data: session, update } = useSession() || {};
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [preferences, setPreferences] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Fetch user preferences when dialog opens for notifications or language
  useEffect(() => {
    if (isOpen && (type === 'notifications' || type === 'language')) {
      fetchPreferences();
    }
  }, [isOpen, type]);

  const fetchPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        // Initialize form data with current preferences
        setFormData({
          language: data.preferences.language || 'en',
          timezone: data.preferences.timezone || 'America/New_York',
          emailNotifications: data.preferences.emailNotifications ?? true,
          queryAlerts: data.preferences.queryAlerts ?? true,
          weeklyReport: data.preferences.weeklyReport ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('profile.errors.imageTooLarge'));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (type === 'picture' && imageFile) {
        // Upload profile picture
        const formDataToSend = new FormData();
        formDataToSend.append('file', imageFile);

        const response = await fetch('/api/user/profile-picture', {
          method: 'POST',
          body: formDataToSend,
        });

        if (!response.ok) {
          throw new Error('Failed to upload profile picture');
        }

        // Success! Reload the page to fetch the new image from database
        toast.success('Profile picture updated! Refreshing page...');
        
        // Close dialog first
        onClose();
        
        // Reload to fetch fresh image from database (image is NOT stored in JWT)
        setTimeout(() => {
          window.location.href = window.location.href;
        }, 500);
        
        return; // Exit early to prevent further execution
      } else if (type === 'name') {
        // Update name
        const response = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update profile');
        }

        // Update session to refresh JWT token
        if (update) {
          await update();
        }

        toast.success('Profile updated! Refreshing page...');
        onClose();
        
        setTimeout(() => {
          window.location.href = window.location.href;
        }, 800);
        
        return;
      } else if (type === 'company') {
        // Update company info
        const response = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: formData.companyName,
            jobTitle: formData.jobTitle,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update company info');
        }

        // Update session to refresh JWT token
        if (update) {
          await update();
        }

        toast.success('Company info updated! Refreshing page...');
        onClose();
        
        setTimeout(() => {
          window.location.href = window.location.href;
        }, 800);
        
        return;
      } else if (type === 'password') {
        // Validate password fields
        if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
          toast.error('Please fill in all password fields');
          setLoading(false);
          return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
          toast.error('New passwords do not match');
          setLoading(false);
          return;
        }

        if (formData.newPassword.length < 8) {
          toast.error('Password must be at least 8 characters long');
          setLoading(false);
          return;
        }

        // Change password
        const response = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to change password');
        }

        toast.success('Password changed successfully!');
      } else if (type === 'notifications') {
        // Update notification preferences
        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailNotifications: formData.emailNotifications,
            queryAlerts: formData.queryAlerts,
            weeklyReport: formData.weeklyReport,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update preferences');
        }

        toast.success('Notification preferences updated!');
      } else if (type === 'language') {
        // Update language preference
        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: formData.language,
            timezone: formData.timezone,
          }),
        });

        if (!response.ok) {
          throw new Error(t('profile.errors.languageUpdateFailed'));
        }

        // Get language name for the toast
        const languageNames: { [key: string]: string } = {
          en: 'English',
          es: 'Español',
          fr: 'Français',
          de: 'Deutsch',
          ja: '日本語'
        };
        const selectedLanguageName = languageNames[formData.language] || formData.language;

        // Change i18n language immediately
        await i18n.changeLanguage(formData.language);
        
        // Store in localStorage for persistence
        localStorage.setItem('appLanguage', formData.language);
        
        // Update HTML lang attribute
        document.documentElement.lang = formData.language;

        // Show success toast in the NEW language
        toast.success(t('profile.toasts.languageUpdated', { language: selectedLanguageName }));
        
        onClose();
        
        return;
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderDialogContent = () => {
    switch (type) {
      case 'name':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">Edit Name & Details</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                Update your personal information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-terminal-green font-share-tech">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="Enter your first name"
                  defaultValue={(session?.user as any)?.firstName || ''}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-terminal-green font-share-tech">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Enter your last name"
                  defaultValue={(session?.user as any)?.lastName || ''}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
            </div>
          </>
        );

      case 'picture':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">Update Profile Picture</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                Upload a new profile picture (max 5MB)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center space-y-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-2 border-terminal-green"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-terminal-green/10 border-2 border-terminal-green/50 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-terminal-green/50" />
                  </div>
                )}
                <Label
                  htmlFor="picture-upload"
                  className="cursor-pointer px-4 py-2 bg-terminal-green/10 border border-terminal-green/50 rounded-md text-terminal-green hover:bg-terminal-green/20 transition-colors font-share-tech"
                >
                  Choose File
                </Label>
                <Input
                  id="picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <p className="text-xs text-terminal-green/60 font-share-tech">
                  Supported formats: JPG, PNG, GIF
                </p>
              </div>
            </div>
          </>
        );

      case 'company':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">Company Information</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                Update your company details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-terminal-green font-share-tech">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  placeholder="Enter company name"
                  defaultValue={(session?.user as any)?.companyName || ''}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle" className="text-terminal-green font-share-tech">
                  Job Title
                </Label>
                <Input
                  id="jobTitle"
                  placeholder="Enter your job title"
                  defaultValue={(session?.user as any)?.jobTitle || ''}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
            </div>
          </>
        );

      case 'password':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">Change Password</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                Update your account password
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-terminal-green font-share-tech">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-terminal-green font-share-tech">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-terminal-green font-share-tech">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="border-terminal-green/30 bg-black/50 text-terminal-green focus:border-terminal-green"
                />
              </div>
            </div>
          </>
        );

      case 'notifications':
        if (loadingPrefs) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-terminal-green" />
            </div>
          );
        }
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">Notification Preferences</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                Manage your notification settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-terminal-green font-share-tech">Email Notifications</Label>
                  <p className="text-xs text-terminal-green/60">Receive updates via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.emailNotifications ?? true}
                  onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-terminal-green font-share-tech">Query Alerts</Label>
                  <p className="text-xs text-terminal-green/60">Get notified when queries complete</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.queryAlerts ?? true}
                  onChange={(e) => setFormData({ ...formData, queryAlerts: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-terminal-green font-share-tech">Weekly Report</Label>
                  <p className="text-xs text-terminal-green/60">Receive weekly usage summary</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.weeklyReport ?? false}
                  onChange={(e) => setFormData({ ...formData, weeklyReport: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </>
        );

      case 'language':
        if (loadingPrefs) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-terminal-green" />
            </div>
          );
        }
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-terminal-green font-orbitron">{t('profile.dialogs.language.title')}</DialogTitle>
              <DialogDescription className="text-terminal-green/70 font-share-tech">
                {t('profile.dialogs.language.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-terminal-green font-share-tech">
                  {t('profile.dialogs.language.language')}
                </Label>
                <select
                  id="language"
                  value={formData.language || 'en'}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border border-terminal-green/30 bg-black/50 text-terminal-green rounded-md focus:border-terminal-green"
                >
                  <option value="en">{t('profile.dialogs.language.languages.en')}</option>
                  <option value="es">{t('profile.dialogs.language.languages.es')}</option>
                  <option value="fr">{t('profile.dialogs.language.languages.fr')}</option>
                  <option value="de">{t('profile.dialogs.language.languages.de')}</option>
                  <option value="ja">{t('profile.dialogs.language.languages.ja')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-terminal-green font-share-tech">
                  {t('profile.dialogs.language.timezone')}
                </Label>
                <select
                  id="timezone"
                  value={formData.timezone || 'America/New_York'}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-terminal-green/30 bg-black/50 text-terminal-green rounded-md focus:border-terminal-green"
                >
                  <option value="America/New_York">{t('profile.dialogs.language.timezones.et')}</option>
                  <option value="America/Chicago">{t('profile.dialogs.language.timezones.ct')}</option>
                  <option value="America/Denver">{t('profile.dialogs.language.timezones.mt')}</option>
                  <option value="America/Los_Angeles">{t('profile.dialogs.language.timezones.pt')}</option>
                  <option value="Europe/London">{t('profile.dialogs.language.timezones.gmt')}</option>
                  <option value="Europe/Paris">{t('profile.dialogs.language.timezones.cet')}</option>
                  <option value="Asia/Tokyo">{t('profile.dialogs.language.timezones.jst')}</option>
                </select>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black/95 border-2 border-terminal-green/50 text-terminal-green max-w-md">
        <form onSubmit={handleSubmit}>
          {renderDialogContent()}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 font-share-tech"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || (type === 'picture' && !imageFile)}
              className="bg-terminal-green text-black hover:bg-terminal-green/90 font-orbitron tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
