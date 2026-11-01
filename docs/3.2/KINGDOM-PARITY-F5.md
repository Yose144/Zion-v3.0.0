# F5 — paritní checklist portálů (stav 2026-11-01)

> **Vztah:** brána fáze F5 v [`Kingdom/PLAN.md`](../../Kingdom/PLAN.md) §1 — „paritní checklist per povrch = 100 %, žádná funkce nezmizela".
> **Pravidlo:** povrch smí zhasnout (F6) až když má v portálu náhradu. Co **nemá** náhradu, zůstává živé a je to tady vidět — ne v hlavě.

## Jak číst

- **má** = portál to opravdu ukazuje (deklarované čtení + UI).
- **handoff** = portál to nedělá a **řekne proč**, s odkazem na povrch, který to dělá. To je platná náhrada pro čtení, **ne** pro zápis (hlas, nákup, ovládání).
- **chybí** = díra, kterou je potřeba doplnit, nebo vědomě vyřadit z rozsahu.

## 1. Řetěz ← `/explorer`, `/network`, `/mining`

| Funkce eXploreru | Portál | Poznámka |
|---|---|---|
| výška, obtížnost, peers, mempool, hashrate, block time | **má** | `/api/blockchain/stats`, cache 20 s |
| poslední bloky (výška, čas, počet tx, miner) | **má** (F5, 2026-11-01) | `/api/blockchain/blocks`, cache 15 s, klik → eXplorer |
| poslední transakce (částka, typ, from → to) | **má** (F5, 2026-11-01) | `/api/blockchain/transactions` |
| detail bloku, detail tx | handoff | `/explorer/block?id=`, `/explorer?tx=` — ověřeno klikem |
| hledání adresy, historie adresy | **chybí** | P1: chce `/api/blockchain/address` + stav „hledám" v klientovi |
| richlist, emisní grafy, konsensus, most | handoff | archiv a grafy zůstávají v eXploreru (rozhodnutí: portál je okno) |

## 2. Kovárna ← `pool.zionterranova.com`, `/pool`, `/miner-stats`

| Funkce poolu | Portál | Poznámka |
|---|---|---|
| mince, upstream nohy, payout mode, fee | **má** | `/public/v1/coins` |
| těžaři: worker, hashrate, accept rate, shares | **má** (F4, 2026-11-01) | `/public/v1/miners`, cache 30 s |
| historie poolu (hashrate, accepted, online) | **chybí** | P1: `/public/v1/history` je levné, chybí jen UI (sparkline bez knihovny) |
| výplaty, luck, nalezené bloky | **chybí** | P2: `/public/v1/payouts`, `/public/v1/blocks` |
| detail těžaře (jeho historie, payouty) | **chybí** | P2: chce `/public/v1/miner/{coin}/{wallet}/…` + vstup na adresu |
| ovládání poolu (restart, drain) | handoff | `/ops/` za basic auth — operátorské, ne klientské |

## 3. Tržiště ← `market.zionterranova.com`, `/market`

| Funkce | Portál | Poznámka |
|---|---|---|
| výloha produktů (8) | **má** | `/api/shop/products?pageSize=8` |
| celý katalog, filtr, košík, pokladna, faktury, doprava | handoff | deep-link `?category=` — peníze zůstávají na marketu (F4b) |
| DeFi (swap, bridge, staking — `/market` na webu) | **chybí / mimo rozsah** | není e-shop; buď samostatný portál, nebo zůstává na `app.` |

## 4. Knihovna ← `/whitepapers`, `/zion-archive`, `canon/books`

| Funkce | Portál | Poznámka |
|---|---|---|
| katalog knih | **má** | codegen z `canon/books` (15 knih) |
| čtení knihy po kapitolách, PDF | handoff | `app.zionterranova.com` — 149k LOC dokumentace do klienta nepatří |

## 5. Přístav (L5) ← `/l5-free-world`

| Funkce | Portál | Poznámka |
|---|---|---|
| fond, granty, projekty | **má** | 3 čtení, ZIONy počítané z flowers |

## 6. Věž (L3) ← `/l3-hiran`, ai-native

| Funkce | Portál | Poznámka |
|---|---|---|
| stav inference, model, backend | **má** | probe `/api/ai-chat` |
| rozhovor | **má** (F4a) | serverový proxy, rate limit 20/min, offline = 200 |

## 7. Issobella (L6) ← `/l6-isobella`

| Funkce | Portál | Poznámka |
|---|---|---|
| health služby | **má** | |
| papers, anchory, důkazy | **chybí** | blokuje nenasazené 6.B4 (proxy 404) — portál to **říká nahlas** (`status: placeholder`) |

## 8. Účet ← `/account`, `/wallet`

| Funkce | Portál | Poznámka |
|---|---|---|
| přihlášení podpisem (ZIS, Ed25519) | **má** | fráze se derivuje v prohlížeči, klíč nikam nejde |
| odhlášení, hlavní adresa, propojené adresy | **má** | `getCurrentUser` |
| zůstatky, historie transakcí, odesílání | **chybí** | P1: čtení musí jít přes `@zion/api` (RPC), zápis = peníze → **mimo Kingdom** |
| správa propojených peněženek (link/unlink) | **chybí** | P2: vyžaduje ZIS admin cestu — samostatné rozhodnutí |

## 9. Snem (L2) ← `/dao`

| Funkce | Portál | Poznámka |
|---|---|---|
| strážci, stav návrhů, circulate supply | **má** | `/api/dao/*`, cache 60–300 s |
| hlasování, vytvoření návrhu | handoff | hlas podepisuje peněženka (F4d) — do portálu nepatří |

---

## Souhrn

| Stav | Portály |
|---|---|
| **100 % (má / platný handoff)** | Přístav, Věž, Snem, Knihovna, Účet (čtení) |
| **~80 %** | Řetěz (chybí hledání adresy), Kovárna (chybí historie, výplaty) |
| **~60 %** | Tržiště (katalog/pokladna = handoff; DeFi mimo rozsah) |
| **blokováno** | Issobella (čeká na 6.B4) |

**Do F5 ještě patří (P1):** hledání adresy v Řetězu, historie poolu v Kovárně, zúžení `website-v2.9`
o duplicitní povrchy (`/pool`, `/market`, `/l4-oasis`, `/explorer`) na odkazy — to je druhá půlka F5
a smí se udělat až po 30 dnech redirectu podle §3 plánu.
