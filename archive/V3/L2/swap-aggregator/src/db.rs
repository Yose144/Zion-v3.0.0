use std::path::Path;

use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};

use crate::types::{OutputToken, SwapDirection, SwapId, SwapRecord, SwapStatus};

pub struct SwapDb {
    conn: Connection,
}

impl SwapDb {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS swaps (
                id              TEXT PRIMARY KEY,
                direction       TEXT NOT NULL,
                amount_in       TEXT NOT NULL,
                output_token    TEXT NOT NULL,
                zion_address    TEXT NOT NULL,
                evm_address     TEXT NOT NULL,
                slippage_bps    INTEGER NOT NULL DEFAULT 100,
                status          TEXT NOT NULL,
                l1_lock_tx      TEXT,
                bridge_mint_tx  TEXT,
                swap_tx         TEXT,
                amount_out      TEXT,
                error           TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            )",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_swaps_created ON swaps(created_at)",
            [],
        )?;
        Ok(())
    }

    pub fn insert(&self, swap: &SwapRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO swaps (
                id, direction, amount_in, output_token, zion_address, evm_address,
                slippage_bps, status, l1_lock_tx, bridge_mint_tx, swap_tx,
                amount_out, error, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                l1_lock_tx = excluded.l1_lock_tx,
                bridge_mint_tx = excluded.bridge_mint_tx,
                swap_tx = excluded.swap_tx,
                amount_out = excluded.amount_out,
                error = excluded.error,
                updated_at = excluded.updated_at
            ",
            params![
                &swap.id,
                direction_to_str(swap.direction),
                &swap.amount_in,
                output_token_to_str(swap.output_token),
                &swap.zion_address,
                &swap.evm_address,
                swap.slippage_bps,
                status_to_str(swap.status),
                swap.l1_lock_tx.as_ref(),
                swap.bridge_mint_tx.as_ref(),
                swap.swap_tx.as_ref(),
                swap.amount_out.as_ref(),
                swap.error.as_ref(),
                swap.created_at.to_rfc3339(),
                swap.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get(&self, id: &SwapId) -> Result<Option<SwapRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, direction, amount_in, output_token, zion_address, evm_address,
                    slippage_bps, status, l1_lock_tx, bridge_mint_tx, swap_tx,
                    amount_out, error, created_at, updated_at
             FROM swaps WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(params![id], |row| Ok(map_row(row)))?;
        Ok(rows.next().transpose()?)
    }

    pub fn list_recent(&self, limit: usize) -> Result<Vec<SwapRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, direction, amount_in, output_token, zion_address, evm_address,
                    slippage_bps, status, l1_lock_tx, bridge_mint_tx, swap_tx,
                    amount_out, error, created_at, updated_at
             FROM swaps ORDER BY created_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| Ok(map_row(row)))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_by_status(&self, status: SwapStatus, limit: usize) -> Result<Vec<SwapRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, direction, amount_in, output_token, zion_address, evm_address,
                    slippage_bps, status, l1_lock_tx, bridge_mint_tx, swap_tx,
                    amount_out, error, created_at, updated_at
             FROM swaps WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![status_to_str(status), limit], |row| {
            Ok(map_row(row))
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn update_status(&self, id: &SwapId, status: SwapStatus) -> Result<()> {
        self.conn.execute(
            "UPDATE swaps SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status_to_str(status), Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn update_error(&self, id: &SwapId, error: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE swaps SET status = 'failed', error = ?1, updated_at = ?2 WHERE id = ?3",
            params![error, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn update_txs(
        &self,
        id: &SwapId,
        l1_lock: Option<&str>,
        bridge_mint: Option<&str>,
        swap: Option<&str>,
        amount_out: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE swaps SET
                l1_lock_tx = COALESCE(?1, l1_lock_tx),
                bridge_mint_tx = COALESCE(?2, bridge_mint_tx),
                swap_tx = COALESCE(?3, swap_tx),
                amount_out = COALESCE(?4, amount_out),
                updated_at = ?5
             WHERE id = ?6",
            params![
                l1_lock,
                bridge_mint,
                swap,
                amount_out,
                Utc::now().to_rfc3339(),
                id
            ],
        )?;
        Ok(())
    }
}

fn map_row(row: &rusqlite::Row) -> SwapRecord {
    let direction_str: String = row.get(1).unwrap_or_default();
    let output_token_str: String = row.get(3).unwrap_or_default();
    let status_str: String = row.get(7).unwrap_or_default();

    SwapRecord {
        id: row.get(0).unwrap_or_default(),
        direction: str_to_direction(&direction_str),
        amount_in: row.get(2).unwrap_or_default(),
        output_token: str_to_output_token(&output_token_str),
        zion_address: row.get(4).unwrap_or_default(),
        evm_address: row.get(5).unwrap_or_default(),
        slippage_bps: row.get(6).unwrap_or(100),
        status: str_to_status(&status_str),
        l1_lock_tx: row.get(8).ok(),
        bridge_mint_tx: row.get(9).ok(),
        swap_tx: row.get(10).ok(),
        amount_out: row.get(11).ok(),
        error: row.get(12).ok(),
        created_at: row
            .get(13)
            .ok()
            .and_then(|s: String| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now),
        updated_at: row
            .get(14)
            .ok()
            .and_then(|s: String| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now),
    }
}

fn direction_to_str(d: SwapDirection) -> &'static str {
    match d {
        SwapDirection::ZionToEvm => "zion_to_evm",
        SwapDirection::EvmToZion => "evm_to_zion",
    }
}

fn str_to_direction(s: &str) -> SwapDirection {
    match s {
        "evm_to_zion" => SwapDirection::EvmToZion,
        _ => SwapDirection::ZionToEvm,
    }
}

fn output_token_to_str(t: OutputToken) -> &'static str {
    match t {
        OutputToken::Weth => "WETH",
        OutputToken::Usdc => "USDC",
    }
}

fn str_to_output_token(s: &str) -> OutputToken {
    match s {
        "USDC" => OutputToken::Usdc,
        _ => OutputToken::Weth,
    }
}

fn status_to_str(s: SwapStatus) -> &'static str {
    match s {
        SwapStatus::Pending => "pending",
        SwapStatus::Locking => "locking",
        SwapStatus::Bridging => "bridging",
        SwapStatus::Swapping => "swapping",
        SwapStatus::Completed => "completed",
        SwapStatus::Failed => "failed",
    }
}

fn str_to_status(s: &str) -> SwapStatus {
    match s {
        "locking" => SwapStatus::Locking,
        "bridging" => SwapStatus::Bridging,
        "swapping" => SwapStatus::Swapping,
        "completed" => SwapStatus::Completed,
        "failed" => SwapStatus::Failed,
        _ => SwapStatus::Pending,
    }
}
