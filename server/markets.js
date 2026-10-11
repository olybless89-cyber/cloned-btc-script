'use strict';

// Simulated market data.
//
// IMPORTANT: none of this is real. Prices are generated locally with a random
// walk so the dashboard has something to render. There is no exchange, no
// order book, no money, and no network call to any price feed.

const SEED = [
  { symbol: 'BTC', name: 'Bitcoin', price: 61250.42 },
  { symbol: 'ETH', name: 'Ethereum', price: 3320.18 },
  { symbol: 'SOL', name: 'Solana', price: 148.77 },
  { symbol: 'XRP', name: 'XRP', price: 0.5231 },
  { symbol: 'ADA', name: 'Cardano', price: 0.4472 },
  { symbol: 'DOT', name: 'Polkadot', price: 6.18 },
  { symbol: 'LINK', name: 'Chainlink', price: 14.03 },
  { symbol: 'AVAX', name: 'Avalanche', price: 27.66 },
];

// Mutable in-memory state, seeded once per process start.
const state = new Map();

function rand() {
  return Math.random();
}

function init() {
  for (const coin of SEED) {
    state.set(coin.symbol, {
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      open: coin.price,
      change24h: (rand() - 0.5) * 8, // percent
      volume: Math.round(rand() * 900_000_000 + 100_000_000),
      spark: buildSpark(coin.price),
    });
  }
}

function buildSpark(base) {
  const points = [];
  let p = base * (0.96 + rand() * 0.04);
  for (let i = 0; i < 32; i++) {
    p = p * (1 + (rand() - 0.5) * 0.02);
    points.push(Number(p.toFixed(6)));
  }
  points[points.length - 1] = base;
  return points;
}

function tick() {
  for (const coin of state.values()) {
    const drift = (rand() - 0.5) * 0.006;
    coin.price = Math.max(0.0001, coin.price * (1 + drift));
    coin.change24h = Number((coin.change24h + (rand() - 0.5) * 0.15).toFixed(4));
    coin.volume = Math.round(coin.volume * (1 + (rand() - 0.5) * 0.01));
    coin.spark.push(Number(coin.price.toFixed(6)));
    if (coin.spark.length > 32) coin.spark.shift();
  }
}

function list() {
  return [...state.values()].map((c) => ({
    symbol: c.symbol,
    name: c.name,
    price: Number(c.price.toFixed(6)),
    change24h: Number(c.change24h.toFixed(2)),
    volume: c.volume,
    spark: c.spark,
  }));
}

function priceOf(symbol) {
  const c = state.get(String(symbol).toUpperCase());
  return c ? Number(c.price.toFixed(6)) : null;
}

init();
setInterval(tick, 2000).unref?.();

module.exports = { list, priceOf, tick };
