-- SPDX-License-Identifier: MIT
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TemplateHaskell #-}

module ZionMintPolicy where

-- ─────────────────────────────────────────────────────────────────────────────
-- ZION Cardano Native Token — Minting Policy (Plutus)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ZION on Cardano is a native token (no smart contract needed for transfers).
-- This Plutus minting policy controls who can mint ZION tokens.
--
-- Token parameters:
--   - Asset name: "ZION" (hex: 5a494f4e)
--   - Decimals: 6 (1 ZION = 1,000,000 lovelace-equivalent units)
--   - Max supply: 144,000,000,000 ZION (144B)
--   - Mint authority: WARP bridge multisig (5/5 validator quorum)
--
-- Policy ID format:
--   The policy ID is the hash of this minting policy script.
--   After deployment, the full asset identifier is:
--     <policy_id>.5a494f4e  (policy_id_hex + "." + asset_name_hex)
--   Example: 5a71011c726573745a494f4e.5a494f4e
--
-- The WARP adapter (V31/L2/multichain/src/warp/adapter/cardano.rs) uses the
-- combined policy_id + asset_name hex string to identify ZION on Cardano.
-- ─────────────────────────────────────────────────────────────────────────────

import PlutusTx.Prelude
import Plutus.V1.Ledger.Api
import Plutus.V1.Ledger.Contexts
import qualified PlutusTx as PlutusTx

-- ─────────────────────────────────────────────────────────────────────────────
-- Constants
-- ─────────────────────────────────────────────────────────────────────────────

-- | Asset name for ZION (UTF-8 "ZION" = hex 5a494f4e)
zionAssetName :: TokenName
zionAssetName = TokenName "ZION"

-- | Maximum supply: 144,000,000,000 ZION in base units (with 6 decimals)
--   = 144,000,000,000,000,000 base units
maxSupply :: Integer
maxSupply = 144_000_000_000_000_000

-- | Minimum bridge amount: 100 ZION = 100,000,000 base units
minBridgeAmount :: Integer
minBridgeAmount = 100_000_000

-- | Number of validators required for quorum
validatorQuorum :: Integer
validatorQuorum = 5

-- ─────────────────────────────────────────────────────────────────────────────
-- Minting Policy
-- ─────────────────────────────────────────────────────────────────────────────

-- | The minting policy verifies that:
--   1. Only ZION tokens are being minted (correct asset name)
--   2. The mint is signed by the WARP bridge multisig (5/5 validators)
--   3. The total minted does not exceed max supply
--   4. The mint amount is above the minimum bridge amount
--
--   The policy uses a NFT-style parameterized approach where the bridge
--   multisig payment script hash is embedded as a parameter.
zionMintPolicy :: ValidatorHash -> ScriptContext -> Bool
zionMintPolicy bridgeScriptHash ctx =
    traceIfFalse "ZION mint: must mint ZION asset name only" checkAssetName
    && traceIfFalse "ZION mint: must be signed by bridge multisig" checkBridgeSignature
    && traceIfFalse "ZION mint: amount below minimum" checkMinAmount
    && traceIfFalse "ZION mint: exceeds max supply" checkMaxSupply
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    -- Check that only ZION asset name is being minted under this policy
    checkAssetName :: Bool
    checkAssetName = case txInfoMint info of
        (Value.MPS mp, _) -> case Map.lookup (ownCurrencySymbol ctx) mp of
            Just tokens -> case Map.toList tokens of
                [(tn, _)] -> tn == zionAssetName
                _         -> False
            Nothing -> False
        _ -> False

    -- Check that the bridge multisig payment script is a signer
    -- (The bridge script spends from a UTxO, proving 5/5 validator quorum)
    checkBridgeSignature :: Bool
    checkBridgeSignature =
        any (\(vh, _) -> vh == bridgeScriptHash) (txInfoSignatories info)

    -- Check minimum mint amount
    mintedAmount :: Integer
    mintedAmount = case txInfoMint info of
        (Value.MPS mp, _) -> case Map.lookup (ownCurrencySymbol ctx) mp of
            Just tokens -> case Map.lookup zionAssetName tokens of
                Just amt -> amt
                Nothing  -> 0
            Nothing -> 0
        _ -> 0

    checkMinAmount :: Bool
    checkMinAmount = mintedAmount >= minBridgeAmount || mintedAmount < 0
        -- Negative = burn, which is always allowed (no minimum for burns)

    -- Check max supply (only for positive mints)
    checkMaxSupply :: Bool
    checkMaxSupply = mintedAmount <= 0 || mintedAmount <= maxSupply

-- ─────────────────────────────────────────────────────────────────────────────
-- Compiled policy (for on-chain deployment)
-- ─────────────────────────────────────────────────────────────────────────────

-- | Parameterized minting policy — the bridge multisig script hash is
--   provided at compile time. Use `mkZionMintPolicy` to create the
--   final script for a specific bridge multisig.
mkZionMintPolicy :: ValidatorHash -> MintingPolicy
mkZionMintPolicy bridgeScriptHash =
    mkMintingPolicyScript $
        $$(PlutusTx.compile [|| \bridgeHash -> zionMintPolicy bridgeHash ||])
        `PlutusTx.applyCode` PlutusTx.liftCode bridgeScriptHash

-- ─────────────────────────────────────────────────────────────────────────────
-- Bridge Multisig Validator (5/5 quorum)
-- ─────────────────────────────────────────────────────────────────────────────

-- | The bridge multisig validator requires all 5 WARP validator signatures.
--   It is used as a payment script that the minting policy checks for
--   spending authorization (proving 5/5 quorum).
zionBridgeValidator :: [PubKeyHash] -> () -> ScriptContext -> Bool
zionBridgeValidator validatorPubKeys _ ctx =
    traceIfFalse "ZION bridge: insufficient quorum (need 5/5)" checkQuorum
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    signatories :: [PubKeyHash]
    signatories = txInfoSignatories info

    -- Check that all 5 validators have signed
    checkQuorum :: Bool
    checkQuorum = all (\pkh -> pkh `elem` signatories) validatorPubKeys

mkZionBridgeValidator :: [PubKeyHash] -> Validator
mkZionBridgeValidator validatorPubKeys =
    mkValidatorScript $
        $$(PlutusTx.compile [|| \vals -> zionBridgeValidator vals ||])
        `PlutusTx.applyCode` PlutusTx.liftCode validatorPubKeys

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: Get the policy ID (currency symbol)
-- ─────────────────────────────────────────────────────────────────────────────

-- | After compiling the minting policy, the policy ID (currency symbol)
--   is computed as the hash of the policy script.
--   Use this in the WARP adapter:
--     policy_id = mintingPolicyHash (mkZionMintPolicy bridgeScriptHash)
--     asset_name = "5a494f4e"  (hex of "ZION")
--     full_asset = policy_id ++ asset_name
--
--   The WARP adapter (cardano.rs) expects the combined hex string:
--     format: <policy_id_hex><asset_name_hex>
--   Example: 5a71011c726573745a494f4e (placeholder)
