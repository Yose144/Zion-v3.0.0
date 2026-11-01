# REPORT 2026-11-01 — NIRVANA CHAT M1 (chat pro ZIS uživatele)

> **Stav:** hotové, **nasazené** (net `20261101T120326Z`, web `20261101T1204xx`).
> **Live:** `https://nirvana.zionterranova.com` — chat dok na každé stránce.
> **Kde:** `apps/nirvana/src/core/net/`, `apps/nirvana-net/src/zis.ts`, `app/layout.tsx`, `app/globals.css`.
> **Navazuje na:** `REPORT_2026-11-01_NIRVANA_NET_M0.md`, plán `~/.opencode/plan/NIRVANA-MULTIPLAYER-AVATARS.md` (fáze M1).

## 1. Co to je

Chat v Nirvaně, který pozná, kdo jsi — ale **jméno a avatar mu neřekneš ty**.
Server si vezme cookie `zion_session` z WebSocket handshaku, zeptá se ZIS na
`/api/auth/me` a z odpovědi si vytáhne jen to, co smí do hry.

| Role | Může | Dostane |
|---|---|---|
| `zis` (přihlášený) | číst i psát | jméno (`callsign` → `displayName` → zkrácená adresa), avatar (sigil/upload), `avatarId` z `avatar3d` |
| `guest` (bez session) | jen číst | `host-xxx`, bez avatara |

**Nikdy nejde do hry:** e-mail, role účtu, linked adresy. Klient posílá jen
`hello` a text zprávy.

## 2. Server (`apps/nirvana-net`)

- `src/zis.ts` — `sessionCookie()` (vytáhne jen `zion_session=…`, zbytek cookies
  se neposílá), `resolveIdentity()` s cache 60 s (limit 500), timeout 3 s.
  Když ZIS mlčí nebo session vypršela → **host**, hra běží dál.
- Kanály: `park` (mimo místnost) a `arena:<room>`. Historie 200 zpráv v RAM.
- `postChat()`: role gate (`read_only`), rate limit 2 zprávy / 2 s (`rate_limited`),
  očista textu (HTML tagy, řídicí znaky, `<`/`>`, strop 240), příkazy `/who`, `/help`.
- Presence: `welcome` nese `members` (id, jméno, role, avatar, avatarId) a `online`;
  `event join/leave` drží seznam živý.
- Metriky navíc: `nirvana_net_chat_messages_total`, `nirvana_net_chat_lines`,
  `nirvana_net_zis_cache`.
- Protokol **v2** (M0 byl 1) — přibyla historie v `welcome`, `members`,
  systémové zprávy a `read_only`. Starý klient dostane `proto_mismatch`.

## 3. Klient (`apps/nirvana/src/core/net/`)

- `useNet.tsx` — `NetProvider` v `app/layout.tsx`, **jedno WS na kartu**;
  reconnect s backoffem (1/2/4/8/15 s), ping 25 s (RTT v HUD), čistý stav
  (`connecting | open | offline`). Když spojení spadne, UI jen ztlumí, nic nespadne.
- `ChatDock.tsx` — plovoucí dok vpravo dole + panel: seznam přítomných s avatary
  (max 8, jméno při najetí), historie, vstup, stav a RTT. `T` otevře, `Esc` zavře,
  otevření uvolní pointer lock (aréna). **Klávesy v inputu volají `stopPropagation`** —
  jinak by `W` rozjelo vozítko na Venuši.
- Host vidí „Psát může jen přihlášený" + odkaz na účet; vstup se vůbec nevykreslí.
- Nepřečtené zprávy = badge na dok buttonu.

## 4. Ověření

**Server — `npm run smoke` (34/34):** ke stávajícím M0 kontrolám přibylo:
host odmítnut (`read_only`), ZIS identita (role, jméno z `callsign`, `avatarId`,
absolutní URL avatara), seznam přítomných, člen s avatarem, historie pro nováčka,
`/who`, rate limit 2/2 s, **jedna zpráva = jeden event**, sanitizace tagů,
přechod do místnosti a zpět do parku (ohlášený odchod i návrat).
Stub ZIS v testu vrací přesně tvar `User` z identity (id, primaryAddress,
displayName, avatar, avatar3d) — testuje se služba, ne ZIS.

**Klient — headless Playwright (10/10):** host bez vstupu + vysvětlení;
přihlášený (stub ZIS + cookie) má vstup, zpráva se odešle, `<b>` zmizí, jméno
je ze serveru; host zprávu vidí; psaní zůstává v inputu; **na Venuši se při
psaní vozítko nerozjede** (rychlost 0 před i po).

**Live:** `/net/health` → `proto 2`; guest welcome `role:guest`, chat →
`read_only`; chat dok na `/park`, `/mars`, `/venus` (i mobil 390×844 bez
přesahu), 0 chyb v konzoli, seznam přítomných se vykresluje.

## 5. Pasti

1. **Root workspace (K1.2) změnil layout standalone výstupu** — `node_modules`
   je o úroveň výš a appka v `.next/standalone/apps/<app>`. Deploy spadl na
   „incomplete standalone artifact". `deploy-nirvana.sh` teď artefakt
   **zplošťuje** do `.next/standalone-flat`, takže unit zůstal beze změny.
2. **`npm run build` za běhu serveru** rozbije statiku (stale manifest → 404
   na chunky). Po buildu vždy restartovat.
3. **Lokální `NEXT_PUBLIC_NIRVANA_NET_URL`** se propíše do bundlu — před
   nasazením build bez něj (deploy skript to dělá sám).
4. **Porty:** na `:3040` může běžet cizí lokální preview (jiná session) — testy
   proto používají vlastní port a vlastní instanci služby na volném portu.
5. **Zbytky procesů** na `:3011`/`:4599` z předchozích běhů testů dělají falešné
   chyby (offline stav, 403 origin). Test si proto bere volné porty a hlídá
   exit služby.

## 6. Co zbývá

- **Pozitivní cesta na živém ZIS** (reálná session) — kód je ověřený proti stubu
  se stejným tvarem odpovědi; živý test potřebuje přihlášení (operátor nebo
  dočasný testovací účet).
- **M2a — multiplayer arény** (rooms, tick, snapshoty, server-authoritative zásahy).
- Volitelně: `/me` (emotivní zprávy), mazání zpráv, seznam místností v UI.
