import './main.js';
import '../css/home.css';
import { HEAD_BRAIN } from './scene/shapes.js';
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

const params = new URLSearchParams(location.search);
const forced = params.has('p') ? Number(params.get('p')) : null; // ?p=0.8 pins the story (handy for screenshots)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Anchor points on the 3D figure (local space) that the DOM tags follow. */
const [bx, by] = HEAD_BRAIN;
const ANCHORS = {
  adenosine: [bx - 0.6, by + 0.3, 0.3],
  caffeine: [bx - 0.68, by - 0.05, 0.3],
  cortex: [0.62, by + 0.4, 0.2],
  nerves: [-0.42, -1.55, 0.9],
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
    scrollToProgress(Number(a.dataset.scrollJourney) + 0.02);
  })
);

/* Text chapters + tags react to progress; this is cheap DOM work and runs on every scroll tick. */
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

function start() {
  const quality = params.get('q') || pickQuality();

  let story;
  return import('./scene/story.js')
    .then(({ createStory }) => {
      story = createStory({ canvas, quality, mirror: document.documentElement.dir === 'ltr' });
    })
    .then(() => {
      root.classList.add('webgl');
      const tick = () => {
        const p = journeyProgress();
        story.setProgress(p);
        syncUI(p);
      };
      tick();
      story.renderStill(forced ?? journeyProgress());
      addEventListener('scroll', tick, { passive: true });
      addEventListener('resize', tick);

      if (!reduceMotion) {
        addEventListener(
          'pointermove',
          (e) => story.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
          { passive: true }
        );
      }

      // only spend GPU time while the journey is on screen
      const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? story.start() : story.stop()), {
        rootMargin: '200px 0px',
      });
      io.observe(journey);
      // particles gather once the intro loader has lifted
      ready.then(() => story.reveal());
      document.addEventListener('visibilitychange', () => (document.hidden ? story.stop() : tick()));

      // DOM tags track their 3D anchor points
      const place = () => {
        const p = journeyProgress();
        for (const t of tags) {
          const on = p >= Number(t.dataset.start) && p < Number(t.dataset.end);
          t.hidden = false;
          t.classList.toggle('is-on', on);
          if (!on) continue;
          const pt = story.project(ANCHORS[t.dataset.tag]);
          t.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
        }
        requestAnimationFrame(place);
      };
      requestAnimationFrame(place);
    });
}

if (!canWebGL()) {
  root.classList.add('no-webgl');
} else {
  hold(start()).catch((err) => {
    console.error('3D story failed, falling back to static layout', err);
    root.classList.add('no-webgl');
  });
}
