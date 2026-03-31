# Migration Notes — v2.9.9 -> V3

## Cíl

Udržet 2.9.9 jako auditovatelný archivní bridge a převést čistý runtime základ do V3 mainnet-tracku bez neřízeného legacy driftu.

## Scope přenosu

- Consensus/runtime části ověřené v canonical cestě.
- Pool/miner wiring bez historických experimentálních větví.
- Dokumentace launch gate a readiness kritérií.

## Scope mimo přenos

- Historické experimenty a duplicity.
- Neauditované vedlejší fallbacky.
- Staré public messaging větve, které nejsou v souladu s aktuální launch politikou.

## Výsledek

V3 zůstává čistá provozní linie pro mainnet track; 2.9.9 zůstává reference + audit evidence.
