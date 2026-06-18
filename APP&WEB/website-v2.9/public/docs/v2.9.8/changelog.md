# Changelog — v2.9.8 (Ekam Deeksha)

## Delta proti v2.9.7

- Canonical PoW path sjednocen pod `cosmic_harmony`.
- Ekam Deeksha aktivace přes reset chain semantics v rolloutu.
- Build/deploy workflow sjednocen pro live provoz.
- Veřejná topologie normalizována na 1 public host + interní seed lanes.

## Co se nemění

- 144B supply a veřejně deklarovaný economics rámec.
- Žádná nová paralelní consensus větev.
- Zachovaná provozní kontinuita CHv3 revenue wiring.

## Ověření rolloutu

- Bloková produkce obnovena po resetu.
- Pool validace bez reject regresí během rollout checku.
- Miner hlásí live hashrate a accepted submit.
