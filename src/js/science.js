import { lang, reduceMotion } from './main.js';
import '../css/pages.css';
import { mountScene } from './scene/mount.js';

/* ───────────── Caffeine model ─────────────
   One-compartment model with first-order absorption and elimination:
   A(t) = D · ka/(ka−ke) · (e^(−ke·t) − e^(−ka·t))
   ka = 5/h puts the peak at ~45 min; ke = ln2 / 5 h is a typical adult half-life.
   It is an illustration of the shape, not a prediction for any one person. */
const KA = 5;
const KE = Math.LN2 / 5;
const amount = (dose, t) => (t <= 0 ? 0 : (dose * KA) / (KA - KE) * (Math.exp(-KE * t) - Math.exp(-KA * t)));

const T0 = 6; // chart window: 06:00 → 02:00 next day
const T1 = 26;
const SPACING = 3; // hours between cups when drinking more than one

const L = {
  fa: {
    mg: 'میلی‌گرم',
    peak: 'اوج',
    bed: 'خواب',
    title: 'کافئینِ تخمینی در بدن (میلی‌گرم) در طول روز',
    at: 'ساعت',
    calm: 'تقریباً چیزی باقی نمانده؛ خوابِ آرامی در پیش است.',
    some: 'مقدار کمی باقی می‌ماند؛ برای افرادِ حساس به کافئین ممکن است محسوس باشد.',
    lots: 'هنوز مقدار قابل‌توجهی در بدنت است و ممکن است خوابت را سبک‌تر کند. پژوهش‌ها پیشنهاد می‌کنند آخرین فنجان دست‌کم ۶ ساعت پیش از خواب باشد.',
    time: 'ساعت',
  },
  en: {
    mg: 'mg',
    peak: 'Peak',
    bed: 'Bed',
    title: 'Estimated caffeine in your body (mg) across the day',
    at: 'at',
    calm: 'Almost nothing is left. A calm night ahead.',
    some: 'A little remains, which caffeine-sensitive people may notice.',
    lots: 'A meaningful amount is still in your body and may make your sleep lighter. Research suggests keeping the last cup at least 6 hours before bed.',
    time: 'Time',
  },
}[lang];

const nf = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 0 });
const pad = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { minimumIntegerDigits: 2, useGrouping: false });
function clock(h) {
  const hh = Math.floor((((h % 24) + 24) % 24) + 1e-6);
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${pad.format(hh)}:${pad.format(mm)}`;
}

/* ───────────── State & controls ───────────── */
const state = { dose: 126, cups: 1, drink: 8, bed: 23 };
const $ = (s) => document.querySelector(s);
const drinkInput = $('#drink-time');
const bedInput = $('#bed-time');
const drinkOut = $('#drink-time-out');
const bedOut = $('#bed-time-out');

function bindChips(selector, key) {
  const chips = [...document.querySelectorAll(selector)];
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      chips.forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
      state[key] = Number(c.dataset.value);
      draw();
    })
  );
}
bindChips('[data-dose]', 'dose');
bindChips('[data-cups]', 'cups');
drinkInput.addEventListener('input', () => {
  state.drink = Number(drinkInput.value);
  draw();
});
bedInput.addEventListener('input', () => {
  state.bed = Number(bedInput.value);
  draw();
});

const total = (t) => {
  let a = 0;
  for (let i = 0; i < state.cups; i++) a += amount(state.dose, t - (state.drink + i * SPACING));
  return a;
};

/* ───────────── Chart (SVG) ───────────── */
const W = 640;
const H = 300;
const PAD = { l: 44, r: 14, t: 24, b: 30 };
const svgNS = 'http://www.w3.org/2000/svg';
const chartEl = $('#chart');
const svg = document.createElementNS(svgNS, 'svg');
svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
svg.setAttribute('role', 'img');
svg.setAttribute('aria-labelledby', 'chart-title');
svg.innerHTML = `
  <defs><linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#6f6e6c" stop-opacity=".28"/><stop offset="1" stop-color="#6f6e6c" stop-opacity="0"/>
  </linearGradient></defs>
  <g class="grid"></g><g class="axis"></g>
  <path class="area"/><path class="curve"/>
  <g class="bed"><line/><text text-anchor="middle"/></g>
  <g class="peak"><circle r="5"/><text text-anchor="middle"/></g>
  <g class="cursor"><line/><circle r="4.5"/></g>`;
chartEl.prepend(svg);
const tip = document.createElement('div');
tip.className = 'chart__tip';
tip.style.opacity = '0';
chartEl.append(tip);

const x = (t) => PAD.l + ((t - T0) / (T1 - T0)) * (W - PAD.l - PAD.r);
const tFromX = (px) => T0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (T1 - T0);
let yMax = 150;
const y = (mg) => H - PAD.b - (mg / yMax) * (H - PAD.t - PAD.b);

const peakInfo = () => {
  let best = { t: T0, a: 0 };
  for (let t = T0; t <= T1; t += 1 / 60) {
    const a = total(t);
    if (a > best.a) best = { t, a };
  }
  return best;
};

function draw() {
  drinkOut.value = clock(state.drink);
  bedOut.value = clock(state.bed);

  const peak = peakInfo();
  yMax = Math.max(150, Math.ceil((peak.a * 1.15) / 50) * 50);

  // grid + axes
  const grid = svg.querySelector('.grid');
  const axis = svg.querySelector('.axis');
  grid.innerHTML = '';
  axis.innerHTML = '';
  for (let mg = 0; mg <= yMax; mg += yMax > 300 ? 100 : 50) {
    grid.insertAdjacentHTML('beforeend', `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(mg)}" y2="${y(mg)}"/>`);
    axis.insertAdjacentHTML('beforeend', `<text x="${PAD.l - 8}" y="${y(mg) + 4}" text-anchor="end">${nf.format(mg)}</text>`);
  }
  for (let t = T0; t <= T1; t += 2) {
    axis.insertAdjacentHTML('beforeend', `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${clock(t).slice(0, 2)}</text>`);
  }

  // curve
  let d = '';
  for (let t = T0; t <= T1 + 1e-6; t += 1 / 12) d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(total(t)).toFixed(1)}`;
  svg.querySelector('.curve').setAttribute('d', d);
  svg.querySelector('.area').setAttribute('d', `${d}L${x(T1)},${y(0)}L${x(T0)},${y(0)}Z`);

  // markers
  const bed = svg.querySelector('.bed');
  bed.querySelector('line').setAttribute('x1', x(state.bed));
  bed.querySelector('line').setAttribute('x2', x(state.bed));
  bed.querySelector('line').setAttribute('y1', PAD.t - 6);
  bed.querySelector('line').setAttribute('y2', y(0));
  bed.querySelector('text').setAttribute('x', x(state.bed));
  bed.querySelector('text').setAttribute('y', PAD.t - 10);
  bed.querySelector('text').textContent = L.bed;
  const pk = svg.querySelector('.peak');
  pk.querySelector('circle').setAttribute('cx', x(peak.t));
  pk.querySelector('circle').setAttribute('cy', y(peak.a));
  pk.querySelector('text').setAttribute('x', x(peak.t));
  pk.querySelector('text').setAttribute('y', y(peak.a) - 12);
  pk.querySelector('text').textContent = `${L.peak} · ${clock(peak.t)}`;

  // readout
  const atBed = total(state.bed);
  $('#out-peak-time').textContent = clock(peak.t);
  $('#out-peak-mg').textContent = `${nf.format(peak.a)} ${L.mg}`;
  $('#out-bed-mg').textContent = `${nf.format(atBed)} ${L.mg}`;
  $('#out-verdict').textContent = atBed < 25 ? L.calm : atBed < 50 ? L.some : L.lots;

  // accessible table view (hourly)
  const rows = [];
  for (let t = T0; t <= T1; t += 1) rows.push(`<tr><td>${clock(t)}</td><td>${nf.format(total(t))}</td></tr>`);
  $('#chart-table tbody').innerHTML = rows.join('');
}

/* ───────────── Playhead: drives the tooltip and the 3D brain ───────────── */
let story = null;
let play = state.drink;
let userUntil = 0;
const cursor = svg.querySelector('.cursor');
const meter = $('#lab-meter');

function setPlayhead(t, showTip) {
  play = Math.min(T1, Math.max(T0, t));
  const a = total(play);
  cursor.querySelector('line').setAttribute('x1', x(play));
  cursor.querySelector('line').setAttribute('x2', x(play));
  cursor.querySelector('line').setAttribute('y1', PAD.t);
  cursor.querySelector('line').setAttribute('y2', y(0));
  cursor.querySelector('circle').setAttribute('cx', x(play));
  cursor.querySelector('circle').setAttribute('cy', y(a));
  const text = `${clock(play)} · ≈ ${nf.format(a)} ${L.mg}`;
  meter.innerHTML = `<b>${nf.format(a)}</b>${L.mg} · ${clock(play)}`;
  if (showTip) {
    const r = svg.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = `${(x(play) / W) * r.width}px`;
    tip.style.top = `${(y(a) / H) * r.height}px`;
    tip.style.opacity = '1';
  }
  // 200 mg ≈ fully lit; sqrt keeps small doses visibly glowing
  // one molecule ≈ 10 mg of caffeine
  story?.setMolecules(a / 10);
}

function pointerToTime(e) {
  const r = svg.getBoundingClientRect();
  return tFromX(((e.clientX - r.left) / r.width) * W);
}
svg.addEventListener('pointermove', (e) => {
  userUntil = performance.now() + 2500;
  setPlayhead(pointerToTime(e), true);
});
svg.addEventListener('pointerdown', (e) => {
  userUntil = performance.now() + 2500;
  setPlayhead(pointerToTime(e), true);
});
svg.addEventListener('pointerleave', () => (tip.style.opacity = '0'));

// when nobody is touching the chart, the playhead walks through the day on its own
let lastNow = performance.now();
function autoplay(now) {
  const dt = (now - lastNow) / 1000;
  lastNow = now;
  if (now > userUntil) {
    let next = play + dt * 1.6; // ~12 s for the whole day
    if (next > T1) next = T0;
    setPlayhead(next, false);
    tip.style.opacity = '0';
  }
  requestAnimationFrame(autoplay);
}

draw();
setPlayhead(state.drink + 0.75, false);
mountScene(document.querySelector('[data-scene]'), 'molecules').then((s) => {
  story = s;
  setPlayhead(play, false);
});
if (!reduceMotion) requestAnimationFrame(autoplay);
