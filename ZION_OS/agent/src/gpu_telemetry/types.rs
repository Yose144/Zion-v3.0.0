use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuTelemetry {
    pub index: u32,
    pub name: String,
    pub vendor: String,
    pub pci_id: String,

    // Temperatures
    pub temperature_core: Option<f32>,      // °C
    pub temperature_hotspot: Option<f32>,  // °C (if available)
    pub temperature_memory: Option<f32>,    // °C (if available)

    // Power
    pub power_watts: Option<f32>,
    pub power_limit_watts: Option<f32>,

    // Clocks
    pub core_clock_mhz: Option<u32>,
    pub memory_clock_mhz: Option<u32>,

    // Utilization
    pub core_utilization: Option<u32>,     // 0-100%
    pub memory_utilization: Option<u32>,  // 0-100%

    // Fan
    pub fan_rpm: Option<u32>,
    pub fan_percent: Option<u32>,         // 0-100%

    // Memory
    pub memory_used_mb: Option<u64>,
    pub memory_total_mb: Option<u64>,

    // Mining-specific
    pub hashrate: Option<f64>,           // H/s
    pub shares_accepted: Option<u64>,
    pub shares_rejected: Option<u64>,
}

impl GpuTelemetry {
    pub fn stub(index: u32, name: &str, vendor: &str) -> Self {
        Self {
            index,
            name: name.to_string(),
            vendor: vendor.to_string(),
            pci_id: String::new(),
            temperature_core: None,
            temperature_hotspot: None,
            temperature_memory: None,
            power_watts: None,
            power_limit_watts: None,
            core_clock_mhz: None,
            memory_clock_mhz: None,
            core_utilization: None,
            memory_utilization: None,
            fan_rpm: None,
            fan_percent: None,
            memory_used_mb: None,
            memory_total_mb: None,
            hashrate: None,
            shares_accepted: None,
            shares_rejected: None,
        }
    }
}
