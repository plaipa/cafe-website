/* Small helpers for putting a live 3D scene on an inner page. */
import { hold } from '../loader.js';

export function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Phones, touch devices and low-core machines get a lighter renderer (resolution, shadows, transmission). */
export function pickQuality() {
  const forced = new URLSearchParams(location.search).get('q');
  if (forced === 'low' || forced === 'high') return forced;
  const weak = innerWidth < 760 || matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  return weak ? 'low' : 'high';
}

/**
 * Mount an inner-page vignette ('menu' | 'about') into `host`
 * (an element containing a <canvas>). Renders only while visible; follows the pointer.
 * Resolves to the scene, or null without WebGL.
 */
export async function mountScene(host, preset) {
  const canvas = host?.querySelector('canvas');
  if (!canvas || !canWebGL()) {
    host?.classList.add('is-static');
    return null;
  }
  // the intro loader waits for the scene and its assets
  const scene = await hold(
    import('./story.js').then(({ createVignette }) => createVignette({ canvas, quality: pickQuality(), preset }))
  );
  scene.renderStill();
  host.classList.add('is-ready');

  new IntersectionObserver(([e]) => (e.isIntersecting ? scene.start() : scene.stop()), { rootMargin: '100px' }).observe(host);
  document.addEventListener('visibilitychange', () => document.hidden && scene.stop());
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener(
      'pointermove',
      (e) => scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
      { passive: true }
    );
  }
  return scene;
}
