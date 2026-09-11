use zion_issobella::db::{
    DisbursementRecord, IssobellaDb, MissionRecord, ObservationRecord, ResearchProposal,
};
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
fn test_mission_status_validation() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let mission = MissionRecord::new("Lunar Gateway", "research", 100_000_000);
    db.insert_mission(&mission)?;

    let approved = db.update_mission_status(&mission.id, "approved")?;
    assert_eq!(approved.status, "approved");
    assert!(approved.started_at.is_none());

    let operational = db.update_mission_status(&mission.id, "operational")?;
    assert_eq!(operational.status, "operational");
    assert!(operational.started_at.is_some());

    let completed = db.update_mission_status(&mission.id, "completed")?;
    assert_eq!(completed.status, "completed");
    assert!(completed.completed_at.is_some());

    Ok(())
}

#[test]
fn test_mission_status_rejects_invalid() {
    let db = in_memory_db().unwrap();

    let mission = MissionRecord::new("Mars Colony", "mesh_network", 1_000_000_000);
    db.insert_mission(&mission).unwrap();

    let result = db.update_mission_status(&mission.id, "completed");
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("Invalid mission status transition"));
}

#[test]
fn test_update_mission_spent_and_satellites() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let mission = MissionRecord::new("CubeSat Mesh", "cubesat", 10_000_000);
    db.insert_mission(&mission)?;

    let updated = db.update_mission_spent_and_satellites(&mission.id, 3_000_000, Some(12))?;
    assert_eq!(updated.spent_zion, 3_000_000);
    assert_eq!(updated.satellite_count, 12);

    let second = db.update_mission_spent_and_satellites(&mission.id, 5_000_000, None)?;
    assert_eq!(second.spent_zion, 8_000_000);
    assert_eq!(second.satellite_count, 12);

    let over = db.update_mission_spent_and_satellites(&mission.id, 5_000_000, None);
    assert!(over.is_err());

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
fn test_proposal_approve_and_reject() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let proposal = ResearchProposal::new("Deep Space Telescope", 20_000_000);
    db.insert_proposal(&proposal)?;

    let approved =
        db.update_proposal_status(&proposal.id, "approved", Some("Excellent science return."))?;
    assert_eq!(approved.status, "approved");
    assert_eq!(
        approved.reviewer_notes.as_deref(),
        Some("Excellent science return.")
    );
    assert!(approved.reviewed_at.is_some());

    let rejected_proposal = ResearchProposal::new("Low Priority Survey", 5_000_000);
    db.insert_proposal(&rejected_proposal)?;

    let rejected = db.update_proposal_status(&rejected_proposal.id, "rejected", None)?;
    assert_eq!(rejected.status, "rejected");
    assert!(rejected.reviewed_at.is_some());

    Ok(())
}

#[test]
fn test_proposal_status_rejects_invalid() {
    let db = in_memory_db().unwrap();

    let proposal = ResearchProposal::new("Invalid Transition", 1_000_000);
    db.insert_proposal(&proposal).unwrap();

    db.update_proposal_status(&proposal.id, "approved", None)
        .unwrap();

    let result = db.update_proposal_status(&proposal.id, "rejected", None);
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("Invalid proposal status transition"));
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

#[test]
fn test_observation_lifecycle() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let mission = MissionRecord::new("Spectroscopy Mission", "observatory", 30_000_000);
    db.insert_mission(&mission)?;

    let mut observation = ObservationRecord::new(&mission.id, "spectroscopy");
    observation.data_url = Some("s3://issobella/spectrum-001.fits".to_string());
    observation.metadata = Some("wavelength=400-700nm".to_string());
    observation.published = true;

    db.insert_observation(&observation)?;

    let fetched = db.get_observation(&observation.id)?;
    assert_eq!(fetched.observation_type, "spectroscopy");
    assert!(fetched.published);

    let by_mission = db.list_observations(Some(&mission.id))?;
    assert_eq!(by_mission.len(), 1);

    let all = db.list_observations(None)?;
    assert_eq!(all.len(), 1);

    let mut updated = fetched.clone();
    updated.published = false;
    db.update_observation(&updated)?;

    let after = db.get_observation(&observation.id)?;
    assert!(!after.published);

    Ok(())
}

#[test]
fn test_disbursement_lifecycle() -> IssobellaResult<()> {
    let db = in_memory_db()?;

    let mission = MissionRecord::new("Funded Mission", "cubesat", 25_000_000);
    db.insert_mission(&mission)?;

    let mut balance = db.get_fund_balance()?;
    balance.total_accumulated = 50_000_000;
    db.update_fund_balance(&balance)?;

    let mut disbursement = DisbursementRecord::new(&mission.id, 10_000_000);
    disbursement.recipient = Some("zion1vendor".to_string());
    disbursement.tx_hash = Some("tx-abc-123".to_string());

    db.record_disbursement(&disbursement)?;
    let fund = db.add_disbursement_to_fund_balance(10_000_000)?;

    assert_eq!(fund.total_disbursed, 10_000_000);

    let list = db.list_disbursements(Some(&mission.id))?;
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].amount_zion, 10_000_000);

    let all = db.list_disbursements(None)?;
    assert_eq!(all.len(), 1);

    Ok(())
}
