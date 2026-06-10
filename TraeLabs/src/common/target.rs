//! Target utilities

/// Create an easy target for testing (all 0xFF)
pub fn easy_target() -> [u8; 32] {
    [0xFFu8; 32]
}

/// Create a hard target
pub fn hard_target() -> [u8; 32] {
    let mut t = [0x00u8; 32];
    t[0] = 0x00;
    t[1] = 0x00;
    t[2] = 0x0F;
    t
}
