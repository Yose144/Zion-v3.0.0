use std::sync::Arc;

use chrono::Utc;
use tokio::sync::Mutex;
use zion_l1_types::{ChainFamily, ChainId};

use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::multichain_wallet::types::{AddressPurpose, WalletAccount, WalletAddress};
use crate::wallet::Keyring;

/// Custodial multichain wallet for a single ZIS user.
///
/// Addresses are derived deterministically from the L2 wallet seed and a
/// per-user `account_index`. Each chain gets a dedicated deposit address at
/// derivation index `0`.
#[derive(Clone)]
pub struct MultichainWallet {
    db: Arc<Mutex<Db>>,
    keyring: Keyring,
}

impl MultichainWallet {
    pub fn new(db: Arc<Mutex<Db>>, keyring: Keyring) -> Self {
        Self { db, keyring }
    }

    /// Return the wallet account for `user_id`, creating it on first use.
    pub async fn account_for_user(&self, user_id: &str) -> MultichainResult<WalletAccount> {
        let mut db = self.db.lock().await;
        db.get_or_create_wallet_account(user_id)
    }

    /// Derive a deposit address for `user_id` on `chain`.
    pub async fn derive_deposit_address(
        &self,
        user_id: &str,
        chain: ChainId,
    ) -> MultichainResult<WalletAddress> {
        let mut db = self.db.lock().await;

        // See if we already derived a deposit address for this chain.
        if let Some(addr) = db.load_wallet_address(user_id, chain, None, AddressPurpose::Deposit)? {
            return Ok(addr);
        }

        let account = db.get_or_create_wallet_account(user_id)?;
        let index = 0u32;

        let address = self
            .keyring
            .address(chain, account.account_index, index)
            .map_err(|e| MultichainError::Internal(format!("derive address: {e}")))?;

        let public_key = match chain.family() {
            ChainFamily::Zion => self
                .keyring
                .zion_public_key(account.account_index, index)
                .ok(),
            _ => None,
        };

        let chain_id = match chain.family() {
            ChainFamily::Evm => Some(chain.as_str().to_string()),
            _ => None,
        };

        let derivation_path = derivation_path(chain, account.account_index, index)?;

        let wallet_address = WalletAddress {
            address,
            user_id: user_id.to_string(),
            chain,
            chain_id,
            purpose: AddressPurpose::Deposit,
            public_key,
            derivation_path,
            is_external: false,
            created_at: Utc::now(),
        };

        db.save_wallet_address(&wallet_address)?;
        Ok(wallet_address)
    }

    /// Return all wallet addresses for a user.
    pub async fn addresses_for_user(&self, user_id: &str) -> MultichainResult<Vec<WalletAddress>> {
        let db = self.db.lock().await;
        db.load_wallet_addresses_for_user(user_id)
    }
}

fn derivation_path(chain: ChainId, account: u32, index: u32) -> MultichainResult<String> {
    match chain.family() {
        ChainFamily::Evm => Ok(format!("m/44'/60'/{account}'/0/{index}")),
        ChainFamily::Zion => Ok(format!("m/44'/9999'/{account}'/0/{index}")),
        ChainFamily::Utxo => {
            // bitcoin crate uses coin_type 0 for mainnet, 1 for testnet.
            // For the canonical Bitcoin chain we default to mainnet (0).
            let coin_type = 0;
            Ok(format!("m/84'/{coin_type}'/{account}'/0/{index}"))
        }
        ChainFamily::Solana => Ok(format!("m/44'/501'/{account}'/{index}")),
        ChainFamily::Cosmos => Ok(format!("m/44'/118'/{account}'/0/{index}")),
        ChainFamily::Near => Ok(format!("m/44'/397'/{account}'/{index}")),
        ChainFamily::Ton => Ok(format!("m/44'/607'/{account}'/{index}")),
        ChainFamily::Tron => Ok(format!("m/44'/195'/{account}'/{index}")),
        ChainFamily::Stellar => Ok(format!("m/44'/148'/{account}'/{index}")),
        ChainFamily::Cardano => Ok(format!("m/1852'/1815'/{account}'/0/{index}")),
        ChainFamily::Lightning => Ok(format!("m/84'/0'/{account}'/0/{index}")),
        ChainFamily::Move => Err(MultichainError::Unsupported(format!(
            "derivation path for {} (Move family)",
            chain.as_str()
        ))),
    }
}
