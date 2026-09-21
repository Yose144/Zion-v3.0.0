# 03 — Zlatý dům: kompletní design parlamentu

> *„Tak jako mají USA Bílý dům, má Zlatá republika Zlatý dům: sídlo DAO parlamentu
> a veřejné správy. Každé hlasování on-chain, každé zasedání veřejné,
> každé rozhodnutí navždy zapsané v blockchainu."*
> — `golden-republic-bohemia.cs.md` §ZION integrace

**Stav:** návrh v1 · 2026-09-21 · fyzická realizace Fáze 2+ (2028)

---

## 1. Tři roviny jednoho domu

Zlatý dům je současně budova, protokol a instituce:

```
FYZICKÁ      Pavilon Zlatá bula — kamenná protokolová komora uprostřed
             areálu Bohemia: ZION node, multisig místnost, sál kruhu,
             technické centrum, Akášický archiv (fyzická knihovna).

PROTOKOLOVÁ  Bohemia DAO — namespace v zion-dao runtime: consent engine,
             proposal pipeline, treasury multisig, co-admin registry.

KOSMICKÁ     StarSeed chamber — rámec, který se jednou přenese do
             off-world komunit (L6 Issobella → Luna → Mars).
```

## 2. Fyzická architektura pavilonu

Vychází z `BodhiGaia/10-Golden-Republic-Bohemia.md` a `golden-republic-bohemia.cs.md` (půdorys, bod 4: „ZION node, protokolová komora, multisig treasury, technické centrum"):

| Prostor | Funkce | Symbolika |
|---------|--------|-----------|
| **Sál kruhu** | consent sessions Generálního kruhu; kamenný amfiteátr, oheň uprostřed, dubový stůl se solí | kruh bez trůnu; každý vidí každého |
| **Protokolová komora** | on-chain operace: návrhy, podpisy, exekuce; airgapped stanice | pečeť Zlaté buly → multisig |
| **ZION node místnost** | Guardian node (F2, 2028): mini-PC 15–25 W, Starlink+4G+LoRa | republika sama validuje řetěz, nad kterým vládne |
| **Treasury sejf** | hardware wallets, steel backups, fyzické minuty | sůl na stole — smlouva platí |
| **Akášický archiv** | tištěné ročníky, Zlatá bula 2.0 originál, semenná knihovna metadata | paměť, kterou nelze smazat |
| **Hiran terminal** | dedikovaná AI stanice (lokální inference, DGX Spark-ready) | zrcadlo na zdi — vidíš se, ale nejsi to ty |
| **Galerie hostů** | veřejné zasedání — sklo, průhlednost | governance není tajná |

**Materiály:** pískovec, dřevo, sklo (průhlednost governance), rammed earth, konopná izolace; solární střecha; žádná gotická replika — **současná stavba** evokující most/triádu.

## 3. Struktura parlamentu

### 3.1 Generální kruh (plénum)

- **Složení:** všichni aktivní strážci (Bodhisattva confirmed) + zvolení delegáti členů.
- **Doména:** ústavní záležitosti, volby, recall, consent na zákonech, rozpočet rámec.
- **Session:** kvartálně 180 min fyzicky/hybrid; roční **Zlatý sněm** o slunovratu.
- **Quórum:** 60 % aktivních strážců pro consent rozhodnutí (mapuje `Admission`/`Bodhisattva` kvórum on-chain).

### 3.2 Čtyři komory (trvající pracovní orgány)

| Komora | Doména | Typická agenda | On-chain typy |
|--------|--------|----------------|---------------|
| **Péče** | humanitární fond, admission, L5 uzly, Medical | grant reviews, brány, desátek | `Humanitarian`, `Grant`, `Admission` |
| **Opravy** | konflikty, justice, purifikace | mediations, expulsion review, slash review | `Expulsion`, `Emergency` (de-escalation) |
| **Poznání** | vzdělání, protokoly, tech, AI | specifikace, semenná knihovna, Hiran outputs review | `Parameter`, `CrossLayer` (L3 link) |
| **Horizontu** | L6, starseed, archiv, 100+ let | Issobella liaison, dlouhé závazky, yearly audit | `CrossLayer` (L6 link), `Treasury` (1 % přebytku) |

Komora = 5–9 delegátů jmenovaných kruhy (consent), funkční období 1 rok, max 2 po sobě.

### 3.3 Kruh Moudrosti (advisory)

- 3–5 seniorů: zakladatelé, rádci, externí moudří (univerzita, právo, permakultura).
- **Žádná vykonavná moc** — pouze advisory opinion před consent rozhodnutím s ústavním dopadem.
- Vydávají „Moudrý dopis" — veřejný, nezávazný, archivovaný.

### 3.4 Strážci pokladny (5 signers)

- 5 Dual-Vow strážců: 3-z-5 hlavní multisig, 2-z-3 operace.
- Jmenováni Generálním kruhem na 2 roky; recall = `Expulsion` nebo dobrovolné složení.
- Podpisní ceremonie: měsíční signing session v Protokolové komoře, veřejný log.

## 4. Volby — jak se plní křesla

### 4.1 Volba delegátů do komor

**On-chain:** `ProposalType::ParliamentaryElection` — D'Hondt seat allocation (`allocate_seats_dhondt`):

```rust
ProposalType::ParliamentaryElection {
    title: "Volba Komory Péče 2028",
    parties: vec!["kruh-ops", "kruh-finance", "kruh-community", "kruh-knowledge"],
    seats: 7,
}
```

- Každý kruh nominuje kandidáta consentem (off-chain) → kandidáti jako „parties"/listy → token-weighted vote členů → `allocate_seats_dhondt` → mandát.
- **Osoba ≠ strana:** v sociokracii se volí **lidé do rolí**, ne strany. „Party" pole nese jméno kandidáta/kandidátního listu kruhu.
- Quórum 15 %; period 7 dní; timelock není (elections execute immediately po tally).

### 4.2 Sociokratická volba (off-chain forma)

Pro role uvnitř kruhů (facilitátor, sekretář, link): **election by consent** —
1. kruh definuje roli a kritéria, 2. nominace (self nebo jiný), 3. každý řekne „koho volím a proč" v jednom kole, 4. facilitátor navrhne kandidáta s nejsilnějšími argumenty, 5. consent check — námitky se řeší, ne přehlasovávají.

On-chain záznam: výsledek se zapíše jako `Parameter` update nebo `Admission`-style record do registry.

### 4.3 Recall

Každý mandát odvolatelný: navrhovatel = kruh, který jmenoval; rozhodnutí = consent toho kruhu; on-chain = `Expulsion` (pokud důvodem provinění) nebo jednoduchý záznam (pokud rotace).

## 5. Tok návrhu skrze Zlatý dům

```
1. ZÁRODEK     člen/kruh/Hiran-analysis navrhne téma → diskuse v doménovém kruhu
2. KRUH        doménový kruh consent → sponsoring 2 strážců → písemný návrh
3. ZÁPIS       sekretář zapíše minutu → hash → off-chain záznam
4. ON-CHAIN    strážce-podpisatel vloží proposal do zion-dao
                 (ZIS session → váha z L1 balance; nebo X-DAO-Key operátor)
5. REVIEW      72h–7d okno: attestations/hlasy, Hiran View-Cutter analýza veřejná
6. NÁMITKY     odůvodněná námitka → zpět do kruhu (resolve); neodůvodněná → záznam
7. TALLY       consent: quorum + 0 objections / vote: quorum + majority
8. TIMELOCK    48 h (standard) / 7 d (L5) / 30 d (L6-linked)
9. EXECUTE     multisig signers provedou → execution_tx → archiv
10. ARCHIV     minuta + tx hash + dopad → Akášický archiv → veřejnost
```

**Hiran checkpoint:** mezi kroky 4–5 poběží `POST /ai/analyze-grant` / View-Cutter analýza — výstup je veřejný advisory, označen `[HIRAN]`, nikdy hlas.

## 6. Sessiony a kalendář

| Session | Kadence | Délka | Povinné |
|---------|---------|-------|---------|
| Doménové kruhy | týdně/měsíčně dle kruhu | 60–90 min | členové kruhu |
| Komory | měsíčně | 90 min | delegáti + link |
| Generální kruh | kvartálně | 180 min | všichni strážci |
| **Zlatý sněm** | ročně (zimní slunovrat) | celý den | plénum + hosté; volby, ústava, audit roku |
| Emergency | ad hoc | 48h callout | 20 % quorum, 3d vote |

Zlatý sněm agenda (roční): audit treasury + desátek, renewal Bodhisattva slibů (tisíc zlomení), volby obměn komor, novely zákonů, StarSeed review, lipová alej ceremony (nové lípy za nové strážce).

## 7. Kontrolní brzdy

| Mechanismus | Brzda na co |
|-------------|-------------|
| Consent s odůvodněnou námitkou | většinová tyranie |
| Cross-layer veto | rozhodnutí mimo doménu vrstvy |
| Max 2 přilehlé vrstvy na osobu | koncentrace moci |
| Rotační facilitátor + term limits | personalizace moci |
| Daily spend limit (100M ZION/den DAO; tier caps lokálně) | treasury drain |
| Timelocky (48h/7d/30d) | panika a rush rozhodnutí |
| Veřejné minuty + on-chain hash | zadní kanály |
| Kulturní review povinnost | zneužití symboliky (Přemysl/Karel IV) |
| AI advisory-only | technokratická drift |
| Under-18 free entry + ochrana dětí | intergenerační krátkozrakost |

## 8. Co Zlatý dům NENÍ

- ❌ není stát — nevydává zákony pro nečleny
- ❌ není firma — žádní akcionáři, žádný profit
- ❌ není církev — Bodhisattva slib je praxe, ne dogma; žádná povinná víra
- ❌ není token-oligarchie — peníze hlasují o penězích, lidé consentují o lidech
- ❌ není „návrat zlatého věku" — je to laboratoř, ne nostalgie

---

*→ Procedura detailně: [`04-SOCIOKRACIE-PROTOKOL.md`](./04-SOCIOKRACIE-PROTOKOL.md) · On-chain mapa: [`07-TECHNICKA-INTEGRACE.md`](./07-TECHNICKA-INTEGRACE.md)*
