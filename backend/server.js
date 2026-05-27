require('dotenv').config();

const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { parse: parseHtml } = require('node-html-parser');

const PORT = Number(process.env.PORT || 8787);
const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://www.googleapis.com/oauth2/v3/userinfo';
const MOVISTAR_SESSION_SECRET = process.env.MOVISTAR_SESSION_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'Movistar Arena <onboarding@resend.dev>';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const CORS_ORIGINS = String(process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const MOVISTAR_CARTELERA_URL = 'https://www.movistararena.cl/movistar/cartelera';
const MOVISTAR_BASE = 'https://www.movistararena.cl';
const MONTHS_ES = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
};

function normalizeStr(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function findExistingMatch(parsedEvent, existingEvents) {
  const norm = normalizeStr(parsedEvent.event_name);
  for (const e of existingEvents) {
    if (e.event_key === parsedEvent.event_key) return e;
    if (e.event_date !== parsedEvent.event_date) continue;
    const existNorm = normalizeStr(e.event_name);
    if (existNorm === norm) return e;
    if (norm.includes(existNorm) || existNorm.includes(norm)) return e;
  }
  return null;
}

function buildEventKey(date, name, time) {
  return `${date}|${normalizeStr(name)}|${normalizeStr(time)}`;
}

function parseMovistarCard(card) {
  const img = card.querySelector('img[src*="/movistar/site/artic/"]');
  const heading = card.querySelector('h3') || card.querySelector('h2');
  if (!heading) return null;

  const name = heading.text.trim().replace(/\s+/g, ' ');
  if (!name) return null;

  const cardText = card.text;
  const dateMatch = cardText.match(
    /(\d{1,2})\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s*\/\s*(\d{1,2}:\d{2})\s*hrs/i
  );
  if (!dateMatch) return null;

  const day = parseInt(dateMatch[1], 10);
  const monthNum = MONTHS_ES[dateMatch[2].toLowerCase()];
  const timeRaw = dateMatch[3];
  if (!monthNum) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let eventDate = new Date(now.getFullYear(), monthNum - 1, day);
  if (eventDate < today) eventDate = new Date(now.getFullYear() + 1, monthNum - 1, day);

  const date = `${eventDate.getFullYear()}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = `${timeRaw} HRS`;
  const imageUrl = img ? `${MOVISTAR_BASE}${img.getAttribute('src')}` : null;

  return { event_date: date, event_name: name, start_time: time, image_url: imageUrl };
}

function requireEnv(name, value) {
  if (!value || value === 'change-me') {
    throw new Error(`Configura ${name} en .env`);
  }
}

requireEnv('MOVISTAR_SESSION_SECRET', MOVISTAR_SESSION_SECRET);
requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function publicWorker(worker) {
  return {
    id: worker.id,
    name: worker.name,
    email: normalizeEmail(worker.email)
  };
}

function signWorkerSession(worker) {
  const workerPayload = publicWorker(worker);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const token = jwt.sign(
    {
      workerId: workerPayload.id,
      email: workerPayload.email,
      name: workerPayload.name
    },
    MOVISTAR_SESSION_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );
  return { token, expires_at: expiresAt, worker: workerPayload };
}

function unauthorized(message) {
  const error = new Error(message);
  error.status = 401;
  return error;
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_AUTH_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw unauthorized('No se pudo validar la sesión de Google.');
  }

  return response.json();
}

async function findWorkerByEmail(email) {
  const { data, error } = await supabase
    .from('movistar_workers')
    .select('id,name,email')
    .ilike('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function requireSession(req, res, next) {
  const header = req.get('authorization') || '';
  const [type, token] = header.split(/\s+/);

  if (type !== 'Bearer' || !token) {
    next(unauthorized('Sesión no válida.'));
    return;
  }

  try {
    const payload = jwt.verify(token, MOVISTAR_SESSION_SECRET);
    const { data, error } = await supabase
      .from('movistar_workers')
      .select('id,name,email')
      .eq('id', payload.workerId)
      .maybeSingle();

    if (error) throw error;
    if (!data || normalizeEmail(data.email) !== normalizeEmail(payload.email)) {
      throw unauthorized('Sesión no válida.');
    }

    req.worker = publicWorker(data);
    next();
  } catch (error) {
    if (!error.status) error.status = 401;
    if (!error.message || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error.message = 'Sesión vencida o no válida.';
    }
    next(error);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/google', async (req, res, next) => {
  try {
    const { provider, data } = req.body || {};
    const accessToken = data?.access_token;
    const tokenType = data?.token_type || 'Bearer';

    if (provider !== 'google') {
      throw unauthorized('Proveedor no permitido.');
    }
    if (!accessToken || tokenType !== 'Bearer') {
      throw unauthorized('Token de Google no válido.');
    }

    const userInfo = await fetchGoogleUserInfo(accessToken);
    const email = normalizeEmail(userInfo.email);

    if (!email || userInfo.email_verified !== true) {
      throw unauthorized('Tu correo de Google no está verificado.');
    }
    const worker = await findWorkerByEmail(email);
    if (!worker) {
      throw unauthorized('Tu correo no está asociado a un trabajador autorizado.');
    }

    res.json({
      status: 'success',
      ...signWorkerSession(worker)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireSession, (req, res) => {
  res.json({
    status: 'success',
    worker: req.worker
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ status: 'success' });
});

function escHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHtml({ worker, event, assigned_tickets, assigned_parkings }) {
  const eventDate = event?.event_date
    ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const startTime = event?.start_time ? ` · ${event.start_time} HRS` : '';
  const hasTickets = assigned_tickets > 0;
  const hasParkings = assigned_parkings > 0;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#faf7fc;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ded5e6;">
    <div style="background:#310065;padding:28px;">
      <p style="margin:0 0 6px;color:#c4a8e8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;">Movistar Arena · Confirmación</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">${escHtml(event?.event_name || 'Evento')}</h1>
      <p style="margin:8px 0 0;color:#c4a8e8;font-size:14px;">${escHtml(eventDate)}${escHtml(startTime)}</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 24px;font-size:15px;color:#1d1a21;">
        Hola <strong>${escHtml(worker?.name || '')}</strong>,<br>
        el administrador confirmó tu asignación para este evento:
      </p>
      <div style="display:flex;gap:16px;margin-bottom:28px;">
        ${hasTickets ? `
        <div style="flex:1;border:1px solid #ded5e6;border-radius:8px;padding:18px;text-align:center;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#625b6a;">Entradas</p>
          <p style="margin:0;font-size:40px;font-weight:800;color:#310065;">${assigned_tickets}</p>
        </div>` : ''}
        ${hasParkings ? `
        <div style="flex:1;border:1px solid #ded5e6;border-radius:8px;padding:18px;text-align:center;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#625b6a;">Estacionamientos</p>
          <p style="margin:0;font-size:40px;font-weight:800;color:#310065;">${assigned_parkings}</p>
        </div>` : ''}
        ${!hasTickets && !hasParkings ? `
        <div style="flex:1;border:1px solid #fecaca;border-radius:8px;padding:18px;text-align:center;background:#fff7f7;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#ba1a1a;">Sin entradas ni estacionamientos asignados este evento.</p>
        </div>` : ''}
      </div>
      <p style="margin:0;font-size:13px;color:#625b6a;">Puedes revisar el detalle de tus solicitudes en la plataforma Movistar Arena.</p>
    </div>
    <div style="border-top:1px solid #ded5e6;padding:16px 28px;background:#faf7fc;">
      <p style="margin:0;font-size:12px;color:#625b6a;">Payku · Movistar Arena — correo automático, no responder.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildSlackBlocks({ worker, event, assigned_tickets, assigned_parkings }) {
  const eventDate = event?.event_date
    ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-CL', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
    : '';
  const parts = [];
  if (assigned_tickets > 0) parts.push(`*${assigned_tickets}* ${assigned_tickets === 1 ? 'entrada' : 'entradas'}`);
  if (assigned_parkings > 0) parts.push(`*${assigned_parkings}* ${assigned_parkings === 1 ? 'estacionamiento' : 'estacionamientos'}`);
  const assignedText = parts.length ? parts.join(' · ') : '_sin asignación_';
  return [
    { type: 'header', text: { type: 'plain_text', text: `🎵 ${event?.event_name || 'Evento'} · Movistar Arena`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `Hola *${worker?.name || ''}*, el administrador confirmó tu asignación para este evento.` } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `*Fecha*\n${eventDate}` },
      { type: 'mrkdwn', text: `*Hora*\n${event?.start_time || '—'}` },
      { type: 'mrkdwn', text: `*Asignado*\n${assignedText}` }
    ]},
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Payku · Movistar Arena — notificación automática' }] }
  ];
}

async function sendSlackDm(email, blocks, fallbackText) {
  if (!SLACK_BOT_TOKEN) return { ok: false, error: 'no_token' };

  const userRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
  });
  const userData = await userRes.json();
  if (!userData.ok) return { ok: false, error: userData.error };

  const dmRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: userData.user.id })
  });
  const dmData = await dmRes.json();
  if (!dmData.ok) return { ok: false, error: dmData.error };

  const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: dmData.channel.id, text: fallbackText, blocks })
  });
  const msgData = await msgRes.json();
  return { ok: msgData.ok, error: msgData.error };
}

app.post('/api/admin/notify', async (req, res, next) => {
  try {
    const { adminToken, requestId } = req.body || {};
    if (!adminToken || !requestId) {
      const err = new Error('adminToken y requestId son requeridos.');
      err.status = 400;
      throw err;
    }

    const { data: sessionData, error: sessionError } = await supabase
      .rpc('movistar_admin_check_session', { p_token: adminToken });
    const sessionResult = Array.isArray(sessionData) ? sessionData[0] : sessionData;
    if (sessionError || !sessionResult?.ok) {
      throw Object.assign(new Error('Sesión de administrador no válida.'), { status: 401 });
    }

    const { data: request, error: reqError } = await supabase
      .from('movistar_invitation_requests')
      .select('*, worker:movistar_workers(id,name,email), event:movistar_events(id,event_name,event_date,start_time)')
      .eq('id', requestId)
      .single();
    if (reqError || !request) {
      throw Object.assign(new Error('Solicitud no encontrada.'), { status: 404 });
    }

    const workerEmail = normalizeEmail(request.worker?.email);
    if (!workerEmail) {
      throw Object.assign(new Error('El trabajador no tiene correo registrado.'), { status: 400 });
    }
    if (!RESEND_API_KEY || RESEND_API_KEY === 'change-me') {
      throw Object.assign(new Error('RESEND_API_KEY no configurado en el backend.'), { status: 500 });
    }

    const slackBlocks = buildSlackBlocks({
      worker: request.worker,
      event: request.event,
      assigned_tickets: request.assigned_tickets,
      assigned_parkings: request.assigned_parkings
    });
    const slackFallback = `Tus entradas para ${request.event?.event_name || 'el evento'} han sido confirmadas.`;

    const [emailRes, slackResult] = await Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: [workerEmail],
          subject: `Tus entradas para ${request.event?.event_name || 'el evento'} · Movistar Arena`,
          html: buildEmailHtml({
            worker: request.worker,
            event: request.event,
            assigned_tickets: request.assigned_tickets,
            assigned_parkings: request.assigned_parkings
          })
        })
      }),
      sendSlackDm(workerEmail, slackBlocks, slackFallback).catch(err => ({ ok: false, error: err.message }))
    ]);

    if (!emailRes.ok) {
      const emailErr = await emailRes.json().catch(() => ({}));
      throw new Error(emailErr.message || `Error Resend ${emailRes.status}`);
    }

    const slackSent = slackResult.ok === true;
    const sentAt = new Date().toISOString();
    const { error: logError } = await supabase.from('movistar_notification_log').insert({
      request_id:    requestId,
      event_id:      request.event_id,
      worker_id:     request.worker_id,
      sent_to:       workerEmail,
      tickets_sent:  request.assigned_tickets,
      parkings_sent: request.assigned_parkings,
      slack_sent:    slackSent
    });
    if (logError) throw new Error(`Correo enviado pero no se pudo guardar el registro: ${logError.message}`);

    res.json({
      status:        'success',
      sent_to:       workerEmail,
      tickets_sent:  request.assigned_tickets,
      parkings_sent: request.assigned_parkings,
      sent_at:       sentAt,
      slack_sent:    slackSent,
      slack_error:   slackSent ? undefined : (slackResult.error || 'unknown')
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/sync-movistar', async (req, res, next) => {
  try {
    const { adminToken } = req.body || {};
    if (!adminToken) throw Object.assign(new Error('adminToken es requerido.'), { status: 400 });

    const { data: sessionData, error: sessionError } = await supabase
      .rpc('movistar_admin_check_session', { p_token: adminToken });
    const sessionResult = Array.isArray(sessionData) ? sessionData[0] : sessionData;
    if (sessionError || !sessionResult?.ok) {
      throw Object.assign(new Error('Sesión de administrador no válida.'), { status: 401 });
    }

    const pageRes = await fetch(MOVISTAR_CARTELERA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovistarSync/1.0)' }
    });
    if (!pageRes.ok) throw new Error(`No se pudo obtener la cartelera de Movistar (HTTP ${pageRes.status}).`);
    const html = await pageRes.text();
    const root = parseHtml(html);

    const parsed = [];
    const seen = new Set();

    const verMasLinks = root.querySelectorAll('a[href*="/nuestra-cartelera/conciertos/"]');
    for (const link of verMasLinks) {
      if (!link.text.trim().toLowerCase().includes('ver')) continue;
      let card = link.parentNode;
      let depth = 0;
      while (card && !card.querySelector('img[src*="/movistar/site/artic/"]') && depth < 6) {
        card = card.parentNode;
        depth++;
      }
      if (!card) continue;
      const eventData = parseMovistarCard(card);
      if (!eventData) continue;
      const key = buildEventKey(eventData.event_date, eventData.event_name, eventData.start_time);
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ ...eventData, event_key: key });
    }

    if (!parsed.length) throw new Error('No se encontraron eventos en la cartelera de Movistar Arena.');

    const { data: existing, error: readError } = await supabase
      .from('movistar_events').select('id, event_key, event_date, event_name');
    if (readError) throw readError;

    const toInsert = [];
    const toUpdate = [];
    for (const event of parsed) {
      const match = findExistingMatch(event, existing || []);
      if (match) {
        if (event.image_url) toUpdate.push({ id: match.id, image_url: event.image_url });
      } else {
        toInsert.push(event);
      }
    }

    if (toInsert.length) {
      const { error } = await supabase.from('movistar_events').insert(toInsert);
      if (error) throw error;
    }

    let updatedCount = 0;
    for (const upd of toUpdate) {
      const { error } = await supabase.from('movistar_events')
        .update({ image_url: upd.image_url }).eq('id', upd.id);
      if (!error) updatedCount++;
    }

    // Reemplazar log temporal con los eventos nuevos de este sync
    await supabase.from('movistar_sync_log').delete().not('id', 'is', null);
    if (toInsert.length) {
      await supabase.from('movistar_sync_log').insert(
        toInsert.map(e => ({ event_name: e.event_name, event_date: e.event_date, start_time: e.start_time }))
      );
    }

    res.json({
      status: 'success',
      found: parsed.length,
      inserted: toInsert.length,
      updated: updatedCount,
      new_events: toInsert.map(e => ({ event_name: e.event_name, event_date: e.event_date, start_time: e.start_time }))
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/dedup-events', async (req, res, next) => {
  try {
    const { adminToken } = req.body || {};
    if (!adminToken) throw Object.assign(new Error('adminToken es requerido.'), { status: 400 });

    const { data: sessionData, error: sessionError } = await supabase
      .rpc('movistar_admin_check_session', { p_token: adminToken });
    const sessionResult = Array.isArray(sessionData) ? sessionData[0] : sessionData;
    if (sessionError || !sessionResult?.ok) throw Object.assign(new Error('Sesión no válida.'), { status: 401 });

    const { data: events, error: evErr } = await supabase
      .from('movistar_events')
      .select('id, event_date, event_name, start_time, image_url, created_at')
      .order('event_date').order('created_at');
    if (evErr) throw evErr;

    const byDate = {};
    for (const e of (events || [])) {
      if (!byDate[e.event_date]) byDate[e.event_date] = [];
      byDate[e.event_date].push(e);
    }

    let deleted = 0, imageUpdated = 0, skipped = 0;

    for (const dayEvents of Object.values(byDate)) {
      if (dayEvents.length < 2) continue;
      const processed = new Set();

      for (let i = 0; i < dayEvents.length; i++) {
        if (processed.has(i)) continue;
        const normI = normalizeStr(dayEvents[i].event_name);
        const group = [dayEvents[i]];

        for (let j = i + 1; j < dayEvents.length; j++) {
          if (processed.has(j)) continue;
          const normJ = normalizeStr(dayEvents[j].event_name);
          if (normI.includes(normJ) || normJ.includes(normI)) {
            group.push(dayEvents[j]);
            processed.add(j);
          }
        }
        processed.add(i);
        if (group.length < 2) continue;

        // group[0] is oldest (XLS import), keep it — group[1+] are duplicates from Movistar sync
        const keeper = group[0];
        for (const dup of group.slice(1)) {
          const { count } = await supabase
            .from('movistar_invitation_requests')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', dup.id);
          if ((count || 0) > 0) { skipped++; continue; }

          if (!keeper.image_url && dup.image_url) {
            const { error: imgErr } = await supabase.from('movistar_events')
              .update({ image_url: dup.image_url }).eq('id', keeper.id);
            if (!imgErr) { keeper.image_url = dup.image_url; imageUpdated++; }
          }

          await supabase.from('movistar_events').delete().eq('id', dup.id);
          deleted++;
        }
      }
    }

    res.json({ status: 'success', deleted, image_updated: imageUpdated, skipped });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = status === 500 ? 'Error interno del servidor.' : error.message;
  if (status === 500) console.error(error);
  res.status(status).json({ status: 'error', message });
});

app.listen(PORT, () => {
  console.log(`Movistar auth backend escuchando en http://localhost:${PORT}`);
});
