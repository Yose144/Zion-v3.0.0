# XMRig Integration s ZION Pool

**Datum:** 2. listopadu 2025  
**Verze:** 2.8.5

## Přehled

Úspěšně implementována plná kompatibilita ZION Universal Pool s XMRig minerem pro RandomX algoritmus.

## Změny

### Pool (zion_universal_pool_v2.py)

Přidána metoda `handle_monero_login()` pro zpracování Monero-style login požadavků od XMRig:

```python
async def handle_monero_login(self, data, addr):
    """Handle XMRig Monero-style 'login' method for RandomX.
    Expects params as object: {login, pass, agent, rigid?}
    Returns result {status:'OK', id, job:{...}} per Monero Stratum.
    """
```

**Klíčové aspekty:**
- Podporuje Monero Stratum protokol (metoda `login` místo `mining.authorize`)
- Vrací job v Monero formátu s poli: `job_id`, `blob`, `seed_hash`, `target`, `height`, `algo`
- Automaticky vytváří RandomX job s validním seedem a targetem
- Kompatibilní s XMRig 6.24.0+

### Routing

Aktualizován message router pro rozpoznání `method: "login"`:

```python
elif method == 'login':
    # Monero/XMRig-style login for RandomX
    return await self.handle_monero_login(data, addr)
```

## Testování

### Lokální test (2.11.2025 01:31-01:34)

**Konfigurace:**
- XMRig 6.24.0 (macOS ARMv8)
- Pool: www.zionterranova.com:3333
- Algoritmus: rx/0 (RandomX)
- Wallet: `ZIONGMKVE4FWNO3DUKL4VHF2WCYF7SM4HGFU`

**Výsledky:**
- ✅ Login úspěšný (žádné `error code: -1`)
- ✅ 10 validních share přijato (10/0)
- ✅ Hashrate: ~350 H/s (Apple M1, 8 threads)
- ✅ Consciousness Mining Game XP uděleno (+10 XP/share)
- ✅ Automatické joby generovány každých ~18s

### Pool logy

```
2025-11-02 00:31:42 - INFO - XMrig login: ZIONGMKVE4...HGFU from ('109.81.17.181', 4285)
2025-11-02 00:31:42 - INFO - XMrig login successful for ('109.81.17.181', 4285)
2025-11-02 00:31:51 - INFO - ✅ VALID RANDOMX SHARE ACCEPTED (Total: 1)
...
2025-11-02 00:34:24 - INFO - ✅ VALID RANDOMX SHARE ACCEPTED (Total: 9)
2025-11-02 00:34:24 - INFO - ✨ XP awarded: +10 (share submitted) - Total: 150 XP
```

## Konfigurace XMRig

### Minimální config.json

```json
{
    "pools": [
        {
            "algo": "rx/0",
            "url": "stratum+tcp://www.zionterranova.com:3333",
            "user": "YOUR_ZION_ADDRESS",
            "pass": "randomx",
            "rig-id": "desktop",
            "keepalive": true,
            "nicehash": false
        }
    ],
    "cpu": {
        "enabled": true,
        "max-threads-hint": 100
    }
}
```

### Parametry

| Parametr | Hodnota | Poznámka |
|----------|---------|----------|
| `algo` | `rx/0` | RandomX/0 (Monero compatible) |
| `url` | `stratum+tcp://www.zionterranova.com:3333` | ZION pool endpoint |
| `user` | ZION address | Formát: `ZION[A-Z0-9]{32}` |
| `pass` | `randomx` nebo `x` | Detekce algoritmu |
| `keepalive` | `true` | Doporučeno |
| `nicehash` | `false` | ZION nepoužívá Nicehash protokol |

## Deployment

### Produkční server (91.98.122.165)

1. **Upload kódu:**
```bash
scp src/core/zion_universal_pool_v2.py root@91.98.122.165:/root/
```

2. **Update Docker kontejneru:**
```bash
ssh root@91.98.122.165
docker cp /root/zion_universal_pool_v2.py zion-2.8.4-pool:/app/src/core/
docker restart zion-2.8.4-pool
```

3. **Verifikace:**
```bash
docker logs --tail 50 zion-2.8.4-pool
# Očekáváno: "Pool initialized" bez chyb
```

## Troubleshooting

### "login error code: -1"

**Příčina:** Nekompatibilní formát login odpovědi  
**Řešení:** Ověřte, že pool vrací čistý Monero-style result bez extra `set_difficulty`/`mining.notify` v první odpovědi

### "no active pools, stop mining"

**Příčina:** XMRig nerozpoznal job  
**Řešení:** Zkontrolujte formát job objektu - musí obsahovat `job_id`, `blob`, `seed_hash`, `target`

### Dataset initialization fails

**Příčina:** Nevalidní seed_hash  
**Řešení:** Seed musí být 64 hex znaků (32 bytes)

## Další vývoj

- [ ] Implementovat VarDiff pro XMRig (adaptivní obtížnost)
- [ ] Přidat statistiky pro XMRig minery v API
- [ ] Optimalizovat job refresh interval
- [ ] Podporovat další RandomX varianty (rx/wow, rx/arq)

## Reference

- XMRig dokumentace: https://xmrig.com/docs
- Monero Stratum protokol: https://github.com/xmrig/xmrig-proxy/wiki/Stratum-protocol
- ZION Pool API: http://www.zionterranova.com:3334/api/stats
