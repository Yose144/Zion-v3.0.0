# Hiran v2.4 — Agentic AI for Zion

> **Status:** Proposal / Design Phase  
> **Date:** 2026-06-13  
> **Previous:** Hiran v2.3 (Qwen3-32B Full FT, in training now on 2x A100)

---

## 1. Vision: From Chatbot to Agent

Hiran v2.3 is a **domain-specific chatbot** — it answers questions about Zion.  
Hiran v2.4 becomes an **autonomous agent** — it *acts* on behalf of the user.

### What v2.4 Can Do (that v2.3 cannot)

| Capability | v2.3 | v2.4 |
|---|---|---|
| Answer questions | ✅ | ✅ |
| Recall precise facts | ✅ (after Full FT) | ✅ |
| **Query live blockchain data** | ❌ | ✅ (RPC tool) |
| **Check pool stats / hashrate** | ❌ | ✅ (API tool) |
| **Generate & execute code** | ❌ | ✅ (Python/Rust sandbox) |
| **Read charts & graphs** | ❌ | ✅ (Vision + OCR) |
| **Multi-turn planning** | ❌ | ✅ (ReAct loop) |
| **Remember user context** | ❌ | ✅ (Long-term memory) |
| **Self-correct when wrong** | ❌ | ✅ (Reflection loop) |

---

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│           Hiran v2.4 Agent Core             │
├─────────────────────────────────────────────┤
│  ReAct Reasoning Engine                      │
│  ├── Think: analyze user intent              │
│  ├── Act: call tools                         │
│  ├── Observe: process results               │
│  └── Loop: iterate until solved              │
├─────────────────────────────────────────────┤
│  Tool Registry (pluggable)                   │
│  ├── zion_rpc → query blockchain             │
│  ├── pool_api → mining statistics            │
│  ├── price_feed → market data                │
│  ├── code_exec → Python sandbox              │
│  └── web_search → external knowledge           │
├─────────────────────────────────────────────┤
│  Memory Layer                                │
│  ├── Short-term: conversation context       │
│  ├── Long-term: user preferences, facts      │
│  └── Episodic: past actions & outcomes      │
├─────────────────────────────────────────────┤
│  Vision Module (optional)                    │
│  ├── Chart reading (OCR + understanding)      │
│  ├── Blockchain explorer screenshots        │
│  └── Document analysis (whitepapers)        │
├─────────────────────────────────────────────┤
│  Base Model: Qwen3-32B (v2.3 checkpoint)     │
│  OR: Qwen3-72B / DeepSeek-V3 if budget       │
└─────────────────────────────────────────────┘
```

---

## 3. Base Model Strategy

### Option A: Qwen3-32B (inherit from v2.3)

- **Pros:** Already training now, proven base, 128K context
- **Cons:** 32B may not have enough capacity for agentic reasoning
- **Training:** DORA/LoRA on agentic datasets (cheaper than Full FT)
- **Cost:** ~$50-100 (1x A100 80GB for 24h)

### Option B: Qwen3-72B

- **Pros:** Better reasoning, more capacity for tool use
- **Cons:** Needs 4x A100 80GB for Full FT, or 2x for DORA
- **Training:** Full FT or heavy DORA (rank 1024+)
- **Cost:** ~$200-400

### Option C: DeepSeek-V3 (MoE, 671B total / 37B active)

- **Pros:** State-of-the-art reasoning, MoE = efficient inference
- **Cons:** Massive model, complex deployment, not fully open weights
- **Training:** Almost impossible to fine-tune fully
- **Cost:** Prohibitive for now

### Recommendation

**Start with Option A** (Qwen3-32B + agentic DORA). If v2.3 factual training succeeds, we can stack agentic adapters on top.

---

## 4. Training Plan

### Phase 1: Tool-Use Training (DORA, rank 512)

**Dataset:** 20,000 synthetic conversations with tool calls

```json
{
  "messages": [
    {"role": "user", "content": "What's the current Zion block height?"},
    {"role": "assistant", "content": "I'll check the blockchain for you."},
    {"role": "assistant", "tool_calls": [{"name": "zion_rpc", "arguments": {"method": "getblockcount"}}]},
    {"role": "tool", "content": "{\"result\": 1847291}"},
    {"role": "assistant", "content": "The current Zion block height is **1,847,291**."}
  ]
}
```

**Tools to train:**
1. `zion_rpc` — blockchain queries (getbalance, getblock, getmininginfo)
2. `pool_api` — mining pool stats (hashrate, workers, rewards)
3. `price_feed` — market data (ZION/USD price, volume)
4. `code_exec` — Python code execution (analysis, calculations)
5. `web_search` — DuckDuckGo / Brave Search for external info

### Phase 2: ReAct Reasoning (DORA, rank 256)

**Dataset:** 10,000 multi-step reasoning tasks

```json
{
  "messages": [
    {"role": "user", "content": "Is mining Zion profitable right now?"},
    {"role": "assistant", "content": "Let me analyze the current conditions..."},
    {"role": "assistant", "tool_calls": [{"name": "price_feed", "arguments": {"pair": "ZION/USD"}}]},
    {"role": "tool", "content": "{\"price\": 0.42, \"change_24h\": -3.2%}"},
    {"role": "assistant", "tool_calls": [{"name": "pool_api", "arguments": {"metric": "network_hashrate"}}]},
    {"role": "tool", "content": "{\"hashrate\": \"12.5 TH/s\", \"difficulty\": 845000000}"},
    {"role": "assistant", "tool_calls": [{"name": "code_exec", "arguments": {"code": "# Calculate profitability\nprice = 0.42\nhashrate = 12.5e12\ndifficulty = 845e6\nblock_reward = 50\nblocks_per_day = 86400 / 120\n..."}}]},
    {"role": "tool", "content": "Estimated daily revenue: $8.40 per 1 GH/s"},
    {"role": "assistant", "content": "Based on current data:\n- ZION price: $0.42 (down 3.2%)\n- Network hashrate: 12.5 TH/s\n- **Est. profitability: ~$8.40/day per GH/s**\n\nThis is [moderately profitable / break-even / unprofitable] depending on your electricity costs."}
  ]
}
```

### Phase 3: Reflection & Self-Correction (DORA, rank 128)

**Dataset:** 5,000 examples where the model initially makes a mistake, then corrects itself

```json
{
  "messages": [
    {"role": "user", "content": "What's the fee split?"},
    {"role": "assistant", "content": "The fee split is 90/5/5."},
    {"role": "user", "content": "Are you sure? Check the docs."},
    {"role": "assistant", "content": "You're right to question me. Let me verify..."},
    {"role": "assistant", "tool_calls": [{"name": "web_search", "arguments": {"query": "Zion DAO fee split 89/5/5/1"}}]},
    {"role": "tool", "content": "Official documentation: Miners 89%, Humanitarian 5%, Issobella 5%, Pool 1%"},
    {"role": "assistant", "content": "I apologize for the error. The correct fee split is **89/5/5/1**:\n- Miners: 89%\n- Humanitarian Fund: 5%\n- Issobella Initiative: 5%\n- Pool Operations: 1%"}
  ]
}
```

---

## 5. Infrastructure

### Deployment Options

| Setup | Cost/Month | Best For |
|---|---|---|
| 1x A100 80GB (DORA inference) | ~$300 | Development, testing |
| 2x RTX 4090 (24GB each, quantized) | ~$200 | Production inference |
| Vast.ai spot (on-demand) | ~$1-2/hr | Burst training |
| Local RTX 4090/5090 | $0 (sunk cost) | Personal inference |

### API Server

```python
# FastAPI server with tool execution
@app.post("/v1/agent/chat")
async def agent_chat(request: ChatRequest):
    # 1. Load conversation + memory
    # 2. Run ReAct loop (max 5 iterations)
    # 3. Execute tools as needed
    # 4. Return final response + action log
    pass
```

### Safety

- **Code sandbox:** Firejail + seccomp for Python execution
- **RPC limits:** Read-only queries, no transactions without user confirmation
- **Rate limiting:** Per-user quotas on tool calls
- **Audit log:** All actions logged for transparency

---

## 6. Success Metrics

| Metric | v2.3 Target | v2.4 Target |
|---|---|---|
| Factual accuracy (fee split) | 95% | 98% |
| Factual accuracy (all facts) | 85% | 92% |
| Tool call success rate | N/A | 90% |
| Multi-step task completion | N/A | 80% |
| User satisfaction | N/A | 4.5/5 |
| Latency (single turn) | <2s | <3s (with tools) |
| Latency (multi-turn agent) | N/A | <10s |

---

## 7. Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| Tool dataset generation | 1 week | v2.3 training complete |
| Tool-use DORA training | 3-5 days | Dataset ready |
| ReAct dataset generation | 1 week | Tool-use model ready |
| ReAct DORA training | 2-3 days | Dataset ready |
| Reflection dataset | 3 days | ReAct model ready |
| Reflection DORA training | 2 days | Dataset ready |
| Integration & testing | 1 week | All models ready |
| **Total** | **~5-6 weeks** | **v2.3 complete** |

---

## 8. Open Questions

1. **Should v2.4 be a single model or a system?**  
   Single model = simpler, but may struggle with everything.  
   System = router + specialist models (fact model, tool model, vision model).

2. **How to handle tool failures?**  
   RPC node down, API rate limited, sandbox timeout.

3. **Should we allow the agent to spend money?**  
   Auto-staking, auto-compounding, fee optimization — powerful but risky.

4. **What about voice / real-time?**  
   Whisper for input, TTS for output — adds latency but improves UX.

5. **On-chain agent identity?**  
   Should the agent have its own Zion wallet for micro-transactions?

---

## 9. Next Steps

1. ✅ Wait for v2.3 training to complete (~40-50h)
2. ✅ Evaluate v2.3 factual accuracy
3. 🔄 Design tool API schemas (RPC, pool, price)
4. 🔄 Build tool execution sandbox
5. 🔄 Generate synthetic tool-use dataset
6. 🔄 Start v2.4 DORA training

---

*Proposal created: 2026-06-13*  
*v2.3 currently training on Vast.ai (2x A100 SXM4)*
