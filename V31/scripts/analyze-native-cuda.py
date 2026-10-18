#!/usr/bin/env python3
"""Freeze fixed-window native CUDA results once; this does not measure SRBMiner."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import statistics


def digest(data):
    return hashlib.sha256(data).hexdigest()


def describe(windows, scale):
    rates = [row["count"] * 1e9 / row["wall_ns"] * scale for row in windows]
    total_count = sum(row["count"] for row in windows)
    total_ns = sum(row["wall_ns"] for row in windows)
    return {
        "samples": len(windows),
        "median": statistics.median(rates),
        "minimum": min(rates),
        "maximum": max(rates),
        "aggregate_rate": total_count * 1e9 / total_ns * scale,
        "total_count": total_count,
        "total_wall_ns": total_ns,
    }


def read_case(directory, case, expected_windows, warmup_windows):
    label = case["label"]
    assert Path(label).name == label, "case labels must not contain paths"
    log_bytes = (directory / f"{label}.log").read_bytes()
    log = log_bytes.decode()
    assert "test result: ok. 1 passed; 0 failed;" in log, f"{label}: failed test"
    actual_env = (directory / f"{label}.env").read_text().splitlines()
    assert actual_env == case["env"], f"{label}: environment mismatch"
    assert f'{case["prefix"]}_bench_config ' in log, f"{label}: missing config"
    pattern = re.compile(
        rf'^{re.escape(case["prefix"])}_window index=(\d+) warmup=(true|false) '
        rf'{re.escape(case["counter"])}=(\d+) wall_ns=(\d+)$',
        re.MULTILINE,
    )
    matches = pattern.findall(log)
    assert len(matches) == expected_windows, f"{label}: wrong window count"
    windows = []
    for expected_index, (index, warmup, count, wall_ns) in enumerate(matches):
        row = {
            "index": int(index),
            "warmup": warmup == "true",
            "count": int(count),
            "wall_ns": int(wall_ns),
        }
        assert row["index"] == expected_index, f"{label}: missing/reordered window"
        assert row["warmup"] == (expected_index < warmup_windows), label
        assert row["wall_ns"] >= 1_000_000_000, f"{label}: short window"
        assert row["count"] > 0 and row["count"] % case["batch"] == 0, label
        windows.append(row)
    steady = [row for row in windows if not row["warmup"]]
    config = next(line for line in log.splitlines() if f'{case["prefix"]}_bench_config ' in line)
    for token in case.get("config_contains", []):
        assert token in config, f"{label}: missing actual configuration {token}"
    return {
        **case,
        "config_line": config,
        "log_sha256": digest(log_bytes),
        "windows": windows,
        "steady": describe(steady, case["scale"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--expected-binary-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True, help="new frozen result file")
    args = parser.parse_args()
    assert not args.output.exists(), "results already frozen; read them instead of re-deriving"
    directory = args.directory.resolve()
    assert (directory / "status").read_text().strip() == "PASS", "incomplete capture"
    binary_manifest = (directory / "binary.sha256").read_text()
    assert binary_manifest.split()[0] == args.expected_binary_sha256, "wrong binary"
    plan_bytes = args.plan.read_bytes()
    plan = json.loads(plan_bytes)
    assert plan["windows"] == 16 and plan["warmup_windows"] == 4
    labels = [case["label"] for case in plan["cases"]]
    assert len(labels) == len(set(labels)), "duplicate case"
    expected_logs = {f"{label}.log" for label in labels}
    auxiliary_logs = set(plan.get("auxiliary_logs", []))
    actual_logs = {path.name for path in directory.glob("*.log")} - auxiliary_logs
    assert actual_logs == expected_logs, "unexpected/missing run"
    cases = [
        read_case(directory, case, plan["windows"], plan["warmup_windows"])
        for case in plan["cases"]
    ]
    grouped = {}
    for case in cases:
        group = grouped.setdefault(
            case["group"],
            {"unit": case["unit"], "scale": case["scale"], "counter": case["counter"], "runs": [], "windows": []},
        )
        assert (group["unit"], group["scale"], group["counter"]) == (
            case["unit"], case["scale"], case["counter"],
        ), "incompatible grouped units"
        group["runs"].append(case["label"])
        group["windows"].extend(row for row in case["windows"] if not row["warmup"])
    summaries = {
        name: {
            "unit": group["unit"],
            "counter": group["counter"],
            "runs": group["runs"],
            **describe(group["windows"], group["scale"]),
        }
        for name, group in grouped.items()
    }
    comparisons = []
    for pair in plan["comparisons"]:
        baseline, candidate = summaries[pair["baseline"]], summaries[pair["candidate"]]
        assert (baseline["unit"], baseline["counter"]) == (candidate["unit"], candidate["counter"])
        comparisons.append({
            **pair,
            "median_ratio": candidate["median"] / baseline["median"],
            "median_delta_percent": (candidate["median"] / baseline["median"] - 1) * 100,
            "aggregate_ratio": candidate["aggregate_rate"] / baseline["aggregate_rate"],
        })
    result = {
        "scope": "Native fixed-work CUDA benchmarks, not pool-share throughput or SRBMiner parity",
        "source_directory": str(directory),
        "binary_manifest": binary_manifest,
        "plan_sha256": digest(plan_bytes),
        "plan": plan,
        "cases": cases,
        "groups": summaries,
        "comparisons": comparisons,
        "telemetry_sha256": digest((directory / "telemetry.csv").read_bytes()),
        "timeline": (directory / "timeline.txt").read_text(),
    }
    with args.output.open("x") as destination:
        json.dump(result, destination, indent=2)
        destination.write("\n")
    print(json.dumps({"groups": summaries, "comparisons": comparisons}, indent=2))


if __name__ == "__main__":
    main()
