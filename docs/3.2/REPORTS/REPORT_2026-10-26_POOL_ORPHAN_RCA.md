# REPORT — Pool „stale blocks" (`previous hash mismatch`) — RCA 2026-10-26

**Vstup:** položka 2.B1 z [`3.2.1-3.2.9_PLAN.md`](../3.2.1-3.2.9_PLAN.md) — 15–21 % `submitBlock` selhání hlášených jako `consensus error: previous hash mismatch`; původní cíl „<2 %".
**Data:** `journalctl -u zion-v31-pool` (EDGE) za 24 h ≈ 457k řádků + `pool-store.db` (`blocks`, `shares`) + zdroj `stratum.rs`/`store.rs` na `ad8ab5895`.

## Výsledek v jedné větě

**Žádný blok se neztrácí.** Všech 357 selhání za 24 h jsou **vnitřní souběhy kandidátů na stejnou výšku uvnitř poolu** — konkurenční kandidát od jiného mineře poolu výšku vyhrál o 1–105 s dřív. Externí ztraty (kandidát poolu poražen blokem nalezeným mimo pool): **0 za 24 h**. Skutečný defekt je v účetnictví: pozdní `orphaned` zápis přepisuje `confirmed` řádek v `blocks` (opraveno níže).

## Čísla

| Metrika | Hodnota |
|---|---|
| submitBlock accept / 24 h | 1 312 |
| submitBlock fail / 24 h | 357 událostí (272 unikátních výšek) |
| Faily po pool-acceptu ≤120 s | 284 (~80 %) |
| Faily bez pool-acceptu ≤120 s | 73 → ale všechny výšky pool vyhrál (viz níže) |
| `notify_orphan` výšky ∩ `notify_block_found` výšky | **272 z 272 — 100 % interních souběhů** |
| Externí ztráty | **0** |
| Orphan rate z kandidátů | 357/1669 = **21,4 %** |
| Efektivní stale okno | medián 5,6 s · p90 26 s (od pool-acceptu po stale submit) |
| accept → další `mining.notify` broadcast | medián **0,83 s** (1s feed loop funguje) |

## Mechanismus

1. Všichni v3 mineři těží job pro `tip+1`. Kandidáti přicházejí Poissonovsky (průměrný interval ~52 s: 1 669 kandidátů/den).
2. Miner A najde řešení → `submitBlock` accept → tip se posune → feed loop (1 s poll) do ~1 s broadcastne `mining.notify` s `clean_jobs`.
3. Miner B mezitím na stejném jobu najde vlastní řešení — submit dorazí +1 až +12 s po acceptu → uzel zamítne `previous hash mismatch` → `record_block_orphaned` + `notify_orphan`.
4. Očekávaný podíl kolizí při průměrném intervalu 52 s a stale okně ~11 s ≈ `1−e^(−11/52)` ≈ **19 %** — odpovídá pozorovaným 21 %. **Rate je převážně důsledek kadence ~66 s bloků, ne chyba dispatchu.**

## Ekonomický dopad: ~nulový

- PPLNS credit se zapisuje při validaci share — před submitBlock. Prohraný kandidát share nemění.
- Výšku drží vítězný kandidát od téhož poolu (všech 272 případů) → reward přistál u poolu.
- `notify_orphan`/`record_block_orphaned` fungují správně; `template_cache.invalidate()` po acceptu i orphanu vynutí čerstvý template.

## Skutečné defekty nalezené během RCA

| # | Defekt | Dopad | Stav |
|---|---|---|---|
| D1 | `store.record_block`: `ON CONFLICT(coin,height) DO UPDATE SET status=?` — pozdní `orphaned` **přepíše `confirmed`**; all-time DB ukazuje 9 265 `orphaned` výšek (9,5 %), realita = převážně pool-vyhrané výšky | luck/orphan metriky a public reporting nafouklé; provenance vítězného kandidáta ztracena | **fix v commitu** — `confirmed` sticky + confirm refreshuje hash/miner (reg. test `block_orphan_write_does_not_downgrade_confirmed`) |
| D2 | Orphan metrika nerozlišuje interní souběh (kosmetika) vs externí ztrátu (revenue) | alert „stale blocks" míchá signál s šumem | doporučeno: split `orphan_won`/`orphan_lost` v `block_tracker`+api (W-dávka) |
| D3 | Po pool-acceptu feed loop čeká na 1s tick — wake-on-accept ušetří ~0,8 s stale okna | marginální (~1–2 % rate) | doporučeno, nízká priorita |

## Doporučení a předefinovaný cíl

Původní cíl „<2 % stale" je pro ~52s kandidátní kadenci s ~1s notifikací **fyzikálně nedosažitelný** (potřebovalo by stale okno <1 s end-to-end). Navrhuji metriku předefinovat:

- **External-loss rate <2 %** (reálný dopad) — dnes **0 %** ✅
- **`blocks` bookkeeping konzistentní** — opraveno (D1), deploy čeká na rebuild+restart poolu (🔀 — součást beta.2, restart ~10 s je v G8 rozpočtu, ale vyžaduje potvrzení)
- **Volitelné:** potlačit RPC submit kandidáta, když pool už výšku vyhrál (šetří uzel, čistší logy — `submit_found_block` → `store.has_confirmed_at_height`); miner-side abort na `clean_jobs` mimo kontrolu poolu.

## Overhead poznámky

- `shares.is_block` se nezapisuje (0 za 24 h) — per-height kandidátní statistika by z něj šla přesně; doplnit při W-dávce telemetrie.
- Pořadí zápisů do `blocks` je závod winner/loser — D1 fix řeší přesně toto.
