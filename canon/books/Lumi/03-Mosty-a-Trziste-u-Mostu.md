# LUMI — Kapitola 3: Mosty a tržiště u mostu
## WARP · L2 — sto ZION přejde na ostrov a zpátky, pět strážců, čtyři podpisy a cena, která ještě není chleba

> *„Most je slib dodržený oběma směry."*

---

## Příběh

Z Domu Lumi vedla cesta dolů k vodě. Tam, kde Nová země končila a začínalo moře, stál most.

Nebyl z kamene. Byl ze světla — tenký, napjatý oblouk, který mizel v oparu nad vodou a na druhé straně se dotýkal ostrova, jemuž říkali Base. Lumi ho poznala z příběhů: stavitelé z Domu Lumi se kdysi podívali přes moře a řekli, že nezboří cizí ostrovy, ale postaví mezi nimi mosty.

U paty mostu stál kamenný trezor a vedle něj pět lidí v šedých pláštích. Nemluvili spolu. Každý držel svůj klíč.

Přišel nosič se sto stříbrnými mincemi. Vložil je do trezoru, trezor zaskřípal a zavřel se. Na druhém břehu, daleko v oparu, se rozsvítilo sto malých světel — stejný počet, jiný tvar. Nosič přešel most, na ostrově těch sto světel *zhaslo* — a na tomto břehu trezor sám povolil a mince se vrátily do jeho dlaně.

*„Proč jste ho nechali dvakrát přejít, když se nic nezměnilo?"* zeptala se Lumi.

*„Protože se něco změnilo,"* řekl nejstarší ze strážců. *„Teď víme, že most drží oběma směry. Zamknout — dát — spálit — odemknout. Kdo umí jen půlku, nemá most, má past."*

*„A proč vás je pět?"*

*„Aby nikdo z nás nebyl sám. Čtyři musíme souhlasit, než se trezor pohne. Jeden se může splést. Jeden může být zlý. Jeden může spát. Čtyři ne."*

---

Kousek od mostu, tam kde se sbíhaly cesty, bylo tržiště. Malé — jeden stánek, jedna váha. Prodavačka měnila stříbro z ostrova za chléb z pevniny.

*„Kolik chleba za tvoje stříbro?"* zeptala se jí Lumi jen tak, ze zvědavosti, a ukázala na lucernu, jako by byla k prodeji.

Prodavačka se podívala na váhu a řekla číslo.

*„Takže tolik mám,"* řekla Lumi.

*„Ne,"* usmála se prodavačka. *„Tolik bys **možná** dostala, kdybys mi to teď dala a já měla dost chleba a nikdo mezitím nepřišel a neodnesl polovinu. Řekla jsem ti cenu. Cena není chleba v ruce. Cena je slovo. Chleba je až to, co odneseš."*

Lumi si to zapamatovala. Bylo to skoro totéž, co jí řekl tesař o lucerně: co je, a co by mohlo být.

---

Když se otočila zpátky k moři, uviděla v mlze další oblouky. Mnoho. Některé mířily k ostrovům, o kterých slyšela — ostrov, kde se počítá zlatem, ostrov rychlých lodí, ostrov s bleskem ve jménu. Ale všechny byly zavřené a na každém visela dřevěná cedulka. Ne „zakázáno". Na každé bylo napsáno **proč**: *strážci ještě nejsou vybráni; klíč ještě nemá, kdo by ho držel; na druhém břehu ještě nikdo nečeká.*

*„Ty mosty tam jsou,"* řekla.

*„Jsou nakreslené,"* opravil ji strážce. *„Most, po kterém nikdo nepřešel tam a zpátky, není most. Je to čára. Až po něm někdo přejde oběma směry a my to zapíšeme, sundáme cedulku."*

---

Lucerna ukázala dnešek.

Světlo se zúžilo a Lumi viděla přesně dva ostrovy spojené živým mostem — Novou zemi a Base. Viděla, že po mostě opravdu přešlo sto mincí tam a zpátky a že to někdo zapsal. Viděla tržiště tak malé, jak skutečně bylo: na váze devatenáct dílků cizího chleba proti sto padesáti tisícům stříbrných — snímek jednoho dne, ne stálá míra. Viděla, že prodavačka umí říct cenu, ale že cesta *vlož — vyměň — vyber* pro obyčejného poutníka s vlastním uzlíkem se teprve zkouší, a že když ji někdo zkusil bez dostatečného stříbra, tržiště správně řeklo *nemáš dost* — což je odmítnutí, ne obchod. A viděla všechny ostatní oblouky se cedulkami, přesně tak, jak stály.

*„Dva ostrovy,"* řekla.

*„Dva,"* řekl strážce. *„Zapsané."*

---

## Co to znamená

**Mosty mají v celé knize nejpřísnější důkazní laťku — přísnější než zahrady i než nebe — protože na mostě drží síť cizí prostředky.** Kapitola bere obraz z šesté epizody Nirvany (*„mosty z čistého světla"*) a přidává k němu jediné pravidlo: **most je slib dodržený oběma směry, a dokud nebyl dodržen, je to čára na mapě.**

1. **Zamknout — dát — spálit — odemknout.** WARP bridge mezi ZION L1 a Base funguje tak, že ZION se zamkne v trezoru (vault) na L1, na Base vznikne stejné množství wZION (mint), při návratu se wZION spálí (burn) a trezor na L1 se odemkne. Tento úplný round-trip byl proveden a zapsán.
2. **Pět strážců, čtyři podpisy.** ZIONBridge na Base má pět validátorů a práh 4 z 5. Kdo tvrdí 5 z 5, cituje starší text; kanonický stav je 4/5.
3. **Cena není chleba.** DEX quote API vrací cenu; settlement je jiná věc. Kanonický trh je Uniswap V3 pool wZION/USDT — jediný živý, s malou likviditou. Vlastní AMM (ZionDex) je historie a je označen jako deprecated.
4. **Cedulka *proč*.** Konfigurace WARP má aktivní jen `base` a `zion-l1`. Všechny ostatní sítě mají výslovný `disabled_reason`. Každý nový chain musí projít vlastním threat modelem, deploy evidence a E2E maticí (M1.6) — a dokud neprojde, nesmí se říkat „podporovaný".
5. **Kdo drží klíče, musí být vidět.** Každá obrazovka má říct, zda jsou prostředky uživatelovy, delegované, nebo v úschově (M1.1). Dům jmen z předchozí kapitoly a most z této patří k sobě: identita bez skrytého správce, převod bez skrytého rizika.

---

## Kotva pravdy — ověřitelná fakta

> Most se neprokazuje krásou oblouku, ale zápisem o přechodu tam a zpátky. Snímek 2026-09-14; čísla z chainu se čtou z chainu, ne z knihy.

| Tvrzení / obraz | Stav | Kotva | Co ještě chybí |
|---|---|---|---|
| Most stojí: `warpd` / `zion-v31-multichain` běží; pilot Base + ZION L1 | **ŽIVÉ** | `StatusV3.md`; `V31/STATUS.md`; `warp.example.toml`; `V31/AGENTS.md` (WARP `127.0.0.1:8453`, DEX `8454`) | monitoring live config a vlastnictví klíčů bez zveřejnění tajemství |
| Sto mincí tam a zpátky: 100 ZION lock → 100 wZION mint na Base → burn → L1 unlock | **ŽIVÉ** | `V31/STATUS.md` (E4 round-trip) | opakovatelný audit a monitoring stavu validátorů |
| Pět strážců, čtyři podpisy: wZION `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`; ZIONBridge `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` (5 validátorů, threshold **4/5**); ZIONStaking `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | **ŽIVÉ** | `L2contracts.md`; `AGENTS.md` 2026-09-07 (oprava z dřívějšího 5/5) | — |
| Tržiště u mostu: jediný živý pool Uniswap V3 wZION/USDT `0x186b46c2f04153999d44D25179cD623fD62Bfda2` (0,3 %); snímek 2026-09-07 ≈ 19 USDT + 151 867 wZION; pooly wZION/WETH a wZION/USDC prázdné | **ŽIVÉ** (číslo je snímek) | `L2contracts.md`; `AGENTS.md` 2026-09-07 | likvidita se čte z chainu; dedikovaný Base RPC |
| Prodavačka řekne cenu: quote API `/v1/swap/quote`, `/v1/swap/quote/multi` a webový widget | **ŽIVÉ** | `StatusV3.md`; `ZionDexZis.md` 2026-08-29 | nezaměňovat quote za settlement |
| Vlož — vyměň — vyber s vlastním uzlíkem: funded E2E deposit → swap → withdraw pro uživatele | **STAVBA** | `MiseAmenti/07` §3; test evidence dosud „insufficient balance" bez funded test wallet | E2E s financovaným účtem, on-chain receipts, reconciliation, nezávislý review |
| Nezávislí nosiči (solver federace) v produkci | **STAVBA** | `warp.example.toml`: `[solver] enabled = false` | samostatní solvers, live config, incident policy |
| Ostatní oblouky: Arbitrum, Optimism, Polygon, Bitcoin, Solana, SUI, Aptos, Lightning „podporované" | **HORIZONT** | `warp.example.toml` — aktivní pouze `base` a `zion-l1`, ostatní `disabled_reason`; Solana adapter má hotový deposit watcher, ale `enabled = false` (`AGENTS.md` 2026-09-14) | samostatná evidence pro každý chain |
| Vlastní tržiště ZionDex (AMM na Base) | **historické / DEPRECATED** | `L2contracts.md` §2; `AGENTS.md` (ZIONDEX poznámka označena HISTORICAL) | — |
| Kdo drží klíče, musí být vidět (custody disclosure) | **STAVBA** | `MiseAmenti/04` M1.1 | označení user-controlled / delegated / custodial na každé obrazovce |
| Trezor, pět plášťů, prodavačka, cedulky v mlze | **MÝTUS** | `nirvana/06` + tato kniha | — |

---

*„Cena, kterou ti někdo řekne, ještě není chleba v ruce."*

**Navigace:** [← Kapitola 2: Dům jmen](./02-Dum-Jmen.md) · [Kapitola 4: Zlaté lůno a hlas bez klíče →](./04-Zlate-Luno-a-Hlas-Bez-Klice.md)
