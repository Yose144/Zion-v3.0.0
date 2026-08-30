//! EVM adapter — uses `ethers` HTTP provider and optional `LocalWallet`.
//!
//! Mainnet Alpha capabilities:
//! - read chain height, native balance, tx confirmations,
//! - watch `BridgeBurn` events on wZION,
//! - send native payments when a wallet is configured,
//! - call `ZIONBridge.submitLockProof` when the configured wallet is a validator.

use async_trait::async_trait;
use ethers::core::abi::{decode, encode, ParamType, Token};
use ethers::core::types::{Filter, TransactionRequest, ValueOrArray};
use ethers::core::utils::keccak256;
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer as _Signer};
use ethers::types::{Address as EthAddress, H256, U256, U64};
use std::collections::HashMap;
use std::str::FromStr;

use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::contracts::ZionContracts;
use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection};

const BRIDGE_BURN_SIG: &str = "BridgeBurn(address,uint256,string,bytes32,uint256)";
const BRIDGE_MINT_SIG: &str = "BridgeMint(address,uint256,bytes32,uint256)";
const SUBMIT_LOCK_PROOF_SIG: &str = "submitLockProof(bytes32,address,uint256,uint256,string)";
const CONFIRM_BURN_RELEASE_SIG: &str = "confirmBurnRelease(bytes32,address,uint256,string)";
const HAS_ROLE_SIG: &str = "hasRole(bytes32,address)";
const ERC20_BALANCE_OF_SIG: &str = "balanceOf(address)";
const ERC20_TRANSFER_SIG: &str = "transfer(address,uint256)";
const ERC20_TRANSFER_EVENT_SIG: &str = "Transfer(address,address,uint256)";
const HTLC_LOCK_SIG: &str = "lock(bytes32,bytes32,uint256,address,uint256,address,string,string)";
const HTLC_CLAIM_SIG: &str = "claim(bytes32,bytes32)";
const HTLC_REFUND_SIG: &str = "refund(bytes32)";

/// EVM adapter configured for a specific RPC, optional signer and contracts.
pub struct EvmAdapter {
    name: String,
    chain: ChainId,
    provider: Provider<Http>,
    wallet: Option<LocalWallet>,
    contracts: Option<ZionContracts>,
    token_registry: HashMap<EthAddress, Asset>,
}

fn build_token_registry(
    chain: ChainId,
    contracts: Option<&ZionContracts>,
) -> HashMap<EthAddress, Asset> {
    let mut registry = HashMap::new();
    let Some(contracts) = contracts else {
        return registry;
    };

    if let Ok(addr) = EthAddress::from_str(&contracts.wzion) {
        registry.insert(
            addr,
            Asset::with_contract(
                chain,
                "wZION",
                contracts.wzion.clone(),
                18,
                "Wrapped ZION",
            ),
        );
    }

    for (ticker, info) in &contracts.tokens {
        if let Ok(addr) = EthAddress::from_str(&info.contract) {
            registry.insert(
                addr,
                Asset::with_contract(
                    chain,
                    ticker.clone(),
                    info.contract.clone(),
                    info.decimals,
                    ticker.clone(),
                ),
            );
        }
    }

    registry
}

impl EvmAdapter {
    pub fn new(
        name: impl Into<String>,
        chain: ChainId,
        rpc_url: &str,
        wallet: Option<LocalWallet>,
        contracts: Option<ZionContracts>,
    ) -> MultichainResult<Self> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| MultichainError::Config(format!("invalid EVM RPC {rpc_url}: {e}")))?;

        let token_registry = build_token_registry(chain, contracts.as_ref());

        Ok(Self {
            name: name.into(),
            chain,
            provider,
            wallet,
            contracts,
            token_registry,
        })
    }

    fn to_eth_address(&self, addr: &Address) -> MultichainResult<EthAddress> {
        if addr.chain != self.chain {
            return Err(MultichainError::Validation(format!(
                "expected {} EVM address, got {}",
                self.name,
                addr.chain.as_str()
            )));
        }
        EthAddress::from_str(&addr.encoded)
            .map_err(|e| MultichainError::Validation(format!("invalid EVM address: {e}")))
    }

    fn wzion_address(&self) -> Option<EthAddress> {
        self.contracts.as_ref()?.wzion.parse().ok()
    }

    fn bridge_address(&self) -> Option<EthAddress> {
        self.contracts.as_ref()?.bridge.parse().ok()
    }

    fn wzion_asset(&self) -> Option<Asset> {
        let contract = self.contracts.as_ref()?.wzion.clone();
        Some(Asset::with_contract(self.chain, "wZION", contract, 18, "Wrapped ZION"))
    }

    fn atomic_swap_address(&self) -> Option<EthAddress> {
        self.contracts.as_ref()?.atomic_swap.parse().ok()
    }

    fn topic0(signature: &str) -> H256 {
        H256::from(keccak256(signature.as_bytes()))
    }

    fn function_selector(sig: &str) -> [u8; 4] {
        let hash = keccak256(sig.as_bytes());
        [hash[0], hash[1], hash[2], hash[3]]
    }

    fn make_filter(address: EthAddress, from_block: u64, to_block: u64, topic0: H256) -> Filter {
        Filter::new()
            .address(address)
            .from_block(U64::from(from_block))
            .to_block(U64::from(to_block))
            .topic0(topic0)
    }

    async fn is_validator(
        &self,
        bridge: EthAddress,
        account: EthAddress,
    ) -> MultichainResult<bool> {
        let role = H256::from(keccak256("VALIDATOR_ROLE".as_bytes()));
        let mut call = Self::function_selector(HAS_ROLE_SIG).to_vec();
        let args = encode(&[
            Token::FixedBytes(role.as_bytes().to_vec()),
            Token::Address(account),
        ]);
        call.extend_from_slice(&args);

        let tx = TransactionRequest::new().to(bridge).data(call);
        let bytes = self
            .provider
            .call(&tx.into(), None)
            .await
            .map_err(|e| MultichainError::Internal(format!("hasRole call failed: {e}")))?;

        let tokens = decode(&[ParamType::Bool], &bytes)
            .map_err(|e| MultichainError::Internal(format!("decode hasRole: {e}")))?;
        Ok(tokens[0].clone().into_bool().unwrap_or(false))
    }

    fn evm_chain_id(&self) -> u64 {
        match self.chain {
            ChainId::Ethereum => 1,
            ChainId::Base => 8453,
            ChainId::Arbitrum => 42161,
            ChainId::Optimism => 10,
            ChainId::Bsc => 56,
            ChainId::Polygon => 137,
            ChainId::Avalanche => 43_114,
            ChainId::Zksync => 324,
            ChainId::Linea => 59_144,
            _ => 1,
        }
    }

    async fn send_transaction(
        &self,
        to: EthAddress,
        data: Vec<u8>,
        value: U256,
    ) -> MultichainResult<Hash> {
        let wallet = self
            .wallet
            .as_ref()
            .ok_or_else(|| MultichainError::Unsupported("EVM wallet not configured".to_string()))?
            .clone()
            .with_chain_id(self.evm_chain_id());
        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = TransactionRequest::new()
            .to(to)
            .data(data)
            .value(value)
            .chain_id(self.evm_chain_id())
            .gas(300_000);

        let pending = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| MultichainError::Internal(format!("send_transaction failed: {e}")))?;
        let receipt = pending
            .await
            .map_err(|e| {
                MultichainError::Internal(format!("transaction confirmation failed: {e}"))
            })?
            .ok_or_else(|| MultichainError::Internal("transaction receipt missing".to_string()))?;

        if receipt.status.map_or(false, |s| s.as_u64() != 1) {
            return Err(MultichainError::Internal(format!(
                "transaction {} reverted on-chain",
                receipt.transaction_hash
            )));
        }

        let hash = receipt.transaction_hash;
        Ok(Hash::new(*hash.as_fixed_bytes()))
    }

    fn address_from_topic(topic: H256) -> EthAddress {
        let bytes = topic.as_bytes();
        EthAddress::from_slice(&bytes[12..])
    }

    fn decode_burn_log(&self, log: &ethers::types::Log) -> Option<DepositEvent> {
        let from = Self::address_from_topic(log.topics.get(1).copied()?);
        let _burn_id = log.topics.get(2).copied()?;
        let tokens = decode(
            &[
                ParamType::Uint(256),
                ParamType::String,
                ParamType::Uint(256),
            ],
            log.data.as_ref(),
        )
        .ok()?;
        let amount = tokens[0].clone().into_uint()?;
        let l1_recipient = tokens[1].clone().into_string()?;

        let from_addr = Address::new(
            self.chain,
            from.as_bytes().to_vec(),
            format!("0x{}", hex::encode(from.as_bytes())),
        )
        .ok()?;

        let asset = self.wzion_asset()?;

        Some(DepositEvent {
            chain: self.chain,
            tx_hash: log
                .transaction_hash
                .map(|h| Hash::new(*h.as_fixed_bytes()))
                .unwrap_or_default(),
            recipient: from_addr,
            amount: Amount::new(amount.as_u128()),
            memo: Some(format!("BRIDGE:zion-l1:{}", l1_recipient)),
            confirmations: 1,
            asset: Some(asset),
        })
    }

    fn decode_mint_log(&self, log: &ethers::types::Log) -> Option<DepositEvent> {
        let recipient = Self::address_from_topic(log.topics.get(1).copied()?);
        let _l1_tx_hash = log.topics.get(2).copied()?;
        let tokens = decode(
            &[ParamType::Uint(256), ParamType::Uint(256)],
            log.data.as_ref(),
        )
        .ok()?;
        let amount = tokens[0].clone().into_uint()?;

        let recipient_addr = Address::new(
            self.chain,
            recipient.as_bytes().to_vec(),
            format!("0x{}", hex::encode(recipient.as_bytes())),
        )
        .ok()?;

        let asset = self.wzion_asset()?;

        Some(DepositEvent {
            chain: self.chain,
            tx_hash: log
                .transaction_hash
                .map(|h| Hash::new(*h.as_fixed_bytes()))
                .unwrap_or_default(),
            recipient: recipient_addr,
            amount: Amount::new(amount.as_u128()),
            memo: None,
            confirmations: 1,
            asset: Some(asset),
        })
    }

    fn decode_erc20_transfer_log(
        &self,
        log: &ethers::types::Log,
        asset: &Asset,
        tip: u64,
    ) -> Option<DepositEvent> {
        if log.topics.len() != 3 {
            return None;
        }
        let _from = Self::address_from_topic(log.topics.get(1).copied()?);
        let to = Self::address_from_topic(log.topics.get(2).copied()?);

        let tokens = decode(&[ParamType::Uint(256)], log.data.as_ref()).ok()?;
        let amount = tokens[0].clone().into_uint()?;

        let recipient_addr = Address::new(
            self.chain,
            to.as_bytes().to_vec(),
            format!("0x{}", hex::encode(to.as_bytes())),
        )
        .ok()?;

        let confirmations = log
            .block_number
            .map_or(1, |bn| tip.saturating_sub(bn.as_u64()) + 1);

        Some(DepositEvent {
            chain: self.chain,
            tx_hash: log
                .transaction_hash
                .map(|h| Hash::new(*h.as_fixed_bytes()))
                .unwrap_or_default(),
            recipient: recipient_addr,
            amount: Amount::new(amount.as_u128()),
            memo: None,
            confirmations,
            asset: Some(asset.clone()),
        })
    }
}

impl EvmAdapter {
    async fn submit_lock_proof(
        &self,
        transfer: &Transfer,
        bridge: EthAddress,
    ) -> MultichainResult<Hash> {
        let l1_tx_hash = Self::parse_tx_hash(&transfer.id);
        let recipient = self.to_eth_address(&transfer.target.address)?;
        // Zion L1 flowers (6 decimals) -> wZION wei (18 decimals).
        let amount_flowers = transfer.target.amount.0;
        let amount_wei = if transfer.source.address.chain == ChainId::ZionL1 {
            amount_flowers.saturating_mul(1_000_000_000_000u128)
        } else {
            amount_flowers
        };
        let amount = U256::from(amount_wei);
        let l1_block_height = U256::from(0u64);
        let l1_sender = transfer.source.address.encoded.clone();

        let mut data = Self::function_selector(SUBMIT_LOCK_PROOF_SIG).to_vec();
        let args = encode(&[
            Token::FixedBytes(l1_tx_hash.as_bytes().to_vec()),
            Token::Address(recipient),
            Token::Uint(amount),
            Token::Uint(l1_block_height),
            Token::String(l1_sender),
        ]);
        data.extend_from_slice(&args);

        self.send_transaction(bridge, data, U256::zero()).await
    }

    async fn confirm_burn_release(
        &self,
        transfer: &Transfer,
        bridge: EthAddress,
    ) -> MultichainResult<Hash> {
        let burn_id = Self::parse_tx_hash(&transfer.id);
        let evm_burner = self.to_eth_address(&transfer.source.address)?;
        // wZION amount is already in 18-decimal wei on the EVM side.
        let amount = U256::from(transfer.source.amount.0);
        let l1_recipient = transfer.target.address.encoded.clone();

        let mut data = Self::function_selector(CONFIRM_BURN_RELEASE_SIG).to_vec();
        let args = encode(&[
            Token::FixedBytes(burn_id.as_bytes().to_vec()),
            Token::Address(evm_burner),
            Token::Uint(amount),
            Token::String(l1_recipient),
        ]);
        data.extend_from_slice(&args);

        self.send_transaction(bridge, data, U256::zero()).await
    }

    fn parse_htlc_hash(transfer: &Transfer) -> MultichainResult<H256> {
        let id = transfer.id.as_str();
        let hash_hex = id
            .rsplit_once('-')
            .map(|(_, h)| h)
            .filter(|h| h.len() == 64)
            .ok_or_else(|| MultichainError::Validation(format!("invalid HTLC transfer id: {id}")))?;
        let bytes = hex::decode(hash_hex)
            .map_err(|_| MultichainError::Validation(format!("invalid HTLC hash hex: {hash_hex}")))?;
        if bytes.len() != 32 {
            return Err(MultichainError::Validation("HTLC hash must be 32 bytes".to_string()));
        }
        Ok(H256::from_slice(&bytes))
    }

    fn htlc_token_address(&self, asset: &crate::types::TransferEndpoint) -> MultichainResult<EthAddress> {
        match asset.asset.id.ticker.as_str() {
            "ETH" => Ok(EthAddress::zero()),
            "wZION" => self
                .wzion_address()
                .ok_or_else(|| MultichainError::Config("wZION contract not configured".to_string())),
            _ => Err(MultichainError::Unsupported(format!(
                "HTLC token {} not supported",
                asset.asset.id.ticker
            ))),
        }
    }

    fn scale_to_18_decimals(amount: u128, from_decimals: u8) -> u128 {
        if from_decimals >= 18 {
            amount
        } else {
            amount.saturating_mul(10u128.pow(u32::from(18 - from_decimals)))
        }
    }

    async fn htlc_lock(
        &self,
        transfer: &Transfer,
        swap: EthAddress,
    ) -> MultichainResult<Hash> {
        let id = Self::parse_htlc_hash(transfer)?;
        let hashlock = transfer
            .hashlock
            .ok_or_else(|| MultichainError::Validation("HTLC lock missing hashlock".to_string()))?;
        let timelock = transfer
            .timelock
            .ok_or_else(|| MultichainError::Validation("HTLC lock missing timelock".to_string()))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if timelock <= now {
            return Err(MultichainError::Validation(format!(
                "HTLC timelock must be in the future (now={now}, timelock={timelock})"
            )));
        }
        let duration = timelock - now;

        let token = self.htlc_token_address(&transfer.source)?;
        let amount = U256::from(Self::scale_to_18_decimals(
            transfer.source.amount.0,
            transfer.source.asset.decimals,
        ));
        let recipient = self.to_eth_address(&transfer.target.address)?;

        let counterparty_chain = transfer.source.address.chain.as_str().to_string();
        let counterparty_addr = transfer.source.address.encoded.clone();

        let mut data = Self::function_selector(HTLC_LOCK_SIG).to_vec();
        let args = encode(&[
            Token::FixedBytes(id.as_bytes().to_vec()),
            Token::FixedBytes(hashlock.0.to_vec()),
            Token::Uint(U256::from(duration)),
            Token::Address(token),
            Token::Uint(amount),
            Token::Address(recipient),
            Token::String(counterparty_chain),
            Token::String(counterparty_addr),
        ]);
        data.extend_from_slice(&args);

        let value = if token == EthAddress::zero() { amount } else { U256::zero() };
        self.send_transaction(swap, data, value).await
    }

    async fn htlc_claim(
        &self,
        transfer: &Transfer,
        swap: EthAddress,
    ) -> MultichainResult<Hash> {
        let id = Self::parse_htlc_hash(transfer)?;
        let preimage = transfer
            .preimage
            .ok_or_else(|| MultichainError::Validation("HTLC claim missing preimage".to_string()))?;

        let mut data = Self::function_selector(HTLC_CLAIM_SIG).to_vec();
        let args = encode(&[
            Token::FixedBytes(id.as_bytes().to_vec()),
            Token::FixedBytes(preimage.0.to_vec()),
        ]);
        data.extend_from_slice(&args);

        self.send_transaction(swap, data, U256::zero()).await
    }

    async fn htlc_refund(
        &self,
        transfer: &Transfer,
        swap: EthAddress,
    ) -> MultichainResult<Hash> {
        let id = Self::parse_htlc_hash(transfer)?;

        let mut data = Self::function_selector(HTLC_REFUND_SIG).to_vec();
        let args = encode(&[Token::FixedBytes(id.as_bytes().to_vec())]);
        data.extend_from_slice(&args);

        self.send_transaction(swap, data, U256::zero()).await
    }

    fn parse_tx_hash(id: &str) -> H256 {
        match hex::decode(id) {
            Ok(v) if v.len() == 32 => H256::from_slice(&v),
            _ => H256::from(keccak256(id.as_bytes())),
        }
    }

    pub async fn wzion_balance(&self, owner: &Address) -> MultichainResult<Amount> {
        let wzion = self
            .wzion_address()
            .ok_or_else(|| MultichainError::Config("wZION contract not configured".to_string()))?;
        let owner_eth = self.to_eth_address(owner)?;

        let mut call = Self::function_selector(ERC20_BALANCE_OF_SIG).to_vec();
        let args = encode(&[Token::Address(owner_eth)]);
        call.extend_from_slice(&args);

        let tx = TransactionRequest::new().to(wzion).data(call);
        let bytes = self
            .provider
            .call(&tx.into(), None)
            .await
            .map_err(|e| MultichainError::Internal(format!("wZION balanceOf failed: {e}")))?;
        let tokens = decode(&[ParamType::Uint(256)], &bytes)
            .map_err(|e| MultichainError::Internal(format!("decode wZION balance: {e}")))?;
        let raw = tokens[0].clone().into_uint().unwrap_or_default();
        Ok(Amount::new(raw.as_u128()))
    }

    pub async fn transfer_wzion(&self, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        let wzion = self
            .wzion_address()
            .ok_or_else(|| MultichainError::Config("wZION contract not configured".to_string()))?;
        let to_eth = self.to_eth_address(to)?;

        let mut data = Self::function_selector(ERC20_TRANSFER_SIG).to_vec();
        let args = encode(&[Token::Address(to_eth), Token::Uint(U256::from(amount.0))]);
        data.extend_from_slice(&args);

        self.send_transaction(wzion, data, U256::zero()).await
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    fn name(&self) -> &str {
        &self.name
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Evm
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        match self.provider.get_block_number().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        let wzion = match self.wzion_address() {
            Some(a) => a,
            None => return Ok(vec![]),
        };

        let tip = self.current_height().await?;
        let from = tip.saturating_sub(100);

        let mut events = Vec::new();

        let burn_filter = Self::make_filter(wzion, from, tip, Self::topic0(BRIDGE_BURN_SIG));
        for log in self
            .provider
            .get_logs(&burn_filter)
            .await
            .unwrap_or_default()
        {
            if let Some(e) = self.decode_burn_log(&log) {
                events.push(e);
            }
        }

        let mint_filter = Self::make_filter(wzion, from, tip, Self::topic0(BRIDGE_MINT_SIG));
        for log in self
            .provider
            .get_logs(&mint_filter)
            .await
            .unwrap_or_default()
        {
            if let Some(e) = self.decode_mint_log(&log) {
                events.push(e);
            }
        }

        Ok(events)
    }

    async fn watch_addresses(&self, addresses: &[Address]) -> MultichainResult<Vec<DepositEvent>> {
        if self.token_registry.is_empty() {
            return Ok(vec![]);
        }

        let tip = self.current_height().await?;
        let from = tip.saturating_sub(10_000);

        let transfer_topic = Self::topic0(ERC20_TRANSFER_EVENT_SIG);
        let token_addresses: Vec<EthAddress> = self.token_registry.keys().copied().collect();
        let topic_addresses: Vec<Option<H256>> = addresses
            .iter()
            .filter_map(|addr| {
                self.to_eth_address(addr)
                    .ok()
                    .map(|eth_addr| Some(H256::from(eth_addr)))
            })
            .collect();

        if topic_addresses.is_empty() || token_addresses.is_empty() {
            return Ok(vec![]);
        }

        let filter = Filter::new()
            .address(ValueOrArray::Array(token_addresses))
            .from_block(U64::from(from))
            .to_block(U64::from(tip))
            .topic0(transfer_topic)
            .topic2(ValueOrArray::Array(topic_addresses));

        let mut events = Vec::new();
        for log in self
            .provider
            .get_logs(&filter)
            .await
            .unwrap_or_default()
        {
            let log_token = log.address;
            let Some(asset) = self.token_registry.get(&log_token) else {
                continue;
            };
            if let Some(e) = self.decode_erc20_transfer_log(&log, asset, tip) {
                events.push(e);
            }
        }

        Ok(events)
    }

    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        let bridge = self
            .bridge_address()
            .ok_or_else(|| MultichainError::Config("bridge contract not configured".to_string()))?;
        let wallet = self
            .wallet
            .as_ref()
            .ok_or_else(|| MultichainError::Unsupported("EVM wallet not configured".to_string()))?
            .clone();

        if !self.is_validator(bridge, wallet.address()).await? {
            return Err(MultichainError::Unsupported(
                "configured EVM wallet is not a ZIONBridge validator".to_string(),
            ));
        }

        match transfer.direction {
            TransferDirection::LockMint => self.submit_lock_proof(transfer, bridge).await,
            TransferDirection::BurnRelease => self.confirm_burn_release(transfer, bridge).await,
            TransferDirection::Htlc => {
                let swap = self
                    .atomic_swap_address()
                    .ok_or_else(|| MultichainError::Config("atomic swap contract not configured".to_string()))?;
                if transfer.id.starts_with("htlc-lock-") {
                    self.htlc_lock(transfer, swap).await
                } else if transfer.id.starts_with("htlc-claim-") {
                    self.htlc_claim(transfer, swap).await
                } else if transfer.id.starts_with("htlc-refund-") {
                    self.htlc_refund(transfer, swap).await
                } else {
                    Err(MultichainError::Validation(format!(
                        "unknown HTLC transfer id prefix: {}",
                        transfer.id
                    )))
                }
            }
            _ => Err(MultichainError::Unsupported(format!(
                "EVM adapter cannot handle transfer direction {:?}",
                transfer.direction
            ))),
        }
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let block = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        Ok(block.as_u64())
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        let h256 = H256::from_slice(tx_hash.as_bytes());
        let receipt = self
            .provider
            .get_transaction_receipt(h256)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;

        let receipt = match receipt {
            Some(r) => r,
            None => return Ok(0),
        };

        let tx_block = receipt
            .block_number
            .ok_or_else(|| MultichainError::Internal("receipt missing block_number".to_string()))?
            .as_u64();
        let tip = self.current_height().await?;
        Ok(tip.saturating_sub(tx_block) + 1)
    }

    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        let eth_addr = self.to_eth_address(to)?;
        self.send_transaction(eth_addr, vec![], U256::from(amount.0))
            .await
    }

    async fn transfer_token(&self, token: &zion_l1_types::Asset, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        let token_addr = match token.id.contract.as_deref() {
            Some(addr) => EthAddress::from_str(addr)
                .map_err(|e| MultichainError::Validation(format!("invalid token contract: {e}")))?,
            None if token.id.ticker == "wZION" => self
                .wzion_address()
                .ok_or_else(|| MultichainError::Config("wZION contract not configured".to_string()))?,
            None => {
                return Err(MultichainError::Validation(format!(
                    "token contract address required for {}",
                    token.id
                )))
            }
        };

        let to_eth = self.to_eth_address(to)?;
        let mut data = Self::function_selector(ERC20_TRANSFER_SIG).to_vec();
        let args = encode(&[Token::Address(to_eth), Token::Uint(U256::from(amount.0))]);
        data.extend_from_slice(&args);

        self.send_transaction(token_addr, data, U256::zero()).await
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let eth_addr = self.to_eth_address(address)?;
        let wei = self
            .provider
            .get_balance(eth_addr, None)
            .await
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        // EVM balances are U256; ZION Amount is u128. Mainnet ETH/ERC-20 totals
        // never exceed u128 in practice, so this cast is safe for Mainnet Alpha.
        Ok(Amount::new(wei.as_u128()))
    }
}
