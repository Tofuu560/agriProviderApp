CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('provider', 'qa', 'assessor')),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

COMMENT ON COLUMN users.password IS
  'Store a one-way password hash here, never a plaintext password.';

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  programme TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  learner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
  synced BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (record_id, learner_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  programme_id TEXT PRIMARY KEY,
  status TEXT NOT NULL
);
