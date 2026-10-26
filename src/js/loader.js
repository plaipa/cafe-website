/* Intro loader: a cup fills with coffee as the page's fonts and 3D assets arrive,
   then lifts like a curtain. Shown once per session; later pages open straight away. */

const root = document.documentElement;
const el = document.getElementById('loader');
const pctEl = document.getElementById('loader-pct');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const active = !!el && root.classList.contains('js') && !root.classList.contains('seen');

const MIN_MS = 1200; // long enough to read as intentional, short enough not to annoy
const MAX_MS = 9000; // never hold the page hostage to a slow network

let pending = 0;
let settled = 0;
let assets = { loaded: 0, total: 0 };
let resolveReady;
/** Resolves when the page is ready to play its opening animations. */
export const ready = new Promise((r) => (resolveReady = r));

/** Keep the loader up until `promise` settles (its result is passed through). */
export function hold(promise) {
  if (!active) return promise;
  pending++;
  const done = () => settled++;
  promise.then(done, done);
  return promise;
}

/** Byte-agnostic progress from the 3D loading manager. */
export function reportAssets(loaded, total) {
  assets = { loaded, total };
}

function finish() {
  root.classList.add('loaded');
  resolveReady();
}

if (!active) {
  el?.remove();
  finish();
} else {
  const t0 = performance.now();
  let shown = 0;
  let closing = false;

  const frame = (now) => {
    const elapsed = now - t0;
    const tasks = pending ? settled / pending : 1;
    const files = assets.total ? assets.loaded / assets.total : tasks;
    // a slow creep keeps the bar alive while a big file downloads
    const creep = Math.min(0.85, elapsed / 6000);
    const target = Math.max(creep, 0.5 * tasks + 0.5 * files);
    const allDone = settled >= pending && elapsed > MIN_MS;
    shown += ((allDone ? 1 : Math.min(target, 0.96)) - shown) * (allDone ? 0.18 : 0.06);
    el.style.setProperty('--fill', shown.toFixed(3));
    pctEl.textContent = new Intl.NumberFormat(root.lang === 'en' ? 'en-US' : 'fa-IR').format(Math.round(shown * 100));

    if ((allDone && shown > 0.995) || elapsed > MAX_MS) {
      if (!closing) close();
      return;
    }
    requestAnimationFrame(frame);
  };

  function close() {
    closing = true;
    el.style.setProperty('--fill', '1');
    setTimeout(
      () => {
        el.classList.add('is-out');
        finish();
        try {
          sessionStorage.setItem('jaan-seen', '1');
        } catch {
          /* private mode */
        }
        setTimeout(() => el.remove(), 1400);
      },
      reduceMotion ? 0 : 280
    );
  }

  requestAnimationFrame(frame);
}
