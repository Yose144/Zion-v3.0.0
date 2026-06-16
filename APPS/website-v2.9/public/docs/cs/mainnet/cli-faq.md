# ZION CLI FAQ

## Je `zion` jen obal kolem node?

Ne. Cíl je mít jeden operator gateway pro L1, L2, L3 i deploy workflow.

## Musí mít `zion agent` lokální GPU?

Ne. Agent musí být užitečný i bez lokálního GPU a bez velkého modelu na stejném hostu.

## Proč je AI Native popsané jako orchestrator?

Protože to odpovídá realitě infrastruktury i směru architektury:

- dnes potřebujeme hlavně řízení služeb,
- health/status a integrace přes stack,
- ne předstírat těžký on-host inference runtime tam, kde na něj není hardware.

## Jaké vrstvy jsou dnes kanonické?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

## Co znamená fallback u `zion agent`?

Že L3 runtime běží a přizná, že model backend není momentálně dostupný. To je lepší než tichý fail.

## Co je další priorita?

1. rozšířit referenci ke všem command groups,
2. doplnit troubleshooting a deploy flows,
3. držet web docs synchronní s CLI surface.