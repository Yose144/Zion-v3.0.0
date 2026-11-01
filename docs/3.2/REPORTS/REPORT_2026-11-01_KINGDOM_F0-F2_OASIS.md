# REPORT — Kingdom F0–F2a: první svět OASIS

> **Datum:** 2026-11-01 · **Autor:** agent (autonomní) · **Stav:** F0 ✅ · F1 ✅ · F2a ✅ · F2b ✅ · **F3 ✅ (9 portálů)**
> **Rozhodnutí 👤, která to spustila:** (1) strom `Kingdom/` v rootu, stavěný od nuly; (2) `website-v2.9` zůstává knihovnou/docs; (3) Dashboard zůstává samostatný; (4) Nirvana = první svět OASIS, OASIS jednou jako AAA hra; (5) market, pool UI i Dashboard funkčně zůstávají.
> **Stav k 2026-11-01 02:00 UTC (autonomní noční běh):** Kingdom **live na `https://kingdom.zionterranova.com`** (TLS do 2027-01-30) — F0 ✅, F1 ✅ (+ stargate a rasta), F2a ✅, F2b ✅, F3 ✅ (9 portálů), **ZIS S1 ✅ a S2 ✅ nasazené**. Zbývá: ZIS S3 (migrace konzumentů) a S4 (CSRF + CORS), F4–F6.
> **NASZENO 2026-11-01 21:00 UTC** na EDGE2 (`zion-kingdom.service`, `127.0.0.1:3020`, vhost `kingdom.zionterranova.com` staged na :80). DNS + certbot zůstávají 👤.

---

## 1. Co je hotové

### F0 — Repo substrate (1 lockfile, 8 balíčků)

| Co | Stav |
|---|---|
| `Kingdom/` npm workspace root | 1 lockfile (ekosystém jich má 13) |
| `@zion/contract` — Portal Contract v1 | typy + `definePortal` + `readSpec` |
| `@zion/api` — jediná datová cesta | server-side `fetch`, cache per manifest, `tryRead` |
| `@zion/i18n` — jediná i18n | cs/en celé na serveru, žádný slovník v klientu |
| `@zion/ui` — jediný token set | `tokens.css` (CSS custom properties) |
| `@zion/world` — doména světa | **bez React/Three/DOM**, vynuceno lintem |
| `@zion/scenes` — web adaptér | three.js + R3F, smí importovat three |
| registry portálů | generovaný z manifestů (`scripts/codegen.mjs`) |
| hranice | `scripts/check-boundaries.mjs` — 6 pravidel, 0 závislostí |

### F1 — Brána

Obsah `apps/IntroPage` (`maintenance.html` + `intro-tabs.js` i18n) přepsán do **typovaných dat** `core/gate/content.ts` — ne do JSX:

- hero (`ZION` / `TERRA NOVA ∞ OASIS` / Multichain Dharma ekosystém) + vstup, OASIS preview, eXplorer
- **živý pás** — výška, difficulty, hashrate, block time, připojené mince (ověřeno live: 104 088 bloků / 5 494 / 92 H/s / 56 s / 12/12)
- **Co je ZION** — tři odstavce vč. fee splitu 89/5/5/1
- **Tři cesty na palubu** — Pozorovatel / Hráč / Stavitel
- **Vrstvy ekosystému** — L1–L6 jako rozcestník
- kotvy `#why` `#paths` `#layers`, patička

### F2a — První svět OASIS (orbit)

Scéna ve Místnosti, **generovaná Portal Contractem**: portál s `ring` souřadnicemi se objeví ve světě bez zásahu do rendereru.

```
packages/world/src/           packages/scenes/src/
  types.ts    Vec3, Planeta,    OrbitScene.tsx   Canvas, kamera, světla
              Prstenec, Marker  NewEarth.tsx     planeta + atmosféra
  geometry.ts stanice na        IssobellaRing.tsx prstenec L6 + 6 stanic
              prstenci         Starfield.tsx     2400 hvězd, 1 buffer
  rng.ts      mulberry32,       Gate.tsx         Brána (vstup) + puls
              starField         Markers.tsx      markery portálů + hover
  orbit.ts    Nová Země,
              Issobella, Brána
```

- **Nová Země** = planeta s texturou (82 KB webp), **Issobella** = prstenec se 6 stanicemi, **Brána** = místo příjezdu mimo planetu, **markery** = portály.
- Klik na marker → `/portal/<id>`; klik na Bránu → `/`.
- Graf se načítá **lazy a mimo SSR** (`next/dynamic`, `ssr:false`) — Místnost a okna jsou interaktivní dřív, než se stáhne three.js.

### F2b — 13 světů OASIS

`apps/shared/scenes` (10 900 LOC včetně `kit`) převzato do `packages/scenes/src/worlds/`:

- **`@genesis/runtime` zrušen.** Byl to alias, který si každá aplikace musela definovat v `tsconfig.json`; scény teď importují skutečný `runtime.ts` (jediná instance React/R3F/three v bundlu).
- **`OrbitRig` místo `drei` `OrbitControls`** — stejné rozhraní, jaké scény čtou (`target`, `enabled`, `autoRotate`, `autoRotateSpeed`, `min/maxDistance`, `maxPolarAngle`), plus tažení a kolečko. Bez drei.
- **Katalog je oddělený od rendereru:** `WORLD_CATALOG` (texty) v `@zion/world`, `WORLDS` (komponenty, kamery, controls) v `@zion/scenes`. Serverová stránka `/world/<id>` tak three nenačte do SSR.
- **`/world/<id>` je místo, ne portál.** Portály jsou okna (`/portal/<id>`), světy jsou plátno. Místnost má sekci „Světy OASIS" s 13 dlaždicemi.
- Ověřeno CDP na **Genesis Garden** (tři pyramidy, jezero, tee-pee, české labely) a **Kailash** (hora, klášter, modlitební praporky, sněžení).

### F3a — portál `freeworld` (Přístav)

Čtvrtý portál a první, který není „řetěz/pool/tržiště": **L5 fond, granty a projekty** z `zion-v31-free-world` přes `app.` proxy.

- 3 deklarovaná čtení (`fund/balance`, `grants`, `projects`), cache 60/120 s
- **ZIONy z flowers** (1 ZION = 1e6) se počítají v portálu, ne ve službě — jedna konverze na jednom místě
- live: **28 096 820 ZION** nashromážděno (blok 104 145), 0 vyplaceno, 6 grantů po 10M ZION, 12 projektů
- portál má `ring` → objevil se i ve scéně Místnosti jako čtvrtý marker (důkaz, že svět je řízený kontraktem)

### F3b — zbývajících 5 portálů

| Portál | Data | Poznámka |
|---|---|---|
| **Snem** (DAO, L2) | 7 strážců s adresami, 1,5 mld ZION v oběhu, 0 návrhů | reálná data z `dao/proposals` + `stats` + `guardians` |
| **Knihovna** (L4) | **14 knih** z `canon/books` | katalog generuje codegen z `00-README.md` — žádné ruční kopie textů, žádné síťové čtení |
| **Věž** (Hiran, L3) | probe `/api/ai-chat` → available / backend / model | rozhovor je zápis → F4 |
| **Issobella** (L6) | health | papers vrací **404** — repo 6.B4 existuje, ale na EDGE2 není nasazené |
| **Účet** (L0) | — | `auth: 'session'`, `status: 'placeholder'`; **nemá `ring`** — loď cestuje s tebou, není to místo |

**Pravidlo placeholderu:** portál, který ještě nemá obsah, to **řekne nahlas** a napíše proč. Žádné tlačítko, které nefunguje. `status: 'placeholder'` v manifestu znamená: v liště ztlumený, na kartě „připravujeme", v okně vysvětlení.

Výsledek: scéna Místnosti má **8 markerů** (Účet chybí záměrně) a lišta 9 portálů — celý ekosystém je poprvé na jednom místě.

### F1b — stargate + rasta (2026-11-01)

Brána dostala **skutečnou bránu** a **rasta design**.

⚠️ **První dva pokusy byly špatná brána.** `apps/IntroPage/public/stargate/` obsahuje **dvě** varianty: `stargate-theme.css` (43 KB, globální — styluje `body`/`#header`) a `stargate.css` (18 KB, **scoped pod `.stargate-wrap`**). Portoval jsem tu první, a ta nemá `.chevrons`, `.chevronInners` ani `.center-logo` — takže výsledek byl jen rozostřený stack obrázků, ne brána. **Kanoniální zdroj je `apps/website-v2.9/src/components/StargateLogo.tsx`** (live na `/doge-vs-zion`), který používá scoped `stargate.css`.

Výsledná podoba (`core/gate/Stargate.tsx` + `core/gate/stargate.css`):

- `.stargate-wrap > .gate > .container` — **28 rotujících vrstev** (22× `2.png`, 6× `1.png`) + `a.center-logo` (Z.webp, fallback Z.gif)
- `.glyphs` — **52 glyfů** (A–Z, a–z); dřív jsem měl 39
- `.chevrons` + `.chevronInners` — **9 + 9 chevronů**, které v první verzi chyběly úplně
- Assety `1.png`, `2.png`, `Z.gif`, `Z.webp`, `nebula.jpg` → `public/stargate/` (1 MB; `Z.gif` se nenačítá, `<picture>` vybere webp)
- **Pozadí hero ztmaveno:** brána si nebuli nese uvnitř kruhu (`.stargate-wrap`). Když svítila i za ní, kovový prstenec se rozmył a brána přestala vypadat jako brána. Velikost `min(68vmin, 620px)` kvůli proporcím.
- **Rasta tokeny** (`--rasta-red #e41e2b`, `--rasta-gold #fcd116`, `--rasta-green #078930`) přidány do `@zion/ui`; zdroj `apps/IntroPage/public/assets/css/intro-rasta.css`.
- 🔴 **Chyba při portu (nalezena měřením, ne okem):** `:root` se při prefixování přepsal na `.k-stargate :root`, což nematchuje nikdy → `--gate-offset-y` chyběl → `top: calc(50% + var(--gate-offset-y))` neplatné → `top: auto` → brána se posunula o **půl své výšky (369 px) nahoru** a byla uříznutá. Na screenshotu to vypadalo „jen divně"; `getBoundingClientRect()` ukázal `.k-stargate top:108` vs `.gate top:-261`. Fix = definovat proměnnou na `.k-stargate`, ne na `:root`.
- Rasta se aplikuje **jen na Bránu** (hero aura, zlatý badge, zlaté CTA, triáda na třech cestách). Místnost a portály zůstávají neutrální — data musí zůstat čitelná.

### ZIS S1 — jeden klient pro celý ekosystém (2026-11-01)

Audit ZIS (`apps/identity`, 4 171 LOC, 59 endpointů, 51 testů) ukázal, že **služba je zdravá** — EdDSA JWT + JWKS, session v DB s revokací (single i revoke-all), WebAuthn, API klíče, audit, metriky, cookie `zion_session` na `.zionterranova.com`. Problém nebyl v ZIS, ale **v konzumentech**: šest klientských implementací, 2 119 řádků.

| Klient | Řádků | Poznámka |
|---|---|---|
| `apps/shared/zis-client.ts` | 901 | „canonical", ale MarketPlace si ho částečně kopíruje |
| `apps/website-v2.9/src/lib/zis.ts` | 619 | vlastní implementace |
| `apps/MarketPlace/src/lib/zis.ts` + `zis-client.ts` | 201 + 143 | dvě kopie, rozcházejí se |
| `apps/pool-ui/src/lib/zis.ts` | 182 | `NEXT_PUBLIC_ZIS_URL` |
| `apps/nirvana/src/lib/zis.ts` | 73 | vlastní |
| `Kingdom` | ~50 | stub |

**Hotovo v S1:**

- `@zion/session` — typovaný klient (`getChallenge`, `verifyEd25519`, `getCurrentUser`, `logout`, `listSessions`) + odvození peněženky z fráze (`deriveWalletFromMnemonic`, `signMessage`) přenesené z `apps/nirvana/src/lib/zionWallet.ts`. Fráze zůstává v prohlížeči.
- Kingdom přihlášení: dvoukrokový `POST /api/auth/login` (challenge → verify) a `/api/auth/logout`. Cookie `zion_session` v produkci na `.zionterranova.com`, lokálně host-only. **SSO zůstává**, protože cookie nastavujeme se správnou doménou — ne jen na host.
- Server volá ZIS přes loopback (`ZIS_URL=http://127.0.0.1:8096`), takže **CORS není potřeba** a `zion-zis` se nemusel restartovat.
- Portál **Účet** je živý: bez session formulář, se session adresa, projekce OASIS hráče a odhlášení.
- Hraniční check při tom chytil chybu v návrhu: přihlášení jsem měl v `portals/account/`, ale **session patří hostiteli okna** → přesunuto do `core/session/`.

**Ověřeno:** challenge přes server vrací reálný `ZION-AUTH-V1` objekt (28–70 ms přes loopback), neplatný podpis → `401`, podpis ověřen klíčem (64 B). Plné přihlášení jsem na produkci **nespustil** — vytvořilo by uživatele v ZIS DB; crypto cesta je ověřená zvlášť.

### ZIS S2 — kontraktní test našel reálnou chybu (2026-11-01)

`Kingdom/scripts/check-zis-contract.mjs` volá živý ZIS a ověřuje **tvar odpovědí**, na kterých stojí celý ekosystém (health, JWKS, challenge, `/me`, verify, avatar). Není součástí `verify` — potřebuje síť.

**První běh proti produkci: 13/14 ✓, 1 ✗.**

```
✗ POST /verify/ed25519 se špatným podpisem → 401 — dostal 500
```

**Root cause:** `apps/identity/src/lib/challenge.ts` — `verifyEd25519()` dělá
`Buffer.from(publicKeyHex,'hex')` a hned `publicKeyToAddress()`, která hází na délce ≠ 32 bajtů. Vstup `publicKey: "00"` tedy skončil jako **500**, ne 401.

Dopad: chybový 5xx místo 4xx (zapleveluje metriky, mate klienty, kteří čtou 5xx jako výpadek) a otevřená cesta k zaplavení error logu z jedné adresy.

**Fix:** validace `pub.length === 32 && sig.length === 64` → `false` (→401), `publicKeyToAddress` i `ed.verify` v `try/catch`. Regresní test `apps/identity/test/verify-malformed.test.ts` (5 poškozených vstupů + chybějící výzva).

**Nasazeno 2026-11-01 01:40 UTC** (pokyn 👤 „nasadit všude"). Kontraktní test po nasazení: **14/14 OK**, `zis_http_requests_total{route="/api/auth/verify/ed25519",status="401"}` roste místo `500`. Restart `zion-zis` 2,4 s, health OK. Kingdom přes to dál funguje (challenge 42 ms, poškozený podpis → 401).

⚠️ **Deploy skript měl dvě chyby, obě opravené:**

1. **`rsync --delete` u víc zdrojů** do jednoho adresáře maže i `.env` a `node_modules` → skončí kódem 23 → `set -e` zastaví deploy ve kroku 2 → **služba se vůbec nerestartuje**. Přesně to se stalo: soubory se nakopírovaly, restart neproběhl, musel jsem ho dokončit ručně. Fix: artefakty se mažou explicitně před rsyncem, `--delete` je pryč.
2. **Chybělo `--chown=zion:zion`** — rsync jako root zachová uid z macu (`501:staff`), takže služba běžela nad soubory, které nevlastní. Fix: `--chown` v rsyncu.

### Kingdom F4a — Věž (Hiran) je živá (2026-11-01)

Poslední portál, který říkal „připravuji", je hotový:

- `POST /api/hiran/chat` — serverový proxy na `app./api/ai-chat`, **rate limit 20/min per IP**, strop promptu 800 znaků, timeout 30 s, žádný klíč v prohlížeči.
- `core/hiran/HiranChat.tsx` — rozhovor (ne v portálu: portály nesmí volat síť, hlídá to `check-boundaries`).
- manifest: `status: 'live'` + deklarovaný **write intent** `chat` (první zápis v celém kontraktu).
- Chování při spícím uzlu: `200 {offline:true}` a viditelná poznámka — ne 5xx. Ověřeno živě: inference uzel je teď offline (operátor spí), takže chat správně řekl „Hiran spí" místo chybové stránky.
- **Opravena nepravda v UI:** probe měří *gateway*, ne model — karta proto hlásí `gateway: up`, ne „online". Model může spát i při běžící gateway a UI to nemá slibovat.

### Kingdom F4b — Tržiště předává štafetu e-shopu (2026-11-01)

E-shop na marketu je **modální** (`/shop` + modal, produkty nemají vlastní URL), takže výloha v Kingdomu nemůže odkazovat na „detail produktu" — žádný neexistuje. Místo falešného detailu vede každá karta rovnou do e-shopu s **deep-linkem na kategorii**:

```
https://market.zionterranova.com/shop?category=books
https://market.zionterranova.com/shop?category=digital
```

Ověřeno: odkazy jsou v HTML, `?category=books` → **200**. Manifest to říká nahlas: „Kliknutí otevře e-shop — pokladna, platba a doprava zůstávají na marketu."

### ZIS S3 — příprava migrace konzumentů (2026-11-01)

Zjištění, které mění postup: **konzumenti nevolají ZIS přímo.** Nirvana i market mají vlastní same-origin proxy (`/api/auth/*` → ZIS) a volají **relativní** cesty. Přímé napojení na `@zion/session` by z prohlížeče znamenalo cross-origin request → CORS → a ten ZIS nemá pro `nirvana.`/`kingdom.` otevřený.

Řešení je levnější než měnit CORS: klient umí `baseUrl: ''` = relativní cesta, takže jde přes stávající proxy konzumenta. **`@zion/session` proto dostal volitelný `CallOptions.baseUrl`** na všech pěti funkcích (`getChallenge`, `verifyEd25519`, `getCurrentUser`, `listSessions`, `logout`).

> **⚠️ Pokus o migraci nirvany narazil — a to je důležitý nález.** `file:` závislost (`"@zion/session": "file:../../Kingdom/packages/session"`) v nirvaně **nefunguje**, protože:
> 1. npm vytvoří **symlink** do `Kingdom/packages/session`, což leží mimo Turbopack `root` (`apps/`) → `Module not found: Can't resolve '@zion/session'`.
> 2. Když se root rozšíří na repo (`../..`), build projde — ale **změní layout standalone výstupu** z `.next/standalone/nirvana/` na `.next/standalone/apps/nirvana/` a začne stopovat `canon/`. Tím se rozbije `deploy-nirvana.sh`.
>
> **Závěr:** S3 do legacy appky bez monorepa nejde bezpečně přes `file:` dep. Cesty, které zbývají: (a) **`npm pack` + tarball** — funguje, ale vrací do repa artefakt, který jsem právě u Kingdmu rušil; (b) **publikovat balíček** (privátní registry / GitHub Packages) — čisté, ale infrastruktura; (c) **počkat na K1**, až se appky sloučí do jednoho workspace. Změny v nirvaně jsou **revertované**, produkce běží dál na svém kódu. `CallOptions.baseUrl` v balíčku zůstává — je správný a bude potřeba.
>
> **Původní recept (pro budoucnost, až bude workspace):**

```jsonc
// apps/nirvana/package.json
"dependencies": { "@zion/session": "file:../../Kingdom/packages/session" }
```

```ts
// apps/nirvana/src/lib/zis.ts — jen adaptér, API zůstává stejné
import { SESSION_COOKIE, getCurrentUser as me, getChallenge as challenge,
         verifyEd25519 as verify, logout as out } from '@zion/session';

export const ZIS_SESSION_COOKIE = SESSION_COOKIE;
export type { ZisUser } from '@zion/session';

const local = { baseUrl: '' };                     // → /api/auth/* same-origin

export const getCurrentUser = () => me(null, local);   // cookie posílá prohlížeč
export const logout = () => out(null, local);
export const getChallenge = async (a: string) => (await challenge(a, 'zion-l1', local)).challenge;
export const verifyEd25519 = (a: string, pk: string, sig: string) =>
  verify({ address: a, publicKey: pk, signature: sig }, local).then(() => undefined);
```

Zbývá doladit jednu věc: `getCurrentUser` v balíčku čte cookie **explicitně** (server), zatímco nirvana volá z prohlížeče s `credentials: 'include'`. Adaptér proto musí předat `sessionCookie: undefined` a nechat hlavičku na prohlížeči — drobná úprava `request()`.

### K1.1 — pool-ui na Next 16 + React 19 (2026-11-01)

První appka z migrace. Byla nejmenší a nejbezpečnější: **statický export**, žádné `next/image`, žádné fonty, žádné cookies.

| Krok | Výsledek |
|---|---|
| `next` 14.2.30 → **16.4.3**, `react` 18 → **19.2.0** | `npm install` 23 s |
| `tsc --noEmit` | čistý (Next si sám přepnul `jsx` na `react-jsx`) |
| Build | **jediná reálná změna:** Next 16 vyžaduje `export const dynamic = 'force-static'` u metadata rout (`robots.ts`, `sitemap.ts`) — doplněno |
| Deploy | `deploy-pool.sh` → **site 200 / api 200**, všech 5 stránek 200 (`/stats/`, `/miner/`, `/coin/`, `/payouts/`), `/ops/` 401 = basic auth (správně) |

**Poznámka:** `trailingSlash: true` zůstává — `/stats` → 301 `/stats/` je původní chování, ne regrese.

**Zbývá (K1.1):** IntroPage, MarketPlace (security gate 1b — critical CVE), pak srovnat nirvana/OasisWeb/website-v2.9 na stejnou verzi. **S3/S4** čekají na K1.2–K1.4. kontraktní test proti živému ZIS · migrace konzumentů na `@zion/session` (market → pool-ui → nirvana → website) + sjednocení env na `ZIS_URL` · rozhodnout CSRF jednou (dnes jen MarketPlace) a doplnit `kingdom.`/`nirvana.` do CORS.

---

## 2. Měření

| Metrika | Hodnota | Jak |
|---|---|---|
| `npm install` (celý strom, 58 balíčků) | 22–28 s | lokálně |
| Produkční build (Turbopack) | **377–1 533 ms** | `next build` |
| TypeScript | 0 chyb | `tsc --noEmit` |
| Hranice | **45 souborů / 0 porušení** | `check-boundaries.mjs` |
| JS celkem (všechny chunky) | 416 KB gzip | `gzip -c` |
| největší chunk — orbit (`three`) | 237 KB gzip, **lazy jen na `/room`** | chunk split |
| chunk světů (`three` + 13 světů + kit) | **294 KB gzip**, lazy jen na `/world/<id>` | chunk split |
| zdrojový kód světů | 10 900 LOC (převzato, ne přepsáno) | `wc -l` |
| První paint Brány | bez WebGL v bundlu | `/` nemá `<canvas>` |
| Lockfileů v Kingdomu | 1 | `find` |

---

## 2b. Nasazení (EDGE2)

| Položka | Hodnota |
|---|---|
| Unit | `zion-kingdom.service` (User=zion, Node 22.23.3) |
| Bind | `127.0.0.1:3020` — ven jen přes nginx |
| Origins | **loopback**: web `:3000`, market `:3100`, pool `:8080`, oasis `:8094`, ZIS `:8096` — žádné TLS samo k sobě |
| Vhost | `kingdom.zionterranova.com`, port 80 (staged jako `api.` / `dex.`) |
| Deploy | `infra/deploy/deploy-kingdom.sh` — nový `build-<UTC>` + atomický symlink `current`, rollback = přepis symlinku |
| Paměť | **62 MB** |
| Odezva | **13–74 ms** (Brána studená 74 ms, teplá 23 ms; portál 19–44 ms; svět 13 ms) |

**Ověřeno živě na serveru, ne jen `200`:** Brána čte z loopbacku **104 200 bloků / difficulty 18 206 / 303 H/s / 57,0 s / 12 z 12 mincí**, Přístav **28 109 510 ZION** (blok 104 192), všech 7 rout včetně `/world/kailash` odpovídá `200`, journal bez chyb.

**Doména a TLS — hotovo 2026-11-01 01:50 UTC** (👤 přidal A záznam, 🤖 dojel certbot):

| | |
|---|---|
| DNS | `kingdom.zionterranova.com` → `207.180.217.100` |
| Cert | `CN=kingdom.zionterranova.com`, platí do **2027-01-30**, `certbot.timer` 2×/den |
| HTTP | 80 → 301 na HTTPS |
| Ověřeno z internetu | `/` 200 (0,44 s) · `/room` 200 (0,66 s) · `/portal/chain` 200 · `/portal/account` 200 · `/world/kailash` 200 (0,32 s) · stargate assety 200 |
| Živá data | 104 503 bloků / difficulty 3 893 / 65 H/s |

Deploy skript vhost z repa **přepisuje**, takže `Kingdom/infra/nginx/kingdom.zionterranova.com.conf`
teď obsahuje i certbotem spravované `listen 443` bloky — po renew je nutné znovu zkopírovat ze serveru.

---

## 3. Jak bylo ověřeno (a proč ne obyčejným screenshotem)

Headless screenshot WebGL canvasu v Chromiu **nevrací obsah plátna** — obrázek vyjde prázdný, i když scéna běží. Proto:

- ověření přes **CDP** (`Page.captureScreenshot` + `Runtime.evaluate`):
  `PROBE {"canvas":true,"w":1158,"h":338,"hasGL":true,"renderer":"ANGLE … SwiftShader","contextLost":false}`
- snímek potvrdil planetu s texturou, prstenec se stanicemi, Bránu, hvězdné pole i tři markery portálů.

Bez tohoto kroku by zelený build znamenal jen „kód se zkompiloval", ne „svět existuje".

---

## 4. Nálezy a pasti (zapsané do `Kingdom/AGENTS.md`)

1. **`next start` nefunguje s `output: standalone`** — v monorepu je `server.js` v `.next/standalone/apps/kingdom/`. Řešení: `apps/kingdom/scripts/start-standalone.mjs`, který stageuje `.next/static` a `public/` **vedle** `server.js`.
2. **`npm run build` za běhu serveru smaže stageovanou statiku** → textura začala vracet `500`, `Suspense` v R3F se nikdy neresolvoval a **scéna byla prázdná bez jediné chyby v logu**. Po každém buildu restartovat server (nebo znovu spustit `npm start`).
3. **R3F `useLoader` nemá `onLoad`** — třetí argument je `extensions`. `texture.colorSpace` se nastavuje po načtení.
4. **Kamera v R3F nemá `lookAt`** — bez `CameraRig` (nebo `makeDefault` + ovládání) míří podle rotace, ne na počátek. Planeta pak vypadne ze záběru.
5. **`manifest.ring` měl nirvana měřítko** (`x: 12.4`) — markery byly mimo záběr. Souřadnice srovnány na orbitu r ≈ 2,5.
6. **`document.body.style.cursor` v hoveru** je jediná DOM interakce scény — patří sem, ne do domény.
7. **Katalog světa oddělený od komponenty** — jinak si serverová stránka přitáhne three do SSR.
8. **`OrbitRig` musí stav číst z kamery každý frame**, ne z vlastní proměnné — jinak se po cinematickém intru scéna snapne zpět tam, odkud rig začal.

---

## 5. Co zůstává (F2b → F6)

| # | Úkol | Poznámka |
|---|---|---|
| ~~F2b~~ | ~~13 světů z `apps/shared/scenes`~~ | ✅ hotovo 2026-11-01 |
| **F2c** | sestup: z orbitu na povrch světa bez reloadu | dnes dvě samostatné scény (`/room` a `/world/<id>`) |
| **F3** | portály: účet, knihovna, freeworld, issobella, hiran, dao | každý manifest + typed reads |
| **F4** | write intents (podpis, checkout handoff) | market service a klíče zůstávají mimo Kingdom |
| **F5** | parita a zúžení `website-v2.9` o duplicitní povrchy | `/pool`, `/market`, `/l4-oasis`, `/explorer` |
| **F6** | apex → Brána, `pool./oasis./nirvana./freeworld./explorer.` → 301 | 🔀 + 👤 DNS |
| **F7** | engine swap za `packages/world` (UE5/Puerts) | AAA seam, mimo tento cyklus |

---

## 6. 👤 blokátory (nic z toho agent neudělá)

1. **Deploy Kingdomu na EDGE2** — `systemd` unit + nginx vhost + `certbot` (rozhodnutí 🤖: EDGE2, ne EDGE).
2. **DNS flip** apex → Kingdom = až F6, po paritě a 30 dnech redirectu.
3. **Rozhodnutí o portu** v produkci (dnes 3020 vedle website 3000 / market 3100 / nirvana 3010).
4. **Market data dluh:** 5 z 8 produktových obrázků vrací `404` (`/shop/img/digital/*.jpg`) — Kingdom je odfiltruje, ale obrázky chybí na marketu samotném.

---

## 7. Soubory a commity

| Commit | Obsah |
|---|---|
| `01888b9e5` | F0 — workspace, contract, api, i18n, ui, world, codegen, hranice, Brána+Místnost, 3 portály |
| `d7544eb53` | F1 — obsah IntroPage jako data, živý pás, sekce, kotvy |
| viz `git log` | F2a — doména světa (`rng`, `geometry`, `orbit`), `@zion/scenes` (orbit/planeta/prstenec/brána/markery), lazy `SceneHost`, scale fix manifestů |

Dokumenty: [`Kingdom/README.md`](../../../Kingdom/README.md) · [`Kingdom/ARCHITECTURE.md`](../../../Kingdom/ARCHITECTURE.md) · [`Kingdom/PLAN.md`](../../../Kingdom/PLAN.md) · [`Kingdom/AGENTS.md`](../../../Kingdom/AGENTS.md)
