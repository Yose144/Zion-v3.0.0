# ZIS Avatar — specifikace a roadmap

> Stav: **fáze 1 + 2 + upload NASAZENY na produkci** (2026-09-30);
> **fáze 4 (všech povrchů + animace) v implementaci** (2026-10-10).
> Kanonický dokument pro avatar systém ZION identity napříč ekosystémem.
> Live: `https://auth.zionterranova.com/api/auth/avatar/<seed>.svg` a
> same-origin proxy na app/oasis hostech.

## Cíl

Každý ZIS účet má **automaticky přiděleného avatara** — deterministicky
generovaný z identity uživatele, viditelný všude v ekosystému — a možnost
si ho **sám přizpůsobit / vygenerovat znovu**.

Avatar není jen dekorace: je to vizuální identita účtu v nav baru,
`/account`, DAO návrzích, L5 hlasování, OASIS hráčském profilu a všude,
kde se ZIS identita zobrazuje.

## Principy

1. **Vždy existuje avatar** — `user.avatar` může být `null`; klient pak
   použije generovaný výchozí avatar. Nikdy se nezobrazuje prázdný stav.
2. **Determinismus** — stejný seed + parametry = bitově stejný SVG.
   Avatar je funkce `(seed, variant, style)`, ne uložený soubor.
3. **Zero-storage default** — výchozí avatary se negenerují do DB ani na
   disk; renderují se on-demand jako SVG (pár KB, cacheable).
4. **Uživatel volí** — picker variant (změna seedu), volba stylu, nebo
   vlastní URL. Později: upload/NFT (fáze 3).
5. **Ekosystémový seed** — render endpoint přijímá libovolný seed string
   (user id, `zion1…` adresa, `0x…`) → stejná identita = stejný avatar
   i mimo ZIS kontext (DAO proposer, L5 voter, explorer).

## API

### `GET /api/auth/avatar/:seed.svg`

Veřejný endpoint (bez auth). Parametry query:

| Param | Default | Popis |
|---|---|---|
| `s` | `0` | variant seed (celé číslo — "regenerate" = nové `s`) |
| `t` | `sigil` | styl: `sigil` \| `rings` \| `prism` |
| `sz` | `128` | velikost viewBox (px ekvivalent), 16–512 |
| `a` | `0` | `a=1` → SMIL animace (rotace oblouků, pulz sparkle; stále deterministic) |

Response: `image/svg+xml`, `Cache-Control: public, max-age=31536000, immutable`
(URL je content-addressed parametery → agresivní cache OK).

Příklady:

```
/api/auth/avatar/<userId>.svg                    # výchozí avatar účtu
/api/auth/avatar/<userId>.svg?s=7                # varianta 7
/api/auth/avatar/zion1abc…svg                    # identita podle adresy
```

Na website-v2.9 se volá přes existující proxy `/api/auth/[...zis]` →
same-origin, žádná CORS práce.

### Persist volby uživatele

Uložení přes existující `PATCH /api/auth/me` — `avatar` = absolutní URL:

```
https://auth.zionterranova.com/api/auth/avatar/<userId>.svg?s=7&t=rings
```

Nepotřebuje změnu schématu — `avatar` už je `z.string().url().max(512)`.
`avatar = null` → klient fallback na `/api/auth/avatar/<userId>.svg`.

## Generátor

`APP&WEB/identity/src/lib/avatar.ts` — čistá funkce, bez závislostí:

- `seed → SHA-256(seed + ":" + variant + ":" + style)` → prvních N bajtů
  jako parametry + `mulberry32` PRNG.
- Paleta ZION theme: gold `#ffd700`, purple `#9333ea`, cyan `#06b6d4`,
  emerald `#10b981`, na tmavém podkladu `#0a0a14`–`#111126`.
- Styly:
  - `sigil` — geometrická mandala: prstencové oblouky + centrální hranol
    (ZION "prism" motiv), sparkles; nejvíc "ZION".
  - `rings` — koncentrické kružnice/oblouky s rotacemi (planetární).
  - `prism` — tessellované trojúhelníky (krystalický styl).
- Výstup: kompaktní SVG (~1–3 KB), žádné externí assety, žádné fonty.

## Klient

### `ZisAvatar` komponenta (website-v2.9)

```
<ZisAvatar seed={user.id} src={user.avatar} size={28} alt={displayName} />
```

Resolution order: `src` (explicit URL — včetně google picture / uložené
varianty) → `/api/auth/avatar/<seed>.svg`. On-error fallback → písmeno
initial (současné chování).

### Avatar Studio (ProfilePanel → "Avatar" sekce)

- Preview aktuálního avatara (velký).
- Mřížka 8 variant (`s=0..7`) aktuálního stylu → klik = vybrat.
- Přepínač stylu `sigil/rings/prism` → re-render mřížky.
- "Uložit" → PATCH /me s vybranou URL.
- "Vlastní URL" input (zachová existující možnost; Google avatar lze
  vrátit taky tak).
- "Reset" → `avatar=null` → výchozí generovaný.

## Integrační body (fáze)

### Fáze 1 — NASAZENO (2026-09-30)
- [x] ZIS `GET /api/auth/avatar/:seed.svg` + generátor (`src/lib/avatar.ts`),
      per-route limit 600/min, immutable cache
- [x] shared helper `zisAvatarUrl/zisAvatarAbsoluteUrl` v `zis-client.ts`
- [x] `ZisAvatar` komponenta + integrace: NavAuthButton, /account hero,
      ProfilePanel (Avatar Studio: preview + 3 styly + mřížka variant
      + vlastní URL + reset na generovaný)
- [x] zis-proxy předává upstream `Cache-Control`/`X-Content-Type-Options`
- [x] Unit testy `identity/test/avatar.test.ts` (8/8)
- [x] Deploy ZIS + website na Edge — ověřeno: SVG 200 přes veřejnou
      proxy, immutable hlavičky, 400 na nevalidní input, 8/8 G8 probes

### Fáze 2 — povrchy identity napříč weby
- [x] OasisWeb — `zisAvatarUrl` v `src/lib/zis.ts`, `ZisAvatar.tsx`,
      avatar v ZIS Identity panelu (GamePanel); nasazeno do
      `/var/www/oasis` (avatar endpoint přes nginx `/api/auth` proxy ověřen)
- [x] DAO UI — avatar proposerů/voters podle `zion1…` adresy (seed =
      adresa, žádný ZIS lookup nepotřeba): ProposalCard (footer +
      rozbalený voter list), proposal detail (proposer + voters)
- [x] L5 Free World — `QvSection` zobrazuje avatar přihlášeného votera
      (seed = `user.id`, src = `user.avatar`)
- [x] Explorer — generická Wallet ikona na `/explorer/address` →
      deterministický avatar adresy; richlist + miners leaderboard řádky
- [x] Pool miner dashboard `/pool/miner/<addr>` — avatar v hlavičce
- [ ] NotificationsPanel / další místa ukazující identitu (nizko-prioritní —
      vlastní notifikace identitu nezobrazují)

### Fáze 3 — pokročilé
- [x] Custom upload — `POST /api/auth/avatar/upload` (auth, raw body
      `image/png|jpeg|webp|gif` ≤256 KiB, magic-byte validace; uloží se do
      `AvatarAsset` bytea a `user.avatar` se nastaví na veřejnou
      `/api/auth/avatar/u/<userId>` URL atomicky), `GET /avatar/u/:userId`
      (public, ETag, `max-age=300`), `DELETE /avatar/upload` (smaže asset +
      avatar → fallback na generovaný). Avatar Studio má tlačítko
      „Nahrát obrázek" (applied okamžitě, bez Save). Resize se nedělá —
      limit velikosti řeší payload, prohlížeč škáluje.
- [ ] OASIS NFT avatary (on-chain ownership → `avatar` URL na token art)
- [ ] 3D/animated avatar varianty pro OASIS world

### Fáze 4 — všude, kde žije identita (2026-10-10)
- [x] **Desktop agent** — profil řádek v ZIS sekci (avatar + displayName +
      adresa), mini Avatar Studio (styly + mřížka 8 variant + Use Selected
      → `PATCH /me`, Reset), dock-bar avatar chip (celoappkově viditelný,
      klik → Settings); IPC `zis-update-me` + `zis-avatar-url`,
      `zis-get-session` vrací i `avatarUrl` (explicit avatar → generovaný
      fallback)
- [x] **Mobile app** — `ZisAvatar` RN komponenta (`SvgUri` pro generované
      SVG, `<Image>` pro uploadované rastery); proposer avatar + adresa
      v DAO screen kartách (seed = `proposal.proposer`, bez auth)
- [x] **Animované avatary** — query `a=1` → SMIL (`animateTransform`
      rotace skupin, `<animate>` pulz sparkles/facet lines); deterministic
      timingy, žádný script → bezpečné ve veřejném renderu, fungují
      i uvnitř `<img>`; helpery `zisAvatarUrl/…AbsoluteUrl` mají opt `a`,
      desktop `avatarUrl` + mobile `zisAvatarUrl` taky
- [ ] ZION_OS dashboard — miner/worker avatary (python dashboard,
      `zis_user` z pool API jako seed)
- [ ] MarketPlace — prodávající/kupující avatar (seed = adresa)

### Fáze 5 — konceptuální (design pending)
- [ ] OASIS NFT avatar binding — vlastník OASIS avatar NFT (MarketPlace
      `ZIONArtifact`, `notifyAvatarMint` flow už existuje) si může
      nastavit token art jako `user.avatar`. Potřebuje: ownership proof
      čtení z chainu (EVM `ownerOf` / L1 registry) → ZIS endpoint
      `POST /api/auth/avatar/nft` {contract, tokenId} → verify → PATCH.
      Do té doby jede přes existující „vlastní URL" cestu.
- [ ] 3D avatar — OASIS `AvatarConfig` (callsign/bodyType/neonColor/
      augmentation) × ZIS avatar (sigil jako chest emblem / neonColor z
      avatar palety); animované varianty (`a=1`) jako in-world hologram
- [ ] NotificationsPanel — až bude zobrazovat cizí identity

## Poznámky

- SVG je bezpečné k servírování veřejně (žádný script tag, čistý markup;
  Content-Type `image/svg+xml` + `X-Content-Type-Options: nosniff`).
- Seed je libovolný string — útočník může generovat SVG pro cizí seed,
  ale to je neškodné (deterministický obrázek, žádná data účtu).
- Pro proxy cache doporučujeme URL neměnit — varianta je v query, takže
  nová volba = nová URL = čistá cache.
