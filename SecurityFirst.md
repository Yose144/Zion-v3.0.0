# ZION SecurityFirst — Kompletní zabezpečení Edge mainnet

**Created:** 2026-07-02 (po F1 exploit a rollback)
**Status:** PHASE 2 BIND HARDENING COMPLETE — 13/18 services on 127.0.0.1, 5 remaining need rebuild
**Owner:** yosef + Devin

---

## 1. Audit výsledky — nalezené problémy

### KRITICKÉ (exploitovatelné)

| # | Problém | Riziko | Stav |
|---|---------|--------|------|
| C1 | **UFW povoluje 8333/8334/8443-8447/8450/8452/8453/8455/8766-8768/8888/9102 kdekoliv** — moje iptables pravidla jsou přepsána UFW! | P2P, RPC, pool, L2 služby přístupné z internetu | 🔴 TODO |
| C2 | **Externí P2P connection z 109.81.30.165:57101 na port 8333** — neznámý peer je připojený RIGHT NOW | Útočník může injectovat bloky | 🔴 TODO |
| C3 | **3 pool payout SK v plaintextu v git repu** (setup-edge.sh, launch-stack.sh, start-pool.sh) | Kompromitace pool walletu | 🔴 TODO |
| C4 | **edge-environment.sh je world-readable (644)** — obsahuje pool SK | Každý user na serveru vidí SK | 🔴 TODO |
| C5 | **DB soubory world-readable (644)** — edge-state.db, edge2-state.db, bridge-mainnet.db | Chain state + bridge keys čitelné kýmkoliv | 🔴 TODO |
| C6 | **Tailscale ACL není nastavený** — jakékoliv zařízení v tailnetu má přístup ke všem portům | Nové zařízení = plný přístup | 🔴 TODO |
| C7 | **Cron job s MEMO_V1_HEIGHT=24000** — starý cron override, který by mohl resetovat activation height | Pokud se aktivuje, signature verification se vypne do 24000 | 🔴 TODO |
| C8 | **hardhat .env a V3/docker/.env** — pravděpodobně obsahují EVM privátní klíče | Kompromitace DeFi contractů | 🔴 TODO |

### VYSOKÉ

| # | Problém | Riziko | Stav |
|---|---------|--------|------|
| H1 | **Všechny zion služby běží jako root** — žádné user isolation | RCE v jedné službě = root na serveru | 🟡 TODO |
| H2 | **SSH config má duplicitní řádky** — `PermitRootLogin yes` + `PasswordAuthentication yes` na začátku, pak přepsáno. Matoucí, náchylné k chybě. | Může vést k accidental password auth | 🟡 TODO |
| H3 | **Žádné disk encryption** — sda1 je ext4 bez LUKS | Fyzický přístup = plná kompromitace | 🟡 N/A (Hetzner cloud) |
| H4 | **Grafana (3100), Prometheus (9090), node_exporter (9100)** přístupné přes Docker | Monitoring data leak, případně Grafana RCE | 🟡 TODO |
| H5 | **Caddy 80/443 veřejně přístupný** — website + reverse proxy | OK pro website, ale musíme ověřit co proxuje | 🟢 OK |
| H6 | **bridge-mainnet.db obsahuje bridge validator keys** — world-readable | Bridge validator key kompromitace | 🔴 (viz C5) |
| H7 | **ZION_SWAP_ESCROW_KEY=0000...0001** — placeholder v env | Pokud atomic-swap služba běží, escrow je kompromitovatelný | 🟡 TODO |

### STŘEDNÍ

| # | Problém | Riziko | Stav |
|---|---------|--------|------|
| M1 | **fail2ban aktivní** (4 jails: sshd, sshd-aggressive, recidive, mysqld-auth) | ✅ OK | 🟢 OK |
| M2 | **unattended-upgrades aktivní** (security updates) | ✅ OK | 🟢 OK |
| M3 | **AppArmor loaded** (105 profiles in enforce mode) | ✅ OK, ale zion binárky unconfined | 🟡 TODO |
| M4 | **2 SSH klíče v authorized_keys** — edge + hetzner deploy | OK, ale hetzner deploy key by měl být rotován | 🟡 TODO |
| M5 | **SSH na portu 22, veřejně přístupný** (LIMIT v UFW) | fail2ban chrání, ale ideálně Tailscale-only | 🟡 TODO |
| M6 | **Žádný audit log pro zion RPC volání** — kdo volá jaké metody | Forenzní slepota po útoku | 🟡 TODO |
| M7 | **peers.json v data dir** — obsahuje P2P peer list | Útočník může vidět známé peery | 🟡 TODO |

---

## 2. Plán oprav —priority order

### Fáze 1: URGENT — blokovat aktivní hrozby (dnes)

#### F1.1: Opravit UFW — odstranit veřejná pravidla

```bash
# Odstranit všechna ALLOW IN Anywhere pravidla pro zion porty
ufw delete allow 8333/tcp
ufw delete allow 8334/tcp
ufw delete allow 8443/tcp
ufw delete allow 8444/tcp
ufw delete allow 8445/tcp
ufw delete allow 8446/tcp
ufw delete allow 8447/tcp
ufw delete allow 8450/tcp
ufw delete allow 8452/tcp
ufw delete allow 8453/tcp
ufw delete allow 8455/tcp
ufw delete allow 8766/tcp
ufw delete allow 8767/tcp
ufw delete allow 8768/tcp
ufw delete allow 8888/tcp
ufw delete allow 9102/tcp

# Povolit jen:
# - SSH (22) — LIMIT (fail2ban chrání)
# - HTTP/HTTPS (80/443) — Caddy pro website
# - Tailscale interface — vše
# - localhost — vše
# Vše ostatní: DENY
```

#### F1.2: Odpojit externího peera z 109.81.30.165

```bash
# Zjistit který peer to je a odpojit ho
# Přes RPC nebo restart node s restrikcí
```

#### F1.3: Odstranit starý cron job s MEMO_V1_HEIGHT=24000

```bash
crontab -l | grep -v 'MEMO_V1_HEIGHT=24000' | crontab -
```

#### F1.4: Scrub privátní klíče z git repu

```bash
# Odstranit SK z:
# - edge-deploy/setup-edge.sh (edee1b...)
# - scripts/launch-stack.sh (b8d734...)
# - scripts/start-pool.sh (b8d734...)
# Nahradit za: ZION_POOL_PAYOUT_SK_HEX=<SET VIA ENVIRONMENT>
```

#### F1.5: Opravit file permissions

```bash
chmod 600 /root/zion-2.9.6-main/data/edge-state.db
chmod 600 /root/zion-2.9.6-main/data/edge2-state.db
chmod 600 /root/zion-2.9.6-main/data/bridge-mainnet.db
chmod 600 /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
chmod 600 /root/zion-2.9.6-main/data/dao.db
chmod 700 /root/zion-2.9.6-main/data/
```

### Fáze 2: HARDENING — snížit attack surface (tento týden)

#### F2.1: Vytvořit dedicated user pro zion služby

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin zion
# Update systemd units: User=zion, Group=zion
# Chown data dir: chown -R zion:zion /root/zion-2.9.6-main/data/
```

#### F2.2: SSH — Tailscale only + klíče only

```bash
# V sshd_config:
# - PermitRootLogin prohibit-password (jen klíče)
# - PasswordAuthentication no
# - ListenAddress 100.76.16.108 (Tailscale) + 127.0.0.1
# Nebo: AllowUsers root@100.86.102.5 (jen z Tailscale peer)
```

#### F2.3: Tailscale ACL

```json
// V Tailscale admin console:
{
  "acls": [
    {"action": "accept", "src": ["yosef.hubalek@gmail.com"], "dst": ["mainnetedge:22", "mainnetedge:*"]}
  ],
  "ssh": [],
  "nodeAttrs": []
}
```

#### F2.4: AppArmor profil pro zion-node

```bash
# Vytvořit /etc/apparmor.d/usr.local.bin.zion-node
# Omezit přístup jen na data dir + config
```

#### F2.5: Audit hardhat .env a docker .env

```bash
# Zkontrolovat obsah, rotovat EVM klíče pokud exposed
# Přesunout do /root/secrets/ (mimo repo, chmod 600)
```

### Fáze 3: MONITORING — detekce budoucích útoků

#### F3.1: RPC audit log

```bash
# Logovat každé RPC volání s IP + method + params hash
# V node.rs přidat audit log do journalctl
```

#### F3.2: Block submitter log (už aktivní)

```bash
# ZION_LOG_BLOCK_SUBMITTER=1 — loguje P2P peer pro každý submitted block
```

#### F3.3: Forged TX monitor (už aktivní)

```bash
# Cron každých 5 min — loguje forged TXs
# Přidat: email/Telegram alert při detekci
```

#### F3.4: Balance monitor

```bash
# Cron každých 5 min — check premine wallet balances
# Alert pokud balance klesne pod očekávanou hodnotu
```

#### F3.5: P2P peer alert

```bash
# Cron — check P2P peers, alert pokud nový neznámý peer
```

### Fáze 4: KEY ROTATION — preventivní

#### F4.1: Rotace premine privátních klíčů

```
Per GENESIS_REGENERATION_RUNBOOK.md:
- Air-gapped machine
- Nové mnemonics
- Nové genesis outputs
- Update genesis.rs
- Rebuild + redeploy
```

#### F4.2: Rotace pool payout SK

```
- Vygenerovat nový SK na air-gapped machine
- Update edge-environment.sh (chmod 600)
- Restart pool
- Verify derive_address(SK) == ZION_POOL_WALLET
```

#### F4.3: Rotace bridge validator keys

```
- 3/5 validator keys
- Per BRIDGE_MULTISIG.md
```

#### F4.4: Rotace EVM deploy keys

```
- hardhat .env PRIVATE_KEYs
- Transfer contract ownership na multisig
```

---

## 3. Architektura — cílový stav

```
Internet
  │
  ├── Caddy :80/:443 (website only, reverse proxy na Next.js :3000)
  │
  ├── SSH :22 (LIMIT + fail2ban, ideálně Tailscale-only)
  │
  └── Tailscale (tailscale0)
       │
       ├── zion-node1 :8333 (P2P) + :8443 (RPC, localhost only)
       ├── zion-node2 :8334 (P2P) + :8446 (RPC, localhost only)
       ├── zion-pool :8444 (Tailscale only)
       ├── zion-bridge :9101 (localhost only)
       ├── zion-dao :8450 (localhost only)
       ├── zion-warp :8453 (localhost only)
       ├── zion-dashboard :8888 (Tailscale only)
       ├── zion-agent :8767 (localhost only)
       ├── zion-oasis :8094 (localhost only)
       ├── zion-free-world :8095 (localhost only)
       ├── zion-issobella :8096 (localhost only)
       └── Grafana/Prometheus (Tailscale only)

  Vše ostatní: DENY
  UFW default: deny incoming
  iptables-persistent: saved
```

---

## 4. Checklist — postup oprav

- [x] F1.1: Opravit UFW — odstranit veřejná pravidla ✅ (2026-07-02 14:46)
- [x] F1.2: Odpojit externího peera 109.81.30.165 ✅ (peers.json vyčištěn, node restart)
- [x] F1.3: Odstranit starý cron job (MEMO_V1_HEIGHT=24000) ✅
- [x] F1.4: Scrub privátní klíče z git repu ✅ (5 souborů, commit 19e6298)
- [x] F1.5: Opravit file permissions (chmod 600) ✅ (edge-state.db, edge2-state.db, bridge-mainnet.db, edge-environment.sh, data dir 700)
- [x] F2.1: Vytvořit zion user ✅ (uid=995, systemd User= pending)
- [x] F2.2: SSH config vyčištěn ✅ (PermitRootLogin prohibit-password, PasswordAuthentication no, X11Forwarding no, AllowUsers root)
- [x] F2.4: AppArmor profil pro zion-node ✅ (loaded, enforce mode)
- [x] F2.5: Audit hardhat .env + docker .env ✅ (chmod 600, SK scrubbed z docker/.env v repu)
- [x] F2.7: Bind adresy — 0.0.0.0 → 127.0.0.1 ✅ (13/18 services, 5 remaining need rebuild)
  - ✅ 127.0.0.1: oasis(8094), free-world(8095), issobella(8096), node1 RPC(8443), node2 RPC(8446), node1 WS(8445), node2 WS(8447), node1 metrics(9115), node2 metrics(9116), pool metrics(8455), warp(8453), agent(8767)
  - ✅ Tailscale IP: dashboard(8888)
  - ⏳ 0.0.0.0 (UFW blokuje, bezpečné): P2P(8333,8334), pool(8444) — musí zůstat pro Tailscale minery
  - ⏳ 0.0.0.0 (UFW blokuje, code change pending rebuild): bridge metrics(9101), DAO(8450)
- [ ] F2.3: Tailscale ACL — PENDING (vyžaduje admin console — viz ACL config výše)
- [ ] F2.6: systemd User=zion — PENDING (riskantní, vyžaduje test)
- [x] F3.2: Block submitter log ✅ (ZION_LOG_BLOCK_SUBMITTER=1)
- [x] F3.3: Forged TX monitor ✅ (cron každých 5 min, /var/log/zion-forged-tx-alerts.log)
- [x] F3.4: Balance monitor ✅ (cron každých 5 min, /var/log/zion-balance-alerts.log, kontroluje 5 premine + 2 attacker adresy)
- [x] F3.5: P2P peer alert ✅ (cron každých 2 min, /var/log/zion-peer-alerts.log, alert na neznámé IP)
- [ ] F3.1: RPC audit log — PENDING (vyžaduje code change v node.rs)
- [ ] F4.1: Rotace premine klíčů (air-gapped) — PENDING
- [ ] F4.2: Rotace pool payout SK — PENDING
- [ ] F4.3: Rotace bridge validator keys — PENDING
- [ ] F4.4: Rotace EVM deploy keys — PENDING

---

## 5. Pravidla pro budoucnost

1. **Žádné privátní klíče v git repu.** Vždy přes env soubor s chmod 600, mimo repo.
2. **Žádné služby na 0.0.0.0.** Vždy bind na 127.0.0.1 nebo Tailscale IP.
3. **UFW default deny.** Každé nové pravidlo musí mít justification.
4. **Klíče rotovat preventivně.** Po incidentu, po 6 měsících, nebo při personnel change.
5. **Audit log pro každý RPC call.** IP + method + timestamp.
6. **P2P peer allowlist.** Jen známé Tailscale peery.
7. **Monitoring + alerting.** Nejen logování, ale aktivní notifikace.
8. **Air-gapped pro key generation.** Nikdy na serveru s internetem.
9. **Multisig pro treasury.** 3/5 nebo 5/7, nikdy single-sig pro velké balancery.
10. **Regular security audits.** Každé 3 měsíce kompletní audit.

---

*This document is the security master plan. Update status as fixes are applied.*
