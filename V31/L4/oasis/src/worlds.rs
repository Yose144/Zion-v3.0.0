//! OASIS World Registry — canonical world metadata shared with the web client.
//!
//! Data is loaded from `data/worlds.json` (generated from
//! `APP&WEB/OasisWeb/src/domain/config/worlds.ts`) so the API can serve
//! the same world list the frontend uses.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 3D position in the OASIS galaxy.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GalaxyPosition {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Canonical OASIS world definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldDef {
    pub id: String,
    pub name: String,
    pub category: String,
    pub layer: u32,
    pub location: String,
    pub vibe: String,
    pub summary: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub star_system: Option<String>,
    #[serde(default, rename = "galaxyPosition")]
    pub galaxy_position: Option<GalaxyPosition>,
    #[serde(default, rename = "goldenEggClue")]
    pub golden_egg_clue: Option<u32>,
}

/// In-memory registry of all known OASIS worlds.
#[derive(Debug, Clone, Default, Serialize)]
pub struct WorldRegistry {
    worlds: Vec<WorldDef>,
    by_id: HashMap<String, usize>,
}

impl WorldRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Load the world registry from a JSON file.
    pub fn load_from_file(path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let data = std::fs::read_to_string(path)?;
        let worlds: Vec<WorldDef> = serde_json::from_str(&data)?;
        let mut by_id = HashMap::with_capacity(worlds.len());
        for (i, w) in worlds.iter().enumerate() {
            by_id.insert(w.id.clone(), i);
        }
        Ok(Self { worlds, by_id })
    }

    /// Load from the embedded `data/worlds.json` bundled at compile time.
    /// This lets the binary be deployed without carrying loose data files.
    pub fn load_default() -> Self {
        let data = include_str!("../data/worlds.json");
        Self::parse(data).unwrap_or_default()
    }

    /// Parse a world registry from a JSON string.
    pub fn parse(data: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let worlds: Vec<WorldDef> = serde_json::from_str(data)?;
        let mut by_id = HashMap::with_capacity(worlds.len());
        for (i, w) in worlds.iter().enumerate() {
            by_id.insert(w.id.clone(), i);
        }
        Ok(Self { worlds, by_id })
    }

    pub fn all(&self) -> &[WorldDef] {
        &self.worlds
    }

    pub fn get(&self, id: &str) -> Option<&WorldDef> {
        self.by_id.get(id).map(|&i| &self.worlds[i])
    }

    pub fn count(&self) -> usize {
        self.worlds.len()
    }

    pub fn star_systems(&self) -> Vec<&WorldDef> {
        self.worlds.iter().filter(|w| w.category == "star-system").collect()
    }

    pub fn by_layer(&self, layer: u32) -> Vec<&WorldDef> {
        self.worlds.iter().filter(|w| w.layer == layer).collect()
    }

    pub fn by_category(&self, category: &str) -> Vec<&WorldDef> {
        self.worlds
            .iter()
            .filter(|w| w.category.eq_ignore_ascii_case(category))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_loads_default() {
        let reg = WorldRegistry::load_default();
        assert!(!reg.all().is_empty(), "Default worlds.json should not be empty");
    }

    #[test]
    fn test_lookup_nova_zeme() {
        let reg = WorldRegistry::load_default();
        let w = reg.get("NOVA_ZEME");
        assert!(w.is_some());
        assert_eq!(w.unwrap().name, "Nova Zeme");
    }

    #[test]
    fn test_golden_egg_clue_parsed() {
        let reg = WorldRegistry::load_default();
        let w = reg.get("ALPHA_CENTAURI").expect("alpha centauri");
        assert_eq!(w.golden_egg_clue, Some(1));
    }

    #[test]
    fn test_galaxy_position_parsed() {
        let reg = WorldRegistry::load_default();
        let w = reg.get("NOVA_ZEME").expect("nova zeme");
        assert!(w.galaxy_position.is_some());
    }
}
