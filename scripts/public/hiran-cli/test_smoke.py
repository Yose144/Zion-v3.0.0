#!/usr/bin/env python3
"""Offline smoke for the public Hiran CLI. Does not call the network."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import api  # noqa: E402
import splash  # noqa: E402
import tools  # noqa: E402
from repl import FAQ, GLOSSARY, HELP, MENU  # noqa: E402


class SplashTests(unittest.TestCase):
    def test_full_art_has_tree_wordmark_and_genesis(self):
        text = splash.render(narrow=False)
        self.assertIn("ZION", text)
        self.assertIn("GENESIS", text)
        self.assertIn("█", text)
        self.assertIn("⡀", text)

    def test_narrow_keeps_wordmark(self):
        text = splash.render(narrow=True)
        self.assertIn("ZION", text)
        self.assertIn("GENESIS", text)
        self.assertIn("█", text)
        self.assertNotIn("⡀", text)


class StreamTests(unittest.TestCase):
    def test_one_sse_chunk(self):
        event = api.parse_sse_line('data: {"choices":[{"delta":{"content":"Hi"}}]}')
        acc = api.new_acc()
        self.assertEqual(api.apply_delta(acc, event), "Hi")
        self.assertEqual(acc["content"], "Hi")
        done = api.parse_sse_line("data: [DONE]")
        self.assertEqual(done, {"done": True})
        self.assertEqual(api.apply_delta(acc, done), "")

    def test_tool_call_delta_is_not_printed(self):
        line = (
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1",'
            '"function":{"name":"read_file","arguments":"{\\"path\\":\\"a.txt\\"}"}}]}}]}'
        )
        acc = api.new_acc()
        self.assertEqual(api.apply_delta(acc, api.parse_sse_line(line)), "")
        calls, native = tools.calls_from_acc(acc)
        self.assertTrue(native)
        self.assertEqual(calls[0]["name"], "read_file")
        self.assertEqual(calls[0]["args"]["path"], "a.txt")


class PolicyTests(unittest.TestCase):
    def test_jail_and_secrets(self):
        cwd = Path("/tmp/zion-hiran-jail")
        policy = tools.Policy(cwd)
        self.assertEqual(policy.resolve("src/main.py"), cwd / "src" / "main.py")
        with self.assertRaises(tools.PolicyError):
            policy.resolve("../etc/passwd")
        with self.assertRaises(tools.PolicyError):
            policy.resolve("/etc/passwd")
        with self.assertRaises(tools.PolicyError):
            policy.resolve(".zion/agent.toml")
        with self.assertRaises(tools.PolicyError):
            policy.resolve(".env")

    def test_shell_allowlist(self):
        policy = tools.Policy("/tmp/zion-hiran-jail")
        self.assertEqual(policy.check_shell("ls -la")[0], "ls")
        with self.assertRaises(tools.PolicyError):
            policy.check_shell("echo hi | cat")
        with self.assertRaises(tools.PolicyError):
            policy.check_shell("curl https://example.com")

    def test_replace_and_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "note.txt"
            target.write_text("alpha beta\n", encoding="utf-8")
            policy = tools.Policy(root)
            os.environ["ZION_AGENT_FORCE_YES"] = "1"
            try:
                got = tools.execute(policy, {
                    "name": "str_replace",
                    "args": {"path": "note.txt", "old_string": "alpha", "new_string": "gamma"},
                })
            finally:
                os.environ.pop("ZION_AGENT_FORCE_YES", None)
            self.assertIn("replaced", got)
            self.assertEqual(target.read_text(encoding="utf-8"), "gamma beta\n")
            text = tools.execute(policy, {"name": "read_file", "args": {"path": "note.txt"}})
            self.assertIn("gamma", text)


class HelpTests(unittest.TestCase):
    def test_menu_and_guide(self):
        self.assertIn("1  Chat", MENU)
        self.assertIn("8  Help", MENU)
        self.assertIn("9  FAQ", MENU)
        self.assertIn("10  Glossary", MENU)
        self.assertIn("/help", HELP)
        self.assertIn("/faq", HELP)
        self.assertIn("What is Zion Hiran?", FAQ)
        self.assertIn("1 ZION = 1 000 000 flowers", GLOSSARY)
        self.assertIn("/agent", HELP)
        self.assertIn("/login", HELP)
        self.assertIn("~/.zion/agent.toml", HELP)
        self.assertIn("market.zionterranova.com/ai/cli", HELP)


class ProcessTests(unittest.TestCase):
    def test_help_quit_hides_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".zion").mkdir(parents=True)
            (home / ".zion" / "agent.toml").write_text(
                'api_key = "zis_test_should_not_print"\nmodel = "hiran-mini"\n',
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            env["NO_COLOR"] = "1"
            env.pop("ZION_HIRAN_API_KEY", None)
            proc = subprocess.run(
                [sys.executable, str(HERE / "__main__.py")],
                input="/help\n/quit\n",
                text=True,
                capture_output=True,
                env=env,
                timeout=15,
                cwd=tmp,
            )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = proc.stdout + proc.stderr
        self.assertIn("ZION", out)
        self.assertIn("GENESIS", out)
        self.assertIn("1  Chat", out)
        self.assertIn("9  FAQ", out)
        self.assertIn("/help", out)
        self.assertIn("/agent", out)
        self.assertNotIn("zis_", out)


if __name__ == "__main__":
    unittest.main()
