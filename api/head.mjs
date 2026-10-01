import { readFile } from 'node:fs/promises';
import { isAdmin, unauthorized } from '../lib/api.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET' } });
    if (!isAdmin(request)) return unauthorized();
    try {
      const html = await readFile(new URL('../public/head.html', import.meta.url), 'utf8');
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        },
      });
    } catch {
      return new Response('Admin page unavailable.', { status: 500 });
    }
  },
};
