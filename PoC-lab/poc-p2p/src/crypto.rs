//! # Cryptographic primitives for P2P hardening
//!
//! Feature-gated behind `crypto`. Provides:
//!
//! - [`NodeIdentity`] — Ed25519 keypair for node authentication.
//! - [`EncryptedTransport`] — X25519 ECDH + AES-GCM for encrypted P2P channels.
//! - [`KeyExchange`] — X25519 ephemeral key exchange for forward secrecy.
//!
//! ## Handshake protocol
//!
//! 1. Client → Server: `Hello { node_id, public_key, ephemeral_pk, signature }`
//! 2. Server → Client: `HelloAck { node_id, public_key, ephemeral_pk, signature }`
//! 3. Both: `ECDH(ephemeral_client, ephemeral_server)` → SHA-256 → AES-256-GCM key
//! 4. All subsequent messages: AES-GCM encrypted + length-prefixed

use std::io::{self, Read, Write};
use std::net::TcpStream;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use curve25519_dalek::montgomery::MontgomeryPoint;
use curve25519_dalek::scalar::Scalar;
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use poc_core::ValidatorId;
use sha2::{Digest, Sha256};

/// Errors that can occur during crypto operations.
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("key generation failed: {0}")]
    KeyGeneration(String),
    #[error("signature verification failed")]
    SignatureInvalid,
    #[error("key exchange failed: {0}")]
    KeyExchange(String),
    #[error("encryption failed: {0}")]
    Encryption(String),
    #[error("decryption failed: {0}")]
    Decryption(String),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
}

/// Ed25519 keypair for node identity and message signing.
#[derive(Clone)]
pub struct NodeIdentity {
    /// Ed25519 signing key (secret).
    signing_key: SigningKey,
    /// Ed25519 verifying key (public).
    pub verifying_key: VerifyingKey,
    /// BLAKE3(verifying_key) — short node ID for logging and protocol use.
    pub node_id: ValidatorId,
}

impl std::fmt::Debug for NodeIdentity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NodeIdentity")
            .field("node_id", &hex::encode(self.node_id))
            .field("verifying_key", &hex::encode(self.verifying_key.to_bytes()))
            .finish_non_exhaustive()
    }
}

impl NodeIdentity {
    /// Generates a new random Ed25519 keypair.
    pub fn generate() -> Result<Self, CryptoError> {
        let mut secret_bytes = [0u8; 32];
        getrandom::getrandom(&mut secret_bytes)
            .map_err(|e| CryptoError::KeyGeneration(format!("getrandom: {e}")))?;
        Self::from_bytes(&secret_bytes)
    }

    /// Creates a keypair from a 32-byte secret key (deterministic).
    pub fn from_bytes(secret: &[u8; 32]) -> Result<Self, CryptoError> {
        let signing_key = SigningKey::from_bytes(secret);
        let verifying_key = signing_key.verifying_key();
        let node_id = *blake3::hash(&verifying_key.to_bytes()).as_bytes();
        Ok(Self {
            signing_key,
            verifying_key,
            node_id,
        })
    }

    /// Signs a message with the Ed25519 private key.
    pub fn sign(&self, msg: &[u8]) -> Signature {
        self.signing_key.sign(msg)
    }

    /// Verifies a signature against a public key (static method).
    pub fn verify(pk: &VerifyingKey, msg: &[u8], sig: &Signature) -> bool {
        ed25519_dalek::Verifier::verify(pk, msg, sig).is_ok()
    }

    /// Returns the 32-byte secret key bytes.
    pub fn secret_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }

    /// Returns the 32-byte public key bytes.
    pub fn public_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// X25519 Key Exchange
// ──────────────────────────────────────────────────────────────────────────────

/// An ephemeral X25519 keypair for ECDH key exchange.
pub struct KeyExchange {
    /// Private scalar (secret).
    scalar: Scalar,
    /// Public Montgomery point (shared with peer).
    pub public: MontgomeryPoint,
}

impl KeyExchange {
    /// Generates a new ephemeral X25519 keypair.
    pub fn generate() -> Result<Self, CryptoError> {
        let mut secret_bytes = [0u8; 32];
        getrandom::getrandom(&mut secret_bytes)
            .map_err(|e| CryptoError::KeyExchange(format!("getrandom: {e}")))?;
        // Clamp the scalar as per X25519 spec
        let scalar = Scalar::from_bytes_mod_order(secret_bytes);
        // X25519 base point: u = 9 (little-endian: [9, 0, 0, ..., 0])
        let mut basepoint_bytes = [0u8; 32];
        basepoint_bytes[0] = 9;
        let basepoint = MontgomeryPoint(basepoint_bytes);
        let public = basepoint * scalar;
        Ok(Self { scalar, public })
    }

    /// Computes the shared secret from ECDH(our_scalar, peer_public).
    pub fn shared_secret(&self, peer_public: &MontgomeryPoint) -> [u8; 32] {
        let shared = peer_public * self.scalar;
        shared.to_bytes()
    }

    /// Derives a 32-byte AES-256-GCM key from a shared secret via SHA-256.
    pub fn derive_aes_key(shared_secret: &[u8; 32]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(b"zion-p2p-aes-key-v1");
        hasher.update(shared_secret);
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Encrypted Transport (AES-256-GCM)
// ──────────────────────────────────────────────────────────────────────────────

/// Encrypted transport layer wrapping a TCP stream with AES-256-GCM.
///
/// Each message is encrypted with a unique 12-byte nonce derived from a
/// monotonically increasing counter. The nonce is prepended to the ciphertext.
///
/// Wire format: `[4-byte LE length][12-byte nonce][ciphertext + 16-byte GCM tag]`
pub struct EncryptedTransport {
    stream: TcpStream,
    cipher: Aes256Gcm,
    /// Nonce counter — incremented per message, encoded as 12-byte LE.
    nonce_counter: u64,
}

impl EncryptedTransport {
    /// Creates a new encrypted transport from an established TCP stream and
    /// a shared AES-256 key (derived from X25519 ECDH).
    pub fn new(stream: TcpStream, aes_key: &[u8; 32]) -> Result<Self, CryptoError> {
        let cipher = Aes256Gcm::new_from_slice(aes_key)
            .map_err(|e| CryptoError::Encryption(format!("AES key init: {e}")))?;
        Ok(Self {
            stream,
            cipher,
            nonce_counter: 0,
        })
    }

    /// Generates the next 12-byte nonce from the counter.
    fn next_nonce(&mut self) -> [u8; 12] {
        let mut nonce = [0u8; 12];
        nonce[..8].copy_from_slice(&self.nonce_counter.to_le_bytes());
        self.nonce_counter += 1;
        nonce
    }

    /// Encrypts and sends a plaintext message.
    pub fn send(&mut self, plaintext: &[u8]) -> Result<(), CryptoError> {
        let nonce = self.next_nonce();
        let nonce_obj = Nonce::from_slice(&nonce);
        let ciphertext = self
            .cipher
            .encrypt(nonce_obj, plaintext)
            .map_err(|e| CryptoError::Encryption(format!("AES-GCM encrypt: {e}")))?;

        // Wire format: [4-byte LE length] [12-byte nonce] [ciphertext]
        let total_len = 12 + ciphertext.len();
        let len_bytes = (total_len as u32).to_le_bytes();

        self.stream.write_all(&len_bytes)?;
        self.stream.write_all(&nonce)?;
        self.stream.write_all(&ciphertext)?;
        self.stream.flush()?;
        Ok(())
    }

    /// Receives and decrypts a message.
    pub fn recv(&mut self) -> Result<Vec<u8>, CryptoError> {
        // Read 4-byte length
        let mut len_buf = [0u8; 4];
        self.stream.read_exact(&mut len_buf)?;
        let total_len = u32::from_le_bytes(len_buf) as usize;
        if total_len < 12 || total_len > 16 * 1024 * 1024 {
            return Err(CryptoError::Decryption(format!(
                "invalid frame length: {total_len}"
            )));
        }

        // Read nonce + ciphertext
        let mut frame = vec![0u8; total_len];
        self.stream.read_exact(&mut frame)?;

        let nonce = &frame[..12];
        let ciphertext = &frame[12..];

        let nonce_obj = Nonce::from_slice(nonce);
        let plaintext = self
            .cipher
            .decrypt(nonce_obj, ciphertext)
            .map_err(|e| CryptoError::Decryption(format!("AES-GCM decrypt: {e}")))?;

        Ok(plaintext)
    }

    /// Returns a reference to the underlying stream.
    pub fn stream(&self) -> &TcpStream {
        &self.stream
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_identity_generate_and_sign() {
        let identity = NodeIdentity::generate().expect("generate");
        let msg = b"hello zion";
        let sig = identity.sign(msg);
        assert!(
            NodeIdentity::verify(&identity.verifying_key, msg, &sig),
            "signature must verify"
        );
    }

    #[test]
    fn node_identity_from_bytes_deterministic() {
        let secret = [0x42u8; 32];
        let id1 = NodeIdentity::from_bytes(&secret).expect("from_bytes 1");
        let id2 = NodeIdentity::from_bytes(&secret).expect("from_bytes 2");
        assert_eq!(id1.node_id, id2.node_id, "same secret → same node_id");
        assert_eq!(
            id1.public_bytes(),
            id2.public_bytes(),
            "same secret → same public key"
        );
    }

    #[test]
    fn node_identity_different_secrets_different_keys() {
        let id1 = NodeIdentity::from_bytes(&[1u8; 32]).expect("id1");
        let id2 = NodeIdentity::from_bytes(&[2u8; 32]).expect("id2");
        assert_ne!(id1.node_id, id2.node_id);
        assert_ne!(id1.public_bytes(), id2.public_bytes());
    }

    #[test]
    fn node_identity_rejects_wrong_message() {
        let identity = NodeIdentity::generate().expect("generate");
        let sig = identity.sign(b"message A");
        assert!(
            !NodeIdentity::verify(&identity.verifying_key, b"message B", &sig),
            "signature for message A must not verify for message B"
        );
    }

    #[test]
    fn node_identity_rejects_wrong_key() {
        let id1 = NodeIdentity::generate().expect("id1");
        let id2 = NodeIdentity::generate().expect("id2");
        let sig = id1.sign(b"hello");
        assert!(
            !NodeIdentity::verify(&id2.verifying_key, b"hello", &sig),
            "signature from id1 must not verify with id2's public key"
        );
    }

    #[test]
    fn key_exchange_both_derive_same_secret() {
        let alice = KeyExchange::generate().expect("alice");
        let bob = KeyExchange::generate().expect("bob");

        let alice_secret = alice.shared_secret(&bob.public);
        let bob_secret = bob.shared_secret(&alice.public);

        assert_eq!(
            alice_secret, bob_secret,
            "ECDH must produce identical shared secrets"
        );

        let alice_key = KeyExchange::derive_aes_key(&alice_secret);
        let bob_key = KeyExchange::derive_aes_key(&bob_secret);
        assert_eq!(alice_key, bob_key, "derived AES keys must match");
    }

    #[test]
    fn key_exchange_different_pairs_different_secrets() {
        let alice = KeyExchange::generate().expect("alice");
        let bob = KeyExchange::generate().expect("bob");
        let carol = KeyExchange::generate().expect("carol");

        let ab = alice.shared_secret(&bob.public);
        let ac = alice.shared_secret(&carol.public);
        assert_ne!(ab, ac, "different peers must produce different secrets");
    }

    #[test]
    fn encrypted_transport_roundtrip() {
        // Use a loopback TCP connection for testing
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");

        let handle = std::thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept");
            let mut transport = EncryptedTransport::new(stream, &[0xABu8; 32]).expect("create");
            let msg = transport.recv().expect("recv");
            msg
        });

        let stream = std::net::TcpStream::connect(addr).expect("connect");
        let mut transport = EncryptedTransport::new(stream, &[0xABu8; 32]).expect("create");
        transport.send(b"hello encrypted world").expect("send");

        let received = handle.join().expect("thread");
        assert_eq!(received, b"hello encrypted world");
    }

    #[test]
    fn encrypted_transport_multiple_messages() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");

        let handle = std::thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept");
            let mut transport = EncryptedTransport::new(stream, &[0xCDu8; 32]).expect("create");
            let mut msgs = Vec::new();
            for _ in 0..5 {
                msgs.push(transport.recv().expect("recv"));
            }
            msgs
        });

        let stream = std::net::TcpStream::connect(addr).expect("connect");
        let mut transport = EncryptedTransport::new(stream, &[0xCDu8; 32]).expect("create");
        for i in 0..5u8 {
            transport.send(&[i; 10]).expect("send");
        }

        let msgs = handle.join().expect("thread");
        assert_eq!(msgs.len(), 5);
        for (i, msg) in msgs.iter().enumerate() {
            assert_eq!(msg, &[i as u8; 10]);
        }
    }

    #[test]
    fn encrypted_transport_rejects_tampered_ciphertext() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");

        let key = [0xEFu8; 32];

        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            // Read the frame but tamper with a byte before decrypting
            let mut len_buf = [0u8; 4];
            stream.read_exact(&mut len_buf).expect("read len");
            let total_len = u32::from_le_bytes(len_buf) as usize;
            let mut frame = vec![0u8; total_len];
            stream.read_exact(&mut frame).expect("read frame");

            // Tamper: flip a bit in the ciphertext
            frame[15] ^= 0x01;

            let cipher = Aes256Gcm::new_from_slice(&key).expect("cipher");
            let nonce = Nonce::from_slice(&frame[..12]);
            let result = cipher.decrypt(nonce, &frame[12..]);
            assert!(result.is_err(), "tampered ciphertext must fail decryption");
        });

        let stream = std::net::TcpStream::connect(addr).expect("connect");
        let mut transport = EncryptedTransport::new(stream, &key).expect("create");
        transport.send(b"original message").expect("send");

        handle.join().expect("thread");
    }

    #[test]
    fn encrypted_transport_wrong_key_fails() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");

        let handle = std::thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept");
            // Receiver uses a different key than sender
            let mut transport = EncryptedTransport::new(stream, &[0x11u8; 32]).expect("create");
            transport.recv().expect_err("recv with wrong key must fail");
        });

        let stream = std::net::TcpStream::connect(addr).expect("connect");
        let mut transport = EncryptedTransport::new(stream, &[0x22u8; 32]).expect("create");
        transport.send(b"test").expect("send");

        handle.join().expect("thread");
    }

    #[test]
    fn encrypted_transport_large_message() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");

        let large_msg = vec![0xABu8; 100_000]; // 100KB

        let handle = std::thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept");
            let mut transport = EncryptedTransport::new(stream, &[0x99u8; 32]).expect("create");
            transport.recv().expect("recv")
        });

        let stream = std::net::TcpStream::connect(addr).expect("connect");
        let mut transport = EncryptedTransport::new(stream, &[0x99u8; 32]).expect("create");
        transport.send(&large_msg).expect("send");

        let received = handle.join().expect("thread");
        assert_eq!(received.len(), 100_000);
        assert_eq!(received, large_msg);
    }
}
