#!/usr/bin/env python3
"""
Hiran v2.3 Vast.ai Price Comparator
====================================
Searches Vast.ai for multiple hardware configs and compares cost-effectiveness
for training Nemotron-32B.

Usage:
    # Compare all configs (requires vastai CLI + login)
    python scripts/vast_price_compare.py

    # Show only configs under $5/hr
    python scripts/vast_price_compare.py --max_price 5.0

    # Dry run (uses cached results if available)
    python scripts/vast_price_compare.py --dry_run

Requirements:
    pip install vastai
    vastai login  # or export VASTAI_API_KEY=...
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# CONFIGURATIONS
# ---------------------------------------------------------------------------

@dataclass
class Config:
    name: str
    gpus: int
    gpu_name: str
    min_gpu_ram: float
    method: str  # "full_ft" or "dora"
    estimated_hours: float
    min_viable: bool  # Whether this config can actually train the model


CONFIGS = [
    Config("Budget DORA (1x A100 40GB)", 1, "A100", 40, "dora", 72, True),
    Config("Budget DORA (1x RTX 6000 Ada)", 1, "RTX 6000", 48, "dora", 72, True),
    Config("Cost-Opt FT (4x A100 40GB)", 4, "A100", 40, "full_ft", 48, True),
    Config("Standard FT (2x A100 80GB)", 2, "A100", 80, "full_ft", 48, True),
    Config("Fast FT (4x A100 80GB)", 4, "A100", 80, "full_ft", 36, True),
    Config("2x RTX 6000 Ada", 2, "RTX 6000", 48, "full_ft", 48, False),  # Not viable!
]


# ---------------------------------------------------------------------------
# VAST.AI CLI
# ---------------------------------------------------------------------------

def vast_search(query: str) -> list[dict[str, Any]]:
    """Search Vast.ai offers via CLI."""
    cmd = ["vastai", "search", "offers", query, "--raw"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
        data = json.loads(result.stdout)
        return data if isinstance(data, list) else []
    except subprocess.CalledProcessError as e:
        print(f"ERROR: vastai search failed: {e.stderr}", file=sys.stderr)
        return []
    except FileNotFoundError:
        print("ERROR: vastai CLI not found. Install: pip install vastai", file=sys.stderr)
        print("  Then login: vastai login", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse vastai output: {e}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# ANALYSIS
# ---------------------------------------------------------------------------

def find_best_offer(config: Config, max_price: float | None = None) -> dict[str, Any] | None:
    """Find the cheapest viable offer for a config."""
    # Build search query
    query_parts = [
        f"num_gpus>={config.gpus}",
        f"gpu_name={config.gpu_name}",
        f"gpu_ram>={config.min_gpu_ram}",
        "cuda_vers>=12",
        "verified=any",
    ]
    query = " ".join(query_parts)

    offers = vast_search(query)
    if not offers:
        return None

    # Filter by max price if specified
    if max_price:
        offers = [o for o in offers if o.get("dph_total", float("inf")) <= max_price]

    # Sort by total price
    offers.sort(key=lambda x: x.get("dph_total", float("inf")))

    return offers[0] if offers else None


def format_offer(offer: dict[str, Any]) -> str:
    """Pretty-print offer details."""
    gpu_name = offer.get("gpu_name", "???")
    num_gpus = offer.get("num_gpus", "?")
    dph = offer.get("dph_total", 0)
    inet_up = offer.get("inet_up", 0)
    inet_down = offer.get("inet_down", 0)
    location = offer.get("geolocation", "?")
    return f"{gpu_name} x{num_gpus} @ ${dph:.2f}/hr ({inet_up:.0f}/{inet_down:.0f} Mbps) [{location}]"


def calculate_total_cost(dph: float, hours: float) -> float:
    """Calculate total cost including a 10% buffer for unexpected runtime."""
    return round(dph * hours * 1.1, 2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare Vast.ai prices for Hiran v2.3 training")
    parser.add_argument("--max_price", type=float, help="Maximum $/hr filter")
    parser.add_argument("--dry_run", action="store_true", help="Show queries without searching")
    args = parser.parse_args()

    print("=" * 80)
    print("Hiran v2.3 Vast.ai Price Comparator")
    print("=" * 80)
    print(f"\nModel: nvidia/OpenReasoning-Nemotron-32B (32.8B params)")
    print(f"Training: Full Fine-Tuning (ZeRO-3) or DORA fallback\n")

    if args.dry_run:
        print("DRY RUN — queries only:\n")
        for config in CONFIGS:
            query = f"num_gpus>={config.gpus} gpu_name={config.gpu_name} gpu_ram>={config.min_gpu_ram} cuda_vers>=12"
            print(f"  {config.name:30s} → {query}")
        return 0

    results = []

    for config in CONFIGS:
        print(f"\n{'─' * 80}")
        print(f"Searching: {config.name}")
        print(f"  Method: {config.method}")
        print(f"  Estimated duration: {config.estimated_hours}h")

        if not config.min_viable:
            print(f"  ⚠️  NOT VIABLE: Insufficient VRAM for {config.method}")
            print(f"     See HARDWARE_COST_ANALYSIS.md for memory calculation")
            results.append((config, None, None, False))
            continue

        offer = find_best_offer(config, args.max_price)
        if offer:
            dph = offer.get("dph_total", 0)
            total = calculate_total_cost(dph, config.estimated_hours)
            print(f"  ✅ Found: {format_offer(offer)}")
            print(f"     Cost: ${dph:.2f}/hr × {config.estimated_hours}h ≈ ${total} (with 10% buffer)")
            results.append((config, offer, total, True))
        else:
            print(f"  ❌ No offers found" + (f" under ${args.max_price}/hr" if args.max_price else ""))
            results.append((config, None, None, True))

    # Summary table
    print(f"\n\n{'=' * 80}")
    print("SUMMARY — Ranked by Total Cost")
    print(f"{'=' * 80}\n")

    viable = [(c, o, t) for c, o, t, v in results if v and o is not None]
    viable.sort(key=lambda x: x[2] if x[2] is not None else float("inf"))

    print(f"{'Rank':<6} {'Config':<32} {'$/hr':<10} {'Hours':<8} {'Total Est.':<12} {'Viable'}")
    print("─" * 80)

    for rank, (config, offer, total) in enumerate(viable, 1):
        dph = offer.get("dph_total", 0) if offer else 0
        hours = config.estimated_hours
        print(f"{rank:<6} {config.name:<32} ${dph:<9.2f} {hours:<8.0f} ${total:<11.0f} {'✅ Yes'}")

    non_viable = [c for c, _, _, v in results if not v]
    if non_viable:
        print(f"\n{'─' * 80}")
        print("NON-VIABLE CONFIGURATIONS (insufficient VRAM):")
        for config in non_viable:
            print(f"  ❌ {config.name}")

    not_found = [c for c, o, _, v in results if v and o is None]
    if not_found:
        print(f"\n{'─' * 80}")
        print("NO OFFERS FOUND:")
        for config in not_found:
            print(f"  ❌ {config.name}")

    if viable:
        best = viable[0]
        print(f"\n{'=' * 80}")
        print(f"🏆 BEST VALUE: {best[0].name}")
        print(f"   Estimated total cost: ${best[2]}")
        print(f"   Command to provision:")
        print(f"   python scripts/provision_vast.py --gpus {best[0].gpus} --gpu_name \"{best[0].gpu_name}\" --gpu_ram {best[0].min_gpu_ram}")

    print(f"\n{'=' * 80}")
    print("See HARDWARE_COST_ANALYSIS.md for detailed memory calculations.")
    print("See PRE_FLIGHT_CHECKLIST.md for pre-training verification steps.")
    print(f"{'=' * 80}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
