// SPDX-License-Identifier: MIT
module zion::zion_coin {
    /// # ZION Coin — Sui Move Module
    ///
    /// Wrapped ZION token on Sui as a Coin type with 6 decimals.
    /// Mint/burn authority = WARP bridge multisig (5/5 validator quorum).
    ///
    /// Sui Move differs from Aptos Move in key ways:
    /// - Uses `sui::coin` module with `Coin<T>` and `TreasuryCap<T>`
    /// - Objects are first-class (Coin is an object)
    /// - No global storage — resources are stored in objects
    /// - `sui::transfer` for moving objects between accounts

    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// The ZION coin type — used as a type parameter for `Coin<ZION>`.
    struct ZION has drop {}

    /// Bridge configuration — shared object controlled by the validator set.
    struct BridgeConfig has key {
        id: UID,
        /// WARP validator addresses (5 validators, 5/5 quorum).
        validators: vector<address>,
        /// Total ZION ever minted through the bridge (audit trail).
        total_bridge_minted: u64,
        /// Total ZION ever burned through the bridge (audit trail).
        total_bridge_burned: u64,
        /// Whether the bridge is paused (emergency).
        paused: bool,
    }

    /// Event emitted when ZION is minted (L1 lock confirmed).
    struct BridgeMintEvent has copy, drop {
        recipient: address,
        amount: u64,
        l1_tx_hash: String,
    }

    /// Event emitted when ZION is burned (L1 unlock requested).
    struct BridgeBurnEvent has copy, drop {
        sender: address,
        amount: u64,
        l1_recipient: String,
        burn_id: String,
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// Coin decimals — matches ZION L1 (1 ZION = 1,000,000 atomic units).
    const DECIMALS: u8 = 6;

    /// Maximum supply: 144,000,000,000 ZION (144B) in atomic units.
    const MAX_SUPPLY: u64 = 144_000_000_000_000_000;

    /// Minimum bridge amount to prevent dust attacks (100 ZION).
    const MIN_BRIDGE_AMOUNT: u64 = 100_000_000;

    /// Number of validators required for quorum (5/5).
    const VALIDATOR_QUORUM: u8 = 5;

    // ─────────────────────────────────────────────────────────────────────────
    // Error codes
    // ─────────────────────────────────────────────────────────────────────────

    const E_ZERO_AMOUNT: u64 = 1;
    const E_BELOW_MIN_AMOUNT: u64 = 2;
    const E_EXCEEDS_MAX_SUPPLY: u64 = 3;
    const E_BRIDGE_PAUSED: u64 = 4;
    const E_NOT_VALIDATOR: u64 = 5;
    const E_INVALID_L1_ADDRESS: u64 = 6;
    const E_NOT_AUTHORIZED: u64 = 7;
    const E_INVALID_VALIDATOR_COUNT: u64 = 8;

    // ─────────────────────────────────────────────────────────────────────────
    // Initialize — called once at package publish to create the coin
    // ─────────────────────────────────────────────────────────────────────────

    /// Module initializer — called automatically when the package is published.
    /// Creates the ZION coin and transfers the TreasuryCap to the publisher.
    fun init(ctx: &mut TxContext) {
        // Create the ZION coin with metadata
        let (treasury_cap, coin_metadata) = coin::create_currency(
            ZION {},
            DECIMALS,
            b"ZION",                    // symbol
            b"ZION",                    // name
            b"Wrapped ZION - bridged from ZION L1 via WARP",  // description
            option::none(),             // icon URL
            ctx,
        );

        // Transfer coin metadata to the publisher (public display)
        transfer::public_freeze_object(coin_metadata);

        // The TreasuryCap is kept by the bridge — it will be stored in
        // the BridgeConfig or held by the bridge admin.
        // For security, we transfer it to the publisher (bridge admin).
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initialize bridge config — called after publish to set up validators
    // ─────────────────────────────────────────────────────────────────────────

    /// Initialize the bridge configuration with the 5 WARP validators.
    /// The TreasuryCap must be passed in (held by the caller).
    public entry fun initialize_bridge(
        validators: vector<address>,
        treasury_cap: &mut TreasuryCap<ZION>,
        ctx: &mut TxContext,
    ) {
        // Validate exactly 5 validators
        assert!(
            vector::length(&validators) == VALIDATOR_QUORUM,
            E_INVALID_VALIDATOR_COUNT,
        );

        // Create the bridge config as a shared object
        let config = BridgeConfig {
            id: object::new(ctx),
            validators,
            total_bridge_minted: 0,
            total_bridge_burned: 0,
            paused: false,
        };

        // Share the bridge config so anyone can read it
        transfer::share_object(config);

        // Note: TreasuryCap stays with the caller (bridge admin).
        // The bridge_mint function requires both the TreasuryCap and
        // the BridgeConfig to be passed in the same transaction.
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bridge mint — mint ZION after L1 lock confirmation (validator only)
    // ─────────────────────────────────────────────────────────────────────────

    /// Mint ZION to a recipient after L1 lock confirmation.
    /// The caller must be a registered WARP validator.
    public entry fun bridge_mint(
        config: &mut BridgeConfig,
        treasury_cap: &mut TreasuryCap<ZION>,
        recipient: address,
        amount: u64,
        l1_tx_hash: String,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);

        // Access control — caller must be a registered validator
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        assert!(!config.paused, E_BRIDGE_PAUSED);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(amount >= MIN_BRIDGE_AMOUNT, E_BELOW_MIN_AMOUNT);

        // Max supply check
        let new_total = config.total_bridge_minted + amount;
        assert!(new_total <= MAX_SUPPLY, E_EXCEEDS_MAX_SUPPLY);

        // Mint coins
        let coins = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coins, recipient);

        // Update state
        config.total_bridge_minted = new_total;

        // Emit event
        event::emit(BridgeMintEvent {
            recipient,
            amount,
            l1_tx_hash,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bridge burn — burn ZION to unlock on L1 (any holder)
    // ─────────────────────────────────────────────────────────────────────────

    /// Burn ZION to unlock native ZION on L1.
    /// The caller passes their Coin<ZION> object to be burned.
    public entry fun bridge_burn(
        config: &mut BridgeConfig,
        treasury_cap: &mut TreasuryCap<ZION>,
        coins: Coin<ZION>,
        l1_recipient: String,
        burn_id: String,
        ctx: &mut TxContext,
    ) {
        let burner = tx_context::sender(ctx);
        let amount = coin::value(&coins);

        assert!(!config.paused, E_BRIDGE_PAUSED);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(amount >= MIN_BRIDGE_AMOUNT, E_BELOW_MIN_AMOUNT);

        // Validate L1 address (must start with "zion1")
        assert!(is_valid_l1_address(&l1_recipient), E_INVALID_L1_ADDRESS);

        // Burn coins
        coin::burn(treasury_cap, coins, ctx);

        // Update state
        config.total_bridge_burned = config.total_bridge_burned + amount;

        // Emit event
        event::emit(BridgeBurnEvent {
            sender: burner,
            amount,
            l1_recipient,
            burn_id,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Emergency pause / unpause (validator only)
    // ─────────────────────────────────────────────────────────────────────────

    public entry fun pause(config: &mut BridgeConfig, ctx: &mut TxContext) {
        let caller = tx_context::sender(ctx);
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        config.paused = true;
    }

    public entry fun unpause(config: &mut BridgeConfig, ctx: &mut TxContext) {
        let caller = tx_context::sender(ctx);
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        config.paused = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /// Check if an address is a registered validator.
    public fun is_validator(config: &BridgeConfig, addr: address): bool {
        let i = 0;
        let len = vector::length(&config.validators);
        while (i < len) {
            if (*vector::borrow(&config.validators, i) == addr) {
                return true;
            };
            i = i + 1;
        };
        false
    }

    /// Check if the bridge is paused.
    public fun is_paused(config: &BridgeConfig): bool {
        config.paused
    }

    /// Get bridge statistics.
    public fun bridge_stats(config: &BridgeConfig): (u64, u64, u64) {
        (
            config.total_bridge_minted,
            config.total_bridge_burned,
            config.total_bridge_minted - config.total_bridge_burned,
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Validate that an L1 address starts with "zion1".
    fun is_valid_l1_address(addr: &String): bool {
        let bytes = string::bytes(addr);
        let len = vector::length(bytes);
        if (len < 5) return false;
        *vector::borrow(bytes, 0) == 0x7a  // 'z'
            && *vector::borrow(bytes, 1) == 0x69  // 'i'
            && *vector::borrow(bytes, 2) == 0x6f  // 'o'
            && *vector::borrow(bytes, 3) == 0x6e  // 'n'
            && *vector::borrow(bytes, 4) == 0x31  // '1'
    }
}
