CREATE TABLE plans (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  week TEXT NOT NULL,
  body TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);
--> statement-breakpoint
CREATE INDEX plans_by_owner_week ON plans (owner, week DESC, updated DESC);
