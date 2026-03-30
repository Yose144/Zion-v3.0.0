# DAILY SESSION LOG – 2025-09-29

## Shrnutí Dne
Dnešní práce se soustředila na posun experimentální "Zion Next Chain" větve z čistého genesis prototypu směrem k základnímu konsensu: přidána numerická difficulty, strukturované transakce, UTXO set, merkle root, block validator a testovací harness. Paralelně byla udržena kompatibilita s dřívějšími artefakty (manifest genesis) a vznikl roadmap log.

## Klíčové Body
- Přechod z prefix target na skutečný numerický target (BigInt) – modul `consensus/params.ts`.
- Refaktor genesis: těžba přes `mineGenesis()` s PoW (blake3 vrstvy + keccak), merkle root = přesné txid coinbase.
- Strukturovaná coinbase transakce (nové typy + deterministická serializace).
- Modul transakcí: `tx/types.ts`, `tx/serialize.ts` (hash = blake3(blake3(tx)||tx) -> keccak).
- In-memory UTXO set (`utxo/utxoSet.ts`) s coinbase maturitou 60 bloků.
- Merkle root implementace (`core/merkle.ts`) – blake3 leaf & internal + finální keccak overlay.
- Block validator (`core/blockValidator.ts`): kontrola coinbase, merkle, PoW, základní UTXO apply (shadow instance).
- Aktualizace genesis skriptu a verifikačního skriptu na numeric target.
- Testy: `genesis.spec.ts`, `utxo.spec.ts`, `blockValidator.spec.ts`.
- Roadmap log: `docs/ZION_NEXT_CHAIN_ROADMAP_LOG_2025-09-29.md` – fázový plán + průběžný stav.

## Přidané / Upravené Soubory (výběr)
- `zion-next-chain/scripts/genesis.ts` (refaktor na modulární těžbu + numeric target)
- `zion-next-chain/scripts/verify-genesis.ts` (numeric target validace)
- `zion-next-chain/src/consensus/params.ts` (INITIAL_TARGET, meetsTarget)
- `zion-next-chain/src/genesis/mineGenesis.ts` (strukturovaná coinbase, bez padEnd merkle root)
- `zion-next-chain/src/tx/types.ts`, `src/tx/serialize.ts`
- `zion-next-chain/src/utxo/utxoSet.ts`
- `zion-next-chain/src/core/merkle.ts`
- `zion-next-chain/src/core/blockValidator.ts`
- Testy: `tests/genesis.spec.ts`, `tests/utxo.spec.ts`, `tests/blockValidator.spec.ts`
- `zion-next-chain/jest.config.cjs`
- `docs/ZION_NEXT_CHAIN_ROADMAP_LOG_2025-09-29.md` (průběžný roadmap log)

## Provedené Koncepční Změny
1. Jasná oddělenost mezi legacy (bridge strict mode) a new-chain vývojem.
2. Standardizace hashování: blake3 vrstvení + keccak pro oblast PoW, tx i merkle (konzistentní doménové oddělení přes kombinaci sekvencí).
3. Příprava na budoucí rozšíření (PoW cosmic dharma fáze) díky modulárnímu powMix.
4. Determinismus genesis – testovatelný, opakovatelný.

## Technický Dluh / Další Krok
- Emisní funkce (block reward) – zatím fixní premine.
- P2P / chain fork logic – zatím pouze skeleton blockchain (starý placeholder vs nový validator modul – sjednotit).
- Adresní formát (zatím placeholder scriptPubKey = '51'+utf8hex(adresa)).
- Persistenční vrstva (LevelDB) chybí.
- Mempool + validace transakcí mimo blok.
- Lepší merkle (optimalizace, caching) – nyní dostačuje.
- Logging / konfig modul centralizace.

## Doporučené Zítřejší Priority
1. Block reward výpočet (emission schedule návrh + integrace do coinbase generace mimo genesis).
2. Integrace validatoru do unified `Blockchain` třídy, přechod z placeholder `core/blockchain.ts`.
3. Mempool skeleton (validace vstupní tx + rejection pravidla + fronta pro blok template).
4. Adresní formát rozhodnutí (Base58Check vs Bech32 variant) → úprava scriptPubKey generátoru.

## Rychlé Metriky / Kontrolní Body
- Počet testů: 3 soubory (genesis, utxo, blockValidator) – základní sanity.
- Genesis determinismus: zajištěn (stejný nonce/txid při opakování).
- UTXO maturity enforcement: testováno (spend pouze po 60 blocích).

## Poznámky
- Všechny crypto hash placeholdery by měly být auditovány před veřejným provozem (doménová separace, uniformita endianness).
- Doplnit definici emission curve do `CONSENSUS_PARAMS.md` nebo nového `EMISSION_SPEC.md`.

## Autor
Automatizovaná asistenční agentura – generováno 2025-09-29.
