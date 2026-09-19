# Satoshi Nakamoto — Forenzní analýza „zamčeného" majetku (~1,1M BTC)

> **Datum:** 2026-09-19 · **Autor:** Devin (autonomní research) · **Účel:** Zmapovat všechna veřejně dostupná data, primární zdroje a forenzní studie týkající se mincí připisovaných Satoshimu a zhodnotit, zda existuje jakákoliv veřejná stopa/nápověda vedoucí k privátním klíčům.
>
> **⚠️ Etický rámec:** Tento dokument je deskriptivní forenzní analýza veřejných dat. Nejde o návod k převzetí cizích mincí. BTCunlock je nástroj pro recovery **vlastních** walletů — viz závěr.

---

## 1. TL;DR — Závěr předem

| Otázka | Odpověď |
|---|---|
| Existuje veřejná „nápověda" k Satoshiho klíčům? | **Ne.** Po kompletním průchodu všech veřejných archivů (200+ emailů, 539 fórových postů, zdrojový kód, leaknuté účty) neexistuje jediný veřejný artefakt obsahující privátní klíč, seed, nebo dekódovatelnou nápovědu. |
| Jsou mince technicky „zamčené" protokolem? | Jen částečně — **genesis block 0** (50 BTC) je strukturálně unspendable. Zbytek ~1,1M BTC jsou normální P2PK coinbase výstupy — spendable, pokud existují klíče. |
| Lze klíče vypočítat / brute-forcenout? | **Ne.** ECDSA secp256k1, ~2^256 prostor. Žádná známá slabina v generování klíčů éry (Windows + OpenSSL/CryptoAPI). |
| Pomůže BTCunlock (GPU mnemonic)? | **Ne a to je klíčový technický závěr** — Satoshi éra **předchází BIP39** (2013) i BIP32 (2012). Jeho klíče jsou surové ECDSA keypairs v `wallet.dat` (Berkeley DB). Mnemonic seed pro ně **neexistuje** — není co hledat. |
| Jediná reálná recovery cesta? | Fyzický `wallet.dat` soubor (nebo záloha) ze Satoshiho stroje/backups z 2009–2010. Pravděpodobně **nešifrovaný** (wallet encryption přišel až v0.4.0, září 2011 — po jeho odchodu). |

---

## 2. Inventura „zamčených" mincí

### 2.1 Genesis block (block 0) — unspendable by design

| | |
|---|---|
| **Adresa** | `1A1zP1eP5QGe...` (`1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`) |
| **Coinbase zpráva** | `The Times 03/Jan/2009 Chancellor on brink of second bailout for banks` |
| **Subsidy** | 50 BTC — **strukturálně unspendable**: genesis coinbase není v UTXO setu (Bitcoin Core ho skipuje; bug/záměr dodnes sporný) |
| **Pozdější donace** | Adresa dostává „tribute" posílky — dnes ~68+ BTC celkem. Tyto pozdější P2PKH výstupy **jsou** spendable, ale vyžadují genesis privkey |
| **Folklór** | Hash genesis bloku má 10 leading hex zeros (era vyžadovala 8) — spekulace o „extra work", nikdy nedokázáno; hex dump coinbase obsahuje Times headline obráceně — pareidolia, ne zpráva |

### 2.2 Patoshi pattern — ~1,1M BTC (jádro problému)

Sergio Demián Lerner (bitslog.com, 2013→2019→2020 série analýz) identifikoval jediného dominantního minera let 2009–2010 podle **ExtraNonce** patternu:

| Fakt | Hodnota |
|---|---|
| Připsaných bloků | **~22 503** (z ~54k bloků éry) |
| Odhadovaný objem | **~1,1M BTC** (50 BTC/block) |
| Utráceno | **99,9% neunspent** — pouze ~2–3 coinbase výstupy se kdy pohnuly |
| Identifikace | LSB nonce omezeno na `[0..9] ∪ [19..58]` (~50/256 hodnot), ExtraNonce jako „realtime clock", zero timestamp inversions mezi Patoshi bloky (jeden PC, jeden čas) |
| HW závěr (Lerner 2020) | Single high-end CPU, multi-thread — **ne** farma strojů; 5 paralelních nonce subranges = threading pattern |
| Důvěryhodnost | „Probabilistically falsifiable" — nejsilnější dostupná blockchain forenzika, ale **heuristika, ne kryptografický důkaz** |

**Potvrzené Patoshi spendy** — jen hrstka:
- **Block 9 coinbase** → block 170: **10 BTC Halu Finneymu** (první P2P transakce v historii, leden 2009). Zbytek 40 BTC change zůstal na `12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S` — untouched.
- Lerner odhaduje celkem ~100 BTC (≈2 block rewards) utracené z celého patternu.

### 2.3 Incident blok 3654 (květen 2020) — kontrolní případ

50 BTC z coinbase bloku 3654 (9. 2. 2009) se 20. 5. 2020 poprvé pohnulo → trh −7%, panika „Satoshi prodává". **Lerner: blok 3654 NENÍ v Patoshi patternu.** Důkazní standard: absence patternu + jiní early mineři existovali (block 12 = první non-Satoshi miner). Poučení: „staré + dormant ≠ Satoshi".

### 2.4 Co se často plete (false positives)

| Adresa/cluster | Skutečnost |
|---|---|
| `1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF` (79 956 BTC) | Mt.Gox theft 2011 — **ne Satoshi** |
| Craig Wright „Tulip Trust" seznam ~16 000 adres | COPA v. Wright [2024] EWHC 1198 — soud: **Wright není Satoshi**, dokumenty „forged on a grand scale" |
| 464 coinbase UTXOs z prvních 10k bloků mimo Patoshi pattern | Early mineři: Hal Finney, Martti Malmi, Dustin Trammell, NewLibertyStandard… — cizí dormant coiny, ne Satoshi |
| „Satoshi's Treasure" hunt (2019) | Marketingová hra — žádná vazba na reálné klíče |

---

## 3. Jaké klíčové materiály existují — technická realita éry

### 3.1 Satoshiho wallet architektura (v0.1.x, 2009–2010)

```
wallet.dat  (Berkeley DB)
└── mapKeys: pubkey → raw 256-bit ECDSA privkey   ← ŽÁDNÝ seed
    - CKey::MakeNewKey() = OpenSSL EC_KEY_generate_key(NID_secp256k1)
    - Fresh key pro každý coinbase (key-per-block by design)
    - Šifrování: ŽÁDNÉ (až v0.4.0, 23. 9. 2011)
```

**Implikace:**
- **BIP39 mnemonics neexistují** — standard publikován září 2013. HD derivace (BIP32) 2012. Satoshi neměl seed phrase; měl soubor plný nezávislých náhodných klíčů.
- Každý z ~22 503 Patoshi coinbase výstupů je **P2PK** (pay-to-pubkey) — pubkey je už dávno veřejný v blockchainu. Jediné tajemství = skalár privkey.
- `wallet.dat` z éry byl **plaintext BDB** — kdo má soubor, má všechno. Encryption přišel až po odchodu Satoshiho (a první implementace 0.4.0/0.5 měla navíc bug CVE-2011-4447 nechávající část klíčů nešifrovaných).

### 3.2 RNG kvalita éry

- Windows buildy používaly OpenSSL seeding + `RAND_screen()` (entropie z pixelů obrazovky) + CryptoAPI.
- **Debian OpenSSL bug (2008–2010)** produkoval ~32k predikovatelných klíčů — ale postihl jen Debian/Ubuntu systémy. Satoshi buildil MingW32/Windows (důkaz: PGP `GnuPG v1.4.7 (MingW32)`, v0.1 jen pro Windows) → pravděpodobně **nepostižen**.
- Žádná známá slabina v `EC_KEY_generate_key` éry → klíče jsou plných ~2^256.

### 3.3 ECDSA nonce vektor — mrtvý

Nonce-reuse/nonce-bias útoky vyžadují **≥2 podpisy ze stejného pubkey** nebo známý bias generátoru. Satoshi publicně podepsal ~2–3 transakce celkem (block-9 spend + pár dalších) — **nedostatečný vzorek**. Každý coinbase = nový pubkey = izolovaný problém.

---

## 4. Kompletní inventura veřejných Satoshi artefaktů

Hodnocení sloupce „Key material?" — obsahuje artefakt privkey/seed/dekódovatelnou nápovědu?

| # | Artefakt | Datum | Zdroj | Key material? |
|---|---|---|---|---|
| 1 | Whitepaper `bitcoin.pdf` | 2008-10-31 | bitcoin.org / metzdowd | Ne |
| 2 | Zdrojový kód v0.1.0–0.3.19 (SourceForge) | 2009–2010 | sourceforge + github mirror | Ne — žádné embedded keys |
| 3 | Metzdowd Cryptography list emails | 2008-10→11 | metzdowd.com archive | Ne |
| 4 | **Bitcointalk posty** (~539) | 2009-11→2010-12 | bitcointalk.org | Ne |
| 5 | **Malmi email archiv** (~200 emailů) | 2009-05→2011-02 | mmalmi.github.io/satoshi (2024 COPA release) | Ne — jen infra hesla (viz 4.1) |
| 6 | Hearn emails (publikované) | 2011-04 | pastebin / bitcoin-institute | Ne — „moved on to other things" |
| 7 | Gavin emails — alert key handover | 2011-04-26 | bitcoin-institute | **Alert key ≠ wallet key** (network alert signing key, žádná hodnota) |
| 8 | PGP public key `1024D/5EC948A1` | 2008-10-30 | pgp keyservers, bitcoin.org | Jen pubkey; DSA-1024 — historicky slabý, ale to je jeho *podpisový* klíč, ne wallet |
| 9 | Poslední email Malmi/Gavin — PGP-encrypted mailman password | 2011-02-22 | mmalmi.github.io | Šifrovaný blob pro příjemce — obsah = mailman admin heslo, ne BTC |
| 10 | bitcoin.org doména | 2008-08-18 | anonymousspeech.com registrace | Ne |
| 11 | GMX účet `satoshin@gmx.com` | hack 2014-09-08 | BitMEX Research | Ne — ~11k inbox většinou spam; early maily smazané ~2011 |
| 12 | SourceForge účet | defaced 2014-09 | — | Ne |
| 13 | P2P Foundation účet — „I am not Dorian Nakamoto" | 2014-03-07 | p2pfoundation.ning.com | Ne; autenticita sporná (2016 login → pravděpodobný kompromis) |
| 14 | Genesis coinbase zpráva | 2009-01-03 | blockchain | Politický timestamp, ne klíč |
| 15 | Lopovu knihovna/books? | — | — | Žádné veřejné materiály |

### 4.1 Hesla v Malmi archivu — jediné „credentials" v celém korpusu

Archiv obsahuje doslova hesla — ale pozor na atribuci:

| Heslo | Kontext | Čí je? |
|---|---|---|
| `Wubreches3eS` | WordPress `bitcoin.sourceforge.net` admin (email #9), reused pro Bitweaver (#17 „again") i TikiWiki VPS (#88) | **Malmiho** — on ty systémy instaloval; reuse pattern je jeho, ne Satoshiho |
| `EaG3nHLL` / `sNKgyt4W` / `Mz589ZKf` | MySQL `b244765_*` (ro/rw/admin) | **SourceForge-generované** — Satoshi je jen forwardoval |
| PGP bloby (email #199) | Mailman admin heslo, šifrované zvlášť pro Gavina i Marttiho | Satoshi vytvořil, ale obsah je server credential |

**Závěr 4.1:** V celém dokumentovaném korpusu není jediný password, který by Satoshi sám zvolil a který by se vztahoval k walletu. Malmiho reuse zvyk (`Wubreches3eS` ×3) je jediný pozorovatelný „password style" — a není Satoshiho.

### 4.2 Co Satoshi sám řekl o ztrátě klíčů — přímé citace

> **„Lost coins only make everyone else's coins worth slightly more. Think of it as a donation to everyone."**
> — bitcointalk „Dying bitcoins", 21. 6. 2010

> **„Yes, as long as you make backups of your coin keys, protect them with strong passwords and keep keyloggers away from your computer. If you lose your key or if some unknown attacker manages to unlock it, there's no way to get your coins back. If you have a large amount of coins, it is recommended to distribute them under several keys."**
> — Satoshi → Malmi, email (květen 2009)

> **„Definitely. This will be an absolutely essential feature once things get going, making it so you can lock your wealth up with strong encryption and back it up more securely than any physical safe. So far I've been putting it off in favour of other features because it's not crucial yet until bitcoins start to have value."**
> — Satoshi → Malmi, 3. 5. 2009 (reakce na návrh password-protected keys)

**Čtení:** Satoshi považoval backup+encryption za esenciální už v květnu 2009 — ale encryption do kódu nikdy nedodělal. „Distribute under several keys" se shoduje s key-per-coinbase chováním (každý blok nový klíč). Jeho poslední éra postoj (červen 2010) zní jako přijetí, že ztracené coiny jsou donací — konzistentní s tím, že svůj stash nikdy nepohnul.

---

## 5. Proč mince nikdy nepohnuly — teorie seřazené podle podpory

| Teorie | Podpora v datech | Hodnocení |
|---|---|---|
| **Záměrná nečinnost / „endowment"** | Donation quote; systematická opsec disceplina (žádný leak identity za 17 let); vědomí, že jakýkoliv pohyb = tržní panika + deanonymizace | **Nejkonzistentnější** — chování = „vytvořil a odešel" |
| **Klíče zničeny záměrně** | Nulový pohyb i přes $100B+ hodnotu; poslední akty = handover (alert key, mailman, domény) = uzavřené účty | Silná — ale nedokazatelná |
| **Smrt držitele** | Len Sassaman † 3. 7. 2011 — 68 dní po posledním emailu (26. 4. 2011); timing + cypherpunk profil (Hatch 2021). Hal Finney † srpen 2014 (ALS — nemohl už od ~2009–10 psát kód podle vlastních slov, ale emailoval s Satoshim jako s *třetí osobou*) | Spekulativní; žádný primární důkaz; Patterson ani rodina nepotvrdili |
| **Klíče ztraceny** (disk failure bez backupu) | Satoshi sám varoval před touto exaktní scénářovou rizikem | Ironic, možné — ale odporuje jeho prokázané backup gramotnosti |
| **Dead-man switch / escrow** | Žádný veřejný mechanismus nalezen; žádná timelocková transakce | Nedokazatelné, žádná podpora |
| **„Satoshi je skupina, klíče rozpuštěné"** | Multi-person hypotézy (Finney+Sassaman další) | Neslučitelné s Lernerovým single-machine/single-clock závěrem Patoshi miningu |

---

## 6. Útočné/recovery vektory — co je reálně možné

| Vektor | Proveditelnost | Poznámka |
|---|---|---|
| Brute-force privkey | ❌ | 2^256 prostor; ~2^128 efektivní pro ECDLP. „Computers have to get about 2^200 times faster" (Satoshi sám, 2010) |
| **Mnemonic/seed brute-force (BTCunlock)** | ❌ **N/A** | Satoshi neměl mnemonic — pre-BIP39. Náš GPU pipeline se na jeho coiny **nevztahuje** |
| ECDSA nonce reuse | ❌ | ~2–3 podpisy celkem, každý coinbase jiný pubkey |
| Weak-RNG (Debian bug) | ❌ | Satoshi = Windows/MingW32; postiženi byli jen Debian-user early adopters |
| Korelace přes keypool | ❌ | v0.1 neměl strukturovaný seed — klíče nezávislé |
| **wallet.dat file recovery** | ✅ jediná cesta | Berkeley DB z jeho stroje/backupů; pravděpodobně plaintext. Vyžaduje fyzický/forenzní přístup k médiím z 2009–2010 — mimo scope software toolu |
| Kvantový počítač (Shor) | ⚠️ teoreticky | P2PK = pubkeys exposed → Patoshi stash je **první v pořadí** hypotetického quantum theft. Dnes sci-fi; dlouhodobý protokolový risk (Q-day diskuse) |
| Social/engineering | ❌ proběhlo | GMX/SF/P2P hacks 2014 — nic kromě spamu a server creds; early maily smazané |

---

## 7. Implikace pro BTCunlock

### Co z této analýzy vyplývá pro nástroj

1. **Scope potvrzen správně:** BTCunlock řeší BIP39/BIP32-era wallet recovery (2013+). Satoshi coins jsou **mimo tuto éru** — raw ECDSA keypairs, ne seeds.
2. **Reálný rozšiřující směr** (pokud by měl nástroj pokrýt Satoshi-era coiny vlastněné operátorem — např. staré osobní wallet.dat z 2009–2011):
   - `wallet.dat` parser/carver (BDB mkey/key records → privkey extract) — v README roadmapě
   - **P2PK target support** — era coinbase outputs jsou `OP_<pubkey> OP_CHECKSIG`, ne hash160; `scan`/`recover` teď umí jen P2PKH/P2WPKH/P2SH targets
   - Forenzní carving na starých discích (deleted BDB pages) — separátní disciplína
3. **Co nástroj NIKDY neudělá (a nemá):** hledat cizí klíče. Satoshi stash má ~22 503 cílových pubkey — i kdyby se našel kolizní privkey, právně to je krádež a matematicky je to 2^256 útok.

### Závěrečný verdikt

**Satoshi nám žádnou nápovědu nenechal — protože žádnou nechtěl nechat.** Jeho 17-letá stopa je pozoruhodně čistá: jediné hesla v archivech nejsou jeho, jediný kompromitovaný účet obsahoval spam, jediný šifrovaný blob vedl na mailman heslo. Pattern jeho chování — perfektní opsec, systematický handover, nulový pohyb majetku, „lost coins = donation" filozofie — ukazuje na **záměr**: stash je buď zničený, nebo navždy nedotknutelný. Matematicky na tom v jeho případě nezáleží — pro všechny ostatní je ~1,1M BTC efektivně identické „burnu": největší dobročinná donace v historii, přesně jak sám popsal.

---

## 8. Reference (primární zdroje)

| Zdroj | URL |
|---|---|
| Lerner — Patoshi pattern (2019 definitive) | bitslog.com/2019/04/16/the-return-of-the-deniers-and-the-revenge-of-patoshi/ |
| Lerner — Patoshi Mining Machine (2020) | bitslog.com/2020/08/22/the-patoshi-mining-machine/ |
| Lopp — Was Satoshi a Greedy Miner? | blog.lopp.net/was-satoshi-a-greedy-miner/ |
| Malmi↔Satoshi email archiv (COPA 2024) | mmalmi.github.io/satoshi/ |
| Satoshi Nakamoto Institute — Complete Satoshi | satoshi.nakamotoinstitute.org/ |
| Bitcoin Institute — primary-source archive | bitcoin-institute.pages.dev/entries/ |
| BitMEX Research — GMX hack 2014 | bitmex.com/blog/satoshis-2014-email-hack |
| Hearn farewell email | bitcoin-institute.pages.dev (2011-04-23 entry) |
| COPA v. Wright judgment | judiciary.uk/judgments/copa-v-wright/ [2024] EWHC 1198 |
| v0.1 source (key.h, main.cpp) | github.com/Maguines/Bitcoin-v0.1 |
| Bitcoin v0.4.0 wallet encryption release | bitcoin.org/en/release/v0.4.0 |
| Block 3654 incident | coindesk.com/markets/2020/05/20/… |
| Sassaman hypothesis | evanhatch.medium.com/len-sassaman-and-satoshi-e483c85c2b10 |
| „Dying bitcoins" quote | bitcointalk.org/index.php?topic=198.msg1647 |
| PGP key 5EC948A1 | github.com/bitcoin-dot-org/Bitcoin.org/satoshinakamoto.asc |
