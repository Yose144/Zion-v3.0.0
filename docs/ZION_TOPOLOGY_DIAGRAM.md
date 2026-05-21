# ZION Network Topology — Visual Diagram

## Core + Edge Relay Architecture

```
                                INTERNET
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │   External Miner #1          External Miner #2              │
    │   (stratum → Edge)           (stratum → Edge)             │
    │        │                           │                        │
    │        └───────────────┬───────────┘                        │
    │                        │                                   │
    │              tcp://EDGE_PUBLIC_IP:8333                    │
    │                        │                                   │
    └────────────────────────┼───────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │     EDGE NODE (VPS)     │
                │  ┌─────────────────────┐│
                │  │  P2P: 0.0.0.0:8333 ││  ← Verejný relay
                │  │  VPN: 100.a.b.c    ││     (inbound otvorené)
                │  └─────────────────────┘│
                │         ▲               │
                │         │ Tailscale     │
                │         │ WireGuard     │
                │         │ tunnel        │
                │         ▼               │
                │  ┌─────────────────────┐│
                │  │  Seed: 100.x.y.z   ││  ← Core cez VPN
                │  │  (synchronizácia)   ││
                │  └─────────────────────┘│
                └────────────┬────────────┘
                             │
                ═════════════╪═══════════════
                             │  Tailscale VPN
                             │  (šifrovaný, obchádza NAT)
                ═════════════╪═══════════════
                             │
                ┌────────────▼────────────┐
                │     CORE NODE (PC)      │
                │  ┌─────────────────────┐│
                │  │  P2P: 0.0.0.0:8333 ││  ← LEN lokálna sieť
                │  │  RPC: 127.0.0.1:8443││     (žiadny inbound z
                │  │  Pool: 127.0.0.1:8444││      internetu)
                │  └─────────────────────┘│
                │         │               │
                │    ┌────┴────┐          │
                │    │         │          │
                │    ▼         ▼          │
                │ ┌──────┐  ┌──────┐     │
                │ │Node 2│  │ Miner│     │
                │ │:8334 │  │:8444 │     │
                │ └──┬───┘  └──────┘     │
                │    │  Pool              │
                │    └──────┐             │
                │        ┌──▼──┐          │
                │        │GPU  │          │
                │        │OpenCL           │
                │        └─────┘          │
                │                         │
                │  ┌─────────────────────┐│
                │  │  Zálohy: backups/  ││  ← Kompletná história
                │  │  Data: V3/data/    ││     všetky zálohy
                │  └─────────────────────┘│
                └─────────────────────────┘
```

## Data Flow: New Block Mined

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Miner   │───→│  Pool    │───→│  Node 1  │───→│   Edge   │───→│ External │
│  (GPU)   │    │ (Core)   │    │  (Core)  │    │  (VPS)   │    │  Nodes   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     │ submit()      │ broadcast     │ relay_block   │ broadcast     │ sync
     │               │               │               │               │
     │               │               │               │               │
```

## Data Flow: External Miner Connects

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Ext. Miner   │  TCP    │ Edge Node    │  VPN    │ Core Node    │
│ (internet)   │───────→ │ (VPS :8333)  │───────→ │ (PC :8333)   │
└──────────────┘         └──────────────┘         └──────────────┘
        │                       │                       │
        │  1. handshake         │  3. relay             │  5. add to
        │  2. GetPeers          │  4. GetPeers          │    known_peers
        │                       │                       │
        │←───────────────────────────────────────────────────────│
        │              6. direct sync (cez VPN)               │
        │              (ak má aj ext. node Tailscale)         │
```

## IP Addressing Example

| Uzol | Tailscale IP | Verejná IP | Lokálna IP |
|---|---|---|---|
| Core PC | `100.64.1.2` | ❌ (NAT) | `192.168.1.10` |
| Edge VPS | `100.64.1.3` | `203.0.113.45` | `10.0.0.5` |
| Ext. Miner | `100.64.1.4` (ak má TS) | `198.51.100.20` | — |

## Port Summary

| Služba | Core | Edge | Popis |
|---|---|---|---|
| P2P inbound | ❌ | `0.0.0.0:8333` | Edge prijíma externé pripojenia |
| P2P outbound | ✅ → Edge VPN | ✅ → Core VPN | Obojsmerná synchronizácia |
| RPC | `127.0.0.1:8443` | `127.0.0.1:8443` | Interný node API |
| Pool | `127.0.0.1:8444` | ❌ | Len na Core |
| Miner | `127.0.0.1:*` | ❌ | GPU miner lokálne |
| Dashboard | `127.0.0.1:5000` | ❌ | Lokálny monitoring |
