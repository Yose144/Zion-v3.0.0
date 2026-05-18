//! RevenueJournal — append-only, crash-safe audit log for revenue events.
//!
//! Format: JSON Lines (`.jsonl`), one JSON object per line.
//! Rotation: daily files `revenue_YYYY-MM-DD.jsonl`, retention configurable.
//! Replay: on startup, reads all `.jsonl` files to reconstruct state.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use serde::{Deserialize, Serialize};

/// A single persisted revenue entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub ts: String, // RFC3339
    #[serde(flatten)]
    pub payload: JournalPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum JournalPayload {
    ZionBlock {
        height: u64,
        subsidy: u64,
        pool_fee: u64,
        humanitarian: u64,
        issobella: u64,
        miner: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        tx_hash: Option<String>,
    },
    Event {
        source: String,
        value_usd: f64,
        qualifies: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        block_height: Option<u64>,
    },
    Payout {
        amount_usd: f64,
    },
    PayoutZion {
        amount: u64,
    },
}

#[derive(Debug)]
pub struct RevenueJournal {
    dir: PathBuf,
    #[allow(dead_code)]
    retention_days: u64,
    current_file: Arc<Mutex<Option<PathBuf>>>,
}

impl RevenueJournal {
    pub fn new(dir: impl AsRef<Path>, retention_days: u64) -> Self {
        let dir = dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self {
            dir,
            retention_days,
            current_file: Arc::new(Mutex::new(None)),
        }
    }

    pub fn from_env_or_default() -> Self {
        let dir = std::env::var("ZION_REVENUE_JOURNAL_DIR")
            .unwrap_or_else(|_| "./data/revenue_journal".to_string());
        let retention = std::env::var("ZION_REVENUE_JOURNAL_DAYS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(90);
        Self::new(dir, retention)
    }

    pub fn append(&self, payload: JournalPayload) -> std::io::Result<()> {
        let ts = Utc::now().to_rfc3339();
        let entry = JournalEntry { ts, payload };
        let line = serde_json::to_string(&entry)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        let file_path = self.current_file_path();
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)?;
        writeln!(file, "{}", line)?;
        file.sync_all()?;

        let mut guard = self.current_file.lock().unwrap();
        *guard = Some(file_path);
        Ok(())
    }

    pub fn replay_zion_blocks(&self) -> std::io::Result<Vec<ReplayedZionBlock>> {
        let mut blocks = Vec::new();
        let mut seen = HashSet::new();

        let entries = self.read_all_entries()?;
        for entry in entries {
            if let JournalPayload::ZionBlock {
                height,
                subsidy,
                pool_fee,
                humanitarian,
                issobella,
                miner,
                tx_hash,
            } = entry.payload
            {
                if seen.insert(height) {
                    blocks.push(ReplayedZionBlock {
                        height,
                        subsidy,
                        pool_fee,
                        humanitarian,
                        issobella,
                        miner,
                        tx_hash,
                        ts: entry.ts,
                    });
                }
            }
        }
        Ok(blocks)
    }

    pub fn replay_events(&self) -> std::io::Result<Vec<ReplayedEvent>> {
        let mut events = Vec::new();
        let entries = self.read_all_entries()?;
        for entry in entries {
            if let JournalPayload::Event {
                source,
                value_usd,
                qualifies,
                block_height,
            } = entry.payload
            {
                events.push(ReplayedEvent {
                    source,
                    value_usd,
                    qualifies,
                    block_height,
                    ts: entry.ts,
                });
            }
        }
        Ok(events)
    }

    fn current_file_path(&self) -> PathBuf {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        self.dir.join(format!("revenue_{}.jsonl", today))
    }

    fn read_all_entries(&self) -> std::io::Result<Vec<JournalEntry>> {
        let mut entries = Vec::new();
        let mut files: Vec<_> = fs::read_dir(&self.dir)?
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name();
                let s = name.to_string_lossy();
                s.starts_with("revenue_") && s.ends_with(".jsonl")
            })
            .map(|e| e.path())
            .collect();
        files.sort();

        for path in files {
            let file = fs::File::open(&path)?;
            let reader = BufReader::new(file);
            for line in reader.lines() {
                let line = line?;
                if line.trim().is_empty() {
                    continue;
                }
                match serde_json::from_str::<JournalEntry>(&line) {
                    Ok(entry) => entries.push(entry),
                    Err(e) => {
                        eprintln!(
                            "revenue_journal: skipping corrupt line in {}: {}",
                            path.display(),
                            e
                        );
                    }
                }
            }
        }
        Ok(entries)
    }
}

#[derive(Debug, Clone)]
pub struct ReplayedZionBlock {
    pub height: u64,
    pub subsidy: u64,
    pub pool_fee: u64,
    pub humanitarian: u64,
    pub issobella: u64,
    pub miner: u64,
    pub tx_hash: Option<String>,
    pub ts: String,
}

#[derive(Debug, Clone)]
pub struct ReplayedEvent {
    pub source: String,
    pub value_usd: f64,
    pub qualifies: bool,
    pub block_height: Option<u64>,
    pub ts: String,
}
