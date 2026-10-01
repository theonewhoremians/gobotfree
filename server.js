const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;

function loadLocalEnv() {
  const filename = path.join(ROOT, '.env');
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_USER and ADMIN_PASSWORD before starting the server.');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]\n', { flag: 'wx' });
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]\n', { flag: 'wx' });

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function secureEqual(actual, expected) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

function authorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return secureEqual(decoded.slice(0, separator), ADMIN_USER) && secureEqual(decoded.slice(separator + 1), ADMIN_PASSWORD);
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function sendTelegramNotification(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      console.warn(`Telegram notification failed with HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch {
    console.warn('Telegram notification could not be delivered. The submitted data was saved.');
    return false;
  }
}

function readJson(req, maxBytes = 8192) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Please submit valid form data.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cleanSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes('username') || !keys.includes('reelUrl')) return null;

  const username = typeof input.username === 'string' ? input.username.trim().replace(/^@/, '') : '';
  const reelUrl = typeof input.reelUrl === 'string' ? input.reelUrl.trim() : '';
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username) || reelUrl.length > 500) return null;

  let parsed;
  try {
    parsed = new URL(reelUrl);
  } catch {
    return null;
  }
  const allowedHosts = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
  if (!allowedHosts.has(parsed.hostname.toLowerCase()) || !/^\/(reel|reels)\/[\w-]+\/?$/i.test(parsed.pathname)) return null;
  return { username, reelUrl: parsed.toString() };
}

function cleanPost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 3 || !keys.includes('post') || !keys.includes('username') || !keys.includes('reelUrl')) return null;
  const identity = cleanSubmission({ username: input.username, reelUrl: input.reelUrl });

  const post = typeof input.post === 'string' ? input.post.trim() : '';
  if (!identity || !post.length || post.length > 800) return null;
  return { ...identity, post };
}

let saveQueue = Promise.resolve();
function saveEntry(filename, item) {
  const operation = saveQueue.then(async () => {
    const entries = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
    entries.unshift(item);
    await fs.promises.writeFile(filename, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
  });
  saveQueue = operation.catch(() => {});
  return operation;
}

async function serveStatic(res, filename, noStore = false) {
  try {
    const content = await fs.promises.readFile(filename);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      ...(noStore ? { 'Cache-Control': 'no-store' } : {}),
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'POST' && pathname === '/api/submissions') {
    try {
      const input = await readJson(req);
      const clean = cleanSubmission(input);
      if (!clean) return sendJson(res, 400, { error: 'Enter a valid Instagram username and Reel URL.' });
      const item = { id: crypto.randomUUID(), ...clean, createdAt: new Date().toISOString() };
      await saveEntry(DATA_FILE, item);
      const notificationSent = await sendTelegramNotification(`New Reel request\nInstagram: @${item.username}\nReel: ${item.reelUrl}`);
      return sendJson(res, 201, { ok: true, notificationSent });
    } catch (error) {
      if (!res.destroyed && !res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : 'Could not save your request. Please try again.' });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/posts') {
    try {
      const input = await readJson(req, 12000);
      const clean = cleanPost(input);
      if (!clean) return sendJson(res, 400, { error: 'Enter a valid Instagram username and Reel URL, plus a post of up to 800 characters.' });
      const item = { id: crypto.randomUUID(), ...clean, createdAt: new Date().toISOString() };
      await saveEntry(POSTS_FILE, item);
      const notificationSent = await sendTelegramNotification(`New Post\nInstagram: @${item.username}\nReel: ${item.reelUrl}\n\nPost:\n${item.post}`);
      return sendJson(res, 201, { ok: true, notificationSent });
    } catch (error) {
      if (!res.destroyed && !res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : 'Could not save your post. Please try again.' });
      return;
    }
  }

  if (pathname === '/head' || pathname === '/head/') {
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Go Bot Free Admin", charset="UTF-8"', 'Cache-Control': 'no-store' });
      return res.end('Admin access required.');
    }
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
    return serveStatic(res, path.join(PUBLIC, 'head.html'), true);
  }

  if (pathname === '/api/submissions') {
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Go Bot Free Admin", charset="UTF-8"', 'Cache-Control': 'no-store' });
      return res.end('Admin access required.');
    }
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
    try {
      const entries = JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8'));
      return sendJson(res, 200, entries);
    } catch {
      return sendJson(res, 500, { error: 'Could not load submissions.' });
    }
  }

  if (pathname === '/api/posts') {
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Go Bot Free Admin", charset="UTF-8"', 'Cache-Control': 'no-store' });
      return res.end('Admin access required.');
    }
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
    try {
      const entries = JSON.parse(await fs.promises.readFile(POSTS_FILE, 'utf8'));
      return sendJson(res, 200, entries);
    } catch {
      return sendJson(res, 500, { error: 'Could not load posts.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method not allowed');
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filename = path.resolve(PUBLIC, relative);
  if (!filename.startsWith(`${PUBLIC}${path.sep}`)) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  return serveStatic(res, filename);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Go Bot Free is running at http://localhost:${PORT}`);
  console.log('Admin panel: /head (use the ADMIN_USER and ADMIN_PASSWORD you configured)');
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) console.warn('Telegram notifications are off until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are configured.');
});
