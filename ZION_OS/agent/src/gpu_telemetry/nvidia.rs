use super::types::GpuTelemetry;

#[cfg(feature = "nvidia")]
pub async fn collect_nvidia_telemetry() -> anyhow::Result<Vec<GpuTelemetry>> {
    use nvml_wrapper::Nvml;
    use tracing::warn;

    let nvml = Nvml::init()?;
    let count = nvml.device_count()?;
    let mut gpus = Vec::new();

    for i in 0..count {
        match nvml.device_by_index(i) {
            Ok(device) => {
                let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".to_string());
                let mut gpu = GpuTelemetry::stub(i, &name, "NVIDIA");

                // Teplota
                if let Ok(temp) = device.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu) {
                    gpu.temperature_core = Some(temp as f32);
                }

                // Power
                if let Ok(power) = device.power_usage() {
                    gpu.power_watts = Some(power as f32 / 1000.0);
                }
                if let Ok(limit) = device.power_management_limit() {
                    gpu.power_limit_watts = Some(limit as f32 / 1000.0);
                }

                // Utilization
                if let Ok(util) = device.utilization_rates() {
                    gpu.core_utilization = Some(util.gpu as u32);
                    gpu.memory_utilization = Some(util.memory as u32);
                }

                // Memory
                if let Ok(mem) = device.memory_info() {
                    gpu.memory_used_mb = Some(mem.used / 1024 / 1024);
                    gpu.memory_total_mb = Some(mem.total / 1024 / 1024);
                }

                // Clocks
                if let Ok(clock) = device.clock_info(nvml_wrapper::enum_wrappers::device::Clock::Graphics) {
                    gpu.core_clock_mhz = Some(clock / 1000);
                }
                if let Ok(clock) = device.clock_info(nvml_wrapper::enum_wrappers::device::Clock::Mem) {
                    gpu.memory_clock_mhz = Some(clock / 1000);
                }

                // Fan speed
                if let Ok(fan) = device.fan_speed(0) {
                    gpu.fan_percent = Some(fan);
                }

                gpus.push(gpu);
            }
            Err(e) => {
                warn!("NVML device {} error: {}", i, e);
            }
        }
    }

    Ok(gpus)
}

#[cfg(not(feature = "nvidia"))]
pub async fn collect_nvidia_telemetry() -> anyhow::Result<Vec<GpuTelemetry>> {
    Ok(vec![])
}
