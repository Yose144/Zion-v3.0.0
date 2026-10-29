# QTC payout policy — veřejné prohlášení (B2B-2 / 2.B7)

> **Účinnost:** 2026-10-29 · Status: **honest hold** (hybrid D)
> **Scope:** Quantus (QTC) miner payouts z ZION poolu — **ne** ZION L1 payouty.

## Shrnutí pro minery

ZION pool vyplácí **ZION on-chain průběžně**. Quantus (QTC) výplaty
adresované na `qtc:`/`qz…` jsou dočasně **pozastavené (deferred)**, dokud
nebude funded hot treasury. Ledger řádků je zachován — žádný tichý write-off.

ZION unconfirmed backlog (dust/fee) je **oddělený** problém a od 28. 10. 2026
běží recovery (`defdcd84a`); nesmí se zaměňovat s QTC.

## Proč

Payout sweeper (`QtcPayoutSweeper`) před submitem kontroluje free balance
treasury účtu. Když `amount + fee > free`, řádek se **parkne jako `deferred`**
(attempts=0, přežije restart) — fail-closed proti `InsufficientFunds` spam
a double-pay. Live stav od října 2026: **treasury_free = 0**, ~**918**
deferred řádků.

Upstream / native QTC revenue směřuje do canonical revenue wallet; hot
treasury pro miner výplaty je oddělený účet a byl prázdný.

## Politika (D · hybrid)

1. **Žádný write-off** bez samostatného oznámení a auditu souč.
2. **Deferred řádky zůstávají v ledgeru** a vyplatí se FIFO, jakmile
   treasury dostane QTC (převod z revenue / funding).
3. **Sweeper zůstává připravený** (`QTC_PAYOUT_ENABLED` + kurz
   `QTC_PLANKS_PER_FLOWER`) — automaticky odčerpá deferred po funding.
4. **ETA:** bez pevného data; podmínka = funded treasury. Operátor
   oznámí funding window samostatně (pool FAQ + news).
5. **Komunikace:** pool FAQ a payout stránka explicitně uvádějí hold;
   neslibujeme „periodické dávky", dokud treasury není funded.

## Co to není

- Není to změna PPLNS kreditů v ZION flowers.
- Není to zrušení QTC adresního směrování — `qtc:` workers dál
  akumulují unpaid; výplata se jen neodesílá on-chain.
- Není to ZION payout incident (ten má vlastní recovery track).

## Operátorské volby (interní)

| Volba | Akce |
|---|---|
| **Fund (preferovaná)** | Převod available QTC revenue → hot treasury; sweeper clear deferred |
| **Delay (tato politika)** | Hold + veřejná komunikace |
| **Restructure** | Jen s auditem Σ(planks) + explicitním miner notice (write-off / ZION credit) |

## Odkazy

- `Zionb2b.md` §5 #2 · `docs/3.2/DEFERRED_3.2.md` (QTC řady)
- `docs/3.2/QUANTUS-INTEGRATION-PLAN.md` · `V31/L2/multichain/src/qtc_payout.rs`
