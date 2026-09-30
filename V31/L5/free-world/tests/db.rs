use zion_free_world::db::{FreeWorldDb, GrantRecord, ProjectRecord};
use zion_free_world::error::FreeWorldResult;

fn in_memory_db() -> FreeWorldResult<FreeWorldDb> {
    FreeWorldDb::open(":memory:")
}

#[test]
fn test_grant_lifecycle() -> FreeWorldResult<()> {
    let db = in_memory_db()?;

    let grant = GrantRecord::new("Clean Water Initiative", "humanitarian", 1_000_000);
    db.insert_grant(&grant)?;

    let grants = db.list_grants(None)?;
    assert_eq!(grants.len(), 1);
    assert_eq!(grants[0].title, "Clean Water Initiative");
    assert_eq!(grants[0].status, "pending");

    db.update_grant_status(&grant.id, "approved", Some("Approved by DAO vote"))?;

    let approved = db.list_grants(Some("approved"))?;
    assert_eq!(approved.len(), 1);
    assert_eq!(approved[0].status, "approved");

    let pending = db.list_grants(Some("pending"))?;
    assert!(pending.is_empty());

    Ok(())
}

#[test]
fn test_project_lifecycle() -> FreeWorldResult<()> {
    let db = in_memory_db()?;

    let project = ProjectRecord::new("Solar Village", "energy", 5_000_000);
    db.insert_project(&project)?;

    let projects = db.list_projects(None)?;
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].name, "Solar Village");
    assert_eq!(projects[0].status, "planning");

    Ok(())
}

#[test]
fn test_fund_balance() -> FreeWorldResult<()> {
    let db = in_memory_db()?;

    let balance = db.get_fund_balance()?;
    assert_eq!(balance.total_accumulated, 0);

    let mut updated = balance.clone();
    updated.total_accumulated = 1_000_000_000;
    updated.last_block_height = 100;
    db.update_fund_balance(&updated)?;

    let fetched = db.get_fund_balance()?;
    assert_eq!(fetched.total_accumulated, 1_000_000_000);
    assert_eq!(fetched.last_block_height, 100);

    Ok(())
}

#[test]
fn test_grant_dao_proposal_roundtrip() -> FreeWorldResult<()> {
    let db = in_memory_db()?;

    let grant = GrantRecord::new("Solar Well", "energy", 5_000_000);
    db.insert_grant(&grant)?;
    assert_eq!(db.get_grant(&grant.id)?.unwrap().dao_proposal_id, None);

    let updated = db.set_grant_dao_proposal(&grant.id, 42)?;
    assert_eq!(updated, 1);

    let g = db.get_grant(&grant.id)?.unwrap();
    assert_eq!(g.dao_proposal_id, Some(42));
    assert_eq!(g.status, "on_dao");
    assert!(g.reviewed_at.is_some());

    // Unknown id → 0 rows
    assert_eq!(db.set_grant_dao_proposal("nope", 1)?, 0);
    Ok(())
}

#[test]
fn test_status_counts() -> FreeWorldResult<()> {
    let db = in_memory_db()?;

    let g1 = GrantRecord::new("A", "c", 1);
    let g2 = GrantRecord::new("B", "c", 1);
    db.insert_grant(&g1)?;
    db.insert_grant(&g2)?;
    db.update_grant_status(&g2.id, "approved", None)?;

    let counts = db.grant_status_counts()?;
    let get = |s: &str| {
        counts
            .iter()
            .find(|(k, _)| k == s)
            .map(|(_, n)| *n)
            .unwrap_or(0)
    };
    assert_eq!(get("pending"), 1);
    assert_eq!(get("approved"), 1);
    assert_eq!(get("rejected"), 0);

    // rejected_at/reviewer_notes stay NULL when no notes are given
    assert_eq!(db.get_grant(&g2.id)?.unwrap().reviewer_notes, None);

    Ok(())
}

/// Pre-`dao_proposal_id` databases get the column added by `open` — and
/// reopening is idempotent.
#[test]
fn test_dao_proposal_id_migration_on_old_db() -> FreeWorldResult<()> {
    let path = std::env::temp_dir().join(format!("fw-mig-{}.db", uuid::Uuid::new_v4()));
    {
        // Simulate a DB created before the column existed.
        let conn = rusqlite::Connection::open(&path)?;
        conn.execute_batch(
            "CREATE TABLE grants (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                applicant_name TEXT,
                applicant_address TEXT,
                category TEXT NOT NULL,
                amount_zion INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                reviewed_at TEXT,
                reviewer_notes TEXT
            );",
        )?;
        conn.execute(
            "INSERT INTO grants (id, title, category, amount_zion, status, created_at)
             VALUES ('g1', 'Legacy', 'humanitarian', 5, 'pending', '2026-01-01T00:00:00Z')",
            [],
        )?;
    }

    let db = FreeWorldDb::open(path.to_str().unwrap())?;
    let g = db.get_grant("g1")?.unwrap();
    assert_eq!(g.dao_proposal_id, None);

    db.set_grant_dao_proposal("g1", 7)?;
    assert_eq!(db.get_grant("g1")?.unwrap().dao_proposal_id, Some(7));

    // Reopen — migration must be idempotent.
    drop(db);
    let db2 = FreeWorldDb::open(path.to_str().unwrap())?;
    assert_eq!(db2.get_grant("g1")?.unwrap().dao_proposal_id, Some(7));

    let _ = std::fs::remove_file(&path);
    Ok(())
}
