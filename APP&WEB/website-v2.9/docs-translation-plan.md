# Kompletni E2E Preklad Webovych Stranek CZ/EN — Plan

> **Cil:** Vsechny stranky webu www.zionterranova.com maji plne funkcni CZ/EN preklad.
> **Pristup:** Faze po fazi, stranka po strance. Vzdy EN original + CS preklad.
> **Zpusob:** `translations.ts` klíce + `useLang()` hook + `tx()` funkce.

---

## Faze 0: Infrastruktura prekladu (priprava)

- [ ] Zkontrolovat a doplnit `translations.ts` o chybejici globalni klíce (navigace, footer, spolecneUI)
- [ ] Udelat audit: ktere komponenty zadne preklady nemaji vubec

---

## Faze 1: Core / Homepage + Shared UI

Stranky:
- [ ] `/` — Homepage (page.tsx + Hero + Features + Footer + Navigation)
- [ ] `/components/Navigation.tsx` — Dropdowny, labely
- [ ] `/components/Footer.tsx` — Odkazy, copyright
- [ ] `/components/Hero.tsx` — Badge, tagline, tlacitka
- [ ] `/components/Features.tsx` — 6-Layer karty
- [ ] `/components/MainnetCountdown.tsx` — Countdown texty
- [ ] `/components/LiveDashboard.tsx` — Panelove texty
- [ ] `/components/RoadmapPulse.tsx` — Timeline texty

---

## Faze 2: Hlavni sekce (verejne)

Stranky:
- [ ] `/mining` — Mining & Node (page.tsx)
- [ ] `/mining/guides` — Mining pruvodce
- [ ] `/mining/node-setup` — Node setup navod
- [ ] `/pool` — Pool prehled (page.tsx)
- [ ] `/pool/miner/[address]` — Miner detail
- [ ] `/explorer` — Explorer homepage
- [ ] `/network` — Network status
- [ ] `/roadmap` — Roadmap v3
- [ ] `/download` — Stazeni binarek
- [ ] `/docs` — Dokumentace (jiz hotovo)

---

## Faze 3: DeFi / DAO / Bridge / WARP

Stranky:
- [ ] `/defi` — DeFi Hub
- [ ] `/defi/dao` — DAO staking
- [ ] `/defi/farming` — Yield farming
- [ ] `/defi/staking` — Staking
- [ ] `/dao` — DAO governance
- [ ] `/bridge` — Bridge
- [ ] `/warp` — WARP bridge

---

## Faze 4: L Vrstvy (Layers)

Stranky:
- [ ] `/l3-hiran` — L3 Hiran / AI
- [ ] `/l4-oasis` — L4 Oasis
- [ ] `/l5-free-world` — L5 Free World
- [ ] `/l6-issobella` — L6 Issobella
- [ ] `/ai-native` — AI Native

---

## Faze 5: Filozofie + Obsah

Stranky:
- [ ] `/philosophy` — Filozofie projektu
- [ ] `/genesis` — Genesis Book
- [ ] `/kompas` — Zlaty Kompas
- [ ] `/resonance` — Rezonance
- [ ] `/ekam` — Ekam
- [ ] `/ekam/deeksha` — Ekam Deeksha

---

## Faze 6: Terranova + Knihy

Stranky:
- [ ] `/terranova` — TerraNova book reader
- [ ] `/terranova/genesis` — Genesis chapter
- [ ] `/terranova/dharma-temple` — Dharma Temple
- [ ] `/terranova/te-piko-ora` — Te Piko Ora
- [ ] `/terranova/geography/*` — Africa, Americas, Asia, Europe, Oceania

---

## Faze 7: Admin / Dashboard / Interni

Stranky:
- [ ] `/dashboard` — Dashboard hlavni
- [ ] `/dashboard/advanced-pool` — Advanced pool
- [ ] `/dashboard/guardian` — Guardian
- [ ] `/dashboard/mission-control` — Mission Control
- [ ] `/dashboard/pool-metrics` — Pool metrics
- [ ] `/dashboard/system-metrics` — System metrics
- [ ] `/admin` — Admin panel
- [ ] `/admin/algo-manager` — Algo manager
- [ ] `/admin/pool-config` — Pool config
- [ ] `/admin/revenue-v3` — Revenue v3

---

## Faze 8: Explorer podstranky

Stranky:
- [ ] `/explorer/address` — Address detail
- [ ] `/explorer/block` — Block detail
- [ ] `/explorer/blocks` — Blocks list
- [ ] `/explorer/bridge` — Bridge explorer
- [ ] `/explorer/consensus` — Consensus
- [ ] `/explorer/fee-estimator` — Fee estimator
- [ ] `/explorer/mempool` — Mempool
- [ ] `/explorer/miners` — Miners leaderboard
- [ ] `/explorer/network-stats` — Network stats
- [ ] `/explorer/richlist` — Rich list
- [ ] `/explorer/search` — Search
- [ ] `/explorer/supply` — Supply
- [ ] `/explorer/transactions` — Transactions
- [ ] `/explorer/tx` — TX detail

---

## Faze 9: News + Ostatni

Stranky:
- [ ] `/news` — News feed
- [ ] `/news/v3-internal-audit` — Audit news
- [ ] `/benchmarks` — Benchmarks
- [ ] `/miner-stats` — Miner stats
- [ ] `/monitoring` — Monitoring
- [ ] `/node-setup` — Node setup
- [ ] `/wallet` — Wallet
- [ ] `/api-reference` — API reference
- [ ] `/wiki` — Wiki

---

## Faze 10: Dokonceni

- [ ] Kontrola consistency vsech prekladu (CS = EN obsah)
- [ ] Build — 0 chyb
- [ ] Commit + push
- [ ] Deploy na Edge
- [ ] Finalni overeni stranka po strance

---

*Plan vytvoren 11. 6. 2026 — Devin pro ZION web*
