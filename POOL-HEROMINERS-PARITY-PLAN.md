# Pool UI — HeroMiners parity plan

Goal: `pool.zionterranova.com` matches HeroMiners feature level for our
architecture (PPLNS unified-payout multi-coin pool). Reference surfaces:
herominers.com landing + per-coin pool pages (dashboard / blocks /
payments / miners / config / notifications).

## Legend

- ✅ done & deployed
- 🚧 in progress / ready to implement
- ⛔ blocked on operator input
- 🚫 consciously out of scope

## Page-by-page parity

### Home `/`
| HM feature | ours | status |
|---|---|---|
| Pool overview table (coin/algo/hr/miners) | coin cards w/ legs | ✅ |
| Global hashrate + miners strip | net-strip | ✅ |
| Per-coin luck/effort | LuckEffortCard | ✅ |

### Coin page `/coin/[id]`
| HM feature | ours | status |
|---|---|---|
| Pool hashrate chart (24h/7d) | AreaChart + RangeTabs | ✅ |
| Miners online chart | mini AreaChart | ✅ |
| Price chart | CG 7d / on-chain zion | ✅ |
| Calculator | CalcCard | ✅ |
| Mining config per miner | ConfigCards (TCP/TLS/SOLO) | ✅ |
| External links | CoinGecko + explorer/site | ✅ |
| Network hashrate | est. `pool_hr×100/luck_100` (zion) | ✅ /stats, 🚧 KPI tile on coin |
| Recent blocks + luck | table | ✅ |
| Recent payouts | table + explorer link | ✅ |
| **Top miners table** | `/public/v1/miners?coin=` exists, no UI | 🚧 |

### Blocks `/blocks`
| HM feature | ours | status |
|---|---|---|
| Blocks list w/ luck | ✅ | ✅ |
| Luck trend bars | 40-block strip | ✅ |
| Current effort | gauge | ✅ |
| **Avg effort KPI tile** | derivable `10000/mean(luck)` | 🚧 |

### Stats `/stats`
| HM feature | ours | status |
|---|---|---|
| Per-coin pool/network hashrate | pool + est net (`~`) | ✅ |
| Fee split, miners, workers | tiles | ✅ |
| Luck/effort strip | LuckEffortCard | ✅ |

### Miner dashboard `/miner/[coin]/[wallet]`
| HM feature | ours | status |
|---|---|---|
| Hashrate chart 24h/7d | server history + RangeTabs | ✅ |
| Workers table w/ hps bars, acc% | ✅ | ✅ |
| Per-worker chart | WorkerClient | ✅ |
| Earnings: est/day, per block, ETA | ✅ | ✅ |
| Payout progress bar | ✅ | ✅ |
| Payouts table | ✅ — **tx not linked to explorer** | 🚧 |
| **Alerts CTA** (TG/webhook) | link to `/account` | 🚧 |

### Global miners leaderboard `/miners`
| HM "Miners" top-nav page | `/public/v1/miners` endpoint exists | 🚧 new page |

### Payouts `/payouts`
| HM feature | ours | status |
|---|---|---|
| Payout list + tx explorer links | ✅ | ✅ |
| PPLNS window explainer | `/public/v1/pplns` + card | ✅ |

### Start `/start`, FAQ, status, api-docs
| HM feature | ours | status |
|---|---|---|
| Config generator | connectCmds + ConfigCards | ✅ |
| FAQ | page exists | ✅ |
| Uptime/status | `/status` | ✅ |
| API docs | `/api-docs` | ✅ |

### Notifications
| HM feature | ours | status |
|---|---|---|
| Worker-offline alerts | `/account` (webhook+TG chat-id) | ✅ |
| TG bot deep-link subscribe | needs bot token | ⛔ env |

## Backend gaps
- none blocking for the above (miners/blocks/history/pplns endpoints all exist)

## Out of scope (HM-only, deliberate)
- 🚫 24 languages (CS/EN)
- 🚫 PPS+ / exchange wallets / MinerBox / announcements blog / hardware db

## Blocked on operator
- ⛔ `VASTCTL_TG_BOT_TOKEN`, `VASTCTL_TG_CHAT_ID`, `ALERT_WEBHOOK`,
  `VASTCTL_POOL_API_KEY` — fleet TG/webhook fanout + TG bot subscribe UX
