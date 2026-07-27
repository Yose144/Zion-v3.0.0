use serde::{Deserialize, Serialize};

/// Integer amount in the smallest indivisible unit of an asset.
/// The associated `Asset` carries the decimal scale.
#[derive(
    Clone, Copy, Debug, Default, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct Amount(pub u128);

impl Amount {
    pub const ZERO: Self = Self(0);

    pub const fn new(value: u128) -> Self {
        Self(value)
    }

    pub fn saturating_add(self, other: Self) -> Self {
        Self(self.0.saturating_add(other.0))
    }

    pub fn saturating_sub(self, other: Self) -> Self {
        Self(self.0.saturating_sub(other.0))
    }
}

impl std::fmt::Display for Amount {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<u128> for Amount {
    fn from(value: u128) -> Self {
        Self(value)
    }
}

impl From<Amount> for u128 {
    fn from(amount: Amount) -> Self {
        amount.0
    }
}
