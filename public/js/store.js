// Shared live data: the stock list (refreshed every few seconds) and the user.
import { api } from './api.js';

export const store = {
  stocks: [],
  bySymbol: {},
  sectors: [],
  prevPrices: {},   // prices before the latest refresh, used for the green/red flash
  user: null,
  online: true,
};

const listeners = new Set();
export const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

export async function refreshStocks() {
  try {
    const d = await api('/stocks');
    store.prevPrices = Object.fromEntries(store.stocks.map((s) => [s.symbol, s.price]));
    store.stocks = d.stocks;
    store.sectors = d.sectors;
    store.bySymbol = Object.fromEntries(d.stocks.map((s) => [s.symbol, s]));
    store.online = true;
  } catch (e) {
    store.online = false;
  }
  emit();
}

export async function refreshUser() {
  const d = await api('/me');
  store.user = d.user;
  emit();
}

export function setBalance(balance) {
  if (store.user) store.user.balance = balance;
  emit();
}

let timer = null;
export function startPolling(ms = 5000) {
  stopPolling();
  timer = setInterval(() => { if (!document.hidden) refreshStocks(); }, ms);
}
export function stopPolling() { clearInterval(timer); timer = null; }
document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) refreshStocks(); });
