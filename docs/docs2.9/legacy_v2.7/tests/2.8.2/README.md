# ZION 2.8.2 Test Suite

Organizovaná testovací sada pro ZION blockchain verze 2.8.2.

## Struktura

### Cosmic Harmony Tests (`cosmic_harmony/`)
Testy pro Cosmic Harmony mining algoritmus:
- `test_cosmic_harmony_algorithm.py` - Unit testy pro core algoritmus
- `test_cosmic_harmony_integration.py` - Integrační testy
- `test_cosmic_harmony_mining.py` - Mining functionality testy
- `test_cosmic_harmony_quick.py` - Rychlé validační testy

### Mining Tests (`mining/`)
Testy pro mining systém:
- GPU mining testy
- Pool mining testy
- Stabilita a validace

### Pool Tests (`pool/`)
Testy pro mining pool:
- Pool stability testy
- 2-minute pool GPU testy
- 30-second pool miner testy

### Integration Tests (`integration/`)
Celkové integrační testy:
- `test_realtime_orchestrator.py` - Real-time orchestrator testy
- `test_websocket_server.py` - WebSocket server testy

## Spuštění testů

### Všechny testy
```bash
pytest tests/2.8.2/
```

### Specifická kategorie
```bash
pytest tests/2.8.2/cosmic_harmony/
pytest tests/2.8.2/mining/
pytest tests/2.8.2/pool/
pytest tests/2.8.2/integration/
```

### Jeden konkrétní test
```bash
pytest tests/2.8.2/cosmic_harmony/test_cosmic_harmony_quick.py
```

## Požadavky

Instalace test dependencies:
```bash
pip install -r requirements.txt
```
