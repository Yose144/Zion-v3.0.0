use zion_issobella::db::{IssobellaDb, MissionRecord, ResearchProposal};
use zion_issobella::error::IssobellaResult;

fn in_memory_db() -> IssobellaResult<IssobellaDb> {
    IssobellaDb::open(":memory:")
}

#[test]
fn test_mission_lifecycle() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let mission = MissionRecord::new("LEO Observatory v1", "observatory", 50_000_000);
    db.insert_mission(&mission)?;

    let missions = db.list_missions(None)?;
    assert_eq!(missions.len(), 1);
    assert_eq!(missions[0].name, "LEO Observatory v1");
    assert_eq!(missions[0].status, "planning");

    db.update_mission_status(&mission.id, "launched")?;

    let launched = db.list_missions(Some("launched"))?;
    assert_eq!(launched.len(), 1);
    assert_eq!(launched[0].status, "launched");

    Ok(())
}

#[test]
fn test_proposal_lifecycle() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let proposal = ResearchProposal::new("Quantum Sensor Array", 10_000_000);
    db.insert_proposal(&proposal)?;

    let proposals = db.list_proposals(None)?;
    assert_eq!(proposals.len(), 1);
    assert_eq!(proposals[0].title, "Quantum Sensor Array");
    assert_eq!(proposals[0].status, "submitted");

    Ok(())
}

#[test]
fn test_fund_balance() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let balance = db.get_fund_balance()?;
    assert_eq!(balance.total_accumulated, 0);

    let mut updated = balance.clone();
    updated.total_accumulated = 2_000_000_000;
    updated.last_block_height = 200;
    db.update_fund_balance(&updated)?;

    let fetched = db.get_fund_balance()?;
    assert_eq!(fetched.total_accumulated, 2_000_000_000);
    assert_eq!(fetched.last_block_height, 200);

    Ok(())
}
