const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

// Only these page names are servable — prevents path traversal
const ALLOWED_PAGES = ['case-study-1', 'case-study-2', 'case-study-3'];
const COOKIE_NAME = 'cs_auth';

function computeToken(password) {
  return crypto.createHmac('sha256', password).update('case-study-session').digest('hex');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
  });
  return out;
}

// Manually read and parse the raw POST body — don't rely on automatic
// req.body parsing, which can be inconsistent across Vercel runtimes.
function getFormField(req, field) {
  return new Promise((resolve, reject) => {
    // If Vercel already parsed it for us, use that.
    if (req.body && typeof req.body === 'object' && field in req.body) {
      resolve(req.body[field] || '');
      return;
    }
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        const params = new URLSearchParams(data);
        resolve(params.get(field) || '');
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function servePage(res, page, trackUnlock) {
  const filePath = path.join(process.cwd(), 'protected', `${page}.html`);
  let html = fs.readFileSync(filePath, 'utf8');

  if (trackUnlock) {
    // Fires a GA4 custom event the moment someone successfully enters the
    // password — distinct from a normal pageview, so it's countable as a
    // "conversion" in GA (Events report → case_study_unlocked).
    const eventScript = `<script>
  (function(){
    function fire(){ if (window.gtag) { gtag('event', 'case_study_unlocked', { 'case_study': '${page}' }); } }
    if (window.gtag) { fire(); } else { window.addEventListener('load', fire); }
  })();
</script>`;
    html = html.includes('</body>')
      ? html.replace('</body>', `${eventScript}\n</body>`)
      : html + eventScript;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

function sendForm(res, errorMsg, page, trackFailure) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const failureScript = trackFailure ? `<script>
  (function(){
    function fire(){ if (window.gtag) { gtag('event', 'case_study_password_failed', { 'case_study': '${page}' }); } }
    if (window.gtag) { fire(); } else { window.addEventListener('load', fire); }
  })();
</script>` : '';

  res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Required</title>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-595RLS0W2D"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-595RLS0W2D');
</script>
<style>
  body { font-family: 'Instrument Sans', -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F7F5F1; }
  .box { background: #fff; padding: 40px; border-radius: 14px; box-shadow: 0 4px 28px rgba(0,0,0,0.08); width: 320px; text-align: center; }
  h2 { margin: 0 0 6px; font-size: 20px; color: #1a1a1a; }
  p.sub { color: #777; font-size: 14px; margin: 0 0 20px; }
  input { width: 100%; padding: 11px 12px; margin-bottom: 14px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
  input:focus { outline: none; border-color: #111; }
  button { width: 100%; padding: 11px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 500; }
  button:hover { background: #333; }
  .error { color: #c0392b; font-size: 13px; margin: -8px 0 14px; }
  .request-access { margin-top: 18px; font-size: 13px; color: #999; }
  .request-access a { color: #111; font-weight: 600; text-decoration: none; }
  .request-access a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="box">
    <h2>Password required</h2>
    <p class="sub">This case study is private. Enter the password to view it.</p>
    ${errorMsg ? `<p class="error">${errorMsg}</p>` : ''}
    <form method="POST">
      <input type="password" name="password" placeholder="Password" autofocus required>
      <button type="submit">View case study</button>
    </form>
    <p class="request-access">
      Don't have a password?
      <a href="mailto:harshita.chauhan@gmail.com?subject=Password%20request%20-%20${page}">Request access</a>
    </p>
  </div>
  ${failureScript}
</body>
</html>`);
}

module.exports = async (req, res) => {
  const correctPassword = process.env.CASE_STUDY_PASSWORD;
  if (!correctPassword) {
    res.status(500).send('Server misconfigured: CASE_STUDY_PASSWORD is not set.');
    return;
  }

  const page = req.query.page;
  if (!ALLOWED_PAGES.includes(page)) {
    res.status(404).send('Not found');
    return;
  }

  const expectedToken = computeToken(correctPassword);
  const cookies = parseCookies(req.headers.cookie);
  const hasValidCookie = cookies[COOKIE_NAME] === expectedToken;

  if (req.method === 'POST') {
    let submitted = '';
    try {
      submitted = await getFormField(req, 'password');
    } catch (err) {
      res.status(400).send('Bad request');
      return;
    }

    if (submitted && submitted === correctPassword) {
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${expectedToken}; Path=/; HttpOnly; Secure; Max-Age=604800; SameSite=Lax`
      );
      return servePage(res, page, true); // trackUnlock = true: just entered password
    }
    return sendForm(res, 'Incorrect password. Try again.', page, true);
  }

  if (hasValidCookie) {
    return servePage(res, page); // trackUnlock = false: returning visit via cookie
  }

  return sendForm(res, null, page, false);
};
