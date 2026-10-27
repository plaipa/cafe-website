import { observeReveals } from './main.js';
import '../css/pages.css';
import { mountScene } from './scene/mount.js';

const drinks = [...document.querySelectorAll('.drink')];
const nameEl = document.querySelector('[data-current-name]');
const explodeBtn = document.querySelector('[data-explode]');
let scene = null;
let current = null;

/** Build `el`'s drink in the 3D glass and mark it as the one on show. */
function show(el) {
  if (!el || el === current) return;
  current = el;
  drinks.forEach((d) => d.classList.toggle('is-current', d === el));
  nameEl.textContent = el.querySelector('.drink__name').firstChild.textContent.trim();
  scene?.setDrink(JSON.parse(el.dataset.layers));
}

mountScene(document.querySelector('[data-scene]'), 'menu').then((s) => {
  scene = s;
  const start = document.getElementById(location.hash.slice(1)) || drinks.find((d) => d.dataset.drink === 'latte');
  current = null;
  show(start);
  s?.renderStill();
});

// whichever drink crosses the middle of the screen is built in the glass
const io = new IntersectionObserver(
  (entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit) show(hit.target);
  },
  { rootMargin: '-45% 0px -45% 0px' }
);
drinks.forEach((d) => {
  io.observe(d);
  d.querySelector('.drink__build').addEventListener('click', () => show(d));
  d.addEventListener('pointerenter', () => matchMedia('(pointer: fine)').matches && show(d));
});

explodeBtn.addEventListener('click', () => {
  const on = explodeBtn.getAttribute('aria-pressed') !== 'true';
  explodeBtn.setAttribute('aria-pressed', String(on));
  scene?.setExplode(on ? 1 : 0);
});

/* Category filter: fade groups out, swap, fade the survivors back in */
const chips = [...document.querySelectorAll('[data-filter]')];
const groups = [...document.querySelectorAll('.menu-group')];
function apply(filter) {
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
  groups.forEach((g) => g.classList.add('is-out'));
  setTimeout(() => {
    groups.forEach((g) => (g.hidden = filter !== 'all' && g.dataset.cat !== filter));
    requestAnimationFrame(() => groups.forEach((g) => g.classList.remove('is-out')));
    show(groups.find((g) => !g.hidden)?.querySelector('.drink'));
  }, 260);
}
chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter)));

drinks.forEach((d) => d.setAttribute('data-reveal', ''));
observeReveals();
