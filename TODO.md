# 📋 ZION TerraNova — TODO (Konsolidovaný po hloubkové analýze)

> **Aktualizace:** 24. února 2026 (Session 49)  
> **Cíl:** L1 MainNet Genesis **31. 12. 2026**  
> **Scope analýzy:** všechny hlavní mainnet roadmapy + reporty + live server check přes SSH

---

## 0) Co bylo při této analýze ověřeno

### Dokumenty (roadmapy / checklisty / reporty)
- `docs/MAINNET_ROADMAP_2026.md`
- `docs/MAINNET_READINESS-ROADMAP.md`
- `docs/MAINNET_PREFLIGHT_CHECKLIST.md`
- `docs/MAINNET_CHECKLIST.md`
- `docs/mainnet/MAINNET_CHECKLIST.md`
- `docs/mainnet/COMPLETE_ROADMAP_TO_MAINNET.md`
- `docs/ROADMAP.md`
- `docs/L1-L4_ROADMAP.md`
- `docs/MAINNET_LAUNCH_PLAN_v2.9.5.md`
- `docs/MAINNET_CONSTITUTION.md`
- `docs/mainnet/MAINNET_CONSTITUTION.md`
- `REPORT.md`
- `docs/REPORT.md`
- `docs/REPORT_SESSION_9-17_FEB_2026.md`
- `docs/AUDIT_SERVERS_2026-02-12.md`
- `docs/AUDIT_2026_02_16.md`
- `SERVERS.md`

### Live servery (SSH + runtime snapshot)
- ✅ Helsinki `77.42.31.72`
- ✅ SeedDE `46.225.126.243`
- ✅ Usa1 `5.78.178.227`
- ✅ Usa2 `178.156.240.160`
- ✅ Asia3 `5.223.43.93`

---

## 1) Live stav serverů (24. 2. 2026)

### Síť / chain
- ✅ Všechny ověřené nody hlásí `height: 5199` a `network: testnet` přes `http://localhost:8444/health`
- ✅ Peers: Helsinki 16, SeedDE 32, Usa1 36, Usa2 31, Asia3 36
- ⚠️ Helsinki i SeedDE reportují nenulové `blocks_rejected` (monitorovat trend)

### Runtime / kapacita
- 🔴 **Helsinki RAM tlak**: 7.2/7.5 GiB, load ~22–24 (velmi vysoké)
- 🟡 SeedDE: RAM 3.3/3.7 GiB, load ~5
- 🟢 Usa1/Usa2/Asia3: load ~3–4, RAM ~1.0/1.9 GiB

### Kontejnery
- Helsinki: `zion-core`, `zion-pool`, `zion-miner`, `zion-mysterium`, `zion-dero-miner`, `zion-zeph-miner`, `zion-grafana`, `zion-prometheus` ✅
- SeedDE: `zion-core`, `zion-miner`, `zion-mysterium`, `zion-dero-miner`, `zion-epic-miner` ✅
- Usa1/Usa2/Asia3: `zion-core`, `zion-miner`, `zion-mysterium`, `zion-xmr-x86` ✅
- ⚠️ SeedDE: pool API `localhost:8080` momentálně nedostupná (pool zřejmě neběží / není vystaven)

---

## 2) Hlavní zjištění z roadmap/report konsolidace

### A) Dokumentační drift (kritický)
- 🔴 Různé dokumenty uvádějí odlišnou readiness (`~65%` až `~92%`).
- 🔴 Dva constitution dokumenty mají konflikt v premine pravidlech (immediate unlock vs. část time-lock).
- 🔴 Starší roadmapy obsahují dnes neaktuální baseline (3 seed nody, staré test-county, staré P0 stavy).

### B) P0/P1 status drift
- ✅ Prakticky: 5 seed nodů jsou aktivní (live ověřeno).
- ⚠️ Formálně: některé checklisty stále vedou seed část jako pending nebo s historickými IP.
- ⚠️ Některé body označené dříve jako hotové nemají jednotný důkaz v jednom „master“ checklistu.

### C) Největší aktuální operační rizika
1. 🔴 Helsinki resource pressure (RAM/load) = riziko nestability.
2. 🟡 SeedDE pool/API nesoulad oproti očekávanému role modelu.
3. 🔴 Chybí jednoznačný, jednotný „source of truth“ pro MainNet freeze parametry.
4. 🔴 Premine/keys governance a history hygiene musí být explicitně uzavřené před dress rehearsal.

---

## 3) Priorita P0 (teď)

### P0-01 — Canonical MainNet Source of Truth (blokující)
- [ ] Vybrat **jediný** autoritativní dokument pro launch gating (`docs/MAINNET_CHECKLIST.md`).
- [ ] Sloučit konflikty z `docs/MAINNET_CONSTITUTION.md` vs `docs/mainnet/MAINNET_CONSTITUTION.md`.
- [ ] Zamknout hodnoty: reward model, premine unlock pravidla, genesis timestamp policy.
- [ ] Přidat sekci „Superseded docs“ do starších roadmap/checklist souborů.

### P0-02 — Helsinki stabilita (blokující)
- [ ] Okamžitě snížit resource tlak (rebalanc/limitace revenue procesů, memory audit kontejnerů).
- [ ] Nastavit alert na RAM > 90% + load > počet vCPU na 30 min.
- [ ] Ověřit, že `zion-dero-miner` restarty nejsou časté (stabilita > 24h).

### P0-03 — SeedDE role korekce
- [ ] Rozhodnout cílovou roli SeedDE: `seed-only` vs `seed+pool`.
- [ ] Pokud `seed+pool`, obnovit/validovat `zion-pool` + API:8080.
- [ ] Pokud `seed-only`, upravit dokumentaci (SERVERS + checklist) aby nečekala pool endpoint.

### P0-04 — MainNet exit criteria evidence
- [ ] Udržet formální evidence pro bug-free window + orphan/reject trend.
- [ ] Dopsat metriku „orphan/reject rate“ do jednotného dashboardu a checklistu.
- [ ] Přidat datum+důkaz pro každý P0 bod (odkaz na command output/log panel).

---

## 4) Priorita P1 (do 2–4 týdnů)

### Bezpečnost / release
- [ ] Premine key ceremony runbook (air-gapped, dual backup, sign-off).
- [ ] Dokončit write-endpoint auth revizi napříč core/pool/dao (jednotný token model).
- [ ] Připravit externí audit package (scope, frozen commit, threat model).

### Infra / observabilita
- [ ] Alertmanager routing (Telegram/Slack) + test incident cesty.
- [ ] Height divergence alert mezi 5 nody.
- [ ] Standardizace firewall politik na všech uzlech.

### Kvalita / release engineering
- [ ] Reproducible build checklist + SHA256 publishing flow.
- [ ] Windows artifact verifikace v release pipeline.
- [ ] Jednotné release note šablony (core/pool/miner/web).

---

## 5) Priorita P2 (post-mainnet / paralelně)

- [ ] L2 bridge/DAO produkční hardening (audit + integration soak).
- [ ] L3/L4 milestones držet odděleně od L1 freeze tracku.
- [ ] Cleanup starých roadmap duplicit do archivu `docs/ARCHIVE/`.

---

## 6) Konkrétní akce na další 72 hodin

- [ ] **Dnes:** publish „MainNet Canonical Checklist v1.0" + označit superseded dokumenty.
- [ ] **Dnes:** Helsinki performance triage (RAM/load) + mitigace + záznam do `REPORT.md`.
- [ ] **Zítra:** SeedDE role fix + verifikace API dostupnosti podle cílové role.
- [ ] **Do 48h:** aktualizovat `SERVERS.md` o live role mapu (core/pool/revenue/monitoring) včetně důkazů.
- [ ] **Do 72h:** přidat orphan/reject trend panel + alert threshold + odkaz do checklistu.

---

## 7) Stav po této aktualizaci

- ✅ Deep analýza roadmap/report dokumentů provedena
- ✅ Live server snapshot ověřen přes SSH
- ✅ TODO sjednoceno na aktuální realitu (24. 2. 2026)
- ⏭️ Další krok: převést tento TODO plán do konkrétních issue/task IDs a začít P0-02 (Helsinki tlak)
