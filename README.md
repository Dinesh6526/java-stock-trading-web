# TradeSim - simulated stock trading website

Practice buying and selling 15 Indian stocks with virtual rupees. Prices are **simulated** and move every
few seconds. No real money, no real market data, no real orders.

**Stack:** Node.js + Express, MySQL (`mysql2`), JWT + bcrypt login, vanilla JavaScript frontend (ES modules), Chart.js.

**Demo login (created on first start):** username `demo` / password `demo123`

---

## 1. Run it

You need **Node.js 18+** and **MySQL 5.7+ / 8** (MariaDB 10.3+ also works) running on your computer.

```bash
cd tradesim
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Open `.env` and set your MySQL password:

```
DB_USER=root
DB_PASSWORD=your_mysql_password
```

Then start the server:

```bash
npm start
```

Open **http://localhost:3000**.

On the first start the server automatically creates the `tradesim` database, creates the tables from
`database/schema.sql`, and loads the demo data (15 stocks, price history, and the demo account with a few trades).
You do not need to run any SQL by hand. To reset everything: `DROP DATABASE tradesim;` and restart.

**Run the API tests** (server must be running): `npm test` - 33 checks covering login, validation,
insufficient balance, over-selling, and 10 simultaneous orders.

### In VS Code
Open the `tradesim` folder, open the Terminal (Ctrl + `), run the commands above, and use the
Run and Debug panel or `npm run dev` for auto-restart while you edit server files.

### If it will not start
| Message | Fix |
|---|---|
| `ECONNREFUSED` | MySQL is not running. Start the MySQL service. |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER` / `DB_PASSWORD` in `.env`. |
| `EADDRINUSE` | Port 3000 is busy. Change `PORT` in `.env`. |

---

## 2. What you can do

| Page | Features |
|---|---|
| Log in / Create account | Username + password, new accounts get Rs. 1,00,000 virtual cash, one-click demo login |
| Dashboard | Net worth, cash, total investment, current value, today's change, unrealised and realised profit / loss, allocation chart, market movers, recent trades |
| Market | All stocks with live prices (green / red flash), change, trend line, search and sector filter |
| Stock | Price chart that updates live, buy / sell panel with total and balance check, your holding and its profit / loss |
| Portfolio | Quantity, average cost, price, invested, value and profit / loss for each holding, with a Sell button |
| History | Every buy and sell with price, total and realised profit / loss; filter by type and stock; pages |
| Add cash | Top up virtual money (up to Rs. 10,00,000 at a time) |

---

## 3. How it works

```
tradesim/
  server/
    index.js            start-up: database, seed, price engine, routes, static files
    config.js           reads .env
    db.js               creates the database + tables, MySQL connection pool
    seed.js             demo stocks, price history, demo account
    market.js           price engine (random walk that is pulled gently back to a base price)
    middleware/auth.js  checks the JWT on protected routes
    routes/
      auth.js           POST /api/auth/register, /login
      user.js           GET /api/me, POST /api/me/funds
      market.js         GET /api/stocks, /api/stocks/:symbol
      trade.js          POST /api/trade/buy, /api/trade/sell
      portfolio.js      GET /api/portfolio, /api/transactions
  database/schema.sql   the 5 tables
  public/               the website (no build step)
    index.html, css/styles.css
    js/main.js          app shell, ticker tape, router
    js/api.js           fetch wrapper + token storage
    js/store.js         shared live stock data, refreshed every 5 seconds
    js/pages/*.js       auth, dashboard, market, stock, portfolio, history
    vendor/chart.min.js, fonts/
  tests/api-test.js     API smoke tests
```

**Tables:** `users`, `stocks`, `price_history`, `holdings` (one row per user + stock), `transactions`.

**Buying and selling** (`server/routes/trade.js`) runs inside a database transaction and locks the user, stock and
holding rows (`SELECT ... FOR UPDATE`). This means two quick clicks, or two browser tabs, can never spend the same
money or sell the same shares twice. The price used is always the server's current price - the browser only sends
the symbol and quantity.

**Profit / loss:** holdings keep the total cost paid, so average cost = total cost / quantity. Selling removes cost at the
average, and the difference is saved as that sale's *realised* profit / loss. Unrealised profit / loss =
current value - cost of the shares you still own.

**Today's change** is measured against the previous close, which resets at the start of each UTC day
(5:30 am IST). Change `UTC_DATE()` in `server/market.js` if you want a different day boundary.

---

## 4. Settings (`.env`)

| Name | Meaning |
|---|---|
| `PORT` | Website port (default 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Long random text used to sign login tokens. **Change it before putting the site online.** |
| `STARTING_BALANCE` | Virtual cash for new accounts (default 100000) |
| `TICK_MS` | How often prices move, in milliseconds (default 5000) |

---

## 5. Notes and ideas to extend

- Passwords are hashed with bcrypt; login and register are rate limited; all SQL uses parameters.
- Login tokens last 7 days and are kept in the browser's `localStorage`.
- Money is stored as `DECIMAL(15,2)`. The server rounds to 2 decimals after each calculation.
- Ideas: watchlist, limit orders, leaderboard between users, CSV export of history, an admin page to add stocks.
