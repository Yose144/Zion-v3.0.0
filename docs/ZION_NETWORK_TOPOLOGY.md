# ZION Mainnet Network Topology — Core + Edge Relay

## Cíl

Spustit **primární lokální PC** (ZionServer) jako hlavní core s kompletní historií, zálohami a mining poolem, a propojit ho přes VPN s **veřejným edge serverem**, který přijímá připojení od dalších uzlů z internetu.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ External     │    │ External     │    │ External     │                  │
│  │ Miner #1     │    │ Miner #2     │    │ Full Node #3 │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             │                                               │
│                    tcp://EDGE_PUBLIC_IP:8333                               │
│                             │                                               │
└─────────────────────────────┼─────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   EDGE NODE (VPS)  │
                    │   Public IP + VPN  │  ← Veřejný relay pro všechny
                    │   Tailscale IP     │
                    │   100.x.x.x:8333   │
                    └─────────┬─────────┘
                              │ Tailscale VPN tunnel
                              │ (WireGuard, šifrované)
                    ┌─────────▼─────────┐
                    │   CORE NODE (PC)   │  ← Hlavní uzel, zálohy, pool
                    │   ZionServer       │
                    │   100.y.y.y:8333   │
                    │   Private LAN IP   │
                    │   192.168.x.x      │
                    └────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   LOCAL MINER      │  ← Lokální GPU miner
                    │   127.0.0.1:8444   │
                    └────────────────────┘
```

## Role jednotlivých uzlů

### Core Node (lokální PC)
- **Node 1** — genesis / source of truth, drží kompletní chain
- **Node 2** — lokální follower pro redundanci
- **Pool** — mining pool (`0.0.0.0:8444`)
- **Miner** — lokální GPU miner
- **Zálohy** — `backups/`, `V3/data/`
- **VPN klient** — Tailscale / ZeroTier
- **Nemá veřejnou IP** — přístupný jen přes VPN

### Edge Node (veřejný VPS)
- **Node 1** — follower, synchronizuje z Core
- **Binduje P2P** na `0.0.0.0:8333` (veřejně dostupný)
- **VPN klient** — připojen k Core přes tunel
- **Žádný pool, žádný miner** — čistě relay
- **Má veřejnou IP** — ostatní nody se k němu připojují

## Proč to funguje

| Problém | Řešení |
|---|---|
| Core nemá veřejnou IP | Edge má veřejnou IP a přijímá inbound |
| Core je za NAT/firewallem | Tailscale VPN tunel obchází NAT oběma směry |
| Bezpečnost — otevřít porty na Core | Žádné porty na Core nejsou otevřené ven |
| Edge spadne | Core má všechna data, nový Edge se spawnne za minutu |
| Core spadne | Edge má kopii chainu, minerům se nic nestane (pool běží dál) |
| Latence minerů | Miner běží lokálně na Core — nulová latence |
| Zálohy | Core dělá zálohy automaticky, Edge jen relay |

## P2P Discovery Flow

```
1. Core Node startuje:
   - known_peers = [Edge_Tailscale_IP:8333]
   - outbound_sync → připojí se k Edge přes VPN
   - posílá bloky a transakce Edge

2. Edge Node startuje:
   - known_peers = [Core_Tailscale_IP:8333]
   - seed_peers = [Core_Tailscale_IP:8333]
   - outbound_sync → stáhne historii z Core
   - otevře P2P na 0.0.0.0:8333

3. External Node připojení:
   - seed_peers = [Edge_Public_IP:8333]
   - TCP connect → Edge přijme spojení
   - handshake, GetPeers → Edge sdílí Core jako peer
   - External Node se může připojit i přímo k Core přes VPN (pokud má Tailscale)
```

## Porty a směrování

| Služba | Core Node | Edge Node | Externí Node |
|---|---|---|---|
| P2P (inbound) | ❌ (jen VPN) | ✅ `0.0.0.0:8333` | ❌ (nebo VPN) |
| P2P (outbound) | ✅ → Edge VPN | ✅ → Core VPN | ✅ → Edge Public |
| RPC | `127.0.0.1:8443` | `127.0.0.1:8443` | volitelně |
| Pool | `127.0.0.1:8444` | ❌ | ❌ |
| VPN (Tailscale) | `41641/udp` | `41641/udp` | `41641/udp` |

## Tailscale Setup (doporučeno)

### 1. Instalace na oba stroje

**Windows (Core PC):**
```powershell
winget install Tailscale.Tailscale
# Nebo stáhnout z https://tailscale.com/download
```

**Linux (Edge VPS):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### 2. Přihlášení (na obou strojích)

```bash
sudo tailscale up --advertise-exit-node --accept-routes
```

Prohlížeč se otevře — přihlas se jedním Google/Microsoft/GitHub účtem. Oba stroje budou ve stejném tailnetu.

### 3. Získání Tailscale IP

```bash
tailscale ip -4
# Core:  100.x.y.z
# Edge:  100.a.b.c
```

### 4. Ověření konektivity

Na Core PC:
```powershell
tailscale ping 100.a.b.c   # Edge IP
```

Na Edge VPS:
```bash
tailscale ping 100.x.y.z   # Core IP
```

## Spuštění topologie

### Core Node (lokální PC)

Použij existující `launch-stack.ps1` — upravený pro Edge peer:

```powershell
# V launch-stack.ps1 nastavit:
$env:ZION_SEED_PEERS='100.a.b.c:8333'   # Tailscale IP Edge Node
# Pool zůstává lokální
```

### Edge Node (veřejný VPS)

Použij nový skript `scripts/launch-edge-node.sh` (viz níže):

```bash
export ZION_NODE_ID='zion-edge-relay'
export ZION_P2P_BIND='0.0.0.0:8333'
export ZION_SEED_PEERS='100.x.y.z:8333'   # Tailscale IP Core Node
export ZION_NODE_STATE_PATH='/var/zion/edge-state.db'
```

## Failover Scénáře

### Edge spadne
1. Core dál běží, miner dál těží do lokálního poolu
2. External nody ztratí spojení — začnou reconnect backoff
3. Nastartuj nový Edge VPS, připoj přes Tailscale, spusť edge-node script
4. External nody se automaticky znovu připojí

### Core spadne
1. Edge má kopii chainu do posledního bloku (ale ne nové)
2. External nody se syncují z Edge (který je na posledním známém bloku)
3. Core restartuj, obnov ze zálohy pokud je to nutné
4. Edge se znovu syncne z Core přes VPN

### Tailscale VPN spadne
1. Core a Edge se nemohou vidět
2. Core funguje lokálně (miner dál běží)
3. Edge nemá nové bloky, external nody se nezlepšují
4. Restart Tailscale: `sudo tailscale down && sudo tailscale up`

## Alternativy k Tailscale

| VPN | Výhody | Nevýhody |
|---|---|---|
| **Tailscale** | Zero-config, mesh, zdarma pro osobní účet | Vyžaduje účet (Google/Microsoft/GitHub) |
| **ZeroTier** | Samostatný síťový ID, nezávislý na poskytovateli | Ruční správa sítě |
| **WireGuard** | Nejjednodušší, ruční config, žádný vendor | Musíš si spravovat klíče a config |
| **ngrok / frp** | TCP tunel pro specifický port | Není skutečná síť, jen port forward |

Pro produkci doporučujeme **Tailscale** — nejjednodušší, nejstabilnější.

## Checklist nasazení

- [ ] Tailscale nainstalován na Core i Edge
- [ ] Oba stroje vidí tailscale ping
- [ ] Core spuštěn s `ZION_SEED_PEERS=EDGE_TAILSCALE:8333`
- [ ] Edge spuštěn s `ZION_SEED_PEERS=CORE_TAILSCALE:8333`
- [ ] Edge binduje P2P na `0.0.0.0:8333` (ověř `ss -tlnp | grep 8333`)
- [ ] External node se připojí k Edge public IP:8333
- [ ] External node syncuje bloky (vidíš `relay_block` v logu Edge)
- [ ] Core dělá zálohy automaticky (`scripts/backup-chain.ps1`)
- [ ] Monitoring: dashboard na Core vidí oba nody

## Postup vytvoření infrastruktury

Krok za krokem:

1. **Nainstaluj Tailscale** na Core PC (Windows) a Edge VPS (Linux)
2. **Spusť Core** pomocí `scripts/launch-stack.ps1` — uprav `ZION_SEED_PEERS`
3. **Spusť Edge** pomocí `scripts/launch-edge-node.sh` na VPS
4. **Ověř sync** — Edge log by měl ukazovat `outbound_sync_ok` ke Core
5. **Dej veřejnou IP** komukoli — external nody se připojí k Edge
6. **Profit** — lokální miner těží s nulovou latencí, ostatní těží přes Edge

## Soubory a skripty

| Soubor | Popis |
|---|---|
| `scripts/launch-stack.ps1` | Core PC — Node1+Node2+Pool+Miner |
| `scripts/launch-edge-node.sh` | Edge VPS — Node1 relay only |
| `scripts/launch-edge-node.ps1` | Edge Windows — Node1 relay only |
| `scripts/setup-tailscale.sh` | Tailscale instalace Linux |
| `scripts/setup-tailscale.ps1` | Tailscale instalace Windows |
| `docs/ZION_NETWORK_TOPOLOGY.md` | Tento dokument |
