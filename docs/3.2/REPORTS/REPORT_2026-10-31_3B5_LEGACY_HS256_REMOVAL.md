# Report: 3.B5 — Legacy HS256 verify removal (post-grace)

**Datum:** 2026-10-31 · **Scope:** `apps/identity` (ZIS) · **Status:** ✅ Deployed

## Kontext

- EdDSA cutover proběhl 21. 10. (`JWT_PRIVATE_KEY` na prod, JWKS publikováno).
- Session TTL = 7 dní → poslední HS256 session expirovala **28. 10.**
- F-4 z `ZIS_THREAT_MODEL_PRIVACY.md`: legacy verifier žil donekud byl env nastaven — bez data odstranění = věčně slabý fallback.

## Co bylo odebráno

| Soubor | Změna |
|---|---|
| `src/lib/keys.ts` | `verifyLegacyToken()`, `legacyVerifier`, `LegacyVerifier` type, `createVerifier` import — vše pryč; header komentář zaznamenává konec grace 28.10. |
| `src/lib/auth.ts` | `verifySessionToken()` = pouze `req.jwtVerify()` — legacy fallback odstraněn; HS256 token → verify fail → `requireAuth` 401 / `optionalAuth` anonymous |
| `src/server.ts` | Rate-limit `keyGenerator` — unverifiable token → per-IP bucket (místo legacy `sess:<sub>`) |
| `test/hardening.test.ts` | Legacy-grace assertion bloky odstraněny z obou key-mode testů; `createSigner`/`verifyLegacyToken` imports pryč |
| `.env.example`, `README.md`, `deploy-zis.sh` | Dokumentace/checklist sjednoceny: JWT_SECRET = cookie-signing + dev HS256 fallback, ne legacy verifier |

## Prod env audit (EDGE2, před deploy)

- `JWT_PRIVATE_KEY` ✅ → EdDSA aktivní
- `JWT_LEGACY_SECRET` **nikdy nastaven** → nic k úklidu
- `JWT_SECRET` **ponechán** — nadále slouží jako cookie-signing secret (`COOKIE_SECRET` unset; odstranění by zneplatnilo signed cookies všech aktivních session)

## Verifikace

- `tsc --noEmit` čistý; `npm test` **49/49** ✅ (vč. přepsaných `eddsa mode: JWKS exposes the public JWK only`, `hs256 mode: empty JWKS`)
- Deploy přes `deploy/deploy-zis.sh` → health 200
- On-host provenance: `verifyLegacyToken|legacyVerifier` = **0×** v `lib/keys.js`, `lib/auth.js`, `server.js`; `withLinkProvenance` zachován (2× v `routes/apikey.js`)
- `/.well-known/jwks.json` servíruje Ed25519 `zis-4c28033ed681216f`

## Dopad

- HS256-session útoková plocha mimo hru — slabý symmetric secret už se nikde neakceptuje
- F-4 uzavřeno; threat-model prerekvizity pro další práci aktualizovány
- Dev/test HS256 mód (`JWT_SECRET` bez private key) zůstává funkční — jde o aktivní signing mód, ne legacy verify

## Residua

- `JWT_SECRET` na prod = cookie secret — zvážit přejmenovat na `COOKIE_SECRET` při příštím rotaci (čistší separace; vyžaduje env změnu + restart)
- Mobile app (3.B6) používající staré HS256 sessions by dostala 401 — reálně nula dopad (všechny expirovaly 28.10.)
