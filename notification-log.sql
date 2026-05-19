-- ============================================================
-- PAYKU MOVISTAR ARENA · Log de notificaciones por correo
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS movistar_notification_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id    uuid NOT NULL REFERENCES movistar_invitation_requests(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL,
  worker_id     uuid NOT NULL,
  sent_to       text NOT NULL,
  tickets_sent  int  NOT NULL DEFAULT 0,
  parkings_sent int  NOT NULL DEFAULT 0,
  sent_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movistar_notif_request
  ON movistar_notification_log (request_id, sent_at DESC);

ALTER TABLE movistar_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movistar notif read"   ON movistar_notification_log;
DROP POLICY IF EXISTS "movistar notif insert" ON movistar_notification_log;
CREATE POLICY "movistar notif read"   ON movistar_notification_log FOR SELECT USING (true);
CREATE POLICY "movistar notif insert" ON movistar_notification_log FOR INSERT  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
