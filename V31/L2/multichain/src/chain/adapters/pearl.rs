//! Pearl Network (PRL) chain adapter — btcd-fork UTXO chain.
//!
//! Addresses are bech32m segwit-style with the `prl` HRP. The oyster wallet
//! derives BIP86 key-only P2TR outputs at `m/86'/808276'/{account}'/{branch}/{index}`
//! (HDCoinTypePearl = 808276, `KeyScopeBIP0086` with `TaprootPubKey`), so a
//! ZION mnemonic maps 1:1 onto an oyster-compatible `prl1p…` address.
//!
//! Node RPC is btcd-flavoured (`validateaddress`, `searchrawtransactions`,
//! `gettxout`, `sendrawtransaction`) — this module covers the local side:
//! derivation (via `Keyring`) and address encode/validate. Online balance /
//! history is served server-side by the website `/api/prl` route, which has
//! the RPC credentials.

use bitcoin::secp256k1::{Secp256k1, XOnlyPublicKey};
use zion_l1_types::{Address, ChainId};

use crate::error::{MultichainError, MultichainResult};

/// BIP-44 coin type registered for Pearl mainnet (chaincfg `HDCoinTypePearl`).
pub const PEARL_HD_COIN_TYPE: u32 = 808276;
/// Bech32m human-readable part for Pearl mainnet segwit addresses.
pub const PEARL_BECH32_HRP: &str = "prl";

const BECH32_CHARSET: &[u8; 32] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32M_CONST: u32 = 0x2bc830a3;
const BECH32_CONST: u32 = 1;

fn bech32_polymod(values: &[u8]) -> u32 {
    let gen: [u32; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let mut chk: u32 = 1;
    for &v in values {
        let top = chk >> 25;
        chk = (chk & 0x1ffffff) << 5 ^ (v as u32);
        for (i, g) in gen.iter().enumerate() {
            if (top >> i) & 1 == 1 {
                chk ^= g;
            }
        }
    }
    chk
}

fn bech32_hrp_expand(hrp: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(hrp.len() * 2 + 1);
    for c in hrp.bytes() {
        out.push(c >> 5);
    }
    out.push(0);
    for c in hrp.bytes() {
        out.push(c & 0x1f);
    }
    out
}

fn bech32_checksum(hrp: &str, data: &[u8], spec_const: u32) -> Vec<u8> {
    let mut values = bech32_hrp_expand(hrp);
    values.extend_from_slice(data);
    values.extend_from_slice(&[0; 6]);
    let polymod = bech32_polymod(&values) ^ spec_const;
    (0..6).map(|i| ((polymod >> (5 * (5 - i))) & 0x1f) as u8).collect()
}

fn bech32_verify_checksum(hrp: &str, data: &[u8]) -> Option<u32> {
    let mut values = bech32_hrp_expand(hrp);
    values.extend_from_slice(data);
    match bech32_polymod(&values) {
        BECH32_CONST => Some(BECH32_CONST),
        BECH32M_CONST => Some(BECH32M_CONST),
        _ => None,
    }
}

/// 8→5 bit conversion for segwit programs (BIP173 `convertbits`).
fn convert_bits_8to5(data: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(data.len() * 8 / 5 + 1);
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for &b in data {
        acc = (acc << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(((acc >> bits) & 0x1f) as u8);
        }
    }
    if bits > 0 {
        out.push(((acc << (5 - bits)) & 0x1f) as u8);
    }
    Some(out)
}

/// 5→8 bit conversion (strict — rejects non-zero padding), BIP173 decode side.
fn convert_bits_5to8(data: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(data.len() * 5 / 8);
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    for &b in data {
        if b > 31 {
            return None;
        }
        acc = (acc << 5) | b as u32;
        bits += 5;
        while bits >= 8 {
            bits -= 8;
            out.push(((acc >> bits) & 0xff) as u8);
        }
    }
    if bits >= 5 || ((acc << (8 - bits)) & 0xff) != 0 {
        return None;
    }
    Some(out)
}

fn bech32_encode(hrp: &str, version: u8, program: &[u8], spec_const: u32) -> String {
    let mut data = Vec::with_capacity(1 + program.len() * 8 / 5 + 6);
    data.push(version); // witness version as first 5-bit value (0 → 'q', 1 → 'p')
    data.extend(convert_bits_8to5(program).expect("8to5 convert"));
    let checksum = bech32_checksum(hrp, &data, spec_const);
    let mut out = String::with_capacity(hrp.len() + 1 + data.len() + 6);
    out.push_str(hrp);
    out.push('1');
    for &d in data.iter().chain(checksum.iter()) {
        out.push(BECH32_CHARSET[d as usize] as char);
    }
    out
}

/// Decode a segwit address into `(hrp, version, program, spec_const)`.
fn segwit_decode(addr: &str) -> MultichainResult<(String, u8, Vec<u8>, u32)> {
    let addr = addr.trim();
    if addr.is_empty() || addr.len() > 90 || addr.bytes().any(|b| !(33..=126).contains(&b)) {
        return Err(MultichainError::Unsupported("invalid address charset".into()));
    }
    let lower = addr.to_ascii_lowercase();
    if addr.chars().any(|c| c.is_ascii_uppercase()) && lower != addr {
        return Err(MultichainError::Unsupported("mixed-case address".into()));
    }
    let sep = lower
        .rfind('1')
        .ok_or_else(|| MultichainError::Unsupported("missing bech32 separator".into()))?;
    if sep == 0 || sep + 7 > lower.len() {
        return Err(MultichainError::Unsupported("bech32 layout".into()));
    }
    let hrp = &lower[..sep];
    let data: Vec<u8> = lower[sep + 1..]
        .bytes()
        .map(|c| {
            BECH32_CHARSET
                .iter()
                .position(|&x| x == c)
                .map(|p| p as u8)
                .ok_or_else(|| MultichainError::Unsupported("bech32 charset".into()))
        })
        .collect::<Result<_, _>>()?;
    let spec = bech32_verify_checksum(hrp, &data)
        .ok_or_else(|| MultichainError::Unsupported("bech32 checksum".into()))?;
    if data.len() < 7 {
        return Err(MultichainError::Unsupported("bech32 data too short".into()));
    }
    let version = data[0];
    if version > 16 {
        return Err(MultichainError::Unsupported("witness version > 16".into()));
    }
    let program = convert_bits_5to8(&data[1..data.len() - 6])
        .ok_or_else(|| MultichainError::Unsupported("bech32 padding".into()))?;
    if program.len() < 2 || program.len() > 40 {
        return Err(MultichainError::Unsupported("witness program length".into()));
    }
    if version == 0 && !(program.len() == 20 || program.len() == 32) {
        return Err(MultichainError::Unsupported("v0 program length".into()));
    }
    // v0 must be bech32; v1+ must be bech32m (BIP350).
    if (version == 0) != (spec == BECH32_CONST) {
        return Err(MultichainError::Unsupported("bech32/bech32m mismatch".into()));
    }
    Ok((hrp.to_string(), version, program, spec))
}

/// Encode a 32-byte taproot output key as a Pearl `prl1p…` address.
pub fn pearl_encode_p2tr(output_key: &[u8; 32]) -> String {
    bech32_encode(PEARL_BECH32_HRP, 1, output_key, BECH32M_CONST)
}

/// True iff `addr` is a well-formed Pearl mainnet segwit address
/// (`prl` HRP, bech32m for v1+, bech32 for v0, sane program length).
pub fn is_valid_pearl_address(addr: &str) -> bool {
    match segwit_decode(addr) {
        Ok((hrp, _v, _prog, _spec)) => hrp == PEARL_BECH32_HRP,
        Err(_) => false,
    }
}

/// Build a `ChainId::Pearl` address from a tweaked taproot output key.
pub fn pearl_address_from_key(output_key: &[u8; 32]) -> MultichainResult<Address> {
    let encoded = pearl_encode_p2tr(output_key);
    // script_pubkey form: OP_1 <32B> — the canonical UTXO byte form.
    let mut bytes = Vec::with_capacity(34);
    bytes.push(0x51);
    bytes.push(0x20);
    bytes.extend_from_slice(output_key);
    Address::new(ChainId::Pearl, bytes, encoded).map_err(|e| MultichainError::Internal(e.to_string()))
}

/// BIP86 key-tweak: compute the P2TR output key for an internal x-only key.
/// Uses `bitcoin::Address::p2tr` for the BIP341 tweak math, then extracts
/// the 32-byte witness program (the tweaked output key) from the script.
pub fn pearl_taproot_output_key(internal: &XOnlyPublicKey) -> [u8; 32] {
    let secp = Secp256k1::new();
    let internal = bitcoin::key::XOnlyPublicKey::from(*internal);
    let addr = bitcoin::Address::p2tr(&secp, internal, None, bitcoin::Network::Bitcoin);
    let script = addr.script_pubkey();
    // P2TR scriptPubKey = OP_1 (0x51) <0x20> <32-byte output key>.
    let bytes = script.as_bytes();
    assert!(bytes.len() == 34 && bytes[0] == 0x51 && bytes[1] == 0x20);
    bytes[2..34].try_into().expect("p2tr program is 32 bytes")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Oyster parity KAT — the first three external addresses oyster emits
    /// for the test mnemonic (captured live from `getnewaddress` on Edge,
    /// wallet created via `--createfromfile` with the same BIP39 phrase).
    /// Pins both the BIP86 path (`m/86'/808276'/0'/0/i`) and our bech32m
    /// encoding against the real wallet implementation.
    #[test]
    fn keyring_matches_oyster_vectors() {
        let mnemonic =
            "fire evolve buddy tenant talent favorite ankle stem regret myth dream fresh";
        let kr = crate::wallet::Keyring::from_mnemonic(mnemonic).unwrap();
        let expected = [
            "prl1p29st0fecym0gk9zyh8ch90sxkf6apmwqdznk0tvu6kf5wxwsmqxqqzwjdm",
            "prl1p6anjsws5ejhqdzavavcpmrchkstj32azfv0pdg5rrnlxd794mzqsgz7yeh",
            "prl1ps39f58yuh5fdgs66wc9r5h8vr9nw9hvgles4kjhz9m0mghyjwmqqca3cc0",
        ];
        for (i, want) in expected.iter().enumerate() {
            let got = kr.address(ChainId::Pearl, 0, i as u32).unwrap();
            assert_eq!(&got.encoded, want, "oyster parity at index {i}");
        }
    }

    /// Round-trip: encode a program, decode it, expect identical bytes and
    /// the `prl` HRP. Also exercises the checksum path both ways.
    #[test]
    fn pearl_p2tr_roundtrip() {
        let key = [0xabu8; 32];
        let addr = pearl_encode_p2tr(&key);
        assert!(addr.starts_with("prl1p"), "taproot addr: {addr}");
        let (hrp, v, prog, _spec) = segwit_decode(&addr).unwrap();
        assert_eq!(hrp, "prl");
        assert_eq!(v, 1);
        assert_eq!(prog, key.to_vec());
        assert!(is_valid_pearl_address(&addr));
    }

    /// The production pool wallet (generated by oyster) must decode as a
    /// valid prl bech32m taproot address — this anchors our codec against a
    /// real oyster-emitted string.
    #[test]
    fn decodes_oyster_pool_wallet() {
        let addr = "prl1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5m";
        assert!(is_valid_pearl_address(addr), "pool wallet must validate");
        let (hrp, v, prog, _spec) = segwit_decode(addr).unwrap();
        assert_eq!((hrp.as_str(), v, prog.len()), ("prl", 1, 32));
    }

    #[test]
    fn rejects_wrong_hrp_and_corrupt() {
        assert!(!is_valid_pearl_address("bc1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5m"));
        assert!(!is_valid_pearl_address("prl1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5x"));
        assert!(!is_valid_pearl_address(""));
        assert!(!is_valid_pearl_address("qz5abc"));
    }
}
