//! Process manager — spawns, monitors, and controls the miner process.

use anyhow::{Context, Result};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;

pub enum MinerEvent {
    Stdout(String),
    Stderr(String),
    Exit(i32),
}

pub struct MinerProcess {
    child: Child,
    pub event_rx: mpsc::Receiver<MinerEvent>,
}

impl MinerProcess {
    /// Spawn the miner binary with given arguments.
    pub fn spawn(
        miner_binary: &str,
        pool: &str,
        wallet: &str,
        worker: &str,
        threads: u32,
        dashboard_url: Option<&str>,
    ) -> Result<Self> {
        let mut cmd = Command::new(miner_binary);
        cmd.arg("--pool").arg(pool)
            .arg("--wallet").arg(wallet)
            .arg("--worker").arg(worker)
            .arg("--threads").arg(threads.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(url) = dashboard_url {
            cmd.arg("--dashboard-url").arg(url);
        }

        let mut child = cmd.spawn()
            .with_context(|| format!("spawn miner: {miner_binary}"))?;

        let (tx, rx) = mpsc::channel();

        // Stdout reader thread
        if let Some(stdout) = child.stdout.take() {
            let tx_out = tx.clone();
            std::thread::Builder::new()
                .name("miner-stdout".into())
                .spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        match line {
                            Ok(l) => { let _ = tx_out.send(MinerEvent::Stdout(l)); }
                            Err(_) => break,
                        }
                    }
                })
                .ok();
        }

        // Stderr reader thread
        if let Some(stderr) = child.stderr.take() {
            let tx_err = tx.clone();
            std::thread::Builder::new()
                .name("miner-stderr".into())
                .spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        match line {
                            Ok(l) => { let _ = tx_err.send(MinerEvent::Stderr(l)); }
                            Err(_) => break,
                        }
                    }
                })
                .ok();
        }

        // Exit watcher: the caller handles exit detection via try_wait.
        let _tx_exit = tx;

        Ok(Self {
            child,
            event_rx: rx,
        })
    }

    /// Check if the miner is still running.
    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    /// Get the exit code if the process has exited.
    pub fn exit_code(&mut self) -> Option<i32> {
        self.child.try_wait().ok().flatten().map(|s| s.code().unwrap_or(-1))
    }

    /// Send SIGTERM / kill the miner process.
    pub fn stop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }

    /// Get the PID.
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
}

impl Drop for MinerProcess {
    fn drop(&mut self) {
        // Ensure child is cleaned up
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
