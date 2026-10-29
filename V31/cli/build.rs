//! Embeds a build identifier (git commit, dirty flag) into the binary so a
//! running process can be traced back to its exact source — deploy
//! provenance (8.B3) without mtime guessing.
//!
//! Resolution order:
//! 1. `ZION_GIT_SHA` env override (CI / manual pinning)
//! 2. `.git-archive-sha` written by `git archive` via `export-subst`
//!    (clean-archive builds have no .git directory)
//! 3. live `git rev-parse` + `--dirty` marker for working-tree builds
//! 4. `unknown`

use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-env-changed=ZION_GIT_SHA");
    println!("cargo:rerun-if-changed=.git-archive-sha");

    let id = env::var("ZION_GIT_SHA")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(archive_sha)
        .or_else(git_sha)
        .unwrap_or_else(|| "unknown".to_string());
    println!("cargo:rustc-env=ZION_BUILD_ID={id}");
}

/// `.git-archive-sha` sits next to build.rs; in the worktree it holds the
/// literal `$Format:%H$` placeholder (detected and skipped), in a `git
/// archive` export it contains the expanded commit.
fn archive_sha() -> Option<String> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".git-archive-sha");
    let raw = std::fs::read_to_string(path).ok()?;
    let sha = raw.trim();
    if sha.starts_with("$Format") || sha.len() < 7 || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(sha[..12].to_string())
}

fn git_sha() -> Option<String> {
    let dir = env::var("CARGO_MANIFEST_DIR").ok()?;
    let out = Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .current_dir(&dir)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let mut sha = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let dirty = Command::new("git")
        .args(["status", "--porcelain", "--untracked-files=no"])
        .current_dir(&dir)
        .output()
        .ok()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);
    if dirty {
        sha.push_str("-dirty");
    }
    Some(sha)
}
