const BASE = process.env.BASE || 'http://localhost:3000/api';
let passed = 0, failed = 0;

async function call(method, url, body, token) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + ' ' + extra); }
}

(async () => {
  const name = 'user' + Date.now().toString().slice(-8);
  let r = await call('GET', '/stocks');
  check('stocks need login (401)', r.status === 401);
  r = await call('POST', '/auth/register', { username: 'a!', password: 'secret1' });
  check('bad username rejected', r.status === 400, JSON.stringify(r.data));
  r = await call('POST', '/auth/register', { username: name, password: '123' });
  check('short password rejected', r.status === 400);
  r = await call('POST', '/auth/register', { username: name, password: 'secret1' });
  check('register ok, starts with Rs.1,00,000', r.status === 201 && r.data.user.balance === 100000);
  const token = r.data.token;
  r = await call('POST', '/auth/register', { username: name.toUpperCase(), password: 'secret1' });
  check('duplicate username (any case) rejected', r.status === 409);
  r = await call('POST', '/auth/login', { username: name, password: 'wrong' });
  check('wrong password rejected', r.status === 401);
  r = await call('POST', '/auth/login', { username: 'demo', password: 'demo123' });
  check('demo login works', r.status === 200 && !!r.data.token);
  const demoToken = r.data.token;

  r = await call('GET', '/stocks', null, token);
  check('15 stocks listed', r.data.stocks.length === 15);
  check('stock has price/change/spark', r.data.stocks[0].price > 0 && Array.isArray(r.data.stocks[0].spark));
  r = await call('GET', '/stocks?search=tata&sector=Auto', null, token);
  check('search + sector filter', r.data.stocks.length === 1 && r.data.stocks[0].symbol === 'TATAMOTORS');
  r = await call('GET', '/stocks/NOPE', null, token);
  check('unknown stock 404', r.status === 404);
  r = await call('GET', '/stocks/TCS', null, token);
  check('stock detail has history', r.data.history.length > 10 && r.data.owned.quantity === 0);

  r = await call('POST', '/trade/buy', { symbol: 'TCS', quantity: 0 }, token);
  check('quantity 0 rejected', r.status === 400);
  r = await call('POST', '/trade/buy', { symbol: 'TCS', quantity: 1.5 }, token);
  check('fractional quantity rejected', r.status === 400);
  r = await call('POST', '/trade/buy', { symbol: 'TCS', quantity: 'abc' }, token);
  check('text quantity rejected', r.status === 400);
  r = await call('POST', '/trade/buy', { symbol: 'TCS', quantity: 1000 }, token);
  check('insufficient balance rejected', r.status === 400 && /Insufficient balance/.test(r.data.error), r.data.error);
  r = await call('POST', '/trade/buy', { symbol: 'NOPE', quantity: 1 }, token);
  check('unknown symbol rejected', r.status === 404);
  r = await call('POST', '/trade/buy', { symbol: 'ITC', quantity: 10, price: 1 }, token);
  const buyTotal = r.data.transaction && r.data.transaction.total;
  check('buy ok (client price ignored)', r.status === 201 && r.data.transaction.price > 100, JSON.stringify(r.data));
  check('balance reduced by total', Math.abs(r.data.balance - (100000 - buyTotal)) < 0.01);
  await call('POST', '/trade/buy', { symbol: 'ITC', quantity: 5 }, token);

  r = await call('GET', '/portfolio', null, token);
  const itc = r.data.holdings.find((h) => h.symbol === 'ITC');
  check('holding merged to 15 shares', itc && itc.quantity === 15);
  check('totals consistent', Math.abs(r.data.totals.pl - (r.data.totals.value - r.data.totals.invested)) < 0.01
    && Math.abs(r.data.totals.netWorth - (r.data.cash + r.data.totals.value)) < 0.01);

  r = await call('POST', '/trade/sell', { symbol: 'TCS', quantity: 1 }, token);
  check('sell un-owned stock rejected', r.status === 400 && /do not own/.test(r.data.error));
  r = await call('POST', '/trade/sell', { symbol: 'ITC', quantity: 16 }, token);
  check('sell more than owned rejected', r.status === 400 && /only own 15/.test(r.data.error), r.data.error);
  r = await call('POST', '/trade/sell', { symbol: 'ITC', quantity: 5 }, token);
  check('sell ok, has realized P/L', r.status === 201 && typeof r.data.transaction.realizedPl === 'number');
  r = await call('GET', '/portfolio', null, token);
  check('10 shares left', r.data.holdings[0].quantity === 10);
  r = await call('POST', '/trade/sell', { symbol: 'ITC', quantity: 10 }, token);
  r = await call('GET', '/portfolio', null, token);
  check('selling all removes holding', r.data.holdings.length === 0);

  r = await call('POST', '/me/funds', { amount: -5 }, token);
  check('negative funds rejected', r.status === 400);
  r = await call('POST', '/me/funds', { amount: 2000000 }, token);
  check('over-limit funds rejected', r.status === 400);
  r = await call('POST', '/me/funds', { amount: 2500.5 }, token);
  check('add funds ok', r.status === 200);

  r = await call('GET', '/transactions?limit=2', null, token);
  check('history paginated, newest first', r.data.items.length === 2 && r.data.total === 4 && r.data.items[0].type === 'SELL');
  r = await call('GET', '/transactions?type=BUY', null, token);
  check('history filter by type', r.data.items.length === 2 && r.data.items.every((t) => t.type === 'BUY'));
  r = await call('GET', '/portfolio', null, demoToken);
  check('demo has holdings + realized P/L', r.data.holdings.length >= 5 && r.data.totals.realized !== 0);

  const rc = await call('POST', '/auth/register', { username: 'race' + Date.now().toString().slice(-8), password: 'secret1' });
  const rt = rc.data.token;
  const px = (await call('GET', '/stocks/ITC', null, rt)).data.stock.price;
  const qty = Math.floor((0.3 * 100000) / px);   // each order costs ~30% of the balance, so exactly 3 fit
  const results = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/trade/buy', { symbol: 'ITC', quantity: qty }, rt)));
  const ok = results.filter((x) => x.status === 201).length;
  const me = (await call('GET', '/me', null, rt)).data.user;
  check(`exactly 3 of 10 orders succeeded (${ok}) and balance never negative`, ok === 3 && me.balance >= 0, 'balance=' + me.balance);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
