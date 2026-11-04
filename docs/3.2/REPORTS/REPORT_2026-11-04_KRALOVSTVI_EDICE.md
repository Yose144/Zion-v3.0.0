# Království srdce — ediční sada 40 knih + napojení na e-shop

**Datum:** 2026-11-04
**Rozsah:** `canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ/` (sazba), `apps/MarketPlace/` (produkt `book-001`), `scripts/ops/` (nástroje), nginx na EDGE2
**Stav:** hotovo, nasazeno, ověřeno živě

---

## 1. Co je hotové

Osm samostatných edic téhož příběhu, každá v pěti jazycích, každá jako PDF i EPUB.

| Edice | CZ | EN | ES | FR | PT |
|---|---|---|---|---|---|
| Nová plavba (ilustrovaná) | 95 | 101 | 101 | 102 | 101 |
| Klasická | 29 | 36 | 36 | 37 | 35 |
| Cedrový kýl | 82 | 100 | 98 | 104 | 98 |
| Gemini | 136 | 151 | 153 | 155 | 153 |
| GPT | 48 | 54 | 55 | 55 | 55 |
| Groq | 48 | 50 | 49 | 51 | 49 |
| Quen | 42 | 46 | 45 | 45 | 45 |
| DeepSeek | 113 | 125 | 123 | 128 | 123 |

**Součty:** 40 knih (80 souborů PDF+EPUB) · **3 252 stran** · **619 498 slov** rukopisů · **0 chyb v XML** ve všech 40 EPUB.

Počty slov po edicích (CZ → EN/ES/FR/PT):

| Edice | CZ | EN | ES | FR | PT |
|---|---|---|---|---|---|
| Cedrový kýl | 15 338 | 19 804 | 19 199 | 20 487 | 18 210 |
| DeepSeek | 22 986 | 28 075 | 27 280 | 29 130 | 26 196 |
| Gemini | 24 863 | 32 932 | 32 517 | 33 270 | 30 460 |
| GPT | 6 435 | 8 450 | 8 104 | 8 888 | 7 826 |
| Groq | 7 441 | 9 977 | 9 633 | 10 170 | 9 158 |
| Klasická | 5 220 | 6 745 | 6 650 | 6 993 | 6 348 |
| Quen | 5 903 | 7 500 | 7 354 | 8 047 | 7 113 |
| Nová plavba | 13 880 | 17 995 | 17 315 | 18 741 | 16 865 |

Struktura adresáře:

```
canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ/
├── CZ/ EN/ ES/ FR/ PT/          vlajková ilustrovaná edice (produkt)
└── EDITION/
    ├── 00-INDEX.md              pravidla, pojmenování, výhrady edic
    ├── 00-STAV.md               generovaná matice edic × jazyků
    ├── _scripts/build_edition.py   sazební toolchain
    ├── klasicka/ cloude/ gemini/ gpt/ groq/ quen/ deepseek/
    │   └── CZ/ EN/ ES/ FR/ PT/   rukopis + PDF + EPUB + kontrola.json
    └── 00-nova-plavba/           rozcestník k vlajkové edici
```

---

## 2. Sazební toolchain

`EDITION/_scripts/build_edition.py` — PEP 723 skript, spouští se přes `uv` (žádný pandoc ani reportlab na stroji):

```bash
cd EDITION
uv run _scripts/build_edition.py                 # všechny edice
uv run _scripts/build_edition.py --only quen     # jedna edice
uv run _scripts/build_edition.py --only gemini --lang ES
uv run _scripts/build_edition.py --status        # jen přepočítat 00-STAV.md
```

Co dělá:

- **Markdown → PDF** (A5 148×210 mm, Georgia s fallbackem na Arial Unicode) a **Markdown → EPUB** s navigačním `nav.xhtml`.
- **Automatický obsah s čísly stran.** Po vysázení zkusí 1–8 stran obsahu, dokud čísla nesedí; když se to nepodaří, skončí chybou (žádná tichá nepravda).
- **Lokalizované názvy** edic a datum (`edition_label()`), aby anglická kniha neměla český štítek.
- **Zvládá češtinu, španělštinu, francouzštinu i portugalštinu** včetně nabodeníček (ﬁ ligatury, `‑` zlomy).
- **Vynechává** soubory začínající `_` (rozpracované) nebo `00-` (rejstřík) — do produktu se nedostanou.
- **`kontrola.json`** u každé knihy: slova, nadpisy, odstavce, strany, dokumenty, datum — strojově čitelný otisk sazby.

Každá kniha se staví z vlajkového Markdownu, který zůstává v adresáři vedle produktu, takže je vždy dohledatelné, z čeho PDF vzniklo.

---

## 3. Co se v této práci opravilo

### 3.1 Cedrový kýl byl prostý text bez jediného nadpisu

Nejvážnější nález. Zdroj `cloude/CZ` byl holý text — kniha neměla obsah, kapitoly ani tabulky, `Kotva pravdy` se sázela jako hromada řádků. Redakce do Markdownu:

- **28 kapitol ve třech částech**, prolog, epilog, poznámka o štítcích, slovníček
- tabulky `Kotva pravdy` převedeny na skutečné dvousloupcové tabulky
- **dvě kapitoly za číslem 26 měly duplicitní čísla 24 a 25** → přečíslováno na 27 a 28
- z textu vyhozeno 5 produkčních poznámek „(Před tiskem ověřit …)“
- interní „Redakční poznámky (ne pro tisk)“ a „Kontrola proti korpusu“ přesunuty do `_redakcni-poznamky.md` (mimo sazbu, obsah zachován)
- v konfiguraci sazby zapnut obsah

Výsledek: 82 stran místo 69, s obsahem a čísly stran.

### 3.2 Drobné vady v hotových edicích

| Edice | Vada | Oprava |
|---|---|---|
| Groq (CZ+EN) | podpisová linka obalená backticky → v PDF se vykreslila jako řada hvězdiček | nahrazena typografickou linkou |
| Groq (CZ+EN) | holé `&nbsp;` entity se tiskly jako text | odstraněny |
| GPT (CZ) | za replikou Krišny zůstal artefakt `f7` | odstraněn |
| Cedrový kýl (CZ) | po převodu tabulek zůstaly dva řádky slovníčku mimo tabulku a vznikl falešný nadpis `### Příběh` | vráceno do tabulky |

### 3.3 Oprava v e-shopu: textový e-mail neměl odkaz

`formatDigitalDownloadsHtml()` existoval, ale **textová varianta e-mailu odkaz neobsahovala** — zákazník s textovým klientem nedostal nic. Doplněn `formatDigitalDownloadsText()`; ověřeno renderem skutečné šablony (HTML ✔, text ✔, nadpis „Digitální stažení“ ✔) a potvrzeno i v nasazeném bundlu.

---

## 4. Napojení na e-shop

### 4.1 Co bylo špatně

Produkt `book-001` („Království srdce — digitální kniha“, 216 Kč, `digital: true`) měl **`filesUrl` prázdné**. Objednávka se vytvořila, e-mail přišel, ale odkaz na stažení nikde. Popis navíc sliboval „10 kapitol + epilog, PDF“, což po dokončení sady přestala být pravda.

### 4.2 Co je teď

- **ZIP s celou sadou:** 8 edic × 5 jazyků, PDF i EPUB, uvnitř `00-README.txt` (co která edice je, jak číst) a `00-STAV.md`.
- **82 položek, 65 250 857 B**, sha256 `6bce6c1435251f17bb3bdc350096c205448900a01a34a5c8859128c1e07c3f49`.
- `filesUrl` = `https://market.zionterranova.com/shop/downloads/Kralovstvi_srdce_kompletni_edice_5_jazyku.zip` (v DB i v `shopProducts.ts`).
- Popis a `size` přepsány na „40 knih, 5 jazyků, přes 3 200 stran“.

### 4.3 Řetěz, kterým soubor k zákazníkovi jde

```
scripts/ops/build-kralovstvi-bundle.py --upload
   └─ sestaví ZIP z canon/ stromu
   └─ scp na EDGE2:/opt/zion/data/downloads/
   └─ chown zion + chmod 644
   └─ hned ověří HTTP

nginx (market.zionterranova.com.conf)
   └─ location /shop/downloads/ { alias /opt/zion/data/downloads/; }

zákazník
   └─ objednávka → /api/shop/orders převezme filesUrl z produktu
   └─ e-mail (HTML i text) → sekce „Digitální stažení“ s odkazem
```

### 4.4 Proč ZIP neleží ve stromu aplikace

Deploy MarketPlace dělá `rsync --delete` přes app root. ZIP v `public/` by při deployi **z jiného klonu** (kde 65 MB binárka v gitu záměrně není) zmizel — a odkazy v **už odeslaných e-mailech** by přestaly fungovat. Proto je kanonické místo `/opt/zion/data/downloads/`, mimo dosah rsyncu.

Kopie v `public/shop/downloads/` zůstává jako **druhá záloha**: kdyby někdo nginx location odebral, Next ji začne servírovat sám.

Ověřeno reálně: obě kopie v app stromu dočasně přejmenovány → odkaz dál vracel **200 a 65 250 857 B**.

---

## 5. Ověření

### 5.1 Sazba

U každé z 40 knih:

- **EPUB:** všechny `*.xhtml`, `*.opf`, `*.xml` se parsují → 0 chyb
- **PDF:** počet stran odpovídá, obsah s čísly stran ověřen proti skutečným stranám (namátkou kap. 1 na str. 10, `Anchor of truth` na str. 12)
- **0 zbloudilých hvězdiček** (kontrola na překlepy v markdownu, které prosakují do sazby)
- tabulky se sázejí jako skutečné dvousloupcové tabulky

### 5.2 ZIP

Stažený z živého odkazu, ne jen z disku:

- `sha256` staženého souboru **shodný** s lokálně sestaveným
- `testzip` → žádný poškozený záznam
- **40 PDF** začíná `%PDF`, **40 EPUB** se otevře a všechno XML uvnitř se parsuje

### 5.3 Jeden příkaz na kontrolu celého řetězu

```bash
bash scripts/ops/verify-market-downloads.sh
```

```
== 1. Produkt book-001 ==
  ✅ filesUrl = https://market.zionterranova.com/shop/downloads/Kralovstvi_srdce_kompletni_edice_5_jazyku.zip
  ✅ odkaz odpovídá očekávanému souboru
== 2. Stažení ==
  ✅ HTTP 206
  ✅ Content-Length 65250857 B (65 MB)
== 3. Obsah ZIPu ==
  ✅ 40 PDF + 40 EPUB, archiv bez poškození
VŠE OK — produkt dodává soubor, odkaz žije.
```

### 5.4 Živé povrchy po nasazení

`/`, `/shop`, `/shop?category=books`, `/cart`, `/api/health` → **200**; DB 6 ms; `zion-marketplace.service` active.

---

## 6. Pojistky proti souběžné session

V repu pracuje víc session najednou a MarketPlace je sdílený povrch. Tři strukturální opatření:

1. **Stažení nezávisí na stromu aplikace** — viz §4.4. Deploy z jakéhokoli stromu odkaz nerozbije.
2. **Deploy už neblokuje cizí session.** Původní guard „bez `public/shop/downloads/` nenasazuj“ by zastavil deploy z klonu bez 65 MB binárky — tedy právě tu druhou session. Změněno na **varování** + po restartu deploy **ověří, že odkaz vrací 200/206**, a když ne, spadne nahlas.
3. **Re-seed nesmaže `filesUrl`.** `/api/shop/seed` i `prisma/seed.ts` posílají `filesUrl` jen když ho katalog zná; `undefined` pole nechá být, `null` by odkaz smazalo.

Navíc: nginx location je zazálohovaná i v repu (`infra/nginx/edge2/market.zionterranova.com.conf`, `infra/nginx/edge-current/…`), aby se při obnově vhostu neztratila.

---

## 7. Pasti, na které jsme narazili

| Past | Projev | Řešení |
|---|---|---|
| **Next 16 načítá `public/` při startu** | soubor přidaný za běhu → 404 i na `127.0.0.1:3100`, přitom na disku je | restart služby (deploy ho dělá; ruční přidání souboru ne) |
| **`rsync --delete` přes app root** | ZIP v `public/` smazán deployem z jiného klonu → mrtvé odkazy v e-mailech | ZIP mimo app root (`/opt/zion/data/downloads/`) |
| **`.gitignore` + server** | adresář v gitu není, na serveru být musí | `--upload` v bundle skriptu + verify skript |
| **`rsync` přenáší 600** | ZIP čitelný jen pro ownera | `chmod 644` v deployi i v uploadu |
| **`.bak` soubory v `sites-enabled/`** | nginx je parsuje (include glob `*`) → `conflicting server name` | zálohy patří do `/etc/nginx/backups/` (v repu opraveno; na serveru zůstávají cizí) |
| **dlouhé heredocy v shellu** | „Portable shell scanner cannot analyze command: heredoc“ | psát po částech přes `write` a `cat >>` |

---

## 8. Meze — co sada NEDÁVÁ

Poctivě, aby se to nedalo přehlédnout:

- **Žádná lidská korektura.** Texty jsou vysázené a technicky ověřené (XML, strany, odkazy), ale neprošly jazykovou redakcí rodilého mluvčího. U překladů je to znát nejvíc — vznikaly překladem z češtiny, ne psaním v cílovém jazyce.
- **Chybí ISBN a tiráž.** Komerční kniha je mít má; tady jsou to zatím „prodejní rukopisy“.
- **Ilustrovaná edice** je z původního balíčku — sazební toolchain ji nesází, jen ji přebírá.
- **Cedrový kýl** prošel redakcí do Markdownu (struktura, tabulky, číslování), ale obsah jsem needitoval — text zůstal autorův.
- **`raster.py`, `find.py`, `check2.py`** (pomocné kontroly sazby) žijí jen v dočasném adresáři, ne v repu.
- **Kontrola obsahu proti skutečným stranám** byla namátková, ne u všech 40 knih.
- **Obálky** jednotlivých edic nejsou sjednocené — u PDF/EPUB je titulní strana typografická, produkty v e-shopu mají vlastní obrázky.
- **ZIP má 65 MB.** Na mobilních datech je to znát; kdyby to vadilo, jde udělat druhá, lehká varianta bez ilustrované edice (~14 MB).

---

## 9. Jak s tím pracovat dál

```bash
# Přestavět jednu edici / jeden jazyk
cd canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ/EDITION
uv run _scripts/build_edition.py --only quen --lang FR
rm -rf _scripts/__pycache__

# Přestavět celou sadu a nahrát ZIP na server
cd /Users/yeshuae/Projects/2.9.6
python3 scripts/ops/build-kralovstvi-bundle.py --upload

# Ověřit, že produkt skutečně dodává
bash scripts/ops/verify-market-downloads.sh

# Nasadit MarketPlace
bash apps/MarketPlace/deploy/deploy-marketplace.sh
```

Po každé změně rukopisu je potřeba **znovu sestavit ZIP** — jinak zákazník dostane starou verzi.

---

## 10. Commity

| Commit | Obsah |
|---|---|
| `9c9c2e1c7` | quen ES |
| `068bed919` | quen FR |
| `f4a368f26` | quen PT (Quen kompletní) |
| `93dba0875` | groq EN + oprava podpisové linky a `&nbsp;` |
| `f8313a640` | groq ES |
| `c9ada1c18` | groq FR |
| `5b329b0d0` | groq PT (Groq kompletní) |
| `b8fc4d88f` | gpt EN + artefakt `f7` |
| `d08c3b262` | gpt ES |
| `c70d4ef72` | gpt FR |
| `f7c4a1951` | gpt PT (GPT kompletní) |
| `a853b597f` | gemini ES rozpracováno |
| `e817e5697` | gemini ES hotový |
| `1d858ad50` | gemini FR |
| `c832cd0d3` | gemini PT (Gemini kompletní) |
| `cbce373f9` | Cedrový kýl načleněn do Markdownu + obsah |
| `3c90b78d3` | cedrový kýl EN + oprava slovníčku |
| `c88c991ec` | cedrový kýl ES |
| `5adae4a18` | cedrový kýl FR |
| `a6cc1f41d` | cedrový kýl PT (sada kompletní) |
| `7676389be` | market: ZIP k produktu, popis, textový e-mail, guard |
| `c19832d72` | market: práva ZIPu 644 v deployi |
| `68546d11a` | market: stažení mimo app root, seed neclobberuje, verify skript |
| `0e4e7f9cd` | infra: nginx location v repu |
