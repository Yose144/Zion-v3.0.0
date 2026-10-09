from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import time
import json
from datetime import datetime

model_path = "/workspace/hiran-v2.2/hiran-v2.2-merged"
print("Loading model for GPU experiments...")
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_path)
tokenizer.pad_token = tokenizer.eos_token

print(f"Model loaded. GPU memory allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
print(f"GPU memory reserved: {torch.cuda.memory_reserved() / 1e9:.2f} GB")

# Experiment 1: Speed benchmark
print("\n=== EXPERIMENT 1: Inference Speed Benchmark ===")
prompt = "Explain how Zion DAO handles cross-chain token bridges."
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

for max_tokens in [64, 128, 256, 512]:
    torch.cuda.synchronize()
    start = time.time()
    outputs = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=False)
    torch.cuda.synchronize()
    elapsed = time.time() - start
    generated_tokens = outputs.shape[1] - inputs.input_ids.shape[1]
    print(f"  max_new_tokens={max_tokens:3d}: {elapsed:.2f}s -> {generated_tokens/elapsed:.1f} tok/s")

# Experiment 2: Temperature sweep
print("\n=== EXPERIMENT 2: Temperature Sweep ===")
prompt = "Describe the Zion humanitarian fund allocation process."
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

for temp in [0.1, 0.3, 0.5, 0.7, 0.9, 1.2]:
    outputs = model.generate(**inputs, max_new_tokens=120, temperature=temp, do_sample=True, top_p=0.95)
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = text[len(prompt):].strip()
    print(f"\n  temperature={temp}:")
    print(f"    {response[:200]}...")

# Experiment 3: Top-p sweep
print("\n=== EXPERIMENT 3: Top-p Sweep ===")
for top_p in [0.1, 0.5, 0.7, 0.9, 0.95, 1.0]:
    outputs = model.generate(**inputs, max_new_tokens=80, temperature=0.7, do_sample=True, top_p=top_p)
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = text[len(prompt):].strip()
    print(f"  top_p={top_p}: {response[:120]}...")

# Experiment 4: Code generation
print("\n=== EXPERIMENT 4: Code Generation ===")
code_prompts = [
    "Write a Python function that calculates Zion's fee split given a block reward amount.",
    "Write a Rust function to validate a Zion DAO proposal vote.",
    "Write a Solidity smart contract for a Zion cross-chain bridge vault.",
]
for cp in code_prompts:
    print(f"\n  Prompt: {cp}")
    inputs_c = tokenizer(cp, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs_c, max_new_tokens=300, temperature=0.3, do_sample=True)
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = text[len(cp):].strip()
    print(f"  Response:\n{response[:500]}")

# Experiment 5: Factual recall test
print("\n=== EXPERIMENT 5: Factual Recall Test ===")
factual_qs = [
    ("What percentage of Zion mining pool fees go to humanitarian causes?", "5%"),
    ("What percentage goes to the Issobella wallet?", "5%"),
    ("What percentage goes to miners?", "89%"),
    ("What percentage goes to the pool operator?", "1%"),
    ("Name all 7 Zion humanitarian categories.", "Food Water Shelter Health Hygiene Education Disaster Relief Community Development Environmental Conservation Human Rights Justice"),
]
for q, expected in factual_qs:
    inputs_f = tokenizer(q, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs_f, max_new_tokens=80, temperature=0.1, do_sample=True)
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = text[len(q):].strip()
    contains = any(e.lower() in response.lower() for e in expected.split())
    print(f"  Q: {q}")
    print(f"  A: {response[:150]}...")
    print(f"  Contains expected keywords: {contains}")

# Experiment 6: Long context test
print("\n=== EXPERIMENT 6: Long Context Summarization ===")
long_text = " ".join([
    "Zion DAO is a decentralized autonomous organization focused on humanitarian funding.",
    "It operates on a multi-layer architecture with L1 core consensus, L2 DAO governance,",
    "L3 cross-chain bridges, L4 application layer, L5 vision systems, and L6 research.",
    "The fee split mechanism allocates 89% to miners, 5% to humanitarian causes,",
    "5% to the Issobella tithe wallet, and 1% to the pool operator.",
    "Humanitarian categories include food and water, health, education, disaster relief,",
    "community development, environmental conservation, and human rights.",
    "Zion uses a custom consensus algorithm optimized for fair distribution of resources.",
    "The DAO governance process involves proposal submission, community voting,",
    "and automated fund disbursement through smart contracts.",
    "Cross-chain bridges connect Zion to Ethereum, BSC, and other EVM-compatible chains.",
    "The Issobella wallet is generated deterministically from DAO parameters",
    "and serves as a transparent tithe collection mechanism.",
    "Security is maintained through multi-sig validation, formal verification of contracts,",
    "and continuous monitoring of the network.",
])
prompt_ctx = f"Summarize the following Zion DAO text in 3 bullet points:\n\n{long_text}\n\nSummary:"
inputs_ctx = tokenizer(prompt_ctx, return_tensors="pt").to(model.device)
torch.cuda.synchronize()
start = time.time()
outputs = model.generate(**inputs_ctx, max_new_tokens=150, temperature=0.5, do_sample=True)
torch.cuda.synchronize()
elapsed = time.time() - start
text = tokenizer.decode(outputs[0], skip_special_tokens=True)
response = text[len(prompt_ctx):].strip()
print(f"  Time: {elapsed:.2f}s")
print(f"  Response:\n{response}")

# Save results
results = {
    "timestamp": datetime.now().isoformat(),
    "model": "hiran-v2.2-merged",
    "gpu_memory_allocated_gb": torch.cuda.memory_allocated() / 1e9,
    "gpu_memory_reserved_gb": torch.cuda.memory_reserved() / 1e9,
}
with open("/workspace/hiran-v2.2/gpu_experiment_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n=== All experiments complete! ===")
print("Results saved to /workspace/hiran-v2.2/gpu_experiment_results.json")
