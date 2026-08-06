"""
Dynamic QLoRA configuration per curriculum stage (Hiran v2.2 Phase 2).

Each stage uses a fresh 4-bit base + new LoRA adapter (see train_v2.2.py).
Optional adapter carryover is a future extension.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Dict, List

if TYPE_CHECKING:
    from peft import LoraConfig


@dataclass
class DynamicLoRAConfig:
    """QLoRA hyperparameters for one curriculum stage."""

    stage: str
    rank: int
    alpha: int
    dropout: float
    target_modules: List[str]
    bias: str = "none"
    epochs: int = 2
    learning_rate: float = 2e-4
    batch_size: int = 4
    gradient_accumulation_steps: int = 4
    warmup_ratio: float = 0.03
    weight_decay: float = 0.01
    max_seq_length: int = 2048

    def to_peft_config(self) -> "LoraConfig":
        from peft import LoraConfig, TaskType

        return LoraConfig(
            r=self.rank,
            lora_alpha=self.alpha,
            lora_dropout=self.dropout,
            target_modules=list(self.target_modules),
            bias=self.bias,
            task_type=TaskType.CAUSAL_LM,
        )


def _tm(*modules: str) -> List[str]:
    return list(modules)


CURRICULUM_STAGES: Dict[str, DynamicLoRAConfig] = {
    "foundation": DynamicLoRAConfig(
        stage="foundation",
        rank=16,
        alpha=32,
        dropout=0.1,
        target_modules=_tm("q_proj", "k_proj", "v_proj", "o_proj"),
        epochs=2,
        learning_rate=2e-4,
        batch_size=4,
        gradient_accumulation_steps=4,
    ),
    "zion_core": DynamicLoRAConfig(
        stage="zion_core",
        rank=32,
        alpha=64,
        dropout=0.05,
        target_modules=_tm(
            "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
        ),
        epochs=3,
        learning_rate=1e-4,
        batch_size=4,
        gradient_accumulation_steps=4,
    ),
    "zion_advanced": DynamicLoRAConfig(
        stage="zion_advanced",
        rank=32,
        alpha=64,
        dropout=0.05,
        target_modules=_tm(
            "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
        ),
        epochs=2,
        learning_rate=5e-5,
        batch_size=4,
        gradient_accumulation_steps=4,
    ),
    "cross_domain": DynamicLoRAConfig(
        stage="cross_domain",
        rank=64,
        alpha=128,
        dropout=0.02,
        target_modules=_tm(
            "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
        ),
        epochs=2,
        learning_rate=2e-5,
        batch_size=2,
        gradient_accumulation_steps=8,
    ),
    "rag_synthesis": DynamicLoRAConfig(
        stage="rag_synthesis",
        rank=64,
        alpha=128,
        dropout=0.02,
        target_modules=_tm(
            "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
        ),
        epochs=1,
        learning_rate=1e-5,
        batch_size=2,
        gradient_accumulation_steps=8,
    ),
}


def get_stage_config(stage: str) -> DynamicLoRAConfig:
    if stage not in CURRICULUM_STAGES:
        raise KeyError(f"Unknown curriculum stage: {stage!r}. Valid: {sorted(CURRICULUM_STAGES)}")
    return CURRICULUM_STAGES[stage]
