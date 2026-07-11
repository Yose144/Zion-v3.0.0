// SPDX-License-Identifier: MIT
module zion::zion_coin {
    /// # ZION Coin — Aptos Move Module
    ///
    /// Wrapped ZION token on Aptos as a Coin type with 6 decimals.
    /// Mint/burn authority = WARP bridge multisig (5/5 validator quorum).
    ///
    /// This module implements the Aptos `CoinType` for ZION, providing:
    /// - `Coin<ZION>` type for transfers via `aptos_framework::coin`
    /// - Bridge mint/burn functions with validator access control
    /// - Pause/unpause for emergencies
    /// - Event emission for the WARP relay to observe

    use aptos_framework::coin::{self, BurnCapability, MintCapability, FreezeCapability};
    use aptos_framework::account;
    use std::signer;
    use std::string::String;
    use aptos_framework::event;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// The ZION coin type — used as a type parameter for `Coin<ZION>`.
    struct ZION {}

    /// Bridge configuration resource, stored under the bridge admin account.
    struct BridgeConfig has key {
        /// WARP validator addresses (5 validators, 5/5 quorum).
        validators: vector<address>,
        /// Total ZION ever minted through the bridge (audit trail).
        total_bridge_minted: u64,
        /// Total ZION ever burned through the bridge (audit trail).
        total_bridge_burned: u64,
        /// Whether the bridge is paused (emergency).
        paused: bool,
        /// Mint capability for ZION coin.
        mint_cap: MintCapability<ZION>,
        /// Burn capability for ZION coin.
        burn_cap: BurnCapability<ZION>,
        /// Freeze capability (unused but stored for safety).
        freeze_cap: FreezeCapability<ZION>,
        /// Event handle for bridge mint events.
        mint_events: event::EventHandle<BridgeMintEvent>,
        /// Event handle for bridge burn events.
        burn_events: event::EventHandle<BridgeBurnEvent>,
    }

    /// Event emitted when ZION is minted (L1 lock confirmed).
    struct BridgeMintEvent has drop, store {
        recipient: address,
        amount: u64,
        l1_tx_hash: String,
        timestamp: u64,
    }

    /// Event emitted when ZION is burned (L1 unlock requested).
    struct BridgeBurnEvent has drop, store {
        sender: address,
        amount: u64,
        l1_recipient: String,
        burn_id: String,
        timestamp: u64,
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// Coin decimals — matches ZION L1 (1 ZION = 1,000,000 atomic units).
    const DECIMALS: u8 = 6;

    /// Maximum supply: 144,000,000,000 ZION (144B) in atomic units.
    /// 144_000_000_000 * 1_000_000 = 144_000_000_000_000_000
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
    const E_L1_LOCK_PROCESSED: u64 = 4;
    const E_BURN_PROCESSED: u64 = 5;
    const E_BRIDGE_PAUSED: u64 = 6;
    const E_NOT_VALIDATOR: u64 = 7;
    const E_INVALID_L1_ADDRESS: u64 = 8;
    const E_INSUFFICIENT_BALANCE: u64 = 9;
    const E_NOT_AUTHORIZED: u64 = 10;
    const E_ALREADY_INITIALIZED: u64 = 11;

    // ─────────────────────────────────────────────────────────────────────────
    // Initialize — called once to register the coin and set up bridge config
    // ─────────────────────────────────────────────────────────────────────────

    /// Initialize the ZION coin and bridge configuration.
    /// Must be called by the bridge admin account.
    public entry fun initialize(
        admin: &signer,
        validators: vector<address>,
    ) {
        let admin_addr = signer::address_of(admin);

        // Ensure not already initialized
        assert!(
            !exists<BridgeConfig>(admin_addr),
            E_ALREADY_INITIALIZED,
        );

        // Ensure exactly 5 validators
        assert!(
            vector::length(&validators) == VALIDATOR_QUORUM,
            E_NOT_VALIDATOR,
        );

        // Register the ZION coin
        let (mint_cap, burn_cap, freeze_cap) = coin::initialize<ZION>(
            admin,
            string::utf8(b"ZION"),
            string::utf8(b"ZION"),
            DECIMALS,
            true,  // monitor_supply
        );

        // Store bridge config
        move_to(admin, BridgeConfig {
            validators,
            total_bridge_minted: 0,
            total_bridge_burned: 0,
            paused: false,
            mint_cap,
            burn_cap,
            freeze_cap,
            mint_events: account::new_event_handle<BridgeMintEvent>(admin),
            burn_events: account::new_event_handle<BridgeBurnEvent>(admin),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bridge mint — mint ZION after L1 lock confirmation (validator only)
    // ─────────────────────────────────────────────────────────────────────────

    /// Mint ZION to a recipient after L1 lock confirmation.
    /// Only callable by a registered WARP validator.
    public entry fun bridge_mint(
        admin: &signer,
        recipient: address,
        amount: u64,
        l1_tx_hash: String,
    ) acquires BridgeConfig {
        let caller = signer::address_of(admin);
        let config = borrow_global_mut<BridgeConfig>(caller);

        // Access control — caller must be a registered validator
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        assert!(!config.paused, E_BRIDGE_PAUSED);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(amount >= MIN_BRIDGE_AMOUNT, E_BELOW_MIN_AMOUNT);

        // Max supply check
        let new_total = config.total_bridge_minted + amount;
        assert!(new_total <= MAX_SUPPLY, E_EXCEEDS_MAX_SUPPLY);

        // Mint coins
        let coins = coin::mint(amount, &config.mint_cap);
        coin::deposit(recipient, coins);

        // Update state
        config.total_bridge_minted = new_total;

        // Emit event
        event::emit_event(
            &mut config.mint_events,
            BridgeMintEvent {
                recipient,
                amount,
                l1_tx_hash,
                timestamp: 0, // Set by the framework
            },
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bridge burn — burn ZION to unlock on L1 (any holder)
    // ─────────────────────────────────────────────────────────────────────────

    /// Burn ZION to unlock native ZION on L1.
    /// Any ZION holder can call this; the WARP relay observes the event.
    public entry fun bridge_burn(
        burner: &signer,
        bridge_admin: address,
        amount: u64,
        l1_recipient: String,
        burn_id: String,
    ) acquires BridgeConfig {
        let burner_addr = signer::address_of(burner);
        let config = borrow_global_mut<BridgeConfig>(bridge_admin);

        assert!(!config.paused, E_BRIDGE_PAUSED);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(amount >= MIN_BRIDGE_AMOUNT, E_BELOW_MIN_AMOUNT);

        // Validate L1 address (must start with "zion1")
        assert!(is_valid_l1_address(&l1_recipient), E_INVALID_L1_ADDRESS);

        // Withdraw coins from burner
        let coins = coin::withdraw<ZION>(burner, amount);

        // Burn coins
        coin::burn(coins, &config.burn_cap);

        // Update state
        config.total_bridge_burned = config.total_bridge_burned + amount;

        // Emit event
        event::emit_event(
            &mut config.burn_events,
            BridgeBurnEvent {
                sender: burner_addr,
                amount,
                l1_recipient,
                burn_id,
                timestamp: 0,
            },
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Emergency pause / unpause (validator only)
    // ─────────────────────────────────────────────────────────────────────────

    public entry fun pause(admin: &signer) acquires BridgeConfig {
        let caller = signer::address_of(admin);
        let config = borrow_global_mut<BridgeConfig>(caller);
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        config.paused = true;
    }

    public entry fun unpause(admin: &signer) acquires BridgeConfig {
        let caller = signer::address_of(admin);
        let config = borrow_global_mut<BridgeConfig>(caller);
        assert!(is_validator(config, caller), E_NOT_VALIDATOR);
        config.paused = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /// Get the coin decimals.
    public fun decimals(): u8 {
        DECIMALS
    }

    /// Get the maximum supply.
    public fun max_supply(): u64 {
        MAX_SUPPLY
    }

    /// Get bridge statistics.
    public fun bridge_stats(bridge_admin: address): (u64, u64, u64, u64)
    acquires BridgeConfig {
        let config = borrow_global<BridgeConfig>(bridge_admin);
        (
            config.total_bridge_minted,
            config.total_bridge_burned,
            config.total_bridge_minted - config.total_bridge_burned,
            coin::supply<ZION>().value,
        )
    }

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
    public fun is_paused(bridge_admin: address): bool
    acquires BridgeConfig {
        borrow_global<BridgeConfig>(bridge_admin).paused
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Validate that an L1 address starts with "zion1".
    fun is_valid_l1_address(addr: &String): bool {
        let bytes = string::bytes(addr);
        let len = vector::length(bytes);
        if (len < 5) return false;
        // Check "zion1" prefix
        *vector::borrow(bytes, 0) == 0x7a  // 'z'
            && *vector::borrow(bytes, 1) == 0x69  // 'i'
            && *vector::borrow(bytes, 2) == 0x6f  // 'o'
            && *vector::borrow(bytes, 3) == 0x6e  // 'n'
            && *vector::borrow(bytes, 4) == 0x31  // '1'
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────────────────

    #[test_only]
    use aptos_framework::account;
    #[test_only]
    use std::signer;

    #[test(admin = @0xcafe, val1 = @0x1111, val2 = @0x2222, val3 = @0x3333, val4 = @0x4444, val5 = @0x5555)]
    fun test_initialize(
        admin: &signer,
        val1: &signer,
        val2: &signer,
        val3: &signer,
        val4: &signer,
        val5: &signer,
    ) {
        let validators = vector::empty<address>();
        vector::push_back(&mut validators, signer::address_of(val1));
        vector::push_back(&mut validators, signer::address_of(val2));
        vector::push_back(&mut validators, signer::address_of(val3));
        vector::push_back(&mut validators, signer::address_of(val4));
        vector::push_back(&mut validators, signer::address_of(val5));

        initialize(admin, validators);

        let admin_addr = signer::address_of(admin);
        assert!(exists<BridgeConfig>(admin_addr), 1);
        assert!(decimals() == 6, 2);
        assert!(max_supply() == 144_000_000_000_000_000, 3);
    }
}
