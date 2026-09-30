'use client';

/**
 * Profile panel for the account dashboard.
 *
 * Edits ZIS profile fields (displayName, email, avatar URL, bio) via
 * PATCH /api/auth/me through the AuthContext updateProfile helper.
 */

import { useRef, useState, type CSSProperties } from 'react';
import { User, Mail, Image as ImageIcon, FileText, Loader2, Check, AlertTriangle, Save, RefreshCw, Undo2, ImagePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import ZisAvatar from '@/components/ZisAvatar';
import { zisAvatarUrl, zisAvatarAbsoluteUrl, uploadAvatar, type ZisAvatarStyle } from '@/lib/zis';

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
    avatarStudio: 'Avatar',
    style: 'Style',
    variants: 'Pick a variant — saved on "Save changes"',
    regenerate: 'More variants',
    customUrl: 'Or paste a custom image URL',
    resetAvatar: 'Reset to generated',
    uploadAvatar: 'Upload image',
    uploading: 'Uploading…',
    uploadHint: 'PNG, JPEG, WebP or GIF, max 256 KB',
    uploadErr: 'Upload failed — check the file type and size.',
    avatarHint: 'Avatars are generated deterministically from your identity — pick a variant, a style, or use your own image URL.',
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
    avatarStudio: 'Avatar',
    style: 'Styl',
    variants: 'Vyber variantu — uloží se tlačítkem „Uložit změny"',
    regenerate: 'Další varianty',
    customUrl: 'Nebo vlož URL vlastního obrázku',
    resetAvatar: 'Vrátit na generovaný',
    uploadAvatar: 'Nahrát obrázek',
    uploading: 'Nahrávám…',
    uploadHint: 'PNG, JPEG, WebP nebo GIF, max 256 KB',
    uploadErr: 'Nahrání selhalo — zkontroluj typ a velikost souboru.',
    avatarHint: 'Avatary se generují deterministicky z tvé identity — vyber variantu, styl, nebo použij vlastní obrázek.',
  },
};

const AVATAR_STYLES: ZisAvatarStyle[] = ['sigil', 'rings', 'prism'];
const VARIANT_BATCH = 8;

function providerLabel(address: string): string {
  if (address.startsWith('zion1')) return 'ZION L1 wallet';
  if (address.startsWith('google:')) return 'Google';
  if (address.startsWith('0x')) return 'EVM wallet (SIWE)';
  return 'Passkey / other';
}

/** Recover {style, variant} when `avatar` is one of our generated URLs. */
function parseGeneratedAvatar(url: string | null | undefined): { style: ZisAvatarStyle; variant: number } | null {
  const m = url?.match(/\/api\/auth\/avatar\/[^/?]+\.svg(?:\?(.*))?$/);
  if (!m) return null;
  const q = new URLSearchParams(m[1] ?? '');
  const style = (AVATAR_STYLES as string[]).includes(q.get('t') ?? '')
    ? (q.get('t') as ZisAvatarStyle)
    : 'sigil';
  const variant = q.has('s') ? Number(q.get('s')) || 0 : 0;
  return { style, variant };
}

export default function ProfilePanel() {
  const { user, updateProfile, refreshUser } = useAuth();
  const { lang } = useLang();
  const t = lang === 'en' ? copy.en : copy.cs;

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Avatar studio ──────────────────────────────────────────────────
  // pendingAvatar: undefined = keep current · null = reset to generated · string = new URL
  const initialGen = parseGeneratedAvatar(user?.avatar);
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  const [avatarStyle, setAvatarStyle] = useState<ZisAvatarStyle>(initialGen?.style ?? 'sigil');
  const [variantBase, setVariantBase] = useState(0);
  const [pickedVariant, setPickedVariant] = useState<number | null>(initialGen?.variant ?? null);
  const [customAvatar, setCustomAvatar] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const seed = user.id ?? user.address;
  const previewUrl =
    pendingAvatar !== undefined
      ? (pendingAvatar ?? zisAvatarUrl(seed))
      : (user.avatar ?? zisAvatarUrl(seed));

  const handlePickVariant = (v: number) => {
    setPickedVariant(v);
    setCustomAvatar('');
    setPendingAvatar(zisAvatarAbsoluteUrl(seed, { s: v, t: avatarStyle }));
  };

  const handleStyleChange = (st: ZisAvatarStyle) => {
    setAvatarStyle(st);
    const v = pickedVariant ?? 0;
    setPickedVariant(v);
    setCustomAvatar('');
    setPendingAvatar(zisAvatarAbsoluteUrl(seed, { s: v, t: st }));
  };

  const handleCustomAvatar = (v: string) => {
    setCustomAvatar(v);
    setPendingAvatar(v.trim() ? v.trim() : undefined);
  };

  const handleResetAvatar = () => {
    setPendingAvatar(null);
    setPickedVariant(null);
    setCustomAvatar('');
  };

  const handleUploadFile = async (file: File) => {
    if (file.size > 256 * 1024) {
      setUploadErr(t.uploadErr);
      return;
    }
    setUploadBusy(true);
    setUploadErr(null);
    try {
      // Server stores the bytes AND sets user.avatar in one call.
      await uploadAvatar(file);
      await refreshUser();
      setPendingAvatar(undefined);
      setPickedVariant(null);
      setCustomAvatar('');
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : t.uploadErr);
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        email: email.trim() || null,
        ...(pendingAvatar !== undefined ? { avatar: pendingAvatar } : {}),
        bio: bio.trim() || null,
      });
      setPendingAvatar(undefined);
      setPickedVariant(null);
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

        {/* ── Avatar studio ── */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3" /> {t.avatarStudio}
          </label>
          <p className="text-[11px] text-gray-500 mb-3">{t.avatarHint}</p>

          <div className="flex items-center gap-4 mb-4">
            <ZisAvatar
              seed={seed}
              src={previewUrl}
              size={64}
              alt={displayName || 'avatar'}
              className="rounded-2xl border border-white/15 shrink-0"
              initial={displayName?.[0] ?? 'Z'}
            />
            <div className="flex flex-wrap gap-2">
              {AVATAR_STYLES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStyleChange(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs capitalize transition-colors ${
                    avatarStyle === st
                      ? 'bg-zion-cyan/20 border border-zion-cyan/50 text-zion-cyan'
                      : 'border border-white/10 bg-white/5 text-gray-400 hover:border-white/25'
                  }`}
                >
                  {st}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
                className="rounded-lg border border-zion-gold/30 bg-zion-gold/10 px-3 py-1.5 text-xs text-zion-gold hover:bg-zion-gold/20 inline-flex items-center gap-1 disabled:opacity-50"
              >
                {uploadBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                {uploadBusy ? t.uploading : t.uploadAvatar}
              </button>
              <button
                type="button"
                onClick={handleResetAvatar}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:border-white/25 inline-flex items-center gap-1"
              >
                <Undo2 className="h-3 w-3" /> {t.resetAvatar}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadFile(f);
                }}
              />
            </div>
          </div>
          {uploadErr && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-red-300">
              <AlertTriangle className="h-3 w-3" /> {uploadErr}
            </p>
          )}

          <p className="text-[11px] text-gray-600 mb-2">{t.style}: <span className="text-zion-cyan">{avatarStyle}</span> · {t.variants}</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
            {Array.from({ length: VARIANT_BATCH }, (_, i) => {
              const v = variantBase + i;
              const selected = pickedVariant === v && pendingAvatar !== null && !customAvatar;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => handlePickVariant(v)}
                  className={`rounded-xl overflow-hidden border-2 transition-colors ${
                    selected ? 'border-zion-cyan' : 'border-transparent hover:border-white/25'
                  }`}
                  aria-label={`variant ${v}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={zisAvatarUrl(seed, { s: v, t: avatarStyle, sz: 96 })}
                    alt=""
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setVariantBase((b) => b + VARIANT_BATCH)}
            className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:underline mb-3"
          >
            <RefreshCw className="h-3 w-3" /> {t.regenerate}
          </button>

          <input
            type="url"
            value={customAvatar}
            onChange={(e) => handleCustomAvatar(e.target.value)}
            placeholder={t.customUrl}
            maxLength={512}
            className={inputCls}
          />
          <p className="mt-1.5 text-[10px] text-gray-600">{t.uploadHint}</p>
        </div>

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
