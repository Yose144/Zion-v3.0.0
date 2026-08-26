#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(clippy::too_many_arguments)]
//! ChainState, ChainStore, ChainJournalEntry and supporting types — ported from V3 lib.rs.
//!
//! This module is not yet wired into the V31 node runtime. It compiles but
//! functionality will come when all V3 modules are wired together.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::node_runtime::{
    self, AcceptedBlock, BlockTemplate, CoreRuntime, RuntimeTransaction, Transaction,
    SubmittedTransaction, P2pMessage, RpcRequest, RpcResponse, NodeConfig, NodeStatus,
    NetworkId, PeerEndpoint, ConsensusConfig, RevenueSnapshot,
    HEADER_SIZE, MAX_MEMPOOL_TRANSACTIONS, MAX_REORG_DEPTH, DEFAULT_BLOCK_RETENTION,
    MAX_TEMPLATE_TRANSACTIONS, MAX_TEMPLATE_UTXO_TRANSACTIONS,
};
use crate::v3_compat::{
    self as compat, BlockCandidate, DifficultyTarget, MiningHeader, MiningJob,
    MiningSolution, SealedBlock,
};
use crate::v3_tx as tx;
use crate::crypto;
use crate::difficulty;
use crate::emission;
use crate::fee;
use crate::launch;
use crate::v3_bridge as bridge;
use crate::v3_bridge::{
    BridgeUnlockRequest, BridgeValidatorProof, bridge_operation_message,
    bridge_unlock_memo_with_proofs, bridge_unlock_replay_key,
    bridge_unlock_replay_key_from_transaction, load_bridge_validator_pubkey_allowlist,
    required_bridge_validator_threshold, validate_bridge_unlock_transaction_shape_with_utxos,
    verify_bridge_proofs,
};
use crate::v3_validation as validation;

use zion_cosmic_harmony_v3::{
    account_tx_memo_v1_active, body_root_v2_active, cosmic_harmony_ekam_deeksha,
    cosmic_harmony_with_height, profile_name, profile_name_for_height, tx_hash_v2_active,
    TX_HASH_V2_ACTIVATION_HEIGHT,
};

#[derive(Debug, Clone)]
pub(crate) struct TemplateState {
    pub(crate) template_id: u64,
    pub(crate) height: u64,
    pub(crate) header: MiningHeader,
    pub(crate) target: DifficultyTarget,
    pub(crate) difficulty: u64,
    pub(crate) reward_zion: u64,
    pub(crate) transactions: Vec<RuntimeTransaction>,
    pub(crate) total_fees_zion: u64,
}
#[derive(Debug, Clone)]
pub(crate) struct ChainState {
    pub(crate) height: u64,
    pub(crate) tip_hash: [u8; 32],
    pub(crate) next_template_id: u64,
    pub(crate) active_template: TemplateState,
    pub(crate) accepted_blocks: Vec<AcceptedBlock>,
    pub(crate) accepted_by_height: BTreeMap<u64, AcceptedBlock>,
    pub(crate) accepted_by_template_id: HashMap<u64, AcceptedBlock>,
    pub(crate) mempool: Vec<RuntimeTransaction>,
    pub(crate) mempool_by_id: HashMap<String, RuntimeTransaction>,
    /// Address to credit in coinbase transactions. Empty = no coinbase generated.
    pub(crate) miner_address: String,
    /// Humanitarian fund address (5% of coinbase). Empty = portion goes to miner.
    pub(crate) humanitarian_address: String,
    /// Issobella fund address (5% of coinbase). Empty = portion goes to miner.
    pub(crate) issobella_address: String,
    /// Pool fee address (1% of coinbase). Empty = portion goes to miner.
    pub(crate) pool_fee_address: String,
    pub(crate) bridge_unlock_replay_keys: HashSet<String>,
    /// In-memory address → block indices map for O(1) transaction history lookup.
    /// Built incrementally as blocks are accepted. Key = address, Value = indices
    /// into `accepted_blocks` where that address appears (as sender, recipient, or miner).
    pub(crate) address_tx_index: HashMap<String, Vec<usize>>,
    /// Maximum number of blocks to keep in memory. 0 = unlimited.
    /// Old blocks are pruned from in-memory caches but remain in LMDB.
    pub(crate) block_retention: usize,
    /// Per-instance F5 balance-check activation height. Default `u64::MAX`
    /// (disabled). Tests can set this to 0 to enable from genesis without
    /// affecting parallel test runtimes.
    pub(crate) balance_check_height: u64,
    /// Per-instance F4.7 max-tx-amount cap activation height. Default `u64::MAX`
    /// (disabled). When active, rejects any non-genesis, non-coinbase TX whose
    /// amount exceeds `emission::TOTAL_SUPPLY`.
    pub(crate) max_tx_amount_height: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ChainStateSnapshot {
    height: u64,
    tip_hash_hex: String,
    next_template_id: u64,
    active_template: BlockTemplate,
    accepted_blocks: Vec<AcceptedBlock>,
    mempool: Vec<Transaction>,
    #[serde(default)]
    utxo_mempool: Vec<tx::Transaction>,
    #[serde(default)]
    bridge_unlock_replay_keys: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ChainStore {
    pub(crate) path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(clippy::large_enum_variant)] // boxing would change journal (de)serialization shape
pub(crate) enum ChainJournalEntry {
    TransactionAccepted { transaction: RuntimeTransaction },
    BlockAccepted { block: AcceptedBlock },
}
impl TemplateState {
    pub(crate) fn account_transactions(&self) -> Vec<Transaction> {
        self.transactions
            .iter()
            .filter_map(|transaction| transaction.as_account().cloned())
            .collect()
    }

    pub(crate) fn utxo_transactions(&self) -> Vec<tx::Transaction> {
        self.transactions
            .iter()
            .filter_map(|transaction| transaction.as_utxo().cloned())
            .collect()
    }

    pub(crate) fn as_public(&self) -> BlockTemplate {
        let account_transactions = self.account_transactions();
        let utxo_transactions = self.utxo_transactions();
        let estimated_miner_reward_zion = account_transactions
            .first()
            .filter(|transaction| transaction.from == "coinbase")
            .map(|transaction| transaction.amount_zion)
            .map(|amount| u64::try_from(amount).unwrap_or(self.reward_zion))
            .unwrap_or(self.reward_zion);
        BlockTemplate {
            template_id: self.template_id,
            height: self.height,
            header_hex: hex(&self.header.to_bytes()),
            target_hex: hex(&self.target.bytes),
            reward_zion: self.reward_zion,
            transaction_ids: account_transactions
                .iter()
                .map(|transaction| transaction.tx_id.clone())
                .collect(),
            transaction_count: account_transactions.len(),
            total_fees_zion: self.total_fees_zion,
            body_hash_hex: body_hash_hex(&account_transactions),
            estimated_miner_reward_zion,
            utxo_transaction_ids: utxo_transactions.iter().map(|tx| hex(&tx.id)).collect(),
            utxo_transaction_count: utxo_transactions.len(),
            total_utxo_fees: utxo_transactions.iter().map(|tx| tx.fee).sum(),
        }
    }
}
/// Re-export SpendableUtxo from v3_chain for compatibility with v3_bridge functions.
pub use crate::v3_chain::SpendableUtxo;
impl ChainState {
    pub(crate) fn account_mempool_transactions(&self) -> Vec<Transaction> {
        self.mempool
            .iter()
            .filter_map(|transaction| transaction.as_account().cloned())
            .collect()
    }

    pub(crate) fn utxo_mempool_transactions(&self) -> Vec<tx::Transaction> {
        self.mempool
            .iter()
            .filter_map(|transaction| transaction.as_utxo().cloned())
            .collect()
    }

    /// Returns `true` if F5 balance validation is active at the given height
    /// for this chain state instance.
    pub(crate) fn balance_check_active_at(&self, height: u64) -> bool {
        height >= self.balance_check_height
    }

    /// Returns `true` if the F4.7 max-tx-amount cap is active at the given
    /// height for this chain state instance.
    pub(crate) fn max_tx_amount_active_at(&self, height: u64) -> bool {
        height >= self.max_tx_amount_height
    }

    /// Build the full UTXO set from accepted blocks. Returns a map from
    /// (tx_hash_hex, output_index) → SpendableUtxo for all unspent outputs.
    pub(crate) fn utxo_set(&self) -> HashMap<(String, u32), SpendableUtxo> {
        let mut utxos: HashMap<(String, u32), SpendableUtxo> = HashMap::new();
        for block in &self.accepted_blocks {
            // Consume spent inputs
            for utxo_tx in &block.utxo_transactions {
                for input in &utxo_tx.inputs {
                    utxos.remove(&(hex(&input.prev_tx_hash), input.output_index));
                }
            }
            // Create new outputs
            for utxo_tx in &block.utxo_transactions {
                let tx_hash = hex(&utxo_tx.id);
                for (idx, output) in utxo_tx.outputs.iter().enumerate() {
                    utxos.insert(
                        (tx_hash.clone(), idx as u32),
                        SpendableUtxo {
                            tx_hash: tx_hash.clone(),
                            output_index: idx as u32,
                            amount: output.amount,
                            address: output.address.clone(),
                            height: block.height,
                        },
                    );
                }
            }
        }
        utxos
    }

    /// Compute balance for a `zion1...` address by summing unspent UTXO outputs.
    pub(crate) fn utxo_balance(&self, address: &str) -> u128 {
        self.utxo_set()
            .values()
            .filter(|u| u.address == address)
            .map(|u| u.amount as u128)
            .sum()
    }

    /// Compute the confirmed account-model balance for a `zion1...` address
    /// by walking all accepted blocks and summing credits (to) minus debits
    /// (from + fee). Returns 0 for unknown addresses. This mirrors the RPC
    /// `getBalance` computation and is used by the F5 balance-check guard.
    pub(crate) fn account_balance_for(&self, address: &str) -> u128 {
        let mut balance: i128 = 0;
        for block in &self.accepted_blocks {
            for tx in &block.transactions {
                if tx.from == "coinbase" {
                    if tx.to == address {
                        balance = balance.saturating_add(tx.amount_zion as i128);
                    }
                    continue;
                }
                if tx.to == address {
                    balance = balance.saturating_add(tx.amount_zion as i128);
                }
                if tx.from == address {
                    balance =
                        balance.saturating_sub((tx.amount_zion + tx.fee_zion as u128) as i128);
                }
            }
        }
        // Also include pending mempool debits so a sender cannot double-spend
        // the same balance via two rapid RPC submissions.
        for entry in &self.mempool {
            if let Some(tx) = entry.as_account() {
                if tx.from == address {
                    balance =
                        balance.saturating_sub((tx.amount_zion + tx.fee_zion as u128) as i128);
                }
            }
        }
        balance.max(0) as u128
    }

    /// Confirmed balance from accepted blocks only (no mempool subtraction).
    /// Used by `validate_peer_block` where intra-block debits are handled
    /// separately by the prior-TX loop.  Using `account_balance_for` there
    /// would double-count the TX being validated (it's still in the mempool
    /// during validation), requiring 2× the balance unnecessarily.
    pub(crate) fn confirmed_balance_for(&self, address: &str) -> u128 {
        let mut balance: i128 = 0;
        for block in &self.accepted_blocks {
            for tx in &block.transactions {
                if tx.from == "coinbase" {
                    if tx.to == address {
                        balance = balance.saturating_add(tx.amount_zion as i128);
                    }
                    continue;
                }
                if tx.to == address {
                    balance = balance.saturating_add(tx.amount_zion as i128);
                }
                if tx.from == address {
                    balance =
                        balance.saturating_sub((tx.amount_zion + tx.fee_zion as u128) as i128);
                }
            }
        }
        balance.max(0) as u128
    }

    /// Return all spendable (unspent) UTXOs for a `zion1...` address.
    pub(crate) fn spendable_utxos(&self, address: &str) -> Vec<SpendableUtxo> {
        self.utxo_set()
            .into_values()
            .filter(|u| u.address == address)
            .collect()
    }

    pub(crate) fn accepted_bridge_unlock_replay_keys(&self) -> HashSet<String> {
        self.accepted_blocks
            .iter()
            .flat_map(|block| block.utxo_transactions.iter())
            .filter_map(bridge_unlock_replay_key_from_transaction)
            .collect()
    }

    pub(crate) fn rebuild_bridge_unlock_replay_keys(&mut self) {
        self.bridge_unlock_replay_keys = self.accepted_bridge_unlock_replay_keys();
        self.bridge_unlock_replay_keys.extend(
            self.mempool
                .iter()
                .filter_map(|transaction| transaction.as_utxo())
                .filter_map(bridge_unlock_replay_key_from_transaction),
        );
    }

    pub(crate) fn validate_bridge_unlock_transaction_shape(
        &self,
        transaction: &tx::Transaction,
        block_height: u64,
    ) -> Result<Option<String>, String> {
        let utxos = self.utxo_set();
        validate_bridge_unlock_transaction_shape_with_utxos(transaction, &utxos, block_height)
    }

    /// Check whether a specific outpoint exists as an unspent UTXO on chain.
    pub(crate) fn utxo_exists(&self, tx_hash: &[u8; 32], output_index: u32) -> bool {
        self.utxo_set().contains_key(&(hex(tx_hash), output_index))
    }

    pub(crate) fn new(node_id: &str, core: &CoreRuntime) -> Self {
        let genesis = genesis_accepted_block();
        let genesis_hash = parse_fixed_hex::<32>(&genesis.hash_hex, "genesis hash")
            .expect("genesis hash must be valid hex");
        let mempool = Vec::new();
        let template = Self::build_template(
            node_id,
            core,
            0,
            genesis_hash,
            1,
            &mempool,
            std::slice::from_ref(&genesis),
            "",
            "",
            "",
            "",
            u64::MAX,
        );
        let mut accepted_by_height = BTreeMap::new();
        accepted_by_height.insert(0, genesis.clone());
        let mut state = Self {
            height: 0,
            tip_hash: genesis_hash,
            next_template_id: 2,
            active_template: template,
            accepted_blocks: vec![genesis],
            accepted_by_height,
            accepted_by_template_id: HashMap::new(),
            mempool,
            mempool_by_id: HashMap::new(),
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            bridge_unlock_replay_keys: HashSet::new(),
            address_tx_index: HashMap::new(),
            block_retention: DEFAULT_BLOCK_RETENTION,
            balance_check_height: zion_cosmic_harmony_v3::balance_check_activation_height(),
            max_tx_amount_height: zion_cosmic_harmony_v3::max_tx_amount_activation_height(),
        };
        // Index genesis block (height 0) for address lookups.
        state.index_block_addresses(0);
        state
    }

    pub(crate) fn from_snapshot(
        node_id: &str,
        core: &CoreRuntime,
        snapshot: ChainStateSnapshot,
    ) -> Result<Self, String> {
        let persisted_transaction_ids = snapshot.active_template.transaction_ids.clone();
        let tip_hash = parse_fixed_hex::<32>(&snapshot.tip_hash_hex, "persisted tip hash")?;
        let header = MiningHeader::from_bytes(parse_fixed_hex::<HEADER_SIZE>(
            &snapshot.active_template.header_hex,
            "persisted active template header",
        )?);
        let target = difficulty_target_from_hex(&snapshot.active_template.target_hex)?;
        // Recover difficulty from accepted blocks via LWMA for the persisted template.
        let recovered_difficulty = if snapshot.accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let ab = &snapshot.accepted_blocks;
            let start = ab.len().saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = ab[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        let mut chain_state = Self {
            height: snapshot.height,
            tip_hash,
            next_template_id: snapshot.next_template_id,
            active_template: TemplateState {
                template_id: snapshot.active_template.template_id,
                height: snapshot.active_template.height,
                header,
                target,
                difficulty: recovered_difficulty,
                reward_zion: snapshot.active_template.reward_zion,
                transactions: Vec::new(),
                total_fees_zion: snapshot.active_template.total_fees_zion,
            },
            accepted_blocks: {
                // Ensure genesis block (height 0) is always present in memory.
                // It may be missing if the snapshot was saved with block retention
                // pruning enabled. Genesis is needed for premine wallet discovery
                // via getBlockByHeight(0) RPC.
                let mut blocks = snapshot.accepted_blocks;
                if blocks.first().map(|b| b.height) != Some(0) {
                    blocks.insert(0, genesis_accepted_block());
                }
                blocks
            },
            accepted_by_height: BTreeMap::new(),
            accepted_by_template_id: HashMap::new(),
            mempool: snapshot
                .mempool
                .into_iter()
                .map(RuntimeTransaction::from)
                .chain(
                    snapshot
                        .utxo_mempool
                        .into_iter()
                        .map(RuntimeTransaction::from),
                )
                .collect(),
            mempool_by_id: HashMap::new(),
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            bridge_unlock_replay_keys: snapshot.bridge_unlock_replay_keys.into_iter().collect(),
            address_tx_index: HashMap::new(),
            block_retention: DEFAULT_BLOCK_RETENTION,
            balance_check_height: zion_cosmic_harmony_v3::balance_check_activation_height(),
            max_tx_amount_height: zion_cosmic_harmony_v3::max_tx_amount_activation_height(),
        };
        chain_state.rebuild_mempool_index();
        chain_state.rebuild_address_tx_index();
        chain_state.active_template.transactions = persisted_transaction_ids
            .iter()
            .filter_map(|tx_id| chain_state.mempool_by_id.get(tx_id).cloned())
            .collect();
        chain_state.sanitize_recovered_state(node_id, core)?;
        Ok(chain_state)
    }

    pub(crate) fn build_bridge_unlock_transaction(
        &self,
        request: &BridgeUnlockRequest,
        proofs: &[BridgeValidatorProof],
    ) -> Result<tx::Transaction, String> {
        if request.amount_flowers == 0 {
            return Err("bridge unlock amount must be greater than zero".to_string());
        }
        if !crypto::is_valid_address(&request.recipient) {
            return Err("bridge unlock recipient must be a valid zion1 address".to_string());
        }

        // Validate that the proofs sign the canonical operation message
        // *before* persisting anything. The same checks run again in
        // `validate_bridge_unlock_transaction_shape_with_utxos` (peer block /
        // mempool path), so this is defence in depth — and a clearer error
        // surface for the JSON-RPC submitter.
        let operation_message = bridge_operation_message(
            &request.recipient,
            request.amount_flowers,
            &request.source_chain,
            &request.burn_id,
            &request.evm_tx_hash,
        );
        let allowed_pubkeys = load_bridge_validator_pubkey_allowlist();
        let threshold = required_bridge_validator_threshold();
        verify_bridge_proofs(proofs, &operation_message, &allowed_pubkeys, threshold)?;

        let replay_key = bridge_unlock_replay_key(
            &request.source_chain,
            &request.burn_id,
            &request.evm_tx_hash,
        );
        if self.bridge_unlock_replay_keys.contains(&replay_key) {
            return Err(format!(
                "bridge unlock replay key already used: {replay_key}"
            ));
        }

        let mut spendable = self.spendable_utxos(fee::BRIDGE_VAULT_ADDRESS);
        spendable.sort_by(|left, right| {
            left.height
                .cmp(&right.height)
                .then(left.tx_hash.cmp(&right.tx_hash))
                .then(left.output_index.cmp(&right.output_index))
        });

        let pending_height = self.height.saturating_add(1);
        let scale_fix_active = crate::v3_bridge::bridge_unlock_scale_fix_active(pending_height);

        let mut selected = Vec::new();
        let mut total_input = 0u64;
        let mut required_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(1, 2));
        for utxo in spendable {
            // Normalize legacy-scale bridge-vault UTXOs to post-migration 1e6 flowers
            // once the scaling hard fork is active. Before the fork the legacy raw
            // summation is preserved for consensus compatibility.
            let scaled_amount = if scale_fix_active {
                crate::v3_bridge::bridge_vault_utxo_scaled_amount(utxo.amount, utxo.height)
            } else {
                utxo.amount
            };
            total_input = total_input
                .checked_add(scaled_amount)
                .ok_or_else(|| "bridge unlock input sum overflowed".to_string())?;
            selected.push(utxo);
            required_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(selected.len(), 2));
            let required_total = request
                .amount_flowers
                .checked_add(required_fee)
                .ok_or_else(|| "bridge unlock amount plus fee overflowed".to_string())?;
            if total_input >= required_total {
                break;
            }
        }

        let required_total = request
            .amount_flowers
            .checked_add(required_fee)
            .ok_or_else(|| "bridge unlock amount plus fee overflowed".to_string())?;
        if total_input < required_total {
            return Err(format!(
                "bridge vault balance {} is insufficient for unlock amount {} plus fee {}",
                total_input, request.amount_flowers, required_fee,
            ));
        }

        let mut outputs = vec![tx::TxOutput {
            amount: request.amount_flowers,
            address: request.recipient.clone(),
            memo: Some(bridge_unlock_memo_with_proofs(
                &request.source_chain,
                &request.burn_id,
                &request.evm_tx_hash,
                proofs,
            )),
        }];

        let change = total_input - required_total;
        if change > 0 {
            outputs.push(tx::TxOutput {
                amount: change,
                address: fee::BRIDGE_VAULT_ADDRESS.to_string(),
                memo: None,
            });
        }

        let bridge_utxo_ver = if tx_hash_v2_active(pending_height) {
            tx::TX_HASH_V2_VERSION
        } else {
            1
        };
        let mut transaction = tx::Transaction {
            id: [0u8; 32],
            version: bridge_utxo_ver,
            inputs: selected
                .into_iter()
                .map(|utxo| tx::TxInput {
                    prev_tx_hash: parse_fixed_hex::<32>(&utxo.tx_hash, "bridge vault UTXO hash")
                        .expect("spendable_utxos must contain valid tx hashes"),
                    output_index: utxo.output_index,
                    signature: Vec::new(),
                    public_key: Vec::new(),
                })
                .collect(),
            outputs,
            fee: required_fee,
            timestamp: now_secs(),
        };
        transaction.finalize_id();
        Ok(transaction)
    }

    pub(crate) fn accept_block(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        accepted_block: AcceptedBlock,
        sealed_block: SealedBlock,
    ) -> Result<(), String> {
        self.validate_peer_block(&accepted_block)?;
        self.accept_block_record(node_id, core, accepted_block, sealed_block.hash);
        Ok(())
    }

    pub(crate) fn accept_block_record(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        accepted_block: AcceptedBlock,
        tip_hash: [u8; 32],
    ) {
        self.height = accepted_block.height;
        self.tip_hash = tip_hash;
        let mined_ids: HashSet<&str> = accepted_block
            .transaction_ids
            .iter()
            .chain(accepted_block.utxo_transaction_ids.iter())
            .map(String::as_str)
            .collect();
        self.mempool
            .retain(|transaction| !mined_ids.contains(transaction.tx_id().as_str()));
        self.rebuild_mempool_index();
        self.accepted_by_height
            .insert(accepted_block.height, accepted_block.clone());
        self.accepted_by_template_id
            .insert(accepted_block.template_id, accepted_block.clone());
        self.accepted_blocks.push(accepted_block);
        // Index the newly accepted block by all involved addresses.
        let new_idx = self.accepted_blocks.len() - 1;
        self.index_block_addresses(new_idx);
        self.rebuild_bridge_unlock_replay_keys();
        // Prune old blocks from memory if retention window is set.
        self.prune_old_blocks();
        let next_template_id = self.next_template_id;
        let miner_addr = self.miner_address.clone();
        let humanitarian_addr = self.humanitarian_address.clone();
        let issobella_addr = self.issobella_address.clone();
        let pool_fee_addr = self.pool_fee_address.clone();
        self.active_template = Self::build_template(
            node_id,
            core,
            self.height,
            self.tip_hash,
            next_template_id,
            &self.mempool,
            &self.accepted_blocks,
            &miner_addr,
            &humanitarian_addr,
            &issobella_addr,
            &pool_fee_addr,
            self.balance_check_height,
        );
        self.next_template_id = self.next_template_id.wrapping_add(1);
    }

    pub(crate) fn apply_journal_entry(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        entry: ChainJournalEntry,
    ) -> Result<(), String> {
        match entry {
            ChainJournalEntry::TransactionAccepted { transaction } => {
                if self.mempool_by_id.contains_key(&transaction.tx_id())
                    || self.accepted_blocks.iter().any(|block| {
                        block
                            .transaction_ids
                            .iter()
                            .chain(block.utxo_transaction_ids.iter())
                            .any(|tx_id| tx_id == &transaction.tx_id())
                    })
                {
                    return Ok(());
                }
                match transaction {
                    RuntimeTransaction::Account(transaction) => {
                        self.insert_transaction(node_id, core, transaction)
                    }
                    RuntimeTransaction::Utxo(transaction) => {
                        self.insert_utxo_transaction(node_id, core, transaction)
                    }
                }
            }
            ChainJournalEntry::BlockAccepted { block } => {
                if let Some(existing) = self.accepted_by_template_id.get(&block.template_id) {
                    if existing.hash_hex == block.hash_hex {
                        return Ok(());
                    }
                    return Err(format!(
                        "journal block {} conflicts with existing accepted block",
                        block.template_id
                    ));
                }

                let tip_hash = parse_fixed_hex::<32>(&block.hash_hex, "journal block hash")?;
                self.accept_block_record(node_id, core, block, tip_hash);
                Ok(())
            }
        }
    }

    pub(crate) fn import_peer_block(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        block: AcceptedBlock,
    ) -> Result<(), String> {
        // Delegate to the batch path so single-block announcements and
        // contiguous batch imports share the same fork/reorg logic.
        self.import_peer_blocks(node_id, core, vec![block])?;
        Ok(())
    }

    pub(crate) fn import_peer_blocks(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        blocks: Vec<AcceptedBlock>,
    ) -> Result<usize, String> {
        if blocks.is_empty() {
            return Ok(0);
        }

        // ── Structural pre-checks (no chain-state dependency) ──────────
        // The batch must be internally contiguous in height. Parent linkage is
        // verified for blocks that carry a parent reference; legacy blocks
        // without one are accepted as long as heights are contiguous.
        for window in blocks.windows(2) {
            let prev = &window[0];
            let block = &window[1];
            if block.height != prev.height.saturating_add(1) {
                return Err(format!(
                    "peer batch is not contiguous: expected height {}, got {}",
                    prev.height.saturating_add(1),
                    block.height
                ));
            }
            if let Some(parent) = Self::extract_previous_hash_hex(block) {
                if parent != prev.hash_hex {
                    return Err(format!(
                        "peer batch block at height {} does not link to previous batch block (parent {})",
                        block.height, parent
                    ));
                }
            }
        }

        // Skip any leading blocks we already have with the same hash
        // (e.g. the common prefix of the local chain and the peer batch).
        let skip_count = blocks
            .iter()
            .take_while(|block| {
                self.accepted_by_height
                    .get(&block.height)
                    .is_some_and(|existing| existing.hash_hex == block.hash_hex)
            })
            .count();
        let tail: Vec<AcceptedBlock> = blocks.into_iter().skip(skip_count).collect();
        if tail.is_empty() {
            return Ok(0);
        }

        let first = &tail[0];

        // Genesis is immutable; if the batch starts with height 0, it must
        // match the canonical genesis. A matching genesis was already skipped
        // above, so any remaining height-0 block is a conflict.
        if first.height == 0 {
            if self
                .accepted_by_height
                .get(&0)
                .is_some_and(|g| g.hash_hex == first.hash_hex)
            {
                return Ok(0);
            }
            return self.validate_peer_block(first).map(|_| 0);
        }

        // If the first block has no parent reference, treat the whole tail as
        // legacy blocks that can only extend the current tip by height.
        match Self::extract_previous_hash_hex(first) {
            None => {
                if first.height != self.height.saturating_add(1) {
                    return Err(format!(
                        "peer batch starts at height {} but current tip is at height {} (legacy blocks must extend the current tip)",
                        first.height, self.height
                    ));
                }
                if let Some(existing) = self.accepted_by_height.get(&first.height) {
                    if existing.hash_hex != first.hash_hex {
                        return Err(format!(
                            "conflicting peer block at height {}: local block {} differs from peer block {}",
                            first.height, existing.hash_hex, first.hash_hex
                        ));
                    }
                }
            }
            Some(first_parent) => {
                // Strict parent-based linkage: determine the common ancestor and
                // whether this fork would produce a strictly longer chain.
                let (common_ancestor_height, needs_rollback) = if first.height
                    == self.height.saturating_add(1)
                    && first_parent == hex(&self.tip_hash)
                {
                    // Normal extension from the current tip, no rollback needed.
                    (self.height, false)
                } else if let Some(ancestor) = self.find_ancestor_by_hash(&first_parent) {
                    let ancestor_height = ancestor.height;
                    if first.height != ancestor_height.saturating_add(1) {
                        // The batch does not contain the blocks between the common
                        // ancestor and the first provided block. The caller needs to
                        // request an earlier starting height to supply the full fork.
                        return Err(format!(
                            "reorg_context_missing: peer batch starts at height {} but common ancestor is at height {} (missing blocks {}..={})",
                            first.height,
                            ancestor_height,
                            ancestor_height.saturating_add(1),
                            first.height.saturating_sub(1)
                        ));
                    }
                    let new_height = ancestor_height.saturating_add(tail.len() as u64);
                    if new_height <= self.height {
                        return Err(format!(
                            "conflicting peer block at height {}: peer batch does not extend current chain (new height {} <= current height {})",
                            first.height, new_height, self.height
                        ));
                    }
                    (ancestor_height, ancestor_height < self.height)
                } else {
                    if first.height == self.height.saturating_add(1) {
                        return Err(format!(
                            "peer block {} previous_hash {} does not link to local tip {} (broken chain linkage)",
                            first.height, first_parent, hex(&self.tip_hash)
                        ));
                    }
                    return Err(format!(
                        "peer batch block at height {} has unknown parent {} (no common ancestor in local chain)",
                        first.height, first_parent
                    ));
                };

                if needs_rollback {
                    let reorg_depth = self.height.saturating_sub(common_ancestor_height);
                    if reorg_depth > MAX_REORG_DEPTH {
                        return Err(format!(
                            "reorg_too_deep: reorg depth {} exceeds MAX_REORG_DEPTH {}",
                            reorg_depth, MAX_REORG_DEPTH
                        ));
                    }
                    self.rollback_to_height(node_id, core, common_ancestor_height)?;
                }
            }
        }

        // After rollback/alignment, the first block must be a direct child of
        // the current tip. This is a final sanity check before we start
        // expensive validation.
        if first.height != self.height.saturating_add(1) {
            return Err(format!(
                "peer batch block at height {} does not link to local tip (expected height {})",
                first.height,
                self.height.saturating_add(1)
            ));
        }
        if let Some(parent) = Self::extract_previous_hash_hex(first) {
            if parent != hex(&self.tip_hash) {
                return Err(format!(
                    "peer batch block at height {} does not link to local tip {} (parent {})",
                    first.height,
                    hex(&self.tip_hash),
                    parent
                ));
            }
        }

        // Reserve local template ids above every block in the remaining batch
        // and every remaining local block so that new local templates never
        // collide with an accepted block.
        let max_local_template_id = self
            .accepted_blocks
            .iter()
            .map(|block| block.template_id)
            .max()
            .unwrap_or(0);
        let max_batch_template_id = tail
            .iter()
            .map(|block| block.template_id)
            .max()
            .unwrap_or(0);
        let max_template_id = max_local_template_id.max(max_batch_template_id);
        self.next_template_id = max_template_id.wrapping_add(2);

        // ── Validate-and-accept one block at a time so that each
        //    subsequent block sees the updated accepted_blocks window
        //    (required for correct LWMA difficulty validation). ─────────
        let mut imported = 0usize;
        for block in tail {
            if block.height != self.height.saturating_add(1) {
                return Err(format!(
                    "peer batch is not contiguous: expected height {}, got {}",
                    self.height.saturating_add(1),
                    block.height
                ));
            }
            self.validate_peer_block(&block)?;
            let tip_hash = parse_fixed_hex::<32>(&block.hash_hex, "peer block hash")?;
            self.accept_block_record(node_id, core, block, tip_hash);
            imported += 1;
        }
        Ok(imported)
    }

    /// Extract previous_hash_hex from a peer block, preferring the explicit
    /// field and falling back to header_hex extraction.  Returns `None` for
    /// legacy blocks that carry neither.
    pub(crate) fn extract_previous_hash_hex(block: &AcceptedBlock) -> Option<String> {
        if !block.previous_hash_hex.is_empty() {
            return Some(block.previous_hash_hex.clone());
        }
        if !block.header_hex.is_empty() {
            if let Ok(bytes) = parse_fixed_hex::<HEADER_SIZE>(&block.header_hex, "header") {
                let header = MiningHeader::from_bytes(bytes);
                return Some(hex(&header.previous_hash));
            }
        }
        None
    }

    pub(crate) fn validate_peer_block(&self, block: &AcceptedBlock) -> Result<(), String> {
        // Genesis block is hard-coded — only verify hash match.
        if block.height == 0 {
            let expected = genesis_accepted_block();
            if block.hash_hex != expected.hash_hex {
                return Err("genesis block hash does not match canonical genesis".to_string());
            }
            return Ok(());
        }

        // ── Checkpoint verification ────────────────────────────────────
        launch::verify_checkpoint(block.height, &block.hash_hex)?;

        // ── PoW verification (required for non-genesis) ───────────────
        let block_hash = parse_fixed_hex::<32>(&block.hash_hex, "peer block hash")?;
        if block.header_hex.is_empty() {
            return Err("peer block missing header_hex — PoW cannot be verified".to_string());
        }
        let header_bytes =
            parse_fixed_hex::<HEADER_SIZE>(&block.header_hex, "peer block header")?;
        let header = MiningHeader::from_bytes(header_bytes);

        // Header fields must be consistent with block metadata
        if header.timestamp != block.timestamp {
            return Err(
                "peer block header timestamp does not match block timestamp".to_string()
            );
        }
        let expected_target = crate::v3_compat::difficulty_to_target(block.difficulty);
        let expected_bits = crate::v3_compat::target_to_compact(&expected_target);
        if header.difficulty_bits != expected_bits {
            return Err(format!(
                "peer block header difficulty_bits {} does not match expected {}",
                header.difficulty_bits, expected_bits
            ));
        }

        // Reject inconsistent parent metadata before doing expensive PoW work.
        if !block.previous_hash_hex.is_empty() {
            let header_prev = hex(&header.previous_hash);
            if block.previous_hash_hex != header_prev {
                return Err(
                    "peer block previous_hash_hex does not match header previous_hash"
                        .to_string(),
                );
            }
        }

        // Verify PoW: recompute hash from header + nonce
        let candidate = BlockCandidate {
            header,
            nonce: block.nonce,
            height: block.height,
        };
        let computed_hash = candidate.hash();
        if computed_hash != block_hash {
            return Err(
                "peer block hash does not match PoW computation from header and nonce"
                    .to_string(),
            );
        }

        // Verify hash meets difficulty target
        let target = crate::v3_compat::difficulty_to_target(block.difficulty);
        if !target.allows(&computed_hash) {
            return Err("peer block PoW hash does not meet difficulty target".to_string());
        }

        // ── Timestamp sanity ───────────────────────────────────────────
        let current_time = now_secs();
        let median_time_past = if self.accepted_blocks.is_empty() {
            0
        } else {
            let start = self.accepted_blocks.len().saturating_sub(11);
            let mut timestamps: Vec<u64> = self.accepted_blocks[start..]
                .iter()
                .map(|b| b.timestamp)
                .collect();
            timestamps.sort_unstable();
            timestamps[timestamps.len() / 2]
        };
        validation::validate_timestamp(block.timestamp, median_time_past, current_time)
            .map_err(|e| format!("peer block timestamp invalid: {e}"))?;

        // ── Transaction structure ──────────────────────────────────────
        if block.transaction_ids.len() != block.transactions.len() {
            return Err("peer block transaction ids do not match block body length".to_string());
        }
        let expected_ids = block
            .transactions
            .iter()
            .map(|transaction| transaction.tx_id.clone())
            .collect::<Vec<_>>();
        if expected_ids != block.transaction_ids {
            return Err(
                "peer block transaction ids do not match serialized transactions".to_string(),
            );
        }
        let mut seen_tx_ids = HashSet::new();
        let mut seen_sender_nonces = HashSet::new();
        let mut coinbase_count = 0usize;
        let mut total_coinbase_zion = 0u64;
        // Fee split is active when humanitarian + issobella funds are present.
        // The pool-fee 1% slot is burned (never minted), so it has no address
        // and no coinbase output.
        let has_fee_addresses =
            !block.humanitarian_address.is_empty() || !block.issobella_address.is_empty();
        let has_all_fee_addresses =
            !block.humanitarian_address.is_empty() && !block.issobella_address.is_empty();
        if has_fee_addresses && !has_all_fee_addresses {
            return Err("peer block fee split metadata must provide all fee addresses".to_string());
        }
        let (
            expected_miner_reward,
            expected_humanitarian_reward,
            expected_issobella_reward,
            expected_burned_pool_fee,
        ) = emission::fee_split(block.subsidy_zion);
        // Total newly-minted coinbase = subsidy minus the burned pool fee.
        let expected_minted = block.subsidy_zion - expected_burned_pool_fee;
        let total_fees_zion = block
            .transactions
            .iter()
            .enumerate()
            .map(|(index, transaction)| {
                if !seen_tx_ids.insert(transaction.tx_id.clone()) {
                    return Err(format!(
                        "peer block contains duplicate transaction id {}",
                        transaction.tx_id
                    ));
                }
                if transaction.from == "coinbase" {
                    coinbase_count = coinbase_count.saturating_add(1);
                    let coinbase_amt = u64::try_from(transaction.amount_zion).map_err(|_| {
                        "peer block coinbase amount exceeds u64".to_string()
                    })?;
                    total_coinbase_zion = total_coinbase_zion.saturating_add(coinbase_amt);
                    if transaction.tx_id.len() != 64
                        || !transaction.tx_id.chars().all(|ch| ch.is_ascii_hexdigit())
                    {
                        return Err("peer block coinbase transaction id must be exactly 64 hex chars"
                            .to_string());
                    }
                    if transaction.to.trim().is_empty() {
                        return Err(
                            "peer block coinbase recipient must not be empty".to_string(),
                        );
                    }
                    if !is_valid_account_id(&transaction.to) {
                        return Err(
                            "peer block coinbase recipient must use a 3-64 ascii wallet id"
                                .to_string(),
                        );
                    }
                    if index != coinbase_count.saturating_sub(1) {
                        return Err(
                            "peer block coinbase transactions must be contiguous at the start"
                                .to_string(),
                        );
                    }
                    if transaction.fee_zion != 0 {
                        return Err("peer block coinbase transaction must have zero fee".to_string());
                    }
                    if transaction.nonce != block.height {
                        return Err(format!(
                            "peer block coinbase nonce {} does not match block height {}",
                            transaction.nonce, block.height
                        ));
                    }
                    if block.miner_address.is_empty() {
                        return Err(
                            "peer block coinbase transaction requires miner_address metadata"
                                .to_string(),
                        );
                    }
                    let (expected_to, expected_amount, expected_label) = if has_all_fee_addresses {
                        match index {
                            0 => (
                                block.miner_address.as_str(),
                                expected_miner_reward,
                                format!("coinbase:{}:{}", block.height, block.miner_address),
                            ),
                            1 => (
                                block.humanitarian_address.as_str(),
                                expected_humanitarian_reward,
                                format!(
                                    "coinbase_humanitarian:{}:{}",
                                    block.height, block.humanitarian_address
                                ),
                            ),
                            2 => (
                                block.issobella_address.as_str(),
                                expected_issobella_reward,
                                format!(
                                    "coinbase_issobella:{}:{}",
                                    block.height, block.issobella_address
                                ),
                            ),
                            _ => {
                                return Err(
                                    "peer block contains too many split coinbase transactions"
                                        .to_string(),
                                )
                            }
                        }
                    } else {
                        (
                            block.miner_address.as_str(),
                            block.subsidy_zion,
                            format!("coinbase:{}:{}", block.height, block.miner_address),
                        )
                    };
                    if transaction.to != expected_to {
                        return Err(
                            "peer block coinbase recipient does not match expected payout address"
                                .to_string(),
                        );
                    }
                    if transaction.amount_zion != u128::from(expected_amount) {
                        return Err(format!(
                            "peer block coinbase amount {} does not match expected {}",
                            transaction.amount_zion, expected_amount
                        ));
                    }
                    let expected_coinbase_hash =
                        cosmic_harmony_ekam_deeksha(expected_label.as_bytes(), block.height);
                    let expected_coinbase_id = hex(&expected_coinbase_hash.data);
                    if transaction.tx_id != expected_coinbase_id {
                        return Err(
                            "peer block coinbase tx_id is not deterministic for the expected payout slot"
                                .to_string(),
                        );
                    }
                } else {
                    transaction.validate()?;
                    // Height-gate the from-address signature verification: only
                    // enforce for blocks at or after the account-model memo v1
                    // hard fork. Historical blocks (pre-activation) may contain
                    // account TXs where the public key does not derive to the
                    // sender address, because that check was not enforced when
                    // they were created.
                    if account_tx_memo_v1_active(block.height)
                        && !transaction.verify_signature()
                    {
                        return Err("account transaction signature verification failed".to_string());
                    }
                    if !seen_sender_nonces.insert((transaction.from.clone(), transaction.nonce)) {
                        return Err(format!(
                            "peer block reuses sender nonce {} for {}",
                            transaction.nonce, transaction.from
                        ));
                    }
                    // Cross-block replay guard: reject an account nonce that was
                    // already mined in a prior accepted block. Mirrors the RPC
                    // `insert_transaction` "already mined" check so the peer-block
                    // path is not weaker than the RPC path (F1-class parity).
                    // Blocks are accepted one at a time in `accept_peer_blocks`,
                    // so `self.accepted_blocks` reflects every prior block in the
                    // same sync batch as well as the persisted chain.
                    if self.accepted_blocks.iter().any(|prior| {
                        prior.transactions.iter().any(|known| {
                            known.from == transaction.from
                                && known.nonce == transaction.nonce
                        })
                    }) {
                        return Err(format!(
                            "peer block reuses already-mined sender nonce {} for {}",
                            transaction.nonce, transaction.from
                        ));
                    }
                    // F4.7: Max-tx-amount sanity cap. No single non-genesis,
                    // non-coinbase TX may move more than the entire money supply
                    // (`emission::TOTAL_SUPPLY`). Defense-in-depth on top of the
                    // F5 balance check: bounds damage from any inflation bug that
                    // fabricates an absurd amount. Height-gated so historical
                    // blocks are never retroactively rejected; genesis (height 0)
                    // is below any activation height and also guarded explicitly.
                    if self.max_tx_amount_active_at(block.height)
                        && transaction.from != "genesis"
                        && transaction.from != "coinbase"
                        && transaction.amount_zion > emission::TOTAL_SUPPLY
                    {
                        return Err(format!(
                            "peer block TX from {} exceeds max allowed amount: {} > TOTAL_SUPPLY {}",
                            transaction.from, transaction.amount_zion, emission::TOTAL_SUPPLY
                        ));
                    }
                    // F5: Balance check — reject if sender has insufficient
                    // confirmed balance. We compute the running balance from
                    // prior accepted blocks plus credits/debits from earlier
                    // transactions in THIS block (so multiple TXs from the
                    // same sender in one block are handled correctly).
                    // Coinbase and genesis TXs are exempt — they create new
                    // coins and have no sender balance to check.
                    if self.balance_check_active_at(block.height)
                        && transaction.from != "coinbase"
                        && transaction.from != "genesis" {
                        let mut sender_balance: i128 =
                            self.confirmed_balance_for(&transaction.from) as i128;
                        // Apply credits/debits from earlier TXs in this block
                        for prior_tx in block.transactions.iter().take(index) {
                            if prior_tx.from == "coinbase" {
                                if prior_tx.to == transaction.from {
                                    sender_balance =
                                        sender_balance.saturating_add(prior_tx.amount_zion as i128);
                                }
                                continue;
                            }
                            if prior_tx.to == transaction.from {
                                sender_balance =
                                    sender_balance.saturating_add(prior_tx.amount_zion as i128);
                            }
                            if prior_tx.from == transaction.from {
                                sender_balance = sender_balance.saturating_sub(
                                    (prior_tx.amount_zion + prior_tx.fee_zion as u128) as i128,
                                );
                            }
                        }
                        let needed =
                            transaction.amount_zion + transaction.fee_zion as u128;
                        if (sender_balance as u128) < needed {
                            return Err(format!(
                                "peer block TX from {} has insufficient balance: {} < {} (amount {} + fee {})",
                                transaction.from, sender_balance.max(0), needed,
                                transaction.amount_zion, transaction.fee_zion
                            ));
                        }
                    }
                }
                Ok(transaction.fee_zion)
            })
            .collect::<Result<Vec<_>, String>>()?
            .into_iter()
            .sum::<u64>();
        if coinbase_count > 3 {
            return Err("peer block contains more than three coinbase transactions".to_string());
        }
        if !block.miner_address.is_empty() && coinbase_count == 0 {
            return Err(
                "peer block miner_address is set but coinbase transaction is missing".to_string(),
            );
        }
        if has_all_fee_addresses && coinbase_count != 3 {
            return Err(
                "peer block with fee split metadata must contain three coinbase transactions \
                 (miner/humanitarian/issobella; the 1% pool fee is burned)"
                    .to_string(),
            );
        }
        if !has_all_fee_addresses && coinbase_count > 1 {
            return Err(
                "peer block without fee split metadata must contain at most one coinbase transaction"
                    .to_string(),
            );
        }
        // With fee split, the coinbase mints 99% (89/5/5) and burns the 1% pool
        // fee; without it, the single coinbase mints the full subsidy.
        let expected_coinbase_total = if has_all_fee_addresses {
            expected_minted
        } else {
            block.subsidy_zion
        };
        if total_coinbase_zion != 0 && total_coinbase_zion != expected_coinbase_total {
            return Err(format!(
                "peer block coinbase total {} does not match expected {}",
                total_coinbase_zion, expected_coinbase_total
            ));
        }
        if total_fees_zion != block.total_fees_zion {
            return Err("peer block fee total does not match serialized transactions".to_string());
        }
        if block.body_hash_hex != body_hash_hex(&block.transactions) {
            return Err("peer block body hash does not match serialized transactions".to_string());
        }
        let expected_block_miner_reward = if has_all_fee_addresses && coinbase_count == 3 {
            expected_miner_reward
        } else {
            block.subsidy_zion
        };
        if block.miner_reward_zion != expected_block_miner_reward {
            return Err(format!(
                "peer block miner reward {} does not match expected {}",
                block.miner_reward_zion, expected_block_miner_reward
            ));
        }
        let expected_subsidy = emission::block_subsidy(block.height);
        if block.subsidy_zion != expected_subsidy {
            return Err(format!(
                "peer block subsidy {} does not match emission schedule {} at height {}",
                block.subsidy_zion, expected_subsidy, block.height
            ));
        }
        // Validate difficulty against LWMA
        let expected_difficulty = if self.accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let start = self
                .accepted_blocks
                .len()
                .saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = self.accepted_blocks[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        if block.difficulty != expected_difficulty {
            return Err(format!(
                "peer block difficulty {} does not match expected {} at height {}",
                block.difficulty, expected_difficulty, block.height
            ));
        }
        // ── UTXO transaction structure ─────────────────────────────────
        let utxo_expected_ids: Vec<String> = block
            .utxo_transactions
            .iter()
            .map(|utxo_tx| hex(&utxo_tx.id))
            .collect();
        if utxo_expected_ids != block.utxo_transaction_ids {
            return Err(
                "peer block UTXO transaction ids do not match serialized UTXO transactions"
                    .to_string(),
            );
        }
        let mut seen_utxo_inputs: HashSet<([u8; 32], u32)> = HashSet::new();
        let mut seen_bridge_unlock_replay_keys = self.accepted_bridge_unlock_replay_keys();
        for utxo_tx in &block.utxo_transactions {
            if utxo_tx.id != utxo_tx.calculate_hash() {
                return Err(format!(
                    "peer block UTXO transaction {} has invalid id",
                    hex(&utxo_tx.id)
                ));
            }
            match self.validate_bridge_unlock_transaction_shape(utxo_tx, block.height)? {
                Some(replay_key) => {
                    if !seen_bridge_unlock_replay_keys.insert(replay_key.clone()) {
                        return Err(format!(
                            "peer block bridge unlock replay key already used: {}",
                            replay_key,
                        ));
                    }
                }
                None => {
                    if !utxo_tx.verify_signatures() {
                        return Err(format!(
                            "peer block UTXO transaction {} has invalid signatures",
                            hex(&utxo_tx.id)
                        ));
                    }
                }
            }
            let utxo_id_hex = hex(&utxo_tx.id);
            if !seen_tx_ids.insert(utxo_id_hex) {
                return Err(format!(
                    "peer block contains duplicate UTXO transaction id {}",
                    hex(&utxo_tx.id)
                ));
            }
            for input in &utxo_tx.inputs {
                if !seen_utxo_inputs.insert((input.prev_tx_hash, input.output_index)) {
                    return Err(format!(
                        "peer block contains double-spend of UTXO input {}:{}",
                        hex(&input.prev_tx_hash),
                        input.output_index,
                    ));
                }
            }
        }

        // ── UTXO input existence + value conservation (F1) ─────────────────
        //
        // These checks must apply both to peer-imported blocks and to locally
        // mined candidates accepted via SubmitCandidate, otherwise a miner
        // could accidentally (or maliciously) mint value by submitting a block
        // whose UTXO tx outputs+fee exceed its referenced inputs.
        let utxos = self.utxo_set();
        let coinbase_outpoints: HashSet<(String, u32)> = self
            .accepted_blocks
            .iter()
            .flat_map(|b| {
                b.utxo_transactions
                    .iter()
                    .filter(|tx| tx.is_coinbase())
                    .map(move |tx| (b.height, tx))
            })
            .flat_map(|(height, tx)| {
                let id_hex = hex(&tx.id);
                tx.outputs
                    .iter()
                    .enumerate()
                    .map(move |(idx, _)| (id_hex.clone(), idx as u32, height))
            })
            .map(|(id_hex, idx, _height)| (id_hex, idx))
            .collect();

        let utxo_lookup = |tx_hash: &[u8; 32], output_index: u32| -> Option<validation::UtxoInfo> {
            let key = (hex(tx_hash), output_index);
            utxos.get(&key).map(|u| validation::UtxoInfo {
                amount: u.amount,
                address: u.address.clone(),
                created_height: u.height,
                is_coinbase: coinbase_outpoints.contains(&key),
            })
        };
        let is_bridge_unlock =
            |tx: &tx::Transaction| bridge_unlock_replay_key_from_transaction(tx).is_some();

        validation::validate_inputs_exist(
            &block.utxo_transactions,
            &utxo_lookup,
            &is_bridge_unlock,
        )
        .map_err(|err| format!("peer block UTXO input existence failed: {err}"))?;
        validation::validate_value_conservation(
            &block.utxo_transactions,
            &utxo_lookup,
            &is_bridge_unlock,
        )
        .map_err(|err| format!("peer block UTXO value conservation failed: {err}"))?;
        Ok(())
    }

    pub(crate) fn insert_transaction(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        transaction: Transaction,
    ) -> Result<(), String> {
        transaction.validate()?;
        if !transaction.verify_signature() {
            return Err("account transaction signature verification failed".to_string());
        }
        if self.mempool.len() >= MAX_MEMPOOL_TRANSACTIONS {
            return Err(format!(
                "mempool capacity reached: {MAX_MEMPOOL_TRANSACTIONS}"
            ));
        }
        if self.mempool_by_id.contains_key(&transaction.tx_id) {
            return Err(format!("duplicate transaction id: {}", transaction.tx_id));
        }
        if self.accepted_blocks.iter().any(|block| {
            block
                .transaction_ids
                .iter()
                .any(|tx_id| tx_id == &transaction.tx_id)
        }) {
            return Err(format!("transaction {} already mined", transaction.tx_id));
        }
        if self
            .mempool
            .iter()
            .filter_map(RuntimeTransaction::as_account)
            .any(|known| known.from == transaction.from && known.nonce == transaction.nonce)
        {
            return Err(format!(
                "transaction nonce {} for sender {} is already pending",
                transaction.nonce, transaction.from
            ));
        }
        if self.accepted_blocks.iter().any(|block| {
            block
                .transactions
                .iter()
                .any(|known| known.from == transaction.from && known.nonce == transaction.nonce)
        }) {
            return Err(format!(
                "transaction nonce {} for sender {} is already mined",
                transaction.nonce, transaction.from
            ));
        }
        // F4.7: Max-tx-amount sanity cap. No single non-genesis, non-coinbase
        // TX may move more than the entire money supply (`emission::TOTAL_SUPPLY`).
        // Defense-in-depth on top of F5: bounds damage from any inflation bug.
        // Height-gated; genesis/coinbase are guarded explicitly.
        if self.max_tx_amount_active_at(self.height)
            && transaction.from != "genesis"
            && transaction.from != "coinbase"
            && transaction.amount_zion > emission::TOTAL_SUPPLY
        {
            return Err(format!(
                "transaction from {} exceeds max allowed amount: {} > TOTAL_SUPPLY {}",
                transaction.from,
                transaction.amount_zion,
                emission::TOTAL_SUPPLY
            ));
        }
        // F5: Reject transactions where the sender does not have sufficient
        // confirmed account-model balance to cover amount + fee. Without this
        // check, any Ed25519 key holder can create ZION from nothing by
        // submitting a TX from an empty address. Height-gated so historical
        // blocks (pre-fix) are not rejected on IBD.
        // Coinbase and genesis TXs are exempt — they create new coins.
        if self.balance_check_active_at(self.height)
            && transaction.from != "coinbase"
            && transaction.from != "genesis"
        {
            let sender_balance = self.account_balance_for(&transaction.from);
            let needed = transaction.amount_zion + transaction.fee_zion as u128;
            if sender_balance < needed {
                return Err(format!(
                    "insufficient balance: sender {} has {} flowers but needs {} (amount {} + fee {})",
                    transaction.from, sender_balance, needed,
                    transaction.amount_zion, transaction.fee_zion
                ));
            }
        }

        self.mempool
            .push(RuntimeTransaction::from(transaction.clone()));
        self.mempool_by_id.insert(
            transaction.tx_id.clone(),
            RuntimeTransaction::from(transaction.clone()),
        );
        let miner_addr = self.miner_address.clone();
        let humanitarian_addr = self.humanitarian_address.clone();
        let issobella_addr = self.issobella_address.clone();
        let pool_fee_addr = self.pool_fee_address.clone();
        self.active_template = Self::build_template(
            node_id,
            core,
            self.height,
            self.tip_hash,
            self.active_template.template_id,
            &self.mempool,
            &self.accepted_blocks,
            &miner_addr,
            &humanitarian_addr,
            &issobella_addr,
            &pool_fee_addr,
            self.balance_check_height,
        );
        Ok(())
    }

    pub(crate) fn insert_utxo_transaction(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        transaction: tx::Transaction,
    ) -> Result<(), String> {
        let pending_height = self.height.saturating_add(1);
        if tx_hash_v2_active(pending_height) && transaction.version < tx::TX_HASH_V2_VERSION {
            return Err(format!(
                "UTXO mempool rejects tx.version {} — pending block height {} requires tx.version >= {} (TX_HASH_V2 activation {})",
                transaction.version,
                pending_height,
                tx::TX_HASH_V2_VERSION,
                TX_HASH_V2_ACTIVATION_HEIGHT
            ));
        }
        if transaction.id != transaction.calculate_hash() {
            return Err("UTXO transaction id does not match calculated hash".to_string());
        }
        let bridge_unlock_replay_key =
            match self.validate_bridge_unlock_transaction_shape(&transaction, pending_height)? {
                Some(replay_key) => Some(replay_key),
                None => {
                    if !transaction.verify_signatures() {
                        return Err("UTXO transaction signature verification failed".to_string());
                    }
                    None
                }
            };
        if self.mempool.len() >= MAX_MEMPOOL_TRANSACTIONS {
            return Err(format!(
                "mempool capacity reached: {MAX_MEMPOOL_TRANSACTIONS}"
            ));
        }
        let tx_id = hex(&transaction.id);
        if self.mempool_by_id.contains_key(&tx_id) {
            return Err(format!("duplicate transaction id: {tx_id}"));
        }
        if let Some(replay_key) = &bridge_unlock_replay_key {
            if self.bridge_unlock_replay_keys.contains(replay_key) {
                return Err(format!(
                    "bridge unlock replay key already used: {replay_key}"
                ));
            }
        }
        if self
            .accepted_blocks
            .iter()
            .any(|block| block.utxo_transaction_ids.iter().any(|id| id == &tx_id))
        {
            return Err(format!("UTXO transaction {} already mined", tx_id));
        }
        for input in &transaction.inputs {
            // Verify the referenced UTXO output actually exists on chain and
            // has not already been spent.
            if !self.utxo_exists(&input.prev_tx_hash, input.output_index) {
                return Err(format!(
                    "UTXO input {}:{} does not exist or is already spent",
                    hex(&input.prev_tx_hash),
                    input.output_index,
                ));
            }
            let already_in_mempool = self.mempool.iter().any(|known| {
                known.as_utxo().is_some_and(|utxo| {
                    utxo.inputs.iter().any(|ki| {
                        ki.prev_tx_hash == input.prev_tx_hash
                            && ki.output_index == input.output_index
                    })
                })
            });
            if already_in_mempool {
                return Err(format!(
                    "UTXO input {}:{} is already being spent in mempool",
                    hex(&input.prev_tx_hash),
                    input.output_index,
                ));
            }
        }
        if let Some(replay_key) = bridge_unlock_replay_key {
            self.bridge_unlock_replay_keys.insert(replay_key);
        }
        self.mempool
            .push(RuntimeTransaction::Utxo(transaction.clone()));
        self.mempool_by_id
            .insert(tx_id, RuntimeTransaction::Utxo(transaction));
        let miner_addr = self.miner_address.clone();
        let humanitarian_addr = self.humanitarian_address.clone();
        let issobella_addr = self.issobella_address.clone();
        let pool_fee_addr = self.pool_fee_address.clone();
        self.active_template = Self::build_template(
            node_id,
            core,
            self.height,
            self.tip_hash,
            self.active_template.template_id,
            &self.mempool,
            &self.accepted_blocks,
            &miner_addr,
            &humanitarian_addr,
            &issobella_addr,
            &pool_fee_addr,
            self.balance_check_height,
        );
        Ok(())
    }

    pub(crate) fn rebuild_indexes(&mut self) {
        self.accepted_by_height.clear();
        self.accepted_by_template_id.clear();
        for block in &self.accepted_blocks {
            self.accepted_by_height.insert(block.height, block.clone());
            self.accepted_by_template_id
                .insert(block.template_id, block.clone());
        }
    }

    /// Prune old blocks from in-memory caches if `block_retention > 0`.
    ///
    /// Removes the oldest block from `accepted_blocks`, `accepted_by_height`,
    /// and `accepted_by_template_id`. Adjusts `address_tx_index` by removing
    /// the pruned index and decrementing all higher indices.
    ///
    /// The genesis block (height 0) is NEVER pruned — it's needed for
    /// premine wallet discovery via `getBlockByHeight(0)` RPC.
    ///
    /// Blocks remain in LMDB persistent storage — this only affects in-memory
    /// caches for RPC queries and consensus validation of recent blocks.
    pub(crate) fn prune_old_blocks(&mut self) {
        if self.block_retention == 0 {
            return;
        }
        // Genesis (height 0) is always at index 0 and must never be pruned.
        // We prune blocks starting from index 1 (the oldest non-genesis block).
        while self.accepted_blocks.len() > self.block_retention {
            // Determine which index to prune: skip genesis if it's at index 0
            let genesis_at_start = self.accepted_blocks.first().map(|b| b.height) == Some(0);
            let prune_idx = if genesis_at_start { 1 } else { 0 };
            if prune_idx >= self.accepted_blocks.len() {
                break;
            }
            let removed = self.accepted_blocks.remove(prune_idx);

            // Remove from height and template_id indexes
            self.accepted_by_height.remove(&removed.height);
            self.accepted_by_template_id.remove(&removed.template_id);

            // Adjust address_tx_index: remove the pruned index from all entries,
            // then decrement all indices greater than it.
            let mut empty_keys = Vec::new();
            for (addr, indices) in self.address_tx_index.iter_mut() {
                // Remove the pruned block index if present
                indices.retain(|&idx| idx != prune_idx);
                // Decrement all indices greater than prune_idx by 1
                for idx in indices.iter_mut() {
                    if *idx > prune_idx {
                        *idx -= 1;
                    }
                }
                if indices.is_empty() {
                    empty_keys.push(addr.clone());
                }
            }
            for key in empty_keys {
                self.address_tx_index.remove(&key);
            }
        }
    }

    /// Rebuild the address→block-index map from scratch by scanning all
    /// accepted blocks. Called on startup after loading from disk.
    pub(crate) fn rebuild_address_tx_index(&mut self) {
        self.address_tx_index.clear();
        for idx in 0..self.accepted_blocks.len() {
            self.index_block_addresses(idx);
        }
    }

    /// Index a single block by all addresses involved in its transactions.
    /// For each address that appears as a sender, recipient, or miner in the
    /// block, add this block's index to the address's lookup vector.
    pub(crate) fn index_block_addresses(&mut self, block_idx: usize) {
        let block = match self.accepted_blocks.get(block_idx) {
            Some(b) => b,
            None => return,
        };
        let mut addresses = std::collections::HashSet::new();

        // Account-model transactions (from/to)
        for tx in &block.transactions {
            if !tx.from.is_empty() {
                addresses.insert(tx.from.clone());
            }
            if !tx.to.is_empty() {
                addresses.insert(tx.to.clone());
            }
        }

        // UTXO transactions (inputs/outputs)
        for utxo_tx in &block.utxo_transactions {
            for output in &utxo_tx.outputs {
                if !output.address.is_empty() {
                    addresses.insert(output.address.clone());
                }
            }
            for input in &utxo_tx.inputs {
                let addr = crate::crypto::derive_address(&input.public_key);
                if !addr.is_empty() {
                    addresses.insert(addr);
                }
            }
        }

        // Coinbase addresses (miner, humanitarian, issobella)
        if !block.miner_address.is_empty() {
            addresses.insert(block.miner_address.clone());
        }
        if !block.humanitarian_address.is_empty() {
            addresses.insert(block.humanitarian_address.clone());
        }
        if !block.issobella_address.is_empty() {
            addresses.insert(block.issobella_address.clone());
        }

        for addr in addresses {
            self.address_tx_index
                .entry(addr)
                .or_default()
                .push(block_idx);
        }
    }

    /// Get the indices of blocks that contain transactions for the given address.
    /// Returns `None` if the address has no transactions (not in index).
    pub(crate) fn block_indices_for_address(&self, address: &str) -> Option<&Vec<usize>> {
        self.address_tx_index.get(address)
    }

    pub(crate) fn rebuild_mempool_index(&mut self) {
        self.mempool_by_id.clear();
        for transaction in &self.mempool {
            self.mempool_by_id
                .insert(transaction.tx_id(), transaction.clone());
        }
    }

    /// Find the highest accepted block whose hash matches `hash_hex`.
    /// Returns `None` if no block in the local chain has this hash.
    pub(crate) fn find_ancestor_by_hash(&self, hash_hex: &str) -> Option<&AcceptedBlock> {
        self.accepted_blocks
            .iter()
            .filter(|block| block.hash_hex == hash_hex)
            .max_by_key(|block| block.height)
    }

    /// Roll the chain state back to `fork_height`, discarding all blocks above it
    /// and restoring their transactions to the mempool for reconsideration.
    /// The active template and all indexes are rebuilt.
    pub(crate) fn rollback_to_height(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        fork_height: u64,
    ) -> Result<(), String> {
        if fork_height == self.height {
            // No blocks to remove, but still re-sanitize so callers can rely on
            // a consistent post-rollback state.
            self.sanitize_recovered_state(node_id, core)?;
            return Ok(());
        }
        if fork_height > self.height {
            return Err(format!(
                "rollback target height {} is above current tip {}",
                fork_height, self.height
            ));
        }

        let fork_hash = self
            .accepted_by_height
            .get(&fork_height)
            .ok_or_else(|| format!("fork block at height {} not found", fork_height))?
            .hash_hex
            .clone();
        let fork_hash = parse_fixed_hex::<32>(&fork_hash, "fork block hash")?;

        let cut_idx = self
            .accepted_blocks
            .iter()
            .position(|block| block.height == fork_height)
            .ok_or_else(|| {
                format!(
                    "fork block at height {} not in accepted_blocks",
                    fork_height
                )
            })?;

        let removed: Vec<AcceptedBlock> = self.accepted_blocks.split_off(cut_idx + 1);

        self.height = fork_height;
        self.tip_hash = fork_hash;

        // Return the transactions from the removed blocks to the mempool so they
        // can be reconsidered on the new chain (and dropped if they are no
        // longer valid or were mined in the new chain).
        for block in removed {
            for tx in block.transactions {
                self.mempool.push(RuntimeTransaction::Account(tx));
            }
            for utxo_tx in block.utxo_transactions {
                self.mempool.push(RuntimeTransaction::Utxo(utxo_tx));
            }
        }

        self.rebuild_mempool_index();
        self.rebuild_indexes();
        self.rebuild_address_tx_index();

        // Make sure the next local template id does not collide with any
        // remaining accepted block. `sanitize_recovered_state` builds the active
        // template with `next_template_id - 1`, so leave a one-id gap.
        let max_remaining_template_id = self
            .accepted_blocks
            .iter()
            .map(|block| block.template_id)
            .max()
            .unwrap_or(0);
        self.next_template_id = max_remaining_template_id.wrapping_add(2);

        self.sanitize_recovered_state(node_id, core)?;
        Ok(())
    }

    pub(crate) fn sanitize_recovered_state(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
    ) -> Result<(), String> {
        self.rebuild_indexes();

        let mined_ids: HashSet<&str> = self
            .accepted_blocks
            .iter()
            .flat_map(|block| {
                block
                    .transaction_ids
                    .iter()
                    .chain(block.utxo_transaction_ids.iter())
                    .map(String::as_str)
            })
            .collect();
        let mut sender_nonces = HashSet::new();
        let mut seen = HashSet::new();
        let mut seen_utxo_inputs: HashSet<([u8; 32], u32)> = HashSet::new();
        let mut seen_bridge_unlock_replay_keys = self.accepted_bridge_unlock_replay_keys();
        let utxos = self.utxo_set();
        self.mempool.retain(|transaction| match transaction {
            RuntimeTransaction::Account(tx) => {
                tx.validate().is_ok()
                    && !mined_ids.contains(tx.tx_id.as_str())
                    && seen.insert(tx.tx_id.clone())
                    && sender_nonces.insert((tx.from.clone(), tx.nonce))
                    && !self.accepted_blocks.iter().any(|block| {
                        block
                            .transactions
                            .iter()
                            .any(|known| known.from == tx.from && known.nonce == tx.nonce)
                    })
            }
            RuntimeTransaction::Utxo(utxo) => {
                let id_hex = hex(&utxo.id);
                if utxo.id != utxo.calculate_hash()
                    || mined_ids.contains(id_hex.as_str())
                    || !seen.insert(id_hex)
                    || !utxo.inputs.iter().all(|input| {
                        seen_utxo_inputs.insert((input.prev_tx_hash, input.output_index))
                    })
                {
                    return false;
                }

                let pending_height = self.height.saturating_add(1);
                match validate_bridge_unlock_transaction_shape_with_utxos(
                    utxo,
                    &utxos,
                    pending_height,
                ) {
                    Ok(Some(replay_key)) => seen_bridge_unlock_replay_keys.insert(replay_key),
                    Ok(None) => utxo.verify_signatures(),
                    Err(_) => false,
                }
            }
        });
        self.rebuild_mempool_index();
        self.bridge_unlock_replay_keys = seen_bridge_unlock_replay_keys;

        let mut template_transactions = Vec::new();
        for tx_id in &self.active_template.as_public().transaction_ids {
            let Some(transaction) = self
                .mempool_by_id
                .get(tx_id)
                .cloned()
                .and_then(RuntimeTransaction::into_account)
            else {
                let miner_addr = self.miner_address.clone();
                let humanitarian_addr = self.humanitarian_address.clone();
                let issobella_addr = self.issobella_address.clone();
                let pool_fee_addr = self.pool_fee_address.clone();
                self.active_template = Self::build_template(
                    node_id,
                    core,
                    self.height,
                    self.tip_hash,
                    self.next_template_id.saturating_sub(1),
                    &self.mempool,
                    &self.accepted_blocks,
                    &miner_addr,
                    &humanitarian_addr,
                    &issobella_addr,
                    &pool_fee_addr,
                    self.balance_check_height,
                );
                return Ok(());
            };
            template_transactions.push(RuntimeTransaction::from(transaction));
        }

        self.active_template.transactions = template_transactions;
        self.active_template.total_fees_zion = self
            .active_template
            .transactions
            .iter()
            .filter_map(|transaction| {
                transaction
                    .as_account()
                    .map(|transaction| transaction.fee_zion)
            })
            .sum();

        if self.active_template.height != self.height.saturating_add(1) {
            let miner_addr = self.miner_address.clone();
            let humanitarian_addr = self.humanitarian_address.clone();
            let issobella_addr = self.issobella_address.clone();
            let pool_fee_addr = self.pool_fee_address.clone();
            self.active_template = Self::build_template(
                node_id,
                core,
                self.height,
                self.tip_hash,
                self.next_template_id.saturating_sub(1),
                &self.mempool,
                &self.accepted_blocks,
                &miner_addr,
                &humanitarian_addr,
                &issobella_addr,
                &pool_fee_addr,
                self.balance_check_height,
            );
        }

        Ok(())
    }

    pub(crate) fn snapshot(&self) -> ChainStateSnapshot {
        ChainStateSnapshot {
            height: self.height,
            tip_hash_hex: hex(&self.tip_hash),
            next_template_id: self.next_template_id,
            active_template: self.active_template.as_public(),
            accepted_blocks: self.accepted_blocks.clone(),
            mempool: self.account_mempool_transactions(),
            utxo_mempool: self.utxo_mempool_transactions(),
            bridge_unlock_replay_keys: self.bridge_unlock_replay_keys.iter().cloned().collect(),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn build_template(
        node_id: &str,
        _core: &CoreRuntime,
        current_height: u64,
        previous_hash: [u8; 32],
        template_id: u64,
        mempool: &[RuntimeTransaction],
        accepted_blocks: &[AcceptedBlock],
        miner_address: &str,
        humanitarian_address: &str,
        issobella_address: &str,
        // The pool-fee 1% slot is burned (never minted), so no address is used.
        _pool_fee_address: &str,
        balance_check_height: u64,
    ) -> TemplateState {
        let next_height = current_height.saturating_add(1);
        let mut selected_transactions = select_template_transactions(mempool);
        // Filter out account TXs whose sender has insufficient confirmed
        // balance — prevents mining blocks that would fail F5 validation.
        // Only apply when the F5 balance check is active at this height.
        if next_height >= balance_check_height {
            selected_transactions =
                filter_balance_sufficient(selected_transactions, accepted_blocks);
        }
        let total_fees_zion: u64 = selected_transactions
            .iter()
            .map(|transaction| transaction.fee_zion)
            .sum();

        let selected_utxo_transactions = select_template_utxo_transactions(mempool);

        // Phase 14: Generate coinbase transaction(s) when miner_address is configured.
        if !miner_address.is_empty() {
            let subsidy = emission::block_subsidy(next_height);
            // Fee split is active when the humanitarian + issobella funds are
            // configured. The pool-fee 1% slot is BURNED (never minted), so it
            // requires no address and produces no coinbase output.
            let has_fee_addresses =
                !humanitarian_address.is_empty() && !issobella_address.is_empty();

            if has_fee_addresses {
                // Multi-output coinbase: mint 89/5/5 (miner/humanitarian/issobella).
                // The remaining 1% (pool_fee) is burned — no output is created.
                let (miner_amt, humanitarian_amt, issobella_amt, _burned_pool_fee) =
                    emission::fee_split(subsidy);

                let mk_coinbase = |label_prefix: &str, addr: &str, amount: u64| {
                    let label = format!("{}:{}:{}", label_prefix, next_height, addr);
                    let hash = cosmic_harmony_ekam_deeksha(label.as_bytes(), next_height);
                    Transaction {
                        tx_id: hex(&hash.data),
                        from: "coinbase".to_string(),
                        to: addr.to_string(),
                        amount_zion: u128::from(amount),
                        fee_zion: 0,
                        nonce: next_height,
                        signature: String::new(),
                        public_key: String::new(),
                        memo: None,
                    }
                };

                // Insert in reverse order so positions are: 0=miner, 1=humanitarian, 2=issobella
                selected_transactions.insert(
                    0,
                    mk_coinbase("coinbase_issobella", issobella_address, issobella_amt),
                );
                selected_transactions.insert(
                    0,
                    mk_coinbase(
                        "coinbase_humanitarian",
                        humanitarian_address,
                        humanitarian_amt,
                    ),
                );
                selected_transactions.insert(0, mk_coinbase("coinbase", miner_address, miner_amt));
            } else {
                // Legacy single coinbase: 100% to miner
                let coinbase_label = format!("coinbase:{}:{}", next_height, miner_address);
                let coinbase_hash =
                    cosmic_harmony_ekam_deeksha(coinbase_label.as_bytes(), next_height);
                let coinbase_tx = Transaction {
                    tx_id: hex(&coinbase_hash.data),
                    from: "coinbase".to_string(),
                    to: miner_address.to_string(),
                    amount_zion: u128::from(subsidy),
                    fee_zion: 0,
                    nonce: next_height,
                    signature: String::new(),
                    public_key: String::new(),
                    memo: None,
                };
                selected_transactions.insert(0, coinbase_tx);
            }
        }

        let mut transactions: Vec<RuntimeTransaction> = selected_transactions
            .iter()
            .cloned()
            .map(RuntimeTransaction::from)
            .collect();
        for utxo_tx in &selected_utxo_transactions {
            transactions.push(RuntimeTransaction::from(utxo_tx.clone()));
        }

        let merkle_root = derive_template_merkle_root(
            node_id,
            next_height,
            template_id,
            previous_hash,
            &selected_transactions,
            &selected_utxo_transactions,
        );

        let next_difficulty = if accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let start = accepted_blocks
                .len()
                .saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = accepted_blocks[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        let target = crate::v3_compat::difficulty_to_target(next_difficulty);
        let bits = crate::v3_compat::target_to_compact(&target);

        TemplateState {
            template_id,
            height: next_height,
            header: MiningHeader {
                version: 3,
                previous_hash,
                merkle_root,
                timestamp: now_secs(),
                difficulty_bits: bits,
            },
            target,
            difficulty: next_difficulty,
            reward_zion: emission::block_subsidy(next_height),
            transactions,
            total_fees_zion,
        }
    }
}
impl ChainStore {
    pub(crate) fn load_snapshot(&self) -> Result<Option<ChainStateSnapshot>, String> {
        if !self.path.exists() {
            return Ok(None);
        }

        let raw = fs::read_to_string(&self.path).map_err(|error| {
            format!(
                "failed to read chain state {}: {error}",
                self.path.display()
            )
        })?;
        let snapshot = serde_json::from_str::<ChainStateSnapshot>(&raw).map_err(|error| {
            format!(
                "failed to decode chain state {}: {error}",
                self.path.display()
            )
        })?;
        Ok(Some(snapshot))
    }

    pub(crate) fn journal_exists(&self) -> bool {
        journal_path(&self.path).exists()
    }

    pub(crate) fn load_journal_entries(&self) -> Result<Vec<ChainJournalEntry>, String> {
        let path = journal_path(&self.path);
        if !path.exists() {
            return Ok(Vec::new());
        }

        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read chain journal {}: {error}", path.display()))?;
        let mut entries = Vec::new();
        for (index, line) in raw.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let entry = serde_json::from_str::<ChainJournalEntry>(line).map_err(|error| {
                format!(
                    "failed to decode chain journal {} at line {}: {error}",
                    path.display(),
                    index + 1
                )
            })?;
            entries.push(entry);
        }
        Ok(entries)
    }

    pub(crate) fn append_journal_entry(&self, entry: &ChainJournalEntry) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create chain state dir {}: {error}",
                    parent.display()
                )
            })?;
        }
        let path = journal_path(&self.path);
        let line = encode_json_line(entry).map_err(|error| {
            format!(
                "failed to encode chain journal entry {}: {error}",
                path.display()
            )
        })?;
        use std::io::Write as _;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| format!("failed to open chain journal {}: {error}", path.display()))?;
        file.write_all(line.as_bytes()).map_err(|error| {
            format!("failed to append chain journal {}: {error}", path.display())
        })?;
        file.flush().map_err(|error| {
            format!("failed to flush chain journal {}: {error}", path.display())
        })?;
        Ok(())
    }

    pub(crate) fn clear_journal(&self) -> Result<(), String> {
        let path = journal_path(&self.path);
        if path.exists() {
            fs::remove_file(&path).map_err(|error| {
                format!("failed to remove chain journal {}: {error}", path.display())
            })?;
        }
        Ok(())
    }

    pub(crate) fn replay_journal(
        &self,
        node_id: &str,
        core: &CoreRuntime,
        chain_state: &mut ChainState,
    ) -> Result<(), String> {
        for entry in self.load_journal_entries()? {
            chain_state.apply_journal_entry(node_id, core, entry)?;
        }
        Ok(())
    }

    pub(crate) fn save_snapshot(&self, snapshot: &ChainStateSnapshot) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create chain state dir {}: {error}",
                    parent.display()
                )
            })?;
        }

        let encoded = serde_json::to_string_pretty(snapshot).map_err(|error| {
            format!(
                "failed to encode chain state {}: {error}",
                self.path.display()
            )
        })?;
        let temp_path = snapshot_temp_path(&self.path);
        fs::write(&temp_path, encoded).map_err(|error| {
            format!(
                "failed to write temp chain state {}: {error}",
                temp_path.display()
            )
        })?;
        fs::rename(&temp_path, &self.path).map_err(|error| {
            format!(
                "failed to move chain state {} into place: {error}",
                self.path.display()
            )
        })?;
        Ok(())
    }
}
pub(crate) fn encode_json_line<T: Serialize>(message: &T) -> Result<String, serde_json::Error> {
    let mut line = serde_json::to_string(message)?;
    line.push('\n');
    Ok(line)
}

pub(crate) fn dedup_peers(peers: Vec<PeerEndpoint>) -> Vec<PeerEndpoint> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for peer in peers {
        if seen.insert(peer.address()) {
            deduped.push(peer);
        }
    }
    deduped
}

/// Top-level dispatcher for the block body's Merkle root.
///
/// At/above [`BODY_ROOT_V2_ACTIVATION_HEIGHT`] this commits via a Bitcoin-style
/// BLAKE3 binary Merkle tree (audit §F2 / `AUDIT_COMPLETION.md` §2). Below that
/// height the legacy XOR aggregate is preserved bit-for-bit so historical
/// blocks continue to validate against their stored body roots.
///
/// # Why two paths
/// The XOR aggregate is birthday-resistant only at 2^64 and uses
/// `cosmic_harmony_ekam_deeksha` (256 KiB scratchpad) as a per-tx hash, which
/// is a misuse of a PoW function as a data-structure hash. The v2 path
/// replaces both: leaf hash drops to BLAKE3 via
/// `Transaction::calculate_hash()` (cheap, ASIC-irrelevant), aggregation
/// becomes a proper tree (collision-bounded at 2^256/2 with BLAKE3).
pub(crate) fn derive_template_merkle_root(
    node_id: &str,
    height: u64,
    template_id: u64,
    previous_hash: [u8; 32],
    transactions: &[Transaction],
    utxo_transactions: &[tx::Transaction],
) -> [u8; 32] {
    if body_root_v2_active(height) {
        derive_template_merkle_root_v2_blake3(transactions, utxo_transactions)
    } else {
        derive_template_merkle_root_v1_xor(
            node_id,
            height,
            template_id,
            previous_hash,
            transactions,
            utxo_transactions,
        )
    }
}

/// Legacy XOR aggregate body root (audit §F2 documents this as a misuse —
/// kept for pre-fork blocks so historical hashes don't change).
///
/// **Do not call directly** outside the dispatcher above and the regression
/// tests that pin v1 ↔ v2 distinction.
pub(crate) fn derive_template_merkle_root_v1_xor(
    node_id: &str,
    height: u64,
    template_id: u64,
    previous_hash: [u8; 32],
    transactions: &[Transaction],
    utxo_transactions: &[tx::Transaction],
) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE];
    seed[0..32].copy_from_slice(&previous_hash);
    seed[32..40].copy_from_slice(&height.to_le_bytes());
    seed[40..48].copy_from_slice(&template_id.to_le_bytes());
    let node_bytes = node_id.as_bytes();
    let copy_len = node_bytes.len().min(HEADER_SIZE - 48);
    seed[48..48 + copy_len].copy_from_slice(&node_bytes[..copy_len]);
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            transaction.tx_id.as_bytes(),
            transaction.nonce ^ transaction.fee_zion ^ (transaction.amount_zion as u64),
        )
        .data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;
        }
    }
    for utxo_tx in utxo_transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            &utxo_tx.id,
            utxo_tx.fee ^ utxo_tx.timestamp ^ utxo_tx.total_output(),
        )
        .data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(
        &seed,
        template_id ^ height ^ (transactions.len() + utxo_transactions.len()) as u64,
    )
    .data
}

/// F2 BLAKE3 Merkle body root — the post-fork rule.
///
/// Builds leaves from BLAKE3 over the account-model `tx_id` (which already
/// commits to all consensus-relevant fields) and from `tx::Transaction::id`
/// for UTXO-model txs (which is itself already BLAKE3-derived via
/// [`tx::Transaction::calculate_hash`] — that dispatches to v2 once
/// [`TX_HASH_V2_ACTIVATION_HEIGHT`] is met, so the body root inherits the v2
/// malleability fix automatically). Aggregation uses
/// [`validation::merkle_root`] (Bitcoin-style pair-duplicate-on-odd-count
/// binary tree, BLAKE3 hash pairs).
///
/// Order of leaves: account-model txs first (in `transactions` order), then
/// UTXO txs (in `utxo_transactions` order). This matches the order in which
/// they are serialized into the block body, so peer validators can re-derive
/// the same root deterministically.
pub(crate) fn derive_template_merkle_root_v2_blake3(
    transactions: &[Transaction],
    utxo_transactions: &[tx::Transaction],
) -> [u8; 32] {
    let mut leaves: Vec<[u8; 32]> =
        Vec::with_capacity(transactions.len() + utxo_transactions.len());
    for transaction in transactions {
        leaves.push(crypto::blake3_hash(transaction.tx_id.as_bytes()));
    }
    for utxo_tx in utxo_transactions {
        leaves.push(utxo_tx.id);
    }
    validation::merkle_root(&leaves)
}

pub(crate) fn select_template_transactions(mempool: &[RuntimeTransaction]) -> Vec<Transaction> {
    let mut selected: Vec<Transaction> = mempool
        .iter()
        .filter_map(|transaction| transaction.as_account().cloned())
        .collect();
    selected.sort_by(|left, right| {
        right
            .fee_zion
            .cmp(&left.fee_zion)
            .then(left.nonce.cmp(&right.nonce))
            .then(left.tx_id.cmp(&right.tx_id))
    });
    selected.truncate(MAX_TEMPLATE_TRANSACTIONS);
    selected
}

/// Compute the confirmed balance for an address from accepted blocks only
/// (does NOT subtract pending mempool debits, unlike `account_balance_for`).
/// Used by `filter_balance_sufficient` to pre-validate template transactions.
pub(crate) fn confirmed_balance_from_blocks(accepted_blocks: &[AcceptedBlock], address: &str) -> u128 {
    let mut balance: i128 = 0;
    for block in accepted_blocks {
        for tx in &block.transactions {
            if tx.from == "coinbase" {
                if tx.to == address {
                    balance = balance.saturating_add(tx.amount_zion as i128);
                }
                continue;
            }
            if tx.to == address {
                balance = balance.saturating_add(tx.amount_zion as i128);
            }
            if tx.from == address {
                balance = balance.saturating_sub((tx.amount_zion + tx.fee_zion as u128) as i128);
            }
        }
    }
    balance.max(0) as u128
}

/// Filter out account transactions whose sender has insufficient confirmed
/// balance.  Transactions are already sorted by fee (descending) so the
/// highest-fee TX from a sender is kept first, and subsequent TXs from the
/// same sender are checked against the running balance after earlier
/// debits.  This prevents the template from including TXs that would fail
/// the F5 balance check in `validate_peer_block`, which caused 39% share
/// rejection (miner finds block → node rejects due to insolvent mempool TX).
pub(crate) fn filter_balance_sufficient(
    transactions: Vec<Transaction>,
    accepted_blocks: &[AcceptedBlock],
) -> Vec<Transaction> {
    let mut running_balances: HashMap<String, u128> = HashMap::new();
    transactions
        .into_iter()
        .filter(|tx| {
            if tx.from == "coinbase" || tx.from == "genesis" {
                return true;
            }
            let balance = running_balances
                .entry(tx.from.clone())
                .or_insert_with(|| confirmed_balance_from_blocks(accepted_blocks, &tx.from));
            let needed = tx.amount_zion + tx.fee_zion as u128;
            if *balance < needed {
                return false;
            }
            *balance -= needed;
            true
        })
        .collect()
}

pub(crate) fn select_template_utxo_transactions(mempool: &[RuntimeTransaction]) -> Vec<tx::Transaction> {
    let mut selected: Vec<tx::Transaction> = mempool
        .iter()
        .filter_map(|transaction| transaction.as_utxo().cloned())
        .collect();
    selected.sort_by_key(|right| std::cmp::Reverse(right.fee));
    selected.truncate(MAX_TEMPLATE_UTXO_TRANSACTIONS);
    selected
}

pub(crate) fn body_hash_hex(transactions: &[Transaction]) -> String {
    let hash = derive_block_body_hash(transactions);
    hex(&hash)
}

pub(crate) fn derive_block_body_hash(transactions: &[Transaction]) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE];
    seed[0..8].copy_from_slice(&(transactions.len() as u64).to_le_bytes());
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            transaction.tx_id.as_bytes(),
            transaction.nonce ^ (transaction.amount_zion as u64) ^ transaction.fee_zion,
        )
        .data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
}

pub(crate) fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub(crate) fn snapshot_temp_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("chain-state.json");
    path.with_file_name(format!("{file_name}.tmp"))
}

pub(crate) fn journal_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("chain-state.json");
    path.with_file_name(format!("{file_name}.journal"))
}

pub(crate) fn is_valid_account_id(value: &str) -> bool {
    let len = value.len();
    (3..=64).contains(&len)
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

#[allow(dead_code)]
pub(crate) fn looks_like_utxo_address(value: &str) -> bool {
    value.starts_with("zion1")
}

pub(crate) fn parse_fixed_hex<const N: usize>(raw: &str, label: &str) -> Result<[u8; N], String> {
    let normalized = raw.trim().trim_start_matches("0x");
    if normalized.len() != N * 2 {
        return Err(format!("{label} must be exactly {} hex chars", N * 2));
    }

    let mut bytes = [0u8; N];
    for (index, chunk) in normalized.as_bytes().chunks(2).enumerate() {
        let pair =
            std::str::from_utf8(chunk).map_err(|_| format!("{label} contains non-utf8 hex"))?;
        bytes[index] = u8::from_str_radix(pair, 16)
            .map_err(|_| format!("invalid hex byte '{pair}' in {label}"))?;
    }
    Ok(bytes)
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

// ── Genesis block construction ──────────────────────────────────────────

/// Build the canonical genesis `AcceptedBlock` using V31 premine data.
///
/// This replaces V3's `genesis::genesis_block()` which returned an `AcceptedBlock`
/// directly. In V31, `v3_compat::genesis_block()` returns a `V3Block`, so we
/// rebuild the `AcceptedBlock` here using the same premine outputs.
pub(crate) fn genesis_accepted_block() -> AcceptedBlock {
    use crate::v3_compat::{PREMINE_OUTPUTS, GENESIS_TIMESTAMP, GENESIS_MESSAGE};

    let mut transactions: Vec<Transaction> = Vec::new();
    let mut utxo_transactions: Vec<tx::Transaction> = Vec::new();

    for (i, output) in PREMINE_OUTPUTS.iter().enumerate() {
        if output.category == "bridge_vault_utxo" {
            const VAULT_AMOUNT_PER_OUTPUT: u64 = 16_666_666_666_666_666_666;
            const VAULT_AMOUNT_LAST: u64 = 16_666_666_666_666_666_670;
            let mut utxo = tx::Transaction {
                id: [0u8; 32],
                version: tx::TX_HASH_V2_VERSION,
                inputs: vec![],
                outputs: vec![],
                fee: 0,
                timestamp: GENESIS_TIMESTAMP,
            };
            for _ in 0..5 {
                utxo.outputs.push(tx::TxOutput {
                    amount: VAULT_AMOUNT_PER_OUTPUT,
                    address: output.address.to_string(),
                    memo: None,
                });
            }
            utxo.outputs.push(tx::TxOutput {
                amount: VAULT_AMOUNT_LAST,
                address: output.address.to_string(),
                memo: None,
            });
            utxo.finalize_id();
            utxo_transactions.push(utxo);
        } else {
            let tag = if i == 0 {
                format!(
                    "genesis-premine-{i:02}:{}:{}",
                    output.address, GENESIS_MESSAGE
                )
            } else {
                format!("genesis-premine-{i:02}:{}", output.address)
            };
            let tx_id = {
                let hash = cosmic_harmony_ekam_deeksha(tag.as_bytes(), i as u64);
                hex(&hash.data)
            };
            transactions.push(Transaction {
                tx_id,
                from: "genesis".to_string(),
                to: output.address.to_string(),
                amount_zion: output.amount_flowers,
                fee_zion: 0,
                nonce: i as u64,
                signature: String::new(),
                public_key: String::new(),
                memo: None,
            });
        }
    }

    let transaction_ids: Vec<String> = transactions.iter().map(|tx| tx.tx_id.clone()).collect();
    let utxo_transaction_ids: Vec<String> = utxo_transactions
        .iter()
        .map(|tx| hex(&tx.id))
        .collect();

    let genesis_target = crate::v3_compat::difficulty_to_target(difficulty::GENESIS_DIFFICULTY);
    let genesis_bits = crate::v3_compat::target_to_compact(&genesis_target);

    // Use BLAKE3 merkle root (V2 body root, always active for genesis)
    let mut leaves: Vec<[u8; 32]> = Vec::with_capacity(transactions.len() + utxo_transactions.len());
    for transaction in &transactions {
        leaves.push(crypto::blake3_hash(transaction.tx_id.as_bytes()));
    }
    for utxo_tx in &utxo_transactions {
        leaves.push(utxo_tx.id);
    }
    let merkle_root = validation::merkle_root(&leaves);

    let header = MiningHeader {
        version: 3,
        previous_hash: [0u8; 32],
        merkle_root,
        timestamp: GENESIS_TIMESTAMP,
        difficulty_bits: genesis_bits,
    };

    let hash = cosmic_harmony_with_height(&header.to_bytes(), 0, 0);
    let hash_hex = hex(&hash.data);
    let header_hex = hex(&header.to_bytes());

    // Body hash (XOR-fold of tx hashes)
    let body_hash = {
        let mut seed = [0u8; 32];
        for tx in &transactions {
            let tx_hash = cosmic_harmony_ekam_deeksha(tx.tx_id.as_bytes(), tx.nonce);
            for (slot, value) in seed.iter_mut().zip(tx_hash.data.iter()) {
                *slot ^= *value;
            }
        }
        cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
    };

    AcceptedBlock {
        template_id: 0,
        height: 0,
        timestamp: GENESIS_TIMESTAMP,
        difficulty: difficulty::GENESIS_DIFFICULTY,
        nonce: 0,
        hash_hex,
        header_hex,
        previous_hash_hex: hex(&[0u8; 32]),
        algorithm: "deeksha_lite_v1".to_string(),
        transaction_ids,
        transactions,
        total_fees_zion: 0,
        body_hash_hex: hex(&body_hash),
        subsidy_zion: 0,
        miner_reward_zion: 0,
        miner_address: String::new(),
        humanitarian_address: String::new(),
        issobella_address: String::new(),
        pool_fee_address: String::new(),
        utxo_transaction_ids,
        utxo_transactions,
    }
}

/// Parse a DifficultyTarget from hex string (V31's v3_compat doesn't have from_hex).
fn difficulty_target_from_hex(raw: &str) -> Result<DifficultyTarget, String> {
    Ok(DifficultyTarget {
        bytes: parse_fixed_hex::<32>(raw, "difficulty target")?,
    })
}
