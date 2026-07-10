# ZION CLI Slovníček pojmů

Stručné vysvětlivky pro veřejnost a nováčky.

## `zion`

Hlavní CLI nástroj pro ovládání ZION stacku.

## CLI

Command Line Interface. Příkazy v terminálu.

## L1

Základní blockchain vrstva: node, pool, miner.

## L2

Nadstavbové protokoly: bridge, DAO, DeFi.

## L3

AI Native, WARP, NCL (orchestrace a vyšší vrstva koordinace).

## Node

Uzel blockchainu. Drží chain data a poskytuje RPC.

## RPC

Rozhraní, přes které aplikace (např. web explorer) čtou data z node.

## Pool

Server, který koordinuje minery a přijímá shares.

## Miner

Proces, který počítá hash a hledá validní výsledky pro PoW.

## Wallet

Peněženka pro adresy, zůstatek a transakce.

## AI Native

Aktuálně hlavně orchestraci / control-plane vrstva. Nemusí znamenat těžký lokální inference backend.

## Fallback mode

Služba běží, ale model backend není dostupný. Transparentní degradace je lepší než tichý pád.

## `zion status`

Rychlý souhrn zdraví stacku.

## `zion doctor`

Preflight kontrola připravenosti: config, endpointy, základní diagnostika.

## `zion logs <service>`

Vypíše logy konkrétní služby (např. `node`, `pool`, `ai-native`).

## `zion deploy`

Sada příkazů pro nasazení a provozní akce na serveru.

## `zion update`

Aktualizace lokální CLI binárky.

## `zion deploy update`

Aktualizace remote runtime / služeb na serveru.

## Health check

Kontrolní endpoint / služba, která potvrzuje, že aplikace běží.

## Prune

Čištění nepoužívaných Docker artefaktů (cache, dangling images). Není to první krok diagnostiky incidentu.
