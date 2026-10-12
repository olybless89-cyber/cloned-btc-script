'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const EMPTY = { users: [], sessions: {}, holdings: {} };

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(EMPTY, null, 2));
  }
}

function read() {
  ensure();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

function write(state) {
  ensure();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// --- password hashing (scrypt, no external deps) -------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// --- users ---------------------------------------------------------------
function findUserByEmail(email) {
  const state = read();
  return state.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function findUserByUsername(username) {
  const state = read();
  return state.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}

function findUserById(id) {
  const state = read();
  return state.users.find((u) => u.id === id) || null;
}

function createUser({ fullName, username, email, password }) {
  const state = read();
  const user = {
    id: crypto.randomUUID(),
    fullName,
    username,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    // Starting demo balance. Simulated only; no real money is ever involved.
    cashBalance: 10000,
  };
  state.users.push(user);
  state.holdings[user.id] = [];
  write(state);
  return user;
}

function updateUser(id, patch) {
  const state = read();
  const user = state.users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, patch);
  write(state);
  return user;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// --- sessions ------------------------------------------------------------
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function createSession(userId) {
  const state = read();
  const token = crypto.randomBytes(32).toString('hex');
  state.sessions[token] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  write(state);
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  const state = read();
  const session = state.sessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete state.sessions[token];
    write(state);
    return null;
  }
  return findUserById(session.userId);
}

function destroySession(token) {
  if (!token) return;
  const state = read();
  if (state.sessions[token]) {
    delete state.sessions[token];
    write(state);
  }
}

// --- holdings ------------------------------------------------------------
function getHoldings(userId) {
  const state = read();
  return state.holdings[userId] || [];
}

function setHoldings(userId, holdings) {
  const state = read();
  state.holdings[userId] = holdings;
  write(state);
}

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  publicUser,
  verifyPassword,
  hashPassword,
  createSession,
  getSessionUser,
  destroySession,
  getHoldings,
  setHoldings,
};
