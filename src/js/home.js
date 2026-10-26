import './main.js';
import '../css/home.css';
import { canWebGL, pickQuality, wire } from './scene/mount.js';
import { hold } from './loader.js';

const root = document.documentElement;
const journey = document.getElementById('journey');
const canvas = document.getElementById('scene');
const chapters = [...document.querySelectorAll('.chapter')];
const tags = [...document.querySelectorAll('.tag')];
const bar = document.querySelector('.journey__bar');
const stops = [...document.querySelectorAll('[data-goto]')];
const hint = document.querySelector('.scroll-hint');

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
    scrollToProgress(Number(a.dataset.scrollJourney) + 0.02);
  })
);

/* Text chapters react to progress; cheap DOM work on every scroll tick. */
function syncUI(p) {
  for (const c of chapters) {
    const on = p >= Number(c.dataset.start) && p < Number(c.dataset.end);
    c.classList.toggle('is-active', on);
    c.toggleAttribute('inert', !on);
  }
  const active = stops.reduce((acc, s, i) => (p >= Number(s.dataset.goto) - 0.06 ? i : acc), 0);
  stops.forEach((s, i) => s.classList.toggle('is-on', i === active));
  stops.forEach((s, i) => s.toggleAttribute('aria-current', i === active));
  bar.style.setProperty('--fill', String(active / (stops.length - 1)));
  hint.classList.toggle('is-hidden', p > 0.02);
}

// the copy follows the scroll on its own, even before (or without) the 3D scene
const syncNow = () => syncUI(journeyProgress());
syncNow();
addEventListener('scroll', syncNow, { passive: true });

async function start() {
  const [{ createJourney }, { CAFFEINE }] = await Promise.all([import('./scene/scenes.js'), import('./scene/molecule.js')]);
  const story = await createJourney({
    canvas,
    quality: pickQuality(),
    side: root.dir === 'ltr' ? 1 : -1, // the scene sits opposite the copy
  });
  root.classList.add('webgl');

  const tick = () => {
    const p = journeyProgress();
    story.setProgress(p);
    syncUI(p);
  };
  tick();
  story.renderStill(journeyProgress());
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
  wire(journey, story);
  document.addEventListener('visibilitychange', () => !document.hidden && tick());

  // labels pinned to real atoms of the caffeine molecule
  const atomOf = { oxygen: CAFFEINE.marks.O6, nitrogen: CAFFEINE.marks.N7, methyl: CAFFEINE.marks.methyl };
  const place = () => {
    const p = journeyProgress();
    for (const t of tags) {
      const on = p >= Number(t.dataset.start) && p < Number(t.dataset.end);
      t.classList.toggle('is-on', on);
      if (!on) continue;
      const pt = story.atomOnScreen(atomOf[t.dataset.tag]);
      t.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    }
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}

if (!canWebGL()) {
  root.classList.add('no-webgl');
} else {
  hold(start()).catch((err) => {
    console.error('3D story failed, falling back to static layout', err);
    root.classList.add('no-webgl');
  });
}
