import './main.js';
import '../css/home.css';
import { canWebGL, pickQuality, wire } from './scene/mount.js';
import { hold, ready } from './loader.js';

const root = document.documentElement;
const journey = document.getElementById('journey');
const canvas = document.getElementById('scene');
const chapters = [...document.querySelectorAll('.chapter')];
const titles = [...document.querySelectorAll('.act-title')];
const stops = [...document.querySelectorAll('[data-goto]')];
const actNo = document.getElementById('act-no');
const hint = document.querySelector('.scroll-hint');

const params = new URLSearchParams(location.search);
const forced = params.has('p') ? Number(params.get('p')) : null; // ?p=0.8 pins the story (handy for screenshots)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const digits = new Intl.NumberFormat(root.lang === 'en' ? 'en-US' : 'fa-IR', { minimumIntegerDigits: 2 });

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
    scrollToProgress(Number(a.dataset.scrollJourney) + 0.04);
  })
);

/* Copy, titles and the act index follow the scroll; cheap DOM work that runs with or without 3D. */
let loaded = false;
function syncUI(p) {
  let act = -1;
  chapters.forEach((c, i) => {
    const on = p >= Number(c.dataset.start) && p < Number(c.dataset.end);
    c.classList.toggle('is-active', on);
    c.toggleAttribute('inert', !on);
    if (on) act = i;
  });
  // titles only rise once the intro loader has lifted
  titles.forEach((t, i) => t.classList.toggle('is-in', loaded && i === act));
  const near = act >= 0 ? act : stops.reduce((acc, s, i) => (p >= Number(s.dataset.goto) - 0.1 ? i : acc), 0);
  stops.forEach((s, i) => {
    s.classList.toggle('is-on', i === near);
    s.toggleAttribute('aria-current', i === near);
  });
  if (actNo) actNo.textContent = digits.format(near + 1);
  hint?.classList.toggle('is-hidden', p > 0.02);
}
const syncNow = () => syncUI(journeyProgress());
syncNow();
addEventListener('scroll', syncNow, { passive: true });
ready.then(() => {
  loaded = true;
  syncNow();
});

async function start() {
  const { createJourney } = await import('./scene/scenes.js');
  const story = await createJourney({
    canvas,
    quality: pickQuality(),
    side: root.dir === 'ltr' ? 1 : -1, // the subject sits opposite the copy
  });
  root.classList.add('webgl');
  const tick = () => story.setProgress(journeyProgress());
  tick();
  story.renderStill(journeyProgress());
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
  wire(journey, story);
  document.addEventListener('visibilitychange', () => !document.hidden && tick());
}

if (!canWebGL()) {
  root.classList.add('no-webgl');
} else {
  hold(start()).catch((err) => {
    console.error('3D story failed, falling back to static layout', err);
    root.classList.add('no-webgl');
  });
}
