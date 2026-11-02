# DR Drill — Dry-Run Restore Report (Variant A)

> **Datum:** 2026-11-02
> **Varianta:** A (dry-run restore do /tmp, bez nového hosta)
> **Záloha:** `backups/edge/daily/zion-edge-20261102_061312.tar.gz` (477 MB)
> **Cíl:** Ověřit integritu záloh, DB, configů a binárek pro případ totální ztráty obou edge serverů.

---

## 1. Výsledek: PASS (s výhradami)

| Komponenta | Stav | Detail |
|---|---|---|
| **tar.gz integrita** | ✅ OK | gzip -t pass, 477 MB |
| **Extrakce** | ✅ OK | 9 top-level složek, 23 DB souborů |
| **DB integrity (23 DBs)** | ✅ OK | všechny PRAGMA integrity_check = ok |
| **Config soubory** | ✅ OK | 7 toml + edge-environment.sh, 0 placeholderů |
| **Secrets (edge-environment.sh)** | ✅ OK | 147 env vars, 0 SET_VIA_SECURE... placeholderů |
| **Keys** | ✅ OK | 4 klíče (edge2-probe, edge2-probe.pub, validator.key, warp-operator.json) |
| **Systemd units** | ✅ OK | 50 unitů včetně 21 zion-v31-* |
| **nginx vhosty** | ✅ OK | 12 confů + nginx.conf |
| **fail2ban** | ✅ OK | 14 souborů (jails + baky) |
| **PostgreSQL dumps** | ✅ OK | 3 globals + 3 zion + 3 zion_marketplace dumps |
| **Pool PPLNS JSON** | ✅ OK | valid JSON |
| **G8 run state** | ✅ OK | schema_version, run_id, started, target_end, status |
| **Binárky v záloze** | ❌ CHYBÍ | záloha neobsahuje `/opt/zion/V31/target/release/` (excluded) |
| **Secrets v záloze** | ⚠️ ČÁSTEČNĚ | edge-environment.sh je v záloze s reálnými hodnotami (0 placeholderů) — to je OK pro restore, ale záloha musí být šifrovaná/offsite |

---

## 2. Identifikované mezery (gaps)

### G-DR-1: Binárky nejsou v záloze
- **Problém:** Backup script (`backup-edge.sh`) excluduje `target/` (binárky). Po restore na čistém hostu je potřeba rebuild.
- **Dopad:** DR drill na čistém hostu vyžaduje Rust toolchain + ~30 min build.
- **Mitigace:** ✅ Přidána volitelná možnost `ZION_BACKUP_INCLUDE_BINARIES=1` v backup-edge.sh (2. 11. 2026) — včetně zion-pool-standby. Build kroky dokumentovány v `V31/deploy/deploy-edge.sh` Step 5.
- **Status:** ✅ Opraveno (volitelné, default off pro úsporu místa).

### G-DR-2: Offsite zálohy
- **Problém:** Denní zálohy jsou jen na EDGE (`/opt/zion/backups/edge/daily/`). Offsite pull (`pull-edge-backups.sh` → `sync-edge-backups.sh`) existuje.
- **Ověření 2. 11. 2026:** `zion-offsite-sync.timer` (user systemd) běží každé 4 h, syncuje daily+weekly do `~/2.9.6-main/backups/edge/`. Cron entry byl zakomentován (duplikace s timerem). Timer je enabled (timers.target.wants).
- **Dopad:** Totální ztráta EDGE = ztráta záloh (pokud offsite sync selže).
- **Mitigace:** Timer běží. Doporučeno přidat alert při selhání syncu (exit code != 0).
- **Status:** ✅ Ověřeno — timer běží, ale chybí alerting na selhání.

### G-DR-3: Secrets v záloze
- **Problém:** `edge-environment.sh` s reálnými secrets je v záloze (0 placeholderů). Záloha je `rw-------` (600) ale není šifrovaná.
- **Dopad:** Kdokoli s přístupem k záloze má všechny secrets.
- **Mitigace:** ✅ Přidána volitelná GPG šifrování do backup-edge.sh (2. 11. 2026): `ZION_BACKUP_ENCRYPT=1` + `ZION_BACKUP_GPG_RECIPIENT` (asymmetric) nebo `ZION_BACKUP_GPG_PASSPHRASE` (symmetric AES256). Default off.
- **Status:** ✅ Opraveno (volitelné). Doporučeno zapnout pro offsite zálohy.

### G-DR-4: V31 deploy skript out of sync
- **Problém:** `V31/deploy/deploy-edge.sh` referoval neexistující binárky/služby (opraveno 2. 11.).
- **Dopad:** Na čistém hostu by deploy selhal.
- **Mitigace:** Opraveno (viz V31/deploy/deploy-edge.sh fixy). Zbývá ověřit na reálném hostu.
- **Status:** ✅ Opraveno (kód), TODO (ověření na hostu).

### G-DR-5: PostgreSQL restore
- **Problém:** PG dumps existují (3× zion, 3× zion_marketplace, 3× globals), ale restore procedura není dokumentována.
- **Dopad:** Bez dokumentace je restore pomalý a chybový.
- **Mitigace:** Přidat do DR runbooku kroky pro PG restore (`psql < globals.sql`, `pg_restore`).
- **Status:** TODO — dokumentovat.

---

## 3. DR Restore procedura (návrh pro čistý host)

### 3.1 Předpoklady
- Nový VPS (Ubuntu 24.04, ≥4c/8GB/100GB)
- SSH přístup (root)
- Záloha stažená na host
- Secrets z password manageru (edge-environment.sh)

### 3.2 Kroky

```bash
# 1. Instalace závislostí
apt update && apt install -y build-essential pkg-config libssl-dev \
  postgresql-16 nginx fail2ban sqlite3 git curl
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 2. Restore zálohy
mkdir -p /opt/zion /etc/zion /data/zion
tar xzf zion-edge-*.tar.gz -C /tmp/dr-restore/
cp -a /tmp/dr-restore/v31_data_*/opt/zion/data/* /opt/zion/data/
cp -a /tmp/dr-restore/config_*/edge-environment.sh /etc/zion/
cp -a /tmp/dr-restore/config_*/keys /etc/zion/
cp -a /tmp/dr-restore/systemd_*/ /etc/systemd/system/
cp -a /tmp/dr-restore/nginx_*/ /etc/nginx/sites-enabled/
cp -a /tmp/dr-restore/fail2ban_*/ /etc/fail2ban/

# 3. Secrets (pokud záloha nemá reálné hodnoty)
# → obnovit z password manageru do /etc/zion/edge-environment.sh
# → chmod 600

# 4. Build (V31)
cd /opt/zion
git clone <repo> .  # nebo rsync z operátorského stroje
cd V31
sed -i '/"cli",/d;/\"smoke",/d' Cargo.toml
cargo build --release -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain -p zion-oasis

# 5. PostgreSQL restore
sudo -u postgres psql < /tmp/dr-restore/pg_*/globals-*.sql
pg_restore -U zion -d zion /tmp/dr-restore/pg_*/zion-*.dump
pg_restore -U zion -d zion_marketplace /tmp/dr-restore/pg_*/zion_marketplace-*.dump

# 6. Permissions
chown -R zion:zion /opt/zion /data/zion /etc/zion
chmod 700 /etc/zion/keys
chmod 600 /etc/zion/edge-environment.sh

# 7. Start services
systemctl daemon-reload
systemctl enable --now zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao zion-v31-oasis
systemctl enable --now zion-v31-watchdog.timer zion-edge-backup.timer

# 8. Verify
curl -s http://127.0.0.1:9445/health
curl -s http://127.0.0.1:8080/metrics | head -5
systemctl is-active zion-v31-node zion-v31-pool zion-v31-multichain
```

### 3.3 Ověření po restore
- [ ] Node syncuje na chain tip (RPC :9445 → getChainInfo)
- [ ] Pool stratum :8444 přijímá spojení
- [ ] Pool API :8080 odpovídá
- [ ] Web :3000 (nebo Docker) odpovídá
- [ ] Multichain :8453 odpovídá
- [ ] DAO :8456 odpovídá
- [ ] ZIS :8096 odpovídá
- [ ] Watchdog timer běží

---

## 4. Hodnocení DR readiness

| Kritérium | Stav | Poznámka |
|---|---|---|
| Zálohy existují a jsou čitelné | ✅ | Denní tar.gz, PG dumps |
| DB integrita | ✅ | 23/23 DBs PASS |
| Config integrita | ✅ | 0 placeholderů |
| Secrets v záloze | ⚠️ | Nešifrované, ale mode 600 |
| Offsite zálohy | ❓ | Neověřeno (pull-edge-backups.sh) |
| Restore procedura dokumentována | ✅ | Tento dokument (§3) |
| Restore otestován na čistém hostu | ❌ | Vyžaduje nový host (nebo Docker) |
| Build reproducibility | ✅ | Deploy skript + Cargo.toml sed |
| PG restore dokumentován | ✅ | §3.2 krok 5 |

### Celkové hodnocení: **80 % připraveno**

**Co chybí pro plný DR drill:**
1. Ověřit offsite backup pull (G-DR-2)
2. Šifrovat zálohy (G-DR-3)
3. Otestovat restore na čistém hostu/Docker (G-DR-1, G-DR-4, G-DR-5)
4. Dokumentovat PG restore kroky (✅ hotovo v §3)

---

## 5. TODO (pro další session)

- [ ] Ověřit `pull-edge-backups.sh` + cron na operátorské stanici
- [ ] Přidat šifrování záloh (gpg/age) do backup-edge.sh
- [ ] Otestovat restore na Docker kontejneru (varianta B)
- [ ] Přidat PG restore kroky do `V31/deploy/deploy-edge.sh` (nebo samostatný skript)
- [ ] Aktualizovat `HARD_RESET_PLAYBOOK.md` s dvouboxovou topologií (8.B11)

---

*Vytvořeno 2026-11-02 jako dry-run DR drill (varianta A).*