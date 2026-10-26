import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class BetaReleaseTest(unittest.TestCase):
    def test_site_release_stage_and_tagline(self):
        site = read("apps/website-v2.9/src/lib/site.ts")
        self.assertIn("SITE_RELEASE_STAGE = 'beta'", site)
        self.assertIn("SITE_RELEASE_TAGLINE = 'Mainnet Beta'", site)

    def test_versions_unchanged(self):
        root_cargo = read("Cargo.toml")
        self.assertRegex(root_cargo, r'(?m)^version\s*=\s*"3\.2\.0-beta\.1"')
        v31_cargo = read("V31/Cargo.toml")
        self.assertRegex(v31_cargo, r'(?m)^version\s*=\s*"3\.2\.0"')
        website = json.loads(read("apps/website-v2.9/package.json"))
        self.assertEqual(website["version"], "3.2.0")
        desktop = json.loads(read("apps/desktop-agent/package.json"))
        self.assertEqual(desktop["version"], "3.2.0")

    def test_intro_no_current_stable_claim(self):
        for rel in (
            "apps/IntroPage/src/app/maintenance.html",
            "apps/IntroPage/public/assets/js/intro-tabs.js",
        ):
            text = read(rel)
            self.assertIsNone(
                re.search(r"3\.2\.0[^\n]{0,40}mainnet stable|mainnet stable[^\n]{0,40}3\.2\.0", text, re.I),
                rel,
            )
            self.assertRegex(text, re.compile(r"mainnet beta", re.I), rel)

    def test_portal_badges(self):
        for rel in (
            "apps/pool-ui/src/components/Footer.tsx",
            "apps/MarketPlace/src/app/layout.tsx",
            "apps/OasisWeb/src/components/Navbar.tsx",
            "apps/IntroPage/freeworld/src/index.html",
        ):
            self.assertIn("Mainnet Beta", read(rel), rel)

    def test_mobile_labels(self):
        config = read("apps/mobile-app/src/constants/config.js")
        self.assertIn("VERSION: '3.0.6'", config)
        self.assertIn("NETWORK_RELEASE_LABEL", config)
        self.assertIn("Mainnet Beta", config)
        self.assertIn("CLIENT_STAGE", config)
        self.assertIn("'preview'", config)
        settings = read("apps/mobile-app/src/screens/SettingsScreen.js")
        self.assertIn("NETWORK_RELEASE_LABEL", settings)
        self.assertIn("CLIENT_STAGE", settings)

    def test_public_docs_current_stage(self):
        D = "apps/website-v2.9/public/docs/"
        beta = re.compile(r"mainnet beta", re.I)
        stable_cur = re.compile(r"current[^\n]{0,80}mainnet stable|aktu[čc]n[^\n]{0,80}mainnet stable|3\.2\.0[^\n]{0,40}mainnet stable|mainnet stable[^\n]{0,40}3\.2\.0", re.I)
        for rel in (D+"index.md", D+"cs/index.md", D+"en/index.md",
                    D+"v3.2.0/README.md", D+"cs/v3.2.0/README.md",
                    D+"v3.2.0/roadmap.md", D+"cs/v3.2.0/roadmap.md",
                    D+"mainnet/coingecko.md", D+"cs/mainnet/coingecko.md", D+"en/mainnet/coingecko.md",
                    D+"onboard/LITE.md", D+"onboard/MASSIVE_ONBOARDING.md",
                    D+"onboard/en/LITE.md", D+"onboard/en/MASSIVE_ONBOARDING.md"):
            text = read(rel)
            self.assertRegex(text, beta, rel)
            self.assertIsNone(re.search(r"is \*\*a Mainnet Stable candidate\*\*|is the \*\*Mainnet Stable candidate\*\*|kandidující na Mainnet Stable|kandidátem na Mainnet Stable", text), rel)
            head = "\n".join(text.split("\n")[:15])
            self.assertIsNone(stable_cur.search(head), rel)
        cg = read(D+"mainnet/coingecko.md")
        self.assertIn("3.1.0-alpha", cg)
        self.assertRegex(cg, re.compile(r"alpha[^\n]{0,40}2026-08-06|2026-08-06[^\n]{0,40}alpha", re.I))
        for base in ("canon/books", "docs/WP", "apps/website-v2.9/public/docs/WP"):
            for lang in ("CZ", "EN"):
                text = read(f"{base}/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_{lang}.md")
                self.assertRegex(text[:3000], beta, f"{base}/{lang}")
                self.assertIn("2026-10-26", text[:3000])

    def test_news_history_and_beta_announcement(self):
        feed = read("apps/website-v2.9/src/components/NewsFeed.tsx")
        hist = feed[feed.index("zion-v320-one-love-mainnet-stable"):]
        hist = hist[: hist.index("href:")]
        self.assertIn("2026-08-06", hist)
        self.assertIn("Alpha", hist)
        beta = feed[feed.index("zion-v320-mainnet-beta"):]
        beta = beta[: beta.index("href:")]
        self.assertIn("2026-10-26", beta)
        self.assertIn("Mainnet Beta", beta)

    def test_node_protocol_version_retained(self):
        runtime = read("V31/L1/core/src/node_runtime.rs")
        self.assertIn('NODE_PROTOCOL_VERSION: &str = "zion-v3-node/3.1.0-alpha"', runtime)

    def test_cli_and_miner_beta_labels(self):
        cli = read("V31/cli/src/main.rs")
        self.assertIn("ZION Mainnet Beta CLI", cli)
        banner = read("V31/L1/miner/src/banner.rs")
        self.assertIn("Mainnet Beta", banner)


if __name__ == "__main__":
    unittest.main()
