"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  ExternalLink,
} from "lucide-react";

const ApiDocsCopy = {
  parameters: { cs: `Parametry`, en: `Parameters` },
  description: { cs: `Popis`, en: `Description` },
  exampleRequest: { cs: `Priklad pozadavku`, en: `Example Request` },
  exampleResponse: { cs: `Priklad odpovedi`, en: `Example Response` },
  tryIt: { cs: `Vyzkouset`, en: `Try it` },
  apiDocs: { cs: `API dokumentace`, en: `API Docs` },
  zionBlockchainApi: { cs: `ZION Blockchain API`, en: `ZION Blockchain API` },
  jsonEndpointsForIntegrationAnd: { cs: `JSON endpointy pro integraci a monitoring`, en: `JSON endpoints for integration and monitoring` },
  baseUrl: { cs: `Base URL`, en: `Base URL` },
  copy: { cs: `Kopirovat`, en: `Copy` },
  rateLimiting: { cs: `Rate Limiting:`, en: `Rate Limiting:` },
  rateLimitValue: { cs: `120 pozadavku na IP za 60s sliding window. Prekroceni vraci 429 s Retry-After.`, en: `120 requests per IP per 60s sliding window. 429 with Retry-After when exceeded.` },
  zionTerranovaV306ApiDocumentat: { cs: `ZION TerraNova v3.2.0 · API dokumentace · Vsechny endpointy vraci JSON`, en: `ZION TerraNova v3.2.0 · API Documentation · All endpoints return JSON` },
};

/* ── types ───────────────────────────────────────────────────── */

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  params: Param[];
  exampleResponse: string;
  category: string;
}

/* ── endpoint data ───────────────────────────────────────────── */

const BASE_URL = "https://app.zionterranova.com/api/blockchain";

const ENDPOINTS: Endpoint[] = [
  /* ── Blockchain ── */
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/stats",
    title: "Network Statistics",
    description: "Comprehensive network statistics from daemon RPC + pool API: height, hashrate, difficulty, supply, peer count, and database size.",
    params: [],
    exampleResponse: `{
  "height": 18234,
  "hashrate": 1250.5,
  "difficulty": 8421,
  "target": 60,
  "circulating_supply": 16280000,
  "max_supply": 144000000000,
  "peer_count": 12,
  "database_size": 104857600,
  "status": "ok"
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/blocks",
    title: "Block List",
    description: "Fetches block headers directly from daemon RPC with pagination. Newest blocks first.",
    params: [
      { name: "limit", type: "integer", required: false, description: "Number of blocks to return (max 100).", default: "20" },
      { name: "offset", type: "integer", required: false, description: "Number of blocks to skip from the tip.", default: "0" },
    ],
    exampleResponse: `[
  {
    "height": 18234,
    "hash": "abc123...",
    "prev_hash": "def456...",
    "timestamp": 1750000000,
    "transactions": 3,
    "reward": 5400.067,
    "difficulty": 8421,
    "block_size": 1024,
    "status": "confirmed"
  }
]`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/block",
    title: "Block Detail",
    description: "Fetches full block details including coinbase and all transactions. Lookup by height or hash.",
    params: [
      { name: "height", type: "integer", required: false, description: "Block height (or use hash). Alias: id." },
      { name: "hash", type: "string", required: false, description: "Block hash to look up." },
    ],
    exampleResponse: `{
  "height": 18234,
  "hash": "abc123...",
  "timestamp": 1750000000,
  "reward": 5400.067,
  "difficulty": 8421,
  "miner": "zion1...",
  "transactions": [ { "tx_hash": "...", "type": "coinbase", "amount": 5400.067 } ]
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/transactions",
    title: "Transaction List / Detail",
    description: "Recent transactions from blockchain blocks. Pass tx_hash (alias: hash) for a single transaction lookup, or address for address-specific history.",
    params: [
      { name: "limit", type: "integer", required: false, description: "Number of transactions (max 100).", default: "20" },
      { name: "tx_hash", type: "string", required: false, description: "Transaction hash for single-TX lookup. Alias: hash." },
      { name: "address", type: "string", required: false, description: "Filter transactions by address." },
    ],
    exampleResponse: `{
  "tx_hash": "abc123...",
  "block_height": 18234,
  "from": "zion1...",
  "to": "zion1...",
  "amount": 100.5,
  "fee": 0.001,
  "nonce": 5,
  "transaction_model": "hybrid"
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/address",
    title: "Address Info",
    description: "Returns address info combining pool API (mining stats) and blockchain data: balance, UTXOs, mining stats, and recent payouts.",
    params: [
      { name: "addr", type: "string", required: true, description: "ZION address (zion1... or ZION...). Alias: address." },
    ],
    exampleResponse: `{
  "address": "zion1...",
  "balance": { "total": 1234.5, "utxo_count": 8, "pool_pending": 0.5 },
  "total_received": 5000,
  "is_miner": true,
  "mining_stats": { "blocks_found": 3, "hashrate_formatted": "1.2 KH/s" },
  "transactions": [ { "tx_hash": "...", "type": "payout", "amount": 100 } ]
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/mempool",
    title: "Mempool Transactions",
    description: "Pending transactions from the mempool with fee statistics. Sorted newest first.",
    params: [],
    exampleResponse: `{
  "count": 5,
  "pool_size_bytes": 2048,
  "total_fees": 0.025,
  "fee_stats": { "min": 0.001, "max": 0.01, "avg": 0.005 },
  "transactions": [ { "tx_hash": "...", "fee": 0.001, "age_seconds": 12 } ]
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/richlist",
    title: "Rich List",
    description: "Top ZION holders by balance — premine allocations, mining rewards, and network economics.",
    params: [
      { name: "limit", type: "integer", required: false, description: "Number of entries (max 500).", default: "100" },
    ],
    exampleResponse: `[
  { "rank": 1, "address": "zion1oasis", "balance": 5000000, "type": "premine", "percentage": 3.47 }
]`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/search",
    title: "Unified Search",
    description: "Resolves a query across blocks (by height/hash), transactions (by hash), and addresses. Returns all matching results for disambiguation.",
    params: [
      { name: "q", type: "string", required: true, description: "Search query (height, hash, or address)." },
    ],
    exampleResponse: `{
  "query": "18234",
  "results": [
    { "type": "block", "href": "/explorer/block?id=18234", "title": "Block #18,234", "meta": "Hash: abc123..." }
  ]
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/charts",
    title: "Historical Chart Data",
    description: "Historical data for charts: difficulty, block times, hashrate, emission, block size, and tx count over a time range.",
    params: [
      { name: "type", type: "string", required: false, description: "Chart type: difficulty | blocktime | hashrate | emission | blocksize | txcount.", default: "difficulty" },
      { name: "range", type: "string", required: false, description: "Time range: 1h | 6h | 24h | 7d | 30d | all.", default: "24h" },
      { name: "resolution", type: "integer", required: false, description: "Sample every Nth block (0 = auto)." },
    ],
    exampleResponse: `{
  "labels": ["2026-06-01T00:00:00Z", "2026-06-01T01:00:00Z"],
  "values": [8421, 8450]
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/emission",
    title: "Emission & Supply",
    description: "Emission data: total mined, fees, supply schedule. Decade Decay: 5,400 → 724 ZION/block, 144B max supply.",
    params: [],
    exampleResponse: `{
  "total_emission": 16280000,
  "circulating_supply": 16280000,
  "max_supply": 144000000000,
  "emission_pct": 0.0113,
  "base_reward_per_block": 5400.067
}`,
  },
  {
    category: "Blockchain",
    method: "GET",
    path: "/api/blockchain/peers",
    title: "Peer Connections",
    description: "Connected peers from the daemon via getPeerList RPC. Connected peers first, then by height desc.",
    params: [],
    exampleResponse: `{
  "count": 12,
  "connected_peers": 8,
  "chain_height": 18234,
  "peers": [ { "host": "1.2.3.4", "port": 8333, "height": 18234, "incoming": false, "connected": true } ]
}`,
  },

  /* ── Pool ── */
  {
    category: "Pool",
    method: "GET",
    path: "/api/pool/stats",
    title: "Pool Statistics",
    description: "Mining pool statistics: hashrate, active sessions, PPLNS round info, and Telemetry-derived metrics.",
    params: [],
    exampleResponse: `{
  "pool_hashrate": 1250.5,
  "active_miners": 8,
  "round_shares": 12500,
  "last_block_found": 1750000000,
  "fee_pct": 5
}`,
  },

  /* ── DeFi ── */
  {
    category: "DeFi",
    method: "GET",
    path: "/api/defi/price",
    title: "ZION Price",
    description: "ZION price feed from Uni V3 wZION/USDT pool on Base. Returns implied wZION price in USDT and approximate USD. Falls back to seed price ($0.0002) when pool uninitialised.",
    params: [],
    exampleResponse: `{
  "price_usd": 0.0002,
  "price_eth": 0.000000120773,
  "eth_usd": 1656,
  "source": "univ3"
}`,
  },
  {
    category: "DeFi",
    method: "GET",
    path: "/api/defi/status",
    title: "DeFi Status",
    description: "On-chain DeFi status: wZION total supply, staking totals, farm rewards, governance proposal count, and bridge validator config.",
    params: [],
    exampleResponse: `{
  "wzion_supply": 1000000,
  "total_staked": 250000,
  "annual_rate_bps": 500,
  "proposal_count": 3,
  "bridge_threshold": 3,
  "bridge_validators": 5
}`,
  },

  /* ── Bridge ── */
  {
    category: "Bridge",
    method: "GET",
    path: "/api/bridge/status",
    title: "Bridge Status",
    description: "L1↔Base bridge relay status parsed from Telemetry metrics. Lock/mint/burn/unlock counters and validator health.",
    params: [],
    exampleResponse: `{
  "online": true,
  "locks_total": 42,
  "mints_total": 40,
  "burns_total": 2,
  "unlocks_total": 2,
  "validators_online": 3
}`,
  },

  /* ── Network ── */
  {
    category: "Network",
    method: "GET",
    path: "/api/network",
    title: "Network Overview",
    description: "Real-time status of the ZION public host topology. Per-node height, peers, hashrate, miners, and latency.",
    params: [],
    exampleResponse: `{
  "timestamp": "2026-06-27T12:00:00Z",
  "nodes": [ { "id": "edge-1", "host": "rpc.zionterranova.com", "online": true, "height": 18234, "peers": 12 } ],
  "summary": { "total": 3, "online": 3 }
}`,
  },

  /* ── System ── */
  {
    category: "System",
    method: "GET",
    path: "/api/health",
    title: "Health Check",
    description: "Dependency health check for the website: RPC daemon and mining pool. Returns healthy/degraded/offline status.",
    params: [],
    exampleResponse: `{
  "status": "healthy",
  "rpc": { "healthy": true, "meta": { "height": 18234 } },
  "mining_pool": { "healthy": true }
}`,
  },

  /* ── Listing ── */
  {
    category: "Listing",
    method: "GET",
    path: "/api/listing/coingecko",
    title: "CoinGecko Listing Feed",
    description: "CoinGecko-ready project metadata, live DEX price, market cap, volume, supply, and on-chain telemetry.",
    params: [],
    exampleResponse: `{
  "id": "zion-terranova",
  "symbol": "zion",
  "name": "ZION TerraNova",
  "market_data": {
    "current_price": { "usd": 0.0002 },
    "market_cap": { "usd": 3256.78 },
    "fully_diluted_valuation": { "usd": 28800000 },
    "total_volume": { "usd": 1250.5 },
    "price_change_24h": 0,
    "price_change_percentage_24h": 0,
    "circulating_supply": 16280000,
    "total_supply": 144000000000,
    "max_supply": 144000000000
  },
  "listing_ready": true,
  "price_source": "dexscreener"
}`,
  },
  {
    category: "Listing",
    method: "GET",
    path: "/api/listing/coinmarketcap",
    title: "CoinMarketCap Listing Feed",
    description: "CoinMarketCap-style payload with live USD quote, volume, market cap, supply, and on-chain snapshot.",
    params: [],
    exampleResponse: `{
  "data": {
    "name": "ZION TerraNova",
    "symbol": "ZION",
    "circulating_supply": 16280000,
    "total_supply": 144000000000,
    "max_supply": 144000000000,
    "quote": {
      "USD": {
        "price": 0.0002,
        "volume_24h": 1250.5,
        "percent_change_24h": 0,
        "market_cap": 3256.78,
        "fully_diluted_market_cap": 28800000
      }
    },
    "price_source": "dexscreener"
  }
}`,
  },
  {
    category: "Listing",
    method: "GET",
    path: "/api/cex/listings",
    title: "CEX / DEX Listings",
    description: "Planned and live CEX listings with a live DEX market snapshot from canonical wZION Uniswap V3 pools on Base.",
    params: [],
    exampleResponse: `{
  "ok": true,
  "cex": {
    "listings": [...],
    "summary": { "total_exchanges": 6, "listed": 0, "planned": 6, "total_pairs": 12 }
  },
  "dex": {
    "source": "dexscreener",
    "pairs": 3,
    "best_price_usd": 0.0002,
    "total_volume_24h": 1250.5,
    "total_liquidity_usd": 8000.25,
    "pairs_detail": [...]
  }
}`,
  },
];

const CATEGORIES = ["Blockchain", "Pool", "DeFi", "Bridge", "Network", "System", "Listing"];

/* ── helpers ─────────────────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-[11px] text-white/60 hover:text-white/90 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-zion-cyan" /> : <Copy className="w-3.5 h-3.5" />}
      {ok ? (label ? "Copied!" : "") : label || "Copy"}
    </button>
  );
}

/** Render a path with path/query params highlighted in purple. */
function PathDisplay({ path }: { path: string }) {
  // highlight ?param=value and ;param segments
  const parts = path.split(/(\?[^/]+|&[^/]+)/g).filter(Boolean);
  return (
    <code className="text-[13px] font-mono break-all">
      {parts.map((p, i) => {
        const isParam = p.startsWith("?") || p.startsWith("&");
        return (
          <span key={i} className={isParam ? "text-zion-purple" : "text-white/80"}>
            {p}
          </span>
        );
      })}
    </code>
  );
}

function EndpointAccordion({ ep, cs }: { ep: Endpoint; cs: boolean }) {
  const [open, setOpen] = useState(false);
  const curl = `curl -s "${BASE_URL.replace("/api/blockchain", "")}${ep.path}${ep.params.length ? "?" + ep.params.filter(p => p.required).map(p => `${p.name}=${p.default || "VALUE"}`).join("&") : ""}"`;
  const tryUrl = `${BASE_URL.replace("/api/blockchain", "")}${ep.path}${ep.params.length ? "?" + ep.params.filter(p => p.required).map(p => `${p.name}=${p.default || "1"}`).join("&") : ""}`;

  return (
    <div className="zion-rainbow-sub rounded-2xl bg-black/40 overflow-hidden" style={{ "--rc": "228, 30, 43" } as React.CSSProperties}>
      {/* header row (click to expand) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
          ep.method === "GET" ? "bg-zion-cyan/15 text-zion-cyan" : "bg-zion-purple/15 text-zion-purple"
        }`}>
          {ep.method}
        </span>
        <div className="min-w-0 flex-1">
          <PathDisplay path={ep.path} />
        </div>
        <span className="hidden sm:block text-[11px] text-white/40 truncate flex-shrink-0 max-w-[200px]">{ep.title}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/[0.04]">
          {/* description */}
          <p className="text-[13px] text-white/60 pt-3">{ep.description}</p>

          {/* parameters */}
          {ep.params.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium mb-2">{ApiDocsCopy.parameters[cs ? 'cs' : 'en']}</p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-white/[0.02] text-left">
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">Name</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">Type</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">Required</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">{ApiDocsCopy.description[cs ? 'cs' : 'en']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map((p) => (
                      <tr key={p.name} className="border-t border-white/[0.04]">
                        <td className="px-3 py-2 font-mono text-zion-purple">{p.name}</td>
                        <td className="px-3 py-2 text-white/50">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required
                            ? <span className="text-zion-purple text-[10px] font-semibold uppercase">Yes</span>
                            : <span className="text-white/30 text-[10px] uppercase">No{p.default ? ` · ${p.default}` : ""}</span>}
                        </td>
                        <td className="px-3 py-2 text-white/55">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* example request */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ApiDocsCopy.exampleRequest[cs ? 'cs' : 'en']}</p>
              <CopyButton text={curl} />
            </div>
            <pre className="rounded-xl bg-black/60 border border-white/[0.06] p-3.5 overflow-x-auto text-[12px] font-mono text-zion-cyan/90 leading-relaxed">
{curl}
            </pre>
          </div>

          {/* example response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ApiDocsCopy.exampleResponse[cs ? 'cs' : 'en']}</p>
              <CopyButton text={ep.exampleResponse} />
            </div>
            <pre className="rounded-xl bg-black/60 border border-white/[0.06] p-3.5 overflow-x-auto text-[12px] font-mono text-cyan-200/80 leading-relaxed">
{ep.exampleResponse}
            </pre>
          </div>

          {/* try it */}
          <a
            href={tryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zion-purple/15 border border-zion-purple/30 text-[12px] font-semibold text-zion-purple hover:bg-zion-purple/25 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {ApiDocsCopy.tryIt[cs ? 'cs' : 'en']}
          </a>
        </div>
      )}
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */

export default function ApiDocsClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-8 pt-6">
        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">{ApiDocsCopy.apiDocs[cs ? 'cs' : 'en']}</span>
        </nav>

        {/* header */}
        <div className="zion-rainbow-card p-6 md:p-10" style={{ "--rc": "228, 30, 43" } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-zion-purple/15 border border-zion-purple/25 flex items-center justify-center">
              <Code className="w-6 h-6 text-zion-purple" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{ApiDocsCopy.zionBlockchainApi[cs ? 'cs' : 'en']}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zion-purple/15 text-zion-purple border border-zion-purple/30">
                  v3.2.0
                </span>
              </div>
              <p className="text-sm text-white/40 mt-1">{ApiDocsCopy.jsonEndpointsForIntegrationAnd[cs ? 'cs' : 'en']}</p>
            </div>
          </div>

          {/* base url */}
          <div className="flex items-center gap-3 flex-wrap mt-6">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ApiDocsCopy.baseUrl[cs ? 'cs' : 'en']}</span>
            <code className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.08] text-[13px] font-mono text-zion-purple">{BASE_URL}</code>
            <CopyButton text={BASE_URL} label={ApiDocsCopy.copy[cs ? 'cs' : 'en']} />
          </div>

          {/* rate limit banner */}
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-zion-cyan/[0.07] border border-zion-cyan/20 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-zion-cyan animate-pulse flex-shrink-0" />
            <p className="text-[13px] text-zion-cyan/90">
              <span className="font-semibold">{ApiDocsCopy.rateLimiting[cs ? 'cs' : 'en']}</span>{" "}
              {ApiDocsCopy.rateLimitValue[cs ? 'cs' : 'en']}
            </p>
          </div>
        </div>

        {/* endpoints by category */}
        {CATEGORIES.map((cat) => {
          const eps = ENDPOINTS.filter((e) => e.category === cat);
          if (eps.length === 0) return null;
          return (
            <section key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{cat}</h2>
                <span className="text-[11px] text-white/30">({eps.length})</span>
              </div>
              <div className="space-y-2.5">
                {eps.map((ep) => (
                  <EndpointAccordion key={ep.path} ep={ep} cs={cs} />
                ))}
              </div>
            </section>
          );
        })}

        {/* footer */}
        <p className="text-center text-xs text-white/30 pt-4">
          {ApiDocsCopy.zionTerranovaV306ApiDocumentat[cs ? 'cs' : 'en']}
        </p>
      </div>
    </div>
  );
}
