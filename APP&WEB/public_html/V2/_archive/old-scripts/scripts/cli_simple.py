#!/usr/bin/env python3
"""
ZION CLI - Command-Line Interface
Simplified version for binary distribution testing
"""

import sys
import argparse

def main():
    parser = argparse.ArgumentParser(
        description='ZION 2.8.3 Command-Line Interface',
        prog='zion-cli'
    )
    
    parser.add_argument('--version', action='version', version='ZION 2.8.3')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Wallet commands
    wallet_parser = subparsers.add_parser('wallet', help='Wallet management')
    wallet_parser.add_argument('--create', action='store_true', help='Create new wallet')
    wallet_parser.add_argument('--balance', type=str, help='Check balance of address')
    
    # Node commands
    node_parser = subparsers.add_parser('node', help='Node information')
    node_parser.add_argument('--status', action='store_true', help='Get node status')
    node_parser.add_argument('--peers', action='store_true', help='List peers')
    
    # Mining commands
    mine_parser = subparsers.add_parser('mine', help='Mining controls')
    mine_parser.add_argument('--start', action='store_true', help='Start mining')
    mine_parser.add_argument('--stop', action='store_true', help='Stop mining')
    mine_parser.add_argument('--hashrate', action='store_true', help='Show hashrate')
    
    args = parser.parse_args()
    
    if args.command == 'wallet':
        if args.create:
            print("✨ Creating new ZION wallet...")
            print("🔑 Address: ZION_test_address_placeholder")
            print("⚠️  Save your private key securely!")
        elif args.balance:
            print(f"💰 Balance for {args.balance}: 0.00 ZION")
        else:
            wallet_parser.print_help()
    
    elif args.command == 'node':
        if args.status:
            print("📊 ZION Node Status:")
            print("   Height: 1")
            print("   Peers: 0")
            print("   Status: Synced")
        elif args.peers:
            print("🌐 Connected Peers: None (testnet not launched)")
        else:
            node_parser.print_help()
    
    elif args.command == 'mine':
        if args.start:
            print("⛏️  Starting mining...")
            print("   Connect to: pool.zionterranova.com:3333")
        elif args.stop:
            print("🛑 Stopping mining...")
        elif args.hashrate:
            print("⚡ Current hashrate: 0.00 H/s")
        else:
            mine_parser.print_help()
    
    else:
        parser.print_help()
        sys.exit(0)

if __name__ == '__main__':
    main()
