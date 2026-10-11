# Auralis — crypto market demo

A small full-stack demo: a landing site, real authentication, and a dashboard backed by an
Express API. It is a non-functional demonstration app.

## This is not a financial product

- There are **no** investment plans, promised returns, deposits, withdrawals, or payouts.
- All prices, percentage changes, and volumes are **simulated** with a local random walk.
  They are not connected to any exchange or data provider.
- The only balance is a virtual $10,000 you can reset at any time.
- Accounts and data live in a local JSON file. Nothing is sent anywhere.

It deliberately omits the elements that make crypto-themed investment sites dangerous —
guaranteed-return plans, deposit flows, referral pyramids, and fabricated "live investor"
activity. If you are looking at a site that has those, treat it as a fraud pattern.

## Features

- **Landing page** with a simulated market snapshot and a price ticker.
- **Auth**: sign-up and sign-in with scrypt-hashed passwords and server-side sessions.
- **Dashboard**: virtual portfolio (buy/sell against simulated prices), holdings table with
  P&L, and a live market table.
- **Content pages**: pricing, about, FAQ, contact, 404.

## Stack

- Node.js 18+ and Express (the only runtime dependency).
- Vanilla HTML/CSS/JavaScript on the front end — no build step, no framework.
- A JSON file (`data/store.json`) for storage.

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

Set `PORT` to change the port, e.g. `PORT=8080 npm start`.

## Layout

```
server/
  index.js     Express app: API routes, static hosting, sessions
  store.js     users, sessions, holdings, scrypt password hashing
  markets.js   simulated price engine (random walk)
public/
  index.html   landing page
  login.html / signup.html
  dashboard.html
  pricing.html / about.html / faq.html / contact.html / 404.html
  css/app.css
  js/app.js
```

## API

| Method | Path                     | Notes                                  |
| ------ | ------------------------ | -------------------------------------- |
| GET    | `/api/markets`           | Simulated market list                  |
| POST   | `/api/auth/signup`       | Create account, starts a session       |
| POST   | `/api/auth/login`        | Sign in                                |
| POST   | `/api/auth/logout`       | End the session                        |
| GET    | `/api/auth/me`           | Current user, or `null`                |
| GET    | `/api/portfolio`         | Portfolio for the signed-in user       |
| POST   | `/api/portfolio/trade`   | Simulated buy/sell (`symbol`, `side`, `usd`) |
| POST   | `/api/portfolio/reset`   | Reset to $10,000 virtual cash          |

## Notes on the code

- Passwords are hashed with `crypto.scryptSync` and compared in constant time.
- Sessions are opaque random tokens stored server-side and sent as an `HttpOnly` cookie.
- There is no rate limiting, email verification, or CSRF protection. It is a demo, not a
  production auth system — do not deploy it as one.
