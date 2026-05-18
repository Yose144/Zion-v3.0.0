# ZION NCL — Neural Compute Layer Integration

> **Phase:** F (delivered 2026-05-19)
> **Status:** Production-track — wires the 25 % NCL revenue stream to a live Hiran v2.2 inference gateway end-to-end.
> **Canonical code:** `V3/L1/pool/src/ncl_gateway.rs`, `V3/L1/cosmic-harmony/src/revenue.rs` (`NclStats`), `V3/L1/core/src/lib.rs` (`record_ncl_task_revenue`, `revenue_handle`).

---

## 1. What this fixes

Before Phase F, the NCL stream existed only as bookkeeping:
- `RevenueCollector::track_ncl_task` was defined but **never called** from any production path.
- The 25 % NCL allocation in `RevenueScheduler` routed sessions to `SessionGroup::Ncl` but no actual AI work was dispatched.
- The Hiran v2.2 inference service ran independently of the pool.

Phase F adds the missing bridge: a tokio-driven dispatcher inside the pool server that pulls tasks from an in-memory queue, calls the Hiran HTTP API, and records the result as NCL revenue.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Pool Server (sync main)                                     │
│                                                              │
│   ZION_NCL_GATEWAY_URL set?                                  │
│        │                                                     │
│        └──► spawn thread + tokio runtime                     │
│                  │                                           │
│                  ├──► (optional) Heartbeat producer ──┐      │
│                  │                                    │      │
│                  ▼                                    ▼      │
│        ┌─────────────────────┐         mpsc::Sender<Task>    │
│        │   NclDispatcher     │◄─────── (customer endpoints,  │
│        │                     │           share observers …)  │
│        │  for task in queue: │                               │
│        │    chat_completion  │──HTTP──► Hiran v2.2 :8002    │
│        │    pricing          │                               │
│        │    track_ncl_task_  │                               │
│        │      detailed       │──────► RevenueCollector       │
│        └─────────────────────┘            │                  │
│                                            ▼                  │
│                                       NclStats + RevenueStats │
└──────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                                   RPC GetRevenue (node)
```

Key design choices:

- **No new crate dependency.** Pool already has `tokio` and `serde_json`. The dispatcher uses a hand-rolled HTTP/1.1 client over `TcpStream` — Hiran is a localhost JSON service so this is sufficient and keeps the validator-adjacent build light.
- **`RevenueCollector::clone()` is the bridge.** `CoreRuntime::revenue_handle()` returns a cheap `Arc`-internal clone so the async dispatcher and the sync share-validation path write to the **same** accounting state without lock contention or runtime coupling.
- **Heartbeat as the bootstrap source.** Until paying customers are plumbed in, a periodic heartbeat task keeps the pipeline warm and makes the revenue stream observable end-to-end. The mpsc queue is also exposed for future submit endpoints.

---

## 3. Components

### 3.1 `NclPricing`

USD price model with three knobs:

| Field | Default | Env override |
|---|---|---|
| `price_in_per_1k_tokens` | `0.0005` | `ZION_NCL_PRICE_IN_PER_1K` |
| `price_out_per_1k_tokens` | `0.0015` | `ZION_NCL_PRICE_OUT_PER_1K` |
| `min_per_task_usd` | `0.00005` | `ZION_NCL_MIN_PER_TASK_USD` |

Charge formula:
```
value_usd = max(min_per_task_usd,
                prompt_tokens * price_in / 1000
              + completion_tokens * price_out / 1000)
```

Defaults are conservative — public rates for similar Llama-3 / Mistral-7B class APIs sit in the $0.0005–$0.002 / 1k token band and a 7B-q5_k_m model on an RTX 3060 produces ~1000 completion tokens / second.

### 3.2 `NclGatewayClient`

Minimal async HTTP/1.1 client over `tokio::net::TcpStream`.

- `new(base_url)` — accepts `http://host:port`, `host:port`, or bare `host` (default port 8002).
- `health()` — `GET /health`, returns `bool`.
- `chat_completion(prompt, max_tokens)` — `POST /v1/chat/completions`. Reads token counts from `usage.{prompt,completion}_tokens`; falls back to whitespace word-count when absent.

The OpenAI-compat path matches what `V3/L3/ai-native/src/hiran_inference.rs::HiranInferenceClient::chat` produces, so any operator already running Hiran for `zion hiran ask` automatically supports the pool.

### 3.3 `NclTaskRequest` / `NclTaskResult`

```rust
pub struct NclTaskRequest {
    pub prompt: String,
    pub max_tokens: u32,
    pub value_usd_override: Option<f64>, // for pre-priced customer jobs
    pub origin: String,                   // "heartbeat" | "customer" | …
}

pub struct NclTaskResult {
    pub origin: String,
    pub success: bool,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub latency_ms: u64,
    pub value_usd: f64,
    pub response_digest: Option<String>, // FNV-1a fingerprint for audit/dedup
    pub error: Option<String>,
}
```

### 3.4 `NclDispatcher`

Owns `(client, pricing, revenue: RevenueCollector)`. `spawn(heartbeat_cfg, queue_capacity)` launches:
1. An optional heartbeat producer (when `ZION_NCL_HEARTBEAT=true`) that pushes a tiny prompt every `ZION_NCL_HEARTBEAT_SECS` seconds.
2. The dispatcher loop that pulls from `mpsc<NclTaskRequest>`, calls the gateway, and records revenue via `RevenueCollector::track_ncl_task_detailed`.

Returns the `NclTaskSender` so other subsystems (future customer HTTP endpoints, share observers, …) can submit work.

### 3.5 `NclStats`

```rust
pub struct NclStats {
    pub tasks_total: u64,
    pub tasks_succeeded: u64,
    pub tasks_failed: u64,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub total_latency_ms: u64,
    pub total_value_usd: f64,
    pub last_success_ts: Option<String>,
}
```

Accessors: `success_rate()`, `avg_latency_ms()`, `avg_tokens_out()`.

Exposed at:
- `CoreRuntime::ncl_stats()` (Rust API)
- `RevenueCollector::ncl_stats()` (cosmic-harmony level)

### 3.6 `CoreRuntime::record_ncl_task_revenue` / `revenue_handle`

```rust
runtime.record_ncl_task_revenue(value_usd, tokens_in, tokens_out, latency_ms, success);
let handle: RevenueCollector = runtime.revenue_handle(); // clone for async tasks
```

---

## 4. Configuration

### 4.1 Environment variables

| Variable | Default | Description |
|---|---|---|
| `ZION_NCL_GATEWAY_URL` | — (disabled) | Hiran inference base URL. Setting this enables the dispatcher. |
| `ZION_NCL_HEARTBEAT` | `false` | Inject periodic heartbeat tasks. |
| `ZION_NCL_HEARTBEAT_SECS` | `60` | Heartbeat interval. |
| `ZION_NCL_HEARTBEAT_TOKENS` | `8` | `max_tokens` for heartbeat prompts. |
| `ZION_NCL_QUEUE_SIZE` | `256` | mpsc queue capacity. |
| `ZION_NCL_PRICE_IN_PER_1K` | `0.0005` | USD per 1000 prompt tokens. |
| `ZION_NCL_PRICE_OUT_PER_1K` | `0.0015` | USD per 1000 completion tokens. |
| `ZION_NCL_MIN_PER_TASK_USD` | `0.00005` | Minimum charge per task. |

### 4.2 Recommended dev rollout

```bash
# 1. Start Hiran inference service on the operator's GPU host
python3 HiranV2.2/inference/serve.py \
    --model_path ./HiranV2.2/models/gguf/hiran-v2.2-q5_k_m.gguf \
    --port 8002

# 2. Verify
curl http://127.0.0.1:8002/health

# 3. Enable the dispatcher in the pool
export ZION_NCL_GATEWAY_URL=http://127.0.0.1:8002
export ZION_NCL_HEARTBEAT=true
export ZION_NCL_HEARTBEAT_SECS=30

# 4. Start pool — log line confirms wiring
cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server
# → ncl_gateway_enabled url=127.0.0.1:8002 heartbeat=true interval_secs=30 …
# → ncl_dispatcher started gateway=127.0.0.1:8002 …
```

After ~1 minute, query revenue:
```bash
# Via node RPC (revenue_snapshot includes by_source["ncl_ai"])
curl -s http://127.0.0.1:8443/rpc -d '{"jsonrpc":"2.0","method":"GetRevenue","id":1}'
```

---

## 5. Testing

### 5.1 Unit + integration tests (`zion-pool`)

| Test | What it proves |
|---|---|
| `pricing_default_applies_floor` | `min_per_task_usd` floor enforced when token counts are zero. |
| `pricing_scales_with_tokens` | Per-1k math correct (1000 in + 500 out at $1/$2 = $2.00). |
| `pricing_env_overrides_defaults` | `ZION_NCL_PRICE_*` env vars override defaults. |
| `authority_parsing_handles_schemes_and_ports` | URL parser accepts schemes, hostnames, ports, default-port fallback. |
| `http_response_parser_extracts_status_and_body` | Hand-rolled HTTP/1.1 parser handles realistic responses. |
| `approx_token_count_uses_word_boundary` | Fallback token count is stable. |
| `response_digest_is_stable` | FNV-1a digest deterministic + sensitive to input changes. |
| `chat_completion_against_mock_gateway` | **End-to-end** real tokio TCP call to a mock OpenAI-compat server; parsed token counts + content match. |
| `dispatcher_records_revenue_for_successful_task` | Dispatcher receives task → calls gateway → updates `NclStats` (`tasks_total=1`, `tokens_in=3`, `tokens_out=1`, `total_value_usd > 0`). |
| `dispatcher_records_failure_when_gateway_unreachable` | Unreachable gateway → `tasks_failed += 1`, `total_value_usd = 0`. |

Run:
```bash
cargo test --manifest-path V3/Cargo.toml -p zion-pool --lib ncl_gateway
```

### 5.2 End-to-end against a live Hiran

```bash
# Hiran running locally, pool wired up:
export ZION_NCL_GATEWAY_URL=http://127.0.0.1:8002
export ZION_NCL_HEARTBEAT=true
export ZION_NCL_HEARTBEAT_SECS=10

cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server &
sleep 90
# Expect: 8–9 heartbeat completions, NclStats.tasks_succeeded ~= 8
```

---

## 6. What's next (Phase F2 / G)

- **Customer submit endpoint** — `POST /ncl/submit` on the pool's metrics server (or a dedicated bind) accepting `{prompt, max_tokens, value_usd}` from billing-system callers; pushes onto the same `mpsc` queue.
- **NCL stats line in `/stats`** — surface `tasks_total`, `success_rate`, `avg_latency_ms`, `total_value_usd` directly in the existing pool metrics JSON / Prometheus payload.
- **CLI integration** — extend `zion ncl status` to read from the pool's metrics endpoint (currently it queries the AI-native agent).
- **Runtime profit-switching** — route shares between NCL and Multi-Algo based on `value_usd_per_compute_unit` measured live.
- **Result validation hook** — pluggable signature/checksum verifier before crediting customer revenue (anti-cheat for paid workloads).

---

## 7. File reference

| File | Purpose | LOC |
|---|---|---|
| `V3/L1/pool/src/ncl_gateway.rs` | Pricing, client, dispatcher, 10 tests | ~700 |
| `V3/L1/cosmic-harmony/src/revenue.rs` | `NclStats` + `track_ncl_task_detailed` + getter | (delta) |
| `V3/L1/core/src/lib.rs` | `record_ncl_task_revenue`, `ncl_stats`, `revenue_handle` | (delta) |
| `V3/L1/pool/src/bin/server.rs` | Dispatcher bootstrap on startup | (delta) |
| `revenue.md` | §10 (NCL section) | (delta) |
| `REVENUE_IMPLEMENTATION_PLAN.md` | Phase F entry | (delta) |

---

*Generated with [Devin](https://cli.devin.ai/docs)*
