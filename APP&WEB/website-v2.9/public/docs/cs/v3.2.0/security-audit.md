# ZION 3.2 "One Love" — Shrnutí bezpečnostního auditu

> **Datum auditu:** 26. srpna 2026  
> **Remediation dokončeno:** 1. září 2026  
> **Rozsah:** Core consensus, multichain služba, pool, kontrakty, závislosti  
> **Stav:** 43 z 44 findings opraveno nebo akceptováno s mitigacemi

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
| **Celkem** | **44** |

| Výsledek | Počet |
|----------|-------|
| Opraveno | 35 |
| Akceptováno s mitigací | 5 |
| Odloženo na v3.3 | 4 |
| **Celkem řešeno** | **44** |

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

Malý počet findings byl akceptován s dokumentovanými mitigacemi nebo odložen na v3.3:

| Finding | Důvod |
|---------|-------|
| Merkle root construction | Nestandardní plochý hash; riziko nízké v současném single-pool modelu. Proper Merkle tree je v plánu pro v3.3. |
| Dependency advisories | Vybrané Rust networking závislosti mají známá advisories. Kompenzační opatření (reverse proxy, rate limiting, minimální externí expozice) jsou nasazena. Plná migrace na nástupnický stack je v plánu pro v3.3. |
| HTLC memo replay | `SWAP:LOCK` memo používá unikátní hashlock per swap. Další explicitní nonce odložen, aby se nerozbily existující swapy. |
| Swap executor atomicity | Two-phase commit odložen na v3.3; současný tok je chráněn audit journal a idempotentními order stavy. |

---

## Verifikace

Veškerý Rust kód se kompiluje čistě a příslušné testové sady procházejí:

- Core node testy
- Pool testy
- Multichain testy

Audit report je součástí open-source repozitáře. Externí review před veřejným launchi 31. prosince 2026 je stále doporučeno.
