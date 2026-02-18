#!/usr/bin/env python3
"""
📊 Real-time Mining Metrics Display
Professional mining stats display podobné SRBMiner-MULTI

Features:
- Live hashrate monitoring
- Share statistics
- GPU/CPU temperature
- Power consumption
- Efficiency metrics
- Pool connection status
"""

import time
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import threading


class RealtimeMetricsDisplay:
    """Real-time mining metrics display"""
    
    def __init__(self):
        self.enabled = True
        self.update_interval = 2.0  # seconds
        self.last_update = time.time()
        
        # Metrics data
        self.metrics = {
            'hashrate_current': 0,
            'hashrate_avg': 0,
            'hashrate_1min': 0,
            'hashrate_5min': 0,
            'shares_total': 0,
            'shares_accepted': 0,
            'shares_rejected': 0,
            'pool_diff': 0,
            'uptime': 0,
            'start_time': time.time(),
            'gpu_temp': 0,
            'gpu_fan': 0,
            'gpu_power': 0,
            'cpu_temp': 0,
            'cpu_usage': 0,
            'pool_latency': 0,
            'algorithm': 'unknown',
            'worker_name': 'zion-miner',
            'pool_url': '',
            'mode': 'hybrid'
        }
        
        # Historical data for averages
        self.hashrate_history: List[tuple] = []  # (timestamp, hashrate)
        self.max_history = 300  # 5 minutes at 1Hz
        
        self.display_thread = None
        self.running = False
    
    def start(self):
        """Start real-time display"""
        self.running = True
        self.display_thread = threading.Thread(target=self._display_loop, daemon=True)
        self.display_thread.start()
    
    def stop(self):
        """Stop display"""
        self.running = False
        if self.display_thread:
            self.display_thread.join(timeout=2)
    
    def update(self, **kwargs):
        """Update metrics"""
        for key, value in kwargs.items():
            if key in self.metrics:
                self.metrics[key] = value
        
        # Update hashrate history
        if 'hashrate_current' in kwargs:
            now = time.time()
            self.hashrate_history.append((now, kwargs['hashrate_current']))
            
            # Trim old data
            cutoff = now - 300  # 5 minutes
            self.hashrate_history = [(t, h) for t, h in self.hashrate_history if t > cutoff]
            
            # Calculate averages
            self._calculate_averages()
    
    def _calculate_averages(self):
        """Calculate hashrate averages"""
        if not self.hashrate_history:
            return
        
        now = time.time()
        
        # 1 minute average
        recent_1min = [(t, h) for t, h in self.hashrate_history if now - t <= 60]
        if recent_1min:
            self.metrics['hashrate_1min'] = sum(h for _, h in recent_1min) / len(recent_1min)
        
        # 5 minute average
        recent_5min = [(t, h) for t, h in self.hashrate_history if now - t <= 300]
        if recent_5min:
            self.metrics['hashrate_5min'] = sum(h for _, h in recent_5min) / len(recent_5min)
        
        # Overall average
        if self.hashrate_history:
            self.metrics['hashrate_avg'] = sum(h for _, h in self.hashrate_history) / len(self.hashrate_history)
    
    def _display_loop(self):
        """Display loop - updates terminal"""
        while self.running:
            try:
                if time.time() - self.last_update >= self.update_interval:
                    self._render()
                    self.last_update = time.time()
                
                time.sleep(0.5)
            except Exception as e:
                print(f"Display error: {e}")
    
    def _render(self):
        """Render metrics to terminal"""
        # Clear screen (ANSI escape codes)
        if sys.platform != 'win32':
            os.system('clear')
        else:
            os.system('cls')
        
        # Header
        print("=" * 100)
        print(" 🔥 ZION UNIVERSAL AI MINER - Real-time Metrics                   ")
        print("=" * 100)
        print()
        
        # Uptime
        uptime = int(time.time() - self.metrics['start_time'])
        uptime_str = str(timedelta(seconds=uptime))
        
        # Acceptance rate
        total_shares = self.metrics['shares_total']
        accepted = self.metrics['shares_accepted']
        rejected = self.metrics['shares_rejected']
        acceptance_rate = (accepted / total_shares * 100) if total_shares > 0 else 0
        
        # Algorithm & Mode
        print(f" 🎯 Algorithm: {self.metrics['algorithm'].upper():15}    Mode: {self.metrics['mode'].upper():10}    Uptime: {uptime_str}")
        print(f" 🌐 Pool: {self.metrics['pool_url']:50}    Worker: {self.metrics['worker_name']}")
        print()
        
        # Hashrate section
        print(" ⚡ HASHRATE PERFORMANCE")
        print("-" * 100)
        hr_current = self.metrics['hashrate_current']
        hr_avg = self.metrics['hashrate_avg']
        hr_1min = self.metrics['hashrate_1min']
        hr_5min = self.metrics['hashrate_5min']
        
        print(f"   Current:  {self._format_hashrate(hr_current):>15}    " +
              f"Avg (1m):  {self._format_hashrate(hr_1min):>15}    " +
              f"Avg (5m):  {self._format_hashrate(hr_5min):>15}")
        print(f"   Overall:  {self._format_hashrate(hr_avg):>15}")
        print()
        
        # Shares section
        print(" 📦 SHARES & POOL")
        print("-" * 100)
        print(f"   Total: {total_shares:>8}    Accepted: {accepted:>8} ✅    Rejected: {rejected:>8} ❌    " +
              f"Rate: {acceptance_rate:>6.2f}%")
        print(f"   Pool Difficulty: {self.metrics['pool_diff']:>12}    Latency: {self.metrics['pool_latency']:>6.0f} ms")
        print()
        
        # Hardware section
        print(" 🖥️  HARDWARE STATUS")
        print("-" * 100)
        
        # GPU stats
        if self.metrics['mode'] in ('gpu', 'hybrid'):
            print(f"   GPU Temp: {self.metrics['gpu_temp']:>5.1f}°C    " +
                  f"Fan: {self.metrics['gpu_fan']:>3.0f}%    " +
                  f"Power: {self.metrics['gpu_power']:>5.1f}W")
        
        # CPU stats
        if self.metrics['mode'] in ('cpu', 'hybrid'):
            print(f"   CPU Temp: {self.metrics['cpu_temp']:>5.1f}°C    " +
                  f"Usage: {self.metrics['cpu_usage']:>5.1f}%")
        
        # Efficiency
        total_power = self.metrics['gpu_power'] + (self.metrics['cpu_usage'] * 0.65)  # Estimate CPU power
        if total_power > 0:
            efficiency = hr_current / total_power
            print(f"   Power Efficiency: {efficiency:>10.0f} H/W    Total Power: {total_power:>6.1f}W")
        
        print()
        
        # Footer
        print("=" * 100)
        print(f" 🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                         " +
              f"Press Ctrl+C to stop mining")
        print("=" * 100)
    
    def _format_hashrate(self, hashrate: float) -> str:
        """Format hashrate with appropriate unit"""
        if hashrate == 0:
            return "0 H/s"
        elif hashrate >= 1_000_000_000:  # GH/s
            return f"{hashrate / 1_000_000_000:.2f} GH/s"
        elif hashrate >= 1_000_000:  # MH/s
            return f"{hashrate / 1_000_000:.2f} MH/s"
        elif hashrate >= 1_000:  # kH/s
            return f"{hashrate / 1_000:.2f} kH/s"
        else:
            return f"{hashrate:.2f} H/s"
    
    def print_summary(self):
        """Print final summary on exit"""
        print("\n")
        print("=" * 100)
        print(" 📊 MINING SESSION SUMMARY")
        print("=" * 100)
        
        uptime = int(time.time() - self.metrics['start_time'])
        uptime_str = str(timedelta(seconds=uptime))
        
        total_shares = self.metrics['shares_total']
        accepted = self.metrics['shares_accepted']
        rejected = self.metrics['shares_rejected']
        acceptance_rate = (accepted / total_shares * 100) if total_shares > 0 else 0
        
        print(f"\n Algorithm: {self.metrics['algorithm']}")
        print(f" Duration:  {uptime_str}")
        print(f" Average Hashrate: {self._format_hashrate(self.metrics['hashrate_avg'])}")
        print(f" Total Shares: {total_shares} (✅ {accepted} accepted, ❌ {rejected} rejected)")
        print(f" Acceptance Rate: {acceptance_rate:.2f}%")
        print("\n" + "=" * 100 + "\n")


# Singleton instance
_metrics_display = None


def get_metrics_display() -> RealtimeMetricsDisplay:
    """Get global metrics display instance"""
    global _metrics_display
    if _metrics_display is None:
        _metrics_display = RealtimeMetricsDisplay()
    return _metrics_display


if __name__ == "__main__":
    # Test display
    display = RealtimeMetricsDisplay()
    display.start()
    
    # Simulate mining
    import random
    
    display.update(
        algorithm='cosmic_harmony',
        mode='gpu',
        pool_url='127.0.0.1:3333',
        worker_name='test-gpu-1'
    )
    
    try:
        for i in range(60):
            # Simulate varying hashrate
            hashrate = 450000 + random.randint(-20000, 20000)
            
            display.update(
                hashrate_current=hashrate,
                shares_total=i * 2,
                shares_accepted=i * 2,
                shares_rejected=0,
                gpu_temp=56 + random.randint(-2, 2),
                gpu_fan=70,
                gpu_power=150 + random.randint(-10, 10),
                pool_latency=15 + random.randint(-5, 5)
            )
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        pass
    
    display.stop()
    display.print_summary()
