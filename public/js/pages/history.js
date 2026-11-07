import { api } from '../api.js';
import { store } from '../store.js';
import { esc, inr, num, signedInr, tone, dateTime } from '../utils.js';

export function mount(root) {
  let alive = true, type = '', symbol = '', page = 1;

  root.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">History</h1>
      <p class="page-sub">Every buy and sell on your account, newest first.</p>
    </div></div>
    <div class="board-tools">
      <div class="chips" role="group" aria-label="Filter by type">
        <button class="chip" data-t="" aria-pressed="true">All</button>
        <button class="chip" data-t="BUY" aria-pressed="false">Buys</button>
        <button class="chip" data-t="SELL" aria-pressed="false">Sells</button>
      </div>
      <div><label class="sr-only" for="sym">Filter by stock</label>
        <select class="input" id="sym" style="width:200px"><option value="">All stocks</option>
          ${store.stocks.map((s) => `<option value="${esc(s.symbol)}">${esc(s.symbol)} - ${esc(s.name)}</option>`).join('')}
        </select></div>
    </div>
    <section class="panel" id="box"><div class="loading">Loading…</div></section>`;

  root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    type = b.dataset.t; page = 1;
    root.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load();
  }));
  root.querySelector('#sym').addEventListener('change', (e) => { symbol = e.target.value; page = 1; load(); });

  async function load() {
    const box = root.querySelector('#box');
    try {
      const q = new URLSearchParams({ page, limit: 12 });
      if (type) q.set('type', type);
      if (symbol) q.set('symbol', symbol);
      const d = await api('/transactions?' + q);
      if (!alive) return;
      if (!d.items.length) {
        box.innerHTML = `<div class="empty"><strong>No transactions found</strong><span>${type || symbol ? 'Try clearing the filters.' : 'Your first trade will appear here.'}</span>
          ${type || symbol ? '' : '<a class="btn" href="#/market">Open the market</a>'}</div>`;
        return;
      }
      box.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>
        <th>When</th><th>Type</th><th>Stock</th><th class="num">Qty</th><th class="num xs-hide">Price</th><th class="num">Total</th><th class="num sm-hide">Realised P/L</th></tr></thead><tbody>
        ${d.items.map((r) => `<tr>
          <td class="muted">${dateTime(r.createdAt)}</td>
          <td><span class="pill ${r.type === 'BUY' ? 'buy' : 'sell'}">${r.type === 'BUY' ? 'Buy' : 'Sell'}</span></td>
          <td><a class="sym" href="#/stock/${esc(r.symbol)}">${esc(r.symbol)}</a><span class="sym-name sm-hide">${esc(r.name)}</span></td>
          <td class="num">${num(r.quantity)}</td>
          <td class="num xs-hide">${inr(r.price)}</td>
          <td class="num">${inr(r.total)}</td>
          <td class="num sm-hide ${r.realizedPl == null ? 'flat' : tone(r.realizedPl)}">${r.realizedPl == null ? '–' : signedInr(r.realizedPl)}</td>
        </tr>`).join('')}</tbody></table></div>
        <div class="pager"><span>${d.total} transaction${d.total === 1 ? '' : 's'} · page ${d.page} of ${d.pages}</span>
          <div><button class="btn ghost small" id="prev" ${d.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn ghost small" id="next" ${d.page >= d.pages ? 'disabled' : ''}>Next</button></div></div>`;
      const prev = box.querySelector('#prev'), next = box.querySelector('#next');
      if (prev) prev.addEventListener('click', () => { page--; load(); });
      if (next) next.addEventListener('click', () => { page++; load(); });
    } catch (e) { box.innerHTML = `<div class="loading">${esc(e.message)}</div>`; }
  }
  load();
  return () => { alive = false; };
}
