const rows = document.querySelector('#request-rows');
const count = document.querySelector('#request-count');
const checked = document.querySelector('#last-checked');
const refresh = document.querySelector('#refresh-button');
const postRows = document.querySelector('#post-list');
const postCount = document.querySelector('#post-count');

function cell(text, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

async function loadRequests() {
  refresh.disabled = true;
  try {
    const response = await fetch('/api/submissions', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load requests. Refresh the page and try again.');
    const entries = await response.json();
    count.textContent = entries.length.toLocaleString();
    checked.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
    rows.replaceChildren();
    if (!entries.length) {
      const tr = document.createElement('tr');
      const td = cell('Nothing here yet. New requests will show up here.', 'empty-state');
      td.colSpan = 3;
      tr.append(td);
      rows.append(tr);
      return;
    }
    for (const entry of entries) {
      const tr = document.createElement('tr');
      const username = cell(`@${entry.username}`, 'username-cell');
      const reelCell = document.createElement('td');
      const reel = document.createElement('a');
      reel.className = 'reel-link';
      reel.href = entry.reelUrl;
      reel.target = '_blank';
      reel.rel = 'noopener noreferrer';
      reel.textContent = 'Open Reel ↗';
      reelCell.append(reel);
      const received = cell(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt)), 'date-cell');
      tr.append(username, reelCell, received);
      rows.append(tr);
    }
  } catch (error) {
    rows.replaceChildren();
    const tr = document.createElement('tr');
    const td = cell(error.message, 'empty-state error');
    td.colSpan = 3;
    tr.append(td);
    rows.append(tr);
  } finally {
    refresh.disabled = false;
  }
}

async function loadPosts() {
  try {
    const response = await fetch('/api/posts', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load posts. Refresh the page and try again.');
    const entries = await response.json();
    postCount.textContent = entries.length.toLocaleString();
    postRows.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No posts yet. New posts will appear here.';
      postRows.append(empty);
      return;
    }
    for (const entry of entries) {
      const article = document.createElement('article');
      const copy = document.createElement('p');
      copy.className = 'post-entry-copy';
      copy.textContent = entry.post;
      const date = document.createElement('time');
      date.className = 'post-entry-date';
      date.dateTime = entry.createdAt;
      date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt));
      article.className = 'post-entry';
      article.append(copy, date);
      postRows.append(article);
    }
  } catch (error) {
    postRows.replaceChildren();
    const message = document.createElement('p');
    message.className = 'empty-state error';
    message.textContent = error.message;
    postRows.append(message);
  }
}

refresh.addEventListener('click', () => {
  loadRequests();
  loadPosts();
});
loadRequests();
loadPosts();
