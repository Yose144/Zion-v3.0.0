# ZION 2.8.2 Scripts

Organizované skripty pro automatizaci a správu ZION blockchain verze 2.8.2.

## Struktura

### Build Scripts (`build/`)
Skripty pro build a setup:
- `build_all_libraries.sh` - Build všech závislých knihoven
- `setup_zqal_development.sh` - Setup ZQAL development prostředí

**Použití:**
```bash
./scripts/2.8.2/build/build_all_libraries.sh
./scripts/2.8.2/build/setup_zqal_development.sh
```

### Pool Scripts (`pool/`)
Skripty pro správu mining poolů:
- Pool management skripty
- Pool monitoring a diagnostika

**Použití:**
```bash
# Příklady jsou v jednotlivých skriptech v pool/ složce
```

### Orchestration Scripts (`orchestration/`)
Skripty pro spouštění a správu orchestrátorů:
- `start_*orchestrator*.sh` - Spouštění různých orchestrátorů
- `start_geographic_balancer.sh` - Geographic load balancer
- `stop_*.sh` - Zastavení služeb

**Použití:**
```bash
# Start orchestrator
./scripts/2.8.2/orchestration/start_*orchestrator*.sh

# Stop services
./scripts/2.8.2/orchestration/stop_*.sh
```

## Mining Integration Report

Pro generování mining integration reportu:
```bash
./scripts/2.8.2/mining_integration_report.sh
```

## Poznámky

- Všechny skripty jsou spustitelné (`chmod +x`)
- Kontrolujte dependencies před spuštěním
- Pro produkční použití zkontrolujte konfiguraci v každém skriptu
