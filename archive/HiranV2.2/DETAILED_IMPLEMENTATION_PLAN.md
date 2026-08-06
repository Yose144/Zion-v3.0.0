# Hiran v2.2 Podrobný Implementační Plán

## Executive Summary

Aktualizovaný detailní implementační plán pro Hiran v2.2 s multi-domain curriculum learning, dynamickým QLoRA a hybrid inference. Phase 1 je dokončena (5001 pairs, 0 quality issues). Plán zahrnuje detailní kroky, zdroje, dependencies a success criteria pro všechny 5 fází.

## Status Overview

| Fáze | Status | Trvání | Priority | Progress |
|------|--------|--------|----------|----------|
| **Phase 1: Dataset & Curriculum** | ✅ COMPLETED | 2-3 dny | P0 | 100% |
| **Phase 2: Training Pipeline** | 🔄 CODE READY — EXECUTION PENDING | 3-5 dní | P0 | ~85% |
| **Phase 3: Quantization** | ⏳ PENDING | 1 den | P1 | 0% |
| **Phase 4: Inference Testing** | ⏳ PENDING | 1-2 dny | P1 | 0% |
| **Phase 5: Deployment** | ⏳ PENDING | 1 den | P2 | 0% |

**Celkový timeline:** 8-12 dní (zbyvá 7-9 dní)

---

## Phase 1: Dataset & Curriculum ✅ COMPLETED

### 1.1 Co Bylo Dokončeno

#### Curriculum Pipeline
- ✅ `HiranV2.2/curriculum/curriculum_pipeline.py` - pipeline inicializace
- ✅ 5 curriculum stages: foundation, zion_core, zion_advanced, cross_domain, rag_synthesis
- ✅ Data distribution: foundation (1000+), zion_core (1500+), zion_advanced (1000+), cross_domain (1000+), rag_synthesis (500+)

#### Dataset Builder
- ✅ `HiranV2.2/data/build_dataset.py` - konverze v2.1 data + V3 docs scraping
- ✅ V2.1 data konverze z "messages" format na "instruction/output"
- ✅ V3 docs scraping (CLI_GUIDE.md, README.md, ROADMAP.md, DEPLOYMENT.md)
- ✅ Hallucination detection (fake URLs removal)
- ✅ Domain categorization

#### Validation & Cleanup
- ✅ `HiranV2.2/data/validate_dataset.py` - quality validation
- ✅ `HiranV2.2/data/cleanup_dataset.py` - duplicate removal & rebalancing
- ✅ `HiranV2.2/data/boost_dataset.py` - manual quality examples
- ✅ 0 quality issues, 0 duplicates

#### Final Dataset Statistics
```
Total pairs: 5,001 (target: 5000+) ✅
Distribution:
  - foundation: 1,021 pairs (target: 1000)
  - zion_core: 1,544 pairs (target: 1500)
  - zion_advanced: 891 pairs (target: 1000)
  - cross_domain: 1,033 pairs (target: 1000)
  - rag_synthesis: 512 pairs (target: 500)
Quality: 0 duplicates, 0 toxic content ✅
```

#### Files Created/Modified
- `HiranV2.2/curriculum/curriculum_pipeline.py`
- `HiranV2.2/data/build_dataset.py`
- `HiranV2.2/data/validate_dataset.py`
- `HiranV2.2/data/cleanup_dataset.py`
- `HiranV2.2/data/boost_dataset.py`
- `HiranV2.2/data/curriculum/*.jsonl` (5 files)

---

## Phase 2: Training Pipeline 🔄 CODE READY — EXECUTION PENDING (3-5 dní)

### 2.1 Architektura Training Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  Curriculum Learning System                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Stage 1    │    │   Stage 2    │    │   Stage 3    │  │
│  │ Foundation   │───▶│  ZION Core   │───▶│ ZION Advanced│  │
│  │ (rank: 16)   │    │ (rank: 32)   │    │ (rank: 32)   │  │
│  │ (epochs: 2)  │    │ (epochs: 3)  │    │ (epochs: 2)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              ▼                               │
│                     ┌──────────────┐                        │
│                     │   Stage 4    │                        │
│                     │Cross-Domain  │                        │
│                     │ (rank: 64)   │                        │
│                     │ (epochs: 2)  │                        │
│                     └──────────────┘                        │
│                              │                                │
│                              ▼                                │
│                     ┌──────────────┐                        │
│                     │   Stage 5    │                        │
│                     │RAG Synthesis │                        │
│                     │ (rank: 64)   │                        │
│                     │ (epochs: 1)  │                        │
│                     └──────────────┘                        │
│                              │                                │
│                              ▼                                │
│                    ┌──────────────────┐                      │
│                    │ Final LoRA Model │                      │
│                    └──────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Implementační Kroky

#### Krok 2.2.1: Dynamic QLoRA Configuration (0.5 dny)

**Cíl:** Implementovat dynamickou QLoRA konfiguraci podle curriculum fází.

**Soubory k vytvoření:**
- `HiranV2.2/config/dynamic_lora.py` - dynamická LoRA konfigurace
- `HiranV2.2/config/curriculum_config.json` - curriculum config

**Specifikace:**

```python
# HiranV2.2/config/dynamic_lora.py
from dataclasses import dataclass
from typing import Optional, List
import torch
from peft import LoraConfig, TaskType

@dataclass
class DynamicLoRAConfig:
    """Dynamická QLoRA konfigurace pro curriculum fázi"""
    stage: str
    rank: int
    alpha: int
    dropout: float
    target_modules: List[str]
    bias: str = "none"
    task_type: str = "CAUSAL_LM"
    
    # Training hyperparameters
    epochs: int = 2
    learning_rate: float = 2e-4
    batch_size: int = 4
    gradient_accumulation_steps: int = 4
    warmup_ratio: float = 0.03
    weight_decay: float = 0.01
    
    def to_peft_config(self) -> LoraConfig:
        """Konvertovat na PEFT LoraConfig"""
        return LoraConfig(
            r=self.rank,
            lora_alpha=self.alpha,
            lora_dropout=self.dropout,
            target_modules=self.target_modules,
            bias=self.bias,
            task_type=TaskType.CAUSAL_LM
        )

CURRICULUM_CONFIG = {
    "foundation": DynamicLoRAConfig(
        stage="foundation",
        rank=16,
        alpha=32,
        dropout=0.1,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        epochs=2,
        learning_rate=2e-4,
        batch_size=4
    ),
    "zion_core": DynamicLoRAConfig(
        stage="zion_core",
        rank=32,
        alpha=64,
        dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        epochs=3,
        learning_rate=1e-4,
        batch_size=4
    ),
    "zion_advanced": DynamicLoRAConfig(
        stage="zion_advanced",
        rank=32,
        alpha=64,
        dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        epochs=2,
        learning_rate=5e-5,
        batch_size=4
    ),
    "cross_domain": DynamicLoRAConfig(
        stage="cross_domain",
        rank=64,
        alpha=128,
        dropout=0.02,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        epochs=2,
        learning_rate=2e-5,
        batch_size=2
    ),
    "rag_synthesis": DynamicLoRAConfig(
        stage="rag_synthesis",
        rank=64,
        alpha=128,
        dropout=0.02,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        epochs=1,
        learning_rate=1e-5,
        batch_size=2
    )
}
```

**Dependencies:**
- peft>=0.6.0
- transformers>=4.35.0
- torch>=2.0.0

**Validation:**
- Test konfigurace pro všechny 5 fází
- Verifikace PEFT konverze
- Kontrola parameter counts

---

#### Krok 2.2.2: Multi-Stage Training Script (1.5 dny)

**Cíl:** Implementovat kompletní multi-stage training pipeline s curriculum learning.

**Soubory k vytvoření:**
- `HiranV2.2/scripts/train_v2.2.py` - hlavní training skript
- `HiranV2.2/scripts/data_loader.py` - dataset loader
- `HiranV2.2/scripts/trainer_utils.py` - training utilities

**Specifikace:**

```python
# HiranV2.2/scripts/train_v2.2.py
import argparse
import os
import json
from pathlib import Path
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset
from config.dynamic_lora import CURRICULUM_CONFIG

class CurriculumTrainer:
    def __init__(self, base_model: str, output_dir: str):
        self.base_model = base_model
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load tokenizer a model
        self.tokenizer = AutoTokenizer.from_pretrained(
            base_model,
            trust_remote_code=True
        )
        self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model v 4-bit pro QLoRA
        self.model = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=torch.float16,
            device_map="auto",
            quantization_config={
                "load_in_4bit": True,
                "bnb_4bit_compute_dtype": torch.float16,
                "bnb_4bit_use_double_quant": True,
                "bnb_4bit_quant_type": "nf4"
            }
        )
        
        # Prepare model for k-bit training
        self.model = prepare_model_for_kbit_training(self.model)
        
        # Training history
        self.training_history = {
            "stages": {},
            "total_steps": 0
        }
    
    def train_stage(
        self,
        stage: str,
        data_path: str,
        checkpoint_path: str = None
    ) -> str:
        """Trénovat jednu curriculum fázi"""
        print(f"\n{'='*60}")
        print(f"Training stage: {stage}")
        print(f"{'='*60}\n")
        
        # Get config pro stage
        config = CURRICULUM_CONFIG[stage]
        
        # Load data
        dataset = load_dataset("json", data_files=data_path, split="train")
        print(f"Loaded {len(dataset)} training examples")
        
        # Tokenize data
        tokenized_dataset = dataset.map(
            self._tokenize_function,
            batched=True,
            remove_columns=dataset.column_names,
            desc="Tokenizing dataset"
        )
        
        # Apply LoRA
        peft_config = config.to_peft_config()
        self.model = get_peft_model(self.model, peft_config)
        self.model.print_trainable_parameters()
        
        # Training arguments
        stage_output_dir = self.output_dir / stage
        training_args = TrainingArguments(
            output_dir=str(stage_output_dir),
            num_train_epochs=config.epochs,
            per_device_train_batch_size=config.batch_size,
            gradient_accumulation_steps=config.gradient_accumulation_steps,
            learning_rate=config.learning_rate,
            warmup_ratio=config.warmup_ratio,
            weight_decay=config.weight_decay,
            fp16=True,
            logging_steps=10,
            save_steps=100,
            save_total_limit=3,
            gradient_checkpointing=True,
            optim="paged_adamw_32bit",
            lr_scheduler_type="cosine",
            report_to=["tensorboard"],
            logging_dir=str(self.output_dir / "logs" / stage),
            load_best_model_at_end=False,
            ddp_find_unused_parameters=False
        )
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,
            pad_to_multiple_of=8
        )
        
        # Trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            data_collator=data_collator
        )
        
        # Train
        if checkpoint_path:
            print(f"Resuming from checkpoint: {checkpoint_path}")
            trainer.train(resume_from_checkpoint=checkpoint_path)
        else:
            trainer.train()
        
        # Save model
        final_path = str(stage_output_dir / "final")
        trainer.save_model(final_path)
        
        # Log metrics
        self.training_history["stages"][stage] = {
            "train_loss": trainer.state.log_history[-1].get("train_loss", 0),
            "steps": trainer.state.global_step
        }
        self.training_history["total_steps"] += trainer.state.global_step
        
        # Save history
        with open(self.output_dir / "training_history.json", "w") as f:
            json.dump(self.training_history, f, indent=2)
        
        print(f"\n✅ Stage {stage} completed!")
        print(f"   Model saved to: {final_path}")
        print(f"   Training steps: {trainer.state.global_step}")
        
        return final_path
    
    def _tokenize_function(self, examples):
        """Tokenize funkce s instruction formatting"""
        # Format: ### Instruction:\n{instruction}\n\n### Response:\n{output}
        texts = [
            f"### Instruction:\n{inst}\n\n### Response:\n{out}"
            for inst, out in zip(examples["instruction"], examples["output"])
        ]
        
        tokenized = self.tokenizer(
            texts,
            truncation=True,
            max_length=2048,
            padding="max_length",
            return_tensors=None
        )
        
        return tokenized

def main():
    parser = argparse.ArgumentParser(description="Train Hiran v2.2 with curriculum")
    parser.add_argument("--base_model", type=str, 
                       default="unsloth/Meta-Llama-3.1-8B-Instruct")
    parser.add_argument("--output_dir", type=str, 
                       default="HiranV2.2/checkpoints")
    parser.add_argument("--data_dir", type=str, 
                       default="HiranV2.2/data/curriculum")
    parser.add_argument("--stages", nargs="+", 
                       default=["foundation", "zion_core", "zion_advanced", 
                               "cross_domain", "rag_synthesis"])
    parser.add_argument("--resume_stage", type=str, default=None,
                       help="Resume from specific stage")
    
    args = parser.parse_args()
    
    trainer = CurriculumTrainer(args.base_model, args.output_dir)
    
    # Train stages sequentially
    checkpoint = None
    start_training = not args.resume_stage
    
    for stage in args.stages:
        if not start_training:
            if stage == args.resume_stage:
                start_training = True
            else:
                print(f"Skipping stage {stage} (resuming from {args.resume_stage})")
                continue
        
        data_path = os.path.join(args.data_dir, f"{stage}.jsonl")
        
        if not os.path.exists(data_path):
            print(f"⚠️  Warning: Data file not found for stage {stage}: {data_path}")
            continue
        
        checkpoint = trainer.train_stage(stage, data_path, checkpoint)
    
    print("\n" + "="*60)
    print("🎉 All curriculum stages completed!")
    print(f"📊 Total training steps: {trainer.training_history['total_steps']}")
    print(f"💾 Final model: {checkpoint}")
    print("="*60)

if __name__ == "__main__":
    main()
```

**Dependencies:**
- transformers>=4.35.0
- peft>=0.6.0
- bitsandbytes>=0.41.0
- datasets>=2.14.0
- torch>=2.0.0
- accelerate>=0.24.0
- tensorboard

**Validation:**
- Test training na single stage
- Verifikace checkpoint resumption
- Monitor memory usage
- Test gradient accumulation

---

#### Krok 2.2.3: Evaluation Protocol (1 den)

**Cíl:** Implementovat komplexní evaluation protokol s domain-specific metrics.

**Soubory k vytvoření:**
- `HiranV2.2/evaluate/evaluate_v2.2.py` - evaluation skript
- `HiranV2.2/evaluate/metrics.py` - custom metrics
- `HiranV2.2/evaluate/benchmark_dataset.py` - benchmark dataset generator

**Specifikace:**

```python
# HiranV2.2/evaluate/evaluate_v2.2.py
import torch
import json
import numpy as np
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import load_dataset
from typing import Dict, List, Tuple
from tqdm import tqdm

class ModelEvaluator:
    def __init__(self, model_path: str, base_model: str = None):
        if base_model:
            self.tokenizer = AutoTokenizer.from_pretrained(base_model)
        else:
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.tokenizer.pad_token = self.tokenizer.eos_token
        
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        self.model.eval()
        
        self.results = {}
    
    def calculate_perplexity(self, dataset_path: str, sample_size: int = 100) -> Dict:
        """Vypočítat perplexity na validation setu"""
        print("Calculating perplexity...")
        
        dataset = load_dataset("json", data_files=dataset_path, split="train")
        dataset = dataset.shuffle(seed=42).select(range(min(sample_size, len(dataset))))
        
        total_loss = 0
        total_tokens = 0
        
        with torch.no_grad():
            for item in tqdm(dataset, desc="Computing perplexity"):
                text = f"### Instruction:\n{item['instruction']}\n\n### Response:\n{item['output']}"
                inputs = self.tokenizer(
                    text,
                    return_tensors="pt",
                    truncation=True,
                    max_length=2048
                ).to(self.model.device)
                
                outputs = self.model(**inputs, labels=inputs["input_ids"])
                loss = outputs.loss
                
                total_loss += loss.item() * inputs["input_ids"].size(1)
                total_tokens += inputs["input_ids"].size(1)
        
        avg_loss = total_loss / total_tokens
        perplexity = np.exp(avg_loss)
        
        return {
            "perplexity": perplexity,
            "avg_loss": avg_loss,
            "total_tokens": total_tokens
        }
    
    def evaluate_domain_accuracy(
        self, 
        test_data: List[Dict],
        sample_size: int = 50
    ) -> Dict[str, Dict]:
        """Evaluaovat domain-specific accuracy"""
        print("Evaluating domain accuracy...")
        
        results = {}
        sampled_data = test_data[:sample_size] if len(test_data) > sample_size else test_data
        
        for item in tqdm(sampled_data, desc="Domain evaluation"):
            domain = item.get("domain", "general")
            instruction = item["instruction"]
            expected_output = item["output"]
            
            # Generate response
            generated = self.generate_response(instruction, max_tokens=256)
            
            # Calculate metrics
            accuracy = self._calculate_accuracy(generated, expected_output)
            rouge_score = self._calculate_rouge(generated, expected_output)
            
            if domain not in results:
                results[domain] = {"accuracies": [], "rouge_scores": []}
            results[domain]["accuracies"].append(accuracy)
            results[domain]["rouge_scores"].append(rouge_score)
        
        # Aggregate results
        aggregated = {}
        for domain, metrics in results.items():
            aggregated[domain] = {
                "accuracy": np.mean(metrics["accuracies"]),
                "accuracy_std": np.std(metrics["accuracies"]),
                "rouge_l": np.mean([m["rouge_l"] for m in metrics["rouge_scores"]]),
                "rouge_1": np.mean([m["rouge_1"] for m in metrics["rouge_scores"]]),
                "samples": len(metrics["accuracies"])
            }
        
        return aggregated
    
    def evaluate_cross_domain_transfer(
        self,
        test_data: List[Dict],
        sample_size: int = 30
    ) -> Dict:
        """Evaluaovat cross-domain transfer learning"""
        print("Evaluating cross-domain transfer...")
        
        # Group by domain
        domain_groups = {}
        for item in test_data:
            domain = item.get("domain", "general")
            if domain not in domain_groups:
                domain_groups[domain] = []
            domain_groups[domain].append(item)
        
        # Evaluate each domain
        transfer_scores = {}
        for target_domain, items in domain_groups.items():
            sampled = items[:sample_size] if len(items) > sample_size else items
            
            accuracies = []
            for item in tqdm(sampled, desc=f"Evaluating {target_domain}"):
                generated = self.generate_response(item["instruction"])
                accuracy = self._calculate_accuracy(generated, item["output"])
                accuracies.append(accuracy)
            
            transfer_scores[target_domain] = {
                "accuracy": np.mean(accuracies),
                "std": np.std(accuracies),
                "samples": len(accuracies)
            }
        
        return transfer_scores
    
    def generate_response(
        self, 
        instruction: str, 
        max_tokens: int = 256,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> str:
        """Generovat response"""
        prompt = f"### Instruction:\n{instruction}\n\n### Response:\n"
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048
        ).to(self.model.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response[len(prompt):]
    
    def _calculate_accuracy(self, generated: str, expected: str) -> float:
        """Jednoduchá accuracy metrika (word overlap)"""
        expected_words = set(expected.lower().split())
        generated_words = set(generated.lower().split())
        
        if not expected_words:
            return 0.0
        
        overlap = expected_words & generated_words
        return len(overlap) / len(expected_words)
    
    def _calculate_rouge(self, generated: str, expected: str) -> Dict:
        """ROUGE score (jednoduchá implementace)"""
        # Jednoduchá ROUGE-L implementace (LCS)
        def lcs_length(x, y):
            m, n = len(x), len(y)
            dp = [[0] * (n + 1) for _ in range(m + 1)]
            for i in range(m + 1):
                for j in range(n + 1):
                    if i == 0 or j == 0:
                        dp[i][j] = 0
                    elif x[i-1] == y[j-1]:
                        dp[i][j] = dp[i-1][j-1] + 1
                    else:
                        dp[i][j] = max(dp[i-1][j], dp[i][j-1])
            return dp[m][n]
        
        gen_words = generated.lower().split()
        exp_words = expected.lower().split()
        
        lcs = lcs_length(gen_words, exp_words)
        precision = lcs / len(gen_words) if len(gen_words) > 0 else 0
        recall = lcs / len(exp_words) if len(exp_words) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            "rouge_l": f1,
            "rouge_1": recall  # Simplified ROUGE-1
        }
    
    def generate_evaluation_report(self, output_path: str):
        """Generovat evaluation report"""
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"Evaluation report saved to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Evaluate Hiran v2.2")
    parser.add_argument("--model_path", type=str, 
                       default="HiranV2.2/checkpoints/rag_synthesis/final")
    parser.add_argument("--test_data", type=str,
                       default="HiranV2.2/data/curriculum")
    parser.add_argument("--output", type=str,
                       default="HiranV2.2/evaluation_report.json")
    parser.add_argument("--sample_size", type=int, default=50)
    
    args = parser.parse_args()
    
    evaluator = ModelEvaluator(args.model_path)
    
    # Load test data ze všech fází
    test_data = []
    test_dir = Path(args.test_data)
    for stage_file in test_dir.glob("*.jsonl"):
        with open(stage_file, 'r') as f:
            for line in f:
                item = json.loads(line)
                item["domain"] = stage_file.stem
                test_data.append(item)
    
    # Perplexity evaluation
    perplexity_results = evaluator.calculate_perplexity(
        test_dir / "foundation.jsonl",
        sample_size=args.sample_size
    )
    evaluator.results["perplexity"] = perplexity_results
    
    # Domain accuracy
    domain_results = evaluator.evaluate_domain_accuracy(test_data, args.sample_size)
    evaluator.results["domain_accuracy"] = domain_results
    
    # Cross-domain transfer
    transfer_results = evaluator.evaluate_cross_domain_transfer(test_data, args.sample_size)
    evaluator.results["cross_domain_transfer"] = transfer_results
    
    # Generate report
    evaluator.generate_evaluation_report(args.output)
    
    # Print summary
    print("\n" + "="*60)
    print("EVALUATION SUMMARY")
    print("="*60)
    print(f"\nPerplexity: {perplexity_results['perplexity']:.2f}")
    print("\nDomain Accuracy:")
    for domain, metrics in domain_results.items():
        print(f"  {domain}: {metrics['accuracy']:.2f} (±{metrics['accuracy_std']:.2f})")
    print("\nCross-Domain Transfer:")
    for domain, metrics in transfer_results.items():
        print(f"  {domain}: {metrics['accuracy']:.2f}")

if __name__ == "__main__":
    main()
```

**Dependencies:**
- transformers>=4.35.0
- torch>=2.0.0
- datasets>=2.14.0
- numpy
- tqdm
- rouge-score (optional, pro lepší ROUGE)

**Validation:**
- Test perplexity calculation
- Test domain accuracy na malém datasetu
- Verifikace cross-domain transfer
- Test report generation

---

#### Krok 2.2.4: Training Execution (1 den)

**Cíl:** Spustit kompletní curriculum training na Vast.ai nebo lokálně.

**Procedura:**

1. **Environment Setup**
   ```bash
   # Na Vast.ai (RTX 4090 nebo A100)
   conda create -n hiran-v2.2 python=3.10
   conda activate hiran-v2.2
   pip install torch transformers peft bitsandbytes datasets accelerate tensorboard
   ```

2. **Data Upload**
   ```bash
   # Upload curriculum data
   scp -r HiranV2.2/data/curriculum user@vast:/workspace/
   ```

3. **Training Execution**
   ```bash
   # Sync curriculum + scripts to a new Vast instance (set VAST_SSH, VAST_PORT, SSH_IDENTITY)
   bash HiranV2.2/scripts/sync_curriculum_to_vast.sh

   # On instance (after pip install -r requirements-train.txt):
   python3 scripts/train_v2.2.py \
       --base_model unsloth/Meta-Llama-3.1-8B-Instruct \
       --output_dir /workspace/checkpoints \
       --data_dir /workspace/hiran-v2.2/data/curriculum \
       --stages foundation zion_core zion_advanced cross_domain rag_synthesis \
       --tensorboard --logging_steps 20
   ```

4. **Monitoring**
   ```bash
   # TensorBoard monitoring
   tensorboard --logdir /workspace/checkpoints/logs --port 6006
   ```

**Resources:**
- GPU: RTX 4090 (24GB) nebo A100 (40GB)
- RAM: 64GB+
- Storage: 100GB+
- Čas: ~12-24 hodin (depends na GPU)

**Expected Outputs:**
- 5 checkpoint directories (jedna pro každou fázi)
- Training history JSON
- TensorBoard logs
- Final LoRA adapter ve `rag_synthesis/final`

---

### Phase 2 Deliverables

- [x] Dynamic QLoRA configuration (`HiranV2.2/config/dynamic_lora.py`, `curriculum_config.json`)
- [x] Multi-stage training script (`HiranV2.2/scripts/train_v2.2.py`, `data_loader.py`, `trainer_utils.py`)
- [x] Evaluation protocol (initial: `HiranV2.2/evaluate/evaluate_v2.2.py`, `metrics.py`)
- [ ] Training execution a monitoring (TensorBoard: `--tensorboard`; sync: `scripts/sync_curriculum_to_vast.sh`)
- [ ] Trained LoRA model
- [ ] Evaluation report (full benchmark suite)

**Success Criteria:**
- ✅ Dataset > 5000 pairs
- [ ] Perplexity < 1.5 (validation set)
- [ ] Cross-domain accuracy > 75%
- [ ] Training convergence bez divergence

---

## Phase 3: Quantization ⏳ PENDING (1 den)

### 3.1 Quantization Strategy

**Cíl:** Implementovat hybrid quantization strategy pro různé deployment scenarios.

**Varianty:**
- **Q4_K_M** (4.5 bits) - Edge devices, CPU-only inference
- **Q5_K_M** (5.5 bits) - Balanced quality/size
- **Q8_0** (8 bits) - High quality inference

### 3.2 Implementační Kroky

#### Krok 3.2.1: GGUF Quantization (0.5 dny)

**Soubory k vytvoření:**
- `HiranV2.2/quantization/convert_to_gguf.py` - HF → GGUF conversion
- `HiranV2.2/quantization/quantize_gguf.py` - GGUF quantization

**Specifikace:**

```python
# HiranV2.2/quantization/quantize_gguf.py
import subprocess
from pathlib import Path

class GGUFQuantizer:
    def __init__(self, model_path: str, output_dir: str = "HiranV2.2/models"):
        self.model_path = Path(model_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def convert_to_gguf(self) -> Path:
        """Convert HF model do GGUF format"""
        print("Converting HF model to GGUF...")
        
        gguf_path = self.output_dir / "hiran-v2.2-f16.gguf"
        
        cmd = [
            "python3",
            "llama.cpp/convert_hf_to_gguf.py",
            str(self.model_path),
            "--outfile",
            str(gguf_path),
            "--outtype",
            "f16"
        ]
        
        subprocess.run(cmd, check=True)
        print(f"✅ GGUF model saved to {gguf_path}")
        return gguf_path
    
    def quantize(self, gguf_path: Path, quant_type: str = "q5_k_m") -> Path:
        """Quantize GGUF model"""
        print(f"Quantizing to {quant_type}...")
        
        output_path = self.output_dir / f"hiran-v2.2-{quant_type}.gguf"
        
        cmd = [
            "./llama.cpp/quantize",
            str(gguf_path),
            str(output_path),
            quant_type
        ]
        
        subprocess.run(cmd, check=True)
        print(f"✅ Quantized model saved to {output_path}")
        return output_path
    
    def create_all_variants(self, f16_path: Path):
        """Vytvořit všechny quantization varianty"""
        variants = [
            ("q4_k_m", "efficient (CPU/edge)"),
            ("q5_k_m", "balanced (GPU inference)"),
            ("q8_0", "high_quality (GPU)")
        ]
        
        for quant_type, description in variants:
            print(f"\n{'='*50}")
            print(f"Creating {description} variant ({quant_type})")
            print(f"{'='*50}")
            self.quantize(f16_path, quant_type)
        
        print(f"\n✅ All variants created in {self.output_dir}")

def main():
    quantizer = GGUFQuantizer(
        "HiranV2.2/checkpoints/rag_synthesis/final",
        "HiranV2.2/models"
    )
    
    # Convert to GGUF
    f16_path = quantizer.convert_to_gguf()
    
    # Create all variants
    quantizer.create_all_variants(f16_path)

if __name__ == "__main__":
    main()
```

**Dependencies:**
- llama.cpp (build z source)
- Python 3.10+

---

#### Krok 3.2.2: ONNX Conversion (0.5 dny)

**Soubory k vytvoření:**
- `HiranV2.2/quantization/convert_to_onnx.py` - HF → ONNX conversion

**Specifikace:**

```python
# HiranV2.2/quantization/convert_to_onnx.py
from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer
from pathlib import Path

def convert_to_onnx(model_path: str, output_dir: str = "HiranV2.2/models"):
    """Convert HF model do ONNX format"""
    print("Converting HF model to ONNX...")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Load model a tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    
    # Convert do ONNX
    model = ORTModelForCausalLM.from_pretrained(
        model_path,
        export=True
    )
    
    # Save ONNX model
    onnx_path = output_path / "hiran-v2.2-onnx"
    model.save_pretrained(onnx_path)
    tokenizer.save_pretrained(onnx_path)
    
    print(f"✅ ONNX model saved to {onnx_path}")
    return onnx_path

if __name__ == "__main__":
    convert_to_onnx("HiranV2.2/checkpoints/rag_synthesis/final")
```

**Dependencies:**
- optimum[onnxruntime]>=1.14.0
- onnxruntime>=1.16.0

---

### Phase 3 Deliverables

- [ ] GGUF quantization skript
- [ ] ONNX conversion skript
- [ ] 3 GGUF variants (Q4_K_M, Q5_K_M, Q8_0)
- [ ] ONNX model
- [ ] Quantization validation

**Success Criteria:**
- [ ] Model size < 8GB (Q4_K_M)
- [ ] Model size < 10GB (Q5_K_M)
- [ ] Inference compatibility test
- [ ] Quality retention > 90% (vs. FP16)

---

## Phase 4: Inference Testing ⏳ PENDING (1-2 dny)

### 4.1 Multi-Backend Testing Strategy

**Cíl:** Testovat inference na různých backends a platformách.

### 4.2 Implementační Kroky

#### Krok 4.2.1: Backend Testing (0.5 dny)

**Soubory k vytvoření:**
- `HiranV2.2/inference/test_backends.py` - backend testing skript

**Specifikace:**

```python
# HiranV2.2/inference/test_backends.py
import subprocess
import time
import json
from pathlib import Path
from enum import Enum
from typing import Dict, List

class InferenceBackend(Enum):
    LLAMA_CPP = "llama_cpp"
    TRANSFORMERS = "transformers"
    ONNX = "onnx"

class BackendTester:
    def __init__(self, model_variants: Dict[InferenceBackend, str]):
        self.model_variants = model_variants
        self.results = {}
        self.test_prompts = [
            "Explain ZION consensus mechanism",
            "What is Ekam Deeksha mining?",
            "How does the ZION CLI work?",
            "Describe the ZION Oasis game concept",
            "What is DharmaScore in ZION?"
        ]
    
    def test_llama_cpp(self, model_path: str) -> Dict:
        """Testovat llama.cpp backend"""
        print(f"Testing llama.cpp backend...")
        
        latencies = []
        outputs = []
        
        for prompt in self.test_prompts:
            start_time = time.time()
            
            cmd = [
                "./llama.cpp/build/bin/llama-cli",
                "-m", model_path,
                "-p", prompt,
                "-n", 100,
                "-ngl", "99",
                "--silent"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            latency = time.time() - start_time
            
            latencies.append(latency)
            outputs.append(result.stdout if result.returncode == 0 else "ERROR")
        
        return {
            "backend": "llama_cpp",
            "avg_latency": sum(latencies) / len(latencies),
            "min_latency": min(latencies),
            "max_latency": max(latencies),
            "success_rate": sum(1 for o in outputs if o != "ERROR") / len(outputs),
            "avg_output_length": sum(len(o) for o in outputs) / len(outputs)
        }
    
    def test_transformers(self, model_path: str) -> Dict:
        """Testovat transformers backend"""
        print(f"Testing transformers backend...")
        
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM
        
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        model.eval()
        
        latencies = []
        outputs = []
        
        with torch.no_grad():
            for prompt in self.test_prompts:
                start_time = time.time()
                
                inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
                generated = model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True
                )
                output = tokenizer.decode(generated[0], skip_special_tokens=True)
                
                latency = time.time() - start_time
                
                latencies.append(latency)
                outputs.append(output)
        
        return {
            "backend": "transformers",
            "avg_latency": sum(latencies) / len(latencies),
            "min_latency": min(latencies),
            "max_latency": max(latencies),
            "success_rate": 1.0,
            "avg_output_length": sum(len(o) for o in outputs) / len(outputs)
        }
    
    def test_onnx(self, model_path: str) -> Dict:
        """Testovat ONNX backend"""
        print(f"Testing ONNX backend...")
        
        try:
            from optimum.onnxruntime import ORTModelForCausalLM
            from transformers import AutoTokenizer
            
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            model = ORTModelForCausalLM.from_pretrained(model_path)
            
            latencies = []
            outputs = []
            
            for prompt in self.test_prompts:
                start_time = time.time()
                
                inputs = tokenizer(prompt, return_tensors="pt")
                generated = model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True
                )
                output = tokenizer.decode(generated[0], skip_special_tokens=True)
                
                latency = time.time() - start_time
                
                latencies.append(latency)
                outputs.append(output)
            
            return {
                "backend": "onnx",
                "avg_latency": sum(latencies) / len(latencies),
                "min_latency": min(latencies),
                "max_latency": max(latencies),
                "success_rate": 1.0,
                "avg_output_length": sum(len(o) for o in outputs) / len(outputs)
            }
        except Exception as e:
            return {
                "backend": "onnx",
                "error": str(e),
                "success_rate": 0.0
            }
    
    def benchmark_all(self) -> Dict:
        """Benchmark všechny backends"""
        for backend, model_path in self.model_variants.items():
            if backend == InferenceBackend.LLAMA_CPP:
                self.results[backend.value] = self.test_llama_cpp(model_path)
            elif backend == InferenceBackend.TRANSFORMERS:
                self.results[backend.value] = self.test_transformers(model_path)
            elif backend == InferenceBackend.ONNX:
                self.results[backend.value] = self.test_onnx(model_path)
        
        return self.results
    
    def generate_report(self, output_path: str):
        """Generovat benchmark report"""
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"Benchmark report saved to {output_path}")

def main():
    model_variants = {
        InferenceBackend.LLAMA_CPP: "HiranV2.2/models/hiran-v2.2-q5_k_m.gguf",
        InferenceBackend.TRANSFORMERS: "HiranV2.2/checkpoints/rag_synthesis/final",
        InferenceBackend.ONNX: "HiranV2.2/models/hiran-v2.2-onnx"
    }
    
    tester = BackendTester(model_variants)
    results = tester.benchmark_all()
    
    # Print summary
    print("\n" + "="*60)
    print("INFERENCE BENCHMARK RESULTS")
    print("="*60)
    for backend, metrics in results.items():
        print(f"\n{backend.upper()}:")
        if "error" in metrics:
            print(f"  ❌ Error: {metrics['error']}")
        else:
            print(f"  Avg latency: {metrics['avg_latency']:.2f}s")
            print(f"  Min latency: {metrics['min_latency']:.2f}s")
            print(f"  Max latency: {metrics['max_latency']:.2f}s")
            print(f"  Success rate: {metrics['success_rate']*100:.1f}%")
    
    # Save report
    tester.generate_report("HiranV2.2/inference_benchmark.json")

if __name__ == "__main__":
    main()
```

---

#### Krok 4.2.2: Platform Testing (0.5 dny)

**Testovací platformy:**
- Local (macOS M1/M2, Linux x86_64)
- Vast.ai (RTX 3060, RTX 4090, A100)
- Edge devices (Raspberry Pi, Jetson)

---

#### Krok 4.2.3: Memory Analysis (0.5 dny)

**Metriky:**
- GPU memory usage
- CPU memory usage
- Model size
- Peak memory během inference

---

### Phase 4 Deliverables

- [ ] Multi-backend testing skript
- [ ] Platform compatibility test
- [ ] Memory footprint analysis
- [ ] Benchmark report
- [ ] Inference optimization recommendations

**Success Criteria:**
- [ ] Inference latency < 2s (CPU, Q5_K_M)
- [ ] Inference latency < 100ms (GPU, Q8_0)
- [ ] Memory footprint < 8GB (Q4_K_M)
- [ ] 3+ backend support

---

## Phase 5: Deployment ⏳ PENDING (1 den)

### 5.1 Deployment Strategy

**Scénáře:**
- **Vast.ai Cloud** - GPU-accelerated inference
- **Local** - CPU/GPU inference
- **Docker** - Containerized deployment
- **Edge** - CPU-only inference

### 5.2 Implementační Kroky

#### Krok 5.2.1: Vast.ai Deployment (0.3 dny)

**Soubory k vytvoření:**
- `HiranV2.2/deploy/deploy_vast.sh` - Vast.ai deployment skript

**Specifikace:**

```bash
#!/bin/bash
# HiranV2.2/deploy/deploy_vast.sh

set -e

VAST_HOST="${VAST_HOST:-root@ssh5.vast.ai}"
VAST_PORT="${VAST_PORT:-31284}"
MODEL_PATH="HiranV2.2/models/hiran-v2.2-q5_k_m.gguf"
REMOTE_PATH="/root/hiran-v2.2-q5_k_m.gguf"

echo "🚀 Deploying Hiran v2.2 to Vast.ai..."
echo "Host: $VAST_HOST:$VAST_PORT"

# Upload model
echo "📤 Uploading model..."
scp -i ~/.ssh/vast_ai_key -P "$VAST_PORT" "$MODEL_PATH" "$VAST_HOST:$REMOTE_PATH"

# Setup inference service
echo "🔧 Setting up inference service..."
ssh -i ~/.ssh/vast_ai_key -p "$VAST_PORT" "$VAST_HOST" << 'ENDSSH'
cd /workspace/llama.cpp/build/bin
nohup ./llama-server \
  -m /root/hiran-v2.2-q5_k_m.gguf \
  --host 0.0.0.0 \
  --port 8002 \
  --ngl 99 \
  --ctx-size 4096 \
  > /root/hiran-server.log 2>&1 &
echo $! > /root/hiran-server.pid
echo "Server started with PID $(cat /root/hiran-server.pid)"
ENDSSH

echo "✅ Deployment complete!"
echo "Server URL: http://$VAST_HOST:8002"
echo "Logs: ssh $VAST_HOST 'tail -f /root/hiran-server.log'"
```

---

#### Krok 5.2.2: Docker Deployment (0.3 dny)

**Soubory k vytvoření:**
- `HiranV2.2/deploy/Dockerfile` - Docker image
- `HiranV2.2/deploy/docker-compose.yml` - Docker compose config

**Specifikace:**

```dockerfile
# HiranV2.2/deploy/Dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    git build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone a build llama.cpp
RUN git clone https://github.com/ggerganov/llama.cpp.git
RUN cd llama.cpp && make LLAMA_CUBLAS=1

# Copy model
COPY HiranV2.2/models/hiran-v2.2-q5_k_m.gguf /app/model.gguf

# Start server
CMD ["/app/llama.cpp/build/bin/llama-server", \
     "-m", "/app/model.gguf", \
     "--host", "0.0.0.0", \
     "--port", "8002", \
     "--ngl", "99"]
```

```yaml
# HiranV2.2/deploy/docker-compose.yml
version: '3.8'

services:
  hiran-v2.2:
    build: .
    ports:
      - "8002:8002"
    environment:
      - CUDA_VISIBLE_DEVICES=0
    volumes:
      - ./models:/app/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

---

#### Krok 5.2.3: Documentation (0.4 dny)

**Soubory k vytvoření:**
- `HiranV2.2/docs/DEPLOYMENT.md` - deployment guide
- `HiranV2.2/docs/INFERENCE.md` - inference guide
- `HiranV2.2/README.md` - overview

**Specifikace:**

```markdown
# Hiran v2.2 Deployment Guide

## Quick Start

### Vast.ai Deployment
```bash
bash HiranV2.2/deploy/deploy_vast.sh
```

### Docker Deployment
```bash
cd HiranV2.2/deploy
docker-compose up -d
```

### Local Inference
```bash
./llama.cpp/build/bin/llama-cli \
  -m HiranV2.2/models/hiran-v2.2-q5_k_m.gguf \
  -p "Explain ZION consensus" \
  -n 100
```

## Model Variants

| Variant | Size | Use Case |
|---------|------|----------|
| Q4_K_M | ~5GB | Edge devices, CPU-only |
| Q5_K_M | ~6GB | Balanced quality/size |
| Q8_0 | ~9GB | High quality inference |

## API Endpoints

### HTTP API (llama-server)
- POST `/completion` - text completion
- POST `/chat/completions` - chat completions
- GET `/health` - health check

## Performance

- Q4_K_M (CPU): ~2-5s latency
- Q5_K_M (GPU): ~50-100ms latency
- Q8_0 (GPU): ~30-80ms latency
```

---

### Phase 5 Deliverables

- [ ] Vast.ai deployment skript
- [ ] Docker deployment config
- [ ] Deployment documentation
- [ ] Inference documentation
- [ ] README update
- [ ] Git commit a release

**Success Criteria:**
- [ ] Vast.ai deployment successful
- [ ] Docker deployment successful
- [ ] Documentation complete
- [ ] Release tagged v2.2.0

---

## Resource Requirements

### Training Resources
- **GPU:** RTX 4090 (24GB) nebo A100 (40GB)
- **RAM:** 64GB+
- **Storage:** 100GB+
- **Čas:** 12-24 hodin
- **Cost:** ~$5-10/day na Vast.ai

### Inference Resources
- **CPU:** 8+ cores, 32GB RAM (Q4_K_M)
- **GPU:** 8GB+ VRAM (Q5_K_M, Q8_0)
- **Storage:** 10GB+
- **Latency:** 50ms-5s (depends na variant)

### Storage Requirements
- **Training data:** ~50MB (curriculum)
- **Checkpoints:** ~5GB (LoRA adapters)
- **Quantized models:**
  - Q4_K_M: ~5GB
  - Q5_K_M: ~6GB
  - Q8_0: ~9GB
- **Total:** ~25GB

---

## Success Criteria

### Primární metriky
- [x] Dataset size > 5000 pairs ✅
- [ ] Perplexity < 1.5 (validation set)
- [ ] Cross-domain accuracy > 75%
- [ ] Inference latency < 100ms (GPU)
- [ ] Memory footprint < 8GB (Q4_K_M)

### Sekundární metriky
- [ ] Multi-backend support (3+ backends)
- [ ] Platform coverage (cloud + edge + local)
- [ ] Documentation completeness
- [ ] Deployment automation

### Quality metriky
- [ ] Zero hallucinations v test set
- [ ] RAG integration capability
- [ ] Multi-language support (CZ/EN)
- [ ] Consistent output quality

---

## Timeline & Milestones

### Week 1 (Current)
- **Day 1:** Phase 1 ✅ COMPLETED
- **Day 2-3:** Phase 2 - Training Pipeline
- **Day 4:** Phase 3 - Quantization
- **Day 5:** Phase 4 - Inference Testing

### Week 2
- **Day 6:** Phase 5 - Deployment
- **Day 7:** Documentation a Release

---

## Risk Management

### Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Training divergence | Medium | High | Use gradient checkpointing, lower LR |
| Memory OOM | Medium | High | Use smaller batch size, gradient accumulation |
| Quantization quality loss | Low | Medium | Test multiple quant types, keep F16 backup |
| Inference latency too high | Low | Medium | Optimize backends, use smaller model variants |

### Operational Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Vast.ai GPU unavailability | Medium | High | Have backup GPU providers, local training option |
| Dataset quality issues | Low | Medium | Comprehensive validation, manual review |
| Integration failures | Low | Medium | Thorough testing, rollback procedures |

---

## Next Actions

### IMMEDIATE (Dnes)
- [x] Phase 1 completion ✅
- [x] Phase 2 scaffold: dynamic LoRA, `train_v2.2.py`, eval, `sync_curriculum_to_vast.sh`, TensorBoard flag
- [ ] Nová Vast instance (≥100 GB) + první plný curriculum běh

### SHORT-TERM (Zítra)
- [ ] Implementovat multi-stage training script
- [ ] Implementovat evaluation protocol
- [ ] Spustit foundation stage training

### MEDIUM-TERM (Tento týden)
- [ ] Dokončit všechny curriculum stages
- [ ] Spustit evaluation protokol
- [ ] Implementovat quantization

### LONG-TERM (Příští týden)
- [ ] Multi-backend testing
- [ ] Deployment na production
- [ ] Documentation a release

---

## Appendix: Technical Details

### A. Curriculum Configuration Details

| Stage | Rank | Alpha | Dropout | Epochs | LR | Batch Size |
|-------|------|-------|---------|--------|-----|------------|
| foundation | 16 | 32 | 0.1 | 2 | 2e-4 | 4 |
| zion_core | 32 | 64 | 0.05 | 3 | 1e-4 | 4 |
| zion_advanced | 32 | 64 | 0.05 | 2 | 5e-5 | 4 |
| cross_domain | 64 | 128 | 0.02 | 2 | 2e-5 | 2 |
| rag_synthesis | 64 | 128 | 0.02 | 1 | 1e-5 | 2 |

### B. Dataset Distribution

| Stage | Pairs | Target | Status |
|-------|-------|--------|--------|
| foundation | 1,021 | 1,000 | ✅ |
| zion_core | 1,544 | 1,500 | ✅ |
| zion_advanced | 891 | 1,000 | ⚠️ |
| cross_domain | 1,033 | 1,000 | ✅ |
| rag_synthesis | 512 | 500 | ✅ |

### C. Model Selection

**Base Model:** Meta-Llama-3.1-8B-Instruct
- 8B parameters
- Instruction-tuned
- Strong multilingual capability
- Compatible s QLoRA

**Alternativy:**
- Mistral-7B-Instruct (smaller, faster)
- Qwen-7B-Chat (strong CJK support)
- Phi-3-Mini (4B, very efficient)

---

**Status:** Detailed Implementation Plan  
**Created:** 2026-05-12  
**Updated:** 2026-05-12 (Phase 2 training scaffold: config + scripts + evaluate)  
**Author:** Devin (ZION AI Team)  
**Version:** 2.0
