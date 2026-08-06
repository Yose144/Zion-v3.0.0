#!/usr/bin/env python3
"""
Hiran v2.2 Curriculum Learning Pipeline
Multi-domain curriculum learning pipeline pro QLoRA training
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Optional
import json
import os
from pathlib import Path


class CurriculumStage(Enum):
    """Curriculum learning fáze"""
    FOUNDATION = "foundation"          # Obecné znalosti (20%)
    ZION_CORE = "zion_core"            # ZION specifické koncepty (30%)
    ZION_ADVANCED = "zion_advanced"    # Pokročilé ZION témata (20%)
    CROSS_DOMAIN = "cross_domain"      # Vícenásobné domény (20%)
    RAG_SYNTHESIS = "rag_synthesis"    # Syntéza s RAG kontextem (10%)


@dataclass
class StageConfig:
    """Konfigurace pro jednu curriculum fázi"""
    stage: CurriculumStage
    weight: float              # Podíl na celkovém tréninku
    lora_rank: int
    lora_alpha: int
    dropout: float
    epochs: int
    learning_rate: float
    batch_size: int
    target_size: int           # Cílový počet párů pro tuto fázi


# Curriculum konfigurace pro v2.2
CURRICULUM_CONFIG: List[StageConfig] = [
    StageConfig(
        stage=CurriculumStage.FOUNDATION,
        weight=0.2,
        lora_rank=16,
        lora_alpha=32,
        dropout=0.1,
        epochs=2,
        learning_rate=2e-4,
        batch_size=4,
        target_size=1000  # 20% z 5000
    ),
    StageConfig(
        stage=CurriculumStage.ZION_CORE,
        weight=0.3,
        lora_rank=32,
        lora_alpha=64,
        dropout=0.05,
        epochs=3,
        learning_rate=1e-4,
        batch_size=4,
        target_size=1500  # 30% z 5000
    ),
    StageConfig(
        stage=CurriculumStage.ZION_ADVANCED,
        weight=0.2,
        lora_rank=32,
        lora_alpha=64,
        dropout=0.05,
        epochs=2,
        learning_rate=5e-5,
        batch_size=4,
        target_size=1000  # 20% z 5000
    ),
    StageConfig(
        stage=CurriculumStage.CROSS_DOMAIN,
        weight=0.2,
        lora_rank=64,
        lora_alpha=128,
        dropout=0.02,
        epochs=2,
        learning_rate=2e-5,
        batch_size=2,
        target_size=1000  # 20% z 5000
    ),
    StageConfig(
        stage=CurriculumStage.RAG_SYNTHESIS,
        weight=0.1,
        lora_rank=64,
        lora_alpha=128,
        dropout=0.02,
        epochs=1,
        learning_rate=1e-5,
        batch_size=2,
        target_size=500   # 10% z 5000
    ),
]


class CurriculumPipeline:
    """Curriculum learning pipeline manager"""
    
    def __init__(self, base_path: str = "HiranV2.2/data/curriculum"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.stages = CURRICULUM_CONFIG
        
    def create_stage_directories(self):
        """Vytvořit adresářovou strukturu pro curriculum"""
        for stage_config in self.stages:
            stage_path = self.base_path / stage_config.stage.value
            stage_path.mkdir(parents=True, exist_ok=True)
            print(f"✓ Created: {stage_path}")
    
    def validate_data_distribution(self) -> Dict[str, int]:
        """Validovat distribuci dat napříč fázemi"""
        distribution = {}
        total = 0
        
        for stage_config in self.stages:
            stage_file = self.base_path / f"{stage_config.stage.value}.jsonl"
            if stage_file.exists():
                with open(stage_file, 'r') as f:
                    count = sum(1 for _ in f)
                distribution[stage_config.stage.value] = count
                total += count
            else:
                distribution[stage_config.stage.value] = 0
        
        distribution["total"] = total
        return distribution
    
    def print_config_summary(self):
        """Vypsat souhrn curriculum konfigurace"""
        print("=" * 60)
        print("HIRAN V2.2 CURRICULUM CONFIG")
        print("=" * 60)
        
        for config in self.stages:
            print(f"\n{config.stage.value.upper()}:")
            print(f"  Weight: {config.weight:.0%}")
            print(f"  Target size: {config.target_size} pairs")
            print(f"  LoRA: rank={config.lora_rank}, alpha={config.lora_alpha}")
            print(f"  Training: epochs={config.epochs}, lr={config.learning_rate}")
            print(f"  Dropout: {config.dropout}")
        
        total_target = sum(c.target_size for c in self.stages)
        print(f"\nTotal target: {total_target} pairs")
        print("=" * 60)
    
    def get_stage_config(self, stage_name: str) -> Optional[StageConfig]:
        """Získat konfiguraci pro danou fázi"""
        for config in self.stages:
            if config.stage.value == stage_name:
                return config
        return None


def _parse_args():
    import argparse
    p = argparse.ArgumentParser(description="Hiran v2.2 Curriculum Pipeline")
    p.add_argument("--create-structure", action="store_true", help="Only create directory structure")
    p.add_argument("--validate", action="store_true", help="Only validate data distribution")
    return p.parse_args()


def main():
    """Main funkce pro testování pipeline"""
    args = _parse_args()
    print("🚀 Initializing Hiran v2.2 Curriculum Pipeline...")

    pipeline = CurriculumPipeline()

    if args.create_structure:
        print("\n📁 Creating curriculum directory structure...")
        pipeline.create_stage_directories()
        print("\n✅ Directory structure created!")
        return

    # Vytvořit adresářovou strukturu
    print("\n📁 Creating curriculum directory structure...")
    pipeline.create_stage_directories()

    # Vypsat konfiguraci
    print("\n⚙️  Curriculum Configuration:")
    pipeline.print_config_summary()

    # Validovat distribuci dat
    print("\n📊 Current Data Distribution:")
    distribution = pipeline.validate_data_distribution()

    for stage, count in distribution.items():
        if stage == "total":
            print(f"  {stage.upper()}: {count} pairs")
        else:
            target = pipeline.get_stage_config(stage).target_size if pipeline.get_stage_config(stage) else "?"
            progress = f"{count}/{target}" if target != "?" else f"{count}"
            print(f"  {stage}: {progress} pairs")

    print("\n✅ Curriculum pipeline initialized successfully!")
    print("📝 Next steps:")
    print("   1. Build dataset with: python data/build_dataset.py")
    print("   2. Validate dataset with: python data/validate_dataset.py")
    print("   3. Train with: python scripts/train_v2.2.py")


if __name__ == "__main__":
    main()
