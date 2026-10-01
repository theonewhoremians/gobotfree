import { cleanSubmission, failure, insertEntry, isAdmin, json, listEntries, readJson, sendTelegram, unauthorized } from '../lib/api.mjs';

export default {
  async fetch(request) {
    if (request.method === 'GET') {
      if (!isAdmin(request)) return unauthorized();
      try {
        const entries = await listEntries('submissions');
        return json(entries.map(({ id, username, reel_url, created_at }) => ({ id, username, reelUrl: reel_url, createdAt: created_at })));
      } catch (error) {
        return failure(error, 'Could not load requests.');
      }
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    try {
      const clean = cleanSubmission(await readJson(request));
      if (!clean) return json({ error: 'Enter a valid Instagram username and Reel URL.' }, 400);
      await insertEntry('submissions', clean);
      const notificationSent = await sendTelegram(`New Reel request\nInstagram: @${clean.username}\nReel: ${clean.reel_url}`);
      return json({ ok: true, notificationSent }, 201);
    } catch (error) {
      return failure(error, 'Could not save your request. Please try again.');
    }
  },
};
