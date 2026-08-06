# Hiran v2.2 Training Implementation Plan

## Executive Summary

Komplexní implementační plán pro Hiran v2.2 trénink s multi-domain curriculum learning, dynamickým QLoRA a hybrid inference. Plán je rozdělen do 5 fází s konkrétními deliverables a timeline.

## Timeline Overview

| Fáze | Trvání | Status | Priority |
|------|--------|--------|----------|
| Fáze 1: Dataset & Curriculum | 2-3 dny | ✅ COMPLETED | P0 |
| Fáze 2: Training Pipeline | 3-5 dní | 🔄 IN PROGRESS | P0 |
| Fáze 3: Quantization | 1 den | ⏳ Waiting | P1 |
| Fáze 4: Inference Testing | 1-2 dny | ⏳ Waiting | P1 |
| Fáze 5: Deployment | 1 den | ⏳ Waiting | P2 |

**Celkový timeline:** 8-12 dní

---

## Fáze 1: Dataset & Curriculum Preparation (2-3 dny)

### 1.1 Curriculum Pipeline Design

**Cíl:** Vytvořit strukturovaný curriculum learning pipeline s 5 fázemi.

**Deliverables:**
- [x] `HiranV2.2/curriculum/curriculum_pipeline.py` - hlavní pipeline
- [x] `HiranV2.2/curriculum/stages/` - definice jednotlivých fází
- [x] `HiranV2.2/curriculum/config/` - konfigurace pro každou fázi

**Implementace:**

```python
# HiranV2.2/curriculum/curriculum_pipeline.py
from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Tuple
import json

class CurriculumStage(Enum):
    FOUNDATION = "foundation"      # Obecné znalosti
    ZION_CORE = "zion_core"        # ZION specifické koncepty
    ZION_ADVANCED = "zion_advanced" # Pokročilé ZION témata
    CROSS_DOMAIN = "cross_domain"  # Vícenásobné domény
    RAG_SYNTHESIS = "rag_synthesis" # Syntéza s RAG kontextem

@dataclass
class StageConfig:
    stage: CurriculumStage
    weight: float  # Podíl na celkovém tréninku
    lora_rank: int
    lora_alpha: int
    dropout: float
    epochs: int
    learning_rate: float
    batch_size: int

CURRICULUM_CONFIG: List[StageConfig] = [
    StageConfig(
        stage=CurriculumStage.FOUNDATION,
        weight=0.2,
        lora_rank=16,
        lora_alpha=32,
        dropout=0.1,
        epochs=2,
        learning_rate=2e-4,
        batch_size=4
    ),
    StageConfig(
        stage=CurriculumStage.ZION_CORE,
        weight=0.3,
        lora_rank=32,
        lora_alpha=64,
        dropout=0.05,
        epochs=3,
        learning_rate=1e-4,
        batch_size=4
    ),
    StageConfig(
        stage=CurriculumStage.ZION_ADVANCED,
        weight=0.2,
        lora_rank=32,
        lora_alpha=64,
        dropout=0.05,
        epochs=2,
        learning_rate=5e-5,
        batch_size=4
    ),
    StageConfig(
        stage=CurriculumStage.CROSS_DOMAIN,
        weight=0.2,
        lora_rank=64,
        lora_alpha=128,
        dropout=0.02,
        epochs=2,
        learning_rate=2e-5,
        batch_size=2
    ),
    StageConfig(
        stage=CurriculumStage.RAG_SYNTHESIS,
        weight=0.1,
        lora_rank=64,
        lora_alpha=128,
        dropout=0.02,
        epochs=1,
        learning_rate=1e-5,
        batch_size=2
    ),
]

class CurriculumPipeline:
    def __init__(self, base_path: str = "HiranV2.2/data/curriculum"):
        self.base_path = base_path
        self.stages = CURRICULUM_CONFIG
        
    def create_stage_directories(self):
        """Vytvořit adresářovou strukturu pro curriculum"""
        import os
        for stage_config in self.stages:
            stage_path = os.path.join(self.base_path, stage_config.stage.value)
            os.makedirs(stage_path, exist_ok=True)
            print(f"Created: {stage_path}")
    
    def validate_data_distribution(self) -> Dict[str, int]:
        """Validovat distribuci dat napříč fázemi"""
        distribution = {}
        for stage_config in self.stages:
            stage_file = os.path.join(
                self.base_path, 
                f"{stage_config.stage.value}.jsonl"
            )
            if os.path.exists(stage_file):
                with open(stage_file, 'r') as f:
                    count = sum(1 for _ in f)
                distribution[stage_config.stage.value] = count
        return distribution

if __name__ == "__main__":
    pipeline = CurriculumPipeline()
    pipeline.create_stage_directories()
    print("Curriculum structure created successfully!")
```

### 1.2 Dataset Expansion

**Cíl:** Rozšířit existující v2.1 dataset (3056 pairs) na 5000-8000 pairs pro v2.2.

**Zdroje dat:**

1. **ZION V3 Documentation** (~1500 pairs)
   - `V3/docs/` - kompletní V3 dokumentace
   - `V3/README.md` - projekt overview
   - `V3/ROADMAP.md` - roadmap a plány
   - V3 CLI docs (`V3/docs/CLI_*.md`)

2. **Existing v2.1 Data** (~3056 pairs)
   - `HiranV2.1/finetune/data/` - existující training data
   - Re-use a validace

3. **OASIS Avatar Profiles** (~500 pairs)
   - Rozšířené profily z OASIS systému
   - Avatar personality a knowledge

4. **External RAG Corpora** (~1000-2000 pairs)
   - Buddhism corpus (licencované)
   - Technical documentation (open source)
   - Academic papers (s citacemi)

**Dataset Pipeline:**

```python
# HiranV2.2/data/build_dataset.py
import json
import os
from pathlib import Path
from typing import List, Dict

class DatasetBuilder:
    def __init__(self, output_dir: str = "HiranV2.2/data/curriculum"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def load_v2_1_data(self) -> List[Dict]:
        """Načíst existující v2.1 training data"""
        v2_1_path = Path("HiranV2.1/finetune/data")
        data = []
        
        # Načíst všechna JSONL soubory
        for jsonl_file in v2_1_path.glob("*.jsonl"):
            with open(jsonl_file, 'r') as f:
                for line in f:
                    data.append(json.loads(line))
        
        print(f"Loaded {len(data)} pairs from v2.1")
        return data
    
    def scrape_v3_docs(self) -> List[Dict]:
        """Scrape V3 dokumentaci a vytvořit Q&A pairs"""
        import markdown
        from bs4 import BeautifulSoup
        
        v3_docs = Path("V3/docs")
        data = []
        
        for md_file in v3_docs.glob("*.md"):
            with open(md_file, 'r') as f:
                content = f.read()
            
            # Parse markdown a vytvořit Q&A pairs
            sections = self._parse_markdown_sections(content)
            for section in sections:
                if len(section) > 50:  # Minimální délka
                    qa_pair = self._create_qa_pair(section, str(md_file))
                    if qa_pair:
                        data.append(qa_pair)
        
        print(f"Created {len(data)} pairs from V3 docs")
        return data
    
    def _parse_markdown_sections(self, content: str) -> List[str]:
        """Rozdělit markdown na sekce"""
        lines = content.split('\n')
        sections = []
        current_section = []
        
        for line in lines:
            if line.startswith('#'):
                if current_section:
                    sections.append('\n'.join(current_section))
                current_section = [line]
            else:
                current_section.append(line)
        
        if current_section:
            sections.append('\n'.join(current_section))
        
        return sections
    
    def _create_qa_pair(self, section: str, source: str) -> Dict:
        """Vytvořit Q&A pair ze sekce"""
        # Zde by byl LLM-based generátor pro lepší Q&A
        # Prozatím jednoduchá implementace
        return {
            "instruction": f"Explain the following from {source}:",
            "input": section[:500],  # Prvních 500 znaků
            "output": section,
            "source": source,
            "domain": "zion_core"
        }
    
    def categorize_by_stage(self, data: List[Dict]) -> Dict[str, List[Dict]]:
        """Kategorizovat data podle curriculum fází"""
        categorized = {
            "foundation": [],
            "zion_core": [],
            "zion_advanced": [],
            "cross_domain": [],
            "rag_synthesis": []
        }
        
        for item in data:
            domain = item.get("domain", "zion_core")
            if domain in categorized:
                categorized[domain].append(item)
            else:
                categorized["zion_core"].append(item)
        
        return categorized
    
    def save_curriculum_data(self, categorized: Dict[str, List[Dict]]):
        """Uložit data do curriculum souborů"""
        for stage, items in categorized.items():
            output_file = self.output_dir / f"{stage}.jsonl"
            with open(output_file, 'w') as f:
                for item in items:
                    f.write(json.dumps(item) + '\n')
            print(f"Saved {len(items)} items to {output_file}")

if __name__ == "__main__":
    builder = DatasetBuilder()
    
    # Načíst v2.1 data
    v2_1_data = builder.load_v2_1_data()
    
    # Scrape V3 docs
    v3_data = builder.scrape_v3_docs()
    
    # Kombinovat data
    all_data = v2_1_data + v3_data
    
    # Kategorizovat
    categorized = builder.categorize_by_stage(all_data)
    
    # Uložit
    builder.save_curriculum_data(categorized)
    
    print(f"Total dataset size: {len(all_data)} pairs")
```

### 1.3 Data Quality Checks

**Cíl:** Implementovat automatické validace pro dataset kvalitu.

```python
# HiranV2.2/data/validate_dataset.py
import json
from pathlib import Path
from typing import List, Dict
import re

class DatasetValidator:
    def __init__(self, data_path: str = "HiranV2.2/data/curriculum"):
        self.data_path = Path(data_path)
        
    def validate_all_stages(self) -> Dict[str, Dict]:
        """Validovat všechny curriculum fází"""
        results = {}
        
        for stage_file in self.data_path.glob("*.jsonl"):
            stage_name = stage_file.stem
            results[stage_name] = self.validate_stage(stage_file)
        
        return results
    
    def validate_stage(self, stage_file: Path) -> Dict:
        """Validovat jednu fázi"""
        data = []
        with open(stage_file, 'r') as f:
            for line in f:
                data.append(json.loads(line))
        
        return {
            "total_pairs": len(data),
            "avg_instruction_length": self._avg_length(data, "instruction"),
            "avg_output_length": self._avg_length(data, "output"),
            "missing_fields": self._check_missing_fields(data),
            "duplicates": self._check_duplicates(data),
            "toxic_content": self._check_toxicity(data),
            "balance_score": self._check_balance(data)
        }
    
    def _avg_length(self, data: List[Dict], field: str) -> float:
        """Vypočítat průměrnou délku pole"""
        lengths = [len(item.get(field, "")) for item in data]
        return sum(lengths) / len(lengths) if lengths else 0
    
    def _check_missing_fields(self, data: List[Dict]) -> int:
        """Zkontrolovat chybějící pole"""
        required_fields = ["instruction", "output"]
        missing = 0
        for item in data:
            for field in required_fields:
                if field not in item or not item[field]:
                    missing += 1
        return missing
    
    def _check_duplicates(self, data: List[Dict]) -> int:
        """Zkontrolovat duplicity"""
        seen = set()
        duplicates = 0
        for item in data:
            key = item.get("instruction", "") + item.get("output", "")
            if key in seen:
                duplicates += 1
            seen.add(key)
        return duplicates
    
    def _check_toxicity(self, data: List[Dict]) -> int:
        """Zkontrolovat toxický obsah (jednoduchá heuristika)"""
        toxic_patterns = [
            r'\b(hate|kill|violence|terrorist)\b',
            r'\b(racist|discrimination|slur)\b'
        ]
        
        toxic_count = 0
        for item in data:
            text = item.get("instruction", "") + " " + item.get("output", "")
            for pattern in toxic_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    toxic_count += 1
                    break
        
        return toxic_count
    
    def _check_balance(self, data: List[Dict]) -> float:
        """Zkontrolovat vyváženost dat"""
        # Jednoduchá metrika: distribuce délek outputů
        output_lengths = [len(item.get("output", "")) for item in data]
        if not output_lengths:
            return 0.0
        
        avg_length = sum(output_lengths) / len(output_lengths)
        variance = sum((x - avg_length) ** 2 for x in output_lengths) / len(output_lengths)
        std_dev = variance ** 0.5
        
        # Nižší std_dev = lepší vyváženost
        balance_score = 1.0 / (1.0 + std_dev / avg_length) if avg_length > 0 else 0
        return balance_score

if __name__ == "__main__":
    validator = DatasetValidator()
    results = validator.validate_all_stages()
    
    print("Dataset Validation Results:")
    for stage, metrics in results.items():
        print(f"\n{stage}:")
        for metric, value in metrics.items():
            print(f"  {metric}: {value}")
```

**Deliverables Fáze 1:**
- [x] Curriculum pipeline design
- [x] Dataset expansion (5001 pairs, target met)
- [x] Data quality validation (0 duplicates, 0 toxic content)
- [x] Curriculum config templates (`config/dynamic_lora.py`, `config/curriculum_config.json`)

---

## Fáze 2: Training Pipeline (3-5 dní)

### 2.1 Dynamic QLoRA Configuration

**Cíl:** Implementovat dynamickou QLoRA konfiguraci podle curriculum fází.

```python
# HiranV2.2/config/dynamic_lora.py
from dataclasses import dataclass
from typing import Optional
import torch
from peft import LoraConfig, TaskType

@dataclass
class DynamicLoRAConfig:
    """Dynamická QLoRA konfigurace podle curriculum fáze"""
    stage: str
    rank: int = 32
    alpha: int = 64
    dropout: float = 0.05
    target_modules: Optional[list] = None
    bias: str = "none"
    task_type: str = "CAUSAL_LM"
    
    def to_peft_config(self) -> LoraConfig:
        """Konvertovat na PEFT LoraConfig"""
        return LoraConfig(
            r=self.rank,
            lora_alpha=self.alpha,
            lora_dropout=self.dropout,
            target_modules=self.target_modules or [
                "q_proj", "k_proj", "v_proj", "o_proj",
                "gate_proj", "up_proj", "down_proj"
            ],
            bias=self.bias,
            task_type=TaskType.CAUSAL_LM
        )

def get_lora_config_for_stage(stage: str) -> DynamicLoRAConfig:
    """Získat LoRA konfiguraci pro danou fázi"""
    configs = {
        "foundation": DynamicLoRAConfig(
            stage="foundation",
            rank=16,
            alpha=32,
            dropout=0.1
        ),
        "zion_core": DynamicLoRAConfig(
            stage="zion_core",
            rank=32,
            alpha=64,
            dropout=0.05
        ),
        "zion_advanced": DynamicLoRAConfig(
            stage="zion_advanced",
            rank=32,
            alpha=64,
            dropout=0.05
        ),
        "cross_domain": DynamicLoRAConfig(
            stage="cross_domain",
            rank=64,
            alpha=128,
            dropout=0.02
        ),
        "rag_synthesis": DynamicLoRAConfig(
            stage="rag_synthesis",
            rank=64,
            alpha=128,
            dropout=0.02
        )
    }
    
    return configs.get(stage, configs["zion_core"])
```

### 2.2 Multi-Stage Training Script

**Cíl:** Implementovat multi-stage training s curriculum learning.

```python
# HiranV2.2/scripts/train_v2.2.py
import argparse
import json
import os
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
from config.dynamic_lora import get_lora_config_for_stage

class CurriculumTrainer:
    def __init__(self, base_model: str, output_dir: str):
        self.base_model = base_model
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load tokenizer a model
        self.tokenizer = AutoTokenizer.from_pretrained(base_model)
        self.model = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        
        # Prepare model for k-bit training
        self.model = prepare_model_for_kbit_training(self.model)
    
    def train_stage(
        self,
        stage: str,
        data_path: str,
        checkpoint_path: Optional[str] = None
    ):
        """Trénovat jednu curriculum fázi"""
        print(f"\n{'='*50}")
        print(f"Training stage: {stage}")
        print(f"{'='*50}\n")
        
        # Load data
        dataset = load_dataset("json", data_files=data_path, split="train")
        
        # Tokenize data
        tokenized_dataset = dataset.map(
            self._tokenize_function,
            batched=True,
            remove_columns=dataset.column_names
        )
        
        # Get LoRA config pro stage
        lora_config = get_lora_config_for_stage(stage)
        peft_config = lora_config.to_peft_config()
        
        # Apply LoRA
        self.model = get_peft_model(self.model, peft_config)
        self.model.print_trainable_parameters()
        
        # Training arguments
        stage_output_dir = self.output_dir / stage
        training_args = TrainingArguments(
            output_dir=str(stage_output_dir),
            num_train_epochs=lora_config.epochs if hasattr(lora_config, 'epochs') else 2,
            per_device_train_batch_size=4,
            gradient_accumulation_steps=4,
            learning_rate=lora_config.learning_rate if hasattr(lora_config, 'learning_rate') else 2e-4,
            fp16=True,
            logging_steps=10,
            save_steps=100,
            eval_steps=100,
            save_total_limit=3,
            load_best_model_at_end=True,
            report_to="none"
        )
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False
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
        trainer.save_model(str(stage_output_dir / "final"))
        print(f"Stage {stage} completed! Model saved to {stage_output_dir}")
        
        return str(stage_output_dir / "final")
    
    def _tokenize_function(self, examples):
        """Tokenize funkce"""
        # Kombinovat instruction a output
        texts = [
            f"### Instruction:\n{inst}\n\n### Response:\n{out}"
            for inst, out in zip(examples["instruction"], examples["output"])
        ]
        
        tokenized = self.tokenizer(
            texts,
            truncation=True,
            max_length=2048,
            padding="max_length"
        )
        
        return tokenized

def main():
    parser = argparse.ArgumentParser(description="Train Hiran v2.2 with curriculum")
    parser.add_argument("--base_model", type=str, default="unsloth/Meta-Llama-3.1-8B-Instruct")
    parser.add_argument("--output_dir", type=str, default="HiranV2.2/checkpoints")
    parser.add_argument("--data_dir", type=str, default="HiranV2.2/data/curriculum")
    parser.add_argument("--stages", nargs="+", default=[
        "foundation", "zion_core", "zion_advanced", "cross_domain", "rag_synthesis"
    ])
    
    args = parser.parse_args()
    
    trainer = CurriculumTrainer(args.base_model, args.output_dir)
    
    # Train stages sequentially
    checkpoint = None
    for i, stage in enumerate(args.stages):
        data_path = os.path.join(args.data_dir, f"{stage}.jsonl")
        
        if not os.path.exists(data_path):
            print(f"Warning: Data file not found for stage {stage}: {data_path}")
            continue
        
        checkpoint = trainer.train_stage(stage, data_path, checkpoint)
    
    print("\n" + "="*50)
    print("All curriculum stages completed!")
    print(f"Final model: {checkpoint}")
    print("="*50)

if __name__ == "__main__":
    main()
```

### 2.3 Evaluation Protocol

**Cíl:** Implementovat komplexní evaluation protokol.

```python
# HiranV2.2/evaluate/evaluate_v2.2.py
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import load_dataset
import json
from pathlib import Path
import numpy as np

class ModelEvaluator:
    def __init__(self, model_path: str, base_model: str = "unsloth/Meta-Llama-3.1-8B-Instruct"):
        self.tokenizer = AutoTokenizer.from_pretrained(base_model)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        self.model.eval()
    
    def calculate_perplexity(self, dataset_path: str) -> float:
        """Vypočítat perplexity na validation setu"""
        dataset = load_dataset("json", data_files=dataset_path, split="train")
        
        total_loss = 0
        total_tokens = 0
        
        with torch.no_grad():
            for item in dataset:
                text = f"### Instruction:\n{item['instruction']}\n\n### Response:\n{item['output']}"
                inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=2048)
                
                outputs = self.model(**inputs, labels=inputs["input_ids"])
                loss = outputs.loss
                
                total_loss += loss.item() * inputs["input_ids"].size(1)
                total_tokens += inputs["input_ids"].size(1)
        
        avg_loss = total_loss / total_tokens
        perplexity = np.exp(avg_loss)
        
        return perplexity
    
    def evaluate_domain_accuracy(self, test_data: List[Dict]) -> Dict[str, float]:
        """Evaluaovat domain-specific accuracy"""
        results = {}
        
        for item in test_data:
            domain = item.get("domain", "general")
            instruction = item["instruction"]
            expected_output = item["output"]
            
            # Generate response
            generated = self.generate_response(instruction)
            
            # Simple accuracy check (contains key phrases)
            accuracy = self._calculate_accuracy(generated, expected_output)
            
            if domain not in results:
                results[domain] = []
            results[domain].append(accuracy)
        
        # Average accuracy per domain
        return {domain: np.mean(scores) for domain, scores in results.items()}
    
    def generate_response(self, instruction: str, max_tokens: int = 256) -> str:
        """Generovat response"""
        prompt = f"### Instruction:\n{instruction}\n\n### Response:\n"
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9,
                do_sample=True
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response[len(prompt):]
    
    def _calculate_accuracy(self, generated: str, expected: str) -> float:
        """Jednoduchá accuracy metrika"""
        # Extract key phrases from expected
        expected_words = set(expected.lower().split())
        generated_words = set(generated.lower().split())
        
        if not expected_words:
            return 0.0
        
        overlap = expected_words & generated_words
        return len(overlap) / len(expected_words)

def main():
    evaluator = ModelEvaluator("HiranV2.2/checkpoints/rag_synthesis/final")
    
    # Perplexity
    perplexity = evaluator.calculate_perplexity("HiranV2.2/data/validation.jsonl")
    print(f"Perplexity: {perplexity:.2f}")
    
    # Domain accuracy
    test_data = json.load(open("HiranV2.2/data/test.jsonl"))
    domain_accuracy = evaluator.evaluate_domain_accuracy(test_data)
    print(f"Domain Accuracy: {domain_accuracy}")

if __name__ == "__main__":
    main()
```

**Deliverables Fáze 2:**
- [x] Dynamic QLoRA configuration (`config/dynamic_lora.py`, `config/curriculum_config.json`)
- [x] Multi-stage training pipeline (`scripts/train_v2.2.py`, `scripts/data_loader.py`, `scripts/trainer_utils.py`)
- [x] Evaluation protocol (initial: `evaluate/evaluate_v2.2.py`, `evaluate/metrics.py`)
- [x] Training skripty a configs (`scripts/run_training.sh`, `scripts/sync_curriculum_to_vast.sh`)
- [ ] Training execution a monitoring (requires GPU runtime)
- [ ] Trained LoRA model (pending execution)
- [ ] Evaluation report (full benchmark suite, pending execution)

---

## Fáze 3: Quantization (1 den)

### 3.1 Hybrid Quantization

**Cíl:** Implementovat hybrid quantization strategy.

```python
# HiranV2.2/quantization/hybrid_quant.py
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import subprocess

class HybridQuantizer:
    def __init__(self, model_path: str, output_dir: str = "HiranV2.2/models"):
        self.model_path = Path(model_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Critical layers pro vyšší přesnost
        self.critical_layers = [
            "lm_head",
            "embed_tokens",
            "model.layers.0.mlp",
            "model.layers.1.mlp",
            "model.layers.2.mlp",
            "model.layers.3.mlp"
        ]
    
    def quantize_to_gguf(self, quant_type: str = "q5_k_m"):
        """Quantize model do GGUF formátu pomocí llama.cpp"""
        # 1. Export do GGUF
        gguf_path = self.output_dir / f"hiran-v2.2-{quant_type}.gguf"
        
        cmd = [
            "python3",
            "convert_hf_to_gguf.py",
            str(self.model_path),
            "--outfile",
            str(gguf_path),
            "--outtype",
            quant_type
        ]
        
        subprocess.run(cmd, check=True)
        print(f"Quantized model saved to {gguf_path}")
        
        return gguf_path
    
    def create_multi_variant_gguf(self):
        """Vytvořit multiple GGUF variants"""
        variants = [
            ("q4_k_m", "efficient"),
            ("q5_k_m", "balanced"),
            ("q8_0", "high_quality")
        ]
        
        for quant_type, description in variants:
            print(f"\nCreating {description} variant ({quant_type})...")
            self.quantize_to_gguf(quant_type)
    
    def convert_to_onnx(self):
        """Convert model do ONNX formátu"""
        onnx_path = self.output_dir / "hiran-v2.2-onnx"
        onnx_path.mkdir(exist_ok=True)
        
        # Použít optimum pro ONNX conversion
        cmd = [
            "optimum-cli",
            "export",
            "onnx",
            "-m",
            str(self.model_path),
            "--task",
            "text-generation",
            "-o",
            str(onnx_path)
        ]
        
        subprocess.run(cmd, check=True)
        print(f"ONNX model saved to {onnx_path}")

def main():
    quantizer = HybridQuantizer("HiranV2.2/checkpoints/rag_synthesis/final")
    
    # Create GGUF variants
    quantizer.create_multi_variant_gguf()
    
    # Create ONNX version
    quantizer.convert_to_onnx()
    
    print("\nQuantization completed!")

if __name__ == "__main__":
    main()
```

**Deliverables Fáze 3:**
- [ ] Hybrid quantization implementace
- [ ] Multi-variant GGUF export
- [ ] ONNX conversion
- [ ] Quantization validation

---

## Fáze 4: Inference Testing (1-2 dny)

### 4.1 Multi-Backend Testing

**Cíl:** Testovat inference na různých backends.

```python
# HiranV2.2/inference/test_backends.py
from enum import Enum
import torch
from pathlib import Path

class InferenceBackend(Enum):
    LLAMA_CPP = "llama_cpp"
    ONNX = "onnx"
    TENSORRT = "tensorrt"

class BackendTester:
    def __init__(self, model_variants: dict):
        self.model_variants = model_variants
        self.results = {}
    
    def test_backend(self, backend: InferenceBackend, model_path: str):
        """Testovat jeden backend"""
        print(f"\nTesting {backend.value} backend...")
        
        if backend == InferenceBackend.LLAMA_CPP:
            return self._test_llama_cpp(model_path)
        elif backend == InferenceBackend.ONNX:
            return self._test_onnx(model_path)
        elif backend == InferenceBackend.TENSORRT:
            return self._test_tensorrt(model_path)
    
    def _test_llama_cpp(self, model_path: str) -> dict:
        """Testovat llama.cpp backend"""
        import time
        
        test_prompt = "Explain ZION consensus mechanism"
        
        start_time = time.time()
        
        # Spustit llama-cli
        cmd = [
            "./llama.cpp/build/bin/llama-cli",
            "-m", model_path,
            "-p", test_prompt,
            "-n", 100,
            "-ngl", "99"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        latency = time.time() - start_time
        
        return {
            "backend": "llama_cpp",
            "latency": latency,
            "success": result.returncode == 0,
            "output_length": len(result.stdout)
        }
    
    def benchmark_all_backends(self):
        """Benchmark všechny backends"""
        for backend, model_path in self.model_variants.items():
            self.results[backend] = self.test_backend(backend, model_path)
        
        return self.results

def main():
    model_variants = {
        InferenceBackend.LLAMA_CPP: "HiranV2.2/models/hiran-v2.2-q5_k_m.gguf",
        InferenceBackend.ONNX: "HiranV2.2/models/hiran-v2.2-onnx/model.onnx"
    }
    
    tester = BackendTester(model_variants)
    results = tester.benchmark_all_backends()
    
    print("\nBenchmark Results:")
    for backend, metrics in results.items():
        print(f"{backend.value}: {metrics}")

if __name__ == "__main__":
    main()
```

**Deliverables Fáze 4:**
- [ ] Multi-backend testing
- [ ] Performance benchmarking
- [ ] Platform compatibility testing
- [ ] Memory footprint analysis

---

## Fáze 5: Deployment (1 den)

### 5.1 Deployment Skripts

**Cíl:** Vytvořit deployment skripty pro různé platformy.

```bash
#!/bin/bash
# HiranV2.2/scripts/deploy_vast.sh

VAST_HOST="root@ssh5.vast.ai"
VAST_PORT="31284"
MODEL_PATH="HiranV2.2/models/hiran-v2.2-q5_k_m.gguf"
REMOTE_PATH="/root/hiran-v2.2-q5_k_m.gguf"

echo "Deploying Hiran v2.2 to Vast.ai..."

# Upload model
echo "Uploading model..."
scp -i ~/.ssh/vast_ai_key -P "$VAST_PORT" "$MODEL_PATH" "$VAST_HOST:$REMOTE_PATH"

# SSH a setup inference
echo "Setting up inference service..."
ssh -i ~/.ssh/vast_ai_key -p "$VAST_PORT" "$VAST_HOST" << 'ENDSSH'
cd /workspace/llama.cpp/build/bin
./llama-server -m /root/hiran-v2.2-q5_k_m.gguf --host 0.0.0.0 --port 8002 --ngl 99
ENDSSH

echo "Deployment complete!"
```

**Deliverables Fáze 5:**
- [ ] Vast.ai deployment skript
- [ ] Docker deployment config
- [ ] Documentation update
- [ ] Git push a release

---

## Resource Requirements

### Training Resources
- **GPU:** RTX 4090 (24GB) nebo A100 (40GB) na Vast.ai/RunPod
- **RAM:** 64GB+
- **Storage:** 100GB+
- **Čas:** 3-5 dní pro kompletní curriculum training

### Inference Resources
- **CPU:** 8+ cores, 32GB RAM (pro Q4_K_M)
- **GPU:** 8GB+ VRAM (pro Q5_K_M a lepší)
- **Storage:** 10GB+ (pro model)

---

## Success Criteria

### Primární metriky
- [ ] Perplexity < 1.2 (validation set)
- [ ] Cross-domain accuracy > 80%
- [ ] Inference latency < 100ms (GPU), < 2s (CPU)
- [ ] Memory footprint < 8GB (Q4_K_M)

### Sekundární metriky
- [ ] Dataset size > 5000 pairs
- [ ] Multi-backend support (3+ backends)
- [ ] Platform coverage (cloud + edge + local)
- [ ] Documentation completeness

---

## Next Actions

1. **IMMEDIATE** (Dnes):
   - [ ] Vytvořit curriculum pipeline šablony
   - [ ] Spustit dataset expansion skript
   - [ ] Validovat dataset kvalitu

2. **SHORT-TERM** (Zítra):
   - [ ] Připravit training environment na Vast.ai
   - [ ] Spustit foundation stage training
   - [ ] Monitorovat training progress

3. **MEDIUM-TERM** (Tento týden):
   - [ ] Dokončit všechny curriculum stages
   - [ ] Spustit evaluation protokol
   - [ ] Implementovat quantization

4. **LONG-TERM** (Příští týden):
   - [ ] Multi-backend testing
   - [ ] Deployment na production
   - [ ] Documentation a release

---

**Status:** Active Implementation Plan  
**Created:** 2026-05-12  
**Author:** Devin (ZION AI Team)  
**Version:** 1.0