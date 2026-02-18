#!/bin/bash
# ZION Multi-Pool System Test Runner

echo "=========================================="
echo "ZION Multi-Pool Orchestration System Tests"
echo "=========================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing test dependencies..."
pip install -r requirements-pool-switcher.txt

echo ""
echo "Available test options:"
echo "1. Quick health check (--quick)"
echo "2. Full test suite (comprehensive)"
echo ""

read -p "Choose test type (1 or 2): " choice

case $choice in
    1)
        echo "Running quick health check..."
        python3 test_multi_pool_system.py --quick
        ;;
    2)
        echo "Running full test suite..."
        echo "This may take several minutes..."
        python3 test_multi_pool_system.py
        ;;
    *)
        echo "Invalid choice. Running quick check by default..."
        python3 test_multi_pool_system.py --quick
        ;;
esac

echo ""
echo "Test completed."