#!/usr/bin/env python3
"""
Migration script to add missing columns to pool_stats table
Fixes: Error saving pool stats: table pool_stats has no column named peak_connections
"""
import sqlite3
import sys

def migrate_pool_stats_schema(db_file='zion_pool.db'):
    """Add missing columns to pool_stats table"""
    print(f"🔧 Migrating pool_stats schema in {db_file}...")
    
    try:
        with sqlite3.connect(db_file) as conn:
            cursor = conn.cursor()
            
            # Check if columns already exist
            cursor.execute("PRAGMA table_info(pool_stats)")
            existing_columns = {row[1] for row in cursor.fetchall()}
            
            print(f"📊 Existing columns: {existing_columns}")
            
            # Define new columns to add
            new_columns = {
                'peak_connections': 'INTEGER DEFAULT 0',
                'shares_processed': 'INTEGER DEFAULT 0',
                'avg_processing_time_ms': 'REAL DEFAULT 0.0',
                'errors_count': 'INTEGER DEFAULT 0',
                'banned_ips': 'INTEGER DEFAULT 0',
                'vardiff_enabled': 'INTEGER DEFAULT 0'
            }
            
            # Add missing columns
            # SECURITY: Using hardcoded whitelist for column names (safe for migration)
            added = []
            for column_name, column_def in new_columns.items():
                if column_name not in existing_columns:
                    try:
                        # SECURITY NOTE: column_name and column_def are from hardcoded dict above
                        # This is safe because they're not user input, but documented for review
                        cursor.execute(f'ALTER TABLE pool_stats ADD COLUMN {column_name} {column_def}')
                        added.append(column_name)
                        print(f"  ✅ Added column: {column_name}")
                    except sqlite3.OperationalError as e:
                        print(f"  ⚠️  Column {column_name} already exists or error: {e}")
                else:
                    print(f"  ⏭️  Column {column_name} already exists")
            
            conn.commit()
            
            # Verify migration
            cursor.execute("PRAGMA table_info(pool_stats)")
            final_columns = [row[1] for row in cursor.fetchall()]
            
            print(f"\n✅ Migration complete!")
            print(f"📊 Final columns ({len(final_columns)}): {', '.join(final_columns)}")
            print(f"🎉 Added {len(added)} new columns: {', '.join(added) if added else 'None (all existed)'}")
            
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    db_file = sys.argv[1] if len(sys.argv) > 1 else 'zion_pool.db'
    success = migrate_pool_stats_schema(db_file)
    sys.exit(0 if success else 1)
