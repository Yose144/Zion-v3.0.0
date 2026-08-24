use rusqlite::{Connection, Row};
use zion_l1_types::{Address, Amount, ChainId};

use crate::error::MultichainError;
use crate::error::MultichainResult;
use crate::multichain_wallet::types::{AddressPurpose, WalletAccount, WalletAddress};
use crate::swap::dex::intent::{SolverBid, SwapIntent};
use crate::swap::dex::Pool;
use crate::swap::htlc::{HtlcRecord, SwapState};

/// SQLite connection manager for `zion-multichain`.
pub struct Db {
    conn: Connection,
}

impl Db {
    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }

    pub(crate) fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }
}

impl Db {
    /// Open or create the SQLite database at `path`.
    pub fn open(path: impl AsRef<std::path::Path>) -> MultichainResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Open an in-memory database (useful for tests).
    pub fn open_in_memory() -> MultichainResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> MultichainResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                direction TEXT NOT NULL,
                source_address TEXT NOT NULL,
                source_asset TEXT NOT NULL,
                source_amount TEXT NOT NULL,
                target_address TEXT NOT NULL,
                target_asset TEXT NOT NULL,
                target_amount TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credits (
                address TEXT PRIMARY KEY,
                balance TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS htlc_records (
                hash_hex TEXT PRIMARY KEY,
                locker_address TEXT NOT NULL,
                amount INTEGER NOT NULL,
                lock_tx_id TEXT NOT NULL,
                lock_block_height INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                counterparty_chain TEXT NOT NULL,
                counterparty_addr TEXT NOT NULL,
                refund_pubkey TEXT,
                claimant_pubkey TEXT,
                state TEXT NOT NULL,
                release_tx_id TEXT,
                release_recipient TEXT,
                preimage_hex TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                data_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_htlc_state ON htlc_records(state);

            CREATE TABLE IF NOT EXISTS pools (
                pool_id TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS intents (
                intent_id TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bids (
                intent_id TEXT NOT NULL,
                solver TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (intent_id, solver)
            );

            CREATE TABLE IF NOT EXISTS solvers (
                solver TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS node_reward_nodes (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                reward_address TEXT NOT NULL,
                bind_host TEXT,
                bind_port INTEGER,
                created_at TEXT NOT NULL,
                last_heartbeat_at TEXT,
                epoch_score INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_node_reward_user ON node_reward_nodes(user_id);

            CREATE TABLE IF NOT EXISTS node_reward_heartbeats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                height INTEGER NOT NULL,
                peer_count INTEGER,
                bandwidth INTEGER,
                latency_ms INTEGER,
                observed_at TEXT NOT NULL,
                signature TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_node_reward_heartbeats_node ON node_reward_heartbeats(node_id);

            CREATE TABLE IF NOT EXISTS node_reward_payouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                epoch_start INTEGER NOT NULL,
                epoch_end INTEGER NOT NULL,
                total_reward INTEGER NOT NULL,
                tx_id TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS node_reward_payout_recipients (
                payout_id INTEGER NOT NULL,
                node_id TEXT NOT NULL,
                reward_address TEXT NOT NULL,
                score INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                PRIMARY KEY (payout_id, node_id)
            );

            -- Multichain wallet (ZionDex + ZIS Multichain Wallet)
            CREATE TABLE IF NOT EXISTS wallet_accounts (
                user_id TEXT PRIMARY KEY,
                account_index INTEGER UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS wallet_addresses (
                address TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                chain TEXT NOT NULL,
                chain_id TEXT,
                purpose TEXT NOT NULL,
                public_key TEXT,
                derivation_path TEXT NOT NULL,
                is_external INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_wallet_address_user ON wallet_addresses(user_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_address_chain ON wallet_addresses(chain, chain_id, purpose);

            CREATE TABLE IF NOT EXISTS wallet_balances (
                user_id TEXT NOT NULL,
                asset_key TEXT NOT NULL,
                amount TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, asset_key)
            );

            CREATE TABLE IF NOT EXISTS deposits (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                chain TEXT NOT NULL,
                chain_id TEXT,
                tx_hash TEXT NOT NULL,
                asset_key TEXT NOT NULL,
                amount TEXT NOT NULL,
                confirmations INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                credited_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
            CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

            CREATE TABLE IF NOT EXISTS withdrawals (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                asset_key TEXT NOT NULL,
                amount TEXT NOT NULL,
                recipient_address TEXT NOT NULL,
                tx_hash TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                sent_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
            CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
            "#,
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // HTLC persistence
    // ------------------------------------------------------------------------

    /// Persist an HTLC record (insert or replace).
    pub fn save_htlc(&self, record: &HtlcRecord) -> MultichainResult<()> {
        let data_json = serde_json::to_string(record)
            .map_err(|e| MultichainError::Internal(format!("serialize HTLC record: {e}")))?;
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO htlc_records
            (hash_hex, locker_address, amount, lock_tx_id, lock_block_height,
             expires_at, counterparty_chain, counterparty_addr, refund_pubkey,
             claimant_pubkey, state, release_tx_id, release_recipient, preimage_hex,
             created_at, updated_at, data_json)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
            "#,
            rusqlite::params![
                record.hash_hex,
                record.locker_address,
                record.amount as i64,
                record.lock_tx_id,
                record.lock_block_height as i64,
                record.expires_at,
                record.counterparty_chain,
                record.counterparty_addr,
                record.refund_pubkey.map(hex::encode),
                record.claimant_pubkey.map(hex::encode),
                record.state.to_string(),
                record.release_tx_id,
                record.release_recipient,
                record.preimage_hex,
                record.created_at.to_rfc3339(),
                record.updated_at.to_rfc3339(),
                data_json,
            ],
        )?;
        Ok(())
    }

    /// Load a single HTLC record by hash_hex.
    pub fn load_htlc(&self, hash_hex: &str) -> MultichainResult<Option<HtlcRecord>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM htlc_records WHERE hash_hex = ?1")?;
        let mut rows = stmt.query(rusqlite::params![hash_hex])?;
        if let Some(row) = rows.next()? {
            let json: String = row.get(0)?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            Ok(Some(record))
        } else {
            Ok(None)
        }
    }

    /// List all HTLC records, newest first.
    pub fn list_htlc(&self) -> MultichainResult<Vec<HtlcRecord>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM htlc_records ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            out.push(record);
        }
        Ok(out)
    }

    /// List HTLC records filtered by state.
    pub fn list_htlc_by_state(&self, state: SwapState) -> MultichainResult<Vec<HtlcRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT data_json FROM htlc_records WHERE state = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![state.to_string()], |row| {
            row.get::<_, String>(0)
        })?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            out.push(record);
        }
        Ok(out)
    }

    // ------------------------------------------------------------------------
    // Intent persistence
    // ------------------------------------------------------------------------

    /// Persist an intent (insert or replace).
    pub fn save_intent(&self, intent: &SwapIntent) -> MultichainResult<()> {
        let data_json = serde_json::to_string(intent)
            .map_err(|e| MultichainError::Internal(format!("serialize intent: {e}")))?;
        let updated_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO intents
            (intent_id, data_json, status, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            rusqlite::params![
                intent.id.to_string(),
                data_json,
                intent.status.to_string(),
                updated_at,
            ],
        )?;
        Ok(())
    }

    /// Load all persisted intents.
    pub fn load_intents(&self) -> MultichainResult<Vec<SwapIntent>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM intents ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let intent: SwapIntent = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize intent: {e}")))?;
            out.push(intent);
        }
        Ok(out)
    }

    /// Persist a solver bid (insert or replace).
    pub fn save_bid(&self, bid: &SolverBid) -> MultichainResult<()> {
        let data_json = serde_json::to_string(bid)
            .map_err(|e| MultichainError::Internal(format!("serialize bid: {e}")))?;
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO bids
            (intent_id, solver, data_json, created_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            rusqlite::params![
                bid.intent_id.to_string(),
                bid.solver,
                data_json,
                created_at,
            ],
        )?;
        Ok(())
    }

    /// Load all persisted bids for an intent.
    pub fn load_bids_for_intent(&self, intent_id: &uuid::Uuid) -> MultichainResult<Vec<SolverBid>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM bids WHERE intent_id = ?1 ORDER BY created_at DESC")?;
        let rows =
            stmt.query_map(rusqlite::params![intent_id.to_string()], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let bid: SolverBid = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize bid: {e}")))?;
            out.push(bid);
        }
        Ok(out)
    }

    /// Persist a registered solver.
    pub fn save_solver(&self, solver: &str) -> MultichainResult<()> {
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR IGNORE INTO solvers
            (solver, created_at)
            VALUES (?1, ?2)
            "#,
            rusqlite::params![solver, created_at],
        )?;
        Ok(())
    }

    /// Load all registered solvers.
    pub fn load_solvers(&self) -> MultichainResult<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT solver FROM solvers ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    // ------------------------------------------------------------------------
    // Multichain wallet persistence
    // ------------------------------------------------------------------------

    /// Load a wallet account by user_id.
    pub fn load_wallet_account(&self, user_id: &str) -> MultichainResult<Option<WalletAccount>> {
        let mut stmt = self
            .conn
            .prepare("SELECT user_id, account_index, created_at FROM wallet_accounts WHERE user_id = ?1")?;
        let mut rows = stmt.query(rusqlite::params![user_id])?;
        if let Some(row) = rows.next()? {
            let created_at: String = row.get(2)?;
            Ok(Some(WalletAccount {
                user_id: row.get(0)?,
                account_index: row.get::<_, i64>(1)? as u32,
                created_at: parse_datetime(&created_at)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Get or create a wallet account for a user.
    ///
    /// `Db` is held behind an async mutex, so the max+insert sequence is safe
    /// from races within a single process.
    pub fn get_or_create_wallet_account(&mut self, user_id: &str) -> MultichainResult<WalletAccount> {
        if let Some(account) = self.load_wallet_account(user_id)? {
            return Ok(account);
        }

        let next_index: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(account_index), -1) + 1 FROM wallet_accounts",
            [],
            |row| row.get(0),
        )?;

        let created_at = chrono::Utc::now().to_rfc3339();
        let account_index = next_index as u32;

        self.conn.execute(
            "INSERT INTO wallet_accounts (user_id, account_index, created_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![user_id, next_index, &created_at],
        )?;

        Ok(WalletAccount {
            user_id: user_id.to_string(),
            account_index,
            created_at: parse_datetime(&created_at)?,
        })
    }

    /// Persist a wallet address.
    pub fn save_wallet_address(&self, address: &WalletAddress) -> MultichainResult<()> {
        let created_at = address.created_at.to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO wallet_addresses
            (address, user_id, chain, chain_id, purpose, public_key, derivation_path, is_external, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            rusqlite::params![
                address.address.encoded,
                address.user_id,
                address.chain.as_str(),
                address.chain_id,
                address.purpose.to_string(),
                address.public_key,
                address.derivation_path,
                if address.is_external { 1 } else { 0 },
                created_at,
            ],
        )?;
        Ok(())
    }

    /// Load a wallet address by user, chain, optional chain_id, and purpose.
    pub fn load_wallet_address(
        &self,
        user_id: &str,
        chain: zion_l1_types::ChainId,
        chain_id: Option<&str>,
        purpose: AddressPurpose,
    ) -> MultichainResult<Option<WalletAddress>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT address, user_id, chain, chain_id, purpose, public_key,
                   derivation_path, is_external, created_at
            FROM wallet_addresses
            WHERE user_id = ?1 AND chain = ?2 AND purpose = ?3
              AND ((?4 IS NULL AND chain_id IS NULL) OR (chain_id = ?4))
            "#,
        )?;
        let mut rows = stmt.query(rusqlite::params![
            user_id,
            chain.as_str(),
            purpose.to_string(),
            chain_id,
        ])?;
        if let Some(row) = rows.next()? {
            Ok(Some(parse_wallet_address(row)?))
        } else {
            Ok(None)
        }
    }

    /// Load all wallet addresses for a user.
    pub fn load_wallet_addresses_for_user(&self, user_id: &str) -> MultichainResult<Vec<WalletAddress>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT address, user_id, chain, chain_id, purpose, public_key,
                   derivation_path, is_external, created_at
            FROM wallet_addresses
            WHERE user_id = ?1
            ORDER BY created_at DESC
            "#,
        )?;
        let mut rows = stmt.query(rusqlite::params![user_id])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(parse_wallet_address(row)?);
        }
        Ok(out)
    }

    /// Load a wallet balance.
    pub fn load_wallet_balance(&self, user_id: &str, asset_key: &str) -> MultichainResult<Amount> {
        let mut stmt = self
            .conn
            .prepare("SELECT amount FROM wallet_balances WHERE user_id = ?1 AND asset_key = ?2")?;
        let mut rows = stmt.query(rusqlite::params![user_id, asset_key])?;
        if let Some(row) = rows.next()? {
            let s: String = row.get(0)?;
            Ok(Amount::new(s.parse::<u128>().map_err(|e| {
                MultichainError::Internal(format!("invalid wallet balance amount: {e}"))
            })?))
        } else {
            Ok(Amount::ZERO)
        }
    }

    /// Persist a wallet balance.
    pub fn save_wallet_balance(&mut self, user_id: &str, asset_key: &str, amount: Amount) -> MultichainResult<()> {
        let updated_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO wallet_balances
            (user_id, asset_key, amount, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            rusqlite::params![
                user_id,
                asset_key,
                amount.0.to_string(),
                updated_at,
            ],
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // AMM pool persistence
    // ------------------------------------------------------------------------

    /// Persist an AMM pool (insert or replace).
    pub fn save_pool(&self, pool: &Pool) -> MultichainResult<()> {
        let data_json = serde_json::to_string(pool)
            .map_err(|e| MultichainError::Internal(format!("serialize pool: {e}")))?;
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO pools
            (pool_id, data_json, created_at)
            VALUES (?1, ?2, ?3)
            "#,
            rusqlite::params![pool.id.to_string(), data_json, created_at],
        )?;
        Ok(())
    }

    /// Load all persisted AMM pools.
    pub fn load_pools(&self) -> MultichainResult<Vec<Pool>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM pools ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let pool: Pool = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize pool: {e}")))?;
            out.push(pool);
        }
        Ok(out)
    }

    /// Delete an AMM pool by id.
    pub fn delete_pool(&self, pool_id: u64) -> MultichainResult<usize> {
        let n = self
            .conn
            .execute("DELETE FROM pools WHERE pool_id = ?1", rusqlite::params![pool_id.to_string()])?;
        Ok(n)
    }

    /// Delete HTLC records in terminal states older than `days` days.
    pub fn purge_old_htlc(&self, days: u32) -> MultichainResult<usize> {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let n = self.conn.execute(
            "DELETE FROM htlc_records WHERE state IN ('claimed','refunded') AND updated_at < ?1",
            rusqlite::params![cutoff.to_rfc3339()],
        )?;
        Ok(n)
    }
}

fn parse_datetime(s: &str) -> MultichainResult<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|e| MultichainError::Internal(format!("parse datetime: {e}")))
}

fn parse_wallet_address(row: &Row) -> MultichainResult<WalletAddress> {
    let address: String = row.get(0)?;
    let user_id: String = row.get(1)?;
    let chain_str: String = row.get(2)?;
    let chain_id: Option<String> = row.get(3)?;
    let purpose_str: String = row.get(4)?;
    let public_key: Option<String> = row.get(5)?;
    let derivation_path: String = row.get(6)?;
    let is_external_i: i64 = row.get(7)?;
    let created_at: String = row.get(8)?;

    let chain = chain_id_from_str(&chain_str)?;
    let purpose = purpose_str
        .parse::<AddressPurpose>()
        .map_err(MultichainError::Validation)?;

    let bytes = match chain.family() {
        zion_l1_types::ChainFamily::Evm => {
            let s = address.trim_start_matches("0x").trim_start_matches("0X").to_lowercase();
            if s.len() != 40 {
                return Err(MultichainError::Validation(format!("invalid evm address length: {s}")));
            }
            hex::decode(&s).map_err(|e| MultichainError::Validation(format!("invalid evm hex: {e}")))?
        }
        zion_l1_types::ChainFamily::Solana | zion_l1_types::ChainFamily::Near => {
            bs58::decode(&address).into_vec().map_err(|e| {
                MultichainError::Validation(format!("invalid base58 address: {e}"))
            })?
        }
        _ => Vec::new(),
    };

    let address = Address::new(chain, bytes, address)?;

    Ok(WalletAddress {
        address,
        user_id,
        chain,
        chain_id,
        purpose,
        public_key,
        derivation_path,
        is_external: is_external_i != 0,
        created_at: parse_datetime(&created_at)?,
    })
}

fn chain_id_from_str(s: &str) -> MultichainResult<ChainId> {
    match s {
        "zion-l1" => Ok(ChainId::ZionL1),
        "bitcoin" => Ok(ChainId::Bitcoin),
        "ethereum" => Ok(ChainId::Ethereum),
        "base" => Ok(ChainId::Base),
        "arbitrum" => Ok(ChainId::Arbitrum),
        "optimism" => Ok(ChainId::Optimism),
        "bsc" => Ok(ChainId::Bsc),
        "polygon" => Ok(ChainId::Polygon),
        "avalanche" => Ok(ChainId::Avalanche),
        "zksync" => Ok(ChainId::Zksync),
        "linea" => Ok(ChainId::Linea),
        "solana" => Ok(ChainId::Solana),
        "tron" => Ok(ChainId::Tron),
        "stellar" => Ok(ChainId::Stellar),
        "cardano" => Ok(ChainId::Cardano),
        "cosmos" => Ok(ChainId::Cosmos),
        "sui" => Ok(ChainId::Sui),
        "aptos" => Ok(ChainId::Aptos),
        "near" => Ok(ChainId::Near),
        "ton" => Ok(ChainId::Ton),
        "lightning" => Ok(ChainId::Lightning),
        "decred" => Ok(ChainId::Decred),
        "ethereum_classic" => Ok(ChainId::EthereumClassic),
        "monero" => Ok(ChainId::Monero),
        "zano" => Ok(ChainId::Zano),
        _ => Err(MultichainError::Validation(format!("unknown chain id: {s}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Amount, Asset, AssetId, ChainId};

    fn test_asset(chain: ChainId, ticker: &str) -> Asset {
        Asset {
            id: AssetId::new(chain, ticker, None),
            decimals: 6,
            name: ticker.to_string(),
        }
    }

    #[test]
    fn pool_persists_and_reloads() {
        let db = Db::open_in_memory().unwrap();
        let zion = test_asset(ChainId::ZionL1, "ZION");
        let usdc = test_asset(ChainId::Base, "USDC");
        let pool = Pool {
            id: 1,
            asset_a: zion,
            asset_b: usdc,
            reserve_a: Amount::new(100_000_000),
            reserve_b: Amount::new(1_000_000_000),
            fee_bps: 30,
        };

        db.save_pool(&pool).unwrap();
        let loaded = db.load_pools().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, 1);
        assert_eq!(loaded[0].reserve_a.0, 100_000_000);
        assert_eq!(loaded[0].fee_bps, 30);

        db.delete_pool(1).unwrap();
        assert!(db.load_pools().unwrap().is_empty());
    }

    #[test]
    fn intent_and_bid_persist_and_reload() {
        use crate::swap::dex::intent::{PathHop, SolverBid, SwapIntent};

        let db = Db::open_in_memory().unwrap();

        let zion = AssetId::new(ChainId::ZionL1, "ZION", None);
        let usdc = AssetId::new(ChainId::ZionL1, "USDC", None);

        let intent = SwapIntent::new(
            "user1",
            zion.clone(),
            usdc.clone(),
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        );
        db.save_intent(&intent).unwrap();

        let bid = SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(1_100_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion.clone(),
                to_token: usdc.clone(),
                is_bridge: false,
            }],
            10,
            0,
        );
        db.save_bid(&bid).unwrap();

        let loaded_intents = db.load_intents().unwrap();
        assert_eq!(loaded_intents.len(), 1);
        assert_eq!(loaded_intents[0].id, intent.id);

        let loaded_bids = db.load_bids_for_intent(&intent.id).unwrap();
        assert_eq!(loaded_bids.len(), 1);
        assert_eq!(loaded_bids[0].solver, "solver-a");
    }
}
