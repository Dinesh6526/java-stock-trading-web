// Formatting and small helpers shared by every page.

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 1234567.5 -> ₹12,34,567.50  (Indian digit grouping)
export const inr = (n, d = 2) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const num = (n) => Number(n).toLocaleString('en-IN');

const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
export const signedInr = (n, d = 2) => sign(Math.round(n * 100) / 100) + inr(Math.abs(n), d);
export const pct = (n) => sign(Math.round(n * 100) / 100) + Math.abs(n).toFixed(2) + '%';

// CSS class for a gain / loss number
export const tone = (n) => (Math.round(n * 100) > 0 ? 'gain' : Math.round(n * 100) < 0 ? 'loss' : 'flat');
export const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '–');

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

export const timeOnly = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Tiny inline SVG line chart for table rows.
export function sparkline(values, w = 96, h = 28) {
  if (!values || values.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join('');
  const cls = values[values.length - 1] >= values[0] ? 'gain' : 'loss';
  return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${pts}"/></svg>`;
}

// Combines the holdings the server sent with LIVE prices from the store.
export function livePortfolio(p, bySymbol) {
  let invested = 0, value = 0, dayChange = 0;
  const holdings = p.holdings.map((h) => {
    const s = bySymbol[h.symbol];
    const price = s ? s.price : h.price;
    const prevClose = s ? s.prevClose : price;
    const v = price * h.quantity;
    const pl = v - h.invested;
    invested += h.invested;
    value += v;
    dayChange += (price - prevClose) * h.quantity;
    return { ...h, price, value: v, pl, plPct: h.invested ? (pl / h.invested) * 100 : 0 };
  });
  const pl = value - invested;
  return {
    holdings,
    totals: {
      invested, value, pl,
      plPct: invested ? (pl / invested) * 100 : 0,
      dayChange,
      realized: p.totals.realized,
      netWorth: p.cash + value,
    },
  };
}
