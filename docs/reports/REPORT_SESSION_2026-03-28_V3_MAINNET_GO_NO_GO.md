# ZION V3 Mainnet Go/No-Go Report

**Datum:** 28. března 2026  
**Rozhodnutí:** `NO-GO` pro veřejný produkční mainnet launch dnes  
**Doplňující verdikt:** `GO` pro další řízený engineering rollout, canary a launch rehearsal na auditovaném 3-node V3 setu

---

## 1. Executive Verdict

V3 runtime už není ve stavu "dlouhý testnet bez směru". Konsensus, peer sync, on-chain payout split, core rollout disciplína a cross-node ověření jsou reálně funkční.

Přesto dnes nedává smysl pustit **veřejný produkční mainnet launch**. Hlavní důvod není v tom, že by chain neuměl běžet, ale v tom, že nejsou uzavřené poslední launch-gating a security kroky kolem veřejného vypuštění.

Nejpřesnější formulace k dnešnímu dni:

- `GO` pro controlled V3 mainnet rehearsal a další uzavírání launch checklistu
- `NO-GO` pro public production launch s otevřeným repem a veřejným release packagingem

---

## 2. Green — Co je už ověřeně připravené

### Runtime a consensus

- V3 core generuje a validuje chain podle kanonického mainnet směru
- on-chain reward split je potvrzen live bloky, ne jen pool accountingem
- první explicitně ověřený split-enabled blok: `465`
- další potvrzení na auditovaných nodech: `471`, `472`

### Deploy a operations

- Prague, USA a Singapore přežily rollout bez divergence
- root cause z prvního neúčinného deploye byl nalezen a zdokumentován
- existuje shell-ready deploy runbook i post-deploy verification checklist

### Codebase a test floor

- `cargo test --manifest-path V3/Cargo.toml` je vedené jako zelené
- V3 workspace má zhruba `1300+` testů bez známých pádů ve source-of-truth dokumentaci
- fuzz harnessy pro core a pool už v repu existují
- V3 CI a V3 release workflow existují

### Monitoring a observability

- node metrics endpoint existuje
- pool stats a metrics endpoint existují
- Prometheus/Grafana stack je veden jako funkční v V3 dokumentaci

---

## 3. Red — Launch Blockers

### R1. Git history scrub premine backupu

To je aktuálně nejtvrdší blocker.

- `git log --all --name-only` stále ukazuje `PREMINE_WALLETS_BACKUP.json`
- dokud nebude historie vyčištěna, public launch a public fork zůstávají bezpečnostně problematické

**Stav:** `RED`

### R2. Genesis ceremony není uzavřená

Chybí finální uzavření těchto kroků:

- offline genesis artifact
- publikovaný hash
- finální release tag
- veřejně doložené release artefakty a checksumy

**Stav:** `RED`

### R3. Exit criteria nejsou uzavřené sign-offem

`MAINNET_EXIT_CRITERIA.md` existuje, ale stále je draft a bez finálního launch sign-offu.

To znamená, že launch gating není administrativně ani operativně uzavřený, i když velká část technického základu už existuje.

**Stav:** `RED`

### R4. Dlouhé launch rehearsal okno není doložené

Stále chybí uzavřené důkazy pro:

- 72h stabilitní okno
- případně 7-day canary run
- měřitelné výsledky pro orphan rate, reject rate, divergence a restart discipline

Jednorázově úspěšný rollout ještě není totéž co launch readiness.

**Stav:** `RED`

---

## 4. Amber — Vysoká priorita před launch

### A1. Security sign-off není dotažený

Harnessy pro fuzzing existují, ale pořád chybí:

- skutečná fuzz kampaň
- explicitní RPC/P2P input boundary review sign-off
- rate-limit / DoS simulation pass

**Stav:** `AMBER`

### A2. Release engineering není dotažený do public launch kvality

V3 CI a release workflow existují, ale pořád chybí jasné uzavření těchto položek:

- explicitní mainnet correctness gate nebo ekvivalentní launch workflow
- publikované checksums
- finální versioned release artefakty

**Stav:** `AMBER`

### A3. Seed infra, alert routing a recovery drills

Tři auditem potvrzené nody jsou dobrý základ, ale ještě chybí:

- alert routing jako povinná součást ops
- zřetelně uzavřené backup/restore rehearsal
- finální seed readiness evidence proti launch checklistu

**Stav:** `AMBER`

### A4. Operátorská dokumentace měla drift

Část dokumentace byla stale vůči skutečnému mainnet deploy modelu.

Tento session update to zlepšuje, ale launch-ready stav vyžaduje, aby operator docs, runbooky a launch checklists přestaly jít proti sobě.

**Stav:** `AMBER`

### A5. Full async multi-peer IBD zůstává otevřené

Není to nutně blocker pro controlled genesis s menším seed setem, ale pořád je to technický dluh pro širší produkční síť.

**Stav:** `AMBER`

---

## 5. Not Blocking L1 Launch Today

Tyto položky nejsou potřeba jako podmínka pro samotný čistý L1 mainnet start:

- L2 contracts redeploy
- L2/L3 production hardening jako celek
- post-launch governance ergonomie
- public exchange onboarding balík

Jsou důležité, ale nepatří do minimálního launch gate pro samotný chain.

---

## 6. RAG Matrix

| Oblast | Stav | Poznámka |
|-------|------|----------|
| Consensus / block validation | GREEN | Funkční a auditovaně rozumné |
| On-chain payout split | GREEN | Live ověřeno |
| Cross-node sync po rollout | GREEN | Prague/USA/Singapore potvrzené |
| Base deploy discipline | GREEN | Runbook + checklist existují |
| Monitoring base | GREEN | Metrics + dashboard stack existuje |
| Git history secret hygiene | RED | Premine backup pattern v historii |
| Genesis freeze / public artifact chain | RED | Neuzavřeno |
| Launch sign-off / exit criteria closure | RED | Dokument je stále draft |
| 72h / 7-day rehearsal evidence | RED | Neuzavřeno |
| Security sign-off | AMBER | Harnessy existují, campaign ne |
| Release engineering | AMBER | CI ano, public release gate ještě ne |
| Seed ops / backups / alert routing | AMBER | Část existuje, část neuzavřená |
| Operator docs consistency | AMBER | Zlepšeno v této session |
| Async multi-peer scaling | AMBER | Otevřený technický dluh |

---

## 7. Doporučené pořadí práce

1. Provést BFG scrub a bezpečnostně uzavřít historii repa.
2. Uzavřít exit criteria dokument formálním sign-offem nebo waiver logem.
3. Odběhnout měřený 72h až 7denní launch rehearsal na V3 node setu.
4. Vydat finální release artefakty, tag a checksumy.
5. Uzavřít security pass: fuzz campaign, rate-limit test, boundary review.

---

## 8. Finální závěr

V3 už dnes vypadá dost silně na to, aby běžel jako řízený mainnet-track runtime a aby se přes něj dělaly další produkční rehearsaly.

Na **veřejný produkční launch** ale zatím chybí poslední bezpečnostní a launch-gating vrstva. Dokud nejsou uzavřené `R1–R4`, doporučení zůstává:

- `NO-GO` pro public production launch
- `GO` pro další controlled rollout a launch-closing work

---

## 9. Next 48-72 Hours Before Launch Rehearsal

### Day 1

- uzavřít rozhodnutí kolem BFG scrub postupu a potvrdit, kdo provede historii repa
- srovnat launch-gating dokumenty tak, aby checklist, exit criteria a V3 source-of-truth neříkaly různé věci
- připravit explicitní release checklist pro rehearsal build, tag, checksum a artifact naming

### Day 2

- spustit security pass zaměřený jen na launch surface: RPC boundary, P2P boundary, rate-limit behavior, fuzz smoke campaign
- připravit a ověřit backup/restore rehearsal pro chain state a klíčové deploy konfigurace
- potvrdit alert routing a incident path pro Prague, USA a Singapore node set

### Day 3

- spustit měřený launch rehearsal podle deploy runbooku a exit criteria
- sbírat důkazy pro: chain growth, tip agreement, reject rate, restart behavior, pool recovery, block propagation
- po rehearsal vydat krátký closure report s verdiktem `GO/NO-GO` pro další krok

### Minimum Exit For Rehearsal Start

Launch rehearsal by neměl začít, dokud nejsou splněné alespoň tyto body:

- existuje jasné rozhodnutí k BFG/history scrub riziku
- operator docs a deploy runbook odpovídají skutečnému mainnet stacku
- release artifact naming a checksum flow jsou předem definované
- primární node set a incident kontaktní cesta jsou potvrzené