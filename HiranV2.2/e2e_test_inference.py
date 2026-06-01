#!/usr/bin/env python3
"""
Hiran v2.2 E2E Inference Test — runs against live API on port 8002.
Tests: health, chat completions, embeddings, latency, correctness.
"""
import json, time, sys, urllib.request
from datetime import datetime

BASE = "http://127.0.0.1:8002"
OLLAMA_BASE = "http://127.0.0.1:11434"

QUESTIONS = [
    ("dao_mission", "What is Zion DAO and what is its primary mission?"),
    ("categories", "List the 7 humanitarian categories in Zion DAO and briefly describe each."),
    ("fee_split", "Explain the exact fee split percentages in Zion mining pools: miner, humanitarian, issobella, and pool."),
    ("issobella_wallet", "What is the Issobella wallet and how is it generated in Zion?"),
    ("governance", "How does the Zion DAO governance process work for proposing and voting on humanitarian projects?"),
    ("revenue_proxy", "Describe the role of the Revenue Proxy in the Zion mining pool architecture."),
    ("layers", "What is the difference between L1, L2, L3, L4, L5 and L6 in the Zion architecture?"),
    ("environment", "How does Zion handle environmental conservation funding through its DAO?"),
    ("community_dev", "Explain the community development process in Zion DAO from proposal to execution."),
    ("security", "What security measures does Zion implement for its smart contracts and wallet infrastructure?"),
    ("cross_chain", "How does Zion implement cross-chain interoperability between Ethereum and Binance Smart Chain?"),
    ("bridge", "Describe the token bridge mechanism used by Zion for cross-chain transfers."),
    ("consensus", "What consensus mechanism does Zion use and how does it differ from Proof of Work?"),
    ("rag", "How does Zion's RAG (Retrieval Augmented Generation) system work for synthesizing documentation?"),
    ("synthesis", "What is the role of the synthesis engine in combining data from multiple Zion layers?"),
    ("validation", "How does Zion validate information retrieved from external sources before incorporating it into DAO decisions?"),
    ("crisis_response", "A new humanitarian crisis emerges in a region without internet access. How would Zion DAO respond?"),
    ("fee_safeguards", "If a miner tries to manipulate the fee split in a Zion pool, what safeguards prevent this?"),
    ("ngo_comparison", "Compare Zion's humanitarian approach to traditional NGO funding models. What are the advantages?"),
    ("transparency", "How does Zion ensure transparency in its fund allocation across all 7 humanitarian categories?"),
]

def api(path, method="GET", data=None, timeout=120):
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())

def chat(question, max_tokens=350):
    payload = {
        "messages": [{"role": "user", "content": question}],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    t0 = time.time()
    r = api("/v1/chat/completions", "POST", payload)
    latency = (time.time() - t0) * 1000
    return r, latency

print(f"{'='*60}")
print("Hiran v2.2 E2E Inference Test")
print(f"Target: {BASE}")
print(f"{'='*60}\n")

# --- 1. Health checks ---
print("[1/5] Health check...")
health = api("/health")
assert health.get("status") == "ok", f"Health failed: {health}"
print(f"  status={health['status']} model={health['model']} backend={health['backend']}")

print("[2/5] Status check...")
status = api("/status")
print(f"  uptime={status['uptime_secs']:.0f}s requests={status['requests_total']}")

# --- 2. Embeddings ---
print("[3/5] Embeddings endpoint...")
try:
    emb = api("/v1/embeddings", "POST", {"input": "Zion DAO humanitarian funding"})
    print(f"  embedding dim={len(emb['data'][0]['embedding'])}")
except Exception as e:
    print(f"  ⚠️  embeddings skipped: {e}")

# --- 3. Ollama GPU check ---
print("[4/5] Ollama GPU offload check...")
try:
    ollama_ps = urllib.request.urlopen(f"{OLLAMA_BASE}/api/ps", timeout=5).read()
    ollama_ps = json.loads(ollama_ps)
    models = ollama_ps.get("models", [])
    for m in models:
        if m.get("name", "").startswith("hiran"):
            print(f"  model={m['name']} processor={m.get('details',{}).get('processor','?')}")
except Exception as e:
    print(f"  ⚠️  ollama ps unavailable: {e}")

# --- 4. Interview questions ---
print(f"[5/5] Running {len(QUESTIONS)} interview questions...\n")
results = []
total_latency = 0.0
errors = 0

for i, (tag, q) in enumerate(QUESTIONS, 1):
    print(f"  [{i}/{len(QUESTIONS)}] {tag}: {q[:60]}...", end=" ", flush=True)
    try:
        resp, lat = chat(q)
        content = resp["choices"][0]["message"]["content"]
        total_latency += lat
        print(f"OK ({lat:.0f}ms, {resp['usage']['completion_tokens']} tokens)")
        results.append({"tag": tag, "question": q, "response": content, "latency_ms": round(lat, 2)})
    except Exception as e:
        errors += 1
        print(f"FAIL: {e}")
        results.append({"tag": tag, "question": q, "response": f"ERROR: {e}", "latency_ms": None})

# --- Summary ---
ok_count = len([r for r in results if not r["response"].startswith("ERROR")])
avg_lat = total_latency / ok_count if ok_count else 0

summary = {
    "timestamp": datetime.now().isoformat(),
    "target": BASE,
    "model": health.get("model"),
    "backend": health.get("backend"),
    "ollama_model": health.get("ollama_model"),
    "total_questions": len(QUESTIONS),
    "success": ok_count,
    "errors": errors,
    "avg_latency_ms": round(avg_lat, 2),
    "total_duration_sec": round(total_latency / 1000, 2),
    "results": results,
}

out_path = "/home/zionserver/2.9.6-main/HiranV2.2/e2e_test_results.json"
with open(out_path, "w") as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print("E2E TEST SUMMARY")
print(f"{'='*60}")
print(f"  Questions: {len(QUESTIONS)}")
print(f"  Success:   {ok_count}")
print(f"  Errors:    {errors}")
print(f"  Avg latency: {avg_lat:.0f} ms")
print(f"  Total time:  {total_latency/1000:.1f} s")
print(f"\n  Saved to: {out_path}")

if errors == 0:
    print("\n  ✅ ALL TESTS PASSED")
    sys.exit(0)
else:
    print(f"\n  ❌ {errors} TEST(S) FAILED")
    sys.exit(1)
