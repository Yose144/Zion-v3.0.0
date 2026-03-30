# 💰 FÁZE 2: Wallet MVP — Technická Specifikace

**Priorita:** P0 (Blocker pro MainNet)  
**Trvání:** 4 týdny  
**Owner:** Wallet Lead

---

## 🎯 Cíl

Vytvořit minimální, ale plně funkční CLI wallet v Rustu. Uživatel musí být schopen:
1. Vytvořit novou peněženku
2. Přijímat ZION
3. Odesílat ZION
4. Zálohovat a obnovit peněženku

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     zion-wallet crate                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   CLI       │───▶│   Core      │───▶│   RPC       │      │
│  │   Layer     │    │   Logic     │    │   Client    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   clap      │    │   Storage   │    │   reqwest   │      │
│  │   (args)    │    │   (file)    │    │   (http)    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                            │                                 │
│                            ▼                                 │
│                     ┌─────────────┐                         │
│                     │ ~/.zion/    │                         │
│                     │ wallets/    │                         │
│                     └─────────────┘                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Struktura Crate

```
2.9.5/zion-wallet/
├── Cargo.toml
├── src/
│   ├── main.rs           # CLI entry point
│   ├── lib.rs            # Library exports
│   ├── cli/
│   │   ├── mod.rs
│   │   ├── commands.rs   # Command definitions
│   │   └── output.rs     # Formatting
│   ├── core/
│   │   ├── mod.rs
│   │   ├── wallet.rs     # Wallet struct & logic
│   │   ├── keys.rs       # Key generation
│   │   ├── mnemonic.rs   # BIP39 support
│   │   └── address.rs    # Bech32 encoding
│   ├── storage/
│   │   ├── mod.rs
│   │   ├── encrypted.rs  # AES encryption
│   │   └── config.rs     # Wallet paths
│   ├── rpc/
│   │   ├── mod.rs
│   │   ├── client.rs     # RPC client
│   │   └── types.rs      # Response types
│   └── tx/
│       ├── mod.rs
│       ├── builder.rs    # TX construction
│       └── signer.rs     # TX signing
└── tests/
    ├── wallet_tests.rs
    ├── rpc_tests.rs
    └── integration_tests.rs
```

---

## 📋 Task Breakdown

### Task 2.1: Project Setup

**Čas:** 2h

```toml
# 2.9.5/zion-wallet/Cargo.toml
[package]
name = "zion-wallet"
version = "0.1.0"
edition = "2021"
authors = ["ZION Team"]
description = "ZION command-line wallet"

[dependencies]
# CLI
clap = { version = "4", features = ["derive"] }
colored = "2"

# Crypto
secp256k1 = { version = "0.29", features = ["rand", "recovery"] }
sha2 = "0.10"
sha3 = "0.10"
bech32 = "0.11"
rand = "0.8"
tiny-bip39 = "1.0"
aes-gcm = "0.10"
argon2 = "0.5"

# RPC
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }

# Storage
dirs = "5"

[dev-dependencies]
tempfile = "3"
```

### Task 2.2: Key Generation

**Čas:** 8h

```rust
// src/core/keys.rs
use secp256k1::{Secp256k1, SecretKey, PublicKey};
use sha2::{Sha256, Digest};
use tiny_bip39::{Mnemonic, Language};

pub struct KeyPair {
    pub secret: SecretKey,
    pub public: PublicKey,
}

impl KeyPair {
    /// Generate new keypair from random entropy
    pub fn generate() -> Result<(Self, Mnemonic)> {
        let mnemonic = Mnemonic::new(MnemonicType::Words24, Language::English);
        let seed = mnemonic.to_seed("");
        
        // Derive key from seed (simplified - should use BIP32)
        let mut hasher = Sha256::new();
        hasher.update(&seed[..32]);
        let key_bytes = hasher.finalize();
        
        let secp = Secp256k1::new();
        let secret = SecretKey::from_slice(&key_bytes)?;
        let public = PublicKey::from_secret_key(&secp, &secret);
        
        Ok((Self { secret, public }, mnemonic))
    }
    
    /// Recover keypair from mnemonic
    pub fn from_mnemonic(mnemonic: &str) -> Result<Self> {
        let mnemonic = Mnemonic::from_phrase(mnemonic, Language::English)?;
        let seed = mnemonic.to_seed("");
        
        let mut hasher = Sha256::new();
        hasher.update(&seed[..32]);
        let key_bytes = hasher.finalize();
        
        let secp = Secp256k1::new();
        let secret = SecretKey::from_slice(&key_bytes)?;
        let public = PublicKey::from_secret_key(&secp, &secret);
        
        Ok(Self { secret, public })
    }
}
```

### Task 2.3: Address Generation

**Čas:** 4h

```rust
// src/core/address.rs
use bech32::{Bech32m, Hrp};
use sha2::{Sha256, Digest};
use sha3::{Keccak256};

pub const ADDRESS_PREFIX: &str = "zion";

/// Convert public key to bech32 address
pub fn pubkey_to_address(pubkey: &PublicKey) -> Result<String> {
    // 1. Serialize public key (33 bytes compressed)
    let pubkey_bytes = pubkey.serialize();
    
    // 2. SHA256 hash
    let sha_hash = Sha256::digest(&pubkey_bytes);
    
    // 3. Take last 20 bytes (similar to Ethereum)
    let address_bytes = &sha_hash[12..32];
    
    // 4. Bech32m encode
    let hrp = Hrp::parse(ADDRESS_PREFIX)?;
    let address = bech32::encode::<Bech32m>(hrp, address_bytes)?;
    
    Ok(address)
}

/// Validate address format
pub fn validate_address(address: &str) -> bool {
    match bech32::decode(address) {
        Ok((hrp, _)) => hrp.as_str() == ADDRESS_PREFIX,
        Err(_) => false,
    }
}
```

### Task 2.4: Wallet Storage

**Čas:** 8h

```rust
// src/storage/encrypted.rs
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use argon2::{Argon2, PasswordHasher};
use rand::RngCore;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct EncryptedWallet {
    pub name: String,
    pub address: String,
    pub encrypted_key: Vec<u8>,
    pub salt: [u8; 32],
    pub nonce: [u8; 12],
    pub created_at: u64,
}

impl EncryptedWallet {
    pub fn encrypt(
        name: &str,
        keypair: &KeyPair,
        address: &str,
        password: &str,
    ) -> Result<Self> {
        // 1. Generate salt and nonce
        let mut salt = [0u8; 32];
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut salt);
        rand::thread_rng().fill_bytes(&mut nonce);
        
        // 2. Derive key from password using Argon2
        let argon2 = Argon2::default();
        let key = argon2.hash_password(password.as_bytes(), &salt)?;
        let key = Key::<Aes256Gcm>::from_slice(key.hash.unwrap().as_bytes());
        
        // 3. Encrypt secret key
        let cipher = Aes256Gcm::new(key);
        let encrypted = cipher.encrypt(
            Nonce::from_slice(&nonce),
            keypair.secret.secret_bytes().as_ref(),
        )?;
        
        Ok(Self {
            name: name.to_string(),
            address: address.to_string(),
            encrypted_key: encrypted,
            salt,
            nonce,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs(),
        })
    }
    
    pub fn decrypt(&self, password: &str) -> Result<SecretKey> {
        // Derive key
        let argon2 = Argon2::default();
        let key = argon2.hash_password(password.as_bytes(), &self.salt)?;
        let key = Key::<Aes256Gcm>::from_slice(key.hash.unwrap().as_bytes());
        
        // Decrypt
        let cipher = Aes256Gcm::new(key);
        let decrypted = cipher.decrypt(
            Nonce::from_slice(&self.nonce),
            self.encrypted_key.as_ref(),
        )?;
        
        SecretKey::from_slice(&decrypted)
    }
}

/// Wallet storage path: ~/.zion/wallets/
pub fn wallets_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".zion")
        .join("wallets")
}
```

### Task 2.5: RPC Client

**Čas:** 8h

```rust
// src/rpc/client.rs
use reqwest::Client;
use serde::{Serialize, Deserialize};

pub struct RpcClient {
    client: Client,
    endpoint: String,
}

#[derive(Serialize)]
struct JsonRpcRequest<T> {
    jsonrpc: &'static str,
    method: &'static str,
    params: T,
    id: u64,
}

#[derive(Deserialize)]
struct JsonRpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

impl RpcClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.to_string(),
        }
    }
    
    /// Get balance for address
    pub async fn get_balance(&self, address: &str) -> Result<u64> {
        let response: JsonRpcResponse<BalanceResponse> = self.call(
            "get_balance",
            serde_json::json!({ "address": address }),
        ).await?;
        
        Ok(response.result.unwrap().balance)
    }
    
    /// Get UTXOs for address
    pub async fn get_utxos(&self, address: &str) -> Result<Vec<Utxo>> {
        let response: JsonRpcResponse<UtxosResponse> = self.call(
            "get_utxos",
            serde_json::json!({ "address": address }),
        ).await?;
        
        Ok(response.result.unwrap().utxos)
    }
    
    /// Broadcast transaction
    pub async fn broadcast_tx(&self, tx_hex: &str) -> Result<String> {
        let response: JsonRpcResponse<BroadcastResponse> = self.call(
            "broadcast_tx",
            serde_json::json!({ "tx_hex": tx_hex }),
        ).await?;
        
        Ok(response.result.unwrap().txid)
    }
    
    /// Get transaction status
    pub async fn get_tx_status(&self, txid: &str) -> Result<TxStatus> {
        let response: JsonRpcResponse<TxStatus> = self.call(
            "get_tx_status",
            serde_json::json!({ "txid": txid }),
        ).await?;
        
        Ok(response.result.unwrap())
    }
    
    async fn call<T, R>(&self, method: &str, params: T) -> Result<JsonRpcResponse<R>>
    where
        T: Serialize,
        R: DeserializeOwned,
    {
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            method,
            params,
            id: 1,
        };
        
        let response = self.client
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?
            .json()
            .await?;
        
        Ok(response)
    }
}
```

### Task 2.6: Transaction Builder

**Čas:** 12h

```rust
// src/tx/builder.rs
use crate::rpc::Utxo;

pub struct TransactionBuilder {
    inputs: Vec<TxInput>,
    outputs: Vec<TxOutput>,
    fee_rate: u64,  // satoshis per byte
}

impl TransactionBuilder {
    pub fn new() -> Self {
        Self {
            inputs: Vec::new(),
            outputs: Vec::new(),
            fee_rate: 10,  // default
        }
    }
    
    /// Add output (recipient)
    pub fn add_output(&mut self, address: &str, amount: u64) -> &mut Self {
        self.outputs.push(TxOutput {
            address: address.to_string(),
            amount,
        });
        self
    }
    
    /// Select UTXOs to cover amount + fee
    pub fn select_inputs(&mut self, utxos: &[Utxo], target_amount: u64) -> Result<&mut Self> {
        let mut selected_amount = 0u64;
        let mut selected_utxos = Vec::new();
        
        // Simple greedy selection (could be improved)
        for utxo in utxos.iter().filter(|u| !u.spent) {
            selected_utxos.push(utxo.clone());
            selected_amount += utxo.amount;
            
            let estimated_fee = self.estimate_fee(selected_utxos.len());
            if selected_amount >= target_amount + estimated_fee {
                break;
            }
        }
        
        let estimated_fee = self.estimate_fee(selected_utxos.len());
        if selected_amount < target_amount + estimated_fee {
            return Err(WalletError::InsufficientFunds {
                available: selected_amount,
                required: target_amount + estimated_fee,
            });
        }
        
        self.inputs = selected_utxos.into_iter().map(|u| TxInput {
            txid: u.txid,
            vout: u.vout,
            amount: u.amount,
        }).collect();
        
        Ok(self)
    }
    
    /// Add change output if needed
    pub fn add_change(&mut self, change_address: &str) -> &mut Self {
        let input_sum: u64 = self.inputs.iter().map(|i| i.amount).sum();
        let output_sum: u64 = self.outputs.iter().map(|o| o.amount).sum();
        let fee = self.estimate_fee(self.inputs.len());
        
        let change = input_sum.saturating_sub(output_sum).saturating_sub(fee);
        
        if change > 0 {
            self.outputs.push(TxOutput {
                address: change_address.to_string(),
                amount: change,
            });
        }
        
        self
    }
    
    /// Build unsigned transaction
    pub fn build(&self) -> Result<UnsignedTransaction> {
        Ok(UnsignedTransaction {
            version: 1,
            inputs: self.inputs.clone(),
            outputs: self.outputs.clone(),
        })
    }
    
    fn estimate_fee(&self, input_count: usize) -> u64 {
        // Estimate: ~180 bytes per input, ~34 bytes per output, ~10 bytes overhead
        let estimated_size = 10 + (input_count * 180) + (self.outputs.len() * 34);
        (estimated_size as u64) * self.fee_rate
    }
}
```

### Task 2.7: CLI Commands

**Čas:** 8h

```rust
// src/main.rs
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "zion-wallet")]
#[command(about = "ZION command-line wallet")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    /// RPC endpoint
    #[arg(long, default_value = "http://localhost:8444")]
    rpc: String,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new wallet
    Create {
        /// Wallet name
        name: String,
    },
    
    /// Import wallet from mnemonic
    Import {
        /// Wallet name
        name: String,
        /// BIP39 mnemonic phrase
        #[arg(long)]
        seed: Option<String>,
    },
    
    /// Export wallet mnemonic (DANGEROUS)
    Export {
        /// Wallet name
        name: String,
    },
    
    /// List all wallets
    List,
    
    /// Get wallet balance
    Balance {
        /// Wallet name
        name: String,
    },
    
    /// Send ZION
    Send {
        /// Source wallet name
        #[arg(long)]
        from: String,
        /// Destination address
        #[arg(long)]
        to: String,
        /// Amount to send
        #[arg(long)]
        amount: f64,
    },
    
    /// Show transaction history
    History {
        /// Wallet name
        name: String,
        /// Number of transactions
        #[arg(long, default_value = "10")]
        limit: usize,
    },
    
    /// Show wallet address
    Address {
        /// Wallet name
        name: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let rpc = RpcClient::new(&cli.rpc);
    
    match cli.command {
        Commands::Create { name } => {
            let password = prompt_password("Enter password: ")?;
            let (keypair, mnemonic) = KeyPair::generate()?;
            let address = pubkey_to_address(&keypair.public)?;
            
            let wallet = EncryptedWallet::encrypt(&name, &keypair, &address, &password)?;
            wallet.save()?;
            
            println!("Wallet created!");
            println!("Address: {}", address);
            println!("\n⚠️  BACKUP YOUR MNEMONIC:");
            println!("{}", mnemonic.phrase());
        }
        
        Commands::Balance { name } => {
            let wallet = EncryptedWallet::load(&name)?;
            let balance = rpc.get_balance(&wallet.address).await?;
            
            println!("Address: {}", wallet.address);
            println!("Balance: {} ZION", format_amount(balance));
        }
        
        Commands::Send { from, to, amount } => {
            let wallet = EncryptedWallet::load(&from)?;
            let password = prompt_password("Enter password: ")?;
            let secret = wallet.decrypt(&password)?;
            
            let amount_atomic = (amount * 100_000_000.0) as u64;
            let utxos = rpc.get_utxos(&wallet.address).await?;
            
            let tx = TransactionBuilder::new()
                .add_output(&to, amount_atomic)
                .select_inputs(&utxos, amount_atomic)?
                .add_change(&wallet.address)
                .build()?
                .sign(&secret)?;
            
            let txid = rpc.broadcast_tx(&tx.to_hex()).await?;
            
            println!("Transaction sent!");
            println!("TXID: {}", txid);
        }
        
        // ... other commands
    }
    
    Ok(())
}
```

---

## 🧪 Testing

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_keypair_generation() {
        let (keypair, mnemonic) = KeyPair::generate().unwrap();
        assert!(mnemonic.phrase().split_whitespace().count() == 24);
    }
    
    #[test]
    fn test_keypair_recovery() {
        let (original, mnemonic) = KeyPair::generate().unwrap();
        let recovered = KeyPair::from_mnemonic(mnemonic.phrase()).unwrap();
        assert_eq!(original.secret, recovered.secret);
    }
    
    #[test]
    fn test_address_generation() {
        let (keypair, _) = KeyPair::generate().unwrap();
        let address = pubkey_to_address(&keypair.public).unwrap();
        assert!(address.starts_with("zion1"));
        assert!(validate_address(&address));
    }
    
    #[test]
    fn test_wallet_encryption() {
        let (keypair, _) = KeyPair::generate().unwrap();
        let address = pubkey_to_address(&keypair.public).unwrap();
        
        let encrypted = EncryptedWallet::encrypt(
            "test", &keypair, &address, "password123"
        ).unwrap();
        
        let decrypted = encrypted.decrypt("password123").unwrap();
        assert_eq!(keypair.secret, decrypted);
    }
    
    #[test]
    fn test_wrong_password() {
        let (keypair, _) = KeyPair::generate().unwrap();
        let address = pubkey_to_address(&keypair.public).unwrap();
        
        let encrypted = EncryptedWallet::encrypt(
            "test", &keypair, &address, "correct"
        ).unwrap();
        
        assert!(encrypted.decrypt("wrong").is_err());
    }
}
```

### Integration Tests
```rust
#[tokio::test]
async fn test_e2e_send_receive() {
    // 1. Create two wallets
    let (sender_keypair, _) = KeyPair::generate().unwrap();
    let (receiver_keypair, _) = KeyPair::generate().unwrap();
    
    let sender_addr = pubkey_to_address(&sender_keypair.public).unwrap();
    let receiver_addr = pubkey_to_address(&receiver_keypair.public).unwrap();
    
    // 2. Fund sender (requires test node)
    // ...
    
    // 3. Send transaction
    // ...
    
    // 4. Verify receiver balance
    // ...
}
```

---

## 📦 Deliverables

| Soubor | Popis |
|--------|-------|
| `2.9.5/zion-wallet/` | Kompletní wallet crate |
| `docs/mainnet/WALLET_GUIDE.md` | Uživatelská dokumentace |
| `docs/mainnet/WALLET_SECURITY.md` | Security best practices |

---

## ⏱️ Time Estimate

| Task | Čas |
|------|-----|
| Project Setup | 2h |
| Key Generation | 8h |
| Address Generation | 4h |
| Wallet Storage | 8h |
| RPC Client | 8h |
| TX Builder | 12h |
| CLI Commands | 8h |
| Unit Tests | 8h |
| Integration Tests | 8h |
| Documentation | 4h |
| **Total** | **70h (~4 týdny)** |

---

## ✅ Exit Criteria

1. `zion-wallet create` funguje
2. `zion-wallet import --seed "..."` obnoví wallet
3. `zion-wallet send` odešle TX a ten je potvrzen
4. 20+ unit testů passing
5. E2E test: create → fund → send → verify

---

## 🔗 Dependencies

- Fáze 0: Porty unifikovány (RPC endpoint)
- Fáze 1: Address format definován
- Core RPC: `get_balance`, `get_utxos`, `broadcast_tx` endpointy

---

## ⚠️ Security Notes

- **NIKDY** nelogovat secret keys
- Argon2 pro key derivation (ne PBKDF2)
- Mnemonic se zobrazí JEDNOU při create
- Password se nezobrazuje při psaní
- Wipe memory po použití secret key

---

*Dokument aktualizován: 2026-02-03*
