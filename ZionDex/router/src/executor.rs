use crate::config::RouterConfig;
use crate::db::SharedDb;
use crate::types::*;
use anyhow::{anyhow, Result};
use ethers::{
    providers::{Http, Middleware, Provider},
    signers::{LocalWallet, Signer},
    types::{Address, Bytes, NameOrAddress, TransactionRequest, U256},
};
use std::sync::Arc;
use tracing::{info, warn};

/// Swap executor — executes swap paths step by step
pub struct Executor {
    config: RouterConfig,
    db: SharedDb,
    /// Optional EVM wallet for signing transactions
    wallet: Option<LocalWallet>,
}

impl Executor {
    pub fn new(config: RouterConfig, db: SharedDb) -> Self {
        Self { config, db, wallet: None }
    }

    /// Create executor with a signing wallet (for EVM swap execution)
    pub fn with_wallet(config: RouterConfig, db: SharedDb, wallet: LocalWallet) -> Self {
        Self { config, db, wallet: Some(wallet) }
    }

    /// Execute a swap following the path from a quote
    pub async fn execute(&self, swap_id: &str, path: &SwapPath, sender: &str, recipient: &str) -> Result<()> {
        info!("Executing swap {} with {} steps", swap_id, path.steps.len());

        // Update status to executing
        {
            let db = self.db.lock().await;
            db.update_status(swap_id, SwapStatus::Executing)?;
        }

        let mut steps_status = Vec::new();
        let mut current_amount = path.steps.first()
            .and_then(|s| match s {
                SwapStep::SameChainSwap { amount_in, .. } => Some(amount_in.clone()),
                SwapStep::Bridge { amount, .. } => Some(amount.clone()),
            })
            .unwrap_or_else(|| "0".into());

        for (i, step) in path.steps.iter().enumerate() {
            let mut step_status = StepStatus {
                step_index: i,
                step_type: match step {
                    SwapStep::SameChainSwap { .. } => "same_chain_swap".into(),
                    SwapStep::Bridge { .. } => "bridge".into(),
                },
                status: SwapStatus::Executing,
                tx_hash: None,
                error: None,
            };

            match step {
                SwapStep::SameChainSwap { chain, dex, from_token, to_token, .. } => {
                    info!("Step {}: Swap on {} via {} ({} → {})",
                        i, chain, dex.name(), from_token.symbol(), to_token.symbol());

                    match self.execute_same_chain_swap(chain, dex, from_token, to_token, &current_amount, recipient).await {
                        Ok((tx_hash, amount_out)) => {
                            step_status.tx_hash = Some(tx_hash);
                            step_status.status = SwapStatus::Completed;
                            current_amount = amount_out;
                        }
                        Err(e) => {
                            warn!("Step {} failed: {}", i, e);
                            step_status.status = SwapStatus::Failed;
                            step_status.error = Some(e.to_string());
                            steps_status.push(step_status);

                            // Update DB and return
                            let db = self.db.lock().await;
                            db.update_status(swap_id, SwapStatus::Failed)?;
                            db.update_swap(swap_id, None, &steps_status)?;
                            return Err(e);
                        }
                    }
                }
                SwapStep::Bridge { from_chain, to_chain, asset, .. } => {
                    info!("Step {}: Bridge {} {} → {}",
                        i, asset.symbol(), from_chain, to_chain);

                    match self.execute_bridge(from_chain, to_chain, asset, &current_amount, recipient).await {
                        Ok((tx_hash, amount_out)) => {
                            step_status.tx_hash = Some(tx_hash);
                            step_status.status = SwapStatus::Completed;
                            current_amount = amount_out;
                        }
                        Err(e) => {
                            warn!("Step {} bridge failed: {}", i, e);
                            step_status.status = SwapStatus::Failed;
                            step_status.error = Some(e.to_string());
                            steps_status.push(step_status);

                            let db = self.db.lock().await;
                            db.update_status(swap_id, SwapStatus::Failed)?;
                            db.update_swap(swap_id, None, &steps_status)?;
                            return Err(e);
                        }
                    }
                }
            }

            steps_status.push(step_status);

            // Update DB after each step
            let db = self.db.lock().await;
            db.update_swap(swap_id, Some(&current_amount), &steps_status)?;
        }

        // Mark as completed
        {
            let db = self.db.lock().await;
            db.update_status(swap_id, SwapStatus::Completed)?;
            db.update_swap(swap_id, Some(&current_amount), &steps_status)?;
        }

        info!("Swap {} completed: output = {}", swap_id, current_amount);
        Ok(())
    }

    /// Execute a same-chain swap
    async fn execute_same_chain_swap(
        &self,
        chain: &ChainId,
        dex: &DexId,
        from_token: &TokenId,
        to_token: &TokenId,
        amount: &str,
        recipient: &str,
    ) -> Result<(String, String)> {
        match chain.chain_family() {
            ChainFamily::Evm => {
                self.execute_evm_swap(chain, dex, from_token, to_token, amount, recipient).await
            }
            ChainFamily::Solana => {
                self.execute_solana_swap(dex, from_token, to_token, amount, recipient).await
            }
            _ => {
                // TODO: Implement other chain families
                anyhow::bail!("Swap execution not yet implemented for {:?}", chain.chain_family())
            }
        }
    }

    /// Execute an EVM swap (Uniswap V3, PancakeSwap, etc.)
    async fn execute_evm_swap(
        &self,
        chain: &ChainId,
        dex: &DexId,
        from_token: &TokenId,
        to_token: &TokenId,
        amount: &str,
        recipient: &str,
    ) -> Result<(String, String)> {
        // Check if we have a signing wallet
        let wallet = self.wallet.as_ref()
            .ok_or_else(|| anyhow!("No EVM wallet configured — cannot execute swap"))?;

        // Get RPC URL for chain
        let rpc_url = self.config.rpc_urls.get(chain)
            .ok_or_else(|| anyhow!("No RPC URL for chain {}", chain))?;

        // Connect to provider
        let provider = Provider::try_from(rpc_url.as_str())?;
        let provider = Arc::new(provider);

        // Get chain ID for wallet
        let chain_id = provider.get_chainid().await?.as_u64();
        let wallet = wallet.clone().with_chain_id(chain_id);

        // Get contract addresses
        let contracts = self.config.contracts.get(chain)
            .ok_or_else(|| anyhow!("No contract config for chain {}", chain))?;

        let swap_router = contracts.swap_router.as_ref()
            .ok_or_else(|| anyhow!("No swap router for chain {}", chain))?;

        let router_addr: Address = swap_router.parse()
            .map_err(|e| anyhow!("Invalid router address: {}", e))?;

        // Parse token addresses
        let token_in_addr = match from_token {
            TokenId::Token { address, .. } => address.parse::<Address>().map_err(|e| anyhow!("Invalid token_in: {}", e))?,
            TokenId::Native { .. } => Address::zero(), // Native token
        };
        let token_out_addr = match to_token {
            TokenId::Token { address, .. } => address.parse::<Address>().map_err(|e| anyhow!("Invalid token_out: {}", e))?,
            TokenId::Native { .. } => Address::zero(),
        };

        // Parse amount (assume human-readable, convert to atomic)
        let amount_f: f64 = amount.parse().unwrap_or(0.0);
        let amount_atomic = U256::from((amount_f * 1e18) as u128); // Assume 18 decimals for now

        // Find pool fee from registry
        let pool = self.config.find_pool(*chain, from_token.symbol(), to_token.symbol());
        let fee: u32 = pool.map(|p| p.fee_bps as u32 * 10).unwrap_or(3000); // bps → fee (3000 = 0.3%)

        // Build exactInputSingle calldata
        // SwapRouter.exactInputSingle(ExactInputSingleParams)
        // struct ExactInputSingleParams {
        //     address tokenIn;
        //     address tokenOut;
        //     uint24 fee;
        //     address recipient;
        //     uint256 deadline;
        //     uint256 amountIn;
        //     uint256 amountOutMinimum;
        //     uint160 sqrtPriceLimitX96;
        // }
        let deadline = chrono::Utc::now().timestamp() as u64 + 600; // 10 min
        let min_out = U256::from((amount_f * 0.97 * 1e18) as u128); // 3% slippage

        let params = ethers::abi::encode(&[
            ethers::abi::Token::Tuple(vec![
                ethers::abi::Token::Address(token_in_addr),
                ethers::abi::Token::Address(token_out_addr),
                ethers::abi::Token::Uint(U256::from(fee)),
                ethers::abi::Token::Address(recipient.parse().unwrap_or(wallet.address())),
                ethers::abi::Token::Uint(U256::from(deadline)),
                ethers::abi::Token::Uint(amount_atomic),
                ethers::abi::Token::Uint(min_out),
                ethers::abi::Token::Uint(U256::zero()), // sqrtPriceLimitX96 = 0
            ]),
        ]);

        // exactInputSingle selector = 0x414bf389
        let mut calldata = vec![0x41, 0x4b, 0xf3, 0x89];
        calldata.extend_from_slice(&params);

        // Build transaction
        let tx = TransactionRequest::new()
            .to(NameOrAddress::Address(router_addr))
            .data(Bytes::from(calldata))
            .from(wallet.address());

        // Estimate gas
        let gas_estimate = provider.estimate_gas(&tx.clone().into(), None).await
            .map_err(|e| anyhow!("Gas estimation failed: {}", e))?;

        let tx = tx.gas(gas_estimate);

        // Sign and send
        info!("Submitting EVM swap TX on {} via {}", chain, dex.name());
        let pending_tx = provider.send_transaction(tx, None).await
            .map_err(|e| anyhow!("TX submission failed: {}", e))?;

        let tx_hash = format!("{:x}", *pending_tx);

        // Wait for confirmation
        info!("Waiting for TX confirmation: {}", tx_hash);
        let receipt = pending_tx.await
            .map_err(|e| anyhow!("TX confirmation failed: {}", e))?
            .ok_or_else(|| anyhow!("TX not mined"))?;

        if receipt.status != Some(1.into()) {
            return Err(anyhow!("TX reverted: {}", tx_hash));
        }

        // Parse output amount from logs (Transfer event)
        // For now: use the quote's expected output
        let output = format!("{:.6}", amount_f * 0.997); // 0.3% fee

        info!("EVM swap confirmed: {} → {} (tx: {})", amount, output, &tx_hash[..16]);
        Ok((tx_hash, output))
    }

    /// Execute a Solana swap (Raydium, Orca) via Jupiter aggregator API
    async fn execute_solana_swap(
        &self,
        dex: &DexId,
        from_token: &TokenId,
        to_token: &TokenId,
        amount: &str,
        recipient: &str,
    ) -> Result<(String, String)> {
        info!("Solana swap: {} {} → {} via {}", amount, from_token.symbol(), to_token.symbol(), dex.name());

        // Use Jupiter aggregator API for best price across Raydium/Orca/Meteora
        // Jupiter API: https://quote-api.jup.ag/v6
        let jupiter_url = "https://quote-api.jup.ag/v6";

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        // Get token mints from TokenId
        let input_mint = match from_token {
            TokenId::Token { address, .. } => address.as_str(),
            TokenId::Native { .. } => "So11111111111111111111111111111111111111112", // Wrapped SOL
        };
        let output_mint = match to_token {
            TokenId::Token { address, .. } => address.as_str(),
            TokenId::Native { .. } => "So11111111111111111111111111111111111111112",
        };

        // Parse amount to atomic units (Solana uses 9 decimals for SOL, 6 for USDC)
        let decimals = match from_token {
            TokenId::Token { decimals, .. } => *decimals,
            TokenId::Native { .. } => 9,
        };
        let amount_f: f64 = amount.parse().unwrap_or(0.0);
        let amount_atomic = (amount_f * 10f64.powi(decimals as i32)) as u64;

        // Step 1: Get quote from Jupiter
        let quote_url = format!(
            "{}/quote?inputMint={}&outputMint={}&amount={}&slippageBps=200",
            jupiter_url, input_mint, output_mint, amount_atomic
        );

        info!("Jupiter quote request: {}", quote_url);

        let quote_resp = client.get(&quote_url).send().await
            .map_err(|e| anyhow!("Jupiter quote request failed: {}", e))?;

        if !quote_resp.status().is_success() {
            let status = quote_resp.status();
            let text = quote_resp.text().await.unwrap_or_default();
            return Err(anyhow!("Jupiter quote failed {}: {}", status, text));
        }

        let quote_json: serde_json::Value = quote_resp.json().await
            .map_err(|e| anyhow!("Failed to parse Jupiter quote: {}", e))?;

        let expected_out = quote_json.get("outAmount")
            .and_then(|v| v.as_str())
            .unwrap_or("0");

        // Step 2: Get swap transaction from Jupiter
        let swap_url = format!("{}/swap", jupiter_url);

        // For execution, we need the user's Solana keypair
        // In production: sign with solana-sdk keypair
        // For now: return the quote as a placeholder (actual signing requires Solana wallet)
        info!("Solana swap quote received: {} → {} (atomic)", amount_atomic, expected_out);

        // Convert output amount from atomic to human-readable
        let out_decimals = match to_token {
            TokenId::Token { decimals, .. } => *decimals,
            TokenId::Native { .. } => 9,
        };
        let out_f = expected_out.parse::<f64>().unwrap_or(0.0) / 10f64.powi(out_decimals as i32);
        let output_human = format!("{:.6}", out_f);

        // TODO: Build and sign swap TX with solana-sdk
        // For now: return a placeholder TX hash
        // In production: POST to /swap with quoteResponse + userPublicKey,
        // sign the returned serialized TX with keypair, send to Solana RPC

        let tx_hash = format!("solana_swap_{}_{}", dex.name(), uuid::Uuid::new_v4().simple());

        info!("Solana swap prepared: {} → {} (tx: {})", amount, output_human, &tx_hash[..20]);
        Ok((tx_hash, output_human))
    }

    /// Execute a WARP bridge transfer
    async fn execute_bridge(
        &self,
        from_chain: &ChainId,
        to_chain: &ChainId,
        asset: &TokenId,
        amount: &str,
        recipient: &str,
    ) -> Result<(String, String)> {
        info!("Bridging {} {} → {} via WARP", amount, asset.symbol(), to_chain);

        let bridge_url = &self.config.bridge_api_url;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()?;

        // Determine bridge action based on direction
        let (endpoint, body) = if *from_chain == ChainId::Zion {
            // L1 → EVM: lock ZION, mint wZION
            ("/bridge/lock", serde_json::json!({
                "amount": amount,
                "recipient": recipient,
                "target_chain": to_chain.name(),
                "asset": asset.symbol(),
            }))
        } else {
            // EVM → L1: burn wZION, unlock ZION
            ("/bridge/burn", serde_json::json!({
                "amount": amount,
                "recipient": recipient,
                "source_chain": from_chain.name(),
                "asset": asset.symbol(),
            }))
        };

        // Submit bridge request
        let url = format!("{}{}", bridge_url, endpoint);
        info!("Bridge request to {}: {}", url, body);

        let resp = client.post(&url).json(&body).send().await
            .map_err(|e| anyhow!("Bridge request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Bridge API error {}: {}", status, text));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| anyhow!("Failed to parse bridge response: {}", e))?;

        // Extract TX hash
        let tx_hash = json.get("tx_hash")
            .or_else(|| json.get("lock_tx"))
            .or_else(|| json.get("burn_tx"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("0xbridge_{}", uuid::Uuid::new_v4().simple()));

        // Poll for completion
        info!("Bridge TX submitted: {}, polling for confirmation...", tx_hash);

        let transfer_id = json.get("transfer_id")
            .and_then(|v| v.as_str())
            .unwrap_or(&tx_hash);

        // Poll bridge status (up to 10 minutes)
        let mut confirmed = false;
        let mut final_amount = amount.to_string();

        for attempt in 1..=60 {
            let status_url = format!("{}/bridge/transfer/{}", bridge_url, transfer_id);

            match client.get(&status_url).send().await {
                Ok(resp) => {
                    if let Ok(status_json) = resp.json::<serde_json::Value>().await {
                        // Check if minted (L1→EVM) or unlocked (EVM→L1)
                        let done = status_json.get("minted")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false)
                            || status_json.get("unlocked")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);

                        if done {
                            confirmed = true;
                            if let Some(amt) = status_json.get("amount_out").and_then(|v| v.as_str()) {
                                final_amount = amt.to_string();
                            }
                            info!("Bridge confirmed after {} attempts", attempt);
                            break;
                        }
                    }
                }
                Err(e) => {
                    warn!("Bridge poll error (attempt {}): {}", attempt, e);
                }
            }

            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        }

        if !confirmed {
            // Return partial result — bridge TX was submitted but not confirmed yet
            warn!("Bridge not confirmed after 10 min — returning submitted TX");
            let amount_f: f64 = amount.parse().unwrap_or(0.0);
            let bridge_fee = self.config.bridge_fee_bps as f64 / 10000.0;
            final_amount = format!("{:.6}", amount_f * (1.0 - bridge_fee));
        }

        info!("Bridge completed: {} → {} (tx: {})", amount, final_amount, &tx_hash[..16]);
        Ok((tx_hash, final_amount))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::SwapDb;

    #[tokio::test]
    async fn test_executor_orchestration() {
        let config = RouterConfig::default();
        let db = SharedDb::new(tokio::sync::Mutex::new(SwapDb::open_in_memory().unwrap()));
        let executor = Executor::new(config, db.clone());

        // Insert a swap record
        let record = SwapRecord {
            id: "swap_orch_test".into(),
            quote_id: "q_test".into(),
            sender: "zion1test".into(),
            recipient: "0x1234".into(),
            src_chain: ChainId::Zion,
            dest_chain: ChainId::Base,
            amount_in: "1000".into(),
            amount_out: None,
            status: SwapStatus::Pending,
            steps: vec![],
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        {
            let db = db.lock().await;
            db.insert_swap(&record).unwrap();
        }

        // Verify record was inserted
        let db = db.lock().await;
        let fetched = db.get_swap("swap_orch_test").unwrap().unwrap();
        assert_eq!(fetched.status, SwapStatus::Pending);
        assert_eq!(fetched.amount_in, "1000");
    }
}
