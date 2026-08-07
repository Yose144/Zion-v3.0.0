//! Serde helpers for `u128` values and `HashMap<String, u128>` maps.
//!
//! Serializes 128-bit integers as decimal strings and accepts either a string
//! or a JSON number on deserialization. This works around JSON implementations
//! that cannot represent 128-bit integers natively and keeps wire format
//! compatible with consumers that parse numbers as strings.

use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serializer};
use std::fmt;

/// Serialize a `u128` as a decimal string.
pub fn serialize<S: Serializer>(value: &u128, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.collect_str(value)
}

struct U128Visitor;

impl<'de> Visitor<'de> for U128Visitor {
    type Value = u128;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("a non-negative 128-bit integer as a string or number")
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
        value.parse().map_err(de::Error::custom)
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
        Ok(value as u128)
    }

    fn visit_u128<E: de::Error>(self, value: u128) -> Result<Self::Value, E> {
        Ok(value)
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
        if value < 0 {
            return Err(de::Error::custom("u128 value must be non-negative"));
        }
        Ok(value as u128)
    }

    fn visit_i128<E: de::Error>(self, value: i128) -> Result<Self::Value, E> {
        if value < 0 {
            return Err(de::Error::custom("u128 value must be non-negative"));
        }
        Ok(value as u128)
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> Result<Self::Value, E> {
        if value < 0.0 {
            return Err(de::Error::custom("u128 value must be non-negative"));
        }
        // Reject non-integral or overly large floats that cannot be
        // represented exactly (f64 mantissa is 53 bits).
        if value != value.trunc() || value >= (1u64 << 53) as f64 {
            return Err(de::Error::custom("u128 float is not an exact integer"));
        }
        Ok(value as u128)
    }
}

/// Deserialize a `u128` from either a decimal string or a JSON number.
pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
    deserializer.deserialize_any(U128Visitor)
}

/// Wrapper newtype used for map deserialization.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct U128Value(u128);

impl<'de> Deserialize<'de> for U128Value {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(U128Visitor).map(U128Value)
    }
}

/// Serde helpers for `HashMap<String, u128>` where values round-trip as
/// decimal strings while still accepting numeric inputs.
pub mod map {
    use super::U128Value;
    use serde::de::{MapAccess, Visitor};
    use serde::{Deserializer, Serialize, Serializer};
    use std::collections::HashMap;
    use std::fmt;
    use std::marker::PhantomData;

    /// Serialize a `HashMap<String, u128>` with u128 values as decimal strings.
    pub fn serialize<S: Serializer>(
        value: &HashMap<String, u128>,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        let as_strings: HashMap<&str, String> =
            value.iter().map(|(k, v)| (k.as_str(), v.to_string())).collect();
        as_strings.serialize(serializer)
    }

    struct MapVisitor(PhantomData<HashMap<String, u128>>);

    impl<'de> Visitor<'de> for MapVisitor {
        type Value = HashMap<String, u128>;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a map from strings to u128 values (string or number)")
        }

        fn visit_map<M: MapAccess<'de>>(
            self,
            mut access: M,
        ) -> Result<Self::Value, M::Error> {
            let mut map = HashMap::with_capacity(access.size_hint().unwrap_or(0));
            while let Some((key, U128Value(value))) = access.next_entry::<String, U128Value>()? {
                map.insert(key, value);
            }
            Ok(map)
        }
    }

    /// Deserialize a `HashMap<String, u128>` where values may be strings or
    /// JSON numbers.
    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<HashMap<String, u128>, D::Error> {
        deserializer.deserialize_map(MapVisitor(PhantomData))
    }
}

#[cfg(test)]
mod tests {
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;

    #[derive(Serialize, Deserialize, Debug, PartialEq)]
    struct Scalar {
        #[serde(with = "crate::u128_str")]
        value: u128,
    }

    #[derive(Serialize, Deserialize, Debug, PartialEq)]
    struct MapExample {
        #[serde(with = "crate::u128_str::map")]
        values: HashMap<String, u128>,
    }

    #[test]
    fn scalar_round_trip_as_string() {
        let s = Scalar {
            value: 4_806_059_630u128,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert_eq!(json, r#"{"value":"4806059630"}"#);
        let back: Scalar = serde_json::from_str(&json).unwrap();
        assert_eq!(s, back);
    }

    #[test]
    fn scalar_accepts_u128_number() {
        let json = r#"{"value":4806059630}"#;
        let s: Scalar = serde_json::from_str(json).unwrap();
        assert_eq!(s.value, 4_806_059_630u128);
    }

    #[test]
    fn scalar_rejects_negative() {
        let json = r#"{"value":-1}"#;
        assert!(serde_json::from_str::<Scalar>(json).is_err());
    }

    #[test]
    fn map_round_trip() {
        let mut values = HashMap::new();
        values.insert("a".to_string(), 100u128);
        values.insert("b".to_string(), u128::MAX);
        let s = MapExample { values };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains(r#""a":"100""#));
        assert!(json.contains(r#""b":"340282366920938463463374607431768211455""#));
        let back: MapExample = serde_json::from_str(&json).unwrap();
        assert_eq!(s, back);
    }

    #[test]
    fn map_accepts_numeric_values() {
        let json = r#"{"values":{"a":100,"b":"200"}}"#;
        let s: MapExample = serde_json::from_str(json).unwrap();
        assert_eq!(s.values.get("a").copied().unwrap(), 100u128);
        assert_eq!(s.values.get("b").copied().unwrap(), 200u128);
    }
}
