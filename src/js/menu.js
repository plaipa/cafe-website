import { observeReveals } from './main.js';
import '../css/pages.css';
import { crossSection } from '../../partials/render.js';
import { glass, kinds } from '../../partials/menu-data.js';

/* The large drawing beside the list is redrawn as whichever drink is on show;
   its layers pour in from the bottom up, and can be pulled apart. */

const drinks = [...document.querySelectorAll('.drink')];
const figure = document.querySelector('[data-figure]');
const nameEl = document.querySelector('[data-current-name]');
const explodeBtn = document.querySelector('[data-explode]');
let current = null;

/** Draw `el`'s drink in the large figure and mark it as the one on show. */
function show(el) {
  if (!el || el === current) return;
  current = el;
  const name = el.querySelector('.drink__name').firstChild.textContent.trim();
  drinks.forEach((d) => d.classList.toggle('is-current', d === el));
  nameEl.textContent = name;
  figure.innerHTML = crossSection(JSON.parse(el.dataset.layers), { glass, kinds }, { label: name });
  // restart the pour
  figure.classList.remove('is-pouring');
  void figure.offsetWidth;
  figure.classList.add('is-pouring');
}

show(document.getElementById(location.hash.slice(1)) || drinks.find((d) => d.dataset.drink === 'latte'));

// whichever drink crosses the middle of the screen is drawn
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
  figure.classList.toggle('is-exploded', on);
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
