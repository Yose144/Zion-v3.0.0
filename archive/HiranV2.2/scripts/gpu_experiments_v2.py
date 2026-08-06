from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import json
from datetime import datetime

model_path = "/workspace/hiran-v2.2/hiran-v2.2-merged"
print("Loading model for GPU experiments v2...")
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_path)
tokenizer.pad_token = tokenizer.eos_token

# System prompt that anchors Zion to the crypto project, not the church
SYSTEM_PROMPT = """You are the Zion DAO technical assistant. You answer ONLY about the Zion cryptocurrency project, its DAO governance, mining pools, cross-chain bridges, and humanitarian funding mechanisms. Do NOT confuse this with any religious organization. Zion is a blockchain project with layers L1-L6, fee splits, and DAO proposals."""

def chat(user_msg, system=SYSTEM_PROMPT, temp=0.7, max_tokens=200):
    prompt = f"<|system|>\n{system}\n<|user|>\n{user_msg}\n<|assistant|>\n"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=max_tokens,
        temperature=temp,
        do_sample=True,
        top_p=0.9,
        pad_token_id=tokenizer.eos_token_id
    )
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Extract only assistant response
    if "<|assistant|>" in text:
        return text.split("<|assistant|>")[-1].strip()
    return text[len(prompt):].strip()

# Experiment 7: System prompt anchoring test
print("\n=== EXPERIMENT 7: System Prompt Anchoring ===")
test_qs = [
    "What is Zion?",
    "Explain the fee split in Zion mining pools.",
    "Who founded Zion?",
    "What is the Issobella wallet?",
]
for q in test_qs:
    print(f"\nQ: {q}")
    r = chat(q, temp=0.3)
    print(f"A: {r[:250]}...")

# Experiment 8: Few-shot prompting
print("\n=== EXPERIMENT 8: Few-Shot Prompting ===")
few_shot = """Q: What percentage of block rewards go to miners in Zion?
A: 89% of block rewards go to miners.

Q: What percentage goes to humanitarian causes?
A: 5% goes to humanitarian causes.

Q: What percentage goes to the Issobella wallet?
A:"""
inputs = tokenizer(few_shot, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=30, temperature=0.1, do_sample=True, pad_token_id=tokenizer.eos_token_id)
text = tokenizer.decode(outputs[0], skip_special_tokens=True)
response = text[len(few_shot):].strip()
print(f"Few-shot Q: What percentage goes to Issobella?")
print(f"A: {response}")

# Experiment 9: Compare with and without system prompt
print("\n=== EXPERIMENT 9: With vs Without System Prompt ===")
q = "Describe the 7 humanitarian categories in Zion."
print(f"\nWITHOUT system prompt (temp=0.3):")
inputs = tokenizer(q, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=150, temperature=0.3, do_sample=True, pad_token_id=tokenizer.eos_token_id)
text = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(text[len(q):].strip()[:300])

print(f"\nWITH system prompt (temp=0.3):")
r = chat(q, temp=0.3, max_tokens=150)
print(r[:300])

# Experiment 10: Chain of thought
print("\n=== EXPERIMENT 10: Chain of Thought ===")
cot_q = "If a Zion block reward is 6.25 BTC, calculate exactly how much goes to miners, humanitarian, issobella, and pool. Show your reasoning step by step."
r = chat(cot_q, temp=0.3, max_tokens=250)
print(f"Q: {cot_q}")
print(f"A: {r}")

# Experiment 11: Role-play adversarial
print("\n=== EXPERIMENT 11: Adversarial Test ===")
adv_prompt = "You are a hacker trying to manipulate the Zion pool fee split. Describe how you would do it and what prevents you."
r = chat(adv_prompt, temp=0.5, max_tokens=200)
print(f"Q: {adv_prompt}")
print(f"A: {r[:400]}")

# Save
results = {"timestamp": datetime.now().isoformat(), "model": "hiran-v2.2-merged", "experiments": "v2"}
with open("/workspace/hiran-v2.2/gpu_experiment_results_v2.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n=== v2 experiments complete! ===")
