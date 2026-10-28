import './main.js';
import '../css/home.css';
import { hold, ready } from './loader.js';

/* The home story is a real pour, scrubbed by scroll (a sequence of video frames
   drawn onto a canvas), that dissolves into a technical drawing of the same glass
   and then comes apart into its layers. */

const root = document.documentElement;
const journey = document.getElementById('journey');
const canvas = document.getElementById('pour');
const plate = document.querySelector('.plate');
const drawing = document.querySelector('.anatomy');
const chapters = [...document.querySelectorAll('.chapter')];
const bar = document.querySelector('.journey__bar');
const stops = [...document.querySelectorAll('[data-goto]')];
const timers = [...document.querySelectorAll('[data-timer]')];
const nf = new Intl.NumberFormat(root.lang === 'en' ? 'en-US' : 'fa-IR');

const params = new URLSearchParams(location.search);
const forced = params.has('p') ? Number(params.get('p')) : null; // ?p=0.8 pins the story (handy for screenshots)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
/** Interpolate keyed values ([[p, value], …]); values may be numbers, arrays or hex colours. */
function keyed(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      const e = smooth((p - p0) / (p1 - p0));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], e));
      if (typeof v0 === 'string') return mixHex(v0, v1, e);
      return lerp(v0, v1, e);
    }
  }
  return keys[keys.length - 1][1];
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/* Scroll progress → what's on the plate. */
const STORY = {
  // video position 0..1 and a slow push-in: [time, zoom, focus y (0 top … 1 bottom)]
  shot: [
    [0, [0, 1.04, 0.5]],
    [0.08, [0, 1.04, 0.5]],
    [0.28, [0.05, 1.55, 0.8]], // 01 espresso: close on the dark base
    [0.36, [0.12, 1.2, 0.62]],
    [0.53, [0.78, 1.06, 0.5]], // 02 milk pours over the ice
    [0.7, [1, 1.32, 0.3]], // 03 foam, close on the top
    [0.75, [1, 1.08, 0.5]],
    [1, [1, 1.04, 0.5]],
  ],
  // the photograph gives way to the drawing, and comes back for the last page
  photo: [[0, 1], [0.72, 1], [0.765, 0], [0.915, 0], [0.95, 1]],
  draw: [[0, 0], [0.73, 0], [0.8, 1]],
  explode: [[0, 0], [0.79, 0], [0.86, 1], [0.915, 1]],
  labels: [[0, 0], [0.84, 0], [0.87, 1]],
  // the page beside the plate turns, colour by colour, like spreads in a magazine
  page: [
    [0, '#efe9df'],
    [0.08, '#efe9df'],
    [0.14, '#ead2c0'],
    [0.3, '#ead2c0'],
    [0.36, '#f2eee7'],
    [0.53, '#f2eee7'],
    [0.58, '#efe4bf'],
    [0.7, '#efe4bf'],
    [0.75, '#d3d9c9'],
    [0.91, '#d3d9c9'],
    [0.95, '#efe9df'],
  ],
};

function journeyProgress() {
  if (forced !== null) return forced;
  const span = journey.offsetHeight - innerHeight;
  const top = journey.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, -top / span));
}

function scrollToProgress(p) {
  const span = journey.offsetHeight - innerHeight;
  const y = journey.getBoundingClientRect().top + scrollY + p * span;
  scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
}
stops.forEach((b) => b.addEventListener('click', () => scrollToProgress(Number(b.dataset.goto))));
document.querySelectorAll('[data-scroll-journey]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToProgress(Number(a.dataset.scrollJourney));
  })
);

/* ── the frames ── */
const ctx = canvas.getContext('2d');
const count = Number(canvas.dataset.count);
const small = innerWidth < 760 || navigator.connection?.saveData;
const dir = `${canvas.dataset.frames}${small ? 'm' : 'd'}/`;
const frames = new Array(count);
const name = (i) => `${dir}${String(i + 1).padStart(3, '0')}.webp`;

function load(i) {
  if (frames[i]) return frames[i].ready;
  const img = new Image();
  img.decoding = 'async';
  img.src = name(i);
  const entry = { img, ok: false };
  entry.ready = img.decode().then(
    () => (entry.ok = true),
    () => {}
  );
  frames[i] = entry;
  return entry.ready;
}
/** The nearest frame to `i` that has arrived (frames stream in coarse to fine). */
function nearest(i) {
  for (let d = 0; d < count; d++) {
    if (frames[i - d]?.ok) return frames[i - d].img;
    if (frames[i + d]?.ok) return frames[i + d].img;
  }
  return null;
}

let cw = 0;
let ch = 0;
function size() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cw = canvas.width = Math.max(1, Math.round(r.width * dpr));
  ch = canvas.height = Math.max(1, Math.round(r.height * dpr));
}

let lastKey = '';
function drawFrame(time, zoom, fy, force) {
  const i = Math.round(time * (count - 1));
  const img = nearest(i);
  if (!img) return;
  const key = `${img.src}:${zoom.toFixed(3)}:${fy.toFixed(3)}:${cw}:${ch}`;
  if (key === lastKey && !force) return;
  lastKey = key;
  // cover the canvas, then push in towards the focus point
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * zoom;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  const x = (cw - w) / 2;
  const y = Math.min(0, Math.max(ch - h, ch / 2 - fy * h));
  ctx.drawImage(img, x, y, w, h);
}

/* ── one place that maps progress to everything on screen ── */
let target = 0;
let current = 0;
function paint(force = false) {
  const P = current;
  const [time, zoom, fy] = keyed(P, STORY.shot);
  drawFrame(time, zoom, fy, force);
  plate.style.setProperty('--photo', keyed(P, STORY.photo).toFixed(3));
  drawing.style.setProperty('--draw', keyed(P, STORY.draw).toFixed(3));
  drawing.style.setProperty('--e', keyed(P, STORY.explode).toFixed(3));
  drawing.style.setProperty('--labels', keyed(P, STORY.labels).toFixed(3));
  root.style.setProperty('--bg', keyed(P, STORY.page));
  journey.classList.toggle('at-cover', P < 0.08);

  for (const c of chapters) {
    const on = P >= Number(c.dataset.start) && P < Number(c.dataset.end);
    c.classList.toggle('is-active', on);
    c.toggleAttribute('inert', !on);
  }
  const active = stops.reduce((acc, s, i) => (P >= Number(s.dataset.goto) - 0.05 ? i : acc), 0);
  stops.forEach((s, i) => {
    s.classList.toggle('is-on', i === active);
    s.toggleAttribute('aria-current', i === active);
  });
  bar?.style.setProperty('--fill', String(Math.min(1, P / 0.9)));
  for (const t of timers) {
    const k = Math.min(1, Math.max(0, (P - t.dataset.from) / (t.dataset.to - t.dataset.from)));
    t.textContent = nf.format(Math.round(k * Number(t.dataset.max)));
  }
}

// scroll sets the target; the picture eases after it, so a flick of the wheel still reads as a pour
let raf = 0;
function frame() {
  raf = 0;
  const d = target - current;
  current = reduceMotion || Math.abs(d) < 0.0005 ? target : current + d * 0.14;
  paint();
  if (current !== target) raf = requestAnimationFrame(frame);
}
const kick = () => {
  target = journeyProgress();
  if (!raf) raf = requestAnimationFrame(frame);
};

size();
target = current = journeyProgress();
paint(true);
addEventListener('scroll', kick, { passive: true });
addEventListener('resize', () => {
  size();
  paint(true);
});
// past the story the page is paper again
new IntersectionObserver(([e]) => !e.isIntersecting && root.style.removeProperty('--bg')).observe(journey);

// the frames around the current point hold the loader; the rest stream in
// coarse to fine (every 8th, 4th, 2nd, then all) so scrubbing works early
const start = Math.round(keyed(current, STORY.shot)[0] * (count - 1));
const first = Promise.all([load(start), load(0), load(count - 1)]);
hold(first);
first.then(async () => {
  paint(true);
  root.classList.add('frames-ready');
  if (forced !== null) ready.then(() => setTimeout(() => (window.__ready = true), 300));
  for (const step of [8, 4, 2, 1]) {
    const batch = [];
    for (let i = 0; i < count; i += step) batch.push(load(i));
    await Promise.all(batch);
    paint(true);
  }
});
