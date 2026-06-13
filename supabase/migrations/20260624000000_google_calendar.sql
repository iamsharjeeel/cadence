-- Google Calendar integration tables
-- Run in Supabase SQL editor before deploying Google Calendar features.

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  expires_at timestamptz NOT NULL,
  google_email text,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own google connection"
  ON google_calendar_connections
  FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS google_selected_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  calendar_name text NOT NULL,
  is_synced boolean DEFAULT true,
  UNIQUE(user_id, calendar_id)
);

ALTER TABLE google_selected_calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendars"
  ON google_selected_calendars
  FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS google_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL,
  title text,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  organizer_email text,
  organizer_name text,
  guests jsonb DEFAULT '[]',
  html_link text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own events"
  ON google_calendar_events
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gcal_events_user_date
  ON google_calendar_events(user_id, start_at);
