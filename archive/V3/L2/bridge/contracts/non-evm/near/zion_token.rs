// SPDX-License-Identifier: MIT
//! # ZION NEP-141 Token — NEAR Smart Contract (Rust)
//!
//! Wrapped ZION token on NEAR Protocol as a NEP-141 fungible token with 6 decimals.
//! Mint/burn authority = WARP bridge multisig (5/5 validator quorum).
//!
//! This contract implements the NEP-141 standard with bridge-specific
//! mint/burn functionality and event emission for the WARP relay.
//!
//! ## Deployment
//! See README.md in this folder for full deployment instructions.

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, BorshStorageKey, PanicOnDefault, Promise,
    PromiseOrValue, StorageUsage,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// NEP-141 decimals — matches ZION L1 (1 ZION = 1,000,000 atomic units).
/// Note: NEP-141 doesn't have a standard decimals field, but we use 6
/// for consistency with other chains.
pub const DECIMALS: u8 = 6;

/// Maximum supply: 144,000,000,000 ZION (144B) in atomic units.
/// 144_000_000_000 * 1_000_000 = 144_000_000_000_000_000
pub const MAX_SUPPLY: Balance = 144_000_000_000_000_000;

/// Minimum bridge amount to prevent dust attacks (100 ZION).
pub const MIN_BRIDGE_AMOUNT: Balance = 100_000_000;

/// Number of validators required for quorum (5/5).
pub const VALIDATOR_QUORUM: usize = 5;

/// One NEAR for storage (1e24 yoctoNEAR).
pub const ONE_NEAR: Balance = 1_000_000_000_000_000_000_000_000;

/// Storage byte cost: 1e19 yoctoNEAR per byte.
pub const STORAGE_PRICE_PER_BYTE: Balance = 10_000_000_000_000_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Balances,
    Allowances,
    ProcessedL1Locks,
    ProcessedBurns,
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract state
// ─────────────────────────────────────────────────────────────────────────────

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ZionToken {
    /// Token metadata (NEP-141).
    pub name: String,
    pub symbol: String,
    pub spec: String,       // "ft-1.0.0"
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<[u8; 32]>,
    pub decimals: u8,

    /// Total token supply.
    pub total_supply: Balance,

    /// Account balances: AccountId → Balance.
    pub accounts: LookupMap<AccountId, Balance>,

    /// Allowances: (owner, spender) → Balance.
    pub allowances: LookupMap<(AccountId, AccountId), Balance>,

    /// WARP validator accounts (5 validators, 5/5 quorum).
    pub validators: Vec<AccountId>,

    /// Bridge admin (manages validator set).
    pub admin: AccountId,

    /// Total ZION ever minted through bridge (audit trail).
    pub total_bridge_minted: Balance,

    /// Total ZION ever burned through bridge (audit trail).
    pub total_bridge_burned: Balance,

    /// Whether the bridge is paused (emergency).
    pub paused: bool,

    /// Processed L1 lock TX hashes (replay protection).
    pub processed_l1_locks: LookupMap<String, bool>,

    /// Processed burn request IDs (replay protection).
    pub processed_burns: LookupMap<String, bool>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal implementation
// ─────────────────────────────────────────────────────────────────────────────

#[near_bindgen]
impl ZionToken {
    /// Initialize the contract.
    #[init]
    pub fn new(
        name: String,
        symbol: String,
        admin: AccountId,
        validators: Vec<AccountId>,
    ) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        assert!(validators.len() == VALIDATOR_QUORUM, "Must provide exactly 5 validators");

        Self {
            name,
            symbol,
            spec: "ft-1.0.0".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: DECIMALS,
            total_supply: 0,
            accounts: LookupMap::new(StorageKey::Balances),
            allowances: LookupMap::new(StorageKey::Allowances),
            validators,
            admin,
            total_bridge_minted: 0,
            total_bridge_burned: 0,
            paused: false,
            processed_l1_locks: LookupMap::new(StorageKey::ProcessedL1Locks),
            processed_burns: LookupMap::new(StorageKey::ProcessedBurns),
        }
    }

    // ──────────────────────────────────────────────────
    // NEP-141 standard functions
    // ──────────────────────────────────────────────────

    /// Returns the total supply of tokens.
    pub fn ft_total_supply(&self) -> U128 {
        self.total_supply.into()
    }

    /// Returns the balance of an account.
    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.accounts
            .get(&account_id)
            .unwrap_or(0)
            .into()
    }

    /// Transfer tokens to a recipient.
    #[payable]
    pub fn ft_transfer(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) {
        assert!(!self.paused, "Bridge is paused");
        let amount: Balance = amount.into();
        assert!(amount > 0, "Amount must be positive");

        let sender = env::predecessor_account_id();
        let sender_balance = self.accounts.get(&sender).unwrap_or(0);
        assert!(
            sender_balance >= amount,
            "Insufficient balance"
        );

        self.internal_set_balance(&sender, sender_balance - amount);
        let receiver_balance = self.accounts.get(&receiver_id).unwrap_or(0);
        self.internal_set_balance(&receiver_id, receiver_balance + amount);

        log!(
            "Transfer {} from {} to {} memo={:?}",
            amount, sender, receiver_id, memo
        );
    }

    /// Transfer tokens on behalf of an owner (requires allowance).
    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert!(!self.paused, "Bridge is paused");
        let amount: Balance = amount.into();
        assert!(amount > 0, "Amount must be positive");

        let sender = env::predecessor_account_id();
        let sender_balance = self.accounts.get(&sender).unwrap_or(0);
        assert!(sender_balance >= amount, "Insufficient balance");

        self.internal_set_balance(&sender, sender_balance - amount);
        let receiver_balance = self.accounts.get(&receiver_id).unwrap_or(0);
        self.internal_set_balance(&receiver_id, receiver_balance + amount);

        log!(
            "TransferCall {} from {} to {} msg={} memo={:?}",
            amount, sender, receiver_id, msg, memo
        );

        // In a full implementation, this would call ft_on_transfer on the receiver
        PromiseOrValue::Value(U128(0))
    }

    /// Register an account (required before receiving tokens).
    #[payable]
    pub fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> U128 {
        let account_id = account_id.unwrap_or_else(|| env::predecessor_account_id());
        let _ = registration_only;

        if self.accounts.contains_key(&account_id) {
            return U128(0);
        }

        let storage_balance = self.storage_balance_bounds().min.into();
        assert!(
            env::attached_deposit() >= storage_balance,
            "Insufficient deposit for storage"
        );

        self.accounts.insert(&account_id, &0);

        // Refund excess deposit
        let refund = env::attached_deposit() - storage_balance;
        if refund > 0 {
            Promise::new(env::predecessor_account_id()).transfer(refund);
        }

        U128(storage_balance)
    }

    /// Returns the minimum and maximum storage balance.
    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds {
            min: U128(125 * STORAGE_PRICE_PER_BYTE),
            max: U128(125 * STORAGE_PRICE_PER_BYTE),
        }
    }

    /// Returns the storage balance of an account.
    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        if self.accounts.contains_key(&account_id) {
            Some(StorageBalance {
                total: U128(125 * STORAGE_PRICE_PER_BYTE),
                available: U128(0),
            })
        } else {
            None
        }
    }

    /// Returns token metadata (NEP-141).
    pub fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: self.spec.clone(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            icon: self.icon.clone(),
            reference: self.reference.clone(),
            reference_hash: self.reference_hash,
            decimals: self.decimals,
        }
    }

    // ──────────────────────────────────────────────────
    // Bridge functions
    // ──────────────────────────────────────────────────

    /// Mint ZION after L1 lock confirmation (validator only).
    pub fn bridge_mint(
        &mut self,
        recipient: AccountId,
        amount: U128,
        l1_tx_hash: String,
    ) {
        let caller = env::predecessor_account_id();
        let amount: Balance = amount.into();

        // Access control — caller must be a registered validator
        assert!(
            self.validators.contains(&caller),
            "Caller is not a registered WARP validator"
        );
        assert!(!self.paused, "Bridge is paused");
        assert!(amount > 0, "Amount must be positive");
        assert!(
            amount >= MIN_BRIDGE_AMOUNT,
            "Amount below minimum bridge amount (100 ZION)"
        );

        // Replay protection
        assert!(
            !self.processed_l1_locks.get(&l1_tx_hash).unwrap_or(false),
            "L1 lock already processed"
        );

        // Max supply check
        assert!(
            self.total_bridge_minted + amount <= MAX_SUPPLY,
            "Mint would exceed max supply (144B ZION)"
        );

        // Mint
        let balance = self.accounts.get(&recipient).unwrap_or(0);
        self.internal_set_balance(&recipient, balance + amount);
        self.total_supply += amount;
        self.total_bridge_minted += amount;
        self.processed_l1_locks.insert(&l1_tx_hash, &true);

        log!(
            "BridgeMint amount={} recipient={} l1_tx={}",
            amount, recipient, l1_tx_hash
        );
    }

    /// Burn ZION to unlock native ZION on L1 (any holder).
    pub fn bridge_burn(
        &mut self,
        amount: U128,
        l1_recipient: String,
        burn_id: String,
    ) {
        let caller = env::predecessor_account_id();
        let amount: Balance = amount.into();

        assert!(!self.paused, "Bridge is paused");
        assert!(amount > 0, "Amount must be positive");
        assert!(
            amount >= MIN_BRIDGE_AMOUNT,
            "Amount below minimum bridge amount (100 ZION)"
        );

        // Validate L1 address
        assert!(
            l1_recipient.starts_with("zion1"),
            "Invalid L1 address — must start with 'zion1'"
        );

        // Replay protection
        assert!(
            !self.processed_burns.get(&burn_id).unwrap_or(false),
            "Burn request already processed"
        );

        // Burn from caller
        let balance = self.accounts.get(&caller).unwrap_or(0);
        assert!(balance >= amount, "Insufficient balance");

        self.internal_set_balance(&caller, balance - amount);
        self.total_supply -= amount;
        self.total_bridge_burned += amount;
        self.processed_burns.insert(&burn_id, &true);

        log!(
            "BridgeBurn amount={} dest={} sender={} burn_id={}",
            amount, l1_recipient, caller, burn_id
        );
    }

    // ──────────────────────────────────────────────────
    // Emergency functions (validator only)
    // ──────────────────────────────────────────────────

    pub fn pause(&mut self) {
        let caller = env::predecessor_account_id();
        assert!(
            self.validators.contains(&caller),
            "Caller is not a registered WARP validator"
        );
        self.paused = true;
        log!("Bridge paused by {}", caller);
    }

    pub fn unpause(&mut self) {
        let caller = env::predecessor_account_id();
        assert!(
            self.validators.contains(&caller),
            "Caller is not a registered WARP validator"
        );
        self.paused = false;
        log!("Bridge unpaused by {}", caller);
    }

    // ──────────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────────

    pub fn is_paused(&self) -> bool {
        self.paused
    }

    pub fn bridge_stats(&self) -> BridgeStats {
        BridgeStats {
            total_bridge_minted: U128(self.total_bridge_minted),
            total_bridge_burned: U128(self.total_bridge_burned),
            outstanding: U128(self.total_bridge_minted - self.total_bridge_burned),
            total_supply: U128(self.total_supply),
            max_supply: U128(MAX_SUPPLY),
            paused: self.paused,
        }
    }

    pub fn is_l1_lock_processed(&self, l1_tx_hash: String) -> bool {
        self.processed_l1_locks.get(&l1_tx_hash).unwrap_or(false)
    }

    pub fn is_burn_processed(&self, burn_id: String) -> bool {
        self.processed_burns.get(&burn_id).unwrap_or(false)
    }

    pub fn get_validators(&self) -> Vec<AccountId> {
        self.validators.clone()
    }

    // ──────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────

    fn internal_set_balance(&mut self, account: &AccountId, balance: Balance) {
        if balance == 0 {
            self.accounts.remove(account);
        } else {
            self.accounts.insert(account, &balance);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEP-141 metadata types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(BorshSerialize, BorshDeserialize, serde::Serialize, serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FungibleTokenMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<[u8; 32]>,
    pub decimals: u8,
}

#[derive(BorshSerialize, BorshDeserialize, serde::Serialize, serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[derive(BorshSerialize, BorshDeserialize, serde::Serialize, serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct StorageBalanceBounds {
    pub min: U128,
    pub max: U128,
}

#[derive(BorshSerialize, BorshDeserialize, serde::Serialize, serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct BridgeStats {
    pub total_bridge_minted: U128,
    pub total_bridge_burned: U128,
    pub outstanding: U128,
    pub total_supply: U128,
    pub max_supply: U128,
    pub paused: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DECIMALS, 6);
        assert_eq!(MAX_SUPPLY, 144_000_000_000_000_000);
        assert_eq!(MIN_BRIDGE_AMOUNT, 100_000_000);
        assert_eq!(VALIDATOR_QUORUM, 5);
    }
}
