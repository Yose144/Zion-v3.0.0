# 04 — Sociokratický protokol Zlatého domu

> *„Hlasy jsou pro peníze. Kruhy jsou pro lidi. Nikdy nezaměňuj jedno za druhé."*
> — `archive/V3/L5/docs/GOVERNANCE/community-dao-framework.md`

**Stav:** návrh v1 · 2026-09-21 · provozní dokument — použitelný okamžitě, bez čekání na půdu

---

## 1. Proč sociokracie (a jak se liší od demokracie)

| Většinová demokracie | Sociokracie / consent |
|----------------------|------------------------|
| 51 % rozhodne, 49 % prohrává | rozhodnutí platí, dokud nikdo nemá **odůvodněnou námitku** |
| hlasuju o preferencích | konsenzuju o bezpečnosti a funkčnosti |
| vítěz bere vše | námitka je *vstup do designu*, ne porážka |
| polarizace | integrace |
| moc stran | moc domén |

**„Updatovaná demokracie"** = republika **zůstává demokratická** (volby, kvóra, veřejnost, recall), ale **denní rozhodování běží consentem**. Volby a peníze → hlasování. Lidé a pravidla → consent. Obojí se zapisuje on-chain.

## 2. Definice consentu

**Consent = „nemám odůvodněnou námitku."**

Není to:
- ❌ jednomyslnost (každý souhlasí s preferencemi)
- ❌ kompromis (všichni se vzdají něčeho)
- ❌ apatie (nevšímám si)

Je to: *„Toto rozhodnutí je dost bezpečné k vyzkoušení, dost funkční pro náš účel, a já ho dokážu nést."*

**Odůvodněná námitka** musí ukázat jedno z:
1. **bezpečnost** — rozhodnutí ohrožuje členy/půdu/republiku,
2. **sdílené dohody** — porušuje ústavu, zákony, předchozí consent,
3. **doména** — kruh nemá mandát to rozhodnout,
4. **lepší cesta** — existuje měřitelně lepší řešení téhož cíle.

*Není* odůvodněné: „nelíbí se mi", „už jsme to zkusili" (bez dat), „já bych to udělal jinak", „budu se cítit nepříjemně".

## 3. Osm kroků consent procesu

Standardní procedura pro rozhodnutí (z `community-dao-framework.md` §2.2, rozšířeno o on-chain zápis):

```
1. PREZENTACE    navrhovatel předloží návrh + kontext + „co se stane, když neuděláme nic"
2. DOTAZY        pouze otázky porozumění — žádné reakce, žádné názory
3. REAKCE        jedno kolo — každý řekne reakci/doporučení, bez diskuse
4. AMEND         navrhovatel integruje, co dává smysl — zpět návrh v2
5. NÁMITKY       facilitátor ptá každého: „máš odůvodněnou námitku?"
                 námitka se vysloví nahlas + zaznamená reason
6. RESOLVE       kruh řeší každou námitku: amend / clarifikace / test period /
                 nebo ověří, že není odůvodněná
7. CONSENT CHECK facilitátor: „vidím consent?" → ticho/souhlas = consent
8. ZÁPIS         sekretář: rozhodnutí + racionál + námitky + termín review →
                 minuta → hash → on-chain (ConsentEngine attestation)
```

**Časové diskuze:** návrh lokální (do 500 EUR) → 1 session; střední → 2 sessiony; ústavní → min. 2 sessiony + 14d on-chain okno.

## 4. Námitkové kolo — řemeslo

Facilitátorova procedura pro námitku:

1. **Vyslov** — námitkující řekne námitku a proč je odůvodněná.
2. **Zrcadli** — facilitátor zopakuje; námitkující potvrdí „ano, to jsem řekl".
3. **Ověř** — kruh zkontroluje, že námitka patří do 4 kategorií (§2). Pokud ne → záznam „nesouhlas bez námitky" → proces pokračuje.
4. **Integruj** — návrhy na řešení: amend textu / přidej sunset klauzuli / testovací období 3 měsíce / přesun domény / sub-experiment.
5. **Re-check** — facilitátor: „námitka vyřešena?" → pokud ano, consent; pokud ne a námitka drží → návrh se vrací navrhovateli, ne „padá" — **námitka je dar**, ne veto navždy.

**Námitkový limit:** pokud kruh 3× selže vyřešit odůvodněnou námitku na tentýž návrh → eskalace rodičovskému kruhu → pokud i tam → Komora Opravy mediace.

## 5. Struktura kruhů (double-link hierarchie)

```
                    GENERÁLNÍ KRUH
                    (všichni strážci)
                   /    |    \    \
              [delegát+vedoucí = double link]
                 /      |      \      \
        Kruh Ops   Kruh Finance  Kruh Community  Kruh Knowledge
        (infra,    (treasury,    (vstup, události,(kurzy, protokoly,
         půda,      desátek,      hosté, pohostin- AI, semenná kn.)
         stavba)    reporting)    ství, léčba)
              \      |      /      /
               KOMORY (Péče, Opravy, Poznání, Horizontu)
                    \    |    /
                  ZLATÝ SNĚM (roční plénum)
```

**Double link:** každý podkruh posílá do rodiče **dva lidi** — delegáta (zvoleného kruhem, mluví za kruh) a vedoucího (jmenovaného rodičem, nese rozhodnutí dolů). Informace teče nahoru i dolů — žádný kruh není ostrov.

**Podkruhy:** vznikají consentem rodiče pro konkrétní doménu (např. „Kruh včel" pod Ops); zanikají consentem nebo review po 1 roce.

## 6. Facilitace — dovednost, ne charisma

Každý facilitátor se učí:

| Dovednost | Praxe |
|-----------|-------|
| **Kruh** | držet prostor, ne vést diskusi; hlídat, aby každý promluvil jednou v kole |
| **Zrcadlení** | opakovat námitku zpět, dokud řečník nepotvrdí |
| **Odlišení** | „odůvodněná vs. neodůvodněná" — hlídat kategorie, ne emoce |
| **Integrace** | najít amend, který pojme námitku bez ztráty účelu |
| **Čas** | držet fáze; návrh může jít „do dalšího kola", ne nutně do rozhodnutí |
| **Svědek** | „svědek poznamenává, kruh rozhoduje" — facilitátor nerozhoduje sám |

**Trénink:** každý strážce absolvuje consent workshop (8 h) + 3× sekretář + 3× facilitátor pod dohledem, než dostane mandát samostatné facilitace.

## 7. Volby v sociokracii

**Volba rolí** (facilitátor, sekretář, link, treasurer) — **election by consent**, ne většina:
1. kruh sepíše roli + kritéria,
2. nominace (self nebo druhého, dotaz „přijímáš?"),
3. jedno kolo: každý řekne „koho a proč" (argumenty, ne osobní sympatie),
4. facilitátor navrhne kandidáta s nejsilnější argumentací,
5. consent check → námitky se řeší (např. „je přetížený" → roli rozdělit).

**On-chain volby** pro mandáty komor → `ParliamentaryElection` (D'Hondt) — viz `03` §4.1.

## 8. Konflikty a napětí

**Napětí (tension)** je data, ne problém. Každý může přinést napětí kdykoli — kruh ho zpracuje jako mini-návrh: „co by se muselo změnit, aby napětí zmizelo?"

**Konflikt mezi lidmi** → Podkruh konfliktu (Komora Opravy):
1. medvědí kruh — oba řeknou, co potřebují, facilitátor hledá překryv,
2. pokud selže → restorative session (zákon 4 §3),
3. pokud selže → formální justice pipeline (Zákon 4).

**Základ:** „síť odpouští, ale pamatuje" — konflikt není selhání; nepřinesený konflikt je.

## 9. Digitální rozhodování (async consent)

Když kruh nemůže fyzicky:

- **Async consent window:** návrh → dokument → 72h okno na námitky → „ticho = consent" **pouze** pro nízkorizikové rozhodnutí (lokální, <500 EUR, reverzibilní). Vyšší riziko vyžaduje živý kruh.
- **On-chain consent:** `ConsentEngine` (V31/L2/dao `consent.rs`) — attestations Witness/Object/Abstain; `reason_hash` SHA-256; auto-escalation → token vote při ≥30 % objections nebo deadline.

**Async není pro:** ústavní změny, expulsion, treasury >5k EUR, admission.

## 10. Cviky pro kruh (sociocratic drills)

Kruh si drží praxi — jednou měsíčně jedno cvičení:

1. **„Bez peněz"** — rozhodněte consentem něco, kde by peníze normálně rozhodly (např. kde postavit lípu). Trénuje oddělení „votes for money / circles for people".
2. **„Námitkový trénink"** — člen nese záměrně neodůvodněnou námitku; facilitátor trénuje ověření.
3. **„Zrcadlo"** — facilitátor zrcadlí složitou námitku, dokud řečník nepotvrdí.
4. **„Ticho"** — 60 vteřin ticha před consent checkem. Ticho není prázdné — je to poslední kontrola.
5. **„Devil's kruh"** — rozdělení na pro/proti na 10 min, pak consent — ukazuje, že polarita se dá integrovat.

## 11. Limity sociokracie (poctivě)

- **Pomalá:** consent trvá. Proto tiers — ne všechno jde kruhem.
- **Zneužitelná námitkou:** jeden člověk s falešnou „odůvodněností" umí blokovat. Řešení: kategorie §2 + ověření facilitátorem + eskalace Komory Opravy.
- **Skrytá hierarchie:** „informální moc" zkušených. Řešení: rotace facilitátorů, term limits, transparentní minuty.
- **Velikost:** consent dobře funguje do ~15–20 lidí na kruh. Větší pléna → dělení na kruhy + double links (ne gigantický kruh).

---

*„Consent neznamená, že se všem líbí výsledek. Znamená, že ho všichni dokážou nést."*
