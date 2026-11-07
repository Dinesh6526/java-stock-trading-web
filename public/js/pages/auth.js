import { api, session } from '../api.js';
import { icons } from '../components.js';
import { esc } from '../utils.js';

export function renderAuth(root, { notice = '', onDone }) {
  let mode = 'login';

  root.innerHTML = `
  <div class="auth">
    <section class="auth-art" aria-hidden="false">
      <div class="brand">${icons.logo}<span>TradeSim</span></div>
      <svg class="draw" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
        <path class="b" d="M0 250 C80 235 120 180 190 195 S320 255 390 210 S500 125 580 150 S700 80 800 50"/>
        <path class="a" d="M0 270 C70 250 130 230 200 215 S300 190 360 200 S470 240 540 180 S650 120 730 100 L800 78"/>
      </svg>
      <div>
        <h1>Learn to trade without risking a rupee.</h1>
        <p class="lead">Buy and sell 15 Indian stocks at live simulated prices, and see exactly how your portfolio would have done.</p>
      </div>
      <ul class="facts">
        <li>Every new account starts with ₹1,00,000 of virtual cash</li>
        <li>Prices are made up and move every few seconds</li>
        <li>No real money, no real orders</li>
      </ul>
    </section>

    <section class="auth-form-wrap">
      <div class="auth-card">
        <div class="m-art">${icons.logo}<span>TradeSim</span></div>
        <h2 id="auth-title">Welcome back</h2>
        <div class="seg" role="tablist" aria-label="Log in or create an account">
          <button type="button" role="tab" data-mode="login" aria-selected="true">Log in</button>
          <button type="button" role="tab" data-mode="register" aria-selected="false">Create account</button>
        </div>
        ${notice ? `<p class="form-error" role="alert">${esc(notice)}</p>` : ''}
        <form id="auth-form" novalidate>
          <div class="field">
            <label for="username">Username</label>
            <input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
            <span class="muted small" id="pw-help" hidden>Use at least 6 characters.</span>
          </div>
          <p class="form-error" id="auth-error" role="alert"></p>
          <button class="btn block" type="submit" id="auth-submit">Log in</button>
        </form>
        <div class="demo-hint" id="demo-hint">
          <span>Just looking? Try <code>demo</code> / <code>demo123</code></span>
          <button type="button" class="btn ghost small" id="demo-btn">Use demo</button>
        </div>
      </div>
    </section>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const form = $('#auth-form'), err = $('#auth-error'), submit = $('#auth-submit');

  function setMode(m) {
    mode = m;
    root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $('#auth-title').textContent = m === 'login' ? 'Welcome back' : 'Create your account';
    submit.textContent = m === 'login' ? 'Log in' : 'Create account';
    $('#password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('#pw-help').hidden = m === 'login';
    $('#demo-hint').hidden = m !== 'login';
    err.textContent = '';
  }
  root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  async function go(username, password) {
    err.textContent = '';
    if (!username || !password) { err.textContent = 'Enter your username and password.'; return; }
    submit.disabled = true;
    try {
      const d = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: { username, password } });
      session.set(d.token);
      onDone();
    } catch (e) {
      err.textContent = e.message;
      submit.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); go($('#username').value.trim(), $('#password').value); });
  $('#demo-btn').addEventListener('click', () => { setMode('login'); go('demo', 'demo123'); });
  $('#username').focus();
}
