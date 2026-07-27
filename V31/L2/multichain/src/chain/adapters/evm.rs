//! EVM adapter — uses `ethers` HTTP provider and optional `LocalWallet`.
//!
//! Mainnet Alpha capabilities:
//! - read chain height, native balance, tx confirmations,
//! - watch `BridgeBurn` events on wZION,
//! - send native payments when a wallet is configured,
//! - call `ZIONBridge.submitLockProof` when the configured wallet is a validator.

use async_trait::async_trait;
use ethers::core::abi::{encode, decode, ParamType, Token};
use ethers::core::types::{TransactionRequest, Filter};
use ethers::core::utils::keccak256;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer as _Signer};
use ethers::middleware::SignerMiddleware;
use ethers::types::{Address as EthAddress, H256, U256, U64};
use std::str::FromStr;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::contracts::ZionContracts;
use crate::error::{MultichainError, MultichainResult};
use crate::types::Transfer;

const BRIDGE_BURN_SIG: &str = "BridgeBurn(address,uint256,string,bytes32,uint256)";
const BRIDGE_MINT_SIG: &str = "BridgeMint(address,uint256,bytes32,uint256)";
const SUBMIT_LOCK_PROOF_SIG: &str = "submitLockProof(bytes32,address,uint256,uint256,string)";
const HAS_ROLE_SIG: &str = "hasRole(bytes32,address)";

/// EVM adapter configured for a specific RPC, optional signer and contracts.
pub struct EvmAdapter {
    name: String,
    chain: ChainId,
    provider: Provider<Http>,
    wallet: Option<LocalWallet>,
    contracts: Option<ZionContracts>,
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

        Ok(Self {
            name: name.into(),
            chain,
            provider,
            wallet,
            contracts,
        })
    }

    fn to_eth_address(&self, addr: &Address) -> MultichainResult<EthAddress> {
        if addr.chain != self.chain && addr.chain.family() != ChainFamily::Evm {
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

    async fn is_validator(&self, bridge: EthAddress, account: EthAddress) -> MultichainResult<bool> {
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
            .clone();
        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = TransactionRequest::new()
            .to(to)
            .data(data)
            .value(value)
            .gas(300_000);

        let pending = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| MultichainError::Internal(format!("send_transaction failed: {e}")))?;
        let receipt = pending
            .await
            .map_err(|e| MultichainError::Internal(format!("transaction confirmation failed: {e}")))?
            .ok_or_else(|| MultichainError::Internal("transaction receipt missing".to_string()))?;

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
            &[ParamType::Uint(256), ParamType::String, ParamType::Uint(256)],
            log.data.as_ref(),
        )
        .ok()?;
        let amount = tokens[0].clone().into_uint()?;
        let l1_recipient = tokens[1].clone().into_string()?;

        let from_addr = Address::new(self.chain, from.as_bytes().to_vec(), format!("0x{}", hex::encode(from.as_bytes()))).ok()?;

        Some(DepositEvent {
            chain: self.chain,
            tx_hash: log.transaction_hash.map(|h| Hash::new(*h.as_fixed_bytes())).unwrap_or_default(),
            recipient: from_addr,
            amount: Amount::new(amount.as_u128()),
            memo: Some(format!("BRIDGE:zion-l1:{}", l1_recipient)),
            confirmations: 1,
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

        let recipient_addr = Address::new(self.chain, recipient.as_bytes().to_vec(), format!("0x{}", hex::encode(recipient.as_bytes()))).ok()?;

        Some(DepositEvent {
            chain: self.chain,
            tx_hash: log.transaction_hash.map(|h| Hash::new(*h.as_fixed_bytes())).unwrap_or_default(),
            recipient: recipient_addr,
            amount: Amount::new(amount.as_u128()),
            memo: None,
            confirmations: 1,
        })
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
        for log in self.provider.get_logs(&burn_filter).await.unwrap_or_default() {
            if let Some(e) = self.decode_burn_log(&log) {
                events.push(e);
            }
        }

        let mint_filter = Self::make_filter(wzion, from, tip, Self::topic0(BRIDGE_MINT_SIG));
        for log in self.provider.get_logs(&mint_filter).await.unwrap_or_default() {
            if let Some(e) = self.decode_mint_log(&log) {
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

        let l1_tx_hash = match hex::decode(&transfer.id) {
            Ok(v) if v.len() == 32 => H256::from_slice(&v),
            _ => H256::from(keccak256(transfer.id.as_bytes())),
        };
        let recipient = self.to_eth_address(&transfer.target.address)?;
        let amount = U256::from(transfer.target.amount.0);
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
        self.send_transaction(eth_addr, vec![], U256::from(amount.0)).await
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
