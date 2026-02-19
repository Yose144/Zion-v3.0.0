use zion_core::crypto::keys::{is_valid_zion1_address, zion1_address_from_public_key_bytes};

#[test]
fn address_vector_pk_32x01() {
    let pk = [0x01u8; 32];
    let addr = zion1_address_from_public_key_bytes(&pk);
    assert_eq!(
        addr,
        "zion1d3d4g2n3533744w507v8v4g766h6u6z2w2w738t"
    );
    assert!(is_valid_zion1_address(&addr));
}
