# Pool HA — Runbook (Fencing, Promote, Failback)

> **Status:** Dokumentace + fencing guard implementovány. Aktivace = staged (log-only → armed) po 👤 sign-off.
> **Poslední aktualizace:** 2026-11-02
> **Vazby:** `infra/tools/pool-ha/` (guard, watchdog, probe, parity, sync), `docs/3.2/POOL-HA-STANDBY.md` (architektura A4.2)

---

## 1. Architektura (přehled)

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│  EDGE (62.171.141.136) — ACTIVE     │     │  EDGE2 (207.180.217.100) — STANDBY │
│                                     │     │                                     │
│  zion-v31-pool :8444/:8445/:8446   │◄────│  zion-pool-standby (inactive)       │
│  API :8080                          │ sync│  API :8090 (po promote)             │
│  watchdog.timer (30s, auto-restart) │     │  watchdog (alert-only, 30s)         │
│  zion-v31-watchdog.timer            │     │  promote-guard (G1-G6 fencing)      │
│                                     │     │  parity-check (dr-parity-check.sh)  │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
        ▲                                           ▲
        │  zion-chain-tunnel (edge→EDGE2)           │  zion-edge-tunnel (EDGE2→edge)
        │  permitopen: 9445, 9944, 44207, ...      │  permitopen: 8080, 8003, 9446, 9447
        └───────────────────────────────────────────┘
```

**Klíčové principy:**
- **Žádný auto-promote.** Watchdog je alert-only. DNS změny na WebGlobe jsou manuální.
- **Fencing guard** vynucuje 6 podmínek (G1–G6) před každým promotem.
- **State-file replikace** (minutová PPLNS/payout, hodinová DB) — přesná, ne fire-and-forget share forwarding.
- **Single-flight token** (O_EXCL, TTL 900 s) zabraňuje souběžným promotům.

---

## 2. Fencing analýza — co je implementováno

### 2.1 Implementované guardy (G1–G6)

| Guard | Podmínka | Implementace | Stav |
|---|---|---|---|
| **G1** | Primár prokazatelně mrtvý (unit inactive AND žádný proces) | `g1_primary_dead()` — čte `P_UNIT`, `P_PROC` z probe/SSH | ✅ |
| **G2** | Auto-restart primáru pryč (watchdog timer inactive) | `g2_no_autorestart()` — čte `P_TIMER` | ✅ |
| **G3** | Stratum primáru zavřený (TCP :8444 neodpovídá) | `g3_stratum_closed()` — `_tmo 6 bash -c "exec 3<>/dev/tcp/..."` | ✅ |
| **G4** | Parita doložená (dr-parity-check.sh bez FAIL) | `g4_parity()` — 180s timeout, grep "FAIL" | ✅ |
| **G5** | Žádný jiný promote běží (single-flight token) | `g5_no_active_token()` — O_EXCL zápis, TTL 900 s | ✅ |
| **G6** | Cooldown (od minulého pokusu ≥ 600 s) | `g6_cooldown()` — čte `LAST_ATTEMPT` | ✅ |

### 2.2 Read-only sonda primáru (fencing key)

**Problém:** EDGE2 nemá SSH přístup na primár (port 22 refused, 2222 publickey denied). Guard potřebuje rozeznat "mrtvý" od "jen wedged".

**Řešení:** Omezený klíč v `authorized_keys` na EDGE:
```
command="/usr/local/sbin/edge-pool-probe.sh",no-port-forwarding,no-agent-forwarding,
no-pty,no-X11-forwarding,from="207.180.217.100" <pubkey>
```

Klíč umí **jediné** — přečíst tři fakta:
```
unit=active|inactive|failed|...   (systemd stav zion-v31-pool)
proc=0|1                          (existuje proces zion-pool?)
timer=active|inactive|...         (běží watchdog.timer?)
```

**Setup:** `bash infra/tools/pool-ha/setup-fencing-key.sh` (idempotentní, z operátorského stroje).

**Rollback:** smaž řádek s `zion-pool-fencing-probe` z `/root/.ssh/authorized_keys` na EDGE.

### 2.3 Identifikované mezery (gaps)

| # | Mezera | Riziko | Mitigace |
|---|---|---|---|
| G-1 | `dr-parity-check.sh` musí existovat na standby hostu (cesta `/opt/zion/scripts/dr-parity-check.sh`) | G4 selže → promote blokován | Zkopírovat skript na EDGE2 při setupu |
| G-2 | `ZION_POOL_HA_PROBE_CMD` musí být nastaven v `/etc/zion/pool-standby.env` | Guard použije pomalý SSH path (3 spojení místo 1) | Nastavit po setup-fencing-key.sh |
| G-3 | `ZION_PROMOTE_TOKEN_SYNC` není nastaven → token jen lokálně | G5 single-flight neplatí oboustranně | Nastavit na EDGE2 host v env |
| G-4 | Watchdog je alert-only (správně), ale operátor může promotovat poslepu | Dvojí výplata | Guard token je povinný (alert obsahuje hint) |
| G-5 | 30 s interval watchdogu bez fencingu = dvojí výplata | Split-brain | Guard G1-G6 vynucuje fencing před každým promotem |
| G-6 | `paritní skript` běží 180 s — pokud primár zemře během parity checku, G1 se neaktualizuje | Stale G1 | Parity check běží až po G1-G3 (primár už prokazatelně mrtvý) |
| G-7 | Token sync přes SSH může selhat (síť) | Token jen lokálně, standby neví | Guard vypíše varování, operátor musí ověřit |

### 2.4 Co NENÍ implementováno (stále chybí)

1. **`docs/3.2/ops/POOL-HA-RUNBOOK.md`** — ✅ vytvořeno tímto dokumentem
2. **Zápis do AGENTS.md / StatusV3.md / infra/RUNBOOK.md** — viz §6
3. **Staged activation (log-only → armed)** — viz §4
4. **DR-BRINGUP-RUNBOOK.md** — referencovaný, ale neexistuje v repu (zkontrolovat)

---

## 3. Promote procedura (s fencingem)

### 3.1 Předpoklady (všechny musí být splněny)

- [ ] Watchdog alert dorazil (3 consecutive fails, ~90 s)
- [ ] Manuální ověření: `curl -m 10 http://127.0.0.1:8080/health` (tunel) + `nc -zv 62.171.141.136 8444` (stratum) — oba fail
- [ ] Standby freshness: stamps ≤ 2 min (pplns/payouts), ≤ 1 h (db)
- [ ] `dr-parity-check.sh` bez FAIL
- [ ] `pool-promote-guard.sh --check` → ALLOWED

### 3.2 Promote kroky (manuální, s tokenem)

```bash
# 1. Získat fencing token
bash infra/tools/pool-ha/pool-promote-guard.sh --promote
# → vypíše postup + token (TTL 900 s)

# 2. Izolovat primár (pokud dosažitelný)
ssh zion-v6 'systemctl stop zion-v31-watchdog.timer'
ssh zion-v6 'systemctl stop zion-v31-pool'
ssh zion-v6 'systemctl is-active zion-v31-pool'   # MUSÍ být inactive

# 3. Parita bez FAIL
bash scripts/ops/dr-parity-check.sh

# 4. Otevřít stratum na standby + přepnout nginx
ssh zion-edge2 'touch /opt/zion/data/v31-standby/ACTIVATED'
ssh zion-edge2 'systemctl start zion-pool-standby'
# verify: journalctl -u zion-pool-standby -f

# 5. Repoint nginx (EDGE2) → 127.0.0.1:8090
ssh zion-edge2 'nginx -t && systemctl reload nginx'

# 6. DNS (WebGlobe): stratum.zionterranova.com → 207.180.217.100

# 7. Zrušit token po ověření
bash infra/tools/pool-ha/pool-promote-guard.sh --release
```

### 3.3 Co se NESMÍ stát

- **Nikdy** neprovádět promote bez tokenem z guardu
- **Nikdy** nespouštět standby bez ACTIVATED flagu
- **Nikdy** neotevírat stratum na standby, dokud primár běží
- **Nikdy** nepřepínat DNS, dokud standby není ověřený (journalctl)

---

## 4. Staged activation (log-only → armed)

### 4.1 Aktuální stav

| Komponenta | Stav | Poznámka |
|---|---|---|
| pool-promote-guard.sh | ✅ implementován | G1-G6 + single-flight token |
| pool-ha-watchdog.sh | ✅ alert-only | nikdy nespouští standby |
| edge-pool-probe.sh | ✅ read-only sonda | forced command na primáru |
| setup-fencing-key.sh | ✅ idempotentní setup | z operátorského stroje |
| dr-parity-check.sh | ✅ existuje | read-only parity gate |
| pool-standby-sync.sh | ✅ replikace | minutová (JSON) + hodinová (DB) |
| Testy | ✅ 22/22 pass | test-promote-guard.sh (stubované) |

### 4.2 Staged activation postup

**Fáze 1: log-only (aktuální)**
- Guard běží v `--check` mode, loguje verdikty do audit JSONL
- Watchdog alertuje, ale nic nespouští
- Operátor manuálně rozhoduje o promotu
- **Výstup:** audit log s historií verdiktů, žádné auto-akce

**Fáze 2: armed (po 👤 sign-off)**
- Podmínky:
  1. Fencing analýza dokončena (§2.3 gaps uzavřeny)
  2. DR-BRINGUP-RUNBOOK.md existuje a je otestován
  3. `ZION_POOL_HA_PROBE_CMD` nastaven a ověřen
  4. `ZION_PROMOTE_TOKEN_SYNC` nastaven
  5. dr-parity-check.sh zkopírován na standby
  6. Alespoň 1 dry-run promote (bez skutečného přepnutí) úspěšný
- Aktivace: nastavit `ZION_POOL_HA_MODE=armed` v pool-standby.env
- **Výstup:** guard může vydávat tokeny, ale stále žádný auto-promote (DNS je manuální)

**Fáze 3: auto-promote (budoucnost, vyžaduje DNS API)**
- Podmínky: WebGlobe DNS API dostupné, automatické DNS přepínání
- **NEPLÁNOVÁNO** pro v3.2 — vyžaduje externí review

### 4.3 Aktivační checklist (pro 👤)

- [ ] Gap G-1: dr-parity-check.sh zkopírován na EDGE2
- [ ] Gap G-2: ZION_POOL_HA_PROBE_CMD nastaven a testován
- [ ] Gap G-3: ZION_PROMOTE_TOKEN_SYNC nastaven
- [ ] DR-BRINGUP-RUNBOOK.md vytvořen a otestován
- [ ] Alespoň 1 dry-run promote úspěšný (guard --promote → --release bez skutečného přepnutí)
- [ ] Audit log obsahuje alespoň 7 dní verdiktů
- [ ] 👤 sign-off na armed mode

---

## 5. Failback procedura (EDGE2 → EDGE)

1. Zastavit standby: `systemctl stop zion-pool-standby`, `rm …/ACTIVATED`
2. Zkopírovat live standby state zpět na EDGE:
   - `/opt/zion/data/v31-standby/pool-pplns.json` → `/opt/zion/data/v31/pool-pplns.json`
   - `….payouts.json` → `….payouts.json`
   - `pool-store.db` → `pool-store.db`
3. Spustit `zion-v31-pool` na EDGE
4. Ověřit: journalctl, /health, stratum
5. Repoint nginx (EDGE2) → tunnel :8080
6. DNS (WebGlobe): stratum → 62.171.141.136
7. Ověřit: minery se reconnectují

---

## 6. Monitoring a alerty

### 6.1 Watchdog (alert-only)
- Cadence: 30 s
- Podmínka alertu: 3 consecutive fails (~90 s) obou probe (API + stratum)
- Alert: Telegram + state file dedup (1 alert per incident, 1 recovery notice)
- Cooldown: 1800 s (30 min) mezi alerty

### 6.2 Guard audit log
- Cesta: `/var/lib/zion-pool-ha/promote-audit.jsonl`
- Formát: `{"ts":"...","epoch":N,"actor":"...","mode":"...","verdict":"...","detail":"..."}`
- Retence: append-only, chmod 600

### 6.3 Klíčové metriky pro monitoring
- Watchdog state: `fails`, `last_alert`, `status` (ok/down)
- Guard token: aktivní/expirovaný/žádný
- Sync stamps: pplns (≤2 min), payouts (≤2 min), db (≤1 h)
- Parity check: 0 FAIL

---

## 7. Zápis do dalších dokumentů

### AGENTS.md
- Přidat odkaz na tento runbook v sekci "Rejstřík detailních dokumentů"
- Aktualizovat HA stack popis (fencing guard implementován)

### StatusV3.md
- Aktualizovat HA stack status: fencing guard implementován, staged activation pending

### infra/RUNBOOK.md
- Přidat sekci "Pool HA — Fencing a promote procedura" s odkazem na tento dokument

---

## 8. Otevřené položky (TODO)

- [ ] Vytvořit `docs/3.2/ops/DR-BRINGUP-RUNBOOK.md` (referencovaný, ale neexistuje)
- [ ] Zkopírovat `dr-parity-check.sh` na EDGE2
- [ ] Nastavit `ZION_POOL_HA_PROBE_CMD` a `ZION_PROMOTE_TOKEN_SYNC` v pool-standby.env
- [ ] Provést alespoň 1 dry-run promote (guard --promote → --release)
- [ ] Shromáždit 7 dní audit logu
- [ ] 👤 sign-off na armed mode

---

*Vytvořeno 2026-11-02 jako součást fencing analýzy (W2.2/G11).*