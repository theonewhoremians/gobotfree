const form = document.querySelector('#request-form');
const statusLine = document.querySelector('#form-status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusLine.textContent = '';
  statusLine.className = 'form-status';
  const button = form.querySelector('button');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Sending…';

  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.elements.username.value,
        reelUrl: form.elements.reelUrl.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
    form.reset();
    statusLine.textContent = 'Request saved. Thanks for being an early one.';
    statusLine.classList.add('success');
  } catch (error) {
    statusLine.textContent = error.message;
    statusLine.classList.add('error');
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Send my Reel';
  }
});

const postForm = document.querySelector('#post-form');
const postStatus = document.querySelector('#post-status');

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  postStatus.textContent = '';
  postStatus.className = 'form-status';
  const button = postForm.querySelector('button');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Sending…';

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: postForm.elements.username.value,
        reelUrl: postForm.elements.reelUrl.value,
        post: postForm.elements.post.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
    postForm.reset();
    postStatus.textContent = 'Post received. Thanks for posting up.';
    postStatus.classList.add('success');
  } catch (error) {
    postStatus.textContent = error.message;
    postStatus.classList.add('error');
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Send post';
  }
});
