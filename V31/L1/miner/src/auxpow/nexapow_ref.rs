//! NexaPow (NEXA) CPU reference — 1:1 port of the `nexapow_mine` kernel
//! semantics (spec: https://spec.nexa.org/mining/NexaPOW/):
//!
//!   1. miningHash = sha256(sha256(candidate_hash(32B) || nonce_le(8B)))
//!   2. h1         = sha256(miningHash)
//!   3. priv       = miningHash as secp256k1 scalar (fail if zero / >= n —
//!      the kernel uses `scalar_from_bytes_impl` which reduces; matching
//!      behaviour: reject zero, reduce mod n otherwise)
//!   4. sig        = BIP-340 Schnorr sign(h1, priv, aux_rand = 32 zeros)
//!   5. powhash    = sha256(sig_r32 || sig_s32)
//!
//! Returns `Some(powhash)` when the nonce produces a valid signature.

use k256::schnorr::SigningKey;
use k256::SecretKey;
use sha2::{Digest, Sha256};

fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

/// Full NexaPow hash for `(candidate_hash, nonce)`.
/// `None` when miningHash is not a valid secret key.
pub fn nexapow_hash_ref(candidate_hash: &[u8; 32], nonce: u64) -> Option<[u8; 32]> {
    let mut input = [0u8; 40];
    input[..32].copy_from_slice(candidate_hash);
    input[32..].copy_from_slice(&nonce.to_le_bytes());
    let mining_hash = sha256(&sha256(&input));
    let h1 = sha256(&mining_hash);

    // Kernel: scalar_from_bytes_impl(miningHash) — BE bytes → scalar with a
    // single conditional subtraction of n (inputs < 2^256 < 2n, so one
    // subtraction suffices). k256's SecretKey::from_slice *rejects* values
    // >= n, so reduce first to match the kernel exactly.
    // secp256k1 group order n =
    // FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364141
    const ORDER_N: [u8; 32] = [
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFE, 0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B, 0xBF, 0xD2, 0x5E, 0x8C, 0xD0, 0x36,
        0x41, 0x41,
    ];
    let mut priv_bytes = mining_hash;
    if priv_bytes >= ORDER_N {
        // subtract ORDER_N (big-endian)
        let mut borrow = 0i16;
        for i in (0..32).rev() {
            let d = priv_bytes[i] as i16 - ORDER_N[i] as i16 - borrow;
            if d < 0 {
                priv_bytes[i] = (d + 256) as u8;
                borrow = 1;
            } else {
                priv_bytes[i] = d as u8;
                borrow = 0;
            }
        }
    }
    if priv_bytes.iter().all(|&b| b == 0) {
        return None;
    }
    let sk = SecretKey::from_slice(&priv_bytes).ok()?;

    let signing_key = SigningKey::from(&sk);
    // BIP-340 with aux_rand = 32 zero bytes — identical construction to the
    // kernel's schnorr_sign_impl (t = d ^ taghash("BIP0340/aux", zeros),
    // rand = taghash("BIP0340/nonce", t || px || msg), …).
    let sig: k256::schnorr::Signature = signing_key
        .sign_raw(&h1, &[0u8; 32])
        .expect("schnorr sign");
    Some(sha256(&sig.to_bytes()))
}
// bip340 smoke
// quick check: k256 sign_raw vs official BIP-340 vector 0
#[test]
fn bip340_vector0() {
    use k256::SecretKey;
    use k256::schnorr::SigningKey;
    let sk_bytes = hex::decode("0000000000000000000000000000000000000000000000000000000000000003").unwrap();
    let msg = hex::decode("0000000000000000000000000000000000000000000000000000000000000000").unwrap();
    let aux = [0u8; 32];
    let sk = SecretKey::from_slice(&sk_bytes).unwrap();
    let signing_key = SigningKey::from(&sk);
    let sig = signing_key.sign_raw(&msg, &aux).unwrap();
    let expected = "E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0";
    assert_eq!(hex::encode(sig.to_bytes()), expected.to_lowercase());
}

#[cfg(test)]
mod tests {
    use super::*;
    use k256::schnorr::SigningKey;
    use k256::SecretKey;

    // Official BIP-340 test vector index 0.
    #[test]
    fn bip340_official_vector0() {
        let sk_bytes = hex::decode(
            "0000000000000000000000000000000000000000000000000000000000000003",
        )
        .unwrap();
        let msg = hex::decode(
            "0000000000000000000000000000000000000000000000000000000000000000",
        )
        .unwrap();
        let aux = [0u8; 32];
        let sk = SecretKey::from_slice(&sk_bytes).unwrap();
        let signing_key = SigningKey::from(&sk);
        let sig = signing_key.sign_raw(&msg, &aux).unwrap();
        assert_eq!(
            hex::encode(sig.to_bytes()),
            "e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca821525f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0"
        );
    }

    // And the full nexapow pipeline on a fixed input (consistency snapshot).
    #[test]
    fn nexapow_ref_deterministic() {
        let cand = [0x11u8; 32];
        let h1 = nexapow_hash_ref(&cand, 0).unwrap();
        let h2 = nexapow_hash_ref(&cand, 0).unwrap();
        assert_eq!(h1, h2);
    }
}
