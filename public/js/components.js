// Reusable UI pieces: icons, toasts, the add-funds dialog, holdings table.
import { api } from './api.js';
import { setBalance } from './store.js';
import { esc, inr, num, signedInr, pct, tone, sparkline } from './utils.js';

export const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.7 3L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#141a47"/><rect x="7" y="15" width="4" height="10" rx="1" fill="#6b6cf5"/><rect x="14" y="8" width="4" height="17" rx="1" fill="#ffb547"/><rect x="21" y="12" width="4" height="13" rx="1" fill="#6b6cf5"/></svg>',
};

export function toast(message, type = 'success') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'error' : '');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 4000);
}

// ----- Add funds dialog -----
export function openFundsDialog() {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form method="dialog" class="dialog-in" id="funds-form" novalidate>
      <h2>Add virtual cash</h2>
      <p class="muted">This is practice money. You can add up to ₹10,00,000 at a time.</p>
      <div class="field">
        <label for="funds-amount">Amount (₹)</label>
        <input class="input" id="funds-amount" inputmode="decimal" autocomplete="off" placeholder="50000">
      </div>
      <div class="qty-row">
        <button type="button" class="chip" data-amt="10000">₹10,000</button>
        <button type="button" class="chip" data-amt="50000">₹50,000</button>
        <button type="button" class="chip" data-amt="100000">₹1,00,000</button>
      </div>
      <p class="form-error" role="alert"></p>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="submit" class="btn">Add cash</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const input = dlg.querySelector('#funds-amount');
  const err = dlg.querySelector('.form-error');
  dlg.querySelectorAll('[data-amt]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.amt; input.focus(); }));
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(String(input.value).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { err.textContent = 'Enter an amount greater than zero.'; return; }
    const btn = dlg.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const d = await api('/me/funds', { method: 'POST', body: { amount } });
      setBalance(d.balance);
      toast(d.message);
      dlg.close();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
  dlg.showModal();
  input.focus();
}

// ----- Holdings table (dashboard + portfolio) -----
export function holdingsTable(rows, { full = false } = {}) {
  if (!rows.length) return '';
  const body = rows.map((h) => `
    <tr class="link" data-go="#/stock/${esc(h.symbol)}">
      <td><a class="sym" href="#/stock/${esc(h.symbol)}">${esc(h.symbol)}</a><span class="sym-name">${esc(h.name)}</span></td>
      <td class="num">${num(h.quantity)}</td>
      ${full ? `<td class="num xs-hide">${inr(h.avgCost)}</td>` : ''}
      <td class="num">${inr(h.price)}</td>
      ${full ? `<td class="num sm-hide">${inr(h.invested)}</td>` : ''}
      <td class="num">${inr(h.value)}</td>
      <td class="num ${tone(h.pl)}">${signedInr(h.pl)}<br><small>${pct(h.plPct)}</small></td>
      ${full ? `<td class="num"><a class="btn ghost small" href="#/stock/${esc(h.symbol)}?side=sell">Sell</a></td>` : ''}
    </tr>`).join('');
  return `<div class="table-wrap"><table class="data">
    <thead><tr>
      <th>Stock</th><th class="num">Qty</th>
      ${full ? '<th class="num xs-hide">Avg cost</th>' : ''}
      <th class="num">Price</th>
      ${full ? '<th class="num sm-hide">Invested</th>' : ''}
      <th class="num">Value</th><th class="num">Profit / loss</th>
      ${full ? '<th></th>' : ''}
    </tr></thead><tbody>${body}</tbody></table></div>`;
}

// Makes any <tr data-go="#/..."> clickable
export function wireRowLinks(root) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const tr = e.target.closest('tr[data-go]');
    if (tr) location.hash = tr.dataset.go;
  });
}

export { sparkline };
