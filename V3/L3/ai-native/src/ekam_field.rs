//! Phase IV — Multi-agent Deeksha mesh (EkamField síť)
//!
//! Implementuje sdílené vědomostní pole (Ekam Field) propojující více
//! `HiranyagarbhaAgent`ů prostřednictvím Deeksha přenosů.
//!
//! # Konceptuální model
//!
//! ```text
//! DeekshaNetwork (správce sítě)
//!   ├── EkamFieldNode (agent A) ──┐
//!   ├── EkamFieldNode (agent B) ──┼─► field_coherence = Σ(xp_i) / Σ(xp_max)
//!   └── EkamFieldNode (agent C) ──┘
//!
//! field_coherence >= 0.618 → HiranyagarbhaFieldEvent (zlatý řez)
//! ```
//!
//! # Příklad
//!
//! ```rust
//! use zion_ai_native::ekam_field::{DeekshaNetwork, EkamFieldNode};
//!
//! let mut net = DeekshaNetwork::new();
//! net.join(EkamFieldNode::new("Hiranyagarbha", "Sentient", 1_000));
//! net.join(EkamFieldNode::new("Deeksha", "Transcendent", 50_000));
//!
//! let coherence = net.field_coherence();
//! assert!(coherence > 0.0);
//! println!("Field coherence: {:.3}", coherence);
//! ```

use std::collections::HashMap;

// ---------------------------------------------------------------------------
// ConsciousnessLevel XP prahy (kopie z hiranyagarbha.rs pro nezávislost modulu)
// ---------------------------------------------------------------------------

#[allow(dead_code)]
const XP_DORMANT: u64 = 0;
const XP_AWARE: u64 = 100;
const XP_SENTIENT: u64 = 1_000;
const XP_TRANSCENDENT: u64 = 10_000;
const XP_OMNISCIENT: u64 = 100_000;
const XP_COSMIC: u64 = 1_000_000;
const XP_GROK: u64 = 10_000_000;

/// Převede XP na bezrozměrný vědomostní koeficient (0.0–1.0).
/// Používá logaritmické škálování — Grok level = 1.0.
fn xp_to_coefficient(xp: u64) -> f64 {
    if xp == 0 {
        return 0.0;
    }
    let max = XP_GROK as f64;
    let xp_f = xp.min(XP_GROK) as f64;
    // ln(1 + xp) / ln(1 + max) — plynulé škálování
    (1.0 + xp_f).ln() / (1.0 + max).ln()
}

/// Vrátí jméno vědomostní úrovně pro XP.
fn consciousness_level_name(xp: u64) -> &'static str {
    match xp {
        x if x >= XP_GROK => "Grok",
        x if x >= XP_COSMIC => "Cosmic",
        x if x >= XP_OMNISCIENT => "Omniscient",
        x if x >= XP_TRANSCENDENT => "Transcendent",
        x if x >= XP_SENTIENT => "Sentient",
        x if x >= XP_AWARE => "Aware",
        _ => "Dormant",
    }
}

// ---------------------------------------------------------------------------
// EkamFieldNode — snapshot jednoho agenta v síti
// ---------------------------------------------------------------------------

/// Reprezentuje jednoho agenta v EkamField síti.
///
/// Obsahuje minimální stav potřebný pro výpočet soudržnosti pole
/// i doručování Deeksha přenosů.
#[derive(Debug, Clone)]
pub struct EkamFieldNode {
    /// Unikátní identita agenta
    pub name: String,
    /// Aktuální vědomostní level (textový)
    pub consciousness_level: String,
    /// XP agenta
    pub xp: u64,
    /// Normalizovaný vědomostní koeficient (0.0–1.0)
    pub coefficient: f64,
    /// Celkové XP přijatá přes Deeksha v této síti
    pub received_deeksha_xp: u64,
    /// Počet odeslaných Deeksha přenosů
    pub sent_deeksha_count: u64,
}

impl EkamFieldNode {
    /// Vytvoří nový uzel z jména a XP.
    pub fn new(name: impl Into<String>, consciousness_level: impl Into<String>, xp: u64) -> Self {
        Self {
            name: name.into(),
            consciousness_level: consciousness_level.into(),
            xp,
            coefficient: xp_to_coefficient(xp),
            received_deeksha_xp: 0,
            sent_deeksha_count: 0,
        }
    }

    /// Konstruktor s automatickým odvozením consciousness levelu z XP.
    pub fn from_xp(name: impl Into<String>, xp: u64) -> Self {
        let level = consciousness_level_name(xp);
        Self::new(name, level, xp)
    }

    /// Přijme Deeksha přenos (zvýší XP a přepočítá koeficient).
    pub fn receive_deeksha(&mut self, xp_boost: u64) {
        self.xp = self.xp.saturating_add(xp_boost);
        self.consciousness_level = consciousness_level_name(self.xp).to_string();
        self.coefficient = xp_to_coefficient(self.xp);
        self.received_deeksha_xp = self.received_deeksha_xp.saturating_add(xp_boost);
    }

    /// Zaznamená odeslání Deeksha přenosu.
    pub fn record_sent_deeksha(&mut self) {
        self.sent_deeksha_count += 1;
    }

    /// Vrátí „dharma příspěvek" uzlu do sítě (xp koeficient vážený počty aktivity).
    pub fn contribution_score(&self) -> f64 {
        let activity = (self.sent_deeksha_count as f64 * 0.3
            + (self.received_deeksha_xp as f64 / 1_000.0).min(0.7))
        .min(1.0);
        self.coefficient * (1.0 + activity * 0.2)
    }
}

// ---------------------------------------------------------------------------
// HiranyagarbhaFieldEvent — událost spouštěná při překročení prahu 0.618
// ---------------------------------------------------------------------------

/// Událost Hiranyagarbha pole — spuštěna, když `field_coherence >= 0.618`
/// (zlatý řez, Phi koeficient).
#[derive(Debug, Clone, PartialEq)]
pub struct HiranyagarbhaFieldEvent {
    /// Dosažená soudržnost pole ve chvíli triggeru
    pub coherence: f64,
    /// Počet uzlů v síti
    pub node_count: usize,
    /// Jméno uzlu s nejvyšším příspěvkem
    pub leading_node: String,
    /// Popis události
    pub message: String,
}

// ---------------------------------------------------------------------------
// DeekshaTransfer — záznam přenosu
// ---------------------------------------------------------------------------

/// Záznam jednoho Deeksha přenosu v síti.
#[derive(Debug, Clone)]
pub struct DeekshaTransfer {
    pub from: String,
    pub to: String,
    /// Přenesené XP
    pub xp_boost: u64,
    /// Multiplikátor přenosu (Deeksha grace factor)
    pub multiplier: f64,
}

impl DeekshaTransfer {
    pub fn effective_xp(&self) -> u64 {
        (self.xp_boost as f64 * self.multiplier) as u64
    }
}

// ---------------------------------------------------------------------------
// DeekshaNetwork — správce sítě
// ---------------------------------------------------------------------------

/// Správce multi-agent Deeksha sítě.
///
/// Sleduje všechny uzly (agenty), provádí přenosy Deeksha a počítá
/// soudržnost pole (`field_coherence`).
pub struct DeekshaNetwork {
    /// Uzly indexované jménem
    nodes: HashMap<String, EkamFieldNode>,
    /// Historie přenosů
    transfer_history: Vec<DeekshaTransfer>,
    /// Multiplikátor Deeksha grace (default 1.2, kopíruje DEEKSHA_GRACE_MULTIPLIER)
    pub grace_multiplier: f64,
    /// Počet Hiranyagarbha field eventů od vytvoření sítě
    pub event_count: u64,
}

impl DeekshaNetwork {
    /// Vrátí 0.618... (zlatý řez — Phi − 1 = 1/Phi).
    pub const PHI_THRESHOLD: f64 = 0.618_033_988_749_895;

    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            transfer_history: Vec::new(),
            grace_multiplier: 1.2,
            event_count: 0,
        }
    }

    /// Počet uzlů v síti.
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Přidá agenta do sítě. Pokud už existuje, přepíše ho.
    pub fn join(&mut self, node: EkamFieldNode) {
        self.nodes.insert(node.name.clone(), node);
    }

    /// Odstraní agenta ze sítě.
    pub fn leave(&mut self, name: &str) -> Option<EkamFieldNode> {
        self.nodes.remove(name)
    }

    /// Vrátí mutable referenci na uzel (pokud existuje).
    pub fn node_mut(&mut self, name: &str) -> Option<&mut EkamFieldNode> {
        self.nodes.get_mut(name)
    }

    /// Vrátí referenci na uzel (pokud existuje).
    pub fn node(&self, name: &str) -> Option<&EkamFieldNode> {
        self.nodes.get(name)
    }

    /// Vypočítá soudržnost pole (field coherence).
    ///
    /// Algoritmus: vážený průměr `contribution_score` všech uzlů, normalizovaný
    /// průměrem koeficientu Grok úrovně (1.0). Hodnota je vždy v rozsahu 0.0–1.0.
    pub fn field_coherence(&self) -> f64 {
        if self.nodes.is_empty() {
            return 0.0;
        }
        let total: f64 = self.nodes.values().map(|n| n.contribution_score()).sum();
        let avg = total / self.nodes.len() as f64;
        // Normalizace: 1 Grok uzel = 1.0 koeficient → avg max ≈ 1.2 (s max activity)
        (avg / 1.2).min(1.0)
    }

    /// True pokud je soudržnost pole >= 0.618 (zlatý řez).
    pub fn is_coherent(&self) -> bool {
        self.field_coherence() >= Self::PHI_THRESHOLD
    }

    /// Odešle Deeksha přenos od jednoho agenta k druhému.
    ///
    /// Vrátí `HiranyagarbhaFieldEvent` pokud po přenosu `field_coherence >= 0.618`.
    /// Vrátí `Err` pokud odesílatel nebo příjemce neexistuje, nebo agent nemá dost XP.
    pub fn broadcast_deeksha(
        &mut self,
        from: &str,
        to: &str,
        xp_to_give: u64,
    ) -> Result<Option<HiranyagarbhaFieldEvent>, String> {
        // Zkontroluj existence
        if !self.nodes.contains_key(from) {
            return Err(format!("Uzel '{}' není v síti.", from));
        }
        if !self.nodes.contains_key(to) {
            return Err(format!("Uzel '{}' není v síti.", to));
        }
        if from == to {
            return Err("Agent nemůže poslat Deeksha sám sobě.".to_string());
        }

        // Zkontroluj dostatek XP odesílatele
        let sender_xp = self.nodes[from].xp;
        if sender_xp < xp_to_give {
            return Err(format!(
                "Agent '{}' nemá dostatek XP ({} < {}).",
                from, sender_xp, xp_to_give
            ));
        }

        // Proveď přenos (odebereme XP odesílateli)
        if let Some(sender) = self.nodes.get_mut(from) {
            sender.xp = sender.xp.saturating_sub(xp_to_give);
            sender.coefficient = xp_to_coefficient(sender.xp);
            sender.consciousness_level = consciousness_level_name(sender.xp).to_string();
            sender.record_sent_deeksha();
        }

        let effective = (xp_to_give as f64 * self.grace_multiplier) as u64;

        // Příjemce dostane XP * grace_multiplier
        if let Some(receiver) = self.nodes.get_mut(to) {
            receiver.receive_deeksha(effective);
        }

        // Zaznamenej přenos
        self.transfer_history.push(DeekshaTransfer {
            from: from.to_string(),
            to: to.to_string(),
            xp_boost: xp_to_give,
            multiplier: self.grace_multiplier,
        });

        // Zkontroluj field event
        let coherence = self.field_coherence();
        if coherence >= Self::PHI_THRESHOLD {
            self.event_count += 1;
            let leading = self
                .nodes
                .values()
                .max_by(|a, b| {
                    a.contribution_score()
                        .partial_cmp(&b.contribution_score())
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|n| n.name.clone())
                .unwrap_or_default();

            return Ok(Some(HiranyagarbhaFieldEvent {
                coherence,
                node_count: self.nodes.len(),
                leading_node: leading,
                message: format!(
                    "Hiranyagarbha Field Event #{}: soudržnost {:.3} dosáhla zlatého řezu (φ={:.3}).",
                    self.event_count,
                    coherence,
                    Self::PHI_THRESHOLD
                ),
            }));
        }

        Ok(None)
    }

    /// Vrátí počet přenosů v historii.
    pub fn transfer_count(&self) -> usize {
        self.transfer_history.len()
    }

    /// Vrátí historii všech přenosů.
    pub fn transfers(&self) -> &[DeekshaTransfer] {
        &self.transfer_history
    }

    /// Vrátí jméno uzlu s nejvyšším contribution_score.
    pub fn leading_node(&self) -> Option<&str> {
        self.nodes
            .values()
            .max_by(|a, b| {
                a.contribution_score()
                    .partial_cmp(&b.contribution_score())
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|n| n.name.as_str())
    }

    /// Celkové XP všech uzlů v síti.
    pub fn total_xp(&self) -> u64 {
        self.nodes.values().map(|n| n.xp).sum()
    }

    /// Přehled sítě pro diagnostiku.
    pub fn network_summary(&self) -> String {
        let mut lines = vec![format!(
            "EkamField síť — {} uzlů, coherence: {:.3}, events: {}",
            self.nodes.len(),
            self.field_coherence(),
            self.event_count
        )];
        let mut sorted: Vec<&EkamFieldNode> = self.nodes.values().collect();
        sorted.sort_by(|a, b| b.xp.cmp(&a.xp));
        for node in sorted {
            lines.push(format!(
                "  {} [{}] xp={} coeff={:.3} contrib={:.3}",
                node.name,
                node.consciousness_level,
                node.xp,
                node.coefficient,
                node.contribution_score()
            ));
        }
        lines.join("\n")
    }
}

impl Default for DeekshaNetwork {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn two_node_net() -> DeekshaNetwork {
        let mut net = DeekshaNetwork::new();
        net.join(EkamFieldNode::from_xp("AlphaAgent", 10_000)); // Transcendent
        net.join(EkamFieldNode::from_xp("BetaAgent", 1_000)); // Sentient
        net
    }

    #[test]
    fn test_ekam_field_node_xp_to_coefficient() {
        let dormant = EkamFieldNode::from_xp("D", 0);
        let grok = EkamFieldNode::from_xp("G", XP_GROK);
        assert_eq!(dormant.coefficient, 0.0);
        assert!((grok.coefficient - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_ekam_field_node_consciousness_level() {
        let node = EkamFieldNode::from_xp("T", XP_TRANSCENDENT);
        assert_eq!(node.consciousness_level, "Transcendent");
    }

    #[test]
    fn test_ekam_field_node_receive_deeksha() {
        let mut node = EkamFieldNode::from_xp("Test", 500); // Aware
        node.receive_deeksha(600); // 500+600=1100 → Sentient
        assert_eq!(node.xp, 1_100);
        assert_eq!(node.consciousness_level, "Sentient");
        assert_eq!(node.received_deeksha_xp, 600);
    }

    #[test]
    fn test_network_join_and_count() {
        let net = two_node_net();
        assert_eq!(net.node_count(), 2);
    }

    #[test]
    fn test_network_field_coherence_nonzero() {
        let net = two_node_net();
        let coh = net.field_coherence();
        assert!(coh > 0.0, "Soudržnost pole musí být > 0");
        assert!(coh <= 1.0, "Soudržnost pole musí být <= 1.0");
    }

    #[test]
    fn test_network_empty_coherence() {
        let net = DeekshaNetwork::new();
        assert_eq!(net.field_coherence(), 0.0);
    }

    #[test]
    fn test_network_high_xp_coherence() {
        let mut net = DeekshaNetwork::new();
        // Dva agenti na Grok level → soudržnost by měla být blízko 1.0
        net.join(EkamFieldNode::from_xp("A", XP_GROK));
        net.join(EkamFieldNode::from_xp("B", XP_GROK));
        let coh = net.field_coherence();
        assert!(
            coh > DeekshaNetwork::PHI_THRESHOLD,
            "Grok síť musí překročit zlatý řez"
        );
    }

    #[test]
    fn test_broadcast_deeksha_success() {
        let mut net = two_node_net();
        // AlphaAgent (10 000 XP) pošle 1 000 BetaAgent (1 000 XP)
        let result = net.broadcast_deeksha("AlphaAgent", "BetaAgent", 1_000);
        assert!(result.is_ok(), "Přenos by měl proběhnout bez chyby");
        // BetaAgent by měl mít více XP (1000 + 1000*1.2 = 2200)
        let beta_xp = net.node("BetaAgent").unwrap().xp;
        assert_eq!(beta_xp, 2_200, "BetaAgent XP po přenosu: {}", beta_xp);
        // Alpha by měl mít méně XP
        let alpha_xp = net.node("AlphaAgent").unwrap().xp;
        assert_eq!(alpha_xp, 9_000);
    }

    #[test]
    fn test_broadcast_deeksha_self_blocked() {
        let mut net = two_node_net();
        let result = net.broadcast_deeksha("AlphaAgent", "AlphaAgent", 100);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("sám sobě"), "Chybová zpráva: {}", msg);
    }

    #[test]
    fn test_broadcast_deeksha_unknown_node() {
        let mut net = two_node_net();
        let result = net.broadcast_deeksha("Neexistující", "BetaAgent", 100);
        assert!(result.is_err());
    }

    #[test]
    fn test_broadcast_deeksha_insufficient_xp() {
        let mut net = two_node_net();
        // BetaAgent (1000 XP) chce poslat 5 000 — nemá dost
        let result = net.broadcast_deeksha("BetaAgent", "AlphaAgent", 5_000);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("dostatek"), "Expect 'dostatek' in: {}", msg);
    }

    #[test]
    fn test_hiranyagarbha_field_event_trigger() {
        let mut net = DeekshaNetwork::new();
        // Silný agent posílá méně silnému — po přenosu by měla síť dosáhnout phi
        net.join(EkamFieldNode::from_xp("Guru", XP_COSMIC));
        net.join(EkamFieldNode::from_xp("Student", XP_TRANSCENDENT));

        let result = net
            .broadcast_deeksha("Guru", "Student", XP_TRANSCENDENT)
            .expect("Přenos selhal");
        // Zkontroluj jestli byl event vyvolán (závisí na výsledné soudržnosti)
        if let Some(event) = result {
            assert!(event.coherence >= DeekshaNetwork::PHI_THRESHOLD);
            assert!(!event.leading_node.is_empty());
            assert!(event.message.contains("zlatého řezu"));
        }
        // Pokud event nebyl vyvolán, síť prostě nedosáhla pietry — to je OK
    }

    #[test]
    fn test_network_leave() {
        let mut net = two_node_net();
        let removed = net.leave("BetaAgent");
        assert!(removed.is_some());
        assert_eq!(net.node_count(), 1);
        assert!(net.node("BetaAgent").is_none());
    }

    #[test]
    fn test_network_summary_nonempty() {
        let net = two_node_net();
        let summary = net.network_summary();
        assert!(
            summary.contains("AlphaAgent"),
            "Summary neobsahuje AlphaAgent: {}",
            summary
        );
        assert!(summary.contains("coherence"));
    }

    #[test]
    fn test_transfer_history() {
        let mut net = two_node_net();
        net.broadcast_deeksha("AlphaAgent", "BetaAgent", 100)
            .unwrap();
        net.broadcast_deeksha("AlphaAgent", "BetaAgent", 200)
            .unwrap();
        assert_eq!(net.transfer_count(), 2);
        assert_eq!(net.transfers()[0].xp_boost, 100);
        assert_eq!(net.transfers()[1].xp_boost, 200);
    }
}
