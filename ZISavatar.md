# ZIS Avatar — specifikace a roadmap

> Stav: **specifikace → fáze 1 implementována** (2026-09-30).
> Kanonický dokument pro avatar systém ZION identity napříč ekosystémem.

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

### Fáze 1 — hotovo při tomto tasku
- [x] ZIS `GET /api/auth/avatar/:seed.svg` + generátor
- [x] shared helper `avatarUrl(seed, {s,t,sz})` v `zis-client.ts`
- [x] `ZisAvatar` komponenta + integrace: NavAuthButton, /account hero,
      ProfilePanel (studio)
- [ ] Deploy ZIS + website na Edge, verify

### Fáze 2 — povrchy identity napříč weby
- [ ] OasisWeb (ZIS auth tam už je — AuthContext+zis.ts) — avatar v
      profilu/hráčském panelu
- [ ] DAO UI — avatar proposerů/voters podle `zion1…` adresy (seed =
      adresa, žádný ZIS lookup nepotřeba)
- [ ] L5 Free World — `voter_id = zis:<id>` → avatar ballotů
- [ ] NotificationsPanel / další místa ukazující identitu

### Fáze 3 — pokročilé
- [ ] Custom upload (vyžaduje storage — Edge nedisponuje object storage;
      možnosti: malý data-URI limit, nebo dedikovaný `/api/avatar/upload`
      s resize+store do Postgres `bytea`)
- [ ] OASIS NFT avatary (on-chain ownership → `avatar` URL na token art)
- [ ] 3D/animated avatar varianty pro OASIS world

## Poznámky

- SVG je bezpečné k servírování veřejně (žádný script tag, čistý markup;
  Content-Type `image/svg+xml` + `X-Content-Type-Options: nosniff`).
- Seed je libovolný string — útočník může generovat SVG pro cizí seed,
  ale to je neškodné (deterministický obrázek, žádná data účtu).
- Pro proxy cache doporučujeme URL neměnit — varianta je v query, takže
  nová volba = nová URL = čistá cache.
