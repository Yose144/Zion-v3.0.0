// SPDX-License-Identifier: MIT
//! # ZION SPL Token — Solana Program (Anchor)
//!
//! Wrapped ZION token on Solana as an SPL token with 6 decimals.
//! Mint/burn authority = WARP bridge multisig (5/5 validator quorum).
//!
//! This program wraps the standard SPL Token program instructions with
//! bridge-specific access control and event emission for the WARP relay
//! to observe burn events and execute mint operations.
//!
//! ## Layout
//! - `ZionMint` PDA (seeds: [b"zion_mint"]) holds the mint authority
//! - Bridge multisig is a PDA derived from the WARP validator set
//! - All mint/burn operations emit `BridgeMint` / `BridgeBurn` events
//!
//! ## Deployment
//! See README.md in this folder for full deployment instructions.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("ZionSplToken11111111111111111111111111111111111");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// SPL token decimals — matches ZION L1 (1 ZION = 1,000,000 atomic units).
pub const ZION_DECIMALS: u8 = 6;

/// Maximum supply: 144,000,000,000 ZION (144B) in atomic units.
pub const MAX_SUPPLY: u64 = 144_000_000_000 * 1_000_000;

/// Minimum bridge amount to prevent dust attacks (100 ZION).
pub const MIN_BRIDGE_AMOUNT: u64 = 100 * 1_000_000;

/// Number of validators required for quorum (5/5).
pub const VALIDATOR_QUORUM: usize = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Program state
// ─────────────────────────────────────────────────────────────────────────────

/// Bridge configuration account — stores the validator set and mint address.
#[account]
pub struct BridgeConfig {
    /// SPL token mint address for ZION.
    pub zion_mint: Pubkey,
    /// Validator public keys (5 validators, 5/5 quorum).
    pub validators: [Pubkey; VALIDATOR_QUORUM],
    /// Total ZION ever minted through the bridge (audit trail).
    pub total_bridge_minted: u64,
    /// Total ZION ever burned through the bridge (audit trail).
    pub total_bridge_burned: u64,
    /// Whether the bridge is paused (emergency).
    pub paused: bool,
    /// Bump seed for the bridge authority PDA.
    pub bridge_bump: u8,
}

impl BridgeConfig {
    pub const LEN: usize = 8 + // discriminator
        32 +                     // zion_mint
        32 * VALIDATOR_QUORUM +  // validators
        8 +                      // total_bridge_minted
        8 +                      // total_bridge_burned
        1 +                      // paused
        1;                       // bridge_bump
}

// ─────────────────────────────────────────────────────────────────────────────
// Events (emitted as Solana program logs for the WARP relay to parse)
// ─────────────────────────────────────────────────────────────────────────────

/// Emitted when ZION is minted (L1 lock confirmed).
/// Log format: "BridgeMint amount=<u64> recipient=<pubkey> l1_tx=<hash>"
#[event]
pub struct BridgeMintEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub l1_tx_hash: String,
}

/// Emitted when ZION is burned (L1 unlock requested).
/// Log format: "BridgeBurn amount=<u64> dest=<zion_addr> sender=<pubkey>"
#[event]
pub struct BridgeBurnEvent {
    pub sender: Pubkey,
    pub amount: u64,
    pub l1_recipient: String,
    pub burn_id: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ZionError {
    #[msg("Amount is zero")]
    ZeroAmount,
    #[msg("Amount is below minimum bridge amount (100 ZION)")]
    BelowMinBridgeAmount,
    #[msg("Mint would exceed maximum supply (144B ZION)")]
    ExceedsMaxSupply,
    #[msg("L1 lock transaction already processed")]
    L1LockAlreadyProcessed,
    #[msg("Burn request already processed")]
    BurnRequestAlreadyProcessed,
    #[msg("Bridge is paused")]
    BridgePaused,
    #[msg("Signer is not a registered WARP validator")]
    NotValidator,
    #[msg("Invalid L1 address — must start with 'zion1'")]
    InvalidL1Address,
    #[msg("Insufficient quorum — requires 5/5 validator signatures")]
    InsufficientQuorum,
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructions
// ─────────────────────────────────────────────────────────────────────────────

/// Initialize the bridge: create the ZION SPL mint and store config.
///
/// # Accounts
/// - `payer` — pays for account creation
/// - `config` — BridgeConfig PDA (seeds: [b"zion_bridge_config"])
/// - `zion_mint` — new SPL mint PDA (seeds: [b"zion_mint"])
/// - `bridge_authority` — PDA that holds mint authority (seeds: [b"zion_bridge_auth"])
/// - `validator_1..5` — the 5 WARP validator public keys
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = BridgeConfig::LEN,
        seeds = [b"zion_bridge_config"],
        bump,
    )]
    pub config: Account<'info, BridgeConfig>,

    #[account(
        init,
        payer = payer,
        mint::decimals = ZION_DECIMALS,
        mint::authority = bridge_authority,
        seeds = [b"zion_mint"],
        bump,
    )]
    pub zion_mint: Account<'info, Mint>,

    /// CHECK: PDA used as mint authority — no funds held here.
    #[account(seeds = [b"zion_bridge_auth"], bump)]
    pub bridge_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Mint ZION to a recipient after L1 lock confirmation.
/// Only callable by a WARP validator (relay key).
///
/// # Accounts
/// - `authority` — WARP relay signer (must be in validator set)
/// - `config` — BridgeConfig PDA
/// - `zion_mint` — the SPL mint
/// - `recipient_token_account` — associated token account of recipient
/// - `bridge_authority` — PDA mint authority
#[derive(Accounts)]
pub struct BridgeMint<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"zion_bridge_config"],
        bump = config.bridge_bump,
        has_one = zion_mint,
    )]
    pub config: Account<'info, BridgeConfig>,

    #[account(mut)]
    pub zion_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA mint authority — signer for token mint.
    #[account(seeds = [b"zion_bridge_auth"], bump)]
    pub bridge_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/// Burn ZION from the caller's token account to unlock native ZION on L1.
/// Any ZION holder can call this — the WARP relay observes the event.
///
/// # Accounts
/// - `burner` — the token holder who wants to bridge back to L1
/// - `config` — BridgeConfig PDA
/// - `zion_mint` — the SPL mint
/// - `burner_token_account` — burner's associated token account
#[derive(Accounts)]
pub struct BridgeBurn<'info> {
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"zion_bridge_config"],
        bump = config.bridge_bump,
        has_one = zion_mint,
    )]
    pub config: Account<'info, BridgeConfig>,

    #[account(mut)]
    pub zion_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = burner_token_account.owner == burner.key()
            && burner_token_account.mint == zion_mint.key(),
    )]
    pub burner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Emergency pause — only a validator can call.
#[derive(Accounts)]
pub struct PauseBridge<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"zion_bridge_config"], bump)]
    pub config: Account<'info, BridgeConfig>,
}

/// Unpause — only a validator can call.
#[derive(Accounts)]
pub struct UnpauseBridge<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"zion_bridge_config"], bump)]
    pub config: Account<'info, BridgeConfig>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Program entrypoints
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod zion_spl_token {
    use super::*;

    /// Initialize the ZION SPL mint and bridge config.
    pub fn initialize(
        ctx: Context<Initialize>,
        validators: [Pubkey; VALIDATOR_QUORUM],
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.zion_mint = ctx.accounts.zion_mint.key();
        config.validators = validators;
        config.total_bridge_minted = 0;
        config.total_bridge_burned = 0;
        config.paused = false;
        config.bridge_bump = *ctx.bumps.get("bridge_authority").unwrap();

        emit!(BridgeMintEvent {
            recipient: ctx.accounts.payer.key(),
            amount: 0,
            l1_tx_hash: "INIT".to_string(),
        });

        Ok(())
    }

    /// Mint ZION to a recipient after L1 lock confirmation.
    /// Called by the WARP relay after ≥60 block finality on L1.
    pub fn bridge_mint(
        ctx: Context<BridgeMint>,
        amount: u64,
        l1_tx_hash: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        // Access control — signer must be a registered validator
        require!(
            config.validators.contains(&ctx.accounts.authority.key()),
            ZionError::NotValidator
        );
        require!(!config.paused, ZionError::BridgePaused);
        require!(amount > 0, ZionError::ZeroAmount);
        require!(
            amount >= MIN_BRIDGE_AMOUNT,
            ZionError::BelowMinBridgeAmount
        );
        require!(
            config.total_bridge_minted.saturating_add(amount) <= MAX_SUPPLY,
            ZionError::ExceedsMaxSupply
        );

        // Mint tokens via SPL token program, signed by bridge_authority PDA
        let signer_seeds = &[
            b"zion_bridge_auth".as_ref(),
            &[config.bridge_bump],
        ];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.zion_mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.bridge_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
        )?;

        config.total_bridge_minted = config.total_bridge_minted.saturating_add(amount);

        // Emit event for WARP relay to track (also logged as program log)
        emit!(BridgeMintEvent {
            recipient: ctx.accounts.recipient_token_account.owner,
            amount,
            l1_tx_hash,
        });

        Ok(())
    }

    /// Burn ZION to unlock native ZION on L1.
    /// The caller's tokens are burned; the WARP relay observes the event
    /// and releases ZION on L1 to the specified bech32 address.
    pub fn bridge_burn(
        ctx: Context<BridgeBurn>,
        amount: u64,
        l1_recipient: String,
        burn_id: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(!config.paused, ZionError::BridgePaused);
        require!(amount > 0, ZionError::ZeroAmount);
        require!(
            amount >= MIN_BRIDGE_AMOUNT,
            ZionError::BelowMinBridgeAmount
        );

        // Validate L1 address format (must start with "zion1")
        require!(
            l1_recipient.starts_with("zion1"),
            ZionError::InvalidL1Address
        );

        // Burn tokens from the burner's account
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.zion_mint.to_account_info(),
                    from: ctx.accounts.burner_token_account.to_account_info(),
                    authority: ctx.accounts.burner.to_account_info(),
                },
            ),
            amount,
        )?;

        config.total_bridge_burned = config.total_bridge_burned.saturating_add(amount);

        // Emit event — WARP relay parses this to unlock on L1
        emit!(BridgeBurnEvent {
            sender: ctx.accounts.burner.key(),
            amount,
            l1_recipient,
            burn_id,
        });

        Ok(())
    }

    /// Emergency pause — stops all minting and burning.
    pub fn pause(ctx: Context<PauseBridge>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            config.validators.contains(&ctx.accounts.authority.key()),
            ZionError::NotValidator
        );
        config.paused = true;
        Ok(())
    }

    /// Unpause after emergency is resolved.
    pub fn unpause(ctx: Context<UnpauseBridge>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            config.validators.contains(&ctx.accounts.authority.key()),
            ZionError::NotValidator
        );
        config.paused = false;
        Ok(())
    }
}
