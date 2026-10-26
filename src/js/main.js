import '../css/base.css';
import '../css/components.css';
import { hold, ready } from './loader.js';
import { initParallax } from './parallax.js';

const root = document.documentElement;
root.classList.add('js');
if (document.fonts) hold(document.fonts.ready);

const lang = root.lang === 'en' ? 'en' : 'fa';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

/* ── Language: remember an explicit choice; gently offer English to non-Persian browsers ── */
const PREF = 'cc-lang';
const store = {
  get: () => {
    try {
      return localStorage.getItem(PREF);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(PREF, v);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  },
};
const switchLink = document.querySelector('[data-lang-switch]');
document.querySelectorAll('[data-lang-switch]').forEach((a) =>
  a.addEventListener('click', () => store.set(a.dataset.langSwitch))
);

if (lang === 'fa' && switchLink) {
  const pref = store.get();
  const browserSpeaksPersian = (navigator.languages || [navigator.language]).some((l) => /^fa\b/i.test(l));
  if (pref === 'en') {
    location.replace(switchLink.href);
  } else if (!pref && !browserSpeaksPersian) {
    const toast = document.createElement('div');
    toast.className = 'lang-suggest';
    toast.lang = 'en';
    toast.dir = 'ltr';
    toast.setAttribute('role', 'region');
    toast.setAttribute('aria-label', 'Language');
    toast.innerHTML = `<p>This site is in Persian. Prefer English?</p>
      <a class="btn btn--solid btn--small" href="${switchLink.href}" hreflang="en">English</a>
      <button type="button" aria-label="Stay on the Persian site">×</button>`;
    toast.querySelector('a').addEventListener('click', () => store.set('en'));
    toast.querySelector('button').addEventListener('click', () => {
      store.set('fa');
      toast.remove();
    });
    document.body.append(toast);
  }
}

/* ── Header: glass after scrolling; full-screen menu on small screens ── */
const header = document.getElementById('site-header');
const toggle = document.querySelector('.nav-toggle');
// the header takes the colours of whatever section is passing underneath it
const darkSections = [...document.querySelectorAll('.theme-dark:not(.loader)')];
const syncHeader = () => {
  header?.classList.toggle('is-scrolled', scrollY > 24);
  const probe = (header?.offsetHeight || 72) / 2;
  const overDark = darkSections.some((s) => {
    const r = s.getBoundingClientRect();
    return r.top <= probe && r.bottom > probe;
  });
  header?.classList.toggle('theme-dark', overDark);
};
syncHeader();
addEventListener('scroll', syncHeader, { passive: true });
addEventListener('resize', syncHeader);

function setNav(open) {
  if (toggle) {
    const r = toggle.getBoundingClientRect();
    root.style.setProperty('--toggle-x', `${r.left + r.width / 2}px`);
  }
  root.classList.toggle('nav-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
}
toggle?.addEventListener('click', () => setNav(!root.classList.contains('nav-open')));
document.querySelectorAll('#site-nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
addEventListener('keydown', (e) => e.key === 'Escape' && setNav(false));

/* ── Split headlines into words (keeps <em>, <br> etc.) so they can rise out of a mask ── */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(' ');
            continue;
          }
          const outer = document.createElement('span');
          outer.className = 'split-w';
          const inner = document.createElement('span');
          inner.style.setProperty('--i', i++);
          inner.textContent = part;
          outer.append(inner);
          frag.append(outer);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}
// [data-split] reveals on scroll; [data-split-manual] is revealed by page code (e.g. the home acts)
if (!reduceMotion) document.querySelectorAll('[data-split], [data-split-manual]').forEach(splitWords);

/* ── Reveal on scroll ── */
export function observeReveals(scope = document) {
  const els = scope.querySelectorAll('[data-reveal]:not(.is-in), [data-split]:not(.is-in)');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
  );
  els.forEach((el) => io.observe(el));
}
// opening animations wait for the intro loader to lift
ready.then(() => {
  observeReveals();
  initParallax();
});

/* ── Magnetic buttons: a small pull toward the cursor ── */
if (finePointer && !reduceMotion) {
  document.querySelectorAll('.btn, .lang-switch').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.transition = 'transform 0.15s linear, background 0.3s, color 0.3s, border-color 0.3s';
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
      el.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s, color 0.3s, border-color 0.3s';
    });
  });
}

export { lang, reduceMotion };
