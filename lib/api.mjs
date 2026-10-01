import { timingSafeEqual } from 'node:crypto';

export function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function unauthorized() {
  return new Response('Admin access required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Go Bot Free Admin", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

function same(actual, expected) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(request) {
  const [scheme, encoded] = (request.headers.get('authorization') || '').split(' ');
  const [username, ...passwordParts] = scheme === 'Basic' ? Buffer.from(encoded || '', 'base64').toString('utf8').split(':') : [];
  const password = passwordParts.join(':');
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD && username !== undefined
    && same(username, process.env.ADMIN_USER) && same(password, process.env.ADMIN_PASSWORD));
}

export async function readJson(request, maxBytes = 8192) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Please submit valid form data.'), { status: 400 });
  }
}

export function cleanSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes('username') || !keys.includes('reelUrl')) return null;
  const username = typeof input.username === 'string' ? input.username.trim().replace(/^@/, '') : '';
  const reelUrl = typeof input.reelUrl === 'string' ? input.reelUrl.trim() : '';
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username) || reelUrl.length > 500) return null;
  try {
    const parsed = new URL(reelUrl);
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(parsed.hostname.toLowerCase())
      || !/^\/(reel|reels)\/[\w-]+\/?$/i.test(parsed.pathname)) return null;
    return { username, reel_url: parsed.toString() };
  } catch {
    return null;
  }
}

export function cleanPost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 1 || !keys.includes('post')) return null;
  const post = typeof input.post === 'string' ? input.post.trim() : '';
  return post.length > 0 && post.length <= 800 ? { post } : null;
}

function databaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Database is not configured.');
  return { url, key };
}

async function databaseRequest(table, options = {}) {
  const { url, key } = databaseConfig();
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  if (options.select) endpoint.searchParams.set('select', options.select);
  if (options.order) endpoint.searchParams.set('order', options.order);
  endpoint.searchParams.set('limit', '1000');
  const response = await fetch(endpoint, {
    method: options.body ? 'POST' : 'GET',
    headers: { apikey: key, 'Content-Type': 'application/json', ...(options.body ? { Prefer: 'return=minimal' } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}).`);
  return options.body ? null : response.json();
}

export async function insertEntry(table, item) {
  return databaseRequest(table, { body: item });
}

export async function listEntries(table, select) {
  return databaseRequest(table, { select, order: 'created_at.desc' });
}

export async function sendTelegram(text) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = process.env;
  if (!token || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    return response.ok && result.ok === true;
  } catch {
    console.warn('Telegram notification could not be delivered. The submission was saved.');
    return false;
  }
}

export function failure(error, fallback) {
  console.error(error.message);
  const status = error.status || (error.message === 'Database is not configured.' ? 503 : 500);
  return json({ error: status === 503 ? 'The request inbox is not configured yet.' : fallback }, status);
}
