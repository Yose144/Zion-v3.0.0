use zion_multichain::wallet::Keyring;

fn main() {
    let phrase = std::env::var("WARP_MNEMONIC").expect("set WARP_MNEMONIC");
    let keyring = Keyring::from_mnemonic(&phrase).expect("invalid mnemonic");
    let sk = keyring.zion_signing_key(0, 0).unwrap();
    let pk = sk.verifying_key().to_bytes();
    let addr = zion_core::crypto::derive_address(&pk);
    println!("mnemonic: {phrase}");
    println!("secret_key: {}", hex::encode(sk.to_bytes()));
    println!("public_key: {}", hex::encode(pk));
    println!("address: {addr}");
}
