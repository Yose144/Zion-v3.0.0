use rusqlite::Connection;

use crate::error::MultichainResult;

/// SQLite connection manager for `zion-multichain`.
pub struct Db {
    conn: Connection,
}

impl Db {
    /// Open or create the SQLite database at `path`.
    pub fn open(path: impl AsRef<std::path::Path>) -> MultichainResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Open an in-memory database (useful for tests).
    pub fn open_in_memory() -> MultichainResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> MultichainResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                direction TEXT NOT NULL,
                source_address TEXT NOT NULL,
                source_asset TEXT NOT NULL,
                source_amount TEXT NOT NULL,
                target_address TEXT NOT NULL,
                target_asset TEXT NOT NULL,
                target_amount TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credits (
                address TEXT PRIMARY KEY,
                balance TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }
}
