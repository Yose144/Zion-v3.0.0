import DeviceInfo from 'react-native-device-info';
import {CONFIG} from '../constants/config';

/**
 * Mining Service
 * Experimentální CPU mining pro Android/iOS
 * S DŮLEŽITÝMI VAROVÁNÍMI a bezpečnostními limity
 */

class MiningService {
  constructor() {
    this.isMining = false;
    this.startTime = null;
    this.hashrate = 0;
    this.shares = 0;
    this.temperature = 0;
    this.batteryLevel = 100;
    this.isCharging = false;
    this.isWiFi = false;
    this.monitoringInterval = null;
  }

  /**
   * Zkontrolovat, zda jsou splněny podmínky pro mining
   */
  async canStartMining() {
    const checks = {
      battery: await this.checkBattery(),
      charging: await this.checkCharging(),
      wifi: await this.checkWiFi(),
      temperature: await this.checkTemperature(),
    };

    const errors = [];
    
    if (!checks.battery) {
      errors.push(`Battery too low (${this.batteryLevel}%). Minimum ${CONFIG.MINING.MIN_BATTERY_PERCENT}% required.`);
    }
    
    if (CONFIG.MINING.REQUIRE_CHARGING && !checks.charging) {
      errors.push('Device must be charging');
    }
    
    if (CONFIG.MINING.REQUIRE_WIFI && !checks.wifi) {
      errors.push('WiFi connection required');
    }
    
    if (!checks.temperature) {
      errors.push(`Temperature too high (${this.temperature}°C)`);
    }

    return {
      canStart: errors.length === 0,
      errors,
    };
  }

  /**
   * Spustit mining
   */
  async startMining(walletAddress) {
    if (this.isMining) {
      throw new Error('Mining already running');
    }

    const check = await this.canStartMining();
    if (!check.canStart) {
      throw new Error(`Cannot start mining:\n${check.errors.join('\n')}`);
    }

    this.isMining = true;
    this.startTime = Date.now();
    this.shares = 0;
    
    // Start monitoring (kontrola každých 10s)
    this.monitoringInterval = setInterval(() => {
      this.monitorConditions();
    }, 10000);

    // Simulace mining (v produkci: skutečný mining algoritmus)
    this.simulateMining();

    console.log('Mining started for:', walletAddress);
  }

  /**
   * Zastavit mining
   */
  stopMining() {
    if (!this.isMining) {
      return;
    }

    this.isMining = false;
    this.startTime = null;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Mining stopped. Total shares:', this.shares);
  }

  /**
   * Monitoring podmínek během mining
   */
  async monitorConditions() {
    // Check max duration
    if (this.startTime) {
      const duration = (Date.now() - this.startTime) / 60000; // minutes
      if (duration >= CONFIG.MINING.MAX_DURATION_MINUTES) {
        console.log('Max mining duration reached, stopping...');
        this.stopMining();
        return;
      }
    }

    // Check conditions
    const check = await this.canStartMining();
    if (!check.canStart) {
      console.log('Mining conditions no longer met, stopping...', check.errors);
      this.stopMining();
    }
  }

  /**
   * Simulace mining (placeholder)
   * V produkci: nahradit skutečným mining algoritmem
   */
  simulateMining() {
    if (!this.isMining) return;

    // Simulace hashrate (1-50 H/s na mobilu)
    this.hashrate = 10 + Math.random() * 40;
    
    // Simulace share submission (každých ~30s)
    const shareChance = Math.random();
    if (shareChance < 0.03) { // 3% šance každou sekundu = ~30s průměrně
      this.shares++;
      console.log('Share submitted!', this.shares);
    }

    // Pokračovat
    setTimeout(() => this.simulateMining(), 1000);
  }

  /**
   * Získat aktuální mining statistiky
   */
  getStats() {
    const runtime = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const remainingTime = CONFIG.MINING.MAX_DURATION_MINUTES * 60 - runtime;

    return {
      isMining: this.isMining,
      hashrate: this.hashrate,
      shares: this.shares,
      runtime,
      remainingTime: Math.max(0, remainingTime),
      temperature: this.temperature,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      isWiFi: this.isWiFi,
    };
  }

  // ===== Checking Methods =====

  async checkBattery() {
    try {
      this.batteryLevel = await DeviceInfo.getBatteryLevel() * 100;
      return this.batteryLevel >= CONFIG.MINING.MIN_BATTERY_PERCENT;
    } catch {
      return true; // Pokud nelze zjistit, povolit
    }
  }

  async checkCharging() {
    try {
      // V React Native je potřeba použít battery-state package
      // Placeholder: předpokládejme charging
      this.isCharging = true;
      return true;
    } catch {
      return true;
    }
  }

  async checkWiFi() {
    try {
      // V React Native je potřeba použít netinfo package
      // Placeholder: předpokládejme WiFi
      this.isWiFi = true;
      return true;
    } catch {
      return true;
    }
  }

  async checkTemperature() {
    try {
      // V React Native není přímý způsob měření teploty
      // Použít native moduly nebo předpokládat OK
      this.temperature = 35; // Placeholder
      return this.temperature < CONFIG.MINING.MAX_TEMPERATURE_C;
    } catch {
      return true;
    }
  }
}

export default new MiningService();
