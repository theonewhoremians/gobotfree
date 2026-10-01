import { cleanPost, failure, insertEntry, isAdmin, json, listEntries, readJson, sendTelegram, unauthorized } from '../lib/api.mjs';

export default {
  async fetch(request) {
    if (request.method === 'GET') {
      if (!isAdmin(request)) return unauthorized();
      try {
        const entries = await listEntries('posts');
        return json(entries.map(({ id, username, reel_url, post, created_at }) => ({ id, username, reelUrl: reel_url, post, createdAt: created_at })));
      } catch (error) {
        return failure(error, 'Could not load posts.');
      }
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    try {
      const clean = cleanPost(await readJson(request, 12000));
      if (!clean) return json({ error: 'Enter a valid Instagram username and Reel URL, plus a post of up to 800 characters.' }, 400);
      await insertEntry('posts', clean);
      const notificationSent = await sendTelegram(`New Post\nInstagram: @${clean.username}\nReel: ${clean.reel_url}\n\nPost:\n${clean.post}`);
      return json({ ok: true, notificationSent }, 201);
    } catch (error) {
      return failure(error, 'Could not save your post. Please try again.');
    }
  },
};
