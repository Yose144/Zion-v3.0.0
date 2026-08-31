use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Integer amount in the smallest indivisible unit of an asset.
/// The associated `Asset` carries the decimal scale.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Ord, PartialOrd, Hash)]
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

impl Serialize for Amount {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Serialize as a decimal string to work around JSON libraries that do
        // not support 128-bit integer deserialization (e.g. some vendored
        // serde_json forks). The value is still a u128 internally.
        serializer.collect_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Amount {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct AmountVisitor;

        impl<'de> Visitor<'de> for AmountVisitor {
            type Value = Amount;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a non-negative integer amount as a string or number")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                value.parse::<u128>().map(Amount).map_err(de::Error::custom)
            }

            fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
                Ok(Amount(value as u128))
            }

            fn visit_u128<E: de::Error>(self, value: u128) -> Result<Self::Value, E> {
                Ok(Amount(value))
            }

            fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
                if value < 0 {
                    return Err(de::Error::custom("amount must be non-negative"));
                }
                Ok(Amount(value as u128))
            }

            fn visit_i128<E: de::Error>(self, value: i128) -> Result<Self::Value, E> {
                if value < 0 {
                    return Err(de::Error::custom("amount must be non-negative"));
                }
                Ok(Amount(value as u128))
            }

            fn visit_f64<E: de::Error>(self, value: f64) -> Result<Self::Value, E> {
                if value < 0.0 {
                    return Err(de::Error::custom("amount must be non-negative"));
                }
                // Reject non-integral or overly large floats that cannot be
                // represented exactly (f64 mantissa is 53 bits).
                if value != value.trunc() || value >= (1u64 << 53) as f64 {
                    return Err(de::Error::custom("amount float is not an exact integer"));
                }
                Ok(Amount(value as u128))
            }
        }

        deserializer.deserialize_any(AmountVisitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deser_amount_from_u64_number() {
        let j = "4806059630";
        let a: Amount = serde_json::from_str(j).unwrap();
        assert_eq!(a.0, 4806059630u128);
    }

    #[test]
    fn deser_amount_from_string() {
        let j = "\"4806059630\"";
        let a: Amount = serde_json::from_str(j).unwrap();
        assert_eq!(a.0, 4806059630u128);
    }
}
