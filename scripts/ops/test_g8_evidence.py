#!/usr/bin/env python3
"""Tests for g8_evidence — pure/synthetic, no Prometheus or network needed."""

import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g8_evidence as g8e  # noqa: E402

NAMES = ["chain_live", "pool_http", "pool_stratum", "multichain", "dao", "zis"]
T0 = 1_700_000_000
START = datetime.fromtimestamp(T0, timezone.utc)


def make_state(**kw):
    state = g8e.new_state(started=START, duration_days=30, started_by="test")
    state.update(kw)
    return state


def full_series(start, end, step=60, value=1.0):
    return {b: value for b in range(int(start), int(end) + 1, step)}


def matrix(values):
    """A Prometheus matrix list covering {ts: value} pairs."""
    return [{"metric": {}, "values": [[float(ts), str(v)] for ts, v in values.items()]}]


class ExpressionTests(unittest.TestCase):
    def test_signal_expressions_require_freshness(self):
        chain = g8e.signal_expr("chain_live")
        self.assertIn("last_over_time(zion_g8_chain_live[30s])", chain)
        self.assertIn('up{job="zion_g8"}', chain)
        self.assertIn("or on() vector(0)", chain)
        self.assertIn(g8e.EXPORTER_FRESHNESS, chain)

        svc = g8e.signal_expr("pool_http")
        self.assertIn('last_over_time(zion_g8_probe_success{service="pool_http"}[30s])', svc)
        self.assertIn('up{job="zion_g8"}', svc)
        self.assertIn("or on() vector(0)", svc)
        self.assertIn(g8e.EXPORTER_FRESHNESS, svc)

    def test_coverage_expr_is_exporter_freshness(self):
        self.assertIn("last_over_time(up", g8e.COVERAGE_EXPR)
        self.assertIn("[30s]", g8e.COVERAGE_EXPR)


class ChunkRangeTests(unittest.TestCase):
    """Prometheus caps query_range at 11k points/series — long windows chunk."""

    def test_short_range_single_chunk(self):
        self.assertEqual(g8e.chunk_range(T0, T0 + 300, 60), [(T0, T0 + 300)])

    def test_empty_range_no_chunks(self):
        self.assertEqual(g8e.chunk_range(T0 + 60, T0, 60), [])

    def test_chunk_boundaries_stay_grid_aligned(self):
        # 30d @ 60s = 43,200 buckets > 10k cap -> 5 chunks, no gaps/overlap.
        end = T0 + 30 * 86400
        chunks = g8e.chunk_range(T0, end, 60)
        self.assertEqual(len(chunks), 5)
        covered = []
        for s, e in chunks:
            points = (e - s) // 60 + 1
            self.assertLessEqual(points, g8e.MAX_POINTS_PER_QUERY)
            covered.extend(range(int(s), int(e) + 1, 60))
        self.assertEqual(covered, list(range(T0, end + 1, 60)))

    def test_last_chunk_can_be_partial(self):
        # 10k-point cap at step 60 -> span 599,940s; 600,060s needs 2 chunks.
        chunks = g8e.chunk_range(T0, T0 + 600_060, 60)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[1], (T0 + 600_000, T0 + 600_060))

    def test_rejects_nonpositive_step(self):
        with self.assertRaises(ValueError):
            g8e.chunk_range(T0, T0 + 60, 0)


class MergeTests(unittest.TestCase):
    def test_merge_matrix_takes_max_on_duplicate_timestamps(self):
        result = [
            {"metric": {"a": "1"}, "values": [[T0, "0"], [T0 + 60, "0"]]},
            {"metric": {"b": "2"}, "values": [[T0, "1"], [T0 + 120, "1"]]},
        ]
        merged = g8e.merge_matrix(result)
        self.assertEqual(merged[T0], 1.0)
        self.assertEqual(merged[T0 + 60], 0.0)
        self.assertEqual(merged[T0 + 120], 1.0)

    def test_merge_matrix_nonfinite_normalised_to_zero(self):
        result = [{"metric": {}, "values": [
            [T0, "NaN"], [T0 + 60, "+Inf"], [T0 + 120, "-Inf"], [T0 + 180, "1"],
        ]}]
        merged = g8e.merge_matrix(result)
        self.assertEqual(merged[T0], 0.0)
        self.assertEqual(merged[T0 + 60], 0.0)
        self.assertEqual(merged[T0 + 120], 0.0)
        self.assertEqual(merged[T0 + 180], 1.0)

    def test_expected_buckets_inclusive(self):
        buckets = g8e.expected_buckets(T0, T0 + 120, 60)
        self.assertEqual(buckets, [T0, T0 + 60, T0 + 120])
        self.assertEqual(g8e.expected_buckets(T0 + 10, T0, 60), [])


class EvaluateTests(unittest.TestCase):
    """evaluate() is pure: (state, signal_series, up_series, start, end, step, now)."""

    def eval(self, signals, up, start, end, now, **state_kw):
        state = make_state(**state_kw)
        return g8e.evaluate(state, signals, up, start, end, 60, now)

    def test_missing_buckets_count_as_downtime(self):
        end = T0 + 5 * 60  # 6 buckets expected
        signals = {n: full_series(T0, end) for n in NAMES}
        del signals["dao"][T0 + 2 * 60]
        up = full_series(T0, end)
        out = self.eval(signals, up, T0, end, now=START + timedelta(minutes=2))
        self.assertEqual(out["sample_counts"]["expected"], 6)
        self.assertEqual(out["sample_counts"]["good"], 5)
        self.assertAlmostEqual(out["uptime_percent"], 5 / 6 * 100, places=6)
        self.assertAlmostEqual(out["service_uptime_percent"]["dao"], 5 / 6 * 100, places=6)
        self.assertAlmostEqual(out["service_uptime_percent"]["zis"], 100.0, places=6)

    def test_coverage_from_up_series_only(self):
        end = T0 + 4 * 60
        signals = {n: full_series(T0, end) for n in NAMES}
        up = {T0: 1.0, T0 + 60: 1.0, T0 + 120: 1.0}
        out = self.eval(signals, up, T0, end, now=START + timedelta(minutes=2))
        self.assertEqual(out["sample_counts"]["covered"], 3)
        self.assertAlmostEqual(out["evidence_coverage_percent"], 60.0, places=6)

    def test_coverage_zero_values_not_covered(self):
        end = T0 + 4 * 60
        signals = {n: full_series(T0, end) for n in NAMES}
        up = {T0: 1.0, T0 + 60: 0.0, T0 + 120: 0.0, T0 + 180: 1.0}
        out = self.eval(signals, up, T0, end, now=START + timedelta(minutes=2))
        self.assertEqual(out["sample_counts"]["covered"], 2)
        self.assertAlmostEqual(out["evidence_coverage_percent"], 40.0, places=6)

    def test_contiguous_incidents(self):
        end = T0 + 9 * 60  # 10 buckets; buckets 3..5 zero
        signals = {n: full_series(T0, end) for n in NAMES}
        for n in ("pool_http", "pool_stratum"):
            for b in (T0 + 3 * 60, T0 + 4 * 60, T0 + 5 * 60):
                signals[n][b] = 0.0
        up = full_series(T0, end)
        out = self.eval(signals, up, T0, end, now=START + timedelta(minutes=3))
        self.assertEqual(len(out["incidents"]), 1)
        inc = out["incidents"][0]
        self.assertEqual(inc["started"], g8e.iso(T0 + 3 * 60))
        self.assertEqual(inc["ended"], g8e.iso(T0 + 6 * 60))
        self.assertEqual(inc["duration_seconds"], 180)
        self.assertEqual(sorted(inc["services"]), ["pool_http", "pool_stratum"])
        self.assertEqual(out["critical_incidents"], [])

    def test_ongoing_incident_has_null_end(self):
        end = T0 + 3 * 60  # all zero, still ongoing at range end
        signals = {n: {b: 0.0 for b in range(T0, end + 1, 60)} for n in NAMES}
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=START + timedelta(minutes=2))
        self.assertEqual(len(out["incidents"]), 1)
        self.assertIsNone(out["incidents"][0]["ended"])
        self.assertEqual(out["incidents"][0]["duration_seconds"], 240)
        self.assertEqual(len(out["incidents"][0]["services"]), 6)

    def test_critical_threshold_900s(self):
        def run(n_zero):
            end = T0 + (n_zero + 1) * 60
            signals = {n: full_series(T0, end) for n in NAMES}
            for n in NAMES:
                for i in range(n_zero):
                    signals[n][T0 + i * 60] = 0.0
            return self.eval(signals, full_series(T0, end), T0, end,
                             now=START + timedelta(minutes=2))
        out = run(15)  # 15 buckets * 60s = 900s -> critical
        self.assertEqual(out["incidents"][0]["duration_seconds"], 900)
        self.assertEqual(len(out["critical_incidents"]), 1)
        out = run(14)  # 840s -> not critical
        self.assertEqual(out["critical_incidents"], [])

    def test_status_running_before_target(self):
        end = T0 + 60
        signals = {n: full_series(T0, end) for n in NAMES}
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=START + timedelta(days=1))  # < 30d target
        self.assertEqual((out["status"], out["window_status"], out["gate_status"]),
                         ("running", "running", "pending"))

    def test_gate_passed_after_target(self):
        target = START + timedelta(days=30)
        end = target.timestamp()
        signals = {n: full_series(T0, end) for n in NAMES}
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=target + timedelta(minutes=1))
        self.assertEqual((out["status"], out["window_status"], out["gate_status"]),
                         ("window_elapsed", "window_elapsed", "passed"))

    def test_gate_evidence_incomplete(self):
        target = START + timedelta(days=30)
        end = target.timestamp()
        signals = {n: full_series(T0, end) for n in NAMES}
        up = full_series(T0, end)
        for b in list(up)[::10]:
            del up[b]
        out = self.eval(signals, up, T0, end, now=target + timedelta(minutes=1))
        self.assertEqual(out["gate_status"], "evidence_incomplete")

    def test_gate_failed_on_low_uptime_or_critical(self):
        start = T0
        end = T0 + 19 * 60
        signals = {n: full_series(start, end) for n in NAMES}
        for n in NAMES:
            for i in range(16):
                signals[n][start + i * 60] = 0.0
        state_kw = {"target_end": (START + timedelta(minutes=19)).isoformat()}
        out = self.eval(signals, full_series(start, end), start, end,
                        now=START + timedelta(minutes=30), **state_kw)
        self.assertEqual(out["gate_status"], "failed")
        self.assertEqual(len(out["critical_incidents"]), 1)

        signals2 = {n: full_series(start, end) for n in NAMES}
        signals2["zis"][start] = 0.0  # one bad bucket of 20 -> 95%
        out2 = self.eval(signals2, full_series(start, end), start, end,
                         now=START + timedelta(minutes=30), **state_kw)
        self.assertEqual(out2["gate_status"], "failed")
        self.assertEqual(out2["critical_incidents"], [])

    def test_running_gate_failed_on_critical_incident(self):
        # 16 consecutive bad buckets = 960s >= 900s critical outage.
        end = T0 + 19 * 60
        signals = {n: full_series(T0, end) for n in NAMES}
        for i in range(16):
            signals["dao"][T0 + i * 60] = 0.0
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=START + timedelta(minutes=30))
        self.assertEqual((out["status"], out["window_status"]),
                         ("running", "running"))
        self.assertEqual(out["gate_status"], "failed")
        self.assertEqual(out["gate_reason"], "critical_incident")

    def test_running_gate_failed_on_downtime_budget(self):
        # 30d window @60s step => 43200 samples; budget = floor(43200*0.001)=43.
        # 50 non-contiguous bad buckets exceed the budget without reaching
        # the 900s contiguous critical threshold.
        end = T0 + 99 * 60  # 100 buckets
        signals = {n: full_series(T0, end) for n in NAMES}
        for i in range(0, 100, 2):
            signals["dao"][T0 + i * 60] = 0.0
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=START + timedelta(days=1))
        self.assertEqual(out["sample_counts"]["good"], 50)
        self.assertEqual(out["critical_incidents"], [])
        self.assertEqual(out["gate_status"], "failed")
        self.assertEqual(out["gate_reason"], "downtime_budget_exhausted")

    def test_running_gate_pending_under_budget(self):
        end = T0 + 9 * 60
        signals = {n: full_series(T0, end) for n in NAMES}
        signals["dao"][T0 + 60] = 0.0  # one bad bucket, far under the budget
        out = self.eval(signals, full_series(T0, end), T0, end,
                        now=START + timedelta(minutes=15))
        self.assertEqual(out["gate_status"], "pending")
        self.assertIsNone(out["gate_reason"])


class DurationValidationTests(unittest.TestCase):
    def test_new_state_rejects_short_or_nonfinite_duration(self):
        for bad in (29.999, 0, -5, float("nan"), float("inf"), float("-inf")):
            with self.assertRaises(ValueError):
                g8e.new_state(started=START, duration_days=bad)
        state = g8e.new_state(started=START, duration_days=30)
        self.assertEqual(state["status"], "running")
        state = g8e.new_state(started=START, duration_days=45)
        self.assertEqual(state["status"], "running")


class StateFileTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, "g8_run.json")

    def test_start_writes_v2_and_refuses_second_running_run(self):
        self.assertEqual(g8e.cmd_start(self.path, started=START, started_by="me"), 0)
        state = g8e.read_state(self.path)
        self.assertEqual(state["schema_version"], 2)
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["gate_status"], "pending")
        self.assertEqual(state["evidence_policy"], g8e.DEFAULT_POLICY)
        self.assertTrue(state["run_id"].startswith("g8-"))
        self.assertEqual(g8e.cmd_start(self.path), 1)
        self.assertEqual(g8e.read_state(self.path)["run_id"], state["run_id"])

    def test_start_archives_previous_state(self):
        old = make_state(status="stopped")
        g8e.atomic_write(self.path, old)
        self.assertEqual(g8e.cmd_start(self.path, started_by="me"), 0)
        archive = os.path.join(self.dir, f"g8_run.{old['run_id']}.json")
        self.assertTrue(os.path.exists(archive))
        self.assertEqual(g8e.read_state(archive)["run_id"], old["run_id"])
        self.assertEqual(g8e.read_state(self.path)["status"], "running")

    def test_update_no_state_legacy_or_stopped_is_noop(self):
        self.assertEqual(g8e.cmd_update(self.path, "http://x", now=START), 0)
        self.assertFalse(os.path.exists(self.path))
        g8e.atomic_write(self.path, {"started": START.isoformat(), "status": "running"})
        before = open(self.path, "rb").read()
        self.assertEqual(g8e.cmd_update(self.path, "http://x", now=START), 0)
        self.assertEqual(open(self.path, "rb").read(), before)
        state = make_state(status="stopped")
        g8e.atomic_write(self.path, state)
        before = open(self.path, "rb").read()
        self.assertEqual(g8e.cmd_update(self.path, "http://x", now=START), 0)
        self.assertEqual(open(self.path, "rb").read(), before)

    def test_update_terminal_window_elapsed_is_noop(self):
        state = make_state(status="window_elapsed", window_status="window_elapsed",
                           gate_status="passed", uptime_percent=100.0)
        g8e.atomic_write(self.path, state)
        before = open(self.path, "rb").read()
        called = []

        def spy(*a, **kw):
            called.append(a)
            return []
        self.assertEqual(g8e.cmd_update(self.path, "http://x",
                                        now=START + timedelta(days=31),
                                        query_fn=spy), 0)
        self.assertEqual(called, [])
        self.assertEqual(open(self.path, "rb").read(), before)

    def test_update_query_failure_leaves_state_bytes_unchanged(self):
        g8e.atomic_write(self.path, make_state())
        before = open(self.path, "rb").read()

        def boom(*a, **kw):
            raise ConnectionError("prometheus unreachable")
        rc = g8e.cmd_update(self.path, "http://x",
                            now=START + timedelta(minutes=5), query_fn=boom)
        self.assertEqual(rc, 1)
        self.assertEqual(open(self.path, "rb").read(), before)

    def test_update_success_merges_synthetic_matrix(self):
        g8e.atomic_write(self.path, make_state())
        end = START + timedelta(minutes=5)

        def fake_query(prom, expr, start, end_ts, step):
            vals = {b: 1.0 for b in range(int(start), int(end_ts) + 1, step)}
            return matrix(vals)
        self.assertEqual(g8e.cmd_update(self.path, "http://x", now=end,
                                        query_fn=fake_query), 0)
        state = g8e.read_state(self.path)
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["uptime_percent"], 100.0)
        self.assertEqual(state["evidence_coverage_percent"], 100.0)
        self.assertEqual(state["sample_counts"], {"expected": 6, "covered": 6, "good": 6})
        self.assertIn("last_evidence_update", state)

    def test_stop_preserves_fields(self):
        state = make_state(gate_status="passed", extra_field={"keep": 1})
        g8e.atomic_write(self.path, state)
        self.assertEqual(g8e.cmd_stop(self.path, now=START + timedelta(hours=1)), 0)
        out = g8e.read_state(self.path)
        self.assertEqual(out["status"], "stopped")
        self.assertEqual(out["window_status"], "stopped")
        self.assertEqual(out["gate_status"], "passed")
        self.assertEqual(out["extra_field"], {"keep": 1})
        self.assertIn("stopped_at", out)

    def test_stop_pending_becomes_evidence_incomplete(self):
        state = make_state()  # running, gate pending, no evidence yet
        g8e.atomic_write(self.path, state)
        self.assertEqual(g8e.cmd_stop(self.path, now=START + timedelta(hours=1)), 0)
        out = g8e.read_state(self.path)
        self.assertEqual(out["gate_status"], "evidence_incomplete")
        self.assertEqual(out["gate_reason"], "stopped_before_window_end")

    def test_stop_with_critical_incident_fails_gate(self):
        state = make_state(
            gate_status="failed",
            gate_reason="critical_incident",
            critical_incidents=[{"duration_seconds": 1000}],
        )
        g8e.atomic_write(self.path, state)
        self.assertEqual(g8e.cmd_stop(self.path), 0)
        out = g8e.read_state(self.path)
        self.assertEqual(out["gate_status"], "failed")
        self.assertEqual(out["gate_reason"], "critical_incident")

    def test_stop_with_exhausted_budget_fails_gate(self):
        # 44 bad buckets > budget of 43 for a 30d/60s-step window.
        state = make_state(
            gate_status="pending",
            sample_counts={"expected": 100, "covered": 100, "good": 56},
        )
        g8e.atomic_write(self.path, state)
        self.assertEqual(g8e.cmd_stop(self.path), 0)
        out = g8e.read_state(self.path)
        self.assertEqual(out["gate_status"], "failed")
        self.assertEqual(out["gate_reason"], "downtime_budget_exhausted")

    def test_stop_under_budget_pending_becomes_incomplete(self):
        state = make_state(
            gate_status="pending",
            sample_counts={"expected": 100, "covered": 100, "good": 99},
        )
        g8e.atomic_write(self.path, state)
        self.assertEqual(g8e.cmd_stop(self.path), 0)
        out = g8e.read_state(self.path)
        self.assertEqual(out["gate_status"], "evidence_incomplete")
        self.assertEqual(out["gate_reason"], "stopped_before_window_end")

    def test_status_prints_without_mutation(self):
        state = make_state()
        g8e.atomic_write(self.path, state)
        before = open(self.path, "rb").read()
        self.assertEqual(g8e.cmd_status(self.path), 0)
        self.assertEqual(open(self.path, "rb").read(), before)

    def test_start_rejects_short_duration_without_writing(self):
        self.assertEqual(
            g8e.cmd_start(self.path, started=START, duration_days=29.999), 2)
        self.assertFalse(os.path.exists(self.path))
        self.assertEqual(
            g8e.cmd_start(self.path, started=START, duration_days=30), 0)
        self.assertEqual(g8e.read_state(self.path)["status"], "running")

    def test_lock_released_after_failing_operation(self):
        g8e.atomic_write(self.path, make_state())

        def boom(*a, **kw):
            raise ConnectionError("prometheus unreachable")
        self.assertEqual(
            g8e.cmd_update(self.path, "http://x",
                           now=START + timedelta(minutes=2), query_fn=boom), 1)
        self.assertTrue(os.path.exists(self.path + ".lock"))
        self.assertEqual(
            g8e.cmd_stop(self.path, now=START + timedelta(minutes=3)), 0)
        self.assertEqual(g8e.read_state(self.path)["status"], "stopped")


if __name__ == "__main__":
    unittest.main()
