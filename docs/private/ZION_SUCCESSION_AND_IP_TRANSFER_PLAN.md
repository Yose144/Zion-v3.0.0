# ZION — Soukromý plán poslední vůle a provozní kontinuity

**DŮVĚRNÉ / NEVEŘEJNÉ — interní rodinný dokument**
**Datum poslední revize:** 2026-09-06
**Sestavil:** Devin na základě pokynů Yosefa Hubálka
**Účel:** interní inventář a podklad ke třem samostatným listinám: darovací smlouvě pro případ smrti, okamžitě účinné plné moci a vlastnoruční závěti.

> **Bezpečnostní pravidlo:** Do tohoto souboru nikdy nepatří skutečné mnemoniky, privátní klíče, hesla, recovery kódy ani API tokeny. Uvádí se jen typ aktiva, jeho inventární označení a bezpečné místo uložení.

---

## 1. Strany

| Role | Osoba | Poznámka |
|------|-------|----------|
| **Dárce / zůstavitel / zmocnitel** | Yosef Hubálek | Jednatel a zakladatel `OMNITY.ONE s.r.o.`, IČO 09120050. V `Cargo.toml` a package metadata uveden jako autor `Yose144`. Git historie ukazuje Yosefa/Yose144 jako dominantního autora, nikoli však sama o sobě vlastnictví všech práv. |
| **Hlavní správkyně / Trustee / Zmocněnkyně** | Erika Imlaufová | Přijímá dar a plnou moc pro rozhodování v případě, že se Yosefovi něco stane. Spravuje majetek ve prospěch dětí a pro zachování projektu. |
| **Náhradní správkyně (Fallback Trustee)** | Petra Tkácová | Nastupuje automaticky v plném rozsahu, pokud se Erika Imlaufová k převzetí nehlásí, správu odmítne nebo ji nemůže vykonávat. |
| **Nepominutelná dědička** | Sarah Hubalková | Dítě, nezletilé; musí obdržet nejméně zákonný povinný díl. Zastoupení při správě dědictví se řídí zákonem a případným rozhodnutím soudu. |
| **Nepominutelný dědic** | Tadeas Hubalek | Dítě, nezletilé; musí obdržet nejméně zákonný povinný díl. Zastoupení při správě dědictví se řídí zákonem a případným rozhodnutím soudu. |

---

## 2. Jednotná forma převodu — darovací listina, plná moc a nástupnictví

Tento plán je promítnut do jednoduchého hlavního dokumentu **`ZION_DAROVACI_LISTINA_A_PLNA_MOC.md`** a tisknutelného PDF **`ZION_SUCCESSION_DECLARATION.pdf`**.

### 2.1 Struktura pojistky

1. **Předání řízení a plná moc:**  
   V případě smrti, nemoci či neschopnosti Yosefa Hubálka přebírá okamžitou správu a veškerá rozhodovací práva k projektu ZION TerraNova (servery, domény, kód, premine klíče, multisigy, sociální sítě) **Erika Imlaufová**.

2. **Náhradnictví (Petra Tkácová):**  
   Pokud by se Erika Imlaufová k převzetí správy nehlásila, správu odmítla nebo ji nemohla vykonávat, veškeré pravomoci a správa přecházejí automaticky a v plném rozsahu na **Petru Tkácovou**.

3. **Převod práv a rodinné zajištění:**  
   Veškerá převoditelná práva k projektu (IP, ochranné známky, domény, obchodní podíl v OMNITY.ONE s.r.o.) přecházejí na správkyni ve prospěch nezletilých dětí **Sarah Hubalkové** a **Tadease Hubalka**. Výnosy a soukromý majetek slouží k zabezpečení dětí a správkyně v poměru **1/3 : 1/3 : 1/3**.

4. **Klíče a on-chain fondy:**  
   Klíče jsou uloženy na bezpečném fyzickém/digitálním úložišti. Závazné rozdělení premine a L5 Free World projektů (§3) zůstává plně v platnosti.

---

## 3. Premine — rozdělení a klíče

Kanonický technický stav premine podle `V31/L1/core/src/genesis.rs` a `V31/L1/core/src/emission.rs` je **16 780 000 000 ZION** (14 slotů).

### 3.1 Aktualizovaný rozpad premine (2026-09-06)

| # | Kategorie | Adresa | Částka (ZION) | Lock | Záměr |
|---|-----------|--------|--------------:|------|-------|
| 1 | OASIS + Golden Egg (Slot 1) | `zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5` | 1 650 000 000 | admin-locked | OASIS game rewards |
| 2 | OASIS + Golden Egg (Slot 2) | `zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0` | 1 650 000 000 | admin-locked | OASIS game rewards |
| 3 | OASIS + Golden Egg (Slot 3) | `zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4` | 1 650 000 000 | admin-locked | OASIS game rewards |
| **4** | **L5 Free World Projects (Rezerva)** | `zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708` | **1 650 000 000** | **admin-locked** | **L5 rezerva (přepsáno z OASIS Slot 4)** |
| **5** | **L5 Free World Projects** | `zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388` | **1 650 000 000** | **admin-locked** | **L5 humanitární projekty (přepsáno z OASIS Slot 5)** |
| 6 | DAO Treasury (main) | `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5` | 2 500 000 000 | admin + time-lock (144k) | Community governance |
| 7 | DAO Treasury (Grants) | `zion1s27490u7n823g098w42077h8f2n824w0y75w0s3` | 1 000 000 000 | admin + time-lock (144k) | Grants & bounties |
| 8 | DAO Treasury (Bootstrap) | `zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238` | 500 000 000 | admin + time-lock (144k) | Ecosystem bootstrap |
| 9 | Infrastructure (Core Dev) | `zion1k752909323x66062k5j7074096f003z095ax8m7` | 1 000 000 000 | admin-locked | Core development fund |
| 10 | Infrastructure (P2P Seeds) | `zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706` | 1 000 000 000 | admin-locked | Network infrastructure |
| 11 | Infrastructure (Genesis Projects) | `zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8` | 590 000 000 | admin-locked | Dharma Temple, Piko de Ora + DAO |
| 12 | Humanitarian (Children Future Fund) | `zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8` | 1 440 000 000 | admin-locked | Humanitarian DAO |
| 13 | Bridge Seed | `zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756` | 400 000 000 | admin-locked | EVM bridge liquidity |
| 14 | Bridge Vault UTXO | `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` | 100 000 000 | admin-locked | Bridge unlock liquidity |
| | **Celkem** | | **16 780 000 000** | | |

### 3.2 L5 Free World Projects — rozdělení Slot 4 + 5 (3.3B ZION)

Sloty 4 a 5 (`zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708` + `zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388`, celkem 3 300 000 000 ZION) byly přepsány z OASIS Reserve na L5 Free World Projects. Rozdělení mezi 5 projektů + rezerva:

> **Správa:** Erika Imlaufová jako hlavní Trustee + zástupci pro jednotlivé projekty.
> **Utrácení:** Vyžaduje 3-of-3 admin multisig + DAO vote (admin_locked = true).

| L5 projekt | Správce (zástupce) | Částka (ZION) | Zdrojový slot |
|------------|---------------------|--------------:|---------------|
| Projekt Genesis Garden | Petra Tkácová | 500 000 000 | Slot 4/5 |
| Project Dharma Temple | Erika Imlaufová | 500 000 000 | Slot 4/5 |
| Projekt Te Piko Ora | Vahine Fierro | 500 000 000 | Slot 4/5 |
| Project Bohemia | Andrea Kalousová | 500 000 000 | Slot 4/5 |
| Project Bodhi Lanka | Annicka Purkertová | 500 000 000 | Slot 4/5 |
| **L5 rezervní fond** | **Erika Imlaufová (Trustee)** | **800 000 000** | **Slot 4/5** |
| **Celkem** | | **3 300 000 000** | |

> **L5 rezervní fond (800M ZION):** Spravuje Erika Imlaufová jako Trustee. Slouží pro budoucí L5 projekty, nouzové granty a rozšiřování stávajících projektů. Utrácení vyžaduje 3-of-3 admin multisig + DAO vote.
>
> **Poznámka:** UTRÁCENÍ z Slot 4/5 adres vyžaduje admin unlock (3-of-3 Rama + Sita + Hanuman) + DAO vote — to je pojistka proti neřízenému výdaji. Rozdělení částek mezi projekty je účelové označení v této listině; on-chain zůstávají UTXO na dvou adresách slotů 4 a 5, dokud se neprovede konkrétní transfer.

### 3.3 Princip

- **UTXO zůstávají na původních adresách.** Neprovádí se okamžitý on-chain přesun.
- **Předání klíčů není změna signer setu.** Erika Imlaufová může získat bezpečnou kopii pro recovery, ale skutečná změna admin/guardian/multisig oprávnění vyžaduje příslušný protokolový krok, DAO vote nebo multisig rotation.
- **Veřejně účelové fondy nejsou automaticky osobním majetkem rodiny.** DAO Treasury, humanitární fond, infrastruktura, bridge a L5 projekty mají účelové zámky.
- Po plnoletosti Sarah a Tadease může proběhnout právní a případně on-chain rozdělení podílů pouze podle platné listiny; třetinový poměr je zatím pracovní záměr, nikoli aktuální on-chain stav.

### 3.4 Místo uložení klíčů (doplnit Yosef)

| Asset | Typ klíče | Fyzické uložení | Digitální záloha |
|-------|-----------|-----------------|------------------|
| Premine admin multisig | Ed25519 / BIP39 | _________________________ | _________________________ |
| DAO guardian | Ed25519 | _________________________ | _________________________ |
| Bridge validator | EVM privátní klíč | _________________________ | _________________________ |
| L5 Free World Projects (Slot 4 + 5) | Ed25519 / BIP39 | _________________________ | _________________________ |
| Domain registrátor | 2FA/heslo | _________________________ | _________________________ |
| Edge server SSH/root | SSH klíč + heslo | _________________________ | _________________________ |
| GitHub + 1Password | heslo / master | _________________________ | _________________________ |

---

## 4. Duševní vlastnictví kódu

### 4.1 Aktuální stav

- Root `LICENSE` a `public/LICENSE`: `Copyright (c) 2024-2026 ZION TerraNova Contributors`.
- `V31/Cargo.toml`, root `Cargo.toml`: `authors = ["Yose144"]`.
- `APP&WEB/zion-wallet-sdk/package.json`: `"author": "ZION TerraNova"`.
- Některé `package.json`: `ZION TerraNova Core Team <contact@zionterranova.com>`.
- Git autoři: `Yose144`, `Josef Hubalek` aj. Yosef je v praxi dominantním autorem.

### 4.2 Právní režim a veřejná metadata

- Majetková autorská práva fyzické osoby jsou podle § 26 autorského zákona nepřevoditelná, ale jsou předmětem dědictví. Proto jsou Yosefova vlastní autorská práva řešena závětí, nikoli darovací smlouvou.
- Za života lze v písemné smlouvě poskytnout licenci; případnou výhradní licenci musí před podpisem připravit nebo zkontrolovat advokát.
- **Nyní se veřejná metadata nemění.** `LICENSE`, `public/LICENSE`, `Cargo.toml`, `package.json`, whitepapery a právní stránky zůstávají beze změny, dokud nebude dokončen copyright audit a nevznikne právní důvod ke změně.
- `LICENSE` může pokrývat pouze práva, která lze platně uplatnit. Nesmí přepsat copyrighty contributorů ani licence OpenZeppelin, RandomX, Forge-std, Beam, Bitcoin/Zcash částí a dalších závislostí.

> **Pozor:** Repo obsahuje cizí kód. Třetí strany si zachovávají svá práva a licence; závěť ani darovací smlouva je nepřevádí.

---

## 5. Společnost `Omnity.One s.r.o.`

- IČO: 09120050, DIČ: CZ09120050, sídlo Horní Čermná 561 56.
- Jednatel a zakladatel: Yosef Hubálek.
- Jednatel je v bílé knize uveden jako CEO, lead developer, AML officer a DPO.

### 5.1 Obchodní podíl

Podle aktuálního rozhodnutí není obchodní podíl předmětem darovací smlouvy. Závěť jej zahrnuje do pozůstalosti pouze tehdy, bude-li jej Yosef v den smrti vlastnit.

Pokud by se podíl převáděl už za života, je nutné nejprve ověřit výpis z obchodního rejstříku a společenskou smlouvu. Samotná smlouva o převodu podílu podle § 209 odst. 2 zákona o obchodních korporacích zpravidla vyžaduje písemnou formu s úředně ověřenými podpisy, nikoli automaticky notářský zápis. Souhlas valné hromady nebo další forma mohou být nutné podle společenské smlouvy a okolností převodu.

> **Důležité:** Osobní plná moc Yosefa není plnou mocí společnosti a sama Eriku neopravňuje jednat jménem `OMNITY.ONE s.r.o.`.

### 5.2 Jednatel a společník

- Yosef Hubálek je podle aktuálního pokynu **jediný jednatel** `Omnity.One s.r.o.`.
- Z toho nelze automaticky dovodit, že je i jediným společníkem; rozhodující je aktuální výpis z obchodního rejstříku a společenská smlouva.
- Nezletilé děti (Sarah, Tadeas) vyžadují samostatné posouzení zastoupení a správy jejich majetku.

---

## 6. Domény, server, sociální sítě a třetí strany

| Asset | Přístupové údaje | Předání Erikou | Poznámka |
|-------|-------------------|---------------|----------|
| Domény (zionterranova.com, newearth.cz, …) | registrátor / 2FA | Ano | Převod dle registrátora |
| Edge server `62.171.141.136` | SSH klíče, root | Ano | Oznámit Contabo |
| GitHub `Yose144/Zion-v3.0.0` | GitHub účet / org | Ano | Převod ownershipu orgu |
| 1Password / trezor hesel | master heslo | Ano | Bezpečné fyzické předání |
| Google Workspace / ZIS Google OAuth | admin | Ano | Převod super-admina |
| Social media (Twitter/X, Telegram, YouTube, Discord) | hesla / 2FA | Ano | Upravit recovery contact |
| AWS / hosting / Mailchimp / Sumsub | hesla / API klíče | Ano | Převod účtů |
| Let's Encrypt / Cloudflare / DNS | API tokeny | Ano | Rotovat po převodu |

---

## 7. Postavení nezletilých dědiců

- Sarah Hubalková a Tadeas Hubalek jsou nepominutelní dědici. Nezletilému potomkovi musí připadnout alespoň tři čtvrtiny jeho zákonného dědického podílu.
- Cílem závěti je poměr 1/3 pro Eriku, 1/3 pro Sarah a 1/3 pro Tadease. Pokud by tento poměr zkrátil povinný díl dítěte, závěť podíl dítěte automaticky zvýší a podíl Eriky odpovídajícím způsobem sníží.
- Plná moc Yosefa sama Erice nezakládá zákonné zastoupení dětí ani právo spravovat jejich zděděný majetek. To se řídí zákonem a případným rozhodnutím opatrovnického soudu.
- Účelově vázané premine a DAO prostředky nejsou soukromou pozůstalostí a třetinový poměr se na ně automaticky nevztahuje.

---

## 8. Checklist právních a technických kroků

- [ ] 1. Doplnit identifikační údaje a podepsat darovací smlouvu Yosefem a Erikou; svědci nejsou součástí listiny, doporučeno je úřední ověření obou podpisů.
- [ ] 2. Doplnit identifikační údaje a podepsat okamžitě účinnou plnou moc Yosefem; Erika samostatně potvrdí přijetí.
- [ ] 3. Yosef celý vzor závěti vlastnoručně opíše, doplní místo a datum a podepíše. Vytištěný vzor bez svědků nepodepisovat jako závěť.
- [ ] 4. Ověřit aktuálního společníka/společníků `OMNITY.ONE s.r.o.` výpisem z OR a společenskou smlouvou.
- [ ] 5. Předat všechny admin/genesis klíče Erice bezpečně; tajné údaje nikdy nezapisovat do těchto dokumentů.
- [ ] 6. Předat přístupy k Edge serveru, doménám, GitHubu, sociálním sítím a 1Password přes oddělený předávací protokol.
- [ ] 7. Veřejná `LICENSE`, metadata a legal docs ponechat beze změny do dokončení právního a copyright auditu.
- [ ] 8. Převést nebo smluvně přiřadit domény, hosting a účty podle skutečného vlastníka a pravidel poskytovatele.
- [ ] 9. Po právním schválení provést případnou rotaci DAO guardianů/admin multisig signerů a uložit TX ID mimo veřejný repo.
- [ ] 10. Podepsané originály uložit mimo repozitář; digitální kopie pouze šifrovaně.

---

## 9. Věci, které tento dokument NEŘEŠÍ

- Samostatnou smlouvu o převodu obchodního podílu za života; její potřebná forma závisí na zákoně, společenské smlouvě a konkrétních okolnostech.
- Daňové a účetní dopady darování, dědictví a převodu digitálních aktiv.
- Právní režim držení kryptomajetku nezletilými v ČR — nutné advokátní posouzení.
- Případné spory mezi dědici — doporučujeme jasně definovat podíly a správu.
- Převod cizího kódu — třetí strany si zachovávají svá autorská práva.

---

## 10. Související soubory v repu

- `LICENSE` a `public/LICENSE` — aktuální MIT copyright.
- `V31/Cargo.toml` — author `Yose144`.
- `V31/L1/core/src/v3_compat.rs` — 14 premine outputů; Slot 4 a 5 mají kategorii `l5_free_world`.
- `V31/L1/core/src/genesis.rs` — genesis block; metadata `purpose` a `category` nemění genesis hash.
- `V31/L4/oasis/src/rewards.rs` — OASIS reward pool: 3 sloty, 4,95B ZION.
- `docs/docs2.9/legal/WHITEPAPER_ZION_TOKEN_CZ.md` — emitent `Omnity.One s.r.o.`.
- `docs/docs2.9/legal/TERMS_AND_CONDITIONS_CZ.md` — ochranné známky a práva k IP.
- `APP&WEB/website-v2.9/public/docs/legal/disclaimer.md` — sekce „Intelektuální vlastnictví".

---

**Doporučení:** Tento soubor uložte mimo veřejný repozitář (fyzický trezor, 1Password, úschova). Mnemoniky a privátní klíče by v něm nikdy neměly být zapsány.
