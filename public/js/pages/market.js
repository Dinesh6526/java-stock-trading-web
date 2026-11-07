import { store, on } from '../store.js';
import { esc, inr, pct, signedInr, tone, arrow, sparkline } from '../utils.js';
import { icons, wireRowLinks } from '../components.js';

export function mount(root) {
  let query = '', sector = '';

  root.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">Market</h1>
      <p class="page-sub">15 simulated stocks. Select one to see its chart and place an order.</p>
    </div></div>
    <div class="board-tools">
      <div class="search">${icons.search}<label class="sr-only" for="q">Search stocks</label>
        <input class="input" id="q" type="search" placeholder="Search by name or symbol" autocomplete="off"></div>
      <div class="chips" id="sectors" role="group" aria-label="Filter by sector"></div>
    </div>
    <section class="panel board"><div class="table-wrap"><table class="data">
      <thead><tr>
        <th>Stock</th><th class="sm-hide">Sector</th><th class="num">Price</th>
        <th class="num">Change</th><th class="num xs-hide">Trend</th><th class="xs-hide"></th>
      </tr></thead><tbody id="rows"></tbody></table></div>
      <div class="empty" id="none" hidden><strong>No stocks match</strong><span>Try a different name or clear the sector filter.</span></div>
    </section>`;
  wireRowLinks(root);

  const rows = root.querySelector('#rows');
  const built = new Set();

  function drawSectors() {
    const box = root.querySelector('#sectors');
    const all = ['', ...store.sectors];
    box.innerHTML = all.map((s) => `<button type="button" class="chip" data-s="${esc(s)}" aria-pressed="${s === sector}">${s ? esc(s) : 'All'}</button>`).join('');
  }
  root.querySelector('#sectors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    sector = b.dataset.s; drawSectors(); render(true);
  });
  root.querySelector('#q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); render(true); });

  const rowHtml = (s) => `
    <tr class="link" data-sym="${esc(s.symbol)}" data-go="#/stock/${esc(s.symbol)}">
      <td><span class="sym">${esc(s.symbol)}</span><span class="sym-name">${esc(s.name)}</span></td>
      <td class="sm-hide"><span class="pill sector">${esc(s.sector)}</span></td>
      <td class="num"><span class="px">${inr(s.price)}</span></td>
      <td class="num chg"></td>
      <td class="num xs-hide spk"></td>
      <td class="num xs-hide"><a class="btn small" href="#/stock/${esc(s.symbol)}">Trade</a></td>
    </tr>`;

  function fill(tr, s) {
    const px = tr.querySelector('.px');
    const before = store.prevPrices[s.symbol];
    px.textContent = inr(s.price);
    px.classList.remove('up', 'down');
    if (before !== undefined && before !== s.price) {
      void px.offsetWidth;                       // restart the flash animation
      px.classList.add(s.price > before ? 'up' : 'down');
    }
    const chg = tr.querySelector('.chg');
    chg.className = 'num chg ' + tone(s.change);
    chg.innerHTML = `${arrow(s.change)} ${pct(s.changePct)}<br><small>${signedInr(s.change)}</small>`;
    tr.querySelector('.spk').innerHTML = sparkline(s.spark);
  }

  // Rows are updated in place (not rebuilt) so clicks and keyboard focus are never lost.
  function render(rebuild = false) {
    const list = store.stocks.filter((s) =>
      (!sector || s.sector === sector) &&
      (!query || s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)));
    if (rebuild || !built.size) {
      rows.innerHTML = list.map(rowHtml).join('');
      built.clear(); list.forEach((s) => built.add(s.symbol));
    }
    list.forEach((s) => { const tr = rows.querySelector(`tr[data-sym="${s.symbol}"]`); if (tr) fill(tr, s); });
    root.querySelector('#none').hidden = list.length > 0;
  }

  drawSectors();
  render(true);
  const off = on(() => { if (!root.querySelector('#sectors button')) drawSectors(); render(false); });
  return () => off();
}
