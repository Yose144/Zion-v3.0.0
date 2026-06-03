# ZION V3 — CI / GitHub Actions Billing Fix

## Problem

GitHub Actions jobs finish in 3–10 seconds with `runner_name=""` and zero steps executed.

**Root cause:** The repository is **private** and the GitHub Actions spending limit is set to `$0` (default). The free tier minutes for private repos have been exhausted.

**Evidence:**
- Jobs appear as "completed" in seconds with no runner assigned
- `v3-ci.yml` and `v3-release.yml` never actually run tests, clippy, or builds
- Dependabot PRs cannot be validated by CI

## Solution Options

### Option A — Set Spending Limit > $0 (Fastest)

1. Go to: https://github.com/settings/billing/spending_limits
2. Click "Update spending limit"
3. Set a limit > $0 (e.g., $20–50/month for a private repo)
4. CI will resume immediately — no code changes needed

**Cost estimate:** ~$0.008/minute for Linux runners. A full `v3-ci.yml` run (~20 min) ≈ $0.16. 50 runs/month ≈ $8.

### Option B — Make Repo Public (Free)

1. Go to repository Settings → General → Danger Zone
2. Click "Change visibility" → "Make public"
3. GitHub Actions on public repos = **unlimited free minutes** for Linux runners
4. **Security consideration:** Ensure no secrets are in history (already done via `git filter-repo` on 2026-05-07)

### Option C — Self-Hosted Runner (Advanced)

1. Register the Edge server (Hetzner) as a self-hosted runner:
   ```bash
   # On Edge server
   mkdir actions-runner && cd actions-runner
   curl -o actions-runner-linux-x64-2.323.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.323.0/actions-runner-linux-x64-2.323.0.tar.gz
   tar xzf ./actions-runner-linux-x64-2.323.0.tar.gz
   ./config.sh --url https://github.com/Yose144/Zion-v3.0.0 --token <GITHUB_PAT>
   ./run.sh
   ```
2. Update `.github/workflows/v3-ci.yml` to use `runs-on: self-hosted`
3. **Risk:** The runner machine must be secured (no secrets in env, firewall, auto-updates)

## Recommended Path

**For immediate relief:** Option A ($20 limit) — takes 2 minutes, no code changes.

**For long-term sustainability:** Option B (public repo) — after confirming no leaked secrets remain in history.

## Dependabot Status

Even after CI is fixed, Dependabot PRs (#1–#17) need manual review because:
- Cargo bumps may need `cargo check` + `cargo test`
- Actions bumps need workflow syntax validation

Batch merge script (after CI is live):
```bash
# Review all open Dependabot PRs
gh pr list --author dependabot[bot] --limit 20

# Batch approve + merge (minor/patch only)
gh pr list --author dependabot[bot] --json number,title | \
  jq -r '.[] | select(.title | contains("bump")) | .number' | \
  xargs -I{} gh pr review {} --approve && gh pr merge {} --auto --squash
```

## Verification

After applying Option A or B:
1. Push a dummy commit to a branch:
   ```bash
   git checkout -b ci-test
   echo "# CI test" >> V3/README.md
   git commit -am "ci: test runner"
   git push origin ci-test
   ```
2. Open PR: `gh pr create --title "CI test" --body "Verify runner picks up jobs"`
3. Check Actions tab — jobs should show actual steps (checkout, rust-cache, cargo test, etc.)
4. Merge if green, delete branch
