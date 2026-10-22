# 02 — Základní zákony Zlatého domu

> Sedm zákonů = sedm sloupců, na nichž stojí Zlatý dům.
> Sedmero jako sedm kopulí Dharmy, sedmero dní v týdnu kruhu, sedmero volitelů Zlaté buly —
> a zároveň sedm humanitárních kategorií fondu (`HumanitarianCategory`).

**Nadřazený dokument:** [`01-USTAVA-ZLATE-REPUBLIKY.md`](./01-USTAVA-ZLATE-REPUBLIKY.md)
**Stav:** návrh v1 · 2026-09-21 · žádný zákon zatím není platný — sbírka čeká na Fázi 1

---

## Zákon 0 — Zákon zakotvení (právní entita a území)

**Účel:** republika existuje v právním řádu ČR/EU, ne mimo něj.

1. Fyzická entita Zlatého domu je česká právnická osoba — **z.s. (spolek)** pro Fázi 1; **z.ú. (ústav) nebo komunitní nadace** pro držení půdy od Fáze 2. Finální forma se rozhodne consentem Generálního kruhu po právní rešerši (otevřená otázka v Bohemia doc).
2. Půda se drží **v trustu pro budoucí generace** — nikdy není předmětem soukromého zisku ani prodeje (neměnné, viz Ústava §29).
3. Členové plní daňové, pojistné a registrační povinnosti ČR. Republika nemůže přikázat porušení práva státu; může doporučit jeho změnu.
4. Každý právní dokument entity (stanovy, smlouvy) má on-chain hash registraci v Akášickém archivu (Zákon 6).

---

## Zákon 1 — Zákon kruhu (jak se rozhoduje)

**Účel:** procedura, která převádí sociokracii do provozu.

1. **Rozhodování consentem:** návrh projde, pokud nikdo nevznese odůvodněnou námitku. Odůvodněná = ohrožuje bezpečnost, porušuje sdílené dohody, přesahuje doménu kruhu, nebo existuje měřitelně lepší cesta k témuž cíli. Neodůvodněné: „nelíbí se mi", „už jsme to zkusili", „mám lepší nápad" (ten se předloží zvlášť).
2. **Osm kroků consent procesu** (z `community-dao-framework.md` §2.2): prezentace → dotazy → reakce → amend → námitkové kolo → resolve → consent check → zápis.
3. **Rotační facilitátor** — každý kruh volí facilitátora a sekretáře consentem na funkční období 6 měsíců; nikdo nesmí facilitovat 2 po sobě jdoucí období téže domény.
4. **Dvojá vazba (double link):** každý podkruh má delegáta **a** vedoucího do rodičovského kruhu — informace teče oběma směry, ne jen dolů.
5. **Minuty jsou zákon:** každé rozhodnutí se zapisuje (kdo, co, proč, námitky, výsledek), hash jde on-chain do 7 dnů. Rozhodnutí bez zápisu neexistuje.
6. **On-chain kotva:** consent rozhodnutí nad rámec lokálního kruhu se registrují jako `ConsentEngine` attestations (Witness/Object/Abstain; námitka vyžaduje `reason_hash`).

---

## Zákon 2 — Zákon pokladny (peníze a desátek)

**Účel:** transparentní, vrstvené, multisig správy prostředků.

1. **Treasury struktura:** hlavní multisig **3-z-5**; operační peněženka **2-z-3**; cold rezerva **3-z-5**; signeři jsou Dual-Vow strážci jmenovaní Generálním kruhem.
2. **Spending tiers** (EUR-ekvivalent v době výdaje): mikro <100 (kruhový lead), malý 100–500 (rodičovský kruh, záznam), střední 500–5 000 (Finance→General, multisig 2-z-3, 48 h), velký 5 000–20 000 (General consent, multisig 3-z-5, 7 d), mimořádný >20 000 (General + quadratic vote 14 d).
3. **Desátek:** 10 % veškerého přebytku → české komunity, krajina, bylinné dědictví — auto-forward měsíčně, není návrh.
4. **Alokace komunitní pokladny:** 40 % ops / 25 % infra / 20 % rezerva / 10 % humanitární tithe / 5 % vzdělání.
5. **Měnová disciplína:** pokladna drží mix CZK + stablecoin + ZION; volatilita ZION se nesmí přenést do operačních závazků.
6. **On-chain:** výdaje z L5 fondu (500M ZION alokace Bohemia) jdou výhradně přes `zion-dao` `Treasury`/`Grant` návrhy — Free World service (`127.0.0.1:8095`) je read-only tracker, nikdy nesignuje transakci.

---

## Zákon 3 — Zákon vstupu (kdo se stává členem)

**Účel:** brána je učitel, ne zeď.

1. **Čtyři brány** pro každého 18+: (1) písemné zrcadlo 500–2000 slov, (2) živý kruh 45–60 min s 2 rotujícími strážci, (3) zkušební pobyt 3–7 dní v práci kruhu, (4) souhlas kruhu — consent round, jedna odůvodněná námitka pozastavuje.
2. **<18 let zdarma** — vždy, všude, bez testu; 13–17 samostatně s consentem rodiče + intent letter + welcome rozhovor; 0–12 s dospělým.
3. **Bodhisattva slib** pro strážce: min. 21 let (výjimka 3 strážci), 6 měsíců kontinuální residency, 2 sponzorští strážci, „Excellent" ve ≥2 kritériích prověrky, consent Generálního kruhu.
4. **On-chain ratifikace:** fyzický consent → `ProposalType::Admission` (72h review, 60 % Guardian attestations, žádná námitka) → soulbound záznam. Bodhisattva slib → `ProposalType::Bodhisattva` (7 d distributed witnessing, 60 %).
5. **Nouzová brána:** 2-z-3 operační wallet může přijmout v krizi (uprchlík, nouze) s retroaktivní DAO ratifikací do 30 dnů — Ksitigarbha pravidlo: žádná bytost není příliš daleko.
6. **Obnova:** verifikace platí 3 roky; obnova = 1 strana reflexe + 30 min rozhovor + 2 attestationy.

---

## Zákon 4 — Zákon opravy (spravedlnost bez vězení)

**Účel:** restorative justice — síť odpouští, ale pamatuje.

1. **Konflikt jdoucí do kruhu:** žádný významný konflikt se neřeší „po své" — jde do Podkruhu konfliktové péče (Komora Opravy) do 14 dnů.
2. **Grace period (due process):** obvinění (písemné, podepsané, on-chain) → vyšetřování nezávislým CoAdminem **z jiné vrstvy** → právo obhajoby → review ≥7 d (L5: 14 d) → výsledek.
3. **Stupně nápravy:** medvědí kruh (mediace) → restituce (náhrada) → omezení mandátu → suspendace → **expulsion**.
4. **Expulsion** výhradně přes `ProposalType::Expulsion`: vyšetřování + obhajoba hash + kvadratický consent 75 % + 7denní review. Výsledek: token/reputace burn, ban ze sítě.
5. **Purifikace (návrat):** kdo porušil, může se vrátit cestou purifikace — veřejné přiznání, náhrada škody, 90denní probation, nový consent kruhu. *„Zlom slib tisíckrát, obnov ho tisíc a jednou."*
6. **Slash ochrana:** žádný strážce nepadne bez procesu; „spravedlnost není rychlost, je důkladnost".

---

## Zákon 5 — Zákon svědka (AI v governance)

**Účel:** AI jako zrcadlo, nikdy pán — hranice jsou zákon, ne doporučení.

1. **Hiran advisory role:** AI analyzuje návrhy (View-Cutter), skóruje granty, navrhuje projekty, sepisuje impact reporty, archivuje poznání. **Nehlasuje. Nepodepisuje. Nerozhoduje.**
2. **Dharma validátor:** každý AI výstup do procesu projde 5 testů (ahimsa, satya, asteya, brahmacharya, aparigraha). Padnutý výstup = revize nebo odmítnutí, zaznamenáno v minutách.
3. **Transparence:** každý AI vstup je označen `[HIRAN]` v zápisu; žádný člověk nesmí vydávat AI text za svůj v consent procesu.
4. **Data sovereignty:** AI nesbírá data kruhů, hostů ani členů bez explicitního granular consentu; preferován lokální inference (`localhost`, DGX Spark, edge nodes) před cloudem.
5. **Refuse dependence:** AI nesmí nahrazovat terapii, kruh, přátelství; konverzace vedoucí k závislosti se přesměruje na člověka.
6. **AI Native Vow:** každý AI Guardian v síti drží slib s epoch renewaly + alignment score; porušení = pozastavení advisory funkcí do revize Komorou Poznání.

---

## Zákon 6 — Zákon paměti (archiv a transparentnost)

**Účel:** co není zapsáno, neexistuje; co je zapsáno, je navždy.

1. **Akášický archiv** (Pavilon Univerzita + on-chain hash): každý minut, každá ústava/novela, každé rozhodnutí, každý grant, každý slib → verzovaný dokument + SHA-256/BLAKE3 hash + block anchor.
2. **Veřejnost:** všechny záznamy jsou veřejné defaultně. Výjimky: osobní data (hash-only), objection reasons (reason_hash, ne plaintext), bezpečnostní incidenty (30d embargo).
3. **Papírová redundance:** každý roční Zlatý sněm produkuje tištěný ročník „Státní knihy" — papír jako cold backup civilizace.
4. **Lipová alej:** každý nový strážce = nová lípa — živý ledger komunity, on-chain záznam `Bodhisattva` proposal je jeho digitální dvojče.
5. **Sedm let zániku:** dokumenty se nemažou; registrují se jako „ukončené". Historie republiky je neměnná jako řetěz.

---

## Zákon 7 — Zákon horizontu (StarSeed a L6 vazba)

**Účel:** rozhodování s vědomím, že republika píše ústavu i pro ty, kdo odletí.

1. **Komora Horizontu** drží mandát přemýšlet v cyklech ≥ generace: každý návrh s 20+letým dopadem musí projít jejím review před consentem.
2. **Issobella interface:** republika jmenuje **L6 liaison** (advisory) — kanál mezi L5 governance a Issobella Stewardy (2-z-3 multisig + vědecká rada, time-lock 2030).
3. **Přenositelnost ústavy:** každý text Zlatého domu musí být psán tak, aby fungoval i bez Země — žádný princip nesmí předpokládat český stát, euro, ani zdánlivě nekonečný internet (latency-proof design, viz `06-STARSEED-ISSOBELLA.md`).
4. **1 % přebytku → L6** (od Fáze 4): republika investuje do hvězdné trajektorie, ne jen do sebe.
5. **Starseed registry:** členové, kteří prohlásí horizontální závazek („stavím pro děti, které uvidí hvězdy"), jsou registrováni jako StarSeed strážci — advisory kolektiv pro Misi Amenti.

---

## Aplikace a precedence

- **Precedence:** Ústava > Základní zákony > pravidla kruhů > rozhodnutí > zvyky.
- **Lokální autonomy:** každá L5 komunita může mít přísnější pravidla, nikdy laxnější vůči Článku II.
- **Retroaktivita:** zákon nikdy neplatí zpětně; expulsion/purifikace vyjma — tam se hodnotí akt, ne zákon.
- **Jazyk:** český kanonický, anglický překlad závazný pro on-chain komentáře; v případě rozporu rozhoduje Kruh Moudrosti jako advisory a Generální kruh consentem.

*„Psaná pravidla, distribuovaná moc, stabilita strukturou — Zlatá bula trvala 450 let. My stavíme na déle."*
