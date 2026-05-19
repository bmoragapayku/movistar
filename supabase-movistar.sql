-- ============================================================
-- PAYKU MOVISTAR ARENA · Tablas para gestión de invitaciones
-- Ejecutar en Supabase > SQL Editor antes de usar los HTML.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS movistar_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key     text NOT NULL UNIQUE,
  event_date    date NOT NULL,
  event_name    text NOT NULL,
  start_time    text NOT NULL DEFAULT 'POR CONFIRMAR',
  is_cancelled  boolean NOT NULL DEFAULT false,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movistar_workers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  email           text,
  normalized_name text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE movistar_workers
ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS movistar_admin_users (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  name            text NOT NULL DEFAULT '',
  password_salt   text NOT NULL,
  password_hash   text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movistar_admin_sessions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id  uuid NOT NULL REFERENCES movistar_admin_users(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movistar_invitation_requests (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id            uuid NOT NULL REFERENCES movistar_events(id) ON DELETE CASCADE,
  worker_id           uuid NOT NULL REFERENCES movistar_workers(id) ON DELETE CASCADE,
  requested_tickets   int NOT NULL DEFAULT 0 CHECK (requested_tickets BETWEEN 0 AND 12),
  requested_parkings  int NOT NULL DEFAULT 0 CHECK (requested_parkings BETWEEN 0 AND 12),
  assigned_tickets    int NOT NULL DEFAULT 0 CHECK (assigned_tickets BETWEEN 0 AND 12),
  assigned_parkings   int NOT NULL DEFAULT 0 CHECK (assigned_parkings BETWEEN 0 AND 7),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  admin_note          text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_movistar_events_date ON movistar_events(event_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_movistar_workers_email
ON movistar_workers (lower(email))
WHERE email IS NOT NULL AND trim(email) <> '';
CREATE INDEX IF NOT EXISTS idx_movistar_admin_sessions_token ON movistar_admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_movistar_admin_sessions_expires ON movistar_admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_movistar_requests_event ON movistar_invitation_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_movistar_requests_worker ON movistar_invitation_requests(worker_id);

CREATE OR REPLACE FUNCTION movistar_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_movistar_events_updated_at ON movistar_events;
CREATE TRIGGER touch_movistar_events_updated_at
BEFORE UPDATE ON movistar_events
FOR EACH ROW EXECUTE FUNCTION movistar_touch_updated_at();

DROP TRIGGER IF EXISTS touch_movistar_workers_updated_at ON movistar_workers;
CREATE TRIGGER touch_movistar_workers_updated_at
BEFORE UPDATE ON movistar_workers
FOR EACH ROW EXECUTE FUNCTION movistar_touch_updated_at();

DROP TRIGGER IF EXISTS touch_movistar_admin_users_updated_at ON movistar_admin_users;
CREATE TRIGGER touch_movistar_admin_users_updated_at
BEFORE UPDATE ON movistar_admin_users
FOR EACH ROW EXECUTE FUNCTION movistar_touch_updated_at();

DROP TRIGGER IF EXISTS touch_movistar_requests_updated_at ON movistar_invitation_requests;
CREATE TRIGGER touch_movistar_requests_updated_at
BEFORE UPDATE ON movistar_invitation_requests
FOR EACH ROW EXECUTE FUNCTION movistar_touch_updated_at();

ALTER TABLE movistar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE movistar_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE movistar_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE movistar_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE movistar_invitation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movistar events read" ON movistar_events;
DROP POLICY IF EXISTS "movistar events insert" ON movistar_events;
DROP POLICY IF EXISTS "movistar events update" ON movistar_events;
DROP POLICY IF EXISTS "movistar events delete" ON movistar_events;
CREATE POLICY "movistar events read" ON movistar_events FOR SELECT USING (true);
CREATE POLICY "movistar events insert" ON movistar_events FOR INSERT WITH CHECK (true);
CREATE POLICY "movistar events update" ON movistar_events FOR UPDATE USING (true);
CREATE POLICY "movistar events delete" ON movistar_events FOR DELETE USING (true);

DROP POLICY IF EXISTS "movistar workers read" ON movistar_workers;
DROP POLICY IF EXISTS "movistar workers insert" ON movistar_workers;
DROP POLICY IF EXISTS "movistar workers update" ON movistar_workers;
DROP POLICY IF EXISTS "movistar workers delete" ON movistar_workers;
CREATE POLICY "movistar workers read" ON movistar_workers FOR SELECT USING (true);
CREATE POLICY "movistar workers insert" ON movistar_workers FOR INSERT WITH CHECK (true);
CREATE POLICY "movistar workers update" ON movistar_workers FOR UPDATE USING (true);
CREATE POLICY "movistar workers delete" ON movistar_workers FOR DELETE USING (true);

DROP POLICY IF EXISTS "movistar requests read" ON movistar_invitation_requests;
DROP POLICY IF EXISTS "movistar requests insert" ON movistar_invitation_requests;
DROP POLICY IF EXISTS "movistar requests update" ON movistar_invitation_requests;
DROP POLICY IF EXISTS "movistar requests delete" ON movistar_invitation_requests;
CREATE POLICY "movistar requests read" ON movistar_invitation_requests FOR SELECT USING (true);
CREATE POLICY "movistar requests insert" ON movistar_invitation_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "movistar requests update" ON movistar_invitation_requests FOR UPDATE USING (true);
CREATE POLICY "movistar requests delete" ON movistar_invitation_requests FOR DELETE USING (true);

INSERT INTO movistar_admin_users (email, name, password_salt, password_hash, is_active)
VALUES (
  'andrea@payku.com',
  'Andrea',
  'movistar-admin-2026-fb7d42b1',
  '90d1f069589f684a600c564e5784202568f2d2750df0f0290e47a5520de1b821',
  true
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_salt = EXCLUDED.password_salt,
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = now();

DROP FUNCTION IF EXISTS movistar_admin_login(text, text);
CREATE OR REPLACE FUNCTION movistar_admin_login(p_email text, p_password text)
RETURNS TABLE(ok boolean, token text, email text, expires_at timestamptz, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user movistar_admin_users%ROWTYPE;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  DELETE FROM movistar_admin_sessions
  WHERE movistar_admin_sessions.expires_at <= now();

  SELECT *
  INTO v_user
  FROM movistar_admin_users
  WHERE lower(movistar_admin_users.email) = lower(trim(p_email))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR encode(extensions.digest(convert_to(coalesce(p_password, '') || v_user.password_salt, 'UTF8'), 'sha256'), 'hex') <> v_user.password_hash THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::timestamptz, 'Credenciales inválidas'::text;
    RETURN;
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '12 hours';

  INSERT INTO movistar_admin_sessions (admin_user_id, token_hash, expires_at)
  VALUES (v_user.id, encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), v_expires_at);

  RETURN QUERY SELECT true, v_token, v_user.email, v_expires_at, 'OK'::text;
END;
$$;

DROP FUNCTION IF EXISTS movistar_admin_check_session(text);
CREATE OR REPLACE FUNCTION movistar_admin_check_session(p_token text)
RETURNS TABLE(ok boolean, email text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_expires_at timestamptz;
BEGIN
  DELETE FROM movistar_admin_sessions
  WHERE movistar_admin_sessions.expires_at <= now();

  SELECT u.email, s.expires_at
  INTO v_email, v_expires_at
  FROM movistar_admin_sessions s
  JOIN movistar_admin_users u ON u.id = s.admin_user_id
  WHERE s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    AND s.expires_at > now()
    AND u.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE movistar_admin_sessions
  SET last_seen_at = now()
  WHERE movistar_admin_sessions.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex');

  RETURN QUERY SELECT true, v_email, v_expires_at;
END;
$$;

DROP FUNCTION IF EXISTS movistar_admin_logout(text);
CREATE OR REPLACE FUNCTION movistar_admin_logout(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM movistar_admin_sessions
  WHERE movistar_admin_sessions.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION movistar_admin_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION movistar_admin_check_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION movistar_admin_logout(text) TO anon, authenticated;

-- Fuerza a la API REST de Supabase/PostgREST a refrescar el schema cache.
NOTIFY pgrst, 'reload schema';
