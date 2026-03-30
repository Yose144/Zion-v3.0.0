# REPORT: CH3 Log Snapshot
**Date:** 18. ledna 2026  
**Scope:** rychlý výřez produkčních logů pro ověření CH3 init / runtime stavu

---

## 🇸🇬 Singapore (5.223.56.122 / `zion-pool-singapore`)

### Markery (CH3 init)
- Vidět načtení configu a detekci CH3 (`ch3_config_seen`).
- Vidět nakonfigurované wallets (`ch3_hash_submitter_configured`).
- Vidět připojení na externí pooly (ETC + RVN) a autorizaci.

```log
2026-01-18 22:44:36 | INFO     | __main__ | 🧩 Loaded pool configuration from /app/config/pool_config.json
2026-01-18 22:44:36 | INFO     | __main__ | ch3_config_seen enabled=True etc_enabled=True dynamic_enabled=True
2026-01-18 22:44:36 | INFO     | __main__ | ch3_hash_submitter_configured wallets=['ETC', 'RVN']
2026-01-18 22:44:37 | INFO     | src.pool.ch3_hash_submitter | ch3_external_pool_connected coin=RVN host=rvn.2miners.com port=6060
2026-01-18 22:44:37 | INFO     | src.pool.ch3_hash_submitter | ch3_external_pool_connected coin=ETC host=etc.2miners.com port=1010
2026-01-18 22:44:37 | INFO     | src.pool.ch3_hash_submitter | ch3_external_pools_connected coins=['ETC', 'RVN'] connected=2 total=2
2026-01-18 22:44:37 | INFO     | __main__ | 🔗 CH v3 Multi-Chain Submitter connected
```

---

## 🇫🇮 Helsinki (77.42.31.72 / `zion-pool-helsinki`)

### Markery (CH3 init)
- V posledních ~3000 řádcích (`docker logs --tail 3000`) se **neobjevily** žádné CH3 init markery (`ch3_config_seen`, `ch3_hash_submitter_configured`, `Multi-Chain Submitter connected`).
- To typicky znamená, že pool nebyl v tom okně restartovaný (nebo logy jsou přesměrované/rotované jinam).

### Runtime problém (tail logu)
- Log snapshot ukazuje opakované `RPC error: Block rejected` při submitu nalezených bloků.

```log
Exception: RPC error: Block rejected
ERROR:src.pool.network.protocol_handler:❌ BLOCK SUBMISSION FAILED!
ERROR:src.pool.blockchain.rpc_client:RPC result error: Block rejected
ERROR:src.pool.network.protocol_handler:Block submission error: RPC error: Block rejected
Traceback (most recent call last):
  File "/app/src/pool/network/protocol_handler.py", line 773, in _submit_found_block
    accepted = await self.rpc_client.submit_block(...)
  File "/app/src/pool/blockchain/rpc_client.py", line 245, in submit_block
    result = await self.call("submitblock", params)
  File "/app/src/pool/blockchain/rpc_client.py", line 129, in call
    raise Exception(f"RPC error: {result['error']}")
```

---

## ✅ Doporučený follow-up
- Pokud chceš i na Helsinki „CH3 init snapshot“, je potřeba buď:
  - restartnout pool kontejner (a pak vzít `docker logs --since 3m`), nebo
  - vytáhnout log soubor z hosta (pokud se loguje do souboru mimo stdout).
- Pro `Block rejected`:
  - zkontrolovat, že pool míří na správný blockchain RPC a že template/height odpovídá chainu (častý důvod rejectů).
