-- ============================================================
-- PAYKU MOVISTAR ARENA · Log temporal de sync desde Movistar
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS movistar_sync_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text NOT NULL,
  event_date  date NOT NULL,
  start_time  text,
  synced_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movistar_sync_log_date ON movistar_sync_log (event_date);

ALTER TABLE movistar_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movistar sync read"   ON movistar_sync_log;
DROP POLICY IF EXISTS "movistar sync insert" ON movistar_sync_log;
DROP POLICY IF EXISTS "movistar sync delete" ON movistar_sync_log;
CREATE POLICY "movistar sync read"   ON movistar_sync_log FOR SELECT USING (true);
CREATE POLICY "movistar sync insert" ON movistar_sync_log FOR INSERT  WITH CHECK (true);
CREATE POLICY "movistar sync delete" ON movistar_sync_log FOR DELETE  USING (true);

NOTIFY pgrst, 'reload schema';
