"""Offline regressions. Never reads production env or contacts a real service."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import subprocess
import unittest
from unittest.mock import mock_open, patch

spec = importlib.util.spec_from_file_location("writepath_probe", Path(__file__).with_name("zion-writepath-probe.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class PayoutFreshnessTests(unittest.TestCase):
    def setUp(self):
        probe._help_emitted.clear()

    def payload(self, **over):
        body = {
            "ok": True,
            "source": "recorded",
            "latest_recorded_ts": 900,
            "payouts": [{"ts": 900, "coin": "zion", "status": "sent"}],
        }
        body.update(over)
        return body

    def test_recorded_row_age(self):
        text = "\n".join(probe.payout_metrics(self.payload(), 1000))
        self.assertIn("zion_pool_last_payout_age_seconds 100", text)
        self.assertIn("zion_pool_payouts_api_ok 1", text)
        self.assertIn("zion_pool_payout_measurement_ok 1", text)

    def test_queued_rows_cannot_mask_the_ledger(self):
        old = {"ok": True, "payouts": [{"ts": None, "status": "queued"}, {"ts": 900, "status": "sent"}]}
        self.assertIsNone(probe.recorded_payout_timestamp(old, 1000))
        mixed = {"ok": True, "latest_recorded_ts": 900, "payouts": [{"ts": None, "status": "queued"}]}
        self.assertEqual(probe.recorded_payout_timestamp(mixed, 1000), 900)
        text = "\n".join(probe.payout_metrics(mixed, 1000))
        self.assertIn("zion_pool_payout_measurement_ok 1", text)
        self.assertIn("zion_pool_last_payout_age_seconds 100", text)
        self.assertIn("coin=zion", probe.PAYOUT_URL)

    def test_http_failure_omits_age_and_measurement(self):
        text = "\n".join(probe.payout_metrics(None, 1000))
        self.assertIn("zion_pool_payouts_api_ok 0", text)
        self.assertNotIn("zion_pool_payout_measurement_ok", text)
        self.assertNotIn("zion_pool_last_payout_age_seconds", text)

    def test_invalid_time_does_not_become_fresh_zero(self):
        for ts in [None, True, False, "900", 0, -1, 1001, float("nan"), float("inf")]:
            with self.subTest(ts=ts):
                text = "\n".join(probe.payout_metrics(self.payload(latest_recorded_ts=ts), 1000))
                self.assertIn("zion_pool_payouts_api_ok 1", text)
                self.assertIn("zion_pool_payout_measurement_ok 0", text)
                self.assertNotIn("zion_pool_last_payout_age_seconds", text)

    def test_wrong_contract_empty_queue_or_coin_fail_closed(self):
        for payload in [None, [], {"ok": False}, {"ok": True, "payouts": []},
                        {"ok": True, "source": "recorded", "payouts": []},
                        {"ok": True, "source": "all", "payouts": [{"ts": 900}]},
                        {"ok": True, "latest_recorded_ts": None, "payouts": [{"ts": 900}]}]:
            with self.subTest(payload=payload):
                self.assertIsNone(probe.recorded_payout_timestamp(payload, 1000))

    def test_measurement_alert_watches_zero_and_absence(self):
        rules = Path(__file__).with_name("zion_writepath.rules.yml").read_text()
        self.assertIn("zion_pool_last_payout_age_seconds > 3600", rules)
        self.assertIn(
            "zion_pool_payout_measurement_ok == 0 or absent(zion_pool_payout_measurement_ok)",
            rules,
        )

    def test_stale_row_remains_stale(self):
        self.assertIn("zion_pool_last_payout_age_seconds 5000", "\n".join(probe.payout_metrics(self.payload(latest_recorded_ts=1), 5001)))

    def test_labels_are_escaped(self):
        self.assertIn(r'alias="a\"b\\c"', probe.m("fixture", 1, {"alias": 'a"b\\c'}))

    def test_pg_timeout_still_publishes_failed_pg_and_payout_metrics(self):
        def http(url, *args, **kwargs):
            if url == probe.PAYOUT_URL:
                return self.payload()
            return None

        def run(args, **kwargs):
            if args[0] == "psql":
                raise subprocess.TimeoutExpired(args, 8)
            return SimpleNamespace(stdout="active", returncode=0)

        with patch.object(probe, "http_json", side_effect=http), patch.object(probe.subprocess, "run", side_effect=run), \
                patch("builtins.open", mock_open(read_data="DATABASE_URL=postgresql://zion:fixture-only@localhost/zion\n")), \
                patch.object(probe.time, "time", return_value=1000):
            text = probe.collect_metrics()
        self.assertIn("zion_dbsync_pg_ok 0", text)
        self.assertIn("zion_pool_last_payout_age_seconds 100", text)
        self.assertIn("zion_writepath_probe_success_timestamp_seconds 1000", text)
        self.assertNotIn("fixture-only", text)


if __name__ == "__main__":
    unittest.main()
