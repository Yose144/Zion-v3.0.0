# Docker SHA-256 Manifest — ZION v2.9.7

> **Stav:** ZAZNAMENÁNO 2026-03-04 21:37 UTC  
> **Server:** Helsinki `77.42.31.72` (CAX21 ARM64)  
> **Platforma:** linux/arm64

---

## Produkční image

| Image | Tag | SHA-256 | Vytvořeno | Velikost |
|-------|-----|---------|-----------|----------|
| `zion-pool` | `2.9.7` | `sha256:20db3a4d8518f7c3b0b3efdc4aab01806a506ff24ecde0fea9c156c68d0f7b78` | 2026-03-04 06:28 UTC | 122 MB |
| `zion-core` | `2.9.7` | `sha256:f58c79eacf8273df29dc08d03c349b5e24b07aa61fc56b06a4f24a24b9c0a1e5` | 2026-03-03 20:08 UTC | 114 MB |
| `zion-miner` | `2.9.7` | `sha256:b1a335f38a85` (short) | 2026-03-04 ~06:30 UTC | 110 MB |
| `zion-website` | `2.9.6` | `sha256:1ca50cb144f5` (short) | 2026-03-04 ~06:00 UTC | 258 MB |

---

## Layer digesty — `zion-pool:2.9.7`

```
sha256:20db3a4d8518f7c3b0b3efdc4aab01806a506ff24ecde0fea9c156c68d0f7b78
  Layer 1: sha256:e5dae71ade4390c09123a86ada6c9bc64ac469d0495acae5b2216a627395050c
  Layer 2: sha256:d8d6081627730efbf6ef5999487ff32dc65ad069cc42f6c1f0656318dcfcba8f
  Layer 3: sha256:46909831bf61ae5d4e1db4253a0f3af713a6c321832010b1c5d87c651c51d6fb
  Layer 4: sha256:8f339470ac3974ed75c440e7577aad856e11d992e57578100a48084b0eca92cc
  Layer 5: sha256:fb5c455d160366457ef29029781ad7f5036ed1e64a30600a26bf0a4ec556d90a5
```

## Layer digesty — `zion-core:2.9.7`

```
sha256:f58c79eacf8273df29dc08d03c349b5e24b07aa61fc56b06a4f24a24b9c0a1e5
  Layer 1: sha256:100031c9cce7b091dd637c1afa21331c3448979cc0953828264b5868ec3f225e
  Layer 2: sha256:dd87890b4839e09990ed69c3a479612b2af9449a0de2f9438fc7dc9ac83cdd93
  Layer 3: sha256:221a947982b0606d9bed927b1a6af0d5cee4fd280efe4ad905b7087f3f3fe953
  Layer 4: sha256:774fe704720f79a9e41e07a9fa6159d85761af29b656952a59000a485861a80f
  Layer 5: sha256:85fd97e0717d451bc476d9d3566f5a3f6092dda16de74000b9ed5e472c571ac7
  Layer 6: sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef
```

---

## Runtime konfigurace (zion-pool:2.9.7)

```
Network     : zion-net
Ports       : 3333/tcp (stratum), 8080/tcp (HTTP /stats)
Volume      : pool-data:/data/zion-pool
Bind-mount  : /root/config:/config:ro
Restart     : unless-stopped

Env:
  RUST_LOG=info
  ZION_CORE_RPC=http://zion-core:8444/jsonrpc
  ZION_HAS_GPU=1
  ZION_SCHEDULER_PERMINER_MIN_MINERS=2
  ZION_VARDIFF_MIN_DIFFICULTY=50
  ZION_POOL_INITIAL_DIFFICULTY=500
  ZION_REVENUE_CONFIG=/config/ch3_revenue_settings.json
```

---

## Ověření integrity

```bash
# Na Helsinki serveru:
docker inspect zion-pool:2.9.7 --format '{{.Id}}'
# Očekávaný výstup: sha256:20db3a4d8518...

docker inspect zion-core:2.9.7 --format '{{.Id}}'
# Očekávaný výstup: sha256:f58c79eacf82...
```

---

## Poznámky

- `zion-pool` a `zion-core` buildovány z `zion-build-2.9.7/repo.tar.gz` na Helsinkách
- Miner `b1a335f38a85` buildován ARM64 on-device (Helsinki) 2026-03-04
- Revenue config: `ch3_revenue_settings.json` v3.2.0-E07 — všechny GPU pooly na **2miners.com**, BTC payout
- fail2ban: nainstalován 2026-03-04, sshd jail, bantime=24h
