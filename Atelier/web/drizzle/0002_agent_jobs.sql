CREATE TABLE atelier_agent_jobs (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  state TEXT NOT NULL,
  brief TEXT NOT NULL,
  result TEXT,
  lease TEXT,
  lease_until TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX atelier_agent_one_active ON atelier_agent_jobs (owner, plan_id)
  WHERE state IN ('queued', 'running');
--> statement-breakpoint
CREATE INDEX atelier_agent_queue ON atelier_agent_jobs (owner, state, created);
