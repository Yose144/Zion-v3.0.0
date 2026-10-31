# ZIS Threat Model + Privacy Review (3.B2)

**Datum:** 2026-10-30 · **Autor:** Devin · **Scope:** `apps/identity` (ZIS), `apps/shared/prisma/schema.prisma`, web proxy spot-check
**Gate:** prerekvizita pro passkey E2E napříč weby (3.B1 → V33-4) — dle Exekuční charty R4.
**Metoda:** code-verified review (žádné dynamické testování; zjištění zdrojem, ne domněnkou).

## 1. Architektura (code-verified)

- Fastify 5 + Prisma/PostgreSQL; 2 instance (`edge` public `auth.zionterranova.com`, EDGE2 interní pro warpd) nad **jednou DB a jedním Ed25519 JWT klíčem**.
- Auth: Ed25519 (ZION L1), SIWE (EVM), Google OIDC, WebAuthn passkey, linkování btc/solana/quantus/pearl přes attestation.
- Session: JWT EdDSA 7d, DB `Session` per `jti` (revokace + expiry kontrolována per request), rolling refresh v polovině života, cookie `zion_session` = `httpOnly + secure + sameSite=lax + signed` na `.zionterranova.com`.
- Challenges: DB, TTL 5 min, **jedna aktivní per address** (upsert přepíše), consume-on-verify; SIWE má domain-binding whitelist.
- Rate-limit: globální 30/min, bucket per session-sub / IP / service-key prefix; CORS = explicitní 7-origin whitelist + credentials.
- Audit: `AuthEvent` (kind, address, ip, UA, meta) fire-and-forget, prune 180 d.
- Custodial money path: `/api/wallet/*` proxy → L2 warpd; session cookie se forwarduje; **`POST /api/wallet/withdraw` = jen session auth**.

## 2. Assets

| Asset | Dopad kompromisu |
|---|---|
| `JWT_PRIVATE_KEY` (Ed25519) | forged sessions pro kohokoliv = totální takeover |
| `ZIS_SERVICE_KEY` | admin bypass (user list, role change, delete) + notifications push |
| `JWT_SECRET`/`JWT_LEGACY_SECRET` (HS256) | forged legacy sessions během grace |
| User accounts / sessions | identity theft, custodial wallet drain přes `/wallet/withdraw` |
| API keys (sha256 v DB) | raw leak → full account access (žádné scopy) |
| PII: e-mail, IP, UA, linked addresses | privacy incident |

## 3. Threat model — zjištění

### Mitigováno (silné stránky)
- Session `jti` bind: `session.userId === payload.sub`, revokace per-jti, DB expiry check — JWT s cizím jti neautentizuje.
- Signed cookie → subdomain nemůže injectnout `zion_session` bez cookie secret.
- SIWE domain whitelist (anti-phishing replay), Ed25519 pubkey→adresa derivace, BTC/quantus/pearl attestation s kanonickými challengy, consume-on-verify = anti-replay.
- API key = SHA256 hash, raw jen jednou; `VerificationToken` stejně.
- `x-service-key` timing-safe compare; admin role v DB (last-admin demote refused).
- Challenge TTL 5 min + DB store = multi-instance safe; WebAuthn ceremonies one-shot rows.
- Audit trail přežije delete (`userId → NULL`, 180d retention).

### F-1 🔴 Vysoké: `/api/wallet/withdraw` bez step-up auth
Session cookie stačí k custodial výběru. XSS na jakémkoliv `*.zionterranova.com` originu (všech 7 v CORS whitelistu) → přímý drain. **Mitigace:** step-up pro withdraw — e-mail confirm link, passkey UV (`requireUserVerification`), nebo time-delayed withdrawal + notifikace. Souvisí s 3.B4 custody disclosure a ZionDex settlement cestou.

### F-2 🟠 Střední: shared-subdomain trust blast radius
Cookie domain `.zionterranova.com` + CORS whitelist + WebAuthn RP `zionterranova.com` = jedna XSS/kompromitovaný subdoména dává credentialed API access (sameSite=lax blokuje jen cross-*site*, ne cross-*subdomain* — stejný site). **Mitigace:** CSP hardening na všech frontách (mimo scope ZIS), zvážit `__Host-` cookie bez `Domain` pro auth-critical app + per-app session audience. Přijatelné riziko dokumentovat — redesign = architektonická změna.

### F-3 🟠 Střední: challenge upsert = per-address login DoS
`POST /api/auth/challenge` přepíše aktivní challenge pro **cizí adresu** (unauthenticated, 30/min per IP). Útočník spamuje challenge → oběť nemůže dokončit login (nonce mismatch). **Mitigace:** challenge per (address, requester-fingerprint) nebo držet předchozí challenge vedle nové (accept either within TTL), rate-limit per address ne jen per IP.

### F-4 🟠 Střední: legacy HS256 verifier bez expiračního data
`verifyLegacyToken` akceptoval `JWT_LEGACY_SECRET`/`JWT_SECRET` donekud byl env nastaven — grace měl pokrýt 7d expiraci tokenů. ✅ **Vyřešeno 31.10. (3.B5):** legacy verifier odstraněn z `keys.ts`, fallbacky z `auth.ts`/`server.ts`; HS256 tokeny nově selžou na `jwtVerify` → `requireAuth` 401. Zbývá: prod env `JWT_LEGACY_SECRET` unset (dead config cleanup při deploy).

### F-5 🟡 Nízké: passkey UV není povinné
`userVerification: 'preferred'` + `requireUserVerification: false` → stolen unlocked device = login. **Mitigace:** pro withdraw/step-up akce vyžadovat UV ceremony (viz F-1); pro plain login akceptovatelné. Sign-counter regression se ukládá (`newCounter`), ale neflaguje — přidat `AuthEvent` na regression = clone signal.

### F-6 🟡 Nízké: API keys bez scope/expirace
`ApiKey` = hash + label; klíč = full account. **Mitigace:** scopey (read/write/withdraw-never), expirace, last-used alert — součást návrhu agent sub-accounts (checklist N1).

### F-7 🟡 Nízké: session token nebindovaný na kontext
UA+IP se ukládají, ale neporovnávají → stolen cookie funguje odkudkoliv. Plný bind by rozbil mobilní roaming; **mitigace:** detekce změny UA/IP → `AuthEvent` + notifikace uživateli (infra `/api/notifications` existuje).

### F-8 🟡 Nízké: žádné security-event notifikace
Login z nového zařízení, link, primary_change, passkey add/remove — ticho. Útok na účet je neviditelný pro oběť. **Mitigace:** `notification_push` pipeline na security kinds (link/unlink/primary_change/passkey/login z nového IP-UA heuristiky).

### F-9 ℹ️ Info: SIWE localhost acceptance
`localhost`/`127.0.0.1` domain pass i v produkčním verifieru — bezpečné (nonce je náš), ale zúžit přes env flag pro prod hygiena. Stejně tak `x-service-key` = jeden sdílený secret napříč službami — P0-3 rotace již v frontě, rozšířit na per-service keys.

## 4. Privacy review (data inventář)

| Data | Kde | Retence | Poznámka |
|---|---|---|---|
| `primaryAddress`, linked chain addresses | User/LinkedAddress | do delete účtu | pseudonymní, ale on-chain linkovatelné — „vymazání" nesmaže veřejný chain footprint (disclose v UI) |
| `googleId`, `email`, `displayName`, `bio`, avatar (uploaded bytes) | User/AvatarAsset | do delete (cascade) | e-mail optional + verify flow; uploaded avatar = **veřejný** `/avatar/u/:id` |
| `Session.ipAddress` + `userAgent` | Session | život session (7d rolling → prakticky neomezený při aktivitě) | **PII** — doplnit retention cap (např. strip IP po 30d i u aktivních) |
| `AuthEvent.ip` + `userAgent` + `address` | AuthEvent | **180 d** prune ✅ | `address` přežije account delete — OK (pseudonymní), zdokumentováno |
| WebAuthn credentials | WebAuthnCredential | do delete | public key only — nejsou PII per se |
| VerificationToken | sha256 | TTL | ✅ |
| Wallet accounts/balances/orders | Multichain* | custodial records | finance data — retention dle účetních povinností, ne 180d blanket |
| Notifications | Notification | — | user content |

**GDPR povrch:** delete endpoint existuje (fresh proof-of-key ✅) a kaskádově maže user data; **chybí data export** (SAR = manuální SQL) — doporučit `GET /api/auth/me/export` (MVP: JSON dump svých řádků). Cookie = jediná je httpOnly session, žádné trackery. Dvě instance sdílejí DB — joint-controller dokumentace stačí interně.

## 5. Passkey launch prerekvizity (R4 gate → 3.B1)

- [ ] F-1: withdraw step-up nebo minimálně custodial disclosure + withdraw notification (3.B4 spojit)
- [x] F-4: legacy verify path odstraněn (3.B5, 31.10.) + env cleanup při deploy
- [ ] F-5: counter regression → AuthEvent
- [ ] F-8: security notifications na link/primary/passkey events
- [ ] F-3: challenge DoS fix (může být follow-up, ne launch blocker)
- [ ] Public copy: passkey = device-bound, ne unique-human (souhlasí s QV E1 gatem z 6.B3)

## 6. Explicitně mimo scope

- ZK identity proofy, social recovery, MPC custody — HORIZONT.
- Plný CSP/subdomain audit všech 7 front — zvláštní per-app reviews.
- Penetration test — externí audit (G9) scope.
