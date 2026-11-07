// App shell + router. Hash routes: #/ #/market #/stock/TCS #/portfolio #/history
import { api, session } from './api.js';
import { store, on, refreshStocks, refreshUser, startPolling, stopPolling } from './store.js';
import { icons, openFundsDialog } from './components.js';
import { esc, inr, pct, tone, arrow } from './utils.js';
import { renderAuth } from './pages/auth.js';
import * as dashboard from './pages/dashboard.js';
import * as market from './pages/market.js';
import * as stockPage from './pages/stock.js';
import * as portfolio from './pages/portfolio.js';
import * as history from './pages/history.js';

const root = document.getElementById('root');
let cleanup = null;      // function that tears down the current page
let shellReady = false;
let offShell = null;

const NAV = [
  { href: '#/', key: 'home', label: 'Dashboard', icon: icons.home },
  { href: '#/market', key: 'market', label: 'Market', icon: icons.market },
  { href: '#/portfolio', key: 'portfolio', label: 'Portfolio', icon: icons.briefcase },
  { href: '#/history', key: 'history', label: 'History', icon: icons.history },
];

const ROUTES = [
  { re: /^#\/?$/, key: 'home', page: dashboard },
  { re: /^#\/market$/, key: 'market', page: market },
  { re: /^#\/stock\/([A-Za-z0-9]+)(?:\?(.*))?$/, key: 'market', page: stockPage },
  { re: /^#\/portfolio$/, key: 'portfolio', page: portfolio },
  { re: /^#\/history$/, key: 'history', page: history },
];

// ---------- shell ----------
function buildShell() {
  const link = (n) => `<a href="${n.href}" data-nav="${n.key}">${n.icon}<span>${n.label}</span></a>`;
  root.innerHTML = `
    <div class="shell">
      <aside class="rail">
        <a class="brand" href="#/">${icons.logo}<span>TradeSim</span></a>
        <nav class="nav" aria-label="Main">${NAV.map(link).join('')}</nav>
        <div class="rail-foot">
          <div class="who"><span class="avatar" id="avatar"></span><span id="uname"></span></div>
          <button class="btn ghost small" id="logout" type="button">Log out</button>
          <p class="sim-note">Simulation only. Prices are invented and no real money is used.</p>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <a class="m-brand" href="#/">${icons.logo}<span>TradeSim</span></a>
          <div class="live" id="live"><i></i><span>Live</span></div>
          <div class="tape" aria-label="Stock prices"><div class="tape-track" id="tape"></div></div>
          <div class="cashbar">
            <div class="cash"><small>Cash</small><strong id="cash"></strong></div>
            <button class="btn small" id="add-funds" type="button">Add cash</button>
            <button class="btn ghost small m-logout" id="logout2" type="button" style="display:none">Log out</button>
          </div>
        </header>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="Main">${NAV.map(link).join('')}</nav>
    </div>`;

  root.querySelector('#logout').addEventListener('click', logout);
  root.querySelector('#logout2').addEventListener('click', logout);
  root.querySelector('#add-funds').addEventListener('click', openFundsDialog);
  if (window.matchMedia('(max-width: 900px)').matches) root.querySelector('#logout2').style.display = '';

  buildTape();
  offShell = on(updateShell);
  updateShell();
  shellReady = true;
}

// The ticker tape is built once; later updates only change text, so the scroll never jumps.
function buildTape() {
  const items = store.stocks.map((s) =>
    `<span class="tape-item" data-sym="${esc(s.symbol)}"><b>${esc(s.symbol)}</b><span class="t-px"></span><span class="t-ch"></span></span>`).join('');
  root.querySelector('#tape').innerHTML = items + items;   // twice, for a seamless loop
}

function updateShell() {
  if (!shellReady && !root.querySelector('#cash')) return;
  const u = store.user;
  if (u) {
    root.querySelector('#cash').textContent = inr(u.balance);
    root.querySelector('#uname').textContent = u.username;
    root.querySelector('#avatar').textContent = u.username.charAt(0).toUpperCase();
  }
  const live = root.querySelector('#live');
  live.classList.toggle('off', !store.online);
  live.lastElementChild.textContent = store.online ? 'Live' : 'Reconnecting';
  root.querySelectorAll('.tape-item').forEach((el) => {
    const s = store.bySymbol[el.dataset.sym]; if (!s) return;
    el.querySelector('.t-px').textContent = inr(s.price);
    const ch = el.querySelector('.t-ch');
    ch.className = 't-ch ' + tone(s.change);
    ch.textContent = `${arrow(s.change)} ${pct(s.changePct)}`;
  });
}

function setActiveNav(key) {
  root.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

// ---------- auth / logout ----------
function showAuth(notice = '') {
  teardown();
  stopPolling();
  if (offShell) { offShell(); offShell = null; }
  shellReady = false;
  store.user = null;
  renderAuth(root, { notice, onDone: () => { location.hash = '#/'; start(); } });
}

function logout() {
  session.clear();
  location.hash = '#/';
  showAuth();
}

window.addEventListener('tradesim:expired', (e) => { session.clear(); showAuth(e.detail || 'Please log in again.'); });

function teardown() {
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
}

// ---------- router ----------
function route() {
  if (!session.token || !shellReady) return;
  teardown();
  const hash = location.hash || '#/';
  let match = null, params = {};
  for (const r of ROUTES) {
    const m = hash.match(r.re);
    if (m) { match = r; params = { symbol: m[1], query: m[2] }; break; }
  }
  const view = root.querySelector('#view');
  if (!match) {
    view.innerHTML = `<div class="panel"><div class="empty"><strong>Page not found</strong><a class="btn" href="#/">Go to dashboard</a></div></div>`;
    setActiveNav('');
    return;
  }
  setActiveNav(match.key);
  view.innerHTML = '';
  cleanup = match.page.mount(view, params);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// ---------- start ----------
async function start() {
  if (!session.token) return showAuth();
  try {
    await Promise.all([refreshUser(), refreshStocks()]);
  } catch (e) {
    if (e.status === 401) return;     // 'expired' handler already showed the login screen
    root.innerHTML = `<div style="padding:40px;text-align:center">${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  if (!session.token) return;
  buildShell();
  startPolling(5000);
  route();
}

start();
