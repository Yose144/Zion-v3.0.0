import unittest
from unittest.mock import patch

import vastctl


class AiStatusTests(unittest.TestCase):
    def test_parses_gpu_and_openai_compatible_model_list(self):
        output = """==GPU==
NVIDIA GeForce RTX 3060, 12288, 4096, 8192, 100, 74, 170.50
==MODELS==
{"object":"list","data":[{"id":"coder-model","object":"model"}]}
==SERVER==
llama-server
"""
        rig = vastctl.parse_ai_probe(
            {"id": 57054247, "gpu_name": "RTX 3060", "ssh_host": "host",
             "ssh_port": 22000, "dph_total": 0.07},
            output,
        )
        self.assertEqual(rig["gpus"][0]["memory_free_mib"], 8192)
        self.assertEqual(rig["gpus"][0]["utilization_pct"], 100)
        self.assertEqual(rig["models"], ["coder-model"])
        self.assertTrue(rig["inference_reachable"])
        self.assertEqual(rig["servers"], ["llama-server"])

    def test_gpu_without_model_server_is_not_inference_ready(self):
        output = """==GPU==
NVIDIA GeForce RTX 3060, 12288, 100, 12188, 0, 35, 20.00
==MODELS==
==SERVER==
"""
        rig = vastctl.parse_ai_probe({"id": 7}, output)
        self.assertEqual(len(rig["gpus"]), 1)
        self.assertFalse(rig["inference_reachable"])
        self.assertEqual(rig["models"], [])
        self.assertIsNone(rig["error"])

    def test_ai_status_aggregates_inventory_without_claiming_shared_vram(self):
        gpu = {
            "name": "RTX 3060",
            "memory_total_mib": 12288,
            "memory_used_mib": 1024,
            "memory_free_mib": 11264,
            "utilization_pct": 100,
            "temperature_c": 74,
            "power_w": 170.0,
        }
        with patch.object(vastctl, "instances", return_value=[{"id": 1}, {"id": 2}]), \
                patch.object(vastctl, "ai_probe", side_effect=[
                    {"id": 1, "gpus": [gpu], "inference_reachable": True},
                    {"id": 2, "gpus": [gpu], "inference_reachable": False},
                ]):
            status = vastctl.ai_status()
        self.assertEqual(status["totals"]["gpu_count"], 2)
        self.assertEqual(status["totals"]["memory_free_mib"], 22528)
        self.assertEqual(status["totals"]["inference_rigs"], 1)
        self.assertIn("do not form shared memory", status["note"])

    def test_reports_probe_failure_without_leaking_empty_status(self):
        rig = vastctl.parse_ai_probe(
            {"id": 7}, "", rc=255, err="connection timed out"
        )
        self.assertEqual(rig["error"], "connection timed out")

    def test_ai_api_port_is_validated(self):
        with patch.object(vastctl, "AI_API_PORT", "8000"):
            self.assertEqual(vastctl.ai_api_port(), 8000)
        with patch.object(vastctl, "AI_API_PORT", "not-a-port"):
            with self.assertRaisesRegex(ValueError, "integer"):
                vastctl.ai_api_port()
        with patch.object(vastctl, "AI_API_PORT", "65536"):
            with self.assertRaisesRegex(ValueError, "between"):
                vastctl.ai_api_port()

    def test_probe_url_is_local_and_port_is_numeric(self):
        script = vastctl.ai_probe_script(8123)
        self.assertIn("http://127.0.0.1:8123/v1/models", script)
        self.assertNotIn("http://$(", script)


class AgentRegistryTests(unittest.TestCase):
    def setUp(self):
        self._db, self._file = vastctl._agents_cache, vastctl.AGENT_DB_FILE
        vastctl._agents_cache = {"rigs": {}, "secrets": {}, "events": []}
        vastctl.AGENT_DB_FILE = "/tmp/vastctl-agents-test.json"

    def tearDown(self):
        vastctl._agents_cache, vastctl.AGENT_DB_FILE = self._db, self._file

    def test_heartbeat_claims_pending_task_once(self):
        task = vastctl.agent_enqueue("r1", "exec", {"cmd": "echo hi"})
        first = vastctl.agent_heartbeat("r1", {"hostname": "h"})
        self.assertEqual([t["id"] for t in first["tasks"]], [task["id"]])
        self.assertEqual(vastctl.agent_heartbeat("r1", {})["tasks"], [])

    def test_result_marks_task_and_records_output(self):
        task = vastctl.agent_enqueue("r1", "exec", {"cmd": "true"})
        vastctl.agent_heartbeat("r1", {})
        resp = vastctl.agent_result("r1", task["id"], 0, "ok-out")
        self.assertEqual(resp["state"], "done")
        rig = vastctl._agents_cache["rigs"]["r1"]
        self.assertEqual(rig["results"][-1]["out"], "ok-out")

    def test_enqueue_rejects_non_exec_ops(self):
        with self.assertRaises(ValueError):
            vastctl.agent_enqueue("r1", "launch", {})
        with self.assertRaises(ValueError):
            vastctl.agent_enqueue("r1", "exec", {})

    def test_fleet_reports_last_seen_and_pending(self):
        vastctl.agent_enqueue("r2", "exec", {"cmd": "uptime"})
        vastctl.agent_heartbeat("r2", {"hostname": "rig-two"})
        vastctl.agent_enqueue("r2", "exec", {"cmd": "uptime"})
        fleet = vastctl.agent_fleet()["rigs"][0]
        self.assertEqual(fleet["rig_id"], "r2")
        self.assertEqual(fleet["pending"], 2)  # delivered + pending
        self.assertIsNotNone(fleet["age_s"])

    def test_enroll_issues_per_rig_secret_stored_hashed(self):
        import os
        os.environ["VASTCTL_ENROLL_TOKEN"] = "enroll-tok"
        try:
            out = vastctl.agent_enroll("enroll-tok", "rig-9", "host9")
        finally:
            del os.environ["VASTCTL_ENROLL_TOKEN"]
        self.assertEqual(out["rig_id"], "rig-9")
        self.assertTrue(out["secret"])
        # plaintext secret is never stored — sha256 only
        stored = vastctl._agents_cache["secrets"]["rig-9"]
        self.assertEqual(len(stored), 64)
        self.assertNotIn(out["secret"], str(vastctl._agents_cache))

    def test_enroll_rejects_bad_token(self):
        import os
        os.environ["VASTCTL_ENROLL_TOKEN"] = "enroll-tok"
        try:
            with self.assertRaises(ValueError):
                vastctl.agent_enroll("wrong", "rig-x", "h")
        finally:
            del os.environ["VASTCTL_ENROLL_TOKEN"]

    def test_per_rig_bearer_binds_rig_id(self):
        vastctl._agents_cache["secrets"]["r1"] = vastctl._sha256("sec1")
        ok = vastctl._agent_token_ok({"Authorization": "Bearer r1:sec1"})
        self.assertEqual(ok, "r1")
        self.assertFalse(vastctl._agent_token_ok(
            {"Authorization": "Bearer r1:badsec"}))
        self.assertFalse(vastctl._agent_token_ok(
            {"Authorization": "Bearer r2:sec1"}))
        self.assertFalse(vastctl._agent_token_ok({}))

    def test_audit_events_record_enqueue_result_enroll(self):
        import os
        os.environ["VASTCTL_ENROLL_TOKEN"] = "et"
        try:
            vastctl.agent_enroll("et", "r1", "h")
        finally:
            del os.environ["VASTCTL_ENROLL_TOKEN"]
        t = vastctl.agent_enqueue("r1", "exec", {"cmd": "uptime"})
        vastctl.agent_result("r1", t["id"], 0, "o")
        kinds = [e["kind"] for e in vastctl._agents_cache["events"]]
        self.assertEqual(kinds, ["enroll", "enqueue", "result"])

    # ── flight sheets (B3 v1) ──────────────────────────────────────────

    def test_sheet_set_validates_schema_and_miner(self):
        with self.assertRaises(ValueError):
            vastctl.agent_set_sheet("rig", "r1", {"bogus": 1})
        with self.assertRaises(ValueError):
            vastctl.agent_set_sheet("rig", "r1", {"coin": "qtu"})
        with self.assertRaises(ValueError):
            vastctl.agent_set_sheet("weird", "r1", {"miner": "srbminer"})
        out = vastctl.agent_set_sheet(
            "rig", "r1", {"miner": "srbminer", "coin": "qtu",
                          "duty": {"prl": 40}})
        self.assertEqual(len(out["hash"]), 12)

    def test_heartbeat_resolves_rig_sheet_over_group(self):
        vastctl.agent_set_group("r1", "vast-gpu")
        vastctl.agent_set_sheet("group", "vast-gpu", {"miner": "xmrig"})
        resp = vastctl.agent_heartbeat("r1", {})
        self.assertEqual(resp["desired"]["miner"], "xmrig")
        self.assertEqual(resp["desired"]["_scope"], "group")
        vastctl.agent_set_sheet("rig", "r1", {"miner": "zion-miner"})
        resp = vastctl.agent_heartbeat("r1", {})
        self.assertEqual(resp["desired"]["miner"], "zion-miner")
        self.assertEqual(resp["desired"]["_scope"], "rig")
        # hash is a deterministic 12-char hex, independent of scope keys
        self.assertRegex(resp["desired"]["hash"], "^[0-9a-f]{12}$")

    def test_sheet_clear_removes_desired(self):
        vastctl.agent_set_sheet("rig", "r1", {"miner": "xmrig"})
        self.assertTrue(vastctl.agent_clear_sheet("rig", "r1")["cleared"])
        self.assertNotIn("desired", vastctl.agent_heartbeat("r1", {}))
        self.assertFalse(vastctl.agent_clear_sheet("rig", "r1")["cleared"])

    def test_fleet_exposes_sheets_and_applied_state(self):
        vastctl.agent_set_group("r1", "g")
        vastctl.agent_set_sheet("group", "g", {"miner": "zion-miner"})
        vastctl.agent_heartbeat(
            "r1", {"applied_sheet": {"hash": "abc", "rc": 0}})
        fleet = vastctl.agent_fleet()
        rig = fleet["rigs"][0]
        self.assertEqual(rig["group"], "g")
        self.assertEqual(rig["desired"]["miner"], "zion-miner")
        self.assertEqual(rig["applied_sheet"]["hash"], "abc")
        self.assertEqual(fleet["sheets"]["groups"]["g"]["miner"], "zion-miner")


if __name__ == "__main__":
    unittest.main()
