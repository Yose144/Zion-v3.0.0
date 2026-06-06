#!/usr/bin/env python3
"""
Zion OS Orchestrator
Kompletni rizeni celeho Zion Mainnet ekosystemu
Cte manifest.yaml a orchestruje vsechny sluzby L1-L6, monitoring, auto-update
"""

import yaml
import json
import subprocess
import time
import os
import sys
import signal
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

class ServiceState(Enum):
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    DEGRADED = "degraded"
    FAILED = "failed"
    RESTARTING = "restarting"

@dataclass
class ServiceStatus:
    name: str
    layer: str
    state: ServiceState
    pid: Optional[int]
    uptime: float
    last_check: datetime
    health_ok: bool
    restart_count: int
    error_message: Optional[str]

class ZionOrchestrator:
    def __init__(self, manifest_path: str = "ZION_OS/orchestrator/manifest.yaml"):
        self.manifest_path = manifest_path
        self.manifest = self._load_manifest()
        self.services: Dict[str, ServiceStatus] = {}
        self.running = False
        self.profiles = self.manifest.get("profiles", {})
        self._setup_signal_handlers()

    def _load_manifest(self) -> dict:
        with open(self.manifest_path, 'r') as f:
            return yaml.safe_load(f)

    def _setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

    def _handle_signal(self, signum, frame):
        print(f"\nReceived signal {signum}, shutting down gracefully...")
        self.stop_all()
        sys.exit(0)

    def get_services(self) -> Dict[str, dict]:
        return self.manifest.get("services", {})

    def get_service(self, name: str) -> Optional[dict]:
        return self.get_services().get(name)

    def list_services(self, layer: Optional[str] = None) -> List[str]:
        services = self.get_services()
        if layer:
            return [name for name, svc in services.items() if svc.get("layer") == layer]
        return list(services.keys())

    def list_layers(self) -> List[str]:
        layers = set()
        for svc in self.get_services().values():
            layers.add(svc.get("layer", "unknown"))
        return sorted(list(layers))

    def get_profile_services(self, profile: str) -> List[str]:
        profile_config = self.profiles.get(profile, {})
        return profile_config.get("services", [])

    def _check_health(self, service_name: str, service_config: dict) -> bool:
        health = service_config.get("health_check", {})
        check_type = health.get("type", "none")

        if check_type == "none":
            return True

        try:
            if check_type == "tcp":
                import socket
                port = health.get("port", 80)
                host = "127.0.0.1"
                with socket.create_connection((host, port), timeout=5):
                    return True

            elif check_type == "http":
                import urllib.request
                endpoint = health.get("endpoint", "")
                timeout = health.get("timeout", 5)
                req = urllib.request.Request(endpoint, method='GET')
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.status == 200

            elif check_type == "rpc":
                import urllib.request
                endpoint = health.get("endpoint", "")
                method = health.get("method", "getblockchaininfo")
                timeout = health.get("timeout", 5)
                payload = json.dumps({"jsonrpc": "2.0", "method": method, "id": 1}).encode()
                req = urllib.request.Request(
                    endpoint,
                    data=payload,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.status == 200

            elif check_type == "log":
                log_file = health.get("file", "")
                pattern = health.get("pattern", "")
                if os.path.exists(log_file):
                    with open(log_file, 'r') as f:
                        content = f.read()
                        return pattern in content
                return False

            elif check_type == "process":
                pattern = health.get("pattern", "")
                result = subprocess.run(
                    ["pgrep", "-f", pattern],
                    capture_output=True,
                    text=True
                )
                return result.returncode == 0

        except Exception as e:
            return False

        return False

    def _get_service_pid(self, service_name: str) -> Optional[int]:
        service_config = self.get_service(service_name)
        if not service_config:
            return None

        binary = service_config.get("binary", "")
        result = subprocess.run(
            ["pgrep", "-f", binary],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            try:
                return int(result.stdout.strip().split('\n')[0])
            except ValueError:
                return None
        return None

    def check_service(self, service_name: str) -> ServiceStatus:
        service_config = self.get_service(service_name)
        if not service_config:
            return ServiceStatus(
                name=service_name,
                layer="unknown",
                state=ServiceState.FAILED,
                pid=None,
                uptime=0,
                last_check=datetime.now(),
                health_ok=False,
                restart_count=0,
                error_message="Service not found in manifest"
            )

        pid = self._get_service_pid(service_name)
        layer = service_config.get("layer", "unknown")

        if pid:
            health_ok = self._check_health(service_name, service_config)
            state = ServiceState.RUNNING if health_ok else ServiceState.DEGRADED

            # Get uptime from /proc
            try:
                with open(f"/proc/{pid}/stat", 'r') as f:
                    stat = f.read().split()
                    start_time = int(stat[21])
                    uptime_seconds = float(open('/proc/uptime').read().split()[0])
                    uptime = uptime_seconds - (start_time / os.sysconf(os.sysconf_names['SC_CLK_TCK']))
            except:
                uptime = 0

            return ServiceStatus(
                name=service_name,
                layer=layer,
                state=state,
                pid=pid,
                uptime=uptime,
                last_check=datetime.now(),
                health_ok=health_ok,
                restart_count=0,
                error_message=None
            )
        else:
            return ServiceStatus(
                name=service_name,
                layer=layer,
                state=ServiceState.STOPPED,
                pid=None,
                uptime=0,
                last_check=datetime.now(),
                health_ok=False,
                restart_count=0,
                error_message=None
            )

    def check_all(self) -> Dict[str, ServiceStatus]:
        services = self.get_services()
        results = {}
        for name in services:
            results[name] = self.check_service(name)
        self.services = results
        return results

    def start_service(self, service_name: str) -> bool:
        service_config = self.get_service(service_name)
        if not service_config:
            print(f"ERROR: Service {service_name} not found in manifest")
            return False

        # Check dependencies
        deps = service_config.get("depends_on", [])
        for dep in deps:
            status = self.check_service(dep)
            if status.state != ServiceState.RUNNING:
                print(f"WARNING: Dependency {dep} is not running, starting it first...")
                self.start_service(dep)

        # Check if already running
        existing = self.check_service(service_name)
        if existing.state == ServiceState.RUNNING:
            print(f"Service {service_name} is already running (PID: {existing.pid})")
            return True

        binary = service_config.get("binary", "")
        args = service_config.get("args", [])
        env = service_config.get("env", {})
        log_file = service_config.get("log_file", f"logs/{service_name}.log")

        # Prepare environment
        service_env = os.environ.copy()
        service_env.update(env)

        # Prepare command
        cmd = [binary] + args

        # Ensure log directory exists
        os.makedirs(os.path.dirname(log_file) if os.path.dirname(log_file) else ".", exist_ok=True)

        try:
            with open(log_file, 'a') as log:
                log.write(f"\n[{datetime.now().isoformat()}] Starting {service_name}\n")
                process = subprocess.Popen(
                    cmd,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    env=service_env,
                    start_new_session=True
                )

            print(f"Started {service_name} (PID: {process.pid})")
            time.sleep(2)  # Give service time to start
            return True

        except Exception as e:
            print(f"ERROR starting {service_name}: {e}")
            return False

    def stop_service(self, service_name: str) -> bool:
        status = self.check_service(service_name)
        if status.state == ServiceState.STOPPED:
            print(f"Service {service_name} is already stopped")
            return True

        if status.pid:
            try:
                os.kill(status.pid, signal.SIGTERM)
                print(f"Stopped {service_name} (PID: {status.pid})")
                time.sleep(2)
                return True
            except ProcessLookupError:
                print(f"Service {service_name} process not found")
                return True
            except Exception as e:
                print(f"ERROR stopping {service_name}: {e}")
                return False

        return False

    def restart_service(self, service_name: str) -> bool:
        print(f"Restarting {service_name}...")
        self.stop_service(service_name)
        time.sleep(2)
        return self.start_service(service_name)

    def start_all(self, profile: Optional[str] = None):
        if profile:
            services = self.get_profile_services(profile)
            print(f"Starting services for profile: {profile}")
        else:
            services = list(self.get_services().keys())
            print("Starting all services")

        for service_name in services:
            self.start_service(service_name)
            time.sleep(1)

    def stop_all(self, profile: Optional[str] = None):
        if profile:
            services = self.get_profile_services(profile)
            print(f"Stopping services for profile: {profile}")
        else:
            services = list(self.get_services().keys())
            print("Stopping all services")

        # Stop in reverse dependency order
        for service_name in reversed(services):
            self.stop_service(service_name)
            time.sleep(0.5)

    def restart_all(self, profile: Optional[str] = None):
        self.stop_all(profile)
        time.sleep(3)
        self.start_all(profile)

    def status(self, service_name: Optional[str] = None) -> str:
        if service_name:
            status = self.check_service(service_name)
            return self._format_status(status)

        results = self.check_all()
        output = []
        output.append("╔══════════════════════════════════════════════════════════════╗")
        output.append("║         Zion OS Orchestrator - Service Status              ║")
        output.append("╚══════════════════════════════════════════════════════════════╝")

        # Group by layer
        layers = {}
        for name, status in results.items():
            layer = status.layer
            if layer not in layers:
                layers[layer] = []
            layers[layer].append((name, status))

        for layer in sorted(layers.keys()):
            output.append(f"\n[{layer}]")
            output.append("─" * 60)
            for name, status in layers[layer]:
                emoji = "🟢" if status.state == ServiceState.RUNNING else "🟡" if status.state == ServiceState.DEGRADED else "🔴"
                pid_str = f"PID:{status.pid}" if status.pid else "N/A"
                uptime_str = f"{status.uptime:.0f}s" if status.uptime else "N/A"
                output.append(f"  {emoji} {name:<30} {status.state.value:<10} {pid_str:<12} {uptime_str}")

        return "\n".join(output)

    def _format_status(self, status: ServiceStatus) -> str:
        emoji = "🟢" if status.state == ServiceState.RUNNING else "🟡" if status.state == ServiceState.DEGRADED else "🔴"
        lines = [
            f"Service: {status.name}",
            f"Layer: {status.layer}",
            f"State: {emoji} {status.state.value}",
            f"PID: {status.pid or 'N/A'}",
            f"Uptime: {status.uptime:.0f}s" if status.uptime else "Uptime: N/A",
            f"Health: {'OK' if status.health_ok else 'FAIL'}",
            f"Last Check: {status.last_check.isoformat()}",
        ]
        if status.error_message:
            lines.append(f"Error: {status.error_message}")
        return "\n".join(lines)

    def health_report(self) -> dict:
        results = self.check_all()
        total = len(results)
        running = sum(1 for s in results.values() if s.state == ServiceState.RUNNING)
        degraded = sum(1 for s in results.values() if s.state == ServiceState.DEGRADED)
        failed = sum(1 for s in results.values() if s.state == ServiceState.FAILED)
        stopped = sum(1 for s in results.values() if s.state == ServiceState.STOPPED)

        return {
            "timestamp": datetime.now().isoformat(),
            "total_services": total,
            "running": running,
            "degraded": degraded,
            "failed": failed,
            "stopped": stopped,
            "health_percentage": (running / total * 100) if total > 0 else 0,
            "services": {name: asdict(status) for name, status in results.items()}
        }

    def watch(self, interval: int = 10):
        """Continuous monitoring loop"""
        self.running = True
        print("Starting Zion OS Orchestrator watch mode...")
        print(f"Checking health every {interval} seconds")
        print("Press Ctrl+C to stop\n")

        while self.running:
            try:
                os.system('clear' if os.name != 'nt' else 'cls')
                print(self.status())
                print(f"\nHealth: {self.health_report()['health_percentage']:.1f}%")
                time.sleep(interval)
            except KeyboardInterrupt:
                self.running = False
                break

def main():
    parser = argparse.ArgumentParser(
        description="Zion OS Orchestrator - Manage entire Zion Mainnet ecosystem"
    )
    parser.add_argument(
        "command",
        choices=["start", "stop", "restart", "status", "check", "watch", "health"],
        help="Command to execute"
    )
    parser.add_argument(
        "--service", "-s",
        help="Target service name"
    )
    parser.add_argument(
        "--profile", "-p",
        help="Profile name (minimal, dev, mainnet, full)"
    )
    parser.add_argument(
        "--manifest", "-m",
        default="ZION_OS/orchestrator/manifest.yaml",
        help="Path to manifest file"
    )
    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=10,
        help="Watch interval in seconds"
    )

    args = parser.parse_args()

    orchestrator = ZionOrchestrator(manifest_path=args.manifest)

    if args.command == "start":
        if args.service:
            orchestrator.start_service(args.service)
        else:
            orchestrator.start_all(args.profile)

    elif args.command == "stop":
        if args.service:
            orchestrator.stop_service(args.service)
        else:
            orchestrator.stop_all(args.profile)

    elif args.command == "restart":
        if args.service:
            orchestrator.restart_service(args.service)
        else:
            orchestrator.restart_all(args.profile)

    elif args.command == "status":
        print(orchestrator.status(args.service))

    elif args.command == "check":
        results = orchestrator.check_all()
        for name, status in results.items():
            print(f"{name}: {status.state.value} (PID: {status.pid}, Health: {status.health_ok})")

    elif args.command == "watch":
        orchestrator.watch(interval=args.interval)

    elif args.command == "health":
        report = orchestrator.health_report()
        print(json.dumps(report, indent=2, default=str))

if __name__ == "__main__":
    main()
