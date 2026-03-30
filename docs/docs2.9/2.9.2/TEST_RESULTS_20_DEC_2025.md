# Testy – výsledky (20.12.2025)

## Kontext
- Cíl: pokračovat podle roadmapy (Phase 1) – stabilizovat test suite a postupně zvedat coverage.
- Pozn.: `pytest` aktuálně běží v globálním Pythonu 3.14, ne v `.venv`, takže některé volitelné závislosti nejsou dostupné.

## Jak bylo spuštěno
- Příkaz: `pytest -q --maxfail=50`
- Defaultně deselect: `integration`, `e2e`, `benchmark` (nastaveno v `pytest.ini`).

## Souhrn výsledků
- Příkaz: `pytest -q --maxfail=1 -ra`
- Souhrn: `161 passed, 53 skipped, 24 deselected` (0 failures / 0 errors)
- Čas: ~12s na defaultní „unit-first“ běh (macOS, Python 3.14)

## Stav blokátorů
- Žádné blokující chyby – suite je na defaultní běh zelená.

## Co se změnilo (20.12.2025)
- WebSocket cluster opraven (backward-compat ConnectionManager/EventEmitter) – všechny WS testy nyní procházejí.
- Xmrig testy překlasifikované na `integration`/`requires_network`, opt-in přes `RUN_XMRIG_TESTS=1`.
- Pomalejší / network-heavy testy (yescrypt native, WARP API, v2.9 stack, stratum quick, AI integration) označeny `integration`/`slow` a jsou opt-in přes `RUN_SLOW_TESTS=1`, takže defaultní běh je rychlý.

## Poznámka k rychlosti
- Defaultní suite se nyní vejde do ~12s; slow/network scénáře spouštět jen s `RUN_SLOW_TESTS=1` (a případně `RUN_XMRIG_TESTS=1`).
