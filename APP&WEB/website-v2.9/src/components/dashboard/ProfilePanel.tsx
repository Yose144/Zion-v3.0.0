'use client';

/**
 * Profile panel for the account dashboard.
 *
 * Edits ZIS profile fields (displayName, email, avatar URL, bio) via
 * PATCH /api/auth/me through the AuthContext updateProfile helper.
 */

import { useState, type CSSProperties } from 'react';
import { User, Mail, Image as ImageIcon, FileText, Loader2, Check, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';

const copy = {
  en: {
    profile: 'Profile',
    displayName: 'Display name',
    displayNamePh: 'How should we call you?',
    email: 'Email',
    emailPh: 'Optional — for ecosystem notices',
    avatar: 'Avatar URL',
    avatarPh: 'https://… (optional)',
    bio: 'Bio',
    bioPh: 'A few words about you (optional)',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Could not save profile.',
    provider: 'Sign-in method',
    userId: 'User ID',
  },
  cs: {
    profile: 'Profil',
    displayName: 'Zobrazované jméno',
    displayNamePh: 'Jak ti máme říkat?',
    email: 'Email',
    emailPh: 'Nepovinný — pro oznámení ekosystému',
    avatar: 'URL avataru',
    avatarPh: 'https://… (nepovinné)',
    bio: 'Bio',
    bioPh: 'Pár slov o tobě (nepovinné)',
    save: 'Uložit změny',
    saving: 'Ukládání…',
    saved: 'Uloženo',
    error: 'Profil se nepodařilo uložit.',
    provider: 'Způsob přihlášení',
    userId: 'ID uživatele',
  },
};

function providerLabel(address: string): string {
  if (address.startsWith('zion1')) return 'ZION L1 wallet';
  if (address.startsWith('google:')) return 'Google';
  if (address.startsWith('0x')) return 'EVM wallet (SIWE)';
  return 'Passkey / other';
}

export default function ProfilePanel() {
  const { user, updateProfile } = useAuth();
  const { lang } = useLang();
  const t = lang === 'en' ? copy.en : copy.cs;

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        email: email.trim() || null,
        avatar: avatar.trim() || null,
        bio: bio.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan/50';

  return (
    <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
      <div className="flex items-center gap-2 mb-6">
        <User className="h-5 w-5 text-zion-purple" />
        <h2 className="text-lg font-bold text-white">{t.profile}</h2>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-xs text-gray-500">
        <span>
          {t.provider}: <span className="text-zion-cyan">{providerLabel(user.address)}</span>
        </span>
        {user.id && (
          <span>
            {t.userId}: <span className="font-mono text-gray-400">{user.id}</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <User className="h-3 w-3" /> {t.displayName}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t.displayNamePh}
            maxLength={64}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {t.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPh}
              maxLength={255}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" /> {t.avatar}
            </label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder={t.avatarPh}
              maxLength={512}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> {t.bio}
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t.bioPh}
            maxLength={512}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="zion-button-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {busy ? t.saving : saved ? t.saved : t.save}
          </button>
          {saved && <span className="text-xs text-zion-cyan">{t.saved}</span>}
        </div>
      </form>
    </div>
  );
}
