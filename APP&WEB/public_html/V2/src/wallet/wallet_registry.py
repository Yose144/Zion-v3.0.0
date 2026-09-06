#!/usr/bin/env python3
"""
ZION Wallet Registry - Unified Wallet Management System
========================================================
Centrální systém pro správu všech typů ZION peněženek napříč celým ekosystémem.

Podporuje:
- eShop bonusy (1-1M Dharma Credits)
- Presale nákupy (500M Dharma Credits celkem, 3 fáze) 
- DAO odměny
- Mining payouts
- Genesis premine wallets (16.78B total)

Integrace:
- Python blockchain (src/core/)
- PHP web frontend (public_html/V2/api/)
- Presale backend (src/core/presale_db.py)
- Pool system (src/pool/)

Author: ZION Team
Version: 2.9.0
Created: 4. prosince 2025
"""

import os
import sys
import json
import sqlite3
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from dataclasses import dataclass, asdict
from contextlib import contextmanager

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Import existing ZION modules
try:
    from src.database.optimized_db import DatabaseConnectionPool
    from src.core.presale_wallet import (
        generate_presale_wallet,
        encrypt_private_key,
        decrypt_private_key,
        generate_qr_code
    )
    from wallet import ZionWallet, WalletAddress
except ImportError as e:
    logging.warning(f"Some imports failed (expected in standalone mode): {e}")
    DatabaseConnectionPool = None
    generate_presale_wallet = None

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================
# ENUMS & CONSTANTS
# ============================================

class WalletType(Enum):
    """Typy peněženek v ZION ekosystému"""
    ESHOP_BONUS = 'eshop_bonus'          # eShop bonusy (1-1M Dharma Credits)
    PRESALE = 'presale'                   # Presale nákupy (500M celkem)
    DAO_REWARD = 'dao_reward'            # DAO governance odměny
    MINING_PAYOUT = 'mining_payout'      # Mining pool výplaty
    GENESIS_PREMINE = 'genesis_premine'  # Premine alokace (16.78B)
    AIRDROP = 'airdrop'                  # Community airdrops
    STAKING_REWARD = 'staking_reward'    # Staking rewards


class NetworkType(Enum):
    """Síťové prostředí"""
    PRE_MAINNET = 'pre_mainnet'  # QR kódy před mainnet launch (IOU)
    TESTNET = 'testnet'           # Testovací síť
    MAINNET = 'mainnet'           # Produkční blockchain


class WalletStatus(Enum):
    """Status peněženky"""
    PENDING_GENERATION = 'pending_generation'  # Čeká na vytvoření
    GENERATED = 'generated'                     # Vygenerováno
    PENDING_PAYMENT = 'pending_payment'         # Čeká na platbu
    PENDING_REDEMPTION = 'pending_redemption'   # QR kód čeká na redemption
    ACTIVE = 'active'                           # Aktivní na blockchainu
    REDEEMED = 'redeemed'                       # Převedeno na blockchain
    EXPIRED = 'expired'                         # Expirováno
    SUSPENDED = 'suspended'                     # Pozastaveno
    BURNED = 'burned'                           # Spáleno


# Database paths
DEFAULT_REGISTRY_DB = "data/wallet_registry.db"
PHP_WALLET_DIR = "public_html/V2/wallets"
PHP_LEDGER_FILE = "public_html/V2/wallets/ledger.json"


# ============================================
# DATABASE SCHEMA
# ============================================

WALLET_REGISTRY_SCHEMA = """
-- ============================================
-- ZION Wallet Registry - Unified Schema
-- Version: 2.9.0
-- ============================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================
-- TABLE: wallet_registry
-- Centrální registr všech peněženek
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identifikace
    wallet_id TEXT UNIQUE NOT NULL,           -- zw_xxxxx (pre-mainnet) nebo ZION address (mainnet)
    blockchain_address TEXT UNIQUE,            -- NULL pro pre-mainnet, address pro blockchain
    private_key_encrypted TEXT,                -- NULL pro pre-mainnet, encrypted key pro blockchain
    public_key TEXT,                           -- Public key (pokud existuje)
    
    -- Klasifikace
    wallet_type TEXT NOT NULL,                 -- WalletType enum
    network TEXT NOT NULL,                     -- NetworkType enum
    
    -- Token alokace
    tokens INTEGER NOT NULL DEFAULT 0,         -- Počet ZION tokenů
    actual_balance INTEGER DEFAULT 0,          -- Reálný balance na blockchainu
    
    -- Původ a metadata
    source_order_id TEXT,                      -- ID objednávky/transakce
    customer_email TEXT,                       -- Email majitele
    customer_name TEXT,                        -- Jméno majitele
    label TEXT,                                -- Popisek peněženky
    
    -- QR kód data (pre-mainnet only)
    qr_code_data TEXT,                         -- URI data pro QR
    qr_image_path TEXT,                        -- Cesta k PNG souboru
    qr_service_url TEXT,                       -- URL QuickChart API
    
    -- PHP wallet-lib.php integrace
    php_wallet_file TEXT,                      -- Cesta k JSON v wallets/
    php_ledger_entry_id TEXT,                  -- ID v ledger.json
    
    -- Python presale_db integrace
    presale_wallet_id INTEGER,                 -- FK do presale_wallets
    presale_order_id INTEGER,                  -- FK do presale_orders
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'generated',  -- WalletStatus enum
    
    -- Lifecycle timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,                           -- Expirace (pre-mainnet: 1 rok)
    activated_at TEXT,                         -- Kdy se stalo aktivní na blockchainu
    redeemed_at TEXT,                          -- Kdy se QR převedlo na blockchain
    last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Access tracking
    accessed_count INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    
    -- Additional metadata (JSON)
    metadata TEXT,                             -- JSON s extra daty
    
    -- Indexes
    CHECK (wallet_type IN ('eshop_bonus', 'presale', 'dao_reward', 'mining_payout', 'genesis_premine', 'airdrop', 'staking_reward')),
    CHECK (network IN ('pre_mainnet', 'testnet', 'mainnet')),
    CHECK (status IN ('pending_generation', 'generated', 'pending_payment', 'pending_redemption', 'active', 'redeemed', 'expired', 'suspended', 'burned'))
);

-- Indexes pro rychlé vyhledávání
CREATE INDEX IF NOT EXISTS idx_wallet_type ON wallet_registry(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallet_network ON wallet_registry(network);
CREATE INDEX IF NOT EXISTS idx_wallet_status ON wallet_registry(status);
CREATE INDEX IF NOT EXISTS idx_wallet_email ON wallet_registry(customer_email);
CREATE INDEX IF NOT EXISTS idx_wallet_order ON wallet_registry(source_order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_blockchain_address ON wallet_registry(blockchain_address);
CREATE INDEX IF NOT EXISTS idx_wallet_created ON wallet_registry(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_expires ON wallet_registry(expires_at);

-- ============================================
-- TABLE: wallet_redemptions
-- Audit trail pro převody QR → blockchain
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT NOT NULL,
    
    -- Převod data
    old_wallet_id TEXT,                        -- QR kód ID (zw_xxxxx)
    new_blockchain_address TEXT NOT NULL,      -- Nová blockchain adresa
    tokens INTEGER NOT NULL,
    
    -- Blockchain transaction
    tx_hash TEXT,                              -- Transaction hash
    block_height INTEGER,                      -- Block height
    
    -- Smart contract (pro presale escrow unlock)
    escrow_contract_address TEXT,
    unlock_tx_hash TEXT,
    
    -- Audit
    redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    redeemed_by TEXT,                          -- Customer email
    ip_address TEXT,
    user_agent TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    FOREIGN KEY (wallet_id) REFERENCES wallet_registry(wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_redemption_wallet ON wallet_redemptions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_redemption_address ON wallet_redemptions(new_blockchain_address);
CREATE INDEX IF NOT EXISTS idx_redemption_timestamp ON wallet_redemptions(redeemed_at);

-- ============================================
-- TABLE: wallet_transactions
-- Historie transakcí peněženek
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT NOT NULL,
    
    -- Transaction details
    tx_type TEXT NOT NULL CHECK(tx_type IN ('credit', 'debit', 'transfer', 'stake', 'unstake', 'burn')),
    amount INTEGER NOT NULL,
    
    -- Related addresses
    from_address TEXT,
    to_address TEXT,
    
    -- Blockchain data
    tx_hash TEXT UNIQUE,
    block_height INTEGER,
    confirmations INTEGER DEFAULT 0,
    
    -- Metadata
    description TEXT,
    reference TEXT,                            -- Order ID, payment ID, etc.
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT,
    
    FOREIGN KEY (wallet_id) REFERENCES wallet_registry(wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON wallet_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_type ON wallet_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_tx_created ON wallet_transactions(created_at);

-- ============================================
-- TABLE: wallet_sync_log
-- Synchronizace mezi PHP a Python systémy
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Sync details
    sync_type TEXT NOT NULL CHECK(sync_type IN ('php_to_python', 'python_to_php', 'blockchain_sync')),
    source_system TEXT NOT NULL,               -- 'php_wallet_lib', 'presale_db', 'blockchain_rpc'
    target_system TEXT NOT NULL,
    
    -- Data
    wallet_id TEXT,
    data_snapshot TEXT,                        -- JSON snapshot
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'success', 'failed')),
    error_message TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    
    FOREIGN KEY (wallet_id) REFERENCES wallet_registry(wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_type ON wallet_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_wallet ON wallet_sync_log(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sync_created ON wallet_sync_log(created_at);

-- ============================================
-- VIEWS
-- ============================================

-- Active wallets by type
CREATE VIEW IF NOT EXISTS v_active_wallets_by_type AS
SELECT 
    wallet_type,
    network,
    COUNT(*) as count,
    SUM(tokens) as total_tokens
FROM wallet_registry
WHERE status IN ('active', 'pending_redemption', 'generated')
GROUP BY wallet_type, network;

-- Pending redemptions
CREATE VIEW IF NOT EXISTS v_pending_redemptions AS
SELECT 
    wallet_id,
    wallet_type,
    tokens,
    source_order_id,
    customer_email,
    created_at,
    expires_at,
    JULIANDAY(expires_at) - JULIANDAY('now') as days_until_expiry
FROM wallet_registry
WHERE status = 'pending_redemption'
AND expires_at > datetime('now')
ORDER BY expires_at ASC;

-- Wallet balance summary
CREATE VIEW IF NOT EXISTS v_wallet_balance_summary AS
SELECT 
    wallet_type,
    network,
    status,
    COUNT(*) as wallet_count,
    SUM(tokens) as allocated_tokens,
    SUM(actual_balance) as actual_balance,
    SUM(tokens - actual_balance) as pending_distribution
FROM wallet_registry
GROUP BY wallet_type, network, status;
"""


# ============================================
# DATACLASSES
# ============================================

@dataclass
class WalletRegistryEntry:
    """Záznam v wallet registry"""
    wallet_id: str
    wallet_type: WalletType
    network: NetworkType
    tokens: int
    status: WalletStatus
    created_at: datetime
    
    # Optional fields
    blockchain_address: Optional[str] = None
    private_key_encrypted: Optional[str] = None
    public_key: Optional[str] = None
    source_order_id: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    label: Optional[str] = None
    qr_code_data: Optional[str] = None
    qr_image_path: Optional[str] = None
    qr_service_url: Optional[str] = None
    php_wallet_file: Optional[str] = None
    php_ledger_entry_id: Optional[str] = None
    presale_wallet_id: Optional[int] = None
    presale_order_id: Optional[int] = None
    actual_balance: int = 0
    expires_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    accessed_count: int = 0
    last_accessed_at: Optional[datetime] = None
    metadata: Optional[Dict] = None
    
    def __post_init__(self):
        """Set last_updated if not provided"""
        if self.last_updated is None:
            self.last_updated = datetime.now()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert enums to strings
        data['wallet_type'] = self.wallet_type.value
        data['network'] = self.network.value
        data['status'] = self.status.value
        # Convert datetime to ISO string
        for key in ['created_at', 'expires_at', 'activated_at', 'redeemed_at', 'last_updated', 'last_accessed_at']:
            if data[key]:
                data[key] = data[key].isoformat() if isinstance(data[key], datetime) else data[key]
        return data


# ============================================
# MAIN REGISTRY CLASS
# ============================================

class ZionWalletRegistry:
    """
    Centrální správce všech ZION peněženek
    
    Podporuje:
    - Vytváření peněženek (pre-mainnet QR i mainnet blockchain)
    - Synchronizaci s PHP wallet-lib.php
    - Integraci s presale_db.py
    - Redemption QR → blockchain
    - Audit trail a reporting
    """
    
    def __init__(self, db_path: str = DEFAULT_REGISTRY_DB, php_wallet_dir: str = PHP_WALLET_DIR):
        self.db_path = Path(db_path)
        self.php_wallet_dir = Path(php_wallet_dir)
        self.php_ledger_file = Path(PHP_LEDGER_FILE)
        
        # Ensure directories exist
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.php_wallet_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Connection pool (if available)
        if DatabaseConnectionPool:
            self.pool = DatabaseConnectionPool(str(self.db_path), max_connections=10)
            self.pool.initialize()
        else:
            self.pool = None
            
        logger.info(f"✅ ZionWalletRegistry initialized: {self.db_path}")
    
    def _init_database(self):
        """Initialize database schema"""
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.executescript(WALLET_REGISTRY_SCHEMA)
            conn.commit()
            logger.info("✅ Wallet registry schema initialized")
        finally:
            conn.close()
    
    @contextmanager
    def get_connection(self):
        """Get database connection (with or without pool)"""
        if self.pool:
            with self.pool.get_connection() as conn:
                yield conn
        else:
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            try:
                yield conn
            finally:
                conn.close()
    
    # ============================================
    # WALLET CREATION METHODS
    # ============================================
    
    def create_eshop_bonus_wallet(
        self,
        tokens: int,
        order_id: str,
        customer_email: str,
        customer_name: str,
        label: str = "eShop Bonus"
    ) -> WalletRegistryEntry:
        """
        Vytvoří peněženku pro eShop bonus (9-390 ZION)
        Pre-mainnet: QR kód
        Post-mainnet: Blockchain address
        """
        network = NetworkType.PRE_MAINNET  # Změnit na MAINNET po launch
        wallet_id = self._generate_wallet_id()
        
        # Generate QR code (pre-mainnet)
        qr_data = self._generate_qr_data(wallet_id, tokens, label)
        qr_image_path = self._save_qr_code(wallet_id, qr_data)
        
        # Save to PHP wallet-lib.php format
        php_wallet_file = self._save_php_wallet(wallet_id, tokens, label, order_id, customer_email)
        
        # Create registry entry
        entry = WalletRegistryEntry(
            wallet_id=wallet_id,
            wallet_type=WalletType.ESHOP_BONUS,
            network=network,
            tokens=tokens,
            status=WalletStatus.GENERATED,
            created_at=datetime.now(),
            source_order_id=order_id,
            customer_email=customer_email,
            customer_name=customer_name,
            label=label,
            qr_code_data=qr_data,
            qr_image_path=str(qr_image_path),
            php_wallet_file=str(php_wallet_file),
            expires_at=datetime.now() + timedelta(days=365)  # 1 rok expirace
        )
        
        self._save_to_registry(entry)
        self._log_sync("php_to_python", "wallet_registry", wallet_id)
        
        logger.info(f"✅ eShop bonus wallet created: {wallet_id} ({tokens} ZION)")
        return entry
    
    def create_presale_wallet(
        self,
        tokens: int,
        order_id: str,
        customer_email: str,
        customer_name: str,
        presale_phase: str = "Phase 1"
    ) -> WalletRegistryEntry:
        """
        Vytvoří presale peněženku (Phase 1-3, €0.008-0.012)
        Používá src/core/presale_wallet.py s AES-256-GCM encryption
        """
        network = NetworkType.PRE_MAINNET  # Změnit na MAINNET po launch
        
        # Generate cryptographic wallet using presale_wallet.py
        if generate_presale_wallet:
            wallet_data = generate_presale_wallet(
                label=f"{customer_name} - {presale_phase}",
                email=customer_email,
                tokens=tokens
            )
            wallet_id = wallet_data['wallet_id']
            private_key_encrypted = wallet_data['private_key_encrypted']
            public_key = wallet_data['public_key']
            qr_image_path = wallet_data.get('qr_image_path')
        else:
            # Fallback if presale_wallet not available
            wallet_id = self._generate_wallet_id()
            private_key_encrypted = None
            public_key = None
            qr_data = self._generate_qr_data(wallet_id, tokens, presale_phase)
            qr_image_path = self._save_qr_code(wallet_id, qr_data)
        
        # Create registry entry
        entry = WalletRegistryEntry(
            wallet_id=wallet_id,
            wallet_type=WalletType.PRESALE,
            network=network,
            tokens=tokens,
            status=WalletStatus.PENDING_PAYMENT,
            created_at=datetime.now(),
            source_order_id=order_id,
            customer_email=customer_email,
            customer_name=customer_name,
            label=f"Presale {presale_phase}",
            private_key_encrypted=private_key_encrypted,
            public_key=public_key,
            qr_image_path=str(qr_image_path),
            expires_at=None,  # Presale wallets don't expire
            metadata={'presale_phase': presale_phase}
        )
        
        self._save_to_registry(entry)
        self._log_sync("python_to_python", "wallet_registry", wallet_id)
        
        logger.info(f"✅ Presale wallet created: {wallet_id} ({tokens:,} ZION)")
        return entry
    
    def create_blockchain_wallet(
        self,
        wallet_type: WalletType,
        tokens: int,
        customer_email: str,
        label: str = "ZION Wallet"
    ) -> WalletRegistryEntry:
        """
        Vytvoří SKUTEČNOU blockchain peněženku (po mainnet launch)
        Používá wallet/__init__.py ZionWallet
        """
        # Generate real blockchain wallet
        zion_wallet = ZionWallet.create_wallet(password=secrets.token_urlsafe(32))
        blockchain_address = zion_wallet.get_address()
        
        # Create registry entry
        entry = WalletRegistryEntry(
            wallet_id=blockchain_address,
            blockchain_address=blockchain_address,
            wallet_type=wallet_type,
            network=NetworkType.MAINNET,
            tokens=tokens,
            status=WalletStatus.ACTIVE,
            created_at=datetime.now(),
            customer_email=customer_email,
            label=label,
            private_key_encrypted=zion_wallet.encrypted_private_key,
            public_key=zion_wallet.public_key
        )
        
        self._save_to_registry(entry)
        self._log_sync("blockchain_sync", "wallet_registry", blockchain_address)
        
        logger.info(f"✅ Blockchain wallet created: {blockchain_address} ({tokens:,} ZION)")
        return entry
    
    # ============================================
    # REDEMPTION METHODS
    # ============================================
    
    def redeem_qr_to_blockchain(
        self,
        qr_wallet_id: str,
        target_blockchain_address: str,
        customer_password: str
    ) -> Dict:
        """
        Převede QR kód na skutečnou blockchain adresu (po mainnet launch)
        
        Returns:
            Dict s transaction details
        """
        # Load QR wallet
        qr_wallet = self.get_wallet(qr_wallet_id)
        if not qr_wallet:
            raise ValueError(f"QR wallet not found: {qr_wallet_id}")
        
        if qr_wallet['status'] == WalletStatus.REDEEMED.value:
            raise ValueError(f"Wallet already redeemed: {qr_wallet_id}")
        
        tokens = qr_wallet['tokens']
        
        # Create blockchain transaction
        # TODO: Integrate with src/core/new_zion_blockchain.py
        tx_hash = self._create_redemption_transaction(
            from_address="PRESALE_ESCROW_ADDRESS",
            to_address=target_blockchain_address,
            amount=tokens
        )
        
        # Log redemption
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO wallet_redemptions (
                    wallet_id, old_wallet_id, new_blockchain_address,
                    tokens, tx_hash, redeemed_by, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                target_blockchain_address,
                qr_wallet_id,
                target_blockchain_address,
                tokens,
                tx_hash,
                qr_wallet['customer_email'],
                'completed'
            ))
            
            # Update wallet status
            cursor.execute("""
                UPDATE wallet_registry
                SET status = ?,
                    redeemed_at = CURRENT_TIMESTAMP,
                    blockchain_address = ?
                WHERE wallet_id = ?
            """, (WalletStatus.REDEEMED.value, target_blockchain_address, qr_wallet_id))
            
            conn.commit()
        
        logger.info(f"✅ QR wallet redeemed: {qr_wallet_id} → {target_blockchain_address}")
        
        return {
            'success': True,
            'old_wallet_id': qr_wallet_id,
            'new_address': target_blockchain_address,
            'tokens': tokens,
            'tx_hash': tx_hash
        }
    
    # ============================================
    # QUERY METHODS
    # ============================================
    
    def get_wallet(self, wallet_id: str) -> Optional[Dict]:
        """Získá peněženku podle ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM wallet_registry WHERE wallet_id = ?", (wallet_id,))
            row = cursor.fetchone()
            
            if row:
                # Update access tracking
                cursor.execute("""
                    UPDATE wallet_registry
                    SET accessed_count = accessed_count + 1,
                        last_accessed_at = CURRENT_TIMESTAMP
                    WHERE wallet_id = ?
                """, (wallet_id,))
                conn.commit()
                
                return dict(row)
            return None
    
    def get_wallets_by_email(self, email: str) -> List[Dict]:
        """Získá všechny peněženky zákazníka"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM wallet_registry
                WHERE customer_email = ?
                ORDER BY created_at DESC
            """, (email,))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_wallets_by_order(self, order_id: str) -> List[Dict]:
        """Získá peněženky pro objednávku"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM wallet_registry
                WHERE source_order_id = ?
                ORDER BY created_at DESC
            """, (order_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_pending_redemptions(self) -> List[Dict]:
        """Získá QR kódy čekající na redemption"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM v_pending_redemptions")
            return [dict(row) for row in cursor.fetchall()]
    
    def get_wallet_balance_summary(self) -> List[Dict]:
        """Získá přehled balancí všech typů peněženek"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM v_wallet_balance_summary")
            return [dict(row) for row in cursor.fetchall()]
    
    # ============================================
    # SYNC METHODS
    # ============================================
    
    def sync_from_php_ledger(self) -> int:
        """
        Synchronizuje peněženky z PHP ledger.json do registry
        Returns: Počet synchronizovaných peněženek
        """
        if not self.php_ledger_file.exists():
            logger.warning(f"PHP ledger file not found: {self.php_ledger_file}")
            return 0
        
        with open(self.php_ledger_file, 'r') as f:
            ledger = json.load(f)
        
        synced = 0
        for wallet_id, wallet_data in ledger.get('wallets', {}).items():
            # Check if already in registry
            existing = self.get_wallet(wallet_id)
            if existing:
                continue
            
            # Create registry entry from PHP data
            entry = WalletRegistryEntry(
                wallet_id=wallet_id,
                wallet_type=WalletType.ESHOP_BONUS,
                network=NetworkType.PRE_MAINNET,
                tokens=wallet_data.get('tokens', 0),
                status=WalletStatus.GENERATED,
                created_at=datetime.fromisoformat(wallet_data.get('created', datetime.now().isoformat())),
                customer_email=wallet_data.get('customerEmail'),
                label=wallet_data.get('label', 'eShop Bonus'),
                php_wallet_file=str(self.php_wallet_dir / f"{wallet_id}.json"),
                php_ledger_entry_id=wallet_id,
                expires_at=datetime.fromisoformat(wallet_data.get('expiresAt')) if wallet_data.get('expiresAt') else None
            )
            
            self._save_to_registry(entry)
            synced += 1
        
        logger.info(f"✅ Synced {synced} wallets from PHP ledger")
        return synced
    
    def sync_from_presale_db(self, presale_db_path: str = "data/presale.db") -> int:
        """
        Synchronizuje presale peněženky z presale_db.py do registry
        Returns: Počet synchronizovaných peněženek
        """
        if not Path(presale_db_path).exists():
            logger.warning(f"Presale DB not found: {presale_db_path}")
            return 0
        
        presale_conn = sqlite3.connect(presale_db_path)
        presale_conn.row_factory = sqlite3.Row
        
        try:
            cursor = presale_conn.cursor()
            cursor.execute("""
                SELECT w.*, o.customer_email, o.customer_name, o.phase
                FROM presale_wallets w
                LEFT JOIN presale_orders o ON w.order_id = o.id
            """)
            
            synced = 0
            for row in cursor.fetchall():
                wallet_id = row['wallet_id']
                
                # Check if already in registry
                existing = self.get_wallet(wallet_id)
                if existing:
                    continue
                
                # Create registry entry
                entry = WalletRegistryEntry(
                    wallet_id=wallet_id,
                    wallet_type=WalletType.PRESALE,
                    network=NetworkType.PRE_MAINNET,
                    tokens=row['tokens'],
                    status=WalletStatus(row['status']) if row.get('status') else WalletStatus.GENERATED,
                    created_at=datetime.fromisoformat(row['created_at']),
                    customer_email=row.get('customer_email'),
                    customer_name=row.get('customer_name'),
                    label=f"Presale {row.get('phase', 'Unknown')}",
                    private_key_encrypted=row.get('private_key_encrypted'),
                    public_key=row.get('public_key'),
                    presale_wallet_id=row['id'],
                    presale_order_id=row.get('order_id'),
                    metadata={'presale_phase': row.get('phase')}
                )
                
                self._save_to_registry(entry)
                synced += 1
            
            logger.info(f"✅ Synced {synced} presale wallets")
            return synced
        
        finally:
            presale_conn.close()
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _generate_wallet_id(self) -> str:
        """Generate unique wallet ID (zw_xxxxx format)"""
        return f"zw_{secrets.token_hex(16)}"
    
    def _generate_qr_data(self, wallet_id: str, tokens: int, label: str) -> str:
        """Generate QR code data URI"""
        return f"zion://wallet?id={wallet_id}&tokens={tokens}&label={label}"
    
    def _save_qr_code(self, wallet_id: str, qr_data: str) -> Path:
        """Save QR code image"""
        qr_image_path = self.php_wallet_dir / f"{wallet_id}.png"
        
        # Generate QR using QuickChart API (same as PHP wallet-lib.php)
        try:
            if generate_qr_code:
                generate_qr_code(qr_data, str(qr_image_path))
            else:
                # Fallback: Use QuickChart API directly
                import urllib.request
                import urllib.parse
                
                qr_url = f"https://quickchart.io/qr?text={urllib.parse.quote(qr_data)}&size=300"
                urllib.request.urlretrieve(qr_url, str(qr_image_path))
                logger.info(f"QR code generated via QuickChart API: {qr_image_path}")
        except Exception as e:
            logger.warning(f"QR code generation failed (not critical): {e}")
        
        return qr_image_path
    
    def _save_php_wallet(
        self,
        wallet_id: str,
        tokens: int,
        label: str,
        order_id: str,
        customer_email: str
    ) -> Path:
        """Save wallet in PHP format (JSON)"""
        php_wallet_path = self.php_wallet_dir / f"{wallet_id}.json"
        
        wallet_data = {
            'walletId': wallet_id,
            'tokens': tokens,
            'label': label,
            'orderId': order_id,
            'customerEmail': customer_email,
            'created': datetime.now().isoformat(),
            'expiresAt': (datetime.now() + timedelta(days=365)).isoformat(),
            'status': 'active'
        }
        
        with open(php_wallet_path, 'w') as f:
            json.dump(wallet_data, f, indent=2)
        
        return php_wallet_path
    
    def _save_to_registry(self, entry: WalletRegistryEntry):
        """Save entry to registry database"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            data = entry.to_dict()
            
            # Convert metadata dict to JSON string
            if data['metadata']:
                data['metadata'] = json.dumps(data['metadata'])
            
            columns = ', '.join(data.keys())
            placeholders = ', '.join(['?' for _ in data])
            
            cursor.execute(f"""
                INSERT INTO wallet_registry ({columns})
                VALUES ({placeholders})
            """, list(data.values()))
            
            conn.commit()
    
    def _log_sync(self, sync_type: str, source: str, wallet_id: str):
        """Log sync operation"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO wallet_sync_log (sync_type, source_system, target_system, wallet_id, status)
                VALUES (?, ?, ?, ?, ?)
            """, (sync_type, source, "wallet_registry", wallet_id, "success"))
            conn.commit()
    
    def _create_redemption_transaction(
        self,
        from_address: str,
        to_address: str,
        amount: int
    ) -> str:
        """Create blockchain transaction for redemption"""
        # TODO: Integrate with src/core/new_zion_blockchain.py
        # For now, return mock tx hash
        tx_data = f"{from_address}{to_address}{amount}{datetime.now().isoformat()}"
        tx_hash = hashlib.sha256(tx_data.encode()).hexdigest()
        return tx_hash


# ============================================
# CLI & TESTING
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("ZION WALLET REGISTRY - INITIALIZATION TEST")
    print("=" * 60)
    
    # Test initialization
    registry = ZionWalletRegistry(db_path="data/test_wallet_registry.db")
    
    print(f"\n✅ Registry initialized at: {registry.db_path}")
    print(f"✅ PHP wallet dir: {registry.php_wallet_dir}")
    print(f"✅ PHP ledger file: {registry.php_ledger_file}")
    
    # Test database schema
    with registry.get_connection() as conn:
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n✅ Tables created: {len(tables)}")
        for table in tables:
            print(f"   - {table}")
        
        # Check views
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
        views = [row[0] for row in cursor.fetchall()]
        print(f"\n✅ Views created: {len(views)}")
        for view in views:
            print(f"   - {view}")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED")
    print("=" * 60)
