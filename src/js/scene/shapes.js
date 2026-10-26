/** Small procedural helpers: a seeded RNG and the coffee-bean surface. */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ───────────────────────────── Bean ───────────────────────────── */

/** Map a unit-sphere direction onto the surface of a coffee bean (with its centre crease). */
export function beanSurface(ux, uy, uz, out = [0, 0, 0]) {
  let x = ux * 1.5;
  const y = uy * 1.0;
  let z = uz * 0.82;
  if (uz > 0) {
    const crease = 0.17 * Math.sin(x * 1.9 + 0.3);
    const d = y - crease;
    const ends = 1 - Math.pow(Math.min(1, Math.abs(x) / 1.5), 5);
    const depth = 0.2 * Math.exp(-(d * d) / (2 * 0.052 * 0.052)) * ends * smooth(0.05, 0.45, uz);
    // a soft ridge on either side of the crease, like a real roasted bean
    const lip = 0.035 * Math.exp(-Math.pow((Math.abs(d) - 0.14) / 0.07, 2)) * ends * smooth(0.05, 0.45, uz);
    z += lip - depth;
  }
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
