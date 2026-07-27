use serde::{Deserialize, Serialize};

/// High-level family of a blockchain. Used to dispatch signing/RPC/encoding logic.
#[derive(Clone, Copy, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChainFamily {
    Zion,
    Utxo,
    Evm,
    Solana,
    Cosmos,
    Move,
    Near,
    Ton,
    Tron,
    Stellar,
    Cardano,
    Lightning,
}

/// Canonical chain identifier. New chains can be added here; no stringly-typed
/// chain names should leak outside this crate.
#[derive(Clone, Copy, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum ChainId {
    ZionL1,
    Bitcoin,
    Ethereum,
    Base,
    Arbitrum,
    Optimism,
    Bsc,
    Polygon,
    Avalanche,
    Zksync,
    Linea,
    Solana,
    Tron,
    Stellar,
    Cardano,
    Cosmos,
    Sui,
    Aptos,
    Near,
    Ton,
    Lightning,
    Decred,
    EthereumClassic,
    Monero,
    Zano,
}

impl ChainId {
    pub const fn family(self) -> ChainFamily {
        match self {
            ChainId::ZionL1 => ChainFamily::Zion,
            ChainId::Bitcoin
            | ChainId::Decred
            | ChainId::EthereumClassic
            | ChainId::Monero
            | ChainId::Zano => ChainFamily::Utxo,
            ChainId::Ethereum
            | ChainId::Base
            | ChainId::Arbitrum
            | ChainId::Optimism
            | ChainId::Bsc
            | ChainId::Polygon
            | ChainId::Avalanche
            | ChainId::Zksync
            | ChainId::Linea => ChainFamily::Evm,
            ChainId::Solana => ChainFamily::Solana,
            ChainId::Cosmos => ChainFamily::Cosmos,
            ChainId::Sui | ChainId::Aptos => ChainFamily::Move,
            ChainId::Near => ChainFamily::Near,
            ChainId::Ton => ChainFamily::Ton,
            ChainId::Tron => ChainFamily::Tron,
            ChainId::Stellar => ChainFamily::Stellar,
            ChainId::Cardano => ChainFamily::Cardano,
            ChainId::Lightning => ChainFamily::Lightning,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            ChainId::ZionL1 => "zion-l1",
            ChainId::Bitcoin => "bitcoin",
            ChainId::Ethereum => "ethereum",
            ChainId::Base => "base",
            ChainId::Arbitrum => "arbitrum",
            ChainId::Optimism => "optimism",
            ChainId::Bsc => "bsc",
            ChainId::Polygon => "polygon",
            ChainId::Avalanche => "avalanche",
            ChainId::Zksync => "zksync",
            ChainId::Linea => "linea",
            ChainId::Solana => "solana",
            ChainId::Tron => "tron",
            ChainId::Stellar => "stellar",
            ChainId::Cardano => "cardano",
            ChainId::Cosmos => "cosmos",
            ChainId::Sui => "sui",
            ChainId::Aptos => "aptos",
            ChainId::Near => "near",
            ChainId::Ton => "ton",
            ChainId::Lightning => "lightning",
            ChainId::Decred => "decred",
            ChainId::EthereumClassic => "ethereum_classic",
            ChainId::Monero => "monero",
            ChainId::Zano => "zano",
        }
    }
}
