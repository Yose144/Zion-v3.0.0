# Changelog — v2.9.8 (Ekam Deeksha)

## Delta oproti v2.9.7

- Kanonická PoW cesta sjednocena pod `cosmic_harmony`.
- Aktivace Ekam Deeksha přes reset chain semantics v rolloutu.
- Build/deploy workflow sjednocen pro live provoz.
- Veřejná topologie normalizována na 1 veřejný host + interní seed lanes.

## Co zůstává beze změny

- Nabídka 144B a veřejně deklarovaný ekonomický rámec.
- Žádná nová paralelní konsenzuální větev.
- Zachovaná provozní kontinuita CHv3 revenue wiring.

## Ověření rolloutu

- Obnovena produkce bloků po resetu.
- Pool validace bez regrese rejectů během kontrol rolloutu.
- Miner hlásí live hashrate a accepted submit.
