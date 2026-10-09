"""Small utilities for Hiran v2.2 training runs."""

from __future__ import annotations

import gc
import random

import numpy as np


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch
    except ImportError:
        return
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def free_cuda() -> None:
    gc.collect()
    try:
        import torch
    except ImportError:
        return
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def trainable_parameter_count(model) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def log_trainable_params(model, *, prefix: str = "") -> None:
    n = trainable_parameter_count(model)
    msg = f"{prefix}trainable parameters: {n:,}"
    try:
        model.print_trainable_parameters()  # PeftModel
    except Exception:
        print(msg)
