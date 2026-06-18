# Poznámky k migraci — v2.9.9 → V3

## Cíl

Udržet 2.9.9 jako auditovatelný archivní most a přenést čistý runtime základ do V3 mainnet-tracku bez nekontrolovaného legacy driftu.

## Rozsah přenosu

- Části konsenzu/runtime ověřené na kanonické cestě.
- Propojení pool/miner bez historických experimentálních větví.
- Dokumentace launch gate a kritérií readiness.

## Mimo rozsah přenosu

- Historické experimenty a duplicity.
- Neauditované vedlejší fallbacky.
- Staré veřejné messaging větve v rozporu s aktuální launch politikou.

## Výsledek

V3 zůstává čistá provozní linie pro mainnet track; 2.9.9 zůstává referencí a auditní evidencí.
