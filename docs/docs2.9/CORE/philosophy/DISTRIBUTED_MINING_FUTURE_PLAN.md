# ZION Distributed Mining Platform - Budoucí Plán

## Současný Stav - Debug Priority
🚨 **NEJDŘÍV MUSÍME OTESTOVAT CELOU SOUČASNOU PLATFORMU!**

### Co musí fungovat 100% před distribučním deploymentem:
- [ ] **ZION Platform Start** - `start_zion.py` bez errorů
- [ ] **Blockchain & Seeds** - síťová synchronizace 
- [ ] **Mining Pool** - stratum server + job distribution
- [ ] **Wallets & Addresses** - Z3 address generation + validation
- [ ] **RPC Communication** - daemon ↔ pool ↔ miners
- [ ] **Real Mining** - skutečné shares, blocks, rewards
- [ ] **System Monitoring** - afterburner + stats bez 404 chyb

---

## Budoucí Distribuce (až bude local perfect)

### Phase 1: SSH Server Deployment
Kompletní ZION jako služba na SSH serveru - jeden centrální pool

**Architecture:**
```
[SSH Server: ZION Platform] ←→ [Remote Miners via SSH Tunnel]
```

**Components:**
- Server Launcher: `zion_server.py`
- Mining Pool API: WebSocket + HTTP endpoints
- SSH Tunnel Management: automatické tunely pro minery
- Web Dashboard: real-time monitoring všech připojených minerů

### Phase 2: DApp Integration 
Web3 interface pro připojení minerů přes blockchain

**Architecture:**
```
[ZION Server] ←→ [Smart Contract] ←→ [DApp Frontend] ←→ [Miners]
```

**Components:**
- DApp Connection Manager: MetaMask/WalletConnect integration
- Mining Rewards Contract: on-chain profit sharing
- Remote Miner Client: lightweight client s auto-discovery
- Decentralized Pool Discovery: multiple ZION servers

### Phase 3: Full Decentralization
Peer-to-peer mining network bez centrálních serverů

---

## Aktuální Úkol: LOCAL DEBUG! 🔧

**Priorita:** 
1. Opravit 404 chyby v afterburner API
2. Stabilizovat mining pool connections  
3. Ověřit blockchain synchronizaci
4. Testovat celý mining cycle end-to-end
5. Dokumentovat funkční setup

**Až local běží perfectly → pak SSH deployment → pak DApp**

---
*Dokument vytvořen: 1. října 2025*
*Status: Planning Phase - Debug First!*