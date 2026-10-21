import argparse
import unittest
from unittest.mock import patch

import vast_inference
import vastctl


def deploy_args(**overrides):
    values = {
        "name": "hiran-vllm",
        "port": 8000,
        "gpu_memory_utilization": 0.6,
        "max_model_len": 8192,
        "model": "Qwen/Qwen2.5-Coder-3B-Instruct",
        "image": "vllm/vllm-openai:v0.8.5",
    }
    values.update(overrides)
    return argparse.Namespace(**values)


class VastInferenceTests(unittest.TestCase):
    def test_deploy_binds_api_to_remote_loopback_and_does_not_rent(self):
        script = vast_inference.build_deploy_script(deploy_args())
        self.assertIn("-p 127.0.0.1:8000:8000", script)
        self.assertIn("--gpus all", script)
        self.assertIn("--gpu-memory-utilization 0.6", script)
        self.assertNotIn("vastai rent", script)
        self.assertNotIn("0.0.0.0:8000:", script)

    def test_deploy_shell_quotes_model_and_refuses_existing_container(self):
        args = deploy_args()
        script = vast_inference.build_deploy_script(args)
        self.assertIn("already exists", script)
        self.assertIn("Qwen/Qwen2.5-Coder-3B-Instruct", script)
        with self.assertRaisesRegex(ValueError, "Hugging Face"):
            vast_inference.build_deploy_script(
                deploy_args(model="model name; echo unsafe")
            )

    def test_invalid_values_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "container name"):
            vast_inference.build_deploy_script(deploy_args(name="bad;name"))
        with self.assertRaisesRegex(ValueError, "GPU memory"):
            vast_inference.build_deploy_script(deploy_args(gpu_memory_utilization=1.0))
        with self.assertRaisesRegex(ValueError, "port"):
            vast_inference.build_deploy_script(deploy_args(port=0))
        with self.assertRaisesRegex(ValueError, "latest"):
            vast_inference.build_deploy_script(
                deploy_args(image="vllm/vllm-openai:latest")
            )

    def test_status_reports_api_not_ready(self):
        script = vast_inference.build_status_script("hiran-vllm", 8000)
        self.assertIn("Inference API is not ready or unreachable", script)
        self.assertIn("exit 1", script)

    def test_same_origin_validation_rejects_cross_site_requests(self):
        self.assertTrue(vastctl.same_origin_request(
            "https://vast.example.com", "vast.example.com"
        ))
        self.assertFalse(vastctl.same_origin_request(
            "https://attacker.example", "vast.example.com"
        ))
        self.assertFalse(vastctl.same_origin_request(None, "vast.example.com"))
        self.assertFalse(vastctl.same_origin_request(
            "https://vast.example.com/other", "vast.example.com"
        ))

    def test_deploy_endpoint_requires_confirmation_and_targets_running_rig(self):
        query = {
            "id": ["12"],
            "confirm": ["1"],
            "model": ["Qwen/Qwen2.5-Coder-3B-Instruct"],
        }
        instance = {
            "id": 12,
            "actual_status": "running",
            "ssh_host": "ssh.vast.ai",
            "ssh_port": 2200,
        }
        with patch.object(vast_inference.vastctl, "instances", return_value=[instance]), \
                patch.object(vast_inference, "execute_ssh", return_value=0) as execute:
            body, status = vastctl.inference_action("deploy", query)
        self.assertEqual(status, 200)
        self.assertIn("(exit 0)", body)
        self.assertIn("127.0.0.1:8000:8000", execute.call_args.args[1])

        query.pop("confirm")
        with patch.object(vast_inference.vastctl, "instances") as instances:
            with self.assertRaisesRegex(ValueError, "explicit confirmation"):
                vastctl.inference_action("deploy", query)
        instances.assert_not_called()

    @patch.object(vast_inference.vastctl, "instances")
    def test_only_running_instances_with_ssh_are_accepted(self, instances):
        instances.return_value = [
            {"id": 12, "actual_status": "stopped", "ssh_host": "ssh.vast.ai", "ssh_port": 2200}
        ]
        with self.assertRaisesRegex(ValueError, "not running"):
            vast_inference.get_running_instance("12")

        instances.return_value = [
            {"id": 12, "actual_status": "running", "ssh_host": "bad;host", "ssh_port": 2200}
        ]
        with self.assertRaisesRegex(ValueError, "safe SSH host"):
            vast_inference.get_running_instance("12")

    @patch.object(vast_inference.vastctl, "instances")
    def test_tunnel_forwards_to_remote_loopback(self, instances):
        instances.return_value = [
            {"id": 12, "actual_status": "running", "ssh_host": "ssh.vast.ai", "ssh_port": 2200}
        ]
        instance = vast_inference.get_running_instance("12")
        with patch("builtins.print") as output:
            vast_inference.print_tunnel(instance, 18000, 8000)
        command = output.call_args_list[0].args[0]
        self.assertIn("-L 18000:127.0.0.1:8000", command)
        self.assertIn("root@ssh.vast.ai", command)
        self.assertIn("LLM_BASE_URL=http://127.0.0.1:18000/v1",
                      output.call_args_list[1].args[0])

    @patch.object(vast_inference.vastctl, "instances")
    def test_non_running_or_missing_ids_never_reach_ssh(self, instances):
        instances.return_value = []
        with patch.object(vast_inference, "execute_ssh") as execute:
            with self.assertRaises(SystemExit) as error:
                vast_inference.main(["status", "12"])
        self.assertEqual(error.exception.code, 2)
        execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
