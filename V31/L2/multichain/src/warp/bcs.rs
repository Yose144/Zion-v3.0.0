//! # BCS (Binary Canonical Serialization) Encoder
//!
//! Pure Rust BCS encoder for MoveVM chains (Aptos, Sui).
//! No external dependency — implements the BCS spec used by Diem/Aptos/Sui.
//!
//! ## BCS Rules
//! - Integers: little-endian, fixed-width (u8=1B, u16=2B, u32=4B, u64=8B, u128=16B)
//! - ULEB128: used for sequence lengths and enum variant indices
//! - Sequences (Vec, Vec<u8>): ULEB128(len) ++ elements
//! - Strings: ULEB128(len) ++ UTF-8 bytes
//! - Option<T>: 1 byte (0=None, 1=Some) ++ T
//! - Struct: fields in declaration order, no length prefix
//! - Enum: ULEB128(variant_index) ++ variant_data
//! - Bool: 1 byte (0=false, 1=true)
//! - Address (Aptos): 32 bytes fixed
//!
//! ## References
//! - https://github.com/aptos-labs/bcs
//! - https://docs.sui.io/concepts/cryptography/transactions

use crate::warp::error::{WarpError, WarpResult};

// ─────────────────────────────────────────────────────────────────────────────
// BCS Encoder
// ─────────────────────────────────────────────────────────────────────────────

/// A BCS encoder that writes into an internal byte buffer.
pub struct BcsEncoder {
    buf: Vec<u8>,
}

impl BcsEncoder {
    /// Create a new empty BCS encoder.
    pub fn new() -> Self {
        Self { buf: Vec::new() }
    }

    /// Create a BCS encoder with pre-allocated capacity.
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            buf: Vec::with_capacity(cap),
        }
    }

    /// Consume the encoder and return the raw BCS bytes.
    pub fn finish(self) -> Vec<u8> {
        self.buf
    }

    /// Drain the internal buffer and return the BCS bytes (non-consuming variant).
    pub fn take_bytes(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.buf)
    }

    /// Borrow the internal buffer without consuming.
    pub fn as_bytes(&self) -> &[u8] {
        &self.buf
    }

    // ── Primitive types ──────────────────────────────────────────────────────

    /// Encode a u8.
    pub fn u8(mut self, v: u8) -> Self {
        self.buf.push(v);
        self
    }

    /// Encode a bool (1 byte: 0 or 1).
    pub fn bool(mut self, v: bool) -> Self {
        self.buf.push(if v { 1 } else { 0 });
        self
    }

    /// Encode a u16 (little-endian, 2 bytes).
    pub fn u16(mut self, v: u16) -> Self {
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    /// Encode a u32 (little-endian, 4 bytes).
    pub fn u32(mut self, v: u32) -> Self {
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    /// Encode a u64 (little-endian, 8 bytes).
    pub fn u64(mut self, v: u64) -> Self {
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    /// Encode a u128 (little-endian, 16 bytes).
    pub fn u128(mut self, v: u128) -> Self {
        self.buf.extend_from_slice(&v.to_le_bytes());
        self
    }

    /// Encode a ULEB128 variable-length integer (used for lengths and enum indices).
    pub fn uleb128(mut self, mut v: u64) -> Self {
        loop {
            let mut byte = (v & 0x7f) as u8;
            v >>= 7;
            if v != 0 {
                byte |= 0x80;
            }
            self.buf.push(byte);
            if v == 0 {
                break;
            }
        }
        self
    }

    // ── Composite types (builder style, take self) ───────────────────────────

    /// Encode a sequence of bytes (Vec<u8>): ULEB128(len) ++ bytes.
    pub fn bytes(mut self, data: &[u8]) -> Self {
        self.uleb128_mut(data.len() as u64);
        self.buf.extend_from_slice(data);
        self
    }

    /// Encode a UTF-8 string: ULEB128(len) ++ UTF-8 bytes.
    pub fn string(self, s: &str) -> Self {
        self.bytes(s.as_bytes())
    }

    /// Encode a fixed-size 32-byte array (Aptos/Sui address).
    pub fn address_32(mut self, addr: &[u8; 32]) -> Self {
        self.buf.extend_from_slice(addr);
        self
    }

    // ── &mut self variants (for use inside closures) ─────────────────────────

    /// Encode a u8 (&mut self variant for closures).
    pub fn u8_mut(&mut self, v: u8) {
        self.buf.push(v);
    }

    /// Encode a u16 (&mut self variant for closures).
    pub fn u16_mut(&mut self, v: u16) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    /// Encode a u64 (&mut self variant for closures).
    pub fn u64_mut(&mut self, v: u64) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    /// Encode a u32 (&mut self variant for closures).
    pub fn u32_mut(&mut self, v: u32) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    /// Encode a ULEB128 (&mut self variant for closures).
    pub fn uleb128_mut(&mut self, mut v: u64) {
        loop {
            let mut byte = (v & 0x7f) as u8;
            v >>= 7;
            if v != 0 {
                byte |= 0x80;
            }
            self.buf.push(byte);
            if v == 0 {
                break;
            }
        }
    }

    /// Encode bytes (&mut self variant for closures).
    pub fn bytes_mut(&mut self, data: &[u8]) {
        self.uleb128_mut(data.len() as u64);
        self.buf.extend_from_slice(data);
    }

    /// Encode a string (&mut self variant for closures).
    pub fn string_mut(&mut self, s: &str) {
        self.bytes_mut(s.as_bytes());
    }

    /// Encode a 32-byte address (&mut self variant for closures).
    pub fn address_32_mut(&mut self, addr: &[u8; 32]) {
        self.buf.extend_from_slice(addr);
    }

    /// Raw append (&mut self variant for closures).
    pub fn raw_mut(&mut self, data: &[u8]) {
        self.buf.extend_from_slice(data);
    }

    /// Encode an Option<T>: 1 byte (0=None, 1=Some) ++ encoded T.
    /// The `some` closure encodes T into the encoder if present.
    pub fn option<F>(&mut self, value: Option<&F>, encode_fn: impl Fn(&mut Self, &F))
    where
        F: ?Sized,
    {
        match value {
            None => {
                self.buf.push(0);
            }
            Some(v) => {
                self.buf.push(1);
                encode_fn(self, v);
            }
        }
    }

    /// Encode a Vec<T>: ULEB128(len) ++ each element encoded by `encode_fn`.
    pub fn seq<T>(&mut self, items: &[T], encode_fn: impl Fn(&mut Self, &T)) {
        self.uleb128_mut(items.len() as u64);
        for item in items {
            encode_fn(self, item);
        }
    }

    /// Encode an enum variant: ULEB128(variant_index) ++ variant_data.
    /// The `encode_fn` encodes the variant-specific data.
    pub fn enum_variant(&mut self, index: u32, encode_fn: impl Fn(&mut Self)) {
        self.uleb128_mut(index as u64);
        encode_fn(self);
    }

    /// Raw append (for pre-encoded sub-structures).
    pub fn raw(mut self, data: &[u8]) -> Self {
        self.buf.extend_from_slice(data);
        self
    }
}

impl Default for BcsEncoder {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BCS Decoder (minimal — for parsing responses)
// ─────────────────────────────────────────────────────────────────────────────

/// A BCS decoder that reads from a byte slice.
pub struct BcsDecoder<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> BcsDecoder<'a> {
    /// Create a decoder from a byte slice.
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    /// Current position in the buffer.
    pub fn position(&self) -> usize {
        self.pos
    }

    /// Remaining bytes.
    pub fn remaining(&self) -> usize {
        self.data.len() - self.pos
    }

    /// Read a u8.
    pub fn u8(&mut self) -> WarpResult<u8> {
        if self.pos >= self.data.len() {
            return Err(WarpError::AdapterError {
                chain: "bcs".into(),
                reason: "unexpected end of buffer reading u8".into(),
            });
        }
        let v = self.data[self.pos];
        self.pos += 1;
        Ok(v)
    }

    /// Read a bool.
    pub fn bool(&mut self) -> WarpResult<bool> {
        Ok(self.u8()? != 0)
    }

    /// Read a u16 (little-endian).
    pub fn u16(&mut self) -> WarpResult<u16> {
        let bytes = self.take_bytes(2)?;
        Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
    }

    /// Read a u32 (little-endian).
    pub fn u32(&mut self) -> WarpResult<u32> {
        let bytes = self.take_bytes(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    /// Read a u64 (little-endian).
    pub fn u64(&mut self) -> WarpResult<u64> {
        let bytes = self.take_bytes(8)?;
        let mut arr = [0u8; 8];
        arr.copy_from_slice(bytes);
        Ok(u64::from_le_bytes(arr))
    }

    /// Read a u128 (little-endian).
    pub fn u128(&mut self) -> WarpResult<u128> {
        let bytes = self.take_bytes(16)?;
        let mut arr = [0u8; 16];
        arr.copy_from_slice(bytes);
        Ok(u128::from_le_bytes(arr))
    }

    /// Read a ULEB128 variable-length integer.
    pub fn uleb128(&mut self) -> WarpResult<u64> {
        let mut result: u64 = 0;
        let mut shift = 0;
        loop {
            let byte = self.u8()?;
            result |= ((byte & 0x7f) as u64) << shift;
            if byte & 0x80 == 0 {
                break;
            }
            shift += 7;
            if shift >= 64 {
                return Err(WarpError::AdapterError {
                    chain: "bcs".into(),
                    reason: "ULEB128 overflow".into(),
                });
            }
        }
        Ok(result)
    }

    /// Read a sequence of bytes (Vec<u8>): ULEB128(len) ++ bytes.
    pub fn bytes(&mut self) -> WarpResult<Vec<u8>> {
        let len = self.uleb128()? as usize;
        self.take_bytes(len).map(|b| b.to_vec())
    }

    /// Read a UTF-8 string.
    pub fn string(&mut self) -> WarpResult<String> {
        let bytes = self.bytes()?;
        String::from_utf8(bytes).map_err(|e| WarpError::AdapterError {
            chain: "bcs".into(),
            reason: format!("invalid UTF-8 in BCS string: {}", e),
        })
    }

    /// Read a fixed 32-byte array (address).
    pub fn address_32(&mut self) -> WarpResult<[u8; 32]> {
        let bytes = self.take_bytes(32)?;
        let mut arr = [0u8; 32];
        arr.copy_from_slice(bytes);
        Ok(arr)
    }

    /// Take exactly `n` bytes from the buffer, advancing the position.
    fn take_bytes(&mut self, n: usize) -> WarpResult<&'a [u8]> {
        if self.pos + n > self.data.len() {
            return Err(WarpError::AdapterError {
                chain: "bcs".into(),
                reason: format!(
                    "unexpected end of buffer: need {} bytes at pos {}, have {}",
                    n,
                    self.pos,
                    self.data.len()
                ),
            });
        }
        let result = &self.data[self.pos..self.pos + n];
        self.pos += n;
        Ok(result)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: encode a single value
// ─────────────────────────────────────────────────────────────────────────────

/// Encode a u64 as BCS.
pub fn encode_u64(v: u64) -> Vec<u8> {
    BcsEncoder::new().u64(v).finish()
}

/// Encode a sequence of bytes as BCS (Vec<u8>).
pub fn encode_bytes(data: &[u8]) -> Vec<u8> {
    BcsEncoder::new().bytes(data).finish()
}

/// Encode a string as BCS.
pub fn encode_string(s: &str) -> Vec<u8> {
    BcsEncoder::new().string(s).finish()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_u8() {
        let enc = BcsEncoder::new().u8(0x42).finish();
        assert_eq!(enc, vec![0x42]);
    }

    #[test]
    fn test_encode_u16_le() {
        let enc = BcsEncoder::new().u16(0x1234).finish();
        assert_eq!(enc, vec![0x34, 0x12]);
    }

    #[test]
    fn test_encode_u32_le() {
        let enc = BcsEncoder::new().u32(0x12345678).finish();
        assert_eq!(enc, vec![0x78, 0x56, 0x34, 0x12]);
    }

    #[test]
    fn test_encode_u64_le() {
        let enc = BcsEncoder::new().u64(0x0123456789abcdef).finish();
        assert_eq!(enc, vec![0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01]);
    }

    #[test]
    fn test_encode_u128_le() {
        let enc = BcsEncoder::new()
            .u128(0x0123456789abcdef0123456789abcdef)
            .finish();
        assert_eq!(enc.len(), 16);
        assert_eq!(enc[0], 0xef);
        assert_eq!(enc[15], 0x01);
    }

    #[test]
    fn test_encode_uleb128_small() {
        // 0 → [0x00]
        assert_eq!(BcsEncoder::new().uleb128(0).finish(), vec![0x00]);
        // 1 → [0x01]
        assert_eq!(BcsEncoder::new().uleb128(1).finish(), vec![0x01]);
        // 127 → [0x7f]
        assert_eq!(BcsEncoder::new().uleb128(127).finish(), vec![0x7f]);
    }

    #[test]
    fn test_encode_uleb128_medium() {
        // 128 → [0x80, 0x01]
        assert_eq!(BcsEncoder::new().uleb128(128).finish(), vec![0x80, 0x01]);
        // 255 → [0xff, 0x01]
        assert_eq!(BcsEncoder::new().uleb128(255).finish(), vec![0xff, 0x01]);
        // 300 → [0xac, 0x02]
        assert_eq!(BcsEncoder::new().uleb128(300).finish(), vec![0xac, 0x02]);
    }

    #[test]
    fn test_encode_uleb128_large() {
        // 16384 → [0x80, 0x80, 0x01]
        assert_eq!(
            BcsEncoder::new().uleb128(16384).finish(),
            vec![0x80, 0x80, 0x01]
        );
    }

    #[test]
    fn test_encode_bytes_empty() {
        let enc = BcsEncoder::new().bytes(&[]).finish();
        assert_eq!(enc, vec![0x00]); // ULEB128(0)
    }

    #[test]
    fn test_encode_bytes_short() {
        let enc = BcsEncoder::new().bytes(&[0xde, 0xad, 0xbe, 0xef]).finish();
        assert_eq!(enc, vec![0x04, 0xde, 0xad, 0xbe, 0xef]);
    }

    #[test]
    fn test_encode_string() {
        let enc = BcsEncoder::new().string("hello").finish();
        assert_eq!(enc, vec![0x05, b'h', b'e', b'l', b'l', b'o']);
    }

    #[test]
    fn test_encode_address_32() {
        let addr = [0xaa; 32];
        let enc = BcsEncoder::new().address_32(&addr).finish();
        assert_eq!(enc.len(), 32);
        assert_eq!(enc[0], 0xaa);
        assert_eq!(enc[31], 0xaa);
    }

    #[test]
    fn test_encode_bool() {
        assert_eq!(BcsEncoder::new().bool(false).finish(), vec![0x00]);
        assert_eq!(BcsEncoder::new().bool(true).finish(), vec![0x01]);
    }

    #[test]
    fn test_encode_option_none() {
        let mut enc = BcsEncoder::new();
        enc.option::<u8>(None, |e, v| {
            e.u8_mut(*v);
        });
        assert_eq!(enc.take_bytes(), vec![0x00]);
    }

    #[test]
    fn test_encode_option_some() {
        let val = 42u8;
        let mut enc = BcsEncoder::new();
        enc.option(Some(&val), |e, v| {
            e.u8_mut(*v);
        });
        assert_eq!(enc.take_bytes(), vec![0x01, 42]);
    }

    #[test]
    fn test_encode_seq_u64() {
        let items = vec![1u64, 2u64, 3u64];
        let mut enc = BcsEncoder::new();
        enc.seq(&items, |e, v| {
            e.u64_mut(*v);
        });
        let result = enc.take_bytes();
        // ULEB128(3) + 3 * 8 bytes LE
        assert_eq!(result[0], 3); // length
        assert_eq!(result.len(), 1 + 24);
        // First u64 = 1 → LE
        assert_eq!(&result[1..9], &[1, 0, 0, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn test_encode_enum_variant() {
        let mut enc = BcsEncoder::new();
        enc.enum_variant(2, |e| {
            e.u64_mut(99);
        });
        let result = enc.take_bytes();
        // ULEB128(2) + u64(99) LE
        assert_eq!(result[0], 2);
        assert_eq!(&result[1..9], &[99, 0, 0, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn test_encode_chained() {
        let enc = BcsEncoder::new()
            .u8(1)
            .u32(0x12345678)
            .string("abc")
            .u64(42)
            .finish();
        // u8(1) + u32 LE + string(3, "abc") + u64 LE
        assert_eq!(enc[0], 1);
        assert_eq!(&enc[1..5], &[0x78, 0x56, 0x34, 0x12]);
        assert_eq!(enc[5], 3); // string length
        assert_eq!(&enc[6..9], b"abc");
        assert_eq!(&enc[9..17], &[42, 0, 0, 0, 0, 0, 0, 0]);
    }

    // ── Decoder tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_decode_u8() {
        let mut dec = BcsDecoder::new(&[0x42]);
        assert_eq!(dec.u8().unwrap(), 0x42);
    }

    #[test]
    fn test_decode_u64_le() {
        let data = vec![0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01];
        let mut dec = BcsDecoder::new(&data);
        assert_eq!(dec.u64().unwrap(), 0x0123456789abcdef);
    }

    #[test]
    fn test_decode_uleb128() {
        // 300 → [0xac, 0x02]
        let mut dec = BcsDecoder::new(&[0xac, 0x02]);
        assert_eq!(dec.uleb128().unwrap(), 300);
    }

    #[test]
    fn test_decode_bytes() {
        let data = vec![0x04, 0xde, 0xad, 0xbe, 0xef];
        let mut dec = BcsDecoder::new(&data);
        let result = dec.bytes().unwrap();
        assert_eq!(result, vec![0xde, 0xad, 0xbe, 0xef]);
    }

    #[test]
    fn test_decode_string() {
        let data = vec![0x05, b'h', b'e', b'l', b'l', b'o'];
        let mut dec = BcsDecoder::new(&data);
        assert_eq!(dec.string().unwrap(), "hello");
    }

    #[test]
    fn test_decode_address_32() {
        let data = vec![0xaa; 32];
        let mut dec = BcsDecoder::new(&data);
        let addr = dec.address_32().unwrap();
        assert_eq!(addr, [0xaa; 32]);
    }

    #[test]
    fn test_decode_overflow() {
        let mut dec =
            BcsDecoder::new(&[0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]);
        // This is a valid but huge ULEB128
        let _ = dec.uleb128();
    }

    #[test]
    fn test_decode_eof_error() {
        let mut dec = BcsDecoder::new(&[0x01]);
        assert!(dec.u16().is_err()); // needs 2 bytes, only 1 available
    }

    #[test]
    fn test_roundtrip_u64() {
        let original: u64 = 0xdeadbeefcafebabe;
        let encoded = encode_u64(original);
        let mut dec = BcsDecoder::new(&encoded);
        assert_eq!(dec.u64().unwrap(), original);
    }

    #[test]
    fn test_roundtrip_bytes() {
        let original = vec![1, 2, 3, 4, 5];
        let encoded = encode_bytes(&original);
        let mut dec = BcsDecoder::new(&encoded);
        assert_eq!(dec.bytes().unwrap(), original);
    }

    #[test]
    fn test_roundtrip_string() {
        let original = "WARP bridge test 🚀";
        let encoded = encode_string(original);
        let mut dec = BcsDecoder::new(&encoded);
        assert_eq!(dec.string().unwrap(), original);
    }

    #[test]
    fn test_encode_bool_true_false() {
        let enc = BcsEncoder::new().bool(true).bool(false).bool(true).finish();
        assert_eq!(enc, vec![1, 0, 1]);
    }

    #[test]
    fn test_encode_seq_empty() {
        let items: Vec<u64> = vec![];
        let mut enc = BcsEncoder::new();
        enc.seq(&items, |e, v| {
            e.u64_mut(*v);
        });
        assert_eq!(enc.take_bytes(), vec![0x00]); // ULEB128(0)
    }
}
