# ISSOBELLA — Kapitola 6: Pět procent nahoru
## Titík · L1 → L6 — proud, který nikdo nemusí schvalovat, a fond, který čeká na svůj čas

> *„Kdo dává nebe nejprve, dostane později hvězdy."*

---

## Příběh

Když se poutníci naučili počítat bloky, naučili se počítat i něco jiného: **kam z každého bloku mizí část světla**.

Vysvětlil jim to učitel, který si říkal Jen-že — protože vždycky nejdřív řekl „jenže" a pak až odpověď. *„Každý blok nese odměnu,"* řekl. *„Devadesát procent jde tomu, kdo našel nonce — tomu, kdo hlídá teď. Pět procent jde dolů — do studny lidí, L5. A pět procent jde nahoru — do studny nebe, L6."*

*„A kdo o tom rozhoduje?"* zeptal se tesař.

*„Nikdo,"* řekl Jen-že. *„A právě to je na tom to nejkrásnější. Protokol to udělal sám, při narození. Nemůže to zastavit nálada, vláda ani dobrý důvod. Dokud se těží, proud teče. Jako déšť — nikdo ho neschválil, a přesto napouští každou studnu."*

Pak ukázal druhou skříňku, těžší. *„Ale to není všechno. Když se síť rodila, oddělila z prvního výdeje velkou nádobu pro nebe — dva a půl miliardy. A zamkla ji. Ne do klíče člověka — do klíče času. Otevře se, až řetěz dosáhne výšky, která je zapsaná v kódu. Do té doby na ni nikdo nesmí sáhnout — ani s dobrou písní, ani s lepším záměrem."*

*„A když se odemkne?"*

*„Pak následuje cesta: návrh, hlas, čekání, podpisy strážců — a doklad, který může zkontrolovat každý. Peníze, které tečou nahoru, netečou do kapsy. Tečou do otázky: *co si zaslouží letět?*"*

Poutníci pochopili, že nebe má v tomto světě zvláštní daň — a zvláštní pokoru. Titík, který teče sám, a fond, který se neotevře před svým časem.

---

## Co to znamená

**L6 je financována dvěma proudy — a obě jsou skutečné, on-chain, ověřitelné.** Tato kapitola je rozcestník mezi nimi, protože se v příbězích snadno splétají:

**Proud první — proud tečící:** `ISSOBELLA_PCT = 5`. Každý blokový subsidy posílá 5 % na kanonickou L6 adresu `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0`. Žádné hlasování, žádný výbor, žádná nálada — protokol to dělá sám od genesis. To je „titík", který nikdo nemusí schvalovat.

**Proud druhý — proud čekající:** premine slot 6 — **2,5 mld ZION** na adrese `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5`, kategorie `l6_issobella`, **time-lock do bloku 144 000** + admin multisig (3-of-3) + DAO vote. Převedeno z DAO Treasury 12. 9. 2026 — metadata-only změna, genesis hashe nedotčeny. To je „nádoba", která se otevře, až řetěz doroste.

A hranice, kterou kniha říká nahlas: **fond dnes nic nevyplácí.** Rozhodnutí G10 drží L6 v režimu *read-only* — fond se hromadí on-chain, jakýkoli výdaj musí projít DAO cestou (návrh → hlas → timelock → strážcovský multisig) a ta cesta dnes čeká na chybějící DAO UI. Kdo říká, že Issobella už „platí vědce", lže. Kdo říká, že se hromadí prostředky pro otázku *co si zaslouží letět*, říká pravdu.

### Dva proudy, dvě adresy, dvě povahy

| | Tečící titík | Čekající nádoba |
|---|---|---|
| **Adresa** | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5` |
| **Zdroj** | 5 % z každého block subsidy (`ISSOBELLA_PCT`) | Premine slot 6 (2,5 mld ZION) |
| **Kdy** | Každý blok, automaticky | Jednorázový záznam v genesis, lock do bloku 144 000 |
| **Povaha** | Provozní proud | Nadace / endowment |
| **Kdo může utrácet** | Nikdo přímo — jen přes DAO cestu | Nikdo před odemčením; poté admin multisig + DAO vote |

---

## Kotva pravdy — ověřitelná fakta

| Tvrzení | Stav | Kotva |
|---|---|---|
| `ISSOBELLA_PCT = 5` v emisním kódu; 5 % každého subsidy → `zion1z4s3a5...` | **ŽIVÉ** | `V31/L1/core/src/emission.rs`, `v3_compat.rs` (`MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET`), `StatusV3.md` („Fee Split") |
| Premine slot 6 = 2,5 mld ZION pro `l6_issobella`, lock 144 000, adresa `zion1f5h5k6t8...` | **ŽIVÉ** | `V31/L1/core/src/v3_compat.rs`, [`CHANGES_L6_ISSOBELLA.md`](../../../CHANGES_L6_ISSOBELLA.md), `StatusV3.md` 2026-09-12 |
| Slot 6 byl převeden z DAO Treasury (Community Governance); genesis hashe beze změny | **ŽIVÉ** | `CHANGES_L6_ISSOBELLA.md`; `StatusV3.md` 2026-09-12 |
| Fond dnes aktivně financuje výzkum / granty | **NEPLATNÉ TVRZENÍ** | G10: žádná automatická dispozice; DAO cesta je read-only ([`L5_L6_ACTIVATION_PLAN.md`](../../3.2/L5_L6_ACTIVATION_PLAN.md)) |
| Odemykání slotu 6 podmíněno admin multisig (3-of-3) + DAO vote | **ŽIVÉ** (design) | `CHANGES_L6_ISSOBELLA.md`, `/l6-issobella` premine karta |
| „Titík, který nikdo nemusí schvalovat" | **ŽIVÉ** (protokol) | Protokolová emise — coinbase output 2 (post-activation s node reward) |

---

*„Peníze, které tečou nahoru, netečou do kapsy. Tečou do otázky: co si zaslouží letět?"*

**Navigace:** [← Kapitola 5: Dědictví stanic](./05-Dedictvi-Stanic.md) · [Kapitola 7: Hlídač na okraji →](./07-Hlidac-Na-Okraji.md)
