/* Layered parallax.
   data-parallax="0.1"  → drifts against the scroll (positive = slower than the page, negative = faster)
   data-depth="8"       → leans up to 8px with the pointer (negative leans away)
   Uses the CSS `translate` property, so it composes with reveal animations that use `transform`. */

export function initParallax() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = matchMedia('(pointer: fine)').matches;
  const items = [...document.querySelectorAll('[data-parallax], [data-depth]')].map((el) => ({
    el,
    speed: Number(el.dataset.parallax || 0),
    depth: fine ? Number(el.dataset.depth || 0) : 0,
    y: 0,
    x: 0,
    py: 0,
  }));
  if (!items.length) return;

  const pointer = { x: 0, y: 0 };
  let raf = 0;

  function frame() {
    raf = 0;
    const vh = innerHeight;
    let moving = false;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const top = r.top - it.y;
      if (top > vh + 300 || top + r.height < -300) continue;
      const scrollTarget = it.speed ? (top + r.height / 2 - vh / 2) * -it.speed : 0;
      const tx = pointer.x * it.depth;
      const ty = scrollTarget + pointer.y * it.depth;
      // ease towards the target for an inertial, buttery feel
      it.x += (tx - it.x) * 0.1;
      it.y += (ty - it.y) * 0.1;
      if (Math.abs(tx - it.x) > 0.05 || Math.abs(ty - it.y) > 0.05) moving = true;
      it.el.style.translate = `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px`;
    }
    if (moving) kick();
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  if (fine) {
    addEventListener(
      'pointermove',
      (e) => {
        pointer.x = (e.clientX / innerWidth) * 2 - 1;
        pointer.y = (e.clientY / innerHeight) * 2 - 1;
        kick();
      },
      { passive: true }
    );
  }
  kick();
}
