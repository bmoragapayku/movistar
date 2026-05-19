-- ============================================================
-- PAYKU MOVISTAR ARENA · Registro de asistencia a eventos
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

ALTER TABLE movistar_invitation_requests
ADD COLUMN IF NOT EXISTS attended boolean;

-- null  → sin registrar
-- true  → asistió
-- false → no asistió

NOTIFY pgrst, 'reload schema';
