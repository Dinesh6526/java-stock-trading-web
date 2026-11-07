import { api } from '../api.js';
import { store, on } from '../store.js';
import { esc, inr, signedInr, pct, tone, livePortfolio } from '../utils.js';
import { holdingsTable, wireRowLinks } from '../components.js';

export function mount(root) {
  let alive = true, portfolio = null;
  root.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">Portfolio</h1>
      <p class="page-sub">What you own, what you paid, and what it is worth at today's simulated prices.</p>
    </div></div><div id="pf"><div class="loading">Loading your portfolio…</div></div>`;
  wireRowLinks(root);

  api('/portfolio').then((p) => { if (alive) { portfolio = p; draw(); } })
    .catch((e) => { root.querySelector('#pf').innerHTML = `<div class="loading">${esc(e.message)}</div>`; });

  function draw() {
    const { holdings, totals: t } = livePortfolio(portfolio, store.bySymbol);
    root.querySelector('#pf').innerHTML = `
      <section class="panel worth" style="grid-template-columns:1fr 1.4fr" aria-label="Totals">
        <div class="worth-main">
          <span class="label">Current value</span>
          <span class="big">${inr(t.value)}</span>
          <span class="delta ${tone(t.pl)}">${signedInr(t.pl)} (${pct(t.plPct)}) since you bought</span>
        </div>
        <dl class="worth-stats" style="grid-template-columns:1fr 1fr">
          <div><dt>Total investment</dt><dd>${inr(t.invested)}</dd></div>
          <div><dt>Profit / loss now</dt><dd class="${tone(t.pl)}">${signedInr(t.pl)}</dd></div>
          <div><dt>Realised profit / loss</dt><dd class="${tone(t.realized)}">${signedInr(t.realized)}</dd></div>
          <div><dt>Cash</dt><dd>${inr(store.user ? store.user.balance : portfolio.cash)}</dd></div>
        </dl>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Holdings</h2></div>
        ${holdings.length ? holdingsTable(holdings, { full: true })
          : `<div class="empty"><strong>Nothing here yet</strong><span>Stocks you buy will appear here with their profit and loss.</span><a class="btn" href="#/market">Open the market</a></div>`}
      </section>`;
  }

  const off = on(() => { if (portfolio && alive) draw(); });
  return () => { alive = false; off(); };
}
