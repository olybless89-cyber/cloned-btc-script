// Shared helpers for the Auralis demo front-end.

const api = {
  async get(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    return res.json().catch(() => ({}));
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
};

function money(n, opts = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.dp ?? 2,
    minimumFractionDigits: opts.dp ?? 2,
  }).format(Number(n) || 0);
}

function compact(n) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function pct(n) {
  const v = Number(n) || 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

// Draw a tiny sparkline into an inline SVG string.
function sparkline(points, positive) {
  if (!points || points.length < 2) return '';
  const w = 90;
  const h = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(h - ((p - min) / span) * h).toFixed(2)}`)
    .join(' ');
  const color = positive ? 'var(--green)' : 'var(--red)';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
});
