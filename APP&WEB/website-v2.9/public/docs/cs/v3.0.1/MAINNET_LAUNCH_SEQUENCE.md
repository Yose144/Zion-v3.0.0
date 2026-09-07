# ZION V3 Mainnet Launch Sekvence

> **Aktualizováno:** 11. 6. 2026
> **Stav:** Genesis #0 úspěšně spuštěn

---

## Před-launchový checklist

### Konfigurace
- ✅ **Adresy fee split nakonfigurovány** (model 89/5/5/1)
  - Miner: 89%
  - Humanitární: 5%
  - Issobella: 5%
  - Pool fee: 1%

- ✅ **Genesis premine nakonfigurován** (14 outputů, 16,78B ZION)
  - 3× OASIS + Golden Egg (4,95B ZION)
  - 2× L5 Free World Projects (3,3B ZION, přesunuto ze Slotů 4 & 5)
  - 3× DAO Treasury (4,0B ZION, uzamčeno 1 rok)
  - 3× Infrastruktura (2,59B ZION)
  - 1× Humanitární (1,44B ZION)
  - 1× Bridge Seed Fund (0,5B ZION)

- ✅ **Genesis hash ověřen** na všech nodech
- ✅ **Všechny launch skripty aktualizovány** s novými adresami

### Infrastruktura
- ✅ **Edge server** (Veřejný VPS) — Primary / Genesis node, pool, všechny L2/L3 služby
- ✅ **Core backup** (Soukromý node) — Backup sync, minery, dashboard
- ✅ **P2P sync Core-Edge** funkční
- ✅ **Šifrovaná VPN mesh** stabilní
- ✅ **Firewall** nakonfigurován na Edge

---

## Launch sekvence

### Fáze 1: Finální verifikace (před launch)

1. Zastavit všechny služby
2. Vyčistit datové adresáře (pro čistý genesis start)
3. Ověřit konfigurace
4. Potvrdit fee split adresy
5. Ověřit konzistenci genesis hash

### Fáze 2: Genesis Launch

1. Spustit Edge primary node (genesis #0)
2. Ověřit akceptaci bloku
3. Spustit Edge pool server
4. Spustit Core backup node (sync z Edge)
5. Ověřit P2P sync

### Fáze 3: Post-launch verifikace

1. Potvrdit akceptaci genesis bloku na všech nodech
2. Ověřit, že pool přijímá připojení
3. Testovat konektivitu minerů
4. Potvrdit dashboard metriky
5. Ověřit funkčnost backup systému

---

## Operační poznámky

- **Procedura genesis resetu:** Vyžaduje koordinované zastavení všech nodů, smazání dat a sekvenční restart od geneze
- **Prevence cross-sync:** Dočasné odstranění peerů během izolovaného restartu
- **Windows nody:** Vyžadují `Stop-Process -Force` před smazáním DB (auto-restart chování)

---

*ZION V3 Mainnet Launch Sekvence • Veřejný přehled • aktualizováno 11. 6. 2026*
