'use client';

/**
 * Security panel for the account dashboard.
 *
 * Shows linked wallet addresses, active ZIS sessions, and API keys.
 * Allows revoking individual sessions, revoking all sessions,
 * creating and revoking API keys.
 */

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import {
  Shield,
  Key,
  Smartphone,
  Trash2,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Clock,
  Fingerprint,
  Loader2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSessions,
  revokeSession,
  revokeAllSessions,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  listPasskeys,
  deletePasskey,
  type ZisActiveSession,
  type ZisApiKey,
  type ZisLinkedAddress,
  type ZisPasskey,
} from '@/lib/zis';

// The Passkeys section is hidden until the ZIS webauthn endpoints are deployed.
const PASSKEY_ENABLED = process.env.NEXT_PUBLIC_PASSKEY_ENABLED === '1';

const copy = {
  en: {
    security: 'Security',
    linkedAddresses: 'Linked addresses',
    noLinkedAddresses: 'No linked addresses yet.',
    address: 'Address',
    chain: 'Chain',
    verified: 'Verified',
    activeSessions: 'Active sessions',
    noActiveSessions: 'No active sessions.',
    userAgent: 'User agent',
    ip: 'IP',
    expires: 'Expires',
    revoke: 'Revoke',
    revokeAll: 'Revoke all',
    revokeAllConfirm: 'This will log you out everywhere. Continue?',
    apiKeys: 'API keys',
    noApiKeys: 'No API keys.',
    newKeyLabel: 'Label',
    createKey: 'Create API key',
    keyCreated: 'API key created. Copy it now — you will not see it again.',
    copy: 'Copy',
    copied: 'Copied',
    delete: 'Delete',
    confirmDelete: 'Confirm delete',
    lastUsed: 'Last used',
    created: 'Created',
    passkeys: 'Passkeys',
    noPasskeys: 'No passkeys registered.',
    passkeyLabel: 'Label (optional)',
    addPasskey: 'Add passkey',
    addingPasskey: 'Waiting for authenticator...',
    passkeyCancelled: 'Authenticator prompt was dismissed.',
    synced: 'Synced',
    singleDevice: 'Single device',
    loading: 'Loading...',
    error: 'Error loading security data.',
  },
  cs: {
    security: 'Bezpečnost',
    linkedAddresses: 'Propojené adresy',
    noLinkedAddresses: 'Zatím žádné propojené adresy.',
    address: 'Adresa',
    chain: 'Chain',
    verified: 'Ověřeno',
    activeSessions: 'Aktivní relace',
    noActiveSessions: 'Žádné aktivní relace.',
    userAgent: 'User agent',
    ip: 'IP',
    expires: 'Vyprší',
    revoke: 'Zrušit',
    revokeAll: 'Zrušit všechny',
    revokeAllConfirm: 'Tímto se odhlásíš všude. Pokračovat?',
    apiKeys: 'API klíče',
    noApiKeys: 'Žádné API klíče.',
    newKeyLabel: 'Popis',
    createKey: 'Vytvořit API klíč',
    keyCreated: 'API klíč vytvořen. Zkopíruj ho teď — znovu ho neuvidíš.',
    copy: 'Kopírovat',
    copied: 'Zkopírováno',
    delete: 'Smazat',
    confirmDelete: 'Potvrdit smazání',
    lastUsed: 'Naposledy použit',
    created: 'Vytvořeno',
    passkeys: 'Přístupové klíče',
    noPasskeys: 'Zatím žádné přístupové klíče.',
    passkeyLabel: 'Popis (nepovinný)',
    addPasskey: 'Přidat přístupový klíč',
    addingPasskey: 'Čekání na autentikátor...',
    passkeyCancelled: 'Výzva autentikátoru byla zrušena.',
    synced: 'Synchronizováno',
    singleDevice: 'Jedno zařízení',
    loading: 'Načítání...',
    error: 'Chyba při načítání bezpečnostních dat.',
  },
};

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SecurityPanel() {
  const { lang } = useLang();
  const { user, logout } = useAuth();
  const t = lang === 'en' ? copy.en : copy.cs;
  const locale = lang === 'en' ? 'en-US' : 'cs-CZ';

  const [sessions, setSessions] = useState<ZisActiveSession[]>([]);
  const [keys, setKeys] = useState<ZisApiKey[]>([]);
  const [passkeys, setPasskeys] = useState<ZisPasskey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newPasskeyLabel, setNewPasskeyLabel] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hasPasskeySupport, setHasPasskeySupport] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linkedAddresses: ZisLinkedAddress[] = user?.linkedAddresses ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ sessions: s }, { keys: k }, { credentials: p }] = await Promise.all([
        getSessions(),
        getApiKeys(),
        // Passkeys are best-effort: the list endpoint must not break the
        // rest of the panel while the backend rolls out. Skipped entirely
        // while the feature flag is off.
        PASSKEY_ENABLED
          ? listPasskeys().catch(() => ({ credentials: [] as ZisPasskey[] }))
          : Promise.resolve({ credentials: [] as ZisPasskey[] }),
      ]);
      setSessions(s);
      setKeys(k);
      setPasskeys(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (PASSKEY_ENABLED) {
      import('@simplewebauthn/browser')
        .then((m) => setHasPasskeySupport(m.browserSupportsWebAuthn()))
        .catch(() => setHasPasskeySupport(false));
    }
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [load]);

  const handleRevokeSession = async (jti: string) => {
    try {
      await revokeSession(jti);
      setSessions((prev) => prev.filter((s) => s.jwtJti !== jti));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm(t.revokeAllConfirm)) return;
    try {
      await revokeAllSessions();
      await logout?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    try {
      const { apiKey } = await createApiKey(newKeyLabel.trim());
      setNewKey(apiKey);
      setNewKeyLabel('');
      const { keys: k } = await getApiKeys();
      setKeys(k);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCopyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await revokeApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyBusy(true);
    setPasskeyNotice(null);
    try {
      const { ceremonyId, options } = await getPasskeyRegistrationOptions();
      const { startRegistration } = await import('@simplewebauthn/browser');
      const response = await startRegistration({
        optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      await verifyPasskeyRegistration({
        ceremonyId,
        response,
        label: newPasskeyLabel.trim() || undefined,
      });
      setNewPasskeyLabel('');
      const { credentials } = await listPasskeys();
      setPasskeys(credentials);
    } catch (err: unknown) {
      // User dismissed the authenticator prompt — quiet note, not an error.
      setPasskeyNotice(
        (err as { name?: string })?.name === 'NotAllowedError'
          ? t.passkeyCancelled
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    // Two-step inline confirm: first click arms (auto-disarms after 4s),
    // second click deletes.
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(
        () => setConfirmDeleteId((cur) => (cur === id ? null : cur)),
        4000,
      );
      return;
    }
    try {
      await deletePasskey(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-zion-gold" />
          <h2 className="text-lg font-bold text-white">{t.security}</h2>
        </div>
        <p className="text-sm text-gray-400">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Linked addresses */}
      <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-5 w-5 text-zion-cyan" />
          <h2 className="text-lg font-bold text-white">{t.linkedAddresses}</h2>
        </div>
        {linkedAddresses.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noLinkedAddresses}</p>
        ) : (
          <div className="space-y-3">
            {linkedAddresses.map((la) => (
              <div
                key={la.id}
                className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="space-y-1">
                  <p className="font-mono text-sm text-white break-all">{la.address}</p>
                  <p className="text-xs text-gray-500">
                    {t.chain}: <span className="text-zion-cyan">{la.chainType}</span>
                    {la.chainId ? ` / ${la.chainId}` : ''}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {t.verified}: {formatDate(la.verifiedAt, locale)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Passkeys */}
      {PASSKEY_ENABLED && (
      <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
        <div className="flex items-center gap-2 mb-6">
          <Fingerprint className="h-5 w-5 text-zion-cyan" />
          <h2 className="text-lg font-bold text-white">{t.passkeys}</h2>
        </div>

        {hasPasskeySupport && (
          <form onSubmit={handleAddPasskey} className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={newPasskeyLabel}
              onChange={(e) => setNewPasskeyLabel(e.target.value)}
              placeholder={t.passkeyLabel}
              maxLength={64}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan/50"
            />
            <button
              type="submit"
              disabled={passkeyBusy}
              className="zion-button-secondary text-sm py-2 px-4 disabled:opacity-50"
            >
              {passkeyBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {passkeyBusy ? t.addingPasskey : t.addPasskey}
            </button>
          </form>
        )}

        {passkeyNotice && (
          <p className="mb-4 text-xs text-gray-400">{passkeyNotice}</p>
        )}

        {passkeys.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noPasskeys}</p>
        ) : (
          <div className="space-y-3">
            {passkeys.map((p) => (
              <div
                key={p.id}
                className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ '--rc': '6, 182, 212' } as CSSProperties}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white">{p.label || t.passkeys}</p>
                    <span className="rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-2 py-0.5 text-[10px] text-zion-cyan">
                      {p.backedUp || p.deviceType === 'multiDevice' ? t.synced : t.singleDevice}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t.created}: {formatDate(p.createdAt, locale)}
                    {p.lastUsedAt ? ` • ${t.lastUsed}: ${formatDate(p.lastUsedAt, locale)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePasskey(p.id)}
                  className={`zion-button-secondary text-xs py-2 px-3 self-start sm:self-auto ${
                    confirmDeleteId === p.id ? 'border-red-500/50 text-red-300' : ''
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirmDeleteId === p.id ? t.confirmDelete : t.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Active sessions */}
      <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-zion-purple" />
            <h2 className="text-lg font-bold text-white">{t.activeSessions}</h2>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={handleRevokeAll}
              className="zion-button-secondary text-xs py-2 px-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.revokeAll}
            </button>
          )}
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noActiveSessions}</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                style={{ '--rc': '228, 30, 43' } as CSSProperties}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white">{s.userAgent || 'Unknown'}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t.created}: {formatDate(s.createdAt, locale)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t.expires}: {formatDate(s.expiresAt, locale)}
                    </span>
                    {s.ipAddress && (
                      <span>
                        {t.ip}: {s.ipAddress}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(s.jwtJti)}
                  className="zion-button-secondary text-xs py-2 px-3 self-start sm:self-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.revoke}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API keys */}
      <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
        <div className="flex items-center gap-2 mb-6">
          <Key className="h-5 w-5 text-zion-gold" />
          <h2 className="text-lg font-bold text-white">{t.apiKeys}</h2>
        </div>

        <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            placeholder={t.newKeyLabel}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-gold/50"
          />
          <button
            type="submit"
            disabled={!newKeyLabel.trim()}
            className="zion-button-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t.createKey}
          </button>
        </form>

        {newKey && (
          <div className="mb-6 rounded-xl border border-zion-gold/30 bg-zion-gold/10 p-4 space-y-3">
            <p className="text-sm text-zion-gold">{t.keyCreated}</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 break-all rounded-lg bg-black/40 px-3 py-2 text-xs font-mono text-white">
                {newKey}
              </code>
              <button
                onClick={handleCopyKey}
                className="zion-button-secondary text-xs py-2 px-3"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noApiKeys}</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ '--rc': '252, 209, 22' } as CSSProperties}
              >
                <div className="space-y-1">
                  <p className="text-sm text-white">{k.label}</p>
                  <p className="text-xs text-gray-500">
                    {t.created}: {formatDate(k.createdAt, locale)}
                    {k.lastUsed ? ` • ${t.lastUsed}: ${formatDate(k.lastUsed, locale)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeApiKey(k.id)}
                  className="zion-button-secondary text-xs py-2 px-3 self-start sm:self-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
