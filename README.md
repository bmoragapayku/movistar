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

## Instalación Supabase

1. Ejecutar `supabase-movistar.sql` en Supabase > SQL Editor.
2. En `trabajadores.html`, cargar o editar cada trabajador con su correo `@payku.com`.
3. Subir la carpeta `movistar` al hosting estático.
4. Abrir `movistar/index.html`.

## OAuth Google

La pagina publica de registro es `index.html`. Para habilitar el inicio de sesion con Google:

1. En `index.html`, reemplaza `REEMPLAZA_CON_TU_GOOGLE_CLIENT_ID` por el Google Client ID público.
2. Levanta el backend local:

```bash
cd movistar/backend
cp .env.example .env
npm install
npm run dev
```

3. Configura `.env` con:

```bash
PORT=8787
GOOGLE_AUTH_URL=https://www.googleapis.com/oauth2/v3/userinfo
MOVISTAR_SESSION_SECRET=un-secreto-propio-largo
SUPABASE_URL=https://wlkwvzwxshbkwyeyhncd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key-de-supabase
CORS_ORIGIN=http://localhost:8080
```

`SUPABASE_SERVICE_ROLE_KEY` y `MOVISTAR_SESSION_SECRET` solo deben quedar en el backend. No van en ningún HTML.

El backend valida el access token contra Google, exige email verificado y dominio `@payku.com`, busca el trabajador por email en Supabase y emite una sesion JWT de 12 horas para registrar solicitudes.

Para hosting público, cambia `MOVISTAR_AUTH_API` en `index.html` a la URL publicada del backend y configura `CORS_ORIGIN` con el dominio donde estará alojado el HTML.

## Acceso admin

Las páginas `eventos.html`, `trabajadores.html`, `ranking.html` y `admin.html` requieren login.

- Correo: `andrea@payku.com`
- Contraseña: `Events9649`
