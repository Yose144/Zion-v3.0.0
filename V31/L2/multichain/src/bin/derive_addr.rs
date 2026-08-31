//! Utility: derive the keyring Zion L1 address from a mnemonic passed via stdin.
use zion_l1_types::ChainId;
use zion_multichain::wallet::Keyring;

fn main() {
    let mut input = String::new();
    std::io::Read::read_to_string(&mut std::io::stdin(), &mut input).unwrap();
    for line in input.lines() {
        let m = line.trim();
        if m.is_empty() || m.starts_with('#') {
            continue;
        }
        match Keyring::from_mnemonic(m) {
            Ok(k) => {
                let addr = k.address(ChainId::ZionL1, 0, 0).unwrap();
                let pk = k.zion_public_key(0, 0).unwrap();
                let sk = k.zion_signing_key(0, 0).unwrap();
                println!(
                    "addr={} pk={} sk={}",
                    addr.encoded,
                    pk,
                    hex::encode(sk.to_bytes())
                );
            }
            Err(e) => eprintln!("ERROR: {} — {}", &m[..m.len().min(30)], e),
        }
    }
}
