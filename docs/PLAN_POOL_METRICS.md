# 🏊 PLÁN — Pool Metrics, Miner Search & Grafana Dashboard

> **Datum:** 11. února 2026  
> **Scope:** Navigace, Pool page rozšíření, per-miner Prometheus metriky, miner detail stránka

---

## 📋 Přehled úkolů

| # | Úkol | Vrstva | Priorita | Stav |
|---|------|--------|----------|------|
| 1 | Pool tlačítko v navigaci (icon button vedle Explorer) | Website | P0 | ⬜ |
| 2 | Prometheus per-miner labeled metriky v Rust poolu | Pool (Rust) | P0 | ⬜ |
| 3 | Miner search na Pool stránce | Website | P0 | ⬜ |
| 4 | Miner detail stránka (`/pool/miner/[address]`) | Website | P0 | ⬜ |
| 5 | Next.js API routes pro miner data | Website | P0 | ⬜ |
| 6 | Deploy na Helsinki | Infra | P1 | ⬜ |

---

## 1️⃣ Pool tlačítko v navigaci

**Soubor:** `website-v2.9/src/components/Navigation.tsx`

**Co:** Přidat Pool icon button vedle Network a Explorer na desktop navbar.

**Jak:**
- Přidat `HardHat` (nebo `Pickaxe`) z lucide-react
- Nový `<Link href="/pool">` s identickým stylem jako Explorer button
- Hover border: `hover:border-zion-purple/50`
- Tooltip: "Pool"
- Přidat Pool do mobilního menu grid (vedle Explorer a Dashboard)

**Vzor (existující Explorer button):**
```tsx
<Link
  href="/explorer"
  title="Explorer"
  className="p-2 rounded-xl border border-white/20 hover:border-zion-gold/50 bg-black/30 backdrop-blur transition-colors inline-flex items-center justify-center group relative"
>
  <Orbit className="w-4 h-4 text-zion-gold" />
  <span className="...tooltip...">Explorer</span>
</Link>
```

---

## 2️⃣ Prometheus per-miner labeled metriky (Rust)

**Soubory:** `pool/src/metrics/prometheus.rs`, `pool/src/shares/processor.rs`, `pool/src/stratum/connection_v2.rs`

### Aktuální stav
- 25 skalárních metrik (IntCounter + IntGauge), žádné labels
- Crate `prometheus` 0.14 podporuje `IntCounterVec`, `IntGaugeVec`, `HistogramVec`
- Per-miner data existují v Redis (hashrate, shares, balance)

### Nové metriky

| Metrika | Typ | Labels | Popis |
|---------|-----|--------|-------|
| `miner_hashrate` | GaugeVec | `address` | Aktuální hashrate minera |
| `miner_shares_total` | CounterVec | `address`, `status` (valid/invalid) | Shares per miner |
| `miner_blocks_found_total` | CounterVec | `address` | Bloky nalezené minerem |
| `miner_pending_balance` | GaugeVec | `address` | Nevyplacený balance |
| `miner_paid_total` | GaugeVec | `address` | Celkem vyplaceno |
| `stratum_connection_duration_seconds` | Histogram | — | Délka Stratum spojení |
| `share_processing_duration_seconds` | Histogram | — | Latence zpracování share |
| `miner_connections_active` | GaugeVec | `address` | Aktivní spojení per miner |

### Implementace

1. **`prometheus.rs`** — Registrace `IntGaugeVec`, `IntCounterVec` s labely
2. **`processor.rs`** — Při `accept_share()` inkrementovat `miner_shares_total{address, status}`
3. **`connection_v2.rs`** — Při connect/disconnect aktualizovat `miner_connections_active`
4. **Background task** — Každých 30s načíst hashrate z Redis, nastavit `miner_hashrate{address}`
5. **`/metrics`** endpoint již existuje — automaticky zobrazí nové metriky

### ⚠️ Cardinality limit
- Max 1000 unikátních miner adres (při 10k+ adresách by Prometheus měl vysokou kardinálitu)
- Implementovat TTL: odstraňovat label sety pro neaktivní minory (>24h bez share)

---

## 3️⃣ Miner search na Pool stránce

**Soubor:** `website-v2.9/src/components/PoolDashboard.tsx`

**Co:** Search bar v hero sekci pro vyhledání minera podle ZION adresy.

**Jak:**
- Input field s ikonou `Search` a placeholder "Enter your ZION address..."
- Submit → navigace na `/pool/miner/[address]`
- Validace: ZION adresa musí začínat `zion1` (bech32m)
- Design: glassmorphism input matching Explorer search bar style
- Error state: "Invalid ZION address" s červeným borderem

**Umístění:** Pod hero headery, před stats grid.

---

## 4️⃣ Miner detail stránka

**Nové soubory:**
- `website-v2.9/src/app/pool/miner/[address]/page.tsx` — Server component, SEO, metadata
- `website-v2.9/src/components/MinerDashboard.tsx` — Client component, vizualizace

### API data (existující Rust endpointy)
Pool server už má:
- `GET /miner/{address}/stats` → hashrate_1h, hashrate_24h, total_shares, valid_shares, invalid_shares, blocks_found, total_paid, pending_balance
- `GET /miner/{address}/payouts` → pending_balance, payouts list
- `GET /miner/{address}/blocks` → bloky nalezené minerem

### Sekce stránky

1. **Header** — Adresa (zkrácená + kopírování), status badge (Active/Inactive)
2. **Stats Grid** — 6 karet:
   - Hashrate (1h) + trend šipka
   - Hashrate (24h)
   - Valid shares
   - Invalid shares + efficiency %
   - Blocks nalezené
   - Pending balance (ZION)
3. **Hashrate graf** — 24h timeline (data z `/pool/history`)
   - Použít lightweight chart library (recharts nebo visx)
   - Fallback: SVG sparkline bez závislosti
4. **Share history** — tabulka posledních shares
5. **Bloky** — tabulka bloků nalezených minerem (height, hash, reward, čas)
6. **Payouts** — tabulka payoutů (amount, TX ID, čas)
7. **Worker breakdown** — pokud miner má více workerů

### Design
- Identický Explorer design language (bg-black/60, rounded-3xl, motion.section)
- Breadcrumb: Pool → Miner → `zion1abc...xyz`

---

## 5️⃣ Next.js API routes

**Nové soubory:**
- `website-v2.9/src/app/api/pool/miner/[address]/route.ts` — Agregace per-miner dat z obou serverů

**Logika:**
```
1. Fetch /miner/{address}/stats z Helsinki + Germany
2. Agregovat hashrate (sum), shares (sum), blocks (merge + dedup)
3. Vrátit combined JSON
4. ISR revalidate: 15s
```

---

## 6️⃣ Grafana (BUDOUCNOST — ne teď)

> Per roadmap je plnohodnotný Prometheus + Grafana stack plánován na **fázi 3 (srpen–září 2026)**.
> V této session přidáme per-miner labeled metriky do Prometheus endpointu,
> aby byl pool připravený na napojení Grafany.
> Samotný Grafana docker container a dashboardy budou v budoucí session.

**Pro tuto session:** Vytvoříme **web-based miner dashboard** jako náhradu Grafany —
vlastní grafy přímo v Next.js (recharts/SVG) místo externího Grafana serveru.

---

## 📐 Pořadí implementace

```
1. Navigation — Pool icon button (5 min)
2. Rust Pool — Per-miner Prometheus metriky (30 min)
3. Next.js API — /api/pool/miner/[address] (15 min)
4. Pool page — Miner search bar (15 min)
5. Miner detail — /pool/miner/[address] stránka (45 min)
6. Deploy website na Helsinki (10 min)
7. Deploy pool Rust na Helsinki (20 min, vyžaduje Rust build)
8. Git commit + push
```

**Celkový odhad:** ~2.5h

---

## ⚠️ Rizika

| Riziko | Mitigace |
|--------|----------|
| Prometheus cardinality explosion | TTL na neaktivní minory, max 1000 labels |
| Rust kompilace na ARM64 Helsinki (pomalá) | Build v screen session, ~15 min |
| Recharts bundle size | Alternativa: lightweight SVG sparkline bez závislosti |
| CORS pro miner API | Proxy přes Next.js API routes (ne přímý fetch z browseru) |

---

*Vytvořeno: 11. února 2026*
