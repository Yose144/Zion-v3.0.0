# ZION CLI Slovnicek pojmu

Strucne vysvetlivky pro verejnost a novacky.

## `zion`

Hlavni CLI nastroj pro ovladani ZION stacku.

## CLI

Command Line Interface. Prikazy v terminalu.

## L1

Zakladni blockchain vrstva: node, pool, miner.

## L2

Nadstavbove protokoly: bridge, DAO, DeFi.

## L3

AI Native, WARP, NCL (orchestrace a vyssi vrstva koordinace).

## Node

Uzel blockchainu. Drzi chain data a poskytuje RPC.

## RPC

Rozhrani, pres ktere aplikace (napr. web explorer) ctou data z node.

## Pool

Server, ktery koordinuje minery a prijima shares.

## Miner

Proces, ktery pocita hash a hleda validni vysledky pro PoW.

## Wallet

Penezenka pro adresy, zustatek a transakce.

## AI Native

Aktualne hlavne orchestracni/control-plane vrstva. Nemusi znamenat tezky lokalni inference backend.

## Fallback mode

Sluzba bezi, ale model backend neni dostupny. Transparentni degradace je lepsi nez tichy pád.

## `zion status`

Rychly souhrn zdravi stacku.

## `zion doctor`

Preflight kontrola pripravenosti: config, endpointy, zakladni diagnostika.

## `zion logs <service>`

Vypise logy konkretni sluzby (napr. `node`, `pool`, `ai-native`).

## `zion deploy`

Sada prikazu pro nasazeni a provozni akce na serveru.

## `zion update`

Aktualizace lokalni CLI binarky.

## `zion deploy update`

Aktualizace remote runtime/sluzeb na serveru.

## Health check

Kontrolni endpoint/sluzba, ktera potvrzuje, ze aplikace bezi.

## Prune

Cisteni nepouzivanych docker artefaktu (cache, dangling images). Neni to prvni krok diagnostiky incidentu.
