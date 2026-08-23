//! Node reward service for full user nodes.
//!
//! - Registers full nodes bound to a ZIS identity.
//! - Accepts signed heartbeats.
//! - Scores nodes per epoch and, when configured with the node reward pool
//!   signer mnemonic, builds and submits a batch payout transaction that
//!   distributes the accumulated 1% block reward pool to active nodes.

use std::sync::Arc;

use chrono::Utc;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use zion_core::v31_wallet::{build_batch_payout, BatchRecipient};

use crate::chain::adapters::ZionL1Adapter;
use crate::config::NodeRewardsConfig;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::wallet::Keyring;

/// Request to register a full node.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RegisterNodeRequest {
    /// Ed25519 public key (32 bytes, hex). Used as the node id.
    pub node_id: String,
    /// ZIS user id that owns this node.
    pub user_id: String,
    /// `zion1...` address that receives the node's reward payouts.
    pub reward_address: String,
    /// Optional p2p/rpc bind host.
    pub bind_host: Option<String>,
    /// Optional bind port.
    pub bind_port: Option<u16>,
    /// Ed25519 signature (hex) over `node_id:reward_address:user_id:bind_host:bind_port`.
    pub signature: String,
}

/// Heartbeat from a registered full node.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct HeartbeatRequest {
    pub node_id: String,
    /// Current chain height observed by the node.
    pub height: u64,
    /// Number of connected peers.
    pub peer_count: u64,
    /// Observed bandwidth metric (bytes/sec, node-reported).
    pub bandwidth: u64,
    /// Observed latency in milliseconds.
    pub latency_ms: u64,
    /// Unix timestamp (ms) when the heartbeat was created.
    pub observed_at: u64,
    /// Ed25519 signature (hex) over the colon-separated payload.
    pub signature: String,
}

/// Node record returned by the API.
#[derive(Clone, Debug, Serialize)]
pub struct NodeRecord {
    pub id: String,
    pub user_id: String,
    pub reward_address: String,
    pub bind_host: Option<String>,
    pub bind_port: Option<u16>,
    pub created_at: String,
    pub last_heartbeat_at: Option<String>,
    pub epoch_score: u64,
    pub active: bool,
}

/// Payout record returned by the API.
#[derive(Clone, Debug, Serialize)]
pub struct PayoutRecord {
    pub id: i64,
    pub epoch_start: u64,
    pub epoch_end: u64,
    pub total_reward: u64,
    pub tx_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub recipients: Vec<PayoutRecipient>,
}

/// Recipient breakdown for a payout record.
#[derive(Clone, Debug, Serialize)]
pub struct PayoutRecipient {
    pub node_id: String,
    pub reward_address: String,
    pub score: u64,
    pub amount: u64,
}

/// Node reward sweep/payout orchestrator.
pub struct NodeRewards {
    db: Arc<Mutex<Db>>,
    config: NodeRewardsConfig,
    l1_adapter: Option<ZionL1Adapter>,
    pool_address: String,
}

impl NodeRewards {
    /// Create a new node reward service.
    ///
    /// If a signer mnemonic is provided (config or `ZION_NODE_REWARD_MNEMONIC`
    /// env), the service will verify that it derives the configured reward
    /// address before enabling payout sweeps.
    pub fn new(
        db: Arc<Mutex<Db>>,
        config: NodeRewardsConfig,
        l1_rpc_url: String,
    ) -> MultichainResult<Self> {
        let mnemonic = config
            .signer_mnemonic
            .clone()
            .or_else(|| std::env::var("ZION_NODE_REWARD_MNEMONIC").ok())
            .filter(|s| !s.is_empty());

        let l1_adapter = if let Some(phrase) = mnemonic {
            let keyring = Keyring::from_mnemonic(&phrase)?;
            let adapter = ZionL1Adapter::new(l1_rpc_url, keyring);
            let derived = adapter
                .adapter_address()
                .map(|a| a.encoded)
                .unwrap_or_default();
            if derived != config.reward_address {
                tracing::error!(
                    derived = %derived,
                    expected = %config.reward_address,
                    "node reward signer mnemonic does not derive the canonical reward address; payouts disabled"
                );
                None
            } else {
                Some(adapter)
            }
        } else {
            None
        };

        if l1_adapter.is_none() {
            tracing::warn!("node reward payouts disabled: no signer mnemonic configured");
        }

        Ok(Self {
            db,
            pool_address: config.reward_address.clone(),
            config,
            l1_adapter,
        })
    }

    pub fn reward_address(&self) -> &str {
        &self.pool_address
    }

    pub fn activation_height(&self) -> u64 {
        self.config.activation_height
    }

    /// Register a new full node. `user_id` comes from the authenticated ZIS session.
    pub async fn register(
        &self,
        user_id: String,
        req: RegisterNodeRequest,
    ) -> MultichainResult<NodeRecord> {
        self.verify_register_signature(&req)?;

        if req.reward_address.len() != 44 || !req.reward_address.starts_with("zion1") {
            return Err(MultichainError::Validation(
                "reward_address must be a 44-char zion1 address".to_string(),
            ));
        }

        let mut guard = self.db.lock().await;
        let conn = guard.conn_mut();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            r#"
            INSERT OR REPLACE INTO node_reward_nodes
            (id, user_id, reward_address, bind_host, bind_port, created_at,
             last_heartbeat_at, epoch_score, active)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                &req.node_id,
                &user_id,
                &req.reward_address,
                req.bind_host.as_deref(),
                req.bind_port.map(|p| p as i64),
                &now,
                Option::<String>::None,
                0i64,
                1i64,
            ],
        )?;
        drop(guard);

        self.get_node(&req.node_id)
            .await?
            .ok_or_else(|| MultichainError::Internal("node not found after insert".to_string()))
    }

    /// Record a signed heartbeat for a registered node.
    pub async fn heartbeat(&self, req: HeartbeatRequest) -> MultichainResult<()> {
        self.verify_heartbeat_signature(&req)?;

        let mut guard = self.db.lock().await;
        let conn = guard.conn_mut();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            r#"
            INSERT INTO node_reward_heartbeats
            (node_id, height, peer_count, bandwidth, latency_ms, observed_at, signature)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                &req.node_id,
                req.height as i64,
                req.peer_count as i64,
                req.bandwidth as i64,
                req.latency_ms as i64,
                &now,
                &req.signature,
            ],
        )?;

        conn.execute(
            "UPDATE node_reward_nodes SET last_heartbeat_at = ?1, epoch_score = epoch_score + 1 WHERE id = ?2",
            params![&now, &req.node_id],
        )?;

        Ok(())
    }

    /// Look up a registered node by id.
    pub async fn get_node(&self, node_id: &str) -> MultichainResult<Option<NodeRecord>> {
        let guard = self.db.lock().await;
        let mut stmt = guard.conn().prepare(
            "SELECT user_id, reward_address, bind_host, bind_port, created_at, last_heartbeat_at, epoch_score, active FROM node_reward_nodes WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![node_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(NodeRecord {
                id: node_id.to_string(),
                user_id: row.get(0)?,
                reward_address: row.get(1)?,
                bind_host: row.get(2)?,
                bind_port: row.get::<_, Option<i64>>(3)?.map(|p| p as u16),
                created_at: row.get(4)?,
                last_heartbeat_at: row.get(5)?,
                epoch_score: row.get::<_, i64>(6)? as u64,
                active: row.get::<_, i64>(7)? != 0,
            }))
        } else {
            Ok(None)
        }
    }

    /// List all currently active registered nodes.
    pub async fn list_active_nodes(&self) -> MultichainResult<Vec<NodeRecord>> {
        let guard = self.db.lock().await;
        let mut stmt = guard.conn().prepare(
            "SELECT id, user_id, reward_address, bind_host, bind_port, created_at, last_heartbeat_at, epoch_score, active FROM node_reward_nodes WHERE active = 1",
        )?;
        let mut rows = stmt.query([])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(NodeRecord {
                id: row.get(0)?,
                user_id: row.get(1)?,
                reward_address: row.get(2)?,
                bind_host: row.get(3)?,
                bind_port: row.get::<_, Option<i64>>(4)?.map(|p| p as u16),
                created_at: row.get(5)?,
                last_heartbeat_at: row.get(6)?,
                epoch_score: row.get::<_, i64>(7)? as u64,
                active: row.get::<_, i64>(8)? != 0,
            });
        }
        Ok(out)
    }

    /// Check if a payout is due at `current_height` and submit it.
    ///
    /// Returns the transaction id when a payout was submitted.
    pub async fn maybe_payout(&self, current_height: u64) -> MultichainResult<Option<String>> {
        if current_height < self.config.activation_height {
            return Ok(None);
        }
        let Some(adapter) = self.l1_adapter.as_ref() else {
            return Ok(None);
        };
        if current_height % self.config.epoch_blocks != 0 {
            return Ok(None);
        }

        let epoch_end = current_height;
        let epoch_start = epoch_end.saturating_sub(self.config.epoch_blocks);

        let nodes = self.list_active_nodes().await?;
        let total_score: u64 = nodes.iter().map(|n| n.epoch_score).sum();
        if total_score == 0 {
            return Ok(None);
        }

        let utxos = adapter.get_spendable_utxos(&self.pool_address).await?;
        let total_reward: u64 = utxos.iter().map(|u| u.amount).sum();
        if total_reward == 0 {
            return Ok(None);
        }

        let mut recipients: Vec<BatchRecipient> = Vec::new();
        for node in &nodes {
            if node.epoch_score == 0 {
                continue;
            }
            let amount = (total_reward as u128)
                .saturating_mul(node.epoch_score as u128)
                .saturating_div(total_score as u128) as u64;
            if amount > 0 {
                recipients.push(BatchRecipient {
                    address: node.reward_address.clone(),
                    amount,
                });
            }
        }

        if recipients.is_empty() {
            return Ok(None);
        }

        // 1 ZION per recipient plus a fixed 1 ZION base fee.
        let fee = 1_000_000_u64.saturating_mul(recipients.len() as u64 + 1);
        let signing_key = adapter.zion_signing_key()?;
        let build = build_batch_payout(
            &signing_key,
            &self.pool_address,
            &recipients,
            fee,
            &utxos,
        )
        .map_err(|e| MultichainError::Internal(format!("build batch payout: {e:?}")))?;

        let tx_id = adapter.submit_utxo_transaction(build.transaction).await?;

        // Record the payout and reset per-epoch scores.
        let mut guard = self.db.lock().await;
        let conn = guard.conn_mut();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            r#"
            INSERT INTO node_reward_payouts
            (epoch_start, epoch_end, total_reward, tx_id, status, created_at, completed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                epoch_start as i64,
                epoch_end as i64,
                total_reward as i64,
                tx_id.to_hex(),
                "completed",
                &now,
                &now,
            ],
        )?;
        let payout_id = conn.last_insert_rowid();

        for node in &nodes {
            if node.epoch_score == 0 {
                continue;
            }
            let amount = (total_reward as u128)
                .saturating_mul(node.epoch_score as u128)
                .saturating_div(total_score as u128) as u64;
            if amount > 0 {
                conn.execute(
                    r#"
                    INSERT INTO node_reward_payout_recipients
                    (payout_id, node_id, reward_address, score, amount)
                    VALUES (?1, ?2, ?3, ?4, ?5)
                    "#,
                    params![
                        payout_id,
                        &node.id,
                        &node.reward_address,
                        node.epoch_score as i64,
                        amount as i64,
                    ],
                )?;
            }
        }

        conn.execute(
            "UPDATE node_reward_nodes SET epoch_score = 0 WHERE active = 1",
            [],
        )?;

        Ok(Some(tx_id.to_hex()))
    }

    /// List all completed payouts, including per-node recipient breakdowns.
    pub async fn list_payouts(&self) -> MultichainResult<Vec<PayoutRecord>> {
        let guard = self.db.lock().await;
        let conn = guard.conn();
        let mut stmt = conn.prepare(
            "SELECT id, epoch_start, epoch_end, total_reward, tx_id, status, created_at, completed_at FROM node_reward_payouts ORDER BY id DESC",
        )?;
        let mut rows = stmt.query([])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let recipients = Self::payout_recipients(conn, id)?;
            out.push(PayoutRecord {
                id,
                epoch_start: row.get::<_, i64>(1)? as u64,
                epoch_end: row.get::<_, i64>(2)? as u64,
                total_reward: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                completed_at: row.get(7)?,
                recipients,
            });
        }
        Ok(out)
    }

    fn payout_recipients(conn: &rusqlite::Connection, payout_id: i64) -> MultichainResult<Vec<PayoutRecipient>> {
        let mut stmt = conn.prepare(
            "SELECT node_id, reward_address, score, amount FROM node_reward_payout_recipients WHERE payout_id = ?1",
        )?;
        let mut rows = stmt.query(params![payout_id])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(PayoutRecipient {
                node_id: row.get(0)?,
                reward_address: row.get(1)?,
                score: row.get::<_, i64>(2)? as u64,
                amount: row.get::<_, i64>(3)? as u64,
            });
        }
        Ok(out)
    }

    /// Deactivate a node (for example, on excessive missed heartbeats).
    pub async fn deactivate_node(&self, node_id: &str) -> MultichainResult<()> {
        let mut guard = self.db.lock().await;
        let conn = guard.conn_mut();
        conn.execute(
            "UPDATE node_reward_nodes SET active = 0 WHERE id = ?1",
            params![node_id],
        )?;
        Ok(())
    }

    fn verify_register_signature(&self, req: &RegisterNodeRequest) -> MultichainResult<()> {
        let vk = self.decode_pubkey(&req.node_id)?;
        let sig = self.decode_signature(&req.signature)?;
        let payload = format!(
            "{}:{}:{}:{}:{}",
            req.node_id,
            req.reward_address,
            req.user_id,
            req.bind_host.as_deref().unwrap_or(""),
            req.bind_port.unwrap_or(0)
        );
        vk.verify(payload.as_bytes(), &sig)
            .map_err(|_| MultichainError::Validation("register signature verification failed".to_string()))
    }

    fn verify_heartbeat_signature(&self, req: &HeartbeatRequest) -> MultichainResult<()> {
        let vk = self.decode_pubkey(&req.node_id)?;
        let sig = self.decode_signature(&req.signature)?;
        let payload = format!(
            "{}:{}:{}:{}:{}:{}",
            req.node_id,
            req.height,
            req.peer_count,
            req.bandwidth,
            req.latency_ms,
            req.observed_at
        );
        vk.verify(payload.as_bytes(), &sig)
            .map_err(|_| MultichainError::Validation("heartbeat signature verification failed".to_string()))
    }

    fn decode_pubkey(&self, hex_str: &str) -> MultichainResult<VerifyingKey> {
        let bytes = hex::decode(hex_str)
            .map_err(|_| MultichainError::Validation("invalid public key hex".to_string()))?;
        let arr: [u8; 32] = bytes
            .try_into()
            .map_err(|_| MultichainError::Validation("public key must be 32 bytes".to_string()))?;
        VerifyingKey::from_bytes(&arr)
            .map_err(|_| MultichainError::Validation("invalid Ed25519 public key".to_string()))
    }

    fn decode_signature(&self, hex_str: &str) -> MultichainResult<Signature> {
        let bytes = hex::decode(hex_str)
            .map_err(|_| MultichainError::Validation("invalid signature hex".to_string()))?;
        Signature::from_slice(&bytes)
            .map_err(|_| MultichainError::Validation("invalid Ed25519 signature".to_string()))
    }
}
