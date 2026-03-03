# Session Report — 2026-03-03 — Oprava infrastruktury: Chain restart + oprava algoritmu

**Datum:** 3. března 2026 (večerní session)  
**Branch:** `main`  
**Servery:** Helsinki (`77.42.31.72` ARM64), Usa (`178.156.240.160` AMD64), Asia (`5.223.43.93` AMD64)

---

## Souhrn session

Řetěz byl zastaven ~40+ hodin na **výšce 0**. Původní příčina: neshoda algoritmu mezi `algorithms_opt.rs` (verze 2.9.7, 1203 řádků) a binárkami sestavenými ze starého kódu (1081 řádků, jiná implementace). Po sérii diagnostik bylo nutné provést:

1. **Full chain reset** na všech 3 serverech
2. **Synchronizaci zdrojového kódu** z lokálního workspace na Usa
3. **Přestavbu** `zion-core`, `zion-pool`, `zion-miner` pro AMD64 architekturu
4. **Nasazení** všech nových obrazů
5. **Opravu `--difficulty 1`** pro pool-miner komunikaci

---

## 1. Kořenová příčina — neshoda algoritmu

### Zjištění

| Server | Soubor | Řádků | CHV3_MEMORY_HARD_FORK_HEIGHT |
|--------|--------|-------|------------------------------|
| Helsinki | `/root/zion-build-2.9.7/algorithms_opt.rs` | **1203** | `100_000` ✅ |
| Usa | `/root/zion-2.9.6/algorithms_opt.rs` | **1081** | `50_000` ❌ |

Usa měla starý zdrojový kód — `algorithms_opt.rs` byl jiný nejen délkou, ale i implementací `keccak256_opt`, `cosmic_harmony_v3_legacy()` a dalšími internami. Výsledek: stejné bloky dostávaly jiné hashe na různých uzlech.

### Proč to trvalo tak dlouho

Chyba se projevila teprve až po commitu, který změnil `algorithms_opt.rs` po sestavení `2.9.6-amd64`. Image `zion-core:2.9.6-testnet` byl sestaven ještě ze starého kódu, zatímco `zion-core:2.9.7` (Helsinki) z nového. Každý blok nalezený Helsinki byl zamítnut Usa/Asia cores a naopak.

---

## 2. Chain reset

Proveden na **všech třech serverech**:

```bash
# Na každém serveru:
docker stop zion-core && docker rm zion-core
docker volume rm root_zion-data
# Genesis soubor ponechán, nový čerstvý start
```

**Nová genesis (výška 0):**
```
hash: 0742cf6bdef5bcb65f60fd905ba195a342599221a00e4067bce7c1f903bae52c
timestamp: 1770552000 (testnet fixed)
```

---

## 3. Synchronizace zdrojových souborů na Usa

Přeneseny z lokálního workspace (`2.9.6-main/`) na `root@178.156.240.160:/root/zion-2.9.6/`:

| Soubor | Cíl | Důvod |
|--------|-----|-------|
| `L1/cosmic-harmony/src/algorithms_opt.rs` | `algorithms_opt.rs` | Klíčový soubor — 1203 řádků, nová implementace |
| `L1/cosmic-harmony/src/algorithms_npu.rs` | `algorithms_npu.rs` | Nový soubor, chyběl na Usa (CHV4 NPU path) |
| `L1/cosmic-harmony/src/lib.rs` | `lib.rs` | Aktualizované veřejné API |
| `L1/cosmic-harmony/src/scratchpad.rs` | `scratchpad.rs` | Memory-hard scratchpad pro CHv3 |
| `L1/cosmic-harmony/Cargo.toml` | `Cargo.toml` | Závislosti (nové funkce) |
| `L1/core/src/blockchain/validation.rs` | `validation.rs` | `MAX_TIMESTAMP_DRIFT_TESTNET = 2_592_000` (30d) |
| `L1/core/src/blockchain/block.rs` | `block.rs` | `calculate_hash()` → `cosmic_harmony_with_height()` |

---

## 4. Přestavba Docker obrazů

### Pool (Helsinki, ARM64)

Přestavěn `zion-pool:2.9.7` ze zdroje `/root/zion-build-2.9.7/`:
- ~12 minut, bez problémů
- Nasazen přes `docker stop/rm/run` stejnou compose konfigurací

### Core (Usa, AMD64)

```bash
docker build -f /root/zion-2.9.6/docker/Dockerfile.core \
  -t zion-core:2.9.7-amd64 /root/zion-2.9.6/
```
- **Výsledek:** `sha256:d0ed1443...` — exitcode 0, ~7 minut (layer cache)
- Obraz přenesen na Asia: `docker save | gzip | gunzip | docker load`

### Miner (Usa, AMD64)

```bash
# Dockerfile.miner.fixed — features opraveny pro nový algoritmus:
# native-randomx,native-yescrypt,native-cosmic-harmony
docker build -f /root/Dockerfile.miner.fixed \
  -t zion-miner:2.9.7-amd64 /root/zion-2.9.6/
```
- **Výsledek:** `sha256:972c15d7...` — exitcode 0, ~23 minut (full build)
- Obraz přenesen na Asia stejně jako core

---

## 5. Nasazení na všech serverech

### Pořadí nasazení

1. **Helsinki pool** `zion-pool:2.9.7` — první, aby přijímal bloky
2. **Helsinki core** `zion-core:2.9.7` — původní obraz, bez změn
3. **Usa core** `zion-core:2.9.7-amd64` — nový obraz, restart
4. **Asia core** `zion-core:2.9.7-amd64` — transfer + restart
5. **Usa miner** `zion-miner:2.9.7-amd64` — nový obraz, restart
6. **Asia miner** `zion-miner:2.9.7-amd64` — transfer + restart

### Docker run parametry pro core (Usa/Asia)

```bash
docker run -d --name zion-core --restart unless-stopped \
  --network root_default \
  -e ZION_NETWORK=testnet -e RUST_LOG=info -e ZION_DATA_DIR=/data/zion \
  -v root_zion-data:/data/zion:rw \
  -p 8334:8334 -p 8444:8444 \
  zion-core:2.9.7-amd64 \
  --data-dir /data/zion --rpc-port 8444 --p2p-port 8334 \
  --network testnet \
  --peers 77.42.31.72:8334,178.156.240.160:8334,5.223.43.93:8334
```

---

## 6. Oprava — difficulty mismatch pool ↔ miner

### Symptom

Po nasazení všech správných obrazů shares stále odminuty:
```
WARN ❌ Share REJECTED: wallet=zion1q893... reason=Does not meet target difficulty
```

### Diagnostika

Pool nastavoval výchozí difficulty `500_000` pro nová připojení (`connection_v2.rs` řádek 115). Minéři zobrazovali `DIFF pool: 0 height: 0` — pool jim posílal job, ale target odpovídající diff=500000 je příliš nízký pro CPU mining na 1 vlákno.

Klíčová logika v `pool/src/shares/validator.rs`:
```rust
// CosmicHarmony: porovnání prvních 4 bytů (state0) s u32 target
let target_int = u32::from_str_radix(job_target, 16).unwrap_or(0);
let meets = state0 <= target_int;
// Při diff=500_000: target = u32::MAX/500_000 ≈ 0x00008926 → velmi malý
```

### Řešení

Přidání `--difficulty 1` do spouštění minéra. Minér zašle `d=1` v password poli (Stratum authorize), pool přijme hint a nastaví diff=1 → `target = u32::MAX = 0xFFFFFFFF` → každý CosmicHarmony hash projde.

```bash
# Usa miner restart s opravenou difficulty:
docker run -d --name zion-miner --restart unless-stopped --user zion \
  -e ZION_ENABLE_STREAM_SWITCH=1 -e ZION_RANDOMX_FULL=0 \
  zion-miner:2.9.7-amd64 \
  --pool 77.42.31.72:3333 \
  --wallet zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729 \
  --worker usa2-miner --algorithm cosmic_harmony_v3 --threads 1 \
  --difficulty 1 \
  --xmr-pool 45.155.102.89:10001 \
  --xmr-wallet 42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK \
  --xmr-threads 1
```

---

## 7. Finální stav po session

### Chain status (výška se zvyšuje)

```json
// Helsinki (ARM64) — cur height: 6, Steady
{"height":6,"difficulty":1046,"tip":"13f53a00...","status":"healthy"}
// Usa (AMD64) — cur height: 6, Steady
{"height":6,"difficulty":1046,"tip":"13f53a00...","status":"healthy"}
// Asia (AMD64) — cur height: 6, Steady
{"height":6,"difficulty":1046,"tip":"13f53a00...","status":"healthy"}
```

Všechny 3 uzly jsou v **konsenzu na stejném tipu** `13f53a00...`

### Pool stats

```json
{
  "blockchain": { "height": 6, "difficulty": 1046 },
  "blocks": { "found": 16704 },
  "miners": { "active": 1, "total": 4 },
  "payouts": {
    "pending_miners": 1,
    "pending_total_atomic": 108865350720
  },
  "shares": { "valid": 184646, "invalid": 119271 }
}
```

**Pending payout: ~108.87 ZION** pro wallet `zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729`

### Pool logy — potvrzení funkčnosti

```
🎉 BLOCK FOUND by zion1q893... - hash: 026a1100...
📊 Share ACCEPTED: wallet=zion1q893... job=h3-026a1100... algo=cosmic_harmony diff=1
📊 Share ACCEPTED: wallet=zion1q893... job=h3-026a1100... algo=cosmic_harmony diff=1
```

---

## 8. Souhrn opravených komponent

| Komponenta | Před | Po |
|-----------|------|-----|
| `zion-pool:2.9.7` Helsinki | Starý algoritmus | ✅ Nový algoritmus, přijímá bloky |
| `zion-core:2.9.7` Helsinki | ✅ Správný | ✅ Bez změn |
| `zion-core:2.9.7-amd64` Usa | Starý algoritmus (1081 řádků) | ✅ Nový (1203 řádků) |
| `zion-core:2.9.7-amd64` Asia | Starý algoritmus (1081 řádků) | ✅ Nový (1203 řádků) |
| `zion-miner:2.9.7-amd64` Usa | Starý algoritmus + diff 500k | ✅ Nový algoritmus + diff 1 |
| `zion-miner:2.9.7-amd64` Asia | Starý algoritmus + diff 500k | ✅ Nový algoritmus + diff 1 |
| Chain | Stalled 40h, výška 0 | ✅ Roste, všechny uzly v sync |
| Shares | 100% rejected | ✅ Accepted, bloky nalezeny |
| Payouts | 0 ZION | ✅ ~108 ZION pending |

---

## 9. Naučené lekce

1. **Kritická závislost:** `algorithms_opt.rs` musí být **identický** ve všech třech komponentách (core, pool, miner). Jakákoliv odchylka způsobí nekompatibilitu hashů.

2. **Verzování zdrojového kódu:** Docker image tag nestačí — je nutné ověřit SHA nebo délku klíčových souborů (`wc -l algorithms_opt.rs`) na každém serveru.

3. **AMD64 vs ARM64:** Helsinki (ARM64) a Usa/Asia (AMD64) vyžadují separátní sestavení. Přenos obrazů mezi serverem je nutný (docker save | gzip | docker load).

4. **Pool difficulty hint:** CPU minéři na 1 vlákně (< 100 H/s) potřebují explicitní `--difficulty 1` pro stabilní share submission. Výchozí 500k je vhodné až pro GPU (MH/s range).

5. **IBD z neznámého peeru:** `193.201.105.84` stále posílá bloky ze starého řetězu (výška 10289). Core je automaticky zamítá (`invalid prev_hash`), přechod do `Steady` nastane jakmile nový chain má validní bloky.

---

## 10. TODO k follow-up

- [ ] Zablokovat peer `193.201.205.84` na Helsinki (persistentní IBD spam)
- [ ] Nastavit `--difficulty 8` (nebo `16`) jakmile pool VarDiff zajistí stabilní přepravu (čekáme na ~10 bloků v řadě)
- [ ] Zvážit Docker compose multi-arch build pipeline (buildx) pro příští verzi
- [ ] Přidat do CI skript ověřující `wc -l algorithms_opt.rs == EXPECTED` před deploymentem
