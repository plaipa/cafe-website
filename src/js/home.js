import './main.js';
import '../css/home.css';
import { canWebGL, pickQuality } from './scene/mount.js';
import { hold, ready } from './loader.js';

const root = document.documentElement;
const journey = document.getElementById('journey');
const canvas = document.getElementById('scene');
const chapters = [...document.querySelectorAll('.chapter')];
const tags = [...document.querySelectorAll('.tag')];
const bar = document.querySelector('.journey__bar');
const stops = [...document.querySelectorAll('[data-goto]')];
const hint = document.querySelector('.scroll-hint');
const timers = [...document.querySelectorAll('[data-timer]')];
const nf = new Intl.NumberFormat(root.lang === 'en' ? 'en-US' : 'fa-IR');

const params = new URLSearchParams(location.search);
const forced = params.has('p') ? Number(params.get('p')) : null; // ?p=0.8 pins the story (handy for screenshots)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* Text chapters, the progress folio and the shot timer follow scroll; plain DOM work that runs with or without 3D. */
function syncUI(p) {
  for (const c of chapters) {
    const on = p >= Number(c.dataset.start) && p < Number(c.dataset.end);
    c.classList.toggle('is-active', on);
    c.toggleAttribute('inert', !on);
  }
  const active = stops.reduce((acc, s, i) => (p >= Number(s.dataset.goto) - 0.05 ? i : acc), 0);
  stops.forEach((s, i) => {
    s.classList.toggle('is-on', i === active);
    s.toggleAttribute('aria-current', i === active);
  });
  bar?.style.setProperty('--fill', String(Math.min(1, p / 0.9)));
  hint?.classList.toggle('is-hidden', p > 0.02);
  for (const t of timers) {
    const k = Math.min(1, Math.max(0, (p - t.dataset.from) / (t.dataset.to - t.dataset.from)));
    t.textContent = nf.format(Math.round(k * Number(t.dataset.max)));
  }
}
const syncNow = () => syncUI(journeyProgress());
syncNow();
addEventListener('scroll', syncNow, { passive: true });

async function start() {
  const { createJourney } = await import('./scene/story.js');
  const story = await createJourney({
    canvas,
    quality: pickQuality(),
    side: root.dir === 'ltr' ? 1 : -1, // copy on the left in English, on the right in Persian
  });
  root.classList.add('webgl');

  // the page takes the colour of the spread on screen, so the header and the
  // edges of the canvas always match the backdrop
  const paint = (p) => root.style.setProperty('--bg', story.backgroundAt(p));
  const tick = () => {
    const p = journeyProgress();
    story.setProgress(p);
    paint(p);
  };
  tick();
  story.renderStill(journeyProgress());
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
  // past the story the page is paper again
  new IntersectionObserver(([e]) => !e.isIntersecting && root.style.removeProperty('--bg')).observe(journey);

  // only spend GPU time while the journey is on screen
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? story.start() : story.stop()), {
    rootMargin: '200px 0px',
  }).observe(journey);
  document.addEventListener('visibilitychange', () => (document.hidden ? story.stop() : tick()));
  if (!reduceMotion) {
    addEventListener(
      'pointermove',
      (e) => story.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
      { passive: true }
    );
  }

  // hairline labels pinned to each layer of the exploded glass
  const place = () => {
    const p = journeyProgress();
    for (const t of tags) {
      const on = p >= Number(t.dataset.start) && p < Number(t.dataset.end);
      t.classList.toggle('is-on', on);
      if (!on) continue;
      const pt = story.labelOnScreen(Number(t.dataset.layer));
      t.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    }
    requestAnimationFrame(place);
  };
  ready.then(() => requestAnimationFrame(place));
  if (forced !== null) window.__ready = true;
}

if (!canWebGL()) {
  root.classList.add('no-webgl');
} else {
  hold(start()).catch((err) => {
    console.error('3D story failed, falling back to static layout', err);
    root.classList.add('no-webgl');
  });
}
