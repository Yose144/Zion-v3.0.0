# 🚀 ZION — Quick Start pro přispěvatele (CZ)

Tento krátký návod pomůže rychle začít vyvíjet a testovat ZION lokálně.

## Požadavky
- macOS / Linux (bash/zsh)
- Python 3.11
- Docker & Docker Compose
- Node.js + npm (pro web: `website-v2.9`)
- (Volitelně) Ollama + model `codellama:7b` pro AI-native funkce

## Rychlý start — lokální stack
1. Zkopírujte `.env.template` → `.env` a doplňte potřebné hodnoty.

2. Spusťte stack (vývoj):
```bash
docker-compose -f docker-compose.yml up -d
# nebo pro plnou testovací produkci
docker-compose -f docker-compose-v2.9-production.yml up -d
```

3. Zkontrolujte běžící služby:
```bash
docker-compose ps
```

4. Sledujte logy poolu:
```bash
docker-compose logs -f pool
```

## Spuštění mineru lokálně (test)
```bash
# spustit native miner (demo)
python src/miner/zion_miner_v2_9.py --pool localhost:3333 --wallet ZION_YOUR_ADDRESS --threads 2
```

## Testy
- Spusťte všechny unit testy:
```bash
pytest -m unit -v
```
- Integrační testy (vyžadují služby):
```bash
pytest -m integration -v
```
- Seznam markerů najdete v `pytest.ini` (např. `requires_gpu`, `api`, `e2e`).

## Lint & formátování
- Formátování: `black .`
- Statická kontrola: `mypy`, `flake8` (viz `pyproject.toml` a `mypy.ini`).

## Důležité soubory a místa v projektu
- Architektura: `docs/technical/PROJECT_ARCHITECTURE_OVERVIEW.md`
- Pool: `src/pool/` (hlavní orchestrace `src/pool/zion_pool_v2_9.py`)
- Miner: `src/miner/` (`zion_miner_v2_9.py`)
- API: `src/api/` (FastAPI, agent control plane)
- AI: `ai/` (knowledge extractor, orchestrator, QuickStart v `ai/PROJECT_SUMMARY_AI_NATIVE.md`)
- Deployment: `DEPLOYMENT_PLAN_v2.9_COMPLETE.md`, `QUICK_DEPLOY_GUIDE.md`

## Bezpečnost & poznámky
- Pozor: `ecdsa==0.19.0` má známou timing-attack zranitelnost; plánuje se migrace na `cryptography`.
- Před nasazením do produkce doplňte všechny `config/*_production.json` a `.env` hodnoty.

## Kde nahlásit problém nebo položit dotaz
- Vytvořte issue na GitHubu s popisem kroku reprodukce a logy
- Pro urgentní deploy/ server issues: podívejte se do `SERVER_ACCESS_SSH.md` a použijte deploy skripty

---
Tento soubor je základní checkpoint — chcete, abych přidal sekci pro debugging poolu nebo ukázkové příkazy pro lokalní debugging (Stratum/telnet)?