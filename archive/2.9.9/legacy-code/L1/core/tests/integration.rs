#[test]
fn hash_works() {
    let h = zion_core::crypto::hash::blake(&[1,2,3]);
    assert_eq!(h.len(), 32);
}

