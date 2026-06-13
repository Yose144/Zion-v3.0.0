#!/usr/bin/env python3
"""
Hiran v2.3 Hybrid Inference Pipeline
Combines fine-tuned model (Zion domain) + RAG (general knowledge) for comprehensive answers.

Usage:
    python rag/inference_hybrid.py --model /path/to/hiran-v2.3-merged --query "Explain the Book of Amduat"
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Import our RAG modules
sys.path.insert(0, str(Path(__file__).parent))
try:
    from query_router import classify_query, get_router_explanation
    from retriever import KnowledgeRetriever
    RAG_AVAILABLE = True
except ImportError as e:
    RAG_AVAILABLE = False
    RAG_ERROR = str(e)


# System prompt templates
ZION_SYSTEM_PROMPT = """You are the Zion DAO technical assistant. You have deep expertise in Zion blockchain architecture, DAO governance, mining pools, cross-chain bridges, and humanitarian funding. Answer accurately using your specialized training."""

KNOWLEDGE_SYSTEM_PROMPT = """You are a knowledgeable assistant with access to extensive information about history, religion, science, cultures, and languages. Use the provided context to answer accurately. If the context doesn't fully answer, use your general knowledge but indicate uncertainty."""

HYBRID_SYSTEM_PROMPT = """You are the Zion DAO technical assistant with broad knowledge of history, religion, science, cultures, and languages. You specialize in Zion blockchain but can also discuss the provided context. Answer accurately and cite sources when using retrieved information."""


def build_prompt(query: str, context: str = "", classification: str = "zion_only") -> str:
    """Build the chat prompt based on classification."""
    if classification == "zion_only":
        system = ZION_SYSTEM_PROMPT
        user_prompt = query
    elif classification == "knowledge_rag":
        system = KNOWLEDGE_SYSTEM_PROMPT
        user_prompt = f"{context}\n\nQuestion: {query}\n\nAnswer based on the provided context and your knowledge:"
    else:  # hybrid
        system = HYBRID_SYSTEM_PROMPT
        user_prompt = f"Context information:\n{context}\n\nQuestion: {query}\n\nAnswer:"

    # Qwen3 chat format
    prompt = f"<|im_start|>system\n{system}\n<|im_end|>\n"
    prompt += f"<|im_start|>user\n{user_prompt}\n<|im_end|>\n"
    prompt += "<|im_start|>assistant\n"
    return prompt


def generate_response(
    model_path: str,
    query: str,
    max_new_tokens: int = 512,
    temperature: float = 0.7,
    top_p: float = 0.9,
    use_rag: bool = True,
    top_k: int = 5,
):
    """Generate a response using the hybrid pipeline."""
    if not TORCH_AVAILABLE:
        print("ERROR: PyTorch/transformers not installed")
        return None

    # Step 1: Classify query
    classification = classify_query(query)
    print(f"\nQuery: {query}")
    print(f"Classification: {classification}")
    print(f"→ {get_router_explanation(query, classification)}")

    # Step 2: Retrieve context if needed
    context = ""
    if use_rag and classification in ("knowledge_rag", "hybrid"):
        if RAG_AVAILABLE:
            print("\nRetrieving knowledge from RAG corpus...")
            try:
                retriever = KnowledgeRetriever()
                results = retriever.retrieve(query, top_k=top_k)
                if results:
                    context = retriever.format_context(results)
                    print(f"Retrieved {len(results)} relevant chunks")
                else:
                    print("No relevant chunks found in RAG corpus")
            except Exception as e:
                print(f"RAG retrieval failed: {e}")
        else:
            print(f"RAG not available: {RAG_ERROR}")
            print("Proceeding without retrieved context")

    # Step 3: Build prompt
    prompt = build_prompt(query, context, classification)

    # Step 4: Load model and generate
    print(f"\nLoading model: {model_path}")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    print("Generating response...")
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Decode and extract only the assistant response
    full_text = tokenizer.decode(outputs[0], skip_special_tokens=False)

    # Extract response after assistant tag
    if "<|im_start|>assistant" in full_text:
        response = full_text.split("<|im_start|>assistant")[-1].strip()
        # Remove trailing end tokens
        response = response.replace("<|im_end|>", "").strip()
    else:
        response = full_text[len(prompt):].strip()

    return response


def main():
    parser = argparse.ArgumentParser(description="Hiran v2.3 Hybrid Inference")
    parser.add_argument("--model", required=True, help="Path to fine-tuned model")
    parser.add_argument("--query", required=True, help="Question to answer")
    parser.add_argument("--max_tokens", type=int, default=512, help="Max new tokens")
    parser.add_argument("--temperature", type=float, default=0.7, help="Temperature")
    parser.add_argument("--no_rag", action="store_true", help="Disable RAG, use FT only")
    parser.add_argument("--top_k", type=int, default=5, help="RAG chunks to retrieve")
    args = parser.parse_args()

    print("=" * 60)
    print("Hiran v2.3 Hybrid Inference")
    print("=" * 60)

    response = generate_response(
        model_path=args.model,
        query=args.query,
        max_new_tokens=args.max_tokens,
        temperature=args.temperature,
        use_rag=not args.no_rag,
        top_k=args.top_k,
    )

    if response:
        print(f"\n{'='*60}")
        print("RESPONSE")
        print(f"{'='*60}")
        print(response)
    else:
        print("Failed to generate response")


if __name__ == "__main__":
    main()
