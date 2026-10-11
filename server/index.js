'use strict';

const path = require('path');
const express = require('express');
const store = require('./store');
const markets = require('./markets');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SESSION_COOKIE = 'auralis_session';

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// --- tiny cookie helpers -------------------------------------------------
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setSessionCookie(res, token) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function currentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  return store.getSessionUser(cookies[SESSION_COOKIE]);
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.user = user;
  next();
}

// --- validation ----------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup(body) {
  const errors = {};
  const fullName = String(body.fullName || '').trim();
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (fullName.length < 2) errors.fullName = 'Please enter your name.';
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    errors.username = '3-24 characters: letters, numbers, underscore.';
  }
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  return { errors, values: { fullName, username, email, password } };
}

// --- API: markets --------------------------------------------------------
app.get('/api/markets', (_req, res) => {
  res.json({ demo: true, markets: markets.list() });
});

// --- API: auth -----------------------------------------------------------
app.post('/api/auth/signup', (req, res) => {
  const { errors, values } = validateSignup(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  if (store.findUserByEmail(values.email)) {
    return res.status(409).json({ errors: { email: 'That email is already registered.' } });
  }
  if (store.findUserByUsername(values.username)) {
    return res.status(409).json({ errors: { username: 'That username is taken.' } });
  }

  const user = store.createUser(values);
  const token = store.createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: store.publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const id = String((req.body || {}).email || '').trim();
  const password = String((req.body || {}).password || '');
  const user = store.findUserByEmail(id) || store.findUserByUsername(id);
  if (!user || !store.verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = store.createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: store.publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  store.destroySession(cookies[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  res.json({ user: store.publicUser(user) });
});

// --- API: portfolio ------------------------------------------------------
function buildPortfolio(user) {
  const holdings = store.getHoldings(user.id).map((h) => {
    const price = markets.priceOf(h.symbol) ?? h.avgCost;
    const value = price * h.qty;
    const cost = h.avgCost * h.qty;
    return {
      symbol: h.symbol,
      qty: h.qty,
      avgCost: h.avgCost,
      price,
      value: Number(value.toFixed(2)),
      pnl: Number((value - cost).toFixed(2)),
      pnlPct: cost > 0 ? Number((((value - cost) / cost) * 100).toFixed(2)) : 0,
    };
  });
  const holdingsValue = holdings.reduce((s, h) => s + h.value, 0);
  const costBasis = holdings.reduce((s, h) => s + h.avgCost * h.qty, 0);
  return {
    cash: Number(user.cashBalance.toFixed(2)),
    holdings,
    holdingsValue: Number(holdingsValue.toFixed(2)),
    totalValue: Number((user.cashBalance + holdingsValue).toFixed(2)),
    totalPnl: Number((holdingsValue - costBasis).toFixed(2)),
  };
}

app.get('/api/portfolio', requireAuth, (req, res) => {
  res.json({ demo: true, portfolio: buildPortfolio(req.user) });
});

app.post('/api/portfolio/trade', requireAuth, (req, res) => {
  const body = req.body || {};
  const symbol = String(body.symbol || '').toUpperCase();
  const side = body.side === 'sell' ? 'sell' : body.side === 'buy' ? 'buy' : null;
  const usd = Number(body.usd);

  const price = markets.priceOf(symbol);
  if (price === null) return res.status(400).json({ error: 'Unknown symbol.' });
  if (!side) return res.status(400).json({ error: 'Side must be buy or sell.' });
  if (!Number.isFinite(usd) || usd <= 0) return res.status(400).json({ error: 'Enter a positive amount.' });

  const state = store.findUserById(req.user.id);
  const holdings = store.getHoldings(req.user.id);
  const existing = holdings.find((h) => h.symbol === symbol);

  if (side === 'buy') {
    if (usd > state.cashBalance) return res.status(400).json({ error: 'Insufficient demo cash balance.' });
    const qty = usd / price;
    if (existing) {
      const totalQty = existing.qty + qty;
      existing.avgCost = (existing.avgCost * existing.qty + usd) / totalQty;
      existing.qty = totalQty;
    } else {
      holdings.push({ symbol, qty, avgCost: price });
    }
    store.setHoldings(req.user.id, holdings);
    store.updateUser(req.user.id, { cashBalance: state.cashBalance - usd });
  } else {
    if (!existing) return res.status(400).json({ error: 'You do not hold that asset.' });
    const qty = Math.min(usd / price, existing.qty);
    const proceeds = qty * price;
    existing.qty -= qty;
    if (existing.qty <= 1e-12) {
      holdings.splice(holdings.indexOf(existing), 1);
    }
    store.setHoldings(req.user.id, holdings);
    store.updateUser(req.user.id, { cashBalance: state.cashBalance + proceeds });
  }

  res.json({ ok: true, portfolio: buildPortfolio(store.findUserById(req.user.id)) });
});

app.post('/api/portfolio/reset', requireAuth, (req, res) => {
  store.setHoldings(req.user.id, []);
  store.updateUser(req.user.id, { cashBalance: 10000 });
  res.json({ ok: true, portfolio: buildPortfolio(store.findUserById(req.user.id)) });
});

// --- static pages --------------------------------------------------------
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

const pages = ['about', 'pricing', 'faq', 'contact', 'login', 'signup', 'dashboard'];
for (const page of pages) {
  app.get(`/${page}`, (_req, res) => res.sendFile(path.join(PUBLIC_DIR, `${page}.html`)));
}

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.listen(PORT, () => {
  console.log(`Auralis demo running at http://localhost:${PORT}`);
  console.log('Demo only: simulated data, no real trading, no real money.');
});
