# ZION 3.2 "One Love" — Shrnutí bezpečnostního auditu

> **Datum auditu:** 26. srpna 2026  
> **Remediation dokončeno:** 1. září 2026  
> **Rozsah:** Core consensus, multichain služba, pool, kontrakty, závislosti  
> **Stav:** 48 findings reviewováno celkem: 37 opraveno, 7 akceptováno s mitigacemi, 4 odloženo na v3.3

---

## Přehled

Interní bezpečnostní audit kódové báze ZION 3.2 "One Love" byl dokončen koncem srpna 2026. Audit pokryl L1 core, multichain službu, pool, miner, EVM kontrakty a strom Rust závislostí.

**V produkčních cestách nebyly nalezeny chyby způsobující ztrátu prostředků.** Všechny kritické a vysoko-severitní findings, které by mohly vést ke ztrátě prostředků, byly opraveny před zveřejněním tohoto shrnutí.

---

## Shrnutí findings

| Severity | Počet |
|----------|-------|
| Critical | 2 |
| High | 10 |
| Medium | 20 |
| Low / Info | 12 |
| **Celkem se severity** | **44** |

Severity rating má přiřazeno 44 findings. Další 4 závislostní/odložené položky celkový počet navýšily na 48.

| Výsledek | Počet |
|----------|-------|
| Opraveno | 37 |
| Akceptováno s mitigací | 7 |
| Odloženo na v3.3 | 4 |
| **Celkem řešeno** | **48** |

---

## Kritické a vysoko-prioritní opravy

| Finding | Co to bylo | Oprava |
|---------|------------|--------|
| **Pool share difficulty** | Pool mohl akceptovat share s příliš malou prací | Minimální share difficulty 1000 vynucena napříč poolem |
| **Block payout idempotency** | Výplata nalezeného bloku se mohla zpracovat vícekrát | `paid_block_heights` guard a deduplikace výplat |
| **Contract minter role** | Minter role byl fixní při deployi | `AccessControl` s `MINTER_ROLE`, `SLASHER_ROLE` a bezpečným převodem |
| **Token burn** | Token contract neměl burn, což rozbíjelo slashing | `burn()` přidán a omezen na slasher roli |
| **Bridge replay** | Bridge mohl matchnout stejný deposit vícekrát | Zdrojový `tx_hash` přidán do matchovacího klíče |
| **HTLC source verification** | Target lock se mohl vytvořit před source lockem | Source lock je nyní potvrzen před vytvořením target locku |
| **HTLC preimage strength** | Preimage pocházel ze slabého zdroje | Preimage je nyní generováno z OS CSPRNG |
| **HTLC preimage storage** | Preimage uložen jako plaintext | Preimage šifrován v klidu s konfigurovatelným klíčem |
| **Solver bid signatures** | Solver bid podpisy nebyly verifikovány | Podpisy bidů ověřeny proti registrovaným veřejným klíčům |
| **Wallet sign phishing** | Peněženka mohla podepsat libovolné útočníkovy zprávy | Typed signing s doménovým tagem `ZION_WALLET_SIGN:v1` |
| **Deposit proof validation** | Deposit proofy byly akceptovány bez on-chain kontroly | Proofy nyní ověřeny proti zdrojovému chainu |
| **Rate limiter memory** | Per-IP / per-user buckety se nikdy neevikovaly | TTL-based eviction s limitní velikostí |

---

## Akceptované a odložené položky

Část findings byla akceptována s dokumentovanými mitigacemi nebo odložena na v3.3:

| ID | Stav | Důvod |
|----|------|-------|
| FIND-014 | Akceptováno | `swap_executor` debit-before-credit není atomický; mitigováno přes `JournalLedger` pro audit trail. Two-phase commit je v plánu pro v3.3. |
| FIND-015 | Akceptováno | `X-Solver-Key` putuje přes HTTP. V produkci jde solver traffic přes nginx s TLS. Vynucení `.https_only()` v kódu je v plánu pro v3.3. |
| FIND-022 | Akceptováno | Reconciliation `expected = internal + pool` bylo reviewováno a potvrzeno jako správné. Hot wallet drží user ledger balances a AMM rezervy jako oddělené účetní systémy. |
| FIND-024 | Akceptováno | `SWAP:LOCK` memo používá unikátní 32-bajtový hashlock per swap jako prevenci replay. Další explicitní nonce je odložen, aby se nerozbily existující swapy. |
| FIND-L1-001 | Akceptováno | Plochý BLAKE3 Merkle root je nestandardní. Riziko je nízké v současném single-pool modelu; proper Merkle tree je v plánu pro v3.3. |
| POL-008 | Akceptováno | Per-session rate limit je pro současné měřítko dostačující; IP-global budget je v plánu pro v3.3. |
| CON-004 | Akceptováno | `IntentSettlement` se deployuje se single EOA ownerem. Dokumentace doporučuje pro mainnet multisig nebo timelock. |
| DEP-001 | Odloženo | `ethers 2.0.14` táhne známá CVE přes `ring 0.16`, `h2 0.3` a `rustls-webpki 0.101`. Vyřešeno migrací na `alloy` ve v3.3. |
| DEP-002 | Odloženo | Unmaintained crates (`instant`, `fxhash`, `paste`, `rustls-pemfile`) se vyčistí migrací na `alloy` ve v3.3. |
| DEP-003 | Odloženo | 18 duplicitních verzí crate koexistuje kvůli `ethers 2.0.14`. Vyřešeno migrací na `alloy` ve v3.3. |
| Alloy migration | Odloženo | Deštníková migrace závislostí na `alloy` a moderní networking stack je naplánována na v3.3. |

---

## Verifikace

Veškerý Rust kód se kompiluje čistě a příslušné testové sady procházejí:

- Core node testy
- Pool testy
- Multichain testy

Audit report je součástí open-source repozitáře. Externí review před veřejným launchi 31. prosince 2026 je stále doporučeno.
