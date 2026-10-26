/* Small helpers for putting a live 3D scene on an inner page. */

export function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Phones, touch devices and low-core machines get fewer particles and no bloom. */
export function pickQuality() {
  const weak = innerWidth < 760 || matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  return weak ? 'low' : 'high';
}

/**
 * Mount a centered scene into `host` (an element containing a <canvas>).
 * Renders only while visible; follows the pointer. Resolves to the story API, or null without WebGL.
 */
export async function mountScene(host, preset) {
  const canvas = host?.querySelector('canvas');
  if (!canvas || !canWebGL()) {
    host?.classList.add('is-static');
    return null;
  }
  const { createStory } = await import('./story.js');
  const quality = new URLSearchParams(location.search).get('q') || pickQuality();
  const story = createStory({
    canvas,
    quality,
    mirror: document.documentElement.dir === 'ltr',
    framing: 'center',
    preset,
  });
  story.renderStill();
  story.reveal();
  host.classList.add('is-ready');

  new IntersectionObserver(([e]) => (e.isIntersecting ? story.start() : story.stop()), { rootMargin: '100px' }).observe(host);
  document.addEventListener('visibilitychange', () => document.hidden && story.stop());
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener(
      'pointermove',
      (e) => story.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
      { passive: true }
    );
  }
  return story;
}
