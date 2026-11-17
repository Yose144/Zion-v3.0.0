CREATE TABLE atelier_sources (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);
