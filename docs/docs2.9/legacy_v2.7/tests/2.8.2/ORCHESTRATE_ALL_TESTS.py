#!/usr/bin/env python3
"""
🧪 ZION 2.8.2 Nebula - Complete Test Orchestrator

Runs all tests in proper sequence with detailed reporting.

Usage:
    python ORCHESTRATE_ALL_TESTS.py              # Run all tests
    python ORCHESTRATE_ALL_TESTS.py --quick      # Quick smoke tests
    python ORCHESTRATE_ALL_TESTS.py --verbose    # Detailed output
    python ORCHESTRATE_ALL_TESTS.py --report     # Generate HTML report
"""

import os
import sys
import json
import time
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_ROOT = Path(__file__).parent.parent.parent
TESTS_DIR = PROJECT_ROOT / "tests" / "2.8.2"
REPORTS_DIR = PROJECT_ROOT / "reports"

# Ensure reports directory exists
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Test categories and their test files
TEST_CATEGORIES = {
    "unit": [
        "test_complete_suite.py",
    ],
    "mining": [
        "mining/test_gpu_ai_miner.py",
    ],
    "cosmic_harmony": [
        "cosmic_harmony/test_cosmic_harmony_algorithm.py",
    ],
    "integration": [
        "integration/test_real_live.py",
    ],
}

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def print_banner():
    """Print welcome banner"""
    print(f"""
{Colors.BLUE}{Colors.BOLD}
╔════════════════════════════════════════════════════════════╗
║  ZION 2.8.2 Nebula - Complete Test Orchestrator           ║
║  Comprehensive testing suite for all components           ║
╚════════════════════════════════════════════════════════════╝
{Colors.ENDC}
""")

def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.CYAN}{Colors.BOLD}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{Colors.ENDC}\n")

def print_test(test_name: str, status: str, duration: float = 0):
    """Print test result"""
    status_colors = {
        "PASS": Colors.GREEN,
        "FAIL": Colors.RED,
        "SKIP": Colors.YELLOW,
    }
    color = status_colors.get(status, Colors.BLUE)
    time_str = f"({duration:.2f}s)" if duration else ""
    print(f"{color}[{status:4s}]{Colors.ENDC} {test_name:50s} {time_str}")

def print_summary(results: Dict):
    """Print test summary"""
    total = results["total"]
    passed = results["passed"]
    failed = results["failed"]
    skipped = results["skipped"]
    duration = results["duration"]
    
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"\n{Colors.BOLD}Test Summary:{Colors.ENDC}")
    print(f"  Total:    {total}")
    print(f"  {Colors.GREEN}Passed:   {passed}{Colors.ENDC}")
    print(f"  {Colors.RED}Failed:   {failed}{Colors.ENDC}")
    print(f"  {Colors.YELLOW}Skipped:  {skipped}{Colors.ENDC}")
    print(f"  Success Rate: {success_rate:.1f}%")
    print(f"  Duration: {duration:.2f}s")

# ============================================================================
# TEST RUNNER
# ============================================================================

class TestOrchestrator:
    def __init__(self, verbose=False, quick=False):
        self.verbose = verbose
        self.quick = quick
        self.results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "tests": [],
            "duration": 0,
            "timestamp": datetime.now().isoformat(),
        }
        self.start_time = time.time()
    
    def run_all_tests(self):
        """Run all test categories"""
        print_banner()
        
        for category, test_files in TEST_CATEGORIES.items():
            if self.quick and category not in ["unit", "mining"]:
                print_test(f"SKIP {category.upper()}", "SKIP")
                self.results["skipped"] += len(test_files)
                continue
            
            print_section(f"Running {category.upper()} Tests")
            self.run_category_tests(category, test_files)
        
        self.finalize()
    
    def run_category_tests(self, category: str, test_files: List[str]):
        """Run tests in a category"""
        for test_file in test_files:
            test_path = TESTS_DIR / test_file
            
            if not test_path.exists():
                print_test(f"{category}: {test_file}", "SKIP")
                self.results["skipped"] += 1
                continue
            
            self.run_single_test(test_path, category)
    
    def run_single_test(self, test_path: Path, category: str):
        """Run a single test file"""
        test_name = f"{category}: {test_path.name}"
        start = time.time()
        
        try:
            # Run test
            result = subprocess.run(
                [sys.executable, str(test_path)],
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start
            
            if result.returncode == 0:
                print_test(test_name, "PASS", duration)
                self.results["passed"] += 1
                status = "PASS"
            else:
                print_test(test_name, "FAIL", duration)
                if self.verbose:
                    print(f"{Colors.RED}{result.stderr}{Colors.ENDC}")
                self.results["failed"] += 1
                status = "FAIL"
            
            self.results["total"] += 1
            self.results["tests"].append({
                "name": test_name,
                "status": status,
                "duration": duration,
                "category": category,
            })
        
        except subprocess.TimeoutExpired:
            print_test(test_name, "FAIL", 300)
            self.results["failed"] += 1
            self.results["total"] += 1
            self.results["tests"].append({
                "name": test_name,
                "status": "TIMEOUT",
                "duration": 300,
                "category": category,
            })
        
        except Exception as e:
            print_test(test_name, "FAIL", 0)
            if self.verbose:
                print(f"{Colors.RED}Error: {str(e)}{Colors.ENDC}")
            self.results["failed"] += 1
            self.results["total"] += 1
    
    def finalize(self):
        """Finalize and save results"""
        self.results["duration"] = time.time() - self.start_time
        
        print_section("Test Results")
        print_summary(self.results)
        
        # Save results
        self.save_results()
        
        # Print final status
        if self.results["failed"] == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED!{Colors.ENDC}\n")
            return 0
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.ENDC}\n")
            return 1
    
    def save_results(self):
        """Save test results to file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # JSON report
        json_report = REPORTS_DIR / f"test_results_{timestamp}.json"
        with open(json_report, "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📊 Results saved to: {json_report}")
        
        # Also print to stdout for CI/CD
        print(f"\nJSON Results:\n{json.dumps(self.results, indent=2)}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="ZION 2.8.2 Test Orchestrator"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick smoke tests only"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed output"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate HTML report"
    )
    
    args = parser.parse_args()
    
    # Run tests
    orchestrator = TestOrchestrator(
        verbose=args.verbose,
        quick=args.quick
    )
    
    exit_code = orchestrator.run_all_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
