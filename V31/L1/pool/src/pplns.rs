use std::collections::HashMap;

use chrono::{DateTime, Utc};
use zion_l1_types::{Address, Amount};

#[derive(Clone, Debug)]
pub struct ShareRecord {
    pub worker: String,
    pub address: Address,
    pub value: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct PplnsState {
    pub window: std::collections::VecDeque<ShareRecord>,
    pub total: u64,
    pub window_size: usize,
    pub fee_bps: u16,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Payout {
    pub address: Address,
    pub amount: Amount,
}

impl PplnsState {
    pub fn new(window_size: usize) -> Self {
        Self {
            window: std::collections::VecDeque::with_capacity(window_size.min(1024)),
            total: 0,
            window_size,
            fee_bps: 0,
        }
    }

    pub fn new_with_fee(window_size: usize, fee_bps: u16) -> Self {
        let mut s = Self::new(window_size);
        s.fee_bps = fee_bps;
        s
    }

    pub fn set_fee_bps(&mut self, fee_bps: u16) {
        self.fee_bps = fee_bps;
    }

    pub fn add_share(&mut self, record: ShareRecord) {
        self.total = self.total.saturating_add(record.value);
        self.window.push_back(record);
        if self.window.len() > self.window_size {
            if let Some(old) = self.window.pop_front() {
                self.total = self.total.saturating_sub(old.value);
            }
        }
    }

    pub fn window_total(&self) -> u64 {
        self.total
    }

    pub fn payouts_for(&self, block_reward: Amount) -> Vec<Payout> {
        if self.total == 0 || block_reward.0 == 0 {
            return Vec::new();
        }
        let net_bps = 10000u16.saturating_sub(self.fee_bps);
        let net_reward = block_reward.0 * u128::from(net_bps) / 10000u128;
        if net_reward == 0 {
            return Vec::new();
        }

        let mut by_address: HashMap<String, (Address, u64)> = HashMap::new();
        for rec in &self.window {
            let entry = by_address
                .entry(rec.address.encoded.clone())
                .or_insert_with(|| (rec.address.clone(), 0));
            entry.1 += rec.value;
        }

        by_address
            .into_iter()
            .map(|(_, (address, value))| {
                let amount = net_reward * u128::from(value) / u128::from(self.total);
                Payout {
                    address,
                    amount: Amount(amount),
                }
            })
            .filter(|p| p.amount.0 > 0)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::ChainId;

    fn addr(n: u8) -> Address {
        Address::new(ChainId::ZionL1, vec![n; 20], format!("zion{n}")).unwrap()
    }

    #[test]
    fn add_and_total() {
        let mut p = PplnsState::new(3);
        p.add_share(ShareRecord {
            worker: "a".into(),
            address: addr(1),
            value: 10,
            timestamp: Utc::now(),
        });
        p.add_share(ShareRecord {
            worker: "b".into(),
            address: addr(2),
            value: 20,
            timestamp: Utc::now(),
        });
        assert_eq!(p.window_total(), 30);
        p.add_share(ShareRecord {
            worker: "c".into(),
            address: addr(3),
            value: 30,
            timestamp: Utc::now(),
        });
        p.add_share(ShareRecord {
            worker: "d".into(),
            address: addr(4),
            value: 40,
            timestamp: Utc::now(),
        });
        assert_eq!(p.window.len(), 3);
        assert_eq!(p.window_total(), 90);
    }

    #[test]
    fn payouts_sum() {
        let mut p = PplnsState::new_with_fee(10, 100);
        let a1 = addr(1);
        let a2 = addr(2);
        p.add_share(ShareRecord {
            worker: "a".into(),
            address: a1.clone(),
            value: 1,
            timestamp: Utc::now(),
        });
        p.add_share(ShareRecord {
            worker: "b".into(),
            address: a2.clone(),
            value: 3,
            timestamp: Utc::now(),
        });
        let reward = Amount(1_000_000);
        let payouts = p.payouts_for(reward);
        let total: u128 = payouts.iter().map(|p| p.amount.0).sum();
        let expected_net = reward.0 * 9900 / 10000;
        assert_eq!(total, expected_net);
        assert_eq!(payouts.len(), 2);
        let p1 = payouts.iter().find(|p| p.address == a1).unwrap();
        let p2 = payouts.iter().find(|p| p.address == a2).unwrap();
        assert_eq!(p1.amount.0, expected_net / 4);
        assert_eq!(p2.amount.0, expected_net * 3 / 4);
    }

    #[test]
    fn empty_payouts() {
        let p = PplnsState::new(10);
        assert!(p.payouts_for(Amount(100)).is_empty());
    }
}
