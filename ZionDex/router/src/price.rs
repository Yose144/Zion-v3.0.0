use crate::config::RouterConfig;
use crate::types::*;
use anyhow::{anyhow, Result};
use ethers::{
    providers::{Http, Middleware, Provider},
    types::{Address, Bytes, TransactionRequest, U256, NameOrAddress},
};
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Price feed — fetches real prices from on-chain pools
pub struct PriceFeed {
    config: RouterConfig,
}

/// Pool price info
#[derive(Debug, Clone, Default)]
pub struct PoolPrice {
    pub sqrt_price_x96: u128,
    pub tick: i32,
    pub liquidity: u128,
    /// Price as token1/token0 (human-readable)
    pub price: f64,
}

impl PriceFeed {
    pub fn new(config: RouterConfig) -> Self {
        Self { config }
    }

    /// Fetch real price from a Uniswap V3 pool via slot0()
    pub async fn fetch_uniswap_v3_price(
        &self,
        chain: ChainId,
        pool_address: &str,
    ) -> Result<PoolPrice> {
        let rpc_url = self.config.rpc_urls.get(&chain)
            .ok_or_else(|| anyhow!("No RPC URL for chain {}", chain))?;

        let provider = Provider::try_from(rpc_url.as_str())?;
        let pool_addr: Address = pool_address.parse()
            .map_err(|e| anyhow!("Invalid pool address {}: {}", pool_address, e))?;

        // slot0() selector = 0x3850c7bd
        let calldata = Bytes::from(vec![0x38, 0x50, 0xc7, 0xbd]);
        let tx = TransactionRequest::new()
            .to(NameOrAddress::Address(pool_addr))
            .data(calldata);

        let result = provider.call(&tx.into(), None).await?;

        let raw = hex::encode(&result);
        debug!("slot0 raw response: 0x{}...", &raw[..64.min(raw.len())]);

        let mut price = parse_slot0(&raw)?;

        // Also fetch liquidity
        if let Ok(liq) = self.fetch_pool_liquidity_inner(&provider, pool_addr).await {
            price.liquidity = liq;
        }

        debug!("Pool {} price: sqrtPriceX96={}, tick={}, liquidity={}",
            pool_address, price.sqrt_price_x96, price.tick, price.liquidity);
        Ok(price)
    }

    /// Fetch liquidity from a Uniswap V3 pool via liquidity()
    pub async fn fetch_pool_liquidity(
        &self,
        chain: ChainId,
        pool_address: &str,
    ) -> Result<u128> {
        let rpc_url = self.config.rpc_urls.get(&chain)
            .ok_or_else(|| anyhow!("No RPC URL for chain {}", chain))?;

        let provider = Provider::try_from(rpc_url.as_str())?;
        let pool_addr: Address = pool_address.parse()
            .map_err(|e| anyhow!("Invalid pool address: {}", e))?;

        self.fetch_pool_liquidity_inner(&provider, pool_addr).await
    }

    async fn fetch_pool_liquidity_inner(
        &self,
        provider: &Provider<Http>,
        pool_addr: Address,
    ) -> Result<u128> {
        // liquidity() selector = 0x1a686502
        let calldata = Bytes::from(vec![0x1a, 0x68, 0x65, 0x02]);
        let tx = TransactionRequest::new()
            .to(NameOrAddress::Address(pool_addr))
            .data(calldata);

        let result = provider.call(&tx.into(), None).await?;
        let raw = hex::encode(&result);
        if raw.len() < 64 {
            return Ok(0);
        }
        let liquidity = u128::from_str_radix(&raw[..64], 16).unwrap_or(0);
        Ok(liquidity)
    }

    /// Quote exact input using Uniswap V3 QuoterV2
    /// Returns (amount_out, sqrtPriceX96_after)
    pub async fn quote_exact_input_single(
        &self,
        chain: ChainId,
        quoter_address: &str,
        token_in: &str,
        token_out: &str,
        amount_in: U256,
        fee: u32,
    ) -> Result<(U256, u128)> {
        let rpc_url = self.config.rpc_urls.get(&chain)
            .ok_or_else(|| anyhow!("No RPC URL for chain {}", chain))?;

        let provider = Provider::try_from(rpc_url.as_str())?;
        let quoter_addr: Address = quoter_address.parse()
            .map_err(|e| anyhow!("Invalid quoter address: {}", e))?;
        let token_in_addr: Address = token_in.parse()
            .map_err(|e| anyhow!("Invalid token_in address: {}", e))?;
        let token_out_addr: Address = token_out.parse()
            .map_err(|e| anyhow!("Invalid token_out address: {}", e))?;

        // quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96))
        // selector = 0xc6a5026a
        let params = ethers::abi::encode(&[
            ethers::abi::Token::Tuple(vec![
                ethers::abi::Token::Address(token_in_addr),
                ethers::abi::Token::Address(token_out_addr),
                ethers::abi::Token::Uint(amount_in),
                ethers::abi::Token::Uint(U256::from(fee)),
                ethers::abi::Token::Uint(U256::zero()),
            ]),
        ]);

        let mut calldata = vec![0xc6, 0xa5, 0x02, 0x6a];
        calldata.extend_from_slice(&params);

        let tx = TransactionRequest::new()
            .to(NameOrAddress::Address(quoter_addr))
            .data(Bytes::from(calldata));

        let result = provider.call(&tx.into(), None).await?;

        // Response: (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
        let raw = hex::encode(&result);
        if raw.len() < 128 {
            return Err(anyhow!("Quoter response too short: {} chars", raw.len()));
        }

        let amount_out = U256::from_str_radix(&raw[..64], 16).unwrap_or(U256::zero());
        let sqrt_price_after = u128::from_str_radix(&raw[64..128], 16).unwrap_or(0);

        debug!("Quote: amount_in={}, amount_out={}, sqrtPriceAfter={}", amount_in, amount_out, sqrt_price_after);
        Ok((amount_out, sqrt_price_after))
    }

    /// Get the best price for a token pair on a chain
    pub async fn get_best_price(
        &self,
        chain: ChainId,
        token_a: &str,
        token_b: &str,
        _amount: &str,
    ) -> Result<f64> {
        // Find pool in registry
        let pool = self.config.find_pool(chain, token_a, token_b);

        if let Some(pool) = pool {
            // Fetch real price from pool slot0
            match self.fetch_uniswap_v3_price(chain, &pool.address).await {
                Ok(price_info) => {
                    return Ok(price_info.price);
                }
                Err(e) => {
                    warn!("Failed to fetch pool price for {}/{}: {}", token_a, token_b, e);
                }
            }
        }

        // Fallback: no real price available
        Err(anyhow!("No price source for {}/{} on {}", token_a, token_b, chain))
    }
}

/// Parse Uniswap V3 slot0 response
fn parse_slot0(hex_str: &str) -> Result<PoolPrice> {
    let hex_clean = hex_str.trim_start_matches("0x");
    if hex_clean.len() < 128 {
        return Err(anyhow!("slot0 response too short: {} chars", hex_clean.len()));
    }

    // sqrtPriceX96 = first 32 bytes (64 hex chars)
    let sqrt_price_hex = &hex_clean[..64];
    let sqrt_price_x96 = u128::from_str_radix(sqrt_price_hex, 16)
        .map_err(|e| anyhow!("Failed to parse sqrtPriceX96: {}", e))?;

    // tick = next 32 bytes (int24 padded to 32 bytes)
    // The tick is stored as int24, but ABI-encodes it as int256 (32 bytes)
    // For negative values, the high bytes are 0xFF (sign-extended)
    let tick_hex = &hex_clean[64..128];
    // Parse only the last 6 hex chars (24 bits = int24) — tick fits in int24
    let tick_low_hex = &tick_hex[58..64]; // last 6 hex chars (24 bits)
    let tick_raw = u32::from_str_radix(tick_low_hex, 16).unwrap_or(0);
    // Sign-extend from 24 bits to i32
    let tick = if tick_raw & 0x800000 != 0 {
        (tick_raw | 0xFF000000) as i32 // set high byte to 0xFF
    } else {
        tick_raw as i32
    };

    // Compute human-readable price
    // price = (sqrtPriceX96 / 2^96)^2
    let price = if sqrt_price_x96 > 0 {
        let sqrt_price = sqrt_price_x96 as f64 / 2f64.powi(96);
        sqrt_price * sqrt_price
    } else {
        0.0
    };

    Ok(PoolPrice {
        sqrt_price_x96,
        tick,
        liquidity: 0,
        price,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_slot0_zero() {
        // 128 hex chars of zeros
        let result = parse_slot0("0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").unwrap();
        assert_eq!(result.sqrt_price_x96, 0);
        assert_eq!(result.tick, 0);
        assert_eq!(result.price, 0.0);
    }

    #[test]
    fn test_parse_slot0_too_short() {
        let result = parse_slot0("0x");
        assert!(result.is_err(), "Should error on short input");
    }

    #[test]
    fn test_parse_slot0_sample() {
        // sqrtPriceX96 = 2^96 (price = 1.0)
        // 2^96 in hex padded to 64 chars:
        let sqrt_hex = "0000000000000000000000000000000000000001000000000000000000000000";
        let tick_hex = "0000000000000000000000000000000000000000000000000000000000000000";
        let raw = format!("0x{}{}", sqrt_hex, tick_hex);
        let result = parse_slot0(&raw).unwrap();
        assert!(result.sqrt_price_x96 > 0);
        assert_eq!(result.tick, 0);
        assert!((result.price - 1.0).abs() < 0.01, "price should be ~1.0, got {}", result.price);
    }

    #[test]
    fn test_parse_slot0_negative_tick() {
        // sqrtPriceX96 = 2^96
        let sqrt_hex = "0000000000000000000000000000000000000001000000000000000000000000";
        // tick = -100 in two's complement (32 bytes)
        let tick_hex = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9c";
        let raw = format!("0x{}{}", sqrt_hex, tick_hex);
        let result = parse_slot0(&raw).unwrap();
        assert!(result.sqrt_price_x96 > 0);
        // tick should be negative (high bits set)
        assert!(result.tick < 0, "tick should be negative, got {}", result.tick);
    }
}
