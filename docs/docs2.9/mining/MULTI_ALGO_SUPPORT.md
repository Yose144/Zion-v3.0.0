# ZION Universal Pool - Multi-Algorithm Support

## Přehled
ZION Universal Pool nyní podporuje několik těžebních algoritmů současně:
- **RandomX** (CPU miners - XMRig)
- **KawPow** (GPU miners - SRBMiner/T-Rex - placeholder implementace)
- **Připraveno pro Ethash** (budoucí rozšíření)

## Nové funkce v login protokolu

### Výběr algoritmu při přihlášení
Nový nepovinný parametr `algo` nebo `algorithm` v login request:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "login",
  "params": {
    "login": "ZION_C806923E65C3640CFFB3DA786A0BF579",
    "pass": "x",
    "algo": "kawpow"
  }
}
```

### Podporované hodnoty algoritmu
- `randomx`, `rx`, `rx/0` → RandomX (CPU)
- `kawpow`, `kp`, `kaw` → KawPow (GPU placeholder)
- Nezadáno nebo neznámé → fallback na RandomX

## Formáty jobů

### RandomX job (stávající)
```json
{
  "job_id": "zion_rx_000001",
  "blob": "0606...",
  "target": "b88d0600",
  "algo": "rx/0",
  "height": 1001,
  "seed_hash": "abcd...",
  "created": 1727723456.789,
  "difficulty": 10000
}
```

### KawPow job (nový)
```json
{
  "job_id": "zion_kp_000002",
  "algo": "kawpow",
  "height": 200002,
  "epoch": 26,
  "seed_hash": "1234...",
  "header_hash": "5678...",
  "mix_hash": "90ab...",
  "target": "ffff0f00",
  "created": 1727723456.789,
  "difficulty": 500
}
```

## Architektonické změny

### 1. Rozšířená session struktura
Každý miner má nyní:
- `algorithm`: 'randomx' nebo 'kawpow'
- `type`: 'cpu' nebo 'gpu' (odvozeno z algoritmu)
- `difficulty`: per-algoritmus základní hodnoty

### 2. Multi-algo job management
- `current_jobs['randomx']` - aktuální RandomX job
- `current_jobs['kawpow']` - aktuální KawPow job
- `get_job_for_miner()` vybírá podle `miner.algorithm`

### 3. Validace shares
Nová kontrola algoritmu (error code -6):
- KawPow miner může submitovat pouze KawPow joby
- RandomX miner pouze RandomX joby
- Ochrana proti cross-algo útokům

### 4. Adaptivní obtížnost per-algoritmus
- CPU (RandomX): výchozí 10000, rozsah 500-2M
- GPU (KawPow): výchozí 500, stejný algoritmus úprav

## Testování

### RandomX login test
```bash
python test_login.py
```

### KawPow login test
```bash
printf '{"id":1,"jsonrpc":"2.0","method":"login","params":{"login":"ZION_0123456789ABCDEF0123456789ABCDEF","pass":"x","algo":"kawpow"}}\n' | nc 91.98.122.165 3333
```

Očekávaná odpověď obsahuje `result.job.algo` = `"kawpow"`.

## Nasazení
```bash
bash deploy_xmrig_pool.sh
```

Skript automaticky:
1. Ověří lokální soubor (SHA256)
2. Zkopíruje na server
3. Vytvoří robustní `start_pool.sh`
4. Spustí pool s fallbackem python3→python
5. Zobrazí logy a port status

## Kompatibilita

### Stávající miners
- **XMRig**: funguje beze změn (fallback randomx)
- **Podporované ZION adresy**: `ZION_` + 32 hex (celkem 37 znaků)

### Nové miners (připraveno)
- **SRBMiner**: použít `--algorithm kawpow` a custom login s `"algo":"kawpow"`
- **T-Rex**: podobně s KawPow parametry

## Známá omezení (placeholder verze)

### KawPow implementace
- ❌ **Žádný reálný DAG výpočet** - epoch je mock
- ❌ **Žádná hash verifikace** - stejné pseudo-pravidlo jako RandomX
- ❌ **Hardcoded target/difficulty** - adaptivní, ale bez skutečného hash checku
- ✅ **Správná job struktura** pro budoucí plnohodnotnou implementaci
- ✅ **Multi-algo session management**
- ✅ **Error handling a validace**

### Roadmap pro plnou KawPow podporu
1. Implementace DAG generování (ethash-like)
2. Reálná KawPow hash verifikace
3. GPU-specifické difficulty algoritmy
4. Integration s T-Rex/SRBMiner
5. Monitoring GPU hashrate vs CPU

## Error kódy

| Kód | Popis | Kontext |
|-----|--------|---------|
| -1 | Invalid job_id | Job neexistuje v `self.jobs` |
| -2 | Invalid hex format | Nonce/result není hex |
| -3 | Length out of range | Příliš krátký/dlouhý hex |
| -4 | Duplicate share | (job_id, nonce) už odesláno |
| -5 | Low difficulty | Mock: result začíná 'ffff' |
| -6 | Algo mismatch | **NOVÉ**: KawPow miner × RandomX job |

## Monitoring

### Logování
```
🖥️ Miner Login from ('192.168.1.100', 45678)
💰 Address: ZION_C806923E65C3640CFFB3DA786A0BF579
✅ Valid ZION address detected!
🧮 Algorithm requested: kawpow
✅ Miner login successful (algo=kawpow)
🔥 KawPow job: zion_kp_000003 epoch=27
📡 Periodic job #1 sent to ('192.168.1.100', 45678) (algo=kawpow)
```

### Session přehled
```bash
ssh root@91.98.122.165 'tail -f pool.log | grep -E "(Login|algo=|job:)"'
```

---

*Dokumentace vygenerována pro ZION Universal Pool v2.1 - Multi-Algorithm Support (Říjen 2025)*