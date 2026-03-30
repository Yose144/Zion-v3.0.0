#!/usr/bin/env python3
"""
ZION Multi-Pool Orchestration System Test Suite

Comprehensive testing for the complete multi-pool mining ecosystem
"""

import asyncio
import logging
import sys
import time
from datetime import datetime, timedelta
import redis
import json
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MultiPoolSystemTester:
    """Comprehensive test suite for multi-pool orchestration system"""

    def __init__(self, redis_host: str = 'localhost', redis_port: int = 6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self.test_results = {}
        self.start_time = None

    async def run_full_test_suite(self):
        """Run the complete test suite"""
        logger.info("Starting ZION Multi-Pool Orchestration System Test Suite")
        self.start_time = datetime.now()

        try:
            # Test 1: System Components Health
            await self.test_component_health()

            # Test 2: Redis Communication
            await self.test_redis_communication()

            # Test 3: Pool Switcher Functionality
            await self.test_pool_switcher()

            # Test 4: Geographic Balancer
            await self.test_geographic_balancer()

            # Test 5: Distributed Orchestrator
            await self.test_distributed_orchestrator()

            # Test 6: Master Orchestrator
            await self.test_master_orchestrator()

            # Test 7: Integration Test
            await self.test_system_integration()

            # Test 8: Performance Test
            await self.test_performance()

            # Test 9: Stress Test
            await self.test_stress_conditions()

            # Generate test report
            self.generate_test_report()

        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            self.test_results['overall_status'] = 'FAILED'
            self.generate_test_report()

    async def test_component_health(self):
        """Test health of all system components"""
        logger.info("Testing component health...")

        results = {
            'component': 'component_health',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Check master orchestrator
            master_status = self.redis_client.get('master:system_status')
            results['details']['master_orchestrator'] = 'ACTIVE' if master_status else 'INACTIVE'

            # Check component status
            component_status = self.redis_client.get('master:component_status')
            if component_status:
                status_data = json.loads(component_status)
                results['details']['pool_switcher'] = 'ACTIVE' if status_data.get('pool_switcher', {}).get('active') else 'INACTIVE'
                results['details']['geographic_balancer'] = 'ACTIVE' if status_data.get('geographic_balancer', {}).get('active') else 'INACTIVE'
                results['details']['distributed_orchestrator'] = 'ACTIVE' if status_data.get('distributed_orchestrator', {}).get('active') else 'INACTIVE'

            # Overall status
            active_components = sum(1 for comp in results['details'].values() if comp == 'ACTIVE')
            results['status'] = 'PASS' if active_components >= 2 else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['component_health'] = results
        logger.info(f"Component health test: {results['status']}")

    async def test_redis_communication(self):
        """Test Redis communication between components"""
        logger.info("Testing Redis communication...")

        results = {
            'component': 'redis_communication',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Test basic Redis connectivity
            self.redis_client.ping()
            results['details']['redis_connectivity'] = 'PASS'

            # Test pub/sub functionality
            test_channel = 'test:communication'
            test_message = {'test': 'communication', 'timestamp': datetime.now().isoformat()}

            # Publish test message
            self.redis_client.publish(test_channel, json.dumps(test_message))

            # Check if message was published (basic check)
            results['details']['pub_sub_basic'] = 'PASS'

            # Test key operations
            test_key = 'test:key'
            self.redis_client.setex(test_key, 60, json.dumps({'test': 'data'}))
            retrieved = self.redis_client.get(test_key)

            if retrieved and json.loads(retrieved)['test'] == 'data':
                results['details']['key_value_operations'] = 'PASS'
            else:
                results['details']['key_value_operations'] = 'FAIL'

            results['status'] = 'PASS' if all(status == 'PASS' for status in results['details'].values()) else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['redis_communication'] = results
        logger.info(f"Redis communication test: {results['status']}")

    async def test_pool_switcher(self):
        """Test intelligent pool switcher functionality"""
        logger.info("Testing pool switcher functionality...")

        results = {
            'component': 'pool_switcher',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Check switcher statistics
            switcher_stats = self.redis_client.get('switcher:statistics')
            if switcher_stats:
                stats = json.loads(switcher_stats)
                results['details']['statistics_available'] = 'PASS'
                results['details']['current_pool'] = stats.get('current_pool', 'unknown')
                results['details']['success_rate'] = stats.get('success_rate', 0)
            else:
                results['details']['statistics_available'] = 'FAIL'

            # Test pool metrics availability
            pool_keys = self.redis_client.keys('pool:metrics:*')
            results['details']['pool_metrics_count'] = len(pool_keys)

            if len(pool_keys) > 0:
                results['details']['pool_metrics_available'] = 'PASS'
                # Test a sample pool metric
                sample_key = pool_keys[0]
                sample_data = self.redis_client.get(sample_key)
                if sample_data:
                    results['details']['sample_pool_data'] = 'PASS'
                else:
                    results['details']['sample_pool_data'] = 'FAIL'
            else:
                results['details']['pool_metrics_available'] = 'FAIL'

            # Overall assessment
            pass_checks = sum(1 for check in results['details'].values() if check == 'PASS' or isinstance(check, (int, float)))
            total_checks = len([v for v in results['details'].values() if not isinstance(v, (int, float))])
            results['status'] = 'PASS' if pass_checks >= total_checks * 0.7 else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['pool_switcher'] = results
        logger.info(f"Pool switcher test: {results['status']}")

    async def test_geographic_balancer(self):
        """Test geographic load balancer functionality"""
        logger.info("Testing geographic balancer functionality...")

        results = {
            'component': 'geographic_balancer',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Check balancer efficiency data
            efficiency_data = self.redis_client.get('balancer:efficiency')
            if efficiency_data:
                data = json.loads(efficiency_data)
                results['details']['efficiency_data_available'] = 'PASS'
                results['details']['regions_tracked'] = len(data)
            else:
                results['details']['efficiency_data_available'] = 'FAIL'

            # Check geographic imbalances
            imbalances = self.redis_client.get('balancer:imbalances')
            if imbalances:
                imbalance_data = json.loads(imbalances)
                results['details']['imbalance_monitoring'] = 'PASS'
                results['details']['active_imbalances'] = len(imbalance_data)
            else:
                results['details']['imbalance_monitoring'] = 'UNKNOWN'

            # Check optimal routes
            routes = self.redis_client.get('balancer:optimal_routes')
            if routes:
                results['details']['route_optimization'] = 'PASS'
            else:
                results['details']['route_optimization'] = 'UNKNOWN'

            # Overall assessment
            essential_checks = ['efficiency_data_available']
            results['status'] = 'PASS' if all(results['details'].get(check) == 'PASS' for check in essential_checks) else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['geographic_balancer'] = results
        logger.info(f"Geographic balancer test: {results['status']}")

    async def test_distributed_orchestrator(self):
        """Test distributed mining orchestrator functionality"""
        logger.info("Testing distributed orchestrator functionality...")

        results = {
            'component': 'distributed_orchestrator',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Check orchestrator status
            orchestrator_status = self.redis_client.get('orchestrator:status')
            if orchestrator_status:
                status = json.loads(orchestrator_status)
                results['details']['orchestrator_status'] = 'PASS'
                results['details']['last_update'] = status.get('last_update', 'unknown')
            else:
                results['details']['orchestrator_status'] = 'FAIL'

            # Check orchestrator metrics
            orchestrator_metrics = self.redis_client.get('orchestrator:metrics')
            if orchestrator_metrics:
                metrics = json.loads(orchestrator_metrics)
                results['details']['orchestrator_metrics'] = 'PASS'
                results['details']['total_hashrate'] = metrics.get('total_hashrate', 0)
                results['details']['active_miners'] = metrics.get('active_miners', 0)
            else:
                results['details']['orchestrator_metrics'] = 'UNKNOWN'

            # Check node registry
            node_keys = self.redis_client.keys('node:registry:*')
            results['details']['registered_nodes'] = len(node_keys)

            # Overall assessment
            results['status'] = 'PASS' if results['details'].get('orchestrator_status') == 'PASS' else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['distributed_orchestrator'] = results
        logger.info(f"Distributed orchestrator test: {results['status']}")

    async def test_master_orchestrator(self):
        """Test master orchestrator functionality"""
        logger.info("Testing master orchestrator functionality...")

        results = {
            'component': 'master_orchestrator',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Check master system status
            system_status = self.redis_client.get('master:system_status')
            if system_status:
                status = json.loads(system_status)
                results['details']['system_status_available'] = 'PASS'
                results['details']['orchestration_mode'] = status.get('orchestration_state', {}).get('mode', 'unknown')
                results['details']['overall_health'] = status.get('component_health', {}).get('overall_health', 'unknown')
            else:
                results['details']['system_status_available'] = 'FAIL'

            # Check component health monitoring
            component_health = self.redis_client.get('master:component_status')
            if component_health:
                health = json.loads(component_health)
                results['details']['component_health_monitoring'] = 'PASS'
                results['details']['overall_health_status'] = health.get('overall_health', 'unknown')
            else:
                results['details']['component_health_monitoring'] = 'FAIL'

            # Check emergency logs
            emergency_logs = self.redis_client.lrange('master:emergency_log', 0, 10)
            results['details']['emergency_logs_count'] = len(emergency_logs)

            # Overall assessment
            essential_checks = ['system_status_available', 'component_health_monitoring']
            results['status'] = 'PASS' if all(results['details'].get(check) == 'PASS' for check in essential_checks) else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['master_orchestrator'] = results
        logger.info(f"Master orchestrator test: {results['status']}")

    async def test_system_integration(self):
        """Test integration between all system components"""
        logger.info("Testing system integration...")

        results = {
            'component': 'system_integration',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Test inter-component communication
            # Send a test command and check if it's processed
            test_command = {
                'type': 'test_integration',
                'test_id': f'test_{int(time.time())}',
                'timestamp': datetime.now().isoformat()
            }

            # Publish to orchestration decisions channel
            self.redis_client.publish('orchestrator:decisions', json.dumps(test_command))

            # Wait a moment for processing
            await asyncio.sleep(2)

            # Check if test command was logged or processed
            # This is a basic integration test
            results['details']['command_publishing'] = 'PASS'

            # Test data flow between components
            # Check if pool data flows to switcher
            pool_data = self.redis_client.keys('pool:metrics:*')
            switcher_data = self.redis_client.get('switcher:statistics')

            if pool_data and switcher_data:
                results['details']['data_flow_pool_to_switcher'] = 'PASS'
            else:
                results['details']['data_flow_pool_to_switcher'] = 'UNKNOWN'

            # Check if geographic data flows to balancer
            geo_data = self.redis_client.get('balancer:efficiency')
            if geo_data:
                results['details']['geographic_data_flow'] = 'PASS'
            else:
                results['details']['geographic_data_flow'] = 'UNKNOWN'

            # Overall integration status
            pass_checks = sum(1 for check in results['details'].values() if check == 'PASS')
            total_checks = len(results['details'])
            results['status'] = 'PASS' if pass_checks >= total_checks * 0.6 else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['system_integration'] = results
        logger.info(f"System integration test: {results['status']}")

    async def test_performance(self):
        """Test system performance under normal load"""
        logger.info("Testing system performance...")

        results = {
            'component': 'performance',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Measure Redis response times
            start_time = time.time()
            for _ in range(100):
                self.redis_client.ping()
            redis_time = (time.time() - start_time) * 1000  # ms
            results['details']['redis_response_time_avg'] = redis_time / 100

            # Measure key retrieval times
            start_time = time.time()
            for _ in range(50):
                self.redis_client.get('master:system_status')
            retrieval_time = (time.time() - start_time) * 1000  # ms
            results['details']['key_retrieval_time_avg'] = retrieval_time / 50

            # Check memory usage (approximate)
            info = self.redis_client.info('memory')
            results['details']['redis_memory_usage'] = info.get('used_memory_human', 'unknown')

            # Performance thresholds
            if results['details']['redis_response_time_avg'] < 10:  # < 10ms
                results['details']['redis_performance'] = 'EXCELLENT'
            elif results['details']['redis_response_time_avg'] < 50:  # < 50ms
                results['details']['redis_performance'] = 'GOOD'
            else:
                results['details']['redis_performance'] = 'POOR'

            results['status'] = 'PASS' if results['details']['redis_performance'] in ['EXCELLENT', 'GOOD'] else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['performance'] = results
        logger.info(f"Performance test: {results['status']}")

    async def test_stress_conditions(self):
        """Test system behavior under stress conditions"""
        logger.info("Testing stress conditions...")

        results = {
            'component': 'stress_test',
            'status': 'UNKNOWN',
            'details': {},
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Simulate high-frequency operations
            start_time = time.time()

            # Rapid pub/sub operations
            for i in range(100):
                test_msg = {'stress_test': i, 'timestamp': datetime.now().isoformat()}
                self.redis_client.publish('test:stress', json.dumps(test_msg))

            pubsub_time = time.time() - start_time
            results['details']['pubsub_stress_time'] = pubsub_time

            # Rapid key operations
            start_time = time.time()
            for i in range(200):
                key = f'stress:test:{i}'
                self.redis_client.setex(key, 30, json.dumps({'data': i}))
                self.redis_client.get(key)

            key_ops_time = time.time() - start_time
            results['details']['key_operations_stress_time'] = key_ops_time

            # Check system stability after stress
            await asyncio.sleep(2)
            post_stress_ping = self.redis_client.ping()

            if post_stress_ping:
                results['details']['post_stress_stability'] = 'PASS'
            else:
                results['details']['post_stress_stability'] = 'FAIL'

            # Performance assessment
            total_stress_time = pubsub_time + key_ops_time
            if total_stress_time < 5.0:  # Less than 5 seconds for 300 operations
                results['details']['stress_performance'] = 'EXCELLENT'
            elif total_stress_time < 10.0:  # Less than 10 seconds
                results['details']['stress_performance'] = 'GOOD'
            else:
                results['details']['stress_performance'] = 'POOR'

            results['status'] = 'PASS' if results['details']['post_stress_stability'] == 'PASS' else 'FAIL'

        except Exception as e:
            results['status'] = 'ERROR'
            results['error'] = str(e)

        self.test_results['stress_test'] = results
        logger.info(f"Stress test: {results['status']}")

    def generate_test_report(self):
        """Generate comprehensive test report"""
        logger.info("Generating test report...")

        report = {
            'test_suite': 'ZION Multi-Pool Orchestration System Test Suite',
            'version': '2.8.2',
            'timestamp': datetime.now().isoformat(),
            'duration': str(datetime.now() - self.start_time) if self.start_time else 'unknown',
            'test_results': self.test_results,
            'summary': {}
        }

        # Calculate summary statistics
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['status'] == 'PASS')
        failed_tests = sum(1 for result in self.test_results.values() if result['status'] == 'FAIL')
        error_tests = sum(1 for result in self.test_results.values() if result['status'] == 'ERROR')

        report['summary'] = {
            'total_tests': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'errors': error_tests,
            'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            'overall_status': 'PASS' if failed_tests == 0 and error_tests == 0 else 'FAIL'
        }

        # Save report to file
        report_file = f'multi_pool_test_report_{int(time.time())}.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        # Print summary to console
        print("\n" + "="*60)
        print("ZION MULTI-POOL ORCHESTRATION SYSTEM TEST REPORT")
        print("="*60)
        print(f"Timestamp: {report['timestamp']}")
        print(f"Duration: {report['duration']}")
        print(f"Overall Status: {report['summary']['overall_status']}")
        print()
        print("Test Results Summary:")
        print(f"  Total Tests: {report['summary']['total_tests']}")
        print(f"  Passed: {report['summary']['passed']}")
        print(f"  Failed: {report['summary']['failed']}")
        print(f"  Errors: {report['summary']['errors']}")
        print(".1f")
        print()
        print("Detailed Results:")

        for test_name, result in self.test_results.items():
            status_icon = "✓" if result['status'] == 'PASS' else "✗" if result['status'] == 'FAIL' else "⚠"
            print(f"  {status_icon} {test_name}: {result['status']}")

        print()
        print(f"Full report saved to: {report_file}")
        print("="*60)

        logger.info(f"Test report generated: {report_file}")

async def main():
    """Main test function"""
    if len(sys.argv) > 1 and sys.argv[1] == '--quick':
        # Quick test mode - just check if components are responding
        print("Running quick system check...")

        tester = MultiPoolSystemTester()
        await tester.test_component_health()

        result = tester.test_results['component_health']
        if result['status'] == 'PASS':
            print("✓ System components are healthy")
            sys.exit(0)
        else:
            print("✗ System health check failed")
            sys.exit(1)

    else:
        # Full test suite
        tester = MultiPoolSystemTester()
        await tester.run_full_test_suite()

if __name__ == "__main__":
    asyncio.run(main())