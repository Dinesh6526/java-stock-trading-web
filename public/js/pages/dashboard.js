import { api } from '../api.js';
import { store, on } from '../store.js';
import { esc, inr, signedInr, pct, tone, arrow, greeting, livePortfolio, dateTime } from '../utils.js';
import { holdingsTable, wireRowLinks } from '../components.js';

const COLORS = ['#6b6cf5', '#ffb547', '#25c98a', '#f4636f', '#4cc9f0', '#c084fc', '#f97316', '#94a3b8'];

export function mount(root) {
  let alive = true, portfolio = null, recent = [], chart = null, chartKey = '';

  root.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">${greeting()}, ${esc(store.user ? store.user.username : '')}</h1>
      <p class="page-sub">Prices are simulated and move every few seconds. Nothing here is real money.</p>
    </div></div>
    <div id="dash"><div class="loading">Loading your portfolio…</div></div>`;
  wireRowLinks(root);

  Promise.all([api('/portfolio'), api('/transactions?limit=5')]).then(([p, t]) => {
    if (!alive) return;
    portfolio = p; recent = t.items;
    draw();
  }).catch((e) => { root.querySelector('#dash').innerHTML = `<div class="loading">${esc(e.message)}</div>`; });

  function draw() {
    const live = livePortfolio(portfolio, store.bySymbol);
    const t = live.totals;
    const cash = store.user ? store.user.balance : portfolio.cash;
    const netWorth = cash + t.value;
    const prevNet = netWorth - t.dayChange;
    const dayPct = prevNet ? (t.dayChange / prevNet) * 100 : 0;

    const movers = [...store.stocks].sort((a, b) => b.changePct - a.changePct);
    const gainers = movers.slice(0, 3), losers = movers.slice(-3).reverse();
    const moverRow = (s) => `
      <a class="mover" href="#/stock/${esc(s.symbol)}">
        <span><span class="sym">${esc(s.symbol)}</span><span class="sym-name">${esc(s.name)}</span></span>
        <span class="num"><strong>${inr(s.price)}</strong><br><small class="${tone(s.changePct)}">${arrow(s.changePct)} ${pct(s.changePct)}</small></span>
      </a>`;

    root.querySelector('#dash').innerHTML = `
      <section class="panel worth" aria-label="Portfolio summary">
        <div class="worth-main">
          <span class="label">Net worth</span>
          <span class="big">${inr(netWorth)}</span>
          <span class="delta ${tone(t.dayChange)}">${arrow(t.dayChange)} ${signedInr(t.dayChange)} (${pct(dayPct)}) today</span>
        </div>
        <dl class="worth-stats">
          <div><dt>Cash</dt><dd>${inr(cash)}</dd></div>
          <div><dt>Invested</dt><dd>${inr(t.invested)}</dd></div>
          <div><dt>Holdings value</dt><dd>${inr(t.value)}</dd></div>
          <div><dt>Unrealised profit / loss</dt><dd class="${tone(t.pl)}">${signedInr(t.pl)}<small>${pct(t.plPct)}</small></dd></div>
          <div><dt>Realised profit / loss</dt><dd class="${tone(t.realized)}">${signedInr(t.realized)}</dd></div>
          <div><dt>Stocks owned</dt><dd>${live.holdings.length}</dd></div>
        </dl>
      </section>

      <div class="dash-grid">
        <div class="stack">
          <section class="panel">
            <div class="panel-head"><h2>Your holdings</h2><a class="btn ghost small" href="#/portfolio">See all</a></div>
            ${live.holdings.length
              ? holdingsTable(live.holdings)
              : `<div class="empty"><strong>You do not own any stocks yet</strong><span>Pick a stock from the market and place your first buy.</span><a class="btn" href="#/market">Open the market</a></div>`}
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Recent activity</h2><a class="btn ghost small" href="#/history">Full history</a></div>
            ${recent.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Type</th><th>Stock</th><th class="num">Qty</th><th class="num">Total</th></tr></thead><tbody>
              ${recent.map((r) => `<tr><td class="muted">${dateTime(r.createdAt)}</td><td><span class="pill ${r.type === 'BUY' ? 'buy' : 'sell'}">${r.type === 'BUY' ? 'Buy' : 'Sell'}</span></td><td class="sym">${esc(r.symbol)}</td><td class="num">${r.quantity}</td><td class="num">${inr(r.total)}</td></tr>`).join('')}
            </tbody></table></div>` : `<div class="empty">Your trades will show up here.</div>`}
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <div class="panel-head"><h2>Where your money is</h2></div>
            <div class="alloc"><canvas id="alloc" width="150" height="150" aria-label="Allocation chart"></canvas><ul class="legend" id="legend"></ul></div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Market movers</h2></div>
            <p class="group-label">Rising</p>${gainers.map(moverRow).join('')}
            <p class="group-label">Falling</p>${losers.map(moverRow).join('')}
            <div style="height:10px"></div>
          </section>
        </div>
      </div>`;

    drawAllocation(live.holdings, cash);
  }

  function drawAllocation(holdings, cash) {
    const slices = [...holdings.map((h) => ({ label: h.symbol, value: h.value })), { label: 'Cash', value: cash }]
      .filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    const top = slices.slice(0, 7);
    const rest = slices.slice(7).reduce((a, s) => a + s.value, 0);
    if (rest > 0) top.push({ label: 'Other', value: rest });

    root.querySelector('#legend').innerHTML = top.map((s, i) =>
      `<li><i style="background:${COLORS[i % COLORS.length]}"></i><span>${esc(s.label)}</span><span>${((s.value / total) * 100).toFixed(1)}%</span></li>`).join('');

    const canvas = root.querySelector('#alloc');
    if (chart) { chart.destroy(); chart = null; }
    if (!window.Chart) return;
    chart = new window.Chart(canvas, {
      type: 'doughnut',
      data: { labels: top.map((s) => s.label), datasets: [{ data: top.map((s) => s.value), backgroundColor: top.map((_, i) => COLORS[i % COLORS.length]), borderColor: '#141a47', borderWidth: 3 }] },
      options: { responsive: false, cutout: '66%', animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${inr(c.parsed)}` } } } },
    });
  }

  // Prices changed -> redraw with live numbers (no network call needed).
  const off = on(() => { if (portfolio && alive) draw(); });
  return () => { alive = false; off(); if (chart) chart.destroy(); };
}
