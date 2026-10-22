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


if __name__ == "__main__":
    unittest.main()
