// SPDX-License-Identifier: MIT
//! # ZION CW20 Token — CosmWasm Contract
//!
//! Wrapped ZION token on Cosmos chains as a CW20 fungible token with 6 decimals.
//! Mint/burn authority = WARP bridge multisig (5/5 validator quorum).
//!
//! This contract implements the CW20 standard with bridge-specific
//! mint/burn functionality and event emission for the WARP relay.
//!
//! ## Deployment
//! See README.md in this folder for full deployment instructions.

use cosmwasm_std::{
    attr, coins, Addr, BankMsg, Coin, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult, Storage, Uint128, Uint64,
};
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// CW20 decimals — matches ZION L1 (1 ZION = 1,000,000 atomic units).
pub const DECIMALS: u8 = 6;

/// Maximum supply: 144,000,000,000 ZION (144B) in atomic units.
pub const MAX_SUPPLY: Uint128 = Uint128::new(144_000_000_000_000_000);

/// Minimum bridge amount to prevent dust attacks (100 ZION).
pub const MIN_BRIDGE_AMOUNT: Uint128 = Uint128::new(100_000_000);

/// Number of validators required for quorum (5/5).
pub const VALIDATOR_QUORUM: u32 = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Contract state
// ─────────────────────────────────────────────────────────────────────────────

/// Token metadata (CW20 standard).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TokenInfo {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: Uint128,
}

/// Bridge configuration.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BridgeConfig {
    /// WARP validator addresses (5 validators, 5/5 quorum).
    pub validators: Vec<Addr>,
    /// Total ZION ever minted through the bridge (audit trail).
    pub total_bridge_minted: Uint128,
    /// Total ZION ever burned through the bridge (audit trail).
    pub total_bridge_burned: Uint128,
    /// Whether the bridge is paused (emergency).
    pub paused: bool,
    /// Bridge admin (multisig contract address that manages validators).
    pub admin: Addr,
}

/// Processed L1 lock TX hashes (replay protection).
/// Key = hex-encoded L1 tx hash.
pub const PROCESSED_L1_LOCKS: Map<&str, bool> = Map::new("processed_l1_locks");

/// Processed burn request IDs (replay protection).
/// Key = hex-encoded burn ID.
pub const PROCESSED_BURNS: Map<&str, bool> = Map::new("processed_burns");

/// CW20 token info.
pub const TOKEN_INFO: Item<TokenInfo> = Item::new("token_info");

/// Bridge config.
pub const BRIDGE_CONFIG: Item<BridgeConfig> = Item::new("bridge_config");

/// Balances: address → amount.
pub const BALANCES: Map<&Addr, Uint128> = Map::new("balances");

/// Allowances: owner → spender → amount.
pub const ALLOWANCES: Map<(&Addr, &Addr), Uint128> = Map::new("allowances");

// ─────────────────────────────────────────────────────────────────────────────
// Instantiate message
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub admin: String,
    pub validators: Vec<String>,
    /// Initial supply to mint to the admin (optional).
    pub initial_supply: Option<Uint128>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute messages
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    /// Transfer tokens to a recipient.
    Transfer { recipient: String, amount: Uint128 },
    /// Approve a spender.
    Approve { spender: String, amount: Uint128 },
    /// Transfer from an approved account.
    TransferFrom {
        owner: String,
        recipient: String,
        amount: Uint128,
    },
    /// Burn tokens from the caller's balance.
    Burn { amount: Uint128 },
    /// Bridge mint — mint ZION after L1 lock confirmation (validator only).
    BridgeMint {
        recipient: String,
        amount: Uint128,
        l1_tx_hash: String,
    },
    /// Bridge burn — burn ZION to unlock on L1 (any holder).
    BridgeBurn {
        amount: Uint128,
        l1_recipient: String,
        burn_id: String,
    },
    /// Emergency pause (validator only).
    Pause {},
    /// Unpause (validator only).
    Unpause {},
}

// ─────────────────────────────────────────────────────────────────────────────
// Query messages
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// Get token info (name, symbol, decimals, total_supply).
    TokenInfo {},
    /// Get balance of an address.
    Balance { address: String },
    /// Get allowance.
    Allowance { owner: String, spender: String },
    /// Get bridge stats.
    BridgeStats {},
    /// Check if L1 lock is processed.
    IsL1LockProcessed { l1_tx_hash: String },
    /// Check if burn is processed.
    IsBurnProcessed { burn_id: String },
}

// ─────────────────────────────────────────────────────────────────────────────
// Query responses
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TokenInfoResponse {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: Uint128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BalanceResponse {
    pub balance: Uint128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct AllowanceResponse {
    pub allowance: Uint128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BridgeStatsResponse {
    pub total_bridge_minted: Uint128,
    pub total_bridge_burned: Uint128,
    pub outstanding: Uint128,
    pub total_supply: Uint128,
    pub max_supply: Uint128,
    pub paused: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ProcessedResponse {
    pub processed: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, thiserror::Error)]
pub enum ContractError {
    #[error("Amount is zero")]
    ZeroAmount {},
    #[error("Amount is below minimum bridge amount (100 ZION)")]
    BelowMinBridgeAmount {},
    #[error("Mint would exceed maximum supply (144B ZION)")]
    ExceedsMaxSupply {},
    #[error("L1 lock transaction already processed")]
    L1LockAlreadyProcessed {},
    #[error("Burn request already processed")]
    BurnRequestAlreadyProcessed {},
    #[error("Bridge is paused")]
    BridgePaused {},
    #[error("Caller is not a registered WARP validator")]
    NotValidator {},
    #[error("Invalid L1 address — must start with 'zion1'")]
    InvalidL1Address {},
    #[error("Insufficient balance")]
    InsufficientBalance {},
    #[error("Insufficient allowance")]
    InsufficientAllowance {},
    #[error("Unauthorized")]
    Unauthorized {},
}

impl From<ContractError> for StdError {
    fn from(e: ContractError) -> Self {
        StdError::generic_err(e.to_string())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Instantiate
// ─────────────────────────────────────────────────────────────────────────────

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Validate admin
    let admin = deps.api.addr_validate(&msg.admin)?;

    // Validate validators
    let mut validators = Vec::new();
    for v in &msg.validators {
        validators.push(deps.api.addr_validate(v)?);
    }
    if validators.len() != VALIDATOR_QUORUM as usize {
        return Err(StdError::generic_err("Must provide exactly 5 validators"));
    }

    // Store token info
    let total_supply = msg.initial_supply.unwrap_or(Uint128::zero());
    if total_supply > MAX_SUPPLY {
        return Err(StdError::generic_err("Initial supply exceeds max supply"));
    }

    let token_info = TokenInfo {
        name: msg.name,
        symbol: msg.symbol,
        decimals: msg.decimals,
        total_supply,
    };
    TOKEN_INFO.save(deps.storage, &token_info)?;

    // Store bridge config
    let bridge_config = BridgeConfig {
        validators,
        total_bridge_minted: Uint128::zero(),
        total_bridge_burned: Uint128::zero(),
        paused: false,
        admin: admin.clone(),
    };
    BRIDGE_CONFIG.save(deps.storage, &bridge_config)?;

    // Mint initial supply to admin if provided
    if total_supply > Uint128::zero() {
        BALANCES.save(deps.storage, &admin, &total_supply)?;
    }

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("name", token_info.name)
        .add_attribute("symbol", token_info.symbol)
        .add_attribute("decimals", token_info.decimals.to_string())
        .add_attribute("total_supply", total_supply.to_string()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute
// ─────────────────────────────────────────────────────────────────────────────

pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { recipient, amount } => {
            execute_transfer(deps, info, recipient, amount)
        }
        ExecuteMsg::Approve { spender, amount } => {
            execute_approve(deps, info, spender, amount)
        }
        ExecuteMsg::TransferFrom {
            owner,
            recipient,
            amount,
        } => execute_transfer_from(deps, info, owner, recipient, amount),
        ExecuteMsg::Burn { amount } => execute_burn(deps, info, amount),
        ExecuteMsg::BridgeMint {
            recipient,
            amount,
            l1_tx_hash,
        } => execute_bridge_mint(deps, info, recipient, amount, l1_tx_hash),
        ExecuteMsg::BridgeBurn {
            amount,
            l1_recipient,
            burn_id,
        } => execute_bridge_burn(deps, info, amount, l1_recipient, burn_id),
        ExecuteMsg::Pause {} => execute_pause(deps, info),
        ExecuteMsg::Unpause {} => execute_unpause(deps, info),
    }
}

fn execute_transfer(
    deps: DepsMut,
    info: MessageInfo,
    recipient: String,
    amount: Uint128,
) -> Result<Response, ContractError> {
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }

    let recipient_addr = deps.api.addr_validate(&recipient)?;
    let sender_balance = BALANCES
        .may_load(deps.storage, &info.sender)?
        .unwrap_or(Uint128::zero());

    if sender_balance < amount {
        return Err(ContractError::InsufficientBalance {});
    }

    BALANCES.save(
        deps.storage,
        &info.sender,
        &(sender_balance - amount),
    )?;
    let recipient_balance = BALANCES
        .may_load(deps.storage, &recipient_addr)?
        .unwrap_or(Uint128::zero());
    BALANCES.save(
        deps.storage,
        &recipient_addr,
        &(recipient_balance + amount),
    )?;

    Ok(Response::new()
        .add_attribute("method", "transfer")
        .add_attribute("from", info.sender)
        .add_attribute("to", recipient_addr)
        .add_attribute("amount", amount))
}

fn execute_approve(
    deps: DepsMut,
    info: MessageInfo,
    spender: String,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let spender_addr = deps.api.addr_validate(&spender)?;
    ALLOWANCES.save(deps.storage, (&info.sender, &spender_addr), &amount)?;

    Ok(Response::new()
        .add_attribute("method", "approve")
        .add_attribute("owner", info.sender)
        .add_attribute("spender", spender_addr)
        .add_attribute("amount", amount))
}

fn execute_transfer_from(
    deps: DepsMut,
    info: MessageInfo,
    owner: String,
    recipient: String,
    amount: Uint128,
) -> Result<Response, ContractError> {
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }

    let owner_addr = deps.api.addr_validate(&owner)?;
    let recipient_addr = deps.api.addr_validate(&recipient)?;

    let allowance = ALLOWANCES
        .may_load(deps.storage, (&owner_addr, &info.sender))?
        .unwrap_or(Uint128::zero());
    if allowance < amount {
        return Err(ContractError::InsufficientAllowance {});
    }

    let owner_balance = BALANCES
        .may_load(deps.storage, &owner_addr)?
        .unwrap_or(Uint128::zero());
    if owner_balance < amount {
        return Err(ContractError::InsufficientBalance {});
    }

    // Update balances
    BALANCES.save(deps.storage, &owner_addr, &(owner_balance - amount))?;
    let recipient_balance = BALANCES
        .may_load(deps.storage, &recipient_addr)?
        .unwrap_or(Uint128::zero());
    BALANCES.save(
        deps.storage,
        &recipient_addr,
        &(recipient_balance + amount),
    )?;

    // Update allowance
    ALLOWANCES.save(
        deps.storage,
        (&owner_addr, &info.sender),
        &(allowance - amount),
    )?;

    Ok(Response::new()
        .add_attribute("method", "transfer_from")
        .add_attribute("owner", owner_addr)
        .add_attribute("spender", info.sender)
        .add_attribute("to", recipient_addr)
        .add_attribute("amount", amount))
}

fn execute_burn(
    deps: DepsMut,
    info: MessageInfo,
    amount: Uint128,
) -> Result<Response, ContractError> {
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }

    let sender_balance = BALANCES
        .may_load(deps.storage, &info.sender)?
        .unwrap_or(Uint128::zero());
    if sender_balance < amount {
        return Err(ContractError::InsufficientBalance {});
    }

    BALANCES.save(deps.storage, &info.sender, &(sender_balance - amount))?;

    let mut token_info = TOKEN_INFO.load(deps.storage)?;
    token_info.total_supply -= amount;
    TOKEN_INFO.save(deps.storage, &token_info)?;

    Ok(Response::new()
        .add_attribute("method", "burn")
        .add_attribute("from", info.sender)
        .add_attribute("amount", amount))
}

fn execute_bridge_mint(
    deps: DepsMut,
    info: MessageInfo,
    recipient: String,
    amount: Uint128,
    l1_tx_hash: String,
) -> Result<Response, ContractError> {
    let mut config = BRIDGE_CONFIG.load(deps.storage)?;

    // Access control — signer must be a registered validator
    if !config.validators.contains(&info.sender) {
        return Err(ContractError::NotValidator {});
    }
    if config.paused {
        return Err(ContractError::BridgePaused {});
    }
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }
    if amount < MIN_BRIDGE_AMOUNT {
        return Err(ContractError::BelowMinBridgeAmount {});
    }

    // Replay protection
    if PROCESSED_L1_LOCKS.may_load(deps.storage, &l1_tx_hash)?.unwrap_or(false) {
        return Err(ContractError::L1LockAlreadyProcessed {});
    }

    // Max supply check
    let mut token_info = TOKEN_INFO.load(deps.storage)?;
    if token_info.total_supply + amount > MAX_SUPPLY {
        return Err(ContractError::ExceedsMaxSupply {});
    }

    // Mint
    let recipient_addr = deps.api.addr_validate(&recipient)?;
    let balance = BALANCES
        .may_load(deps.storage, &recipient_addr)?
        .unwrap_or(Uint128::zero());
    BALANCES.save(deps.storage, &recipient_addr, &(balance + amount))?;

    token_info.total_supply += amount;
    TOKEN_INFO.save(deps.storage, &token_info)?;

    config.total_bridge_minted += amount;
    BRIDGE_CONFIG.save(deps.storage, &config)?;

    PROCESSED_L1_LOCKS.save(deps.storage, &l1_tx_hash, &true)?;

    Ok(Response::new()
        .add_attribute("method", "bridge_mint")
        .add_attribute("recipient", recipient_addr)
        .add_attribute("amount", amount)
        .add_attribute("l1_tx_hash", l1_tx_hash))
}

fn execute_bridge_burn(
    deps: DepsMut,
    info: MessageInfo,
    amount: Uint128,
    l1_recipient: String,
    burn_id: String,
) -> Result<Response, ContractError> {
    let mut config = BRIDGE_CONFIG.load(deps.storage)?;

    if config.paused {
        return Err(ContractError::BridgePaused {});
    }
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }
    if amount < MIN_BRIDGE_AMOUNT {
        return Err(ContractError::BelowMinBridgeAmount {});
    }

    // Validate L1 address
    if !l1_recipient.starts_with("zion1") {
        return Err(ContractError::InvalidL1Address {});
    }

    // Replay protection
    if PROCESSED_BURNS.may_load(deps.storage, &burn_id)?.unwrap_or(false) {
        return Err(ContractError::BurnRequestAlreadyProcessed {});
    }

    // Burn from sender
    let sender_balance = BALANCES
        .may_load(deps.storage, &info.sender)?
        .unwrap_or(Uint128::zero());
    if sender_balance < amount {
        return Err(ContractError::InsufficientBalance {});
    }

    BALANCES.save(deps.storage, &info.sender, &(sender_balance - amount))?;

    let mut token_info = TOKEN_INFO.load(deps.storage)?;
    token_info.total_supply -= amount;
    TOKEN_INFO.save(deps.storage, &token_info)?;

    config.total_bridge_burned += amount;
    BRIDGE_CONFIG.save(deps.storage, &config)?;

    PROCESSED_BURNS.save(deps.storage, &burn_id, &true)?;

    Ok(Response::new()
        .add_attribute("method", "bridge_burn")
        .add_attribute("sender", info.sender)
        .add_attribute("amount", amount)
        .add_attribute("l1_recipient", l1_recipient)
        .add_attribute("burn_id", burn_id))
}

fn execute_pause(deps: DepsMut, info: MessageInfo) -> Result<Response, ContractError> {
    let mut config = BRIDGE_CONFIG.load(deps.storage)?;
    if !config.validators.contains(&info.sender) {
        return Err(ContractError::NotValidator {});
    }
    config.paused = true;
    BRIDGE_CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "pause")
        .add_attribute("by", info.sender))
}

fn execute_unpause(deps: DepsMut, info: MessageInfo) -> Result<Response, ContractError> {
    let mut config = BRIDGE_CONFIG.load(deps.storage)?;
    if !config.validators.contains(&info.sender) {
        return Err(ContractError::NotValidator {});
    }
    config.paused = false;
    BRIDGE_CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "unpause")
        .add_attribute("by", info.sender))
}

// ─────────────────────────────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────────────────────────────

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Response> {
    match msg {
        QueryMsg::TokenInfo {} => {
            let info = TOKEN_INFO.load(deps.storage)?;
            let res = TokenInfoResponse {
                name: info.name,
                symbol: info.symbol,
                decimals: info.decimals,
                total_supply: info.total_supply,
            };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
        QueryMsg::Balance { address } => {
            let addr = deps.api.addr_validate(&address)?;
            let balance = BALANCES
                .may_load(deps.storage, &addr)?
                .unwrap_or(Uint128::zero());
            let res = BalanceResponse { balance };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
        QueryMsg::Allowance { owner, spender } => {
            let owner_addr = deps.api.addr_validate(&owner)?;
            let spender_addr = deps.api.addr_validate(&spender)?;
            let allowance = ALLOWANCES
                .may_load(deps.storage, (&owner_addr, &spender_addr))?
                .unwrap_or(Uint128::zero());
            let res = AllowanceResponse { allowance };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
        QueryMsg::BridgeStats {} => {
            let config = BRIDGE_CONFIG.load(deps.storage)?;
            let info = TOKEN_INFO.load(deps.storage)?;
            let res = BridgeStatsResponse {
                total_bridge_minted: config.total_bridge_minted,
                total_bridge_burned: config.total_bridge_burned,
                outstanding: config.total_bridge_minted - config.total_bridge_burned,
                total_supply: info.total_supply,
                max_supply: MAX_SUPPLY,
                paused: config.paused,
            };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
        QueryMsg::IsL1LockProcessed { l1_tx_hash } => {
            let processed = PROCESSED_L1_LOCKS
                .may_load(deps.storage, &l1_tx_hash)?
                .unwrap_or(false);
            let res = ProcessedResponse { processed };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
        QueryMsg::IsBurnProcessed { burn_id } => {
            let processed = PROCESSED_BURNS
                .may_load(deps.storage, &burn_id)?
                .unwrap_or(false);
            let res = ProcessedResponse { processed };
            Ok(Response::new().set_data(to_binary(&res)?))
        }
    }
}

// Helper: serialize to binary
fn to_binary<T: Serialize>(data: &T) -> StdResult<Vec<u8>> {
    cosmwasm_std::to_vec(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry points (WASM export)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_arch = "wasm32")]
mod entry {
    use super::*;

    #[no_mangle]
    pub extern "C" fn instantiate(ptr: u32, len: u32) -> u32 {
        do_instantiate(ptr, len)
    }

    #[no_mangle]
    pub extern "C" fn execute(ptr: u32, len: u32) -> u32 {
        do_execute(ptr, len)
    }

    #[no_mangle]
    pub extern "C" fn query(ptr: u32, len: u32) -> u32 {
        do_query(ptr, len)
    }
}
