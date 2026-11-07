import { api } from '../api.js';
import { store, on, setBalance, refreshStocks } from '../store.js';
import { esc, inr, num, pct, signedInr, tone, arrow, timeOnly } from '../utils.js';
import { icons, toast } from '../components.js';

export function mount(root, { symbol, query }) {
  symbol = symbol.toUpperCase();
  let alive = true, chart = null, detail = null;
  let side = new URLSearchParams(query || '').get('side') === 'sell' ? 'sell' : 'buy';
  let busy = false;

  root.innerHTML = `<div class="loading">Loading ${esc(symbol)}…</div>`;

  api('/stocks/' + encodeURIComponent(symbol)).then((d) => {
    if (!alive) return;
    detail = d;
    setBalance(d.balance);
    build();
  }).catch((e) => {
    root.innerHTML = `<a class="back" href="#/market">${icons.back} Back to market</a>
      <div class="panel"><div class="empty"><strong>${esc(e.message)}</strong><a class="btn" href="#/market">Open the market</a></div></div>`;
  });

  const stock = () => store.bySymbol[symbol] || detail.stock;
  const qty = () => { const v = Number(root.querySelector('#qty').value); return Number.isInteger(v) ? v : NaN; };

  function build() {
    const s = stock();
    root.innerHTML = `
      <a class="back" href="#/market">${icons.back} Market</a>
      <div class="stock-head">
        <div>
          <h1>${esc(s.symbol)} <span class="pill sector">${esc(s.sector)}</span></h1>
          <p class="muted">${esc(s.name)}</p>
        </div>
        <div class="stock-price"><div class="big" id="price"></div><div class="delta" id="delta"></div></div>
      </div>
      <div class="stock-grid">
        <section class="panel" aria-label="Price chart">
          <div class="chart-box"><canvas id="chart"></canvas></div>
          <p class="chart-note">Simulated price, updated every few seconds. Hover the line for exact values.</p>
        </section>
        <aside class="panel trade" aria-label="Place an order">
          <div class="side-tabs" role="tablist">
            <button type="button" role="tab" data-side="buy">Buy</button>
            <button type="button" role="tab" data-side="sell">Sell</button>
          </div>
          <div class="field">
            <label for="qty">Quantity</label>
            <input class="input" id="qty" type="number" min="1" step="1" inputmode="numeric" value="1">
          </div>
          <div class="qty-row" id="quick"></div>
          <dl class="sum">
            <div><dt>Price per share</dt><dd id="s-price"></dd></div>
            <div><dt>Quantity</dt><dd id="s-qty"></dd></div>
            <div class="total"><dt id="s-total-label">Total cost</dt><dd id="s-total"></dd></div>
            <div><dt id="s-avail-label">Cash available</dt><dd id="s-avail"></dd></div>
          </dl>
          <p class="form-error" id="trade-error" role="alert"></p>
          <button class="btn block" id="go" type="button"></button>
          <div class="owned" id="owned"></div>
        </aside>
      </div>`;

    root.querySelectorAll('.side-tabs button').forEach((b) => b.addEventListener('click', () => { side = b.dataset.side; refreshTrade(); }));
    root.querySelector('#qty').addEventListener('input', refreshTrade);
    root.querySelector('#qty').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    root.querySelector('#go').addEventListener('click', submit);
    root.querySelector('#quick').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const price = stock().price;
      const max = side === 'buy' ? Math.floor(store.user.balance / price) : detail.owned.quantity;
      root.querySelector('#qty').value = b.dataset.q === 'max' ? Math.max(max, 1) : b.dataset.q;
      refreshTrade();
    });

    drawChart();
    refreshPrice();
    refreshTrade();
  }

  function refreshPrice() {
    const s = stock();
    root.querySelector('#price').textContent = inr(s.price);
    const d = root.querySelector('#delta');
    d.className = 'delta ' + tone(s.change);
    d.textContent = `${arrow(s.change)} ${signedInr(s.change)} (${pct(s.changePct)}) today`;
  }

  function refreshTrade() {
    const s = stock(), q = qty(), valid = Number.isInteger(q) && q >= 1;
    const total = valid ? s.price * q : 0;
    const owned = detail.owned;
    const $ = (id) => root.querySelector(id);

    root.querySelectorAll('.side-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === side)));
    $('#s-price').textContent = inr(s.price);
    $('#s-qty').textContent = valid ? num(q) : '–';
    $('#s-total').textContent = valid ? inr(total) : '–';
    $('#s-total-label').textContent = side === 'buy' ? 'Total cost' : 'You will receive';
    $('#s-avail-label').textContent = side === 'buy' ? 'Cash available' : 'Shares you own';
    $('#s-avail').textContent = side === 'buy' ? inr(store.user.balance) : num(owned.quantity);
    $('#quick').innerHTML = ['1', '5', '10', 'max'].map((q2) => `<button type="button" class="chip" data-q="${q2}">${q2 === 'max' ? 'Max' : q2}</button>`).join('');

    const go = $('#go');
    go.className = 'btn block ' + side;
    go.textContent = valid ? `${side === 'buy' ? 'Buy' : 'Sell'} ${num(q)} share${q === 1 ? '' : 's'}` : (side === 'buy' ? 'Buy shares' : 'Sell shares');
    go.disabled = busy;

    const ow = $('#owned');
    if (owned.quantity > 0) {
      const value = owned.quantity * s.price, cost = owned.quantity * owned.avgCost, pl = value - cost;
      ow.innerHTML = `<strong>You own ${num(owned.quantity)} share${owned.quantity === 1 ? '' : 's'}</strong>
        <span class="muted">Average cost ${inr(owned.avgCost)}</span>
        <span class="${tone(pl)}">${signedInr(pl)} (${pct(cost ? (pl / cost) * 100 : 0)}) right now</span>`;
    } else {
      ow.innerHTML = `<strong>You do not own this stock</strong><span class="muted">Buy some to see your profit and loss here.</span>`;
    }
  }

  async function submit() {
    if (busy) return;
    const q = qty(), err = root.querySelector('#trade-error');
    err.textContent = '';
    if (!Number.isInteger(q) || q < 1) { err.textContent = 'Enter a whole number of shares, 1 or more.'; return; }
    const s = stock();
    if (side === 'buy' && s.price * q > store.user.balance) {
      err.textContent = `Insufficient balance. This order costs ${inr(s.price * q)} but you have ${inr(store.user.balance)}.`; return;
    }
    if (side === 'sell' && q > detail.owned.quantity) {
      err.textContent = detail.owned.quantity
        ? `You only own ${detail.owned.quantity} share${detail.owned.quantity === 1 ? '' : 's'} of ${s.name}.`
        : `You do not own any shares of ${s.name}.`;
      return;
    }
    busy = true; refreshTrade();
    try {
      const d = await api('/trade/' + side, { method: 'POST', body: { symbol, quantity: q } });
      setBalance(d.balance);
      toast(d.message);
      const fresh = await api('/stocks/' + symbol);
      detail.owned = fresh.owned;
      root.querySelector('#qty').value = 1;
    } catch (e) {
      err.textContent = e.message;
      toast(e.message, 'error');
    } finally {
      busy = false;
      if (alive) refreshTrade();
    }
  }

  function drawChart() {
    if (!window.Chart) return;
    const s = stock();
    const color = s.change >= 0 ? '#25c98a' : '#f4636f';
    chart = new window.Chart(root.querySelector('#chart'), {
      type: 'line',
      data: {
        labels: detail.history.map((h) => timeOnly(h.t)),
        datasets: [{ data: detail.history.map((h) => h.price), borderColor: color, backgroundColor: color + '22', fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => inr(c.parsed.y) } } },
        scales: {
          x: { ticks: { color: '#6d76b0', maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false }, border: { color: '#2a3270' } },
          y: { position: 'right', ticks: { color: '#9aa3d6', callback: (v) => '₹' + Number(v).toLocaleString('en-IN') }, grid: { color: 'rgba(42,50,112,.5)' }, border: { display: false } },
        },
      },
    });
  }

  // New prices arrived from the server.
  const off = on(() => {
    if (!detail || !alive || !root.querySelector('#price')) return;
    const s = stock();
    refreshPrice();
    refreshTrade();
    if (chart) {
      const ds = chart.data.datasets[0];
      ds.data.push(s.price); chart.data.labels.push(timeOnly(new Date()));
      if (ds.data.length > 150) { ds.data.shift(); chart.data.labels.shift(); }
      const color = s.change >= 0 ? '#25c98a' : '#f4636f';
      ds.borderColor = color; ds.backgroundColor = color + '22';
      chart.update('none');
    }
  });

  return () => { alive = false; off(); if (chart) chart.destroy(); };
}
