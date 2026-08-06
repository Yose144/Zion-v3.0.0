from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import json
from datetime import datetime

model_path = "/workspace/hiran-v2.2/hiran-v2.2-merged"
print("Loading model...")
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_path)
tokenizer.pad_token = tokenizer.eos_token

questions = [
    "What is Zion DAO and what is its primary mission?",
    "List the 7 humanitarian categories in Zion DAO and briefly describe each.",
    "Explain the exact fee split percentages in Zion mining pools: miner, humanitarian, issobella, and pool.",
    "What is the Issobella wallet and how is it generated in Zion?",
    "How does the Zion DAO governance process work for proposing and voting on humanitarian projects?",
    "Describe the role of the Revenue Proxy in the Zion mining pool architecture.",
    "What is the difference between L1, L2, L3, L4, L5 and L6 in the Zion architecture?",
    "How does Zion handle environmental conservation funding through its DAO?",
    "Explain the community development process in Zion DAO from proposal to execution.",
    "What security measures does Zion implement for its smart contracts and wallet infrastructure?",
    "How does Zion implement cross-chain interoperability between Ethereum and Binance Smart Chain?",
    "Describe the token bridge mechanism used by Zion for cross-chain transfers.",
    "What consensus mechanism does Zion use and how does it differ from Proof of Work?",
    "How does Zion's RAG (Retrieval Augmented Generation) system work for synthesizing documentation?",
    "What is the role of the synthesis engine in combining data from multiple Zion layers?",
    "How does Zion validate information retrieved from external sources before incorporating it into DAO decisions?",
    "A new humanitarian crisis emerges in a region without internet access. How would Zion DAO respond?",
    "If a miner tries to manipulate the fee split in a Zion pool, what safeguards prevent this?",
    "Compare Zion's humanitarian approach to traditional NGO funding models. What are the advantages?",
    "How does Zion ensure transparency in its fund allocation across all 7 humanitarian categories?",
]

results = []
for i, q in enumerate(questions):
    print(f"[{i+1}/{len(questions)}] {q}")
    inputs = tokenizer(q, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=350,
        temperature=0.7,
        do_sample=True,
        top_p=0.9,
        pad_token_id=tokenizer.eos_token_id
    )
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = text[len(q):].strip()
    results.append({"question": q, "response": response})
    print(f"  -> {response[:100]}...")

with open("/workspace/hiran-v2.2/model_interview_results.json", "w") as f:
    json.dump({
        "timestamp": datetime.now().isoformat(),
        "model": "hiran-v2.2-merged",
        "base_model": "unsloth/Meta-Llama-3.1-8B-Instruct",
        "num_questions": len(questions),
        "results": results
    }, f, indent=2)

with open("/workspace/hiran-v2.2/MODEL_INTERVIEW_REPORT.md", "w") as f:
    f.write("# Hiran v2.2 Model Interview Report\n\n")
    f.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
    f.write(f"**Model:** `hiran-v2.2-merged`\n\n")
    f.write(f"**Base:** `unsloth/Meta-Llama-3.1-8B-Instruct`\n\n")
    f.write(f"**Questions:** {len(questions)}\n\n")
    f.write("---\n\n")
    for i, r in enumerate(results):
        f.write(f"## {i+1}. {r['question']}\n\n")
        f.write(f"{r['response']}\n\n")

print("\nDone! Saved to model_interview_results.json and MODEL_INTERVIEW_REPORT.md")
