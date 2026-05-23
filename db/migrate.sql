-- db/migrate.sql
-- WorldCup Fan Command Center — Neon Postgres Schema
-- Run once: psql $NEON_DATABASE_URL -f db/migrate.sql

-- ─── Extensions ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search

-- ─── User Profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id               TEXT PRIMARY KEY,         -- Firebase UID
  display_name     TEXT,
  email            TEXT UNIQUE,
  passport_country TEXT,
  home_city        TEXT,
  home_country     TEXT,
  currency         TEXT NOT NULL DEFAULT 'USD',
  fcm_token        TEXT,                     -- Firebase push token
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ─── Match Fixtures (synced daily from FIFA) ───────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id               TEXT PRIMARY KEY,         -- FIFA match ID
  home_team        TEXT NOT NULL,
  away_team        TEXT NOT NULL,
  match_date       TIMESTAMPTZ NOT NULL,
  venue            TEXT,
  city             TEXT,
  country          TEXT,
  stage            TEXT,                     -- Group A..H, R32, QF, SF, Final
  group_name       TEXT,
  tickets_url      TEXT,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches USING gin(
  (home_team || ' ' || away_team) gin_trgm_ops
);

-- ─── Saved Trip Plans ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  match_id         TEXT REFERENCES matches(id),
  origin_city      TEXT NOT NULL,
  origin_country   TEXT,
  destination_city TEXT NOT NULL,
  destination_country TEXT,
  travel_dates     JSONB,                    -- { depart: date, return: date }
  flights          JSONB,                    -- FlightOption[]
  accommodation    JSONB,                    -- HotelOption[]
  visa             JSONB,                    -- VisaInfo
  itinerary        JSONB,                    -- ItineraryDay[]
  cost_breakdown   JSONB,                    -- { flights, hotel, visa, ... }
  budget           NUMERIC(12,2),
  currency         TEXT NOT NULL DEFAULT 'USD',
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','confirmed','completed','cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(user_id, status);

-- ─── Price Alerts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  trip_id          UUID REFERENCES trips(id) ON DELETE SET NULL,
  route_origin     TEXT NOT NULL,
  route_dest       TEXT NOT NULL,
  depart_from      DATE,
  depart_to        DATE,
  max_price        NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  current_price    NUMERIC(10,2),
  last_checked     TIMESTAMPTZ,
  triggered        BOOLEAN NOT NULL DEFAULT false,
  active           BOOLEAN NOT NULL DEFAULT true,
  notify_via       TEXT NOT NULL DEFAULT 'push'
                   CHECK (notify_via IN ('email','push','both')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON price_alerts(active, last_checked)
  WHERE active = true;

-- ─── Expenses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  trip_id          UUID REFERENCES trips(id) ON DELETE CASCADE,
  category         TEXT NOT NULL
                   CHECK (category IN ('flights','hotel','food','transport','tickets','misc')),
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL DEFAULT 'USD',
  description      TEXT,
  expense_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);

-- ─── Fantasy Profiles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fantasy_profiles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  platform         TEXT,                     -- 'fpl' | 'dream11' | 'sorare' | 'custom'
  budget           NUMERIC(10,2),
  team             JSONB,                    -- current squad
  history          JSONB,                    -- past transfers + scores
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- ─── Agent Run Logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          TEXT,
  session_id       TEXT,
  skill_id         TEXT,
  goal             TEXT,
  tool_calls       JSONB,                    -- ToolCall[]
  result           TEXT,
  tokens_used      INTEGER,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_user ON agent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_skill ON agent_runs(skill_id);

-- ─── Host Cities (seed data) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS host_cities (
  id           SERIAL PRIMARY KEY,
  city         TEXT NOT NULL,
  country      TEXT NOT NULL,
  stadium      TEXT NOT NULL,
  capacity     INTEGER,
  timezone     TEXT,
  airport_code TEXT,
  lat          NUMERIC(9,6),
  lng          NUMERIC(9,6)
);

INSERT INTO host_cities (city, country, stadium, capacity, timezone, airport_code, lat, lng)
VALUES
  ('New York/New Jersey', 'USA', 'MetLife Stadium',         82500, 'America/New_York',    'EWR', 40.8136, -74.0744),
  ('Los Angeles',         'USA', 'SoFi Stadium',            70240, 'America/Los_Angeles', 'LAX', 33.9534, -118.3392),
  ('Dallas',              'USA', 'AT&T Stadium',            80000, 'America/Chicago',     'DFW', 32.7480, -97.0930),
  ('San Francisco',       'USA', 'Levi''s Stadium',         68500, 'America/Los_Angeles', 'SFO', 37.4032, -121.9698),
  ('Miami',               'USA', 'Hard Rock Stadium',       65326, 'America/New_York',    'MIA', 25.9580, -80.2389),
  ('Atlanta',             'USA', 'Mercedes-Benz Stadium',   71000, 'America/New_York',    'ATL', 33.7554, -84.4010),
  ('Seattle',             'USA', 'Lumen Field',             69000, 'America/Los_Angeles', 'SEA', 47.5952, -122.3316),
  ('Boston',              'USA', 'Gillette Stadium',        65878, 'America/New_York',    'BOS', 42.0909, -71.2643),
  ('Kansas City',         'USA', 'Arrowhead Stadium',       73000, 'America/Chicago',     'MCI', 39.0489, -94.4839),
  ('Philadelphia',        'USA', 'Lincoln Financial Field', 67594, 'America/New_York',    'PHL', 39.9007, -75.1675),
  ('Houston',             'USA', 'NRG Stadium',             72220, 'America/Chicago',     'IAH', 29.6847, -95.4107),
  ('Vancouver',           'Canada', 'BC Place',             54500, 'America/Vancouver',   'YVR', 49.2767, -123.1117),
  ('Toronto',             'Canada', 'BMO Field',            45736, 'America/Toronto',     'YYZ', 43.6333, -79.4179),
  ('Guadalajara',         'Mexico', 'Estadio Akron',        49850, 'America/Mexico_City', 'GDL', 20.7264, -103.4548),
  ('Mexico City',         'Mexico', 'Estadio Azteca',       87523, 'America/Mexico_City', 'MEX', 19.3029, -99.1505),
  ('Monterrey',           'Mexico', 'Estadio BBVA',         51349, 'America/Monterrey',   'MTY', 25.6693, -100.2438)
ON CONFLICT DO NOTHING;

-- ─── Views ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW trip_budget_summary AS
SELECT
  t.id AS trip_id,
  t.user_id,
  t.destination_city,
  t.budget,
  t.currency,
  COALESCE(SUM(e.amount), 0)                                       AS total_spent,
  t.budget - COALESCE(SUM(e.amount), 0)                           AS remaining,
  ROUND(COALESCE(SUM(e.amount), 0) / NULLIF(t.budget, 0) * 100, 1) AS pct_used
FROM trips t
LEFT JOIN expenses e ON e.trip_id = t.id
GROUP BY t.id, t.user_id, t.destination_city, t.budget, t.currency;

CREATE OR REPLACE VIEW alerts_due AS
SELECT *
FROM price_alerts
WHERE active = true
  AND (last_checked IS NULL OR last_checked < NOW() - INTERVAL '5 hours')
ORDER BY created_at ASC;
