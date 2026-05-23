# ZION Website v2.9 — Update & Unification Plan

> Vytvoreno: 2026-05-17
> Cil: Sjednotit design napric vsemi strankami, opravit duplicity v layoutech,
> doplnit metadata a vycistit page.tsx od nepotrebneho kodu.

---

## 0. Zakladni konvence (novy standard)

Nasledujici pravidla plati pro vsechny stranky v `src/app/`:

| Konvence | Hodnota | Poznamka |
|---|---|---|
| Root `<main>` | `<main className="zion-shell min-h-screen">` | Definovano v `src/app/layout.tsx` |
| Standardni `padding-top` | `pt-28` (112 px) | Offset pro fixed Navigation (~80-90 px) |
| Standardni `padding-bottom` | `pb-24` (96 px) | Konzistentni spodni mezera |
| Top-level wrapper | `<div className="relative z-10">` nebo `<section>` | NIKDY `<main>` (ten je v root layoutu) |
| Container | `zion-container` nebo `zion-container max-w-7xl` | Max sirka 80rem (1280 px) |
| Panel/karta | `zion-panel` nebo `zion-panel-soft` | Zakazane: `bg-zinc-900/80`, `bg-gray-800` |
| Nadpis s gradientem | `text-gradient` nebo `zion-section-title` | Zakazane: inline `bg-clip-text` mimo utilitu |
| Kicker badge | `zion-kicker` | Zakazane: ad-hoc `inline-flex rounded-full` |
| Primarni tlacitko | `zion-button-primary` | Zakazane: ad-hoc `bg-amber-500` |
| Sekundarni tlacitko | `zion-button-secondary` | Zakazane: ad-hoc `bg-zinc-700` |

**Dulezite:** `zion-shell` a `min-h-screen` uz jsou v root `<main>`. Stranky je
NEMaji opakovat na svem top-level elementu.

---

## 1. Faze 1 — Vytvorit segmentove layout.tsx (metadata + shell wrapper)

Segmenty, ktere NEMAJI vlastni `layout.tsx` a maji vicer stranek bez metadat:

### 1.1 `src/app/admin/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Admin · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining pool admin — algorithm routing, pool configuration, and revenue analytics.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/admin/layout.tsx` — VYTVORIT

### 1.2 `src/app/dashboard/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mission control dashboard — pool metrics, system health, NCL curriculum, DAO tree, and presale analytics.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/dashboard/layout.tsx` — VYTVORIT
- [ ] `src/app/dashboard/loading.tsx` — UPRAVIT: zmenit `pt-32` na `pt-28`

### 1.3 `src/app/defi/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `DeFi Hub · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION DeFi — swap, bridge, and manage wZION on Base. Real contracts, real liquidity.',
};

export default function DefiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/defi/layout.tsx` — VYTVORIT

### 1.4 `src/app/mining/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mining Guide · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining setup guides, node configuration, and miner best practices.',
};

export default function MiningLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/mining/layout.tsx` — VYTVORIT

### 1.5 `src/app/monitoring/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Monitoring · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live Prometheus + Grafana monitoring: chain height, pool metrics, active miners, system health.',
};

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/monitoring/layout.tsx` — VYTVORIT

### 1.6 `src/app/news/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `News · ZION ${SITE_RELEASE_LABEL}`,
  description: 'All ZION ecosystem news and updates.',
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/news/layout.tsx` — VYTVORIT

### 1.7 `src/app/pool/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mining Pool · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining pool dashboard — PPLNS rewards, real-time stats, and miner telemetry.',
};

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/pool/layout.tsx` — VYTVORIT

### 1.8 `src/app/terranova/layout.tsx`
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terra Nova · ZION',
  description: 'Terra Nova — Zlaty Kompas Nove Zeme. Webova ctecka se tremi verzemi: ORG, FINAL/Cloud a Gemini.',
};

export default function TerranovaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/terranova/layout.tsx` — VYTVORIT

### 1.9 `src/app/wallet/layout.tsx`
```tsx
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `L1 Wallet · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION L1 non-custodial wallet. Create, import, send, and manage ZION natively.',
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Soubory ke kontrole:**
- [ ] `src/app/wallet/layout.tsx` — VYTVORIT

### 1.10 `src/app/explorer/layout.tsx` — UPRAVA
Aktualni `explorer/layout.tsx` ma "Explorer | Explorer" v titulku — opravit:

```tsx
export const metadata: Metadata = {
  title: `Explorer · ZION ${SITE_RELEASE_LABEL}`,
  description: `Explore ZION blockchain blocks, transactions, addresses, and network statistics in real-time.`,
};
```

**Soubory ke kontrole:**
- [ ] `src/app/explorer/layout.tsx` — UPRAVIT title

---

## 2. Faze 2 — Root layout normalizace

### 2.1 `src/app/layout.tsx` — UPRAVA
Aktualni root layout ma:
```tsx
<main className="zion-shell min-h-screen">
```

Navigace je `fixed top-0`. Stranky musi mit padding-top, aby obsah nebyl pod nav.
Nejlepsi reseni: pridat `pt-28` primo do root `<main>` jako **default**, ktere stranky
mohou prebit na svem top-level elementu.

```tsx
<main className="zion-shell min-h-screen pt-28">
  {children}
</main>
```

**SOUBORY:**
- [ ] `src/app/layout.tsx` — pridat `pt-28` do `<main>`

**Duvod:** Pokud root `<main>` da `pt-28`, pak jednoduche stranky (jako `dashboard/page.tsx`
vracejici jen komponentu) automaticky maji spravny offset. Stranky, ktere chteji jiny
offset, prebiji to na svem top-level elementu (`!pt-0` nebo `className="pt-24"`).

---

## 3. Faze 3 — Page.tsx cleanup (odstranit duplicity)

### 3.1 Odstranit duplicitni `zion-shell min-h-screen`

**Seznam stranek, ktere MAJI `zion-shell` nebo `min-h-screen` a NEMAji byt:**

```
src/app/admin/algo-manager/page.tsx
src/app/admin/page.tsx
src/app/admin/pool-config/page.tsx
src/app/admin/revenue-v3/page.tsx
src/app/ai-native/page.tsx
src/app/api-reference/page.tsx
src/app/bridge/page.tsx
src/app/dao/page.tsx
src/app/dashboard/advanced-pool/page.tsx
src/app/dashboard/ch3/page.tsx
src/app/dashboard/dao-tree/page.tsx
src/app/dashboard/ncl/page.tsx
src/app/dashboard/pool-metrics/page.tsx
src/app/dashboard/system-metrics/page.tsx
src/app/defi/dao/page.tsx
src/app/defi/farming/page.tsx
src/app/defi/page.tsx
src/app/defi/staking/page.tsx
src/app/docs/page.tsx
src/app/download/page.tsx
src/app/ekam/deeksha/page.tsx
src/app/explorer/blocks/page.tsx
src/app/explorer/page.tsx
src/app/explorer/search/page.tsx
src/app/genesis/page.tsx
src/app/network/page.tsx
src/app/news/v3-internal-audit/page.tsx
src/app/roadmap-295/page.tsx
src/app/roadmap/page.tsx
src/app/terranova/dharma-temple/page.tsx
src/app/terranova/genesis/page.tsx
src/app/warp/page.tsx
```

**Postup pro kazdou stranku:**
1. Najit top-level element (nejvyssi JSX tag v return)
2. Odstranit `zion-shell` a `min-h-screen` z jeho className
3. Ponechat `pt-XX` pouze pokud stranka potrebuje jiny offset nez root `pt-28`
4. Ponekat `pb-24` a `overflow-x-hidden` pokud jsou potreba

**SOUBORY (vsechny vyse uvedene):**
- [ ] Odstranit `zion-shell` a `min-h-screen` z top-level elementu

### 3.2 Odstranit duplicitni `<main>` tagy

Stranky, ktere pouzivaji `<main>` navic k root `<main>`:

- [ ] `src/app/defi/page.tsx` — zmenit `<main>` na `<div>`
- [ ] `src/app/docs/page.tsx` — zmenit `<main>` na `<div>`
- [ ] `src/app/ekam/deeksha/page.tsx` — zmenit `<main>` na `<div>`
- [ ] `src/app/genesis/page.tsx` — zmenit `<main>` na `<div>`
- [ ] `src/app/news/v3-internal-audit/page.tsx` — zmenit `<main>` na `<div>`

### 3.3 Odstranit duplicitni glow pozadi (optional)

Stranky jako `defi/page.tsx` a `explorer/page.tsx` maji vlastni `pointer-events-none`
absolutni glow divy. Tyto se lisi stranka od stranky a zpusobuji nejednotny vizual.

**Rozhodnuti:** Glow pozadi patri do `ClientBackgrounds` komponenty (uz v root layoutu).
Pokud stranka potrebuje specificke pozadi, muze si ho ponechat. Ale standardni glow
by mel byt v `ClientBackgrounds`, ne v kazde strance.

- [ ] `src/app/defi/page.tsx` — odstranit vlastni glow divy (nepotrebne, root ma `ClientBackgrounds`)
- [ ] `src/app/explorer/page.tsx` — ponechat glow divy (explorer ma specificky design)

---

## 4. Faze 4 — Design system sjednoceni

### 4.1 Nahradit ad-hoc barvy ZION systemem

**Wallet page (`src/app/wallet/page.tsx`) — KOMPLETNI REDESIGN:**

| Soucasny kod | Nahradit za |
|---|---|
| `bg-zinc-900/80 border border-zinc-700 rounded-xl` | `zion-panel` |
| `bg-zinc-950` (input pozadi) | `bg-black/60 border border-white/10` |
| `text-amber-400` | `text-zion-gold` |
| `text-emerald-400` | `text-zion-cyan` |
| `focus:border-amber-500` | `focus:border-zion-cyan` |
| `bg-amber-500 hover:bg-amber-600` (tlacitko) | `zion-button-primary` |
| `bg-emerald-600 hover:bg-emerald-700` (tlacitko) | `zion-button-primary` |
| `bg-zinc-700 hover:bg-zinc-600` (tlacitko) | `zion-button-secondary` |
| `bg-red-900/30 border border-red-500/30` (error) | standardni alert styl |
| `max-w-4xl mx-auto px-4 py-8` | `zion-container max-w-4xl pt-28 pb-24` |
| `rounded-xl` na inputech | `rounded-2xl` (konvence ZION) |

**Postup:**
1. Upravit wallet/page.tsx aby pouzival ZION design system
2. Zmenit vsechny ad-hoc tailwind tridy na zion-* utility tridy

**SOUBORY:**
- [ ] `src/app/wallet/page.tsx` — KOMPLETNI REDESIGN

### 4.2 Sjednotit padding-top na `pt-28`

Stranky s JINYM padding-top nez pt-28 (po pridani pt-28 do root layoutu):

| Stranka | Aktualni pt- | Akce |
|---|---|---|
| `ai-native/page.tsx` | pt-8 | UPRAVIT -> pt-28 |
| `ekam/deeksha/page.tsx` | pt-12 | UPRAVIT -> pt-28 |
| `dashboard/advanced-pool` | pt-20 | UPRAVIT -> pt-28 |
| `dashboard/dao-tree` | pt-24 | UPRAVIT -> pt-28 |
| `dashboard/pool-metrics` | pt-20 | UPRAVIT -> pt-28 |
| `dashboard/system-metrics` | pt-20 | UPRAVIT -> pt-28 |
| `defi/page.tsx` | pt-24 | UPRAVIT -> pt-28 |
| `defi/dao` | pt-28 | OK (pokud root da pt-28, odstranit) |
| `defi/farming` | pt-28 | OK (pokud root da pt-28, odstranit) |
| `defi/staking` | pt-28 | OK (pokud root da pt-28, odstranit) |
| `download/page.tsx` | pt-28 | OK |
| `explorer/page.tsx` | pt-28 | OK |
| `explorer/search` | pt-28 | OK |
| `network/page.tsx` | pt-28 | OK |
| `news/v3-internal-audit` | pt-28 | OK |
| `roadmap-295/page.tsx` | pt-8 | UPRAVIT -> pt-28 |
| `terranova/dharma-temple` | pt-24 | UPRAVIT -> pt-28 |
| `terranova/genesis` | pt-24 | UPRAVIT -> pt-28 |
| `admin/revenue-v3` | pt-28 | OK |
| `admin/*` (ostatni) | pt-32 | UPRAVIT -> pt-28 |
| `api-reference/page.tsx` | pt-32 | UPRAVIT -> pt-28 |
| `bridge/page.tsx` | pt-32 | UPRAVIT -> pt-28 |
| `dao/page.tsx` | pt-32 | UPRAVIT -> pt-28 |
| `docs/page.tsx` | pt-2 | UPRAVIT -> pt-28 |
| `roadmap/page.tsx` | pt-32 | UPRAVIT -> pt-28 |
| `warp/page.tsx` | pt-32 | UPRAVIT -> pt-28 |

**Poznamka:** Pokud pridame `pt-28` do root `<main>`, pak stranky s `pt-28` mohou
odstranit pt- z vlastniho elementu (bude je prebirat z root). Stranky s jinym pt-
musi prebit root hodnotu.

Ale! Stranky jako `explorer/page.tsx` maji top-level div s `pt-28 md:pt-32`. Pokud
root da `pt-28`, pak explorer muze mit jen `md:pt-32` (pro vetsi obrazovky).

### 4.3 Nahradit ad-hoc glass karty

Stranky, ktere pouzivaji rucni glass styl misto `zion-panel`:

- [ ] `src/app/roadmap-295/page.tsx` — najit vsechny `bg-black/60 backdrop-blur-xl rounded-2xl p-8 border border-...` a nahradit `zion-panel`
- [ ] `src/app/genesis/page.tsx` — najit `bg-black/60 backdrop-blur-xl` a nahradit

---

## 5. Faze 5 — SEO metadata doplneni

### 5.1 Serverove page.tsx bez metadata

Tyto stranky jsou serverove (nejsou 'use client') a nemaji metadata:

- [ ] `src/app/explorer/address/page.tsx` — pridat metadata
- [ ] `src/app/explorer/block/page.tsx` — pridat metadata
- [ ] `src/app/explorer/blocks/page.tsx` — pridat metadata
- [ ] `src/app/explorer/mempool/page.tsx` — pridat metadata
- [ ] `src/app/explorer/network-stats/page.tsx` — pridat metadata
- [ ] `src/app/explorer/richlist/page.tsx` — pridat metadata
- [ ] `src/app/explorer/supply/page.tsx` — pridat metadata
- [ ] `src/app/explorer/transactions/page.tsx` — pridat metadata
- [ ] `src/app/explorer/tx/page.tsx` — pridat metadata
- [ ] `src/app/news/v3-internal-audit/page.tsx` — pridat metadata
- [ ] `src/app/dashboard/ch3/page.tsx` — pridat metadata
- [ ] `src/app/dashboard/ncl/page.tsx` — pridat metadata
- [ ] `src/app/dashboard/presale/page.tsx` — pridat metadata
- [ ] `src/app/pool/miner/[address]/page.tsx` — pridat metadata (generovat dynamicky)

### 5.2 Client page.tsx — metadata pres layout

Pro 'use client' stranky metadata nefunguje v page.tsx. Reseni: metadata uz budou
v segmentovych `layout.tsx` (vytvoreno ve Fazi 1).

Nasledujici stranky uz budou mit metadata pres rodicovsky layout:
- `admin/*` (pres admin/layout.tsx)
- `defi/*` (pres defi/layout.tsx)
- `mining/*` (pres mining/layout.tsx)
- `terranova/*` (pres terranova/layout.tsx)
- `wallet/page.tsx` (pres wallet/layout.tsx)

---

## 6. Faze 6 — Loading.tsx normalizace

- [ ] `src/app/dashboard/loading.tsx` — upravit `pt-32` na `pt-28`
- [ ] Pripadne vytvorit dalsi `loading.tsx` pro dalsi segmenty, pokud to prinese hodnotu

---

## 7. Faze 7 — Finalni kontrola

### 7.1 ESLint
```bash
npm --prefix APP\&WEB/website-v2.9 run lint
```

### 7.2 Build
```bash
cd APP\&WEB/website-v2.9 && npm run build
```

### 7.3 Manualni kontrola
- [ ] Homepage (`/`) — layout OK?
- [ ] Explorer (`/explorer`) — padding OK?
- [ ] Wallet (`/wallet`) — design system OK?
- [ ] DeFi (`/defi`) — duplicitni main odstranen?
- [ ] Roadmap (`/roadmap`) — padding sjednocen?
- [ ] Dashboard (`/dashboard`) — loading.tsx OK?

### 7.4 Lighthouse / SEO
- [ ] Kazda stranka ma unikatni `<title>`
- [ ] Kazda stranka ma `<meta name="description">`
- [ ] Zadna stranka nema duplicitni `<main>`

---

## 8. Seznam vsech souboru k uprave (abecedne)

| Soubor | Zmena | Faze |
|---|---|---|
| `src/app/admin/layout.tsx` | VYTVORIT | 1 |
| `src/app/admin/algo-manager/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/admin/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/admin/pool-config/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/admin/revenue-v3/page.tsx` | Odstranit zion-shell, pt-28 ponechat | 3 |
| `src/app/ai-native/page.tsx` | Odstranit zion-shell, pt-8->pt-28 | 3, 4 |
| `src/app/api-reference/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/bridge/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/dao/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/dashboard/layout.tsx` | VYTVORIT | 1 |
| `src/app/dashboard/loading.tsx` | pt-32->pt-28 | 6 |
| `src/app/dashboard/advanced-pool/page.tsx` | Odstranit zion-shell, pt-20->pt-28 | 3, 4 |
| `src/app/dashboard/ch3/page.tsx` | Odstranit zion-shell, pridat metadata | 3, 5 |
| `src/app/dashboard/dao-tree/page.tsx` | Odstranit zion-shell, pt-24->pt-28 | 3, 4 |
| `src/app/dashboard/ncl/page.tsx` | Odstranit zion-shell, pridat metadata | 3, 5 |
| `src/app/dashboard/pool-metrics/page.tsx` | Odstranit zion-shell, pt-20->pt-28 | 3, 4 |
| `src/app/dashboard/presale/page.tsx` | Odstranit zion-shell, pridat metadata | 3, 5 |
| `src/app/dashboard/system-metrics/page.tsx` | Odstranit zion-shell, pt-20->pt-28 | 3, 4 |
| `src/app/defi/layout.tsx` | VYTVORIT | 1 |
| `src/app/defi/page.tsx` | Odstranit `<main>`, zion-shell, glow, pt-24->pt-28 | 3, 4 |
| `src/app/defi/dao/page.tsx` | Odstranit zion-shell, pt-28 ponechat | 3 |
| `src/app/defi/farming/page.tsx` | Odstranit zion-shell, pt-28 ponechat | 3 |
| `src/app/defi/staking/page.tsx` | Odstranit zion-shell, pt-28 ponechat | 3 |
| `src/app/docs/page.tsx` | Odstranit `<main>`, zion-shell, pt-2->pt-28 | 3, 4 |
| `src/app/download/page.tsx` | Odstranit zion-shell, pt-28 ponechat | 3 |
| `src/app/ekam/deeksha/page.tsx` | Odstranit `<main>`, zion-shell, pt-12->pt-28 | 3, 4 |
| `src/app/explorer/layout.tsx` | Upravit title | 1 |
| `src/app/explorer/page.tsx` | Odstranit zion-shell, ponechat pt-28 | 3 |
| `src/app/explorer/address/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/block/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/blocks/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/mempool/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/network-stats/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/richlist/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/supply/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/transactions/page.tsx` | Pridat metadata | 5 |
| `src/app/explorer/tx/page.tsx` | Pridat metadata | 5 |
| `src/app/genesis/page.tsx` | Odstranit `<main>`, zion-shell, pt-28 ponechat | 3 |
| `src/app/layout.tsx` | Pridat `pt-28` do `<main>` | 2 |
| `src/app/mining/layout.tsx` | VYTVORIT | 1 |
| `src/app/monitoring/layout.tsx` | VYTVORIT | 1 |
| `src/app/news/layout.tsx` | VYTVORIT | 1 |
| `src/app/news/v3-internal-audit/page.tsx` | Odstranit `<main>`, zion-shell, pridat metadata | 3, 5 |
| `src/app/pool/layout.tsx` | VYTVORIT | 1 |
| `src/app/roadmap-295/page.tsx` | Odstranit zion-shell, pt-8->pt-28 | 3, 4 |
| `src/app/roadmap/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |
| `src/app/terranova/layout.tsx` | VYTVORIT | 1 |
| `src/app/terranova/dharma-temple/page.tsx` | Odstranit zion-shell, pt-24->pt-28 | 3, 4 |
| `src/app/terranova/genesis/page.tsx` | Odstranit zion-shell, pt-24->pt-28 | 3, 4 |
| `src/app/wallet/layout.tsx` | VYTVORIT | 1 |
| `src/app/wallet/page.tsx` | KOMPLETNI REDESIGN na ZION design system | 5 |
| `src/app/warp/page.tsx` | Odstranit zion-shell, pt-32->pt-28 | 3, 4 |

---

## 9. Rizika a mitigace

| Riziko | Mitigace |
|---|---|
| Pridani `pt-28` do root `<main>` rozbije homepage | Homepage nema vlastni pt- a Hero komponenta ma svoje pozicovani. Otestovat. |
| Odstraneni `zion-shell` z page.tsx odhali zavislost | `zion-shell` dava `position: relative; isolation: isolate`. Root `<main>` to uz ma. Pokud nejaka stranka spoleha na `position: relative` sveho top-level divu, pridat `relative`. |
| Wallet redesign rozbije funkcionalitu | Menit pouze CSS tridy, ne logiku (state, handlery). |
| Segment layout prebije existujici page metadata | Page metadata ma vzdy prioritu nad layout metadata. Problem nenastane. |
| 'use client' stranky nemuzou mit metadata | Reseno pres segmentove layouty. |
