import { observeReveals } from './main.js';
import '../css/pages.css';
import { mountScene } from './scene/mount.js';

mountScene(document.querySelector('[data-scene]'), 'cup');

/* Category filter: fade groups out, swap, fade the survivors back in */
const chips = [...document.querySelectorAll('[data-filter]')];
const groups = [...document.querySelectorAll('.menu-group')];
const bar = document.querySelector('.menu-bar');

function apply(filter) {
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
  groups.forEach((g) => g.classList.add('is-out'));
  setTimeout(() => {
    groups.forEach((g) => (g.hidden = filter !== 'all' && g.dataset.cat !== filter));
    const top = bar.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(bar).top);
    if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
    requestAnimationFrame(() => groups.forEach((g) => g.classList.remove('is-out')));
  }, 280);
}
chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter)));

groups.forEach((g) => g.setAttribute('data-reveal', ''));
observeReveals();
