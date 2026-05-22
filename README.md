# Payku Movistar Arena

Aplicación estática para gestionar invitaciones a eventos de Movistar Arena usando Supabase.

## Archivos

- `index.html`: solicitud de entradas y estacionamientos. Usa Google OAuth para trabajadores y mantiene selector manual solo para admin.
- `login.html`: acceso administrador para páginas internas.
- `eventos.html`: importador XLSX de eventos y estado cancelado/activo.
- `trabajadores.html`: importador XLSX de nómina, alta manual, edición con correo y eliminación.
- `ranking.html`: ranking de trabajadores por entradas solicitadas.
- `admin.html`: asignación administrativa por mes, cupos, bajas y reubicaciones.
- `supabase-movistar.sql`: tablas, índices, políticas RLS y RPC admin necesarias.
- `backend/`: API mínima para validar Google OAuth y emitir sesiones Movistar.





