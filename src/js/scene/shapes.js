/**
 * Procedural geometry for the "power of coffee" story.
 * Everything is generated from math – no model files – and every target
 * (bean → cup → head) is sampled to the same point count so the particle
 * system can morph between them.
 */

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

const TAU = Math.PI * 2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

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

function sphereDir(r, out) {
  const u = r() * 2 - 1;
  const t = r() * TAU;
  const s = Math.sqrt(1 - u * u);
  out[0] = s * Math.cos(t);
  out[1] = u;
  out[2] = s * Math.sin(t);
  return out;
}

export function sampleBean(n, seed = 1) {
  const r = rng(seed);
  const out = new Float32Array(n * 3);
  const d = [0, 0, 0];
  const p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    sphereDir(r, d);
    beanSurface(d[0], d[1], d[2], p);
    out.set(p, i * 3);
  }
  return out;
}

/* ───────────────────────────── Cup + steam ───────────────────────────── */

const CUP_OUTER = [
  [0.0, -1.02],
  [0.5, -1.02],
  [0.56, -0.98],
  [0.62, -0.78],
  [0.8, -0.34],
  [1.0, 0.06],
  [1.12, 0.38],
];
const CUP_INNER = [
  [1.06, 0.38],
  [0.94, 0.05],
  [0.74, -0.3],
  [0.6, -0.5],
];
const SAUCER = [
  [0.45, -1.06],
  [1.5, -1.06],
  [1.88, -0.97],
  [1.96, -0.92],
];

/** Pick a point on a surface of revolution (polyline profile) uniformly by area. */
function lathe(profile, r, out) {
  const w = [];
  let total = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    const len = Math.hypot(r1 - r0, y1 - y0);
    total += len * ((r0 + r1) / 2 + 0.02);
    w.push(total);
  }
  const pick = r() * total;
  let i = w.findIndex((v) => v >= pick);
  if (i < 0) i = w.length - 1;
  const [r0, y0] = profile[i];
  const [r1, y1] = profile[i + 1];
  const t = r();
  const rad = lerp(r0, r1, t);
  const a = r() * TAU;
  out[0] = rad * Math.cos(a);
  out[1] = lerp(y0, y1, t);
  out[2] = rad * Math.sin(a);
  return out;
}

export function sampleCup(n, seed = 2) {
  const r = rng(seed);
  const out = new Float32Array(n * 3);
  const p = [0, 0, 0];
  const SHIFT = 0.75; // centre the whole cup + steam column on the origin

  // share of points per part (sums to 1)
  const parts = [
    ['outer', 0.22],
    ['inner', 0.09],
    ['coffee', 0.14],
    ['rim', 0.02],
    ['saucer', 0.16],
    ['handle', 0.07],
    ['steam', 0.3],
  ];

  let i = 0;
  for (const [name, share] of parts) {
    const count = name === 'steam' ? n - i : Math.round(n * share);
    for (let k = 0; k < count && i < n; k++, i++) {
      switch (name) {
        case 'outer':
          lathe(CUP_OUTER, r, p);
          break;
        case 'inner':
          lathe(CUP_INNER, r, p);
          break;
        case 'rim': {
          const a = r() * TAU;
          const rad = lerp(1.06, 1.12, r());
          p[0] = rad * Math.cos(a);
          p[1] = 0.38;
          p[2] = rad * Math.sin(a);
          break;
        }
        case 'coffee': {
          const a = r() * TAU;
          const rad = Math.sqrt(r()) * 0.99;
          p[0] = rad * Math.cos(a);
          p[1] = 0.2;
          p[2] = rad * Math.sin(a);
          break;
        }
        case 'saucer':
          lathe(SAUCER, r, p);
          break;
        case 'handle': {
          // a "C"-shaped tube on the +x side of the cup
          const ang = (r() - 0.5) * 2 * 1.45;
          const R = 0.44;
          const cx = 1.0;
          const cy = -0.12;
          const tube = 0.085;
          const b = r() * TAU;
          const nx = Math.cos(ang);
          const ny = Math.sin(ang);
          p[0] = cx + (R + tube * Math.cos(b)) * nx;
          p[1] = cy + (R + tube * Math.cos(b)) * ny;
          p[2] = tube * Math.sin(b);
          break;
        }
        default: {
          // three braided strands of rising steam
          const strand = Math.floor(r() * 3);
          const t = Math.pow(r(), 0.85);
          const y = 0.5 + t * 2.1;
          const phi = t * 5.2 + strand * (TAU / 3);
          const rho = 0.1 + 0.3 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + t * 0.12;
          const jitter = 0.035 + 0.16 * t * t;
          p[0] = rho * Math.cos(phi) + (r() - 0.5) * jitter + Math.sin(t * 4 + strand) * 0.1 * t;
          p[1] = y;
          p[2] = rho * Math.sin(phi) + (r() - 0.5) * jitter;
        }
      }
      out[i * 3] = p[0];
      out[i * 3 + 1] = p[1] - SHIFT;
      out[i * 3 + 2] = p[2];
    }
  }
  return out;
}

/* ───────────────────────────── Head + bust ───────────────────────────── */

/**
 * The figure faces +x and is seen in profile from +z. For each height y we
 * store the front (xf) and back (xb) of the section and its half-width (w).
 * Cross-sections are super-ellipses that morph from head-round to shoulder-boxy.
 */
const FRONT = [
  [1.15, 0.05], [1.08, 0.3], [0.95, 0.52], [0.75, 0.66], [0.55, 0.7], [0.4, 0.68], [0.28, 0.6],
  [0.1, 0.76], [-0.08, 0.94], [-0.18, 1.02], [-0.27, 0.8], [-0.37, 0.76], [-0.46, 0.7],
  [-0.55, 0.73], [-0.68, 0.64], [-0.84, 0.68], [-1.0, 0.5], [-1.1, 0.28], [-1.22, 0.22],
  [-1.6, 0.3], [-2.0, 0.44], [-2.4, 0.72], [-2.8, 0.95],
];
const BACK = [
  [1.15, -0.05], [1.05, -0.55], [0.85, -0.86], [0.55, -0.99], [0.2, -0.97], [-0.1, -0.86],
  [-0.45, -0.7], [-0.8, -0.5], [-1.0, -0.42], [-1.3, -0.38], [-1.7, -0.46], [-2.0, -0.62],
  [-2.4, -0.82], [-2.8, -0.95],
];
const WIDTH = [
  [1.15, 0.0], [1.1, 0.28], [0.95, 0.52], [0.7, 0.68], [0.4, 0.75], [0.0, 0.73], [-0.4, 0.63],
  [-0.7, 0.5], [-1.0, 0.34], [-1.1, 0.24], [-1.25, 0.3], [-1.6, 0.33], [-1.9, 0.42],
  [-2.1, 0.78], [-2.35, 1.28], [-2.6, 1.68], [-2.8, 1.88],
];
const Y_MIN = -2.8;
const Y_MAX = 1.15;
const HEAD_SHIFT = 0.8; // lift so the bust is vertically centred in frame
export const HEAD_BRAIN = [-0.14, 0.55 + HEAD_SHIFT, 0];

function resample(keys, steps) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const y = lerp(Y_MIN, Y_MAX, i / steps);
    let j = 0;
    while (j < k.length - 2 && k[j + 1][0] < y) j++;
    const [y0, v0] = k[j];
    const [y1, v1] = k[j + 1];
    out[i] = lerp(v0, v1, Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1))));
  }
  // two box-blur passes round off the kinks of the hand-authored profile
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(out);
    const R = 7;
    for (let i = 0; i <= steps; i++) {
      let s = 0;
      let c = 0;
      for (let d = -R; d <= R; d++) {
        const q = Math.min(steps, Math.max(0, i + d));
        s += src[q];
        c++;
      }
      out[i] = s / c;
    }
  }
  return out;
}

const STEPS = 400;
const XF = resample(FRONT, STEPS);
const XB = resample(BACK, STEPS);
const HW = resample(WIDTH, STEPS);

const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function headSection(i, theta, out) {
  const y = lerp(Y_MIN, Y_MAX, i / STEPS);
  const xc = (XF[i] + XB[i]) / 2;
  const a = (XF[i] - XB[i]) / 2;
  const n = lerp(3.2, 2.05, smooth(-2.3, -1.2, y)); // boxier towards the shoulders
  const e = 2 / n;
  out[0] = xc + a * spow(Math.cos(theta), e);
  out[1] = y + HEAD_SHIFT;
  out[2] = HW[i] * spow(Math.sin(theta), e);
  return out;
}

export function sampleHead(n, seed = 3) {
  const r = rng(seed);
  // cumulative distribution over height, proportional to section perimeter
  const cdf = new Float32Array(STEPS + 1);
  let acc = 0;
  for (let i = 0; i <= STEPS; i++) {
    const a = (XF[i] - XB[i]) / 2;
    acc += Math.sqrt((a * a + HW[i] * HW[i]) / 2) + 0.01;
    cdf[i] = acc;
  }
  const out = new Float32Array(n * 3);
  const p = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const target = r() * acc;
    let lo = 0;
    let hi = STEPS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    headSection(lo, r() * TAU, p);
    out[k * 3] = p[0];
    out[k * 3 + 1] = p[1];
    out[k * 3 + 2] = p[2];
  }
  return out;
}

/* ───────────────────────────── Neural network ───────────────────────────── */

export const SPARK_ORIGIN = [0.38, 0.72 + HEAD_SHIFT, 0]; // where the "ignition" starts: the frontal lobe

/**
 * Nodes live inside the skull; edges are short curved fibres between near
 * neighbours, plus a spine and shoulder nerves so the glow can travel into the body.
 * Returns flat buffers ready for LineSegments / Points.
 */
export function buildNetwork({ nodes = 240, curveSegs = 7, seed = 7 } = {}) {
  const r = rng(seed);
  const pts = [];

  const inBrain = (cx, cy, cz, rx, ry, rz, count, shell = 0.55) => {
    for (let i = 0; i < count; i++) {
      const d = sphereDir(r, [0, 0, 0]);
      const rad = shell + (1 - shell) * Math.cbrt(r());
      pts.push([cx + d[0] * rx * rad, cy + d[1] * ry * rad, cz + d[2] * rz * rad, 'brain']);
    }
  };
  inBrain(-0.14, 0.55 + HEAD_SHIFT, 0, 0.68, 0.46, 0.56, nodes);
  inBrain(-0.62, 0.02 + HEAD_SHIFT, 0, 0.22, 0.17, 0.3, Math.round(nodes * 0.12)); // cerebellum

  const brainCount = pts.length;

  // spine: brain stem down through the neck into the back
  const spine = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const y = lerp(-0.1, -2.6, t) + HEAD_SHIFT;
    const x = lerp(-0.48, -0.42, t) + Math.sin(t * 5) * 0.03;
    spine.push(pts.length);
    pts.push([x, y, 0, 'spine']);
  }
  // shoulder nerves branching sideways from the upper spine
  const branches = [];
  for (const side of [-1, 1]) {
    let prev = spine[15];
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const idx = pts.length;
      pts.push([-0.42 + t * 0.18, -2.1 + HEAD_SHIFT - t * 0.38, side * t * 1.55, 'nerve']);
      branches.push([prev, idx]);
      prev = idx;
    }
  }

  // k-nearest edges inside the brain
  const edges = [];
  const seen = new Set();
  const addEdge = (a, b) => {
    const key = a < b ? a * 10000 + b : b * 10000 + a;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };
  for (let i = 0; i < brainCount; i++) {
    const near = [];
    for (let j = 0; j < brainCount; j++) {
      if (i === j) continue;
      const dx = pts[i][0] - pts[j][0];
      const dy = pts[i][1] - pts[j][1];
      const dz = pts[i][2] - pts[j][2];
      near.push([dx * dx + dy * dy + dz * dz, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) addEdge(i, near[k][1]);
    if (r() < 0.12) addEdge(i, near[4 + Math.floor(r() * 8)][1]); // a few long-range links
  }
  for (let i = 0; i < spine.length - 1; i++) addEdge(spine[i], spine[i + 1]);
  edges.push(...branches);
  // the brain stem connects to the spine
  addEdge(brainCount - 1, spine[0]);
  addEdge(Math.floor(brainCount * 0.5), spine[0]);

  // distance from the spark origin along the network, normalised to 0..1 (drives the ignition wave)
  const dist = (p) => Math.hypot(p[0] - SPARK_ORIGIN[0], p[1] - SPARK_ORIGIN[1], p[2] - SPARK_ORIGIN[2]);
  const maxD = Math.max(...pts.map(dist));

  const segs = edges.length * curveSegs;
  const pos = new Float32Array(segs * 2 * 3);
  const aT = new Float32Array(segs * 2);
  const aPhase = new Float32Array(segs * 2);
  const aD = new Float32Array(segs * 2);
  let o = 0;
  for (const [ia, ib] of edges) {
    const A = pts[ia];
    const B = pts[ib];
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const bend = A[3] === 'brain' ? len * 0.35 : len * 0.05;
    const c = [mid[0] + (r() - 0.5) * bend, mid[1] + (r() - 0.5) * bend, mid[2] + (r() - 0.5) * bend];
    const phase = r();
    const d0 = dist(A) / maxD;
    const d1 = dist(B) / maxD;
    const at = (t) => {
      const u = 1 - t;
      return [
        u * u * A[0] + 2 * u * t * c[0] + t * t * B[0],
        u * u * A[1] + 2 * u * t * c[1] + t * t * B[1],
        u * u * A[2] + 2 * u * t * c[2] + t * t * B[2],
      ];
    };
    for (let s = 0; s < curveSegs; s++) {
      for (const t of [s / curveSegs, (s + 1) / curveSegs]) {
        pos.set(at(t), o * 3);
        aT[o] = t;
        aPhase[o] = phase;
        aD[o] = lerp(d0, d1, t);
        o++;
      }
    }
  }

  const nodePos = new Float32Array(pts.length * 3);
  const nodeD = new Float32Array(pts.length);
  const nodeSeed = new Float32Array(pts.length);
  pts.forEach((p, i) => {
    nodePos.set(p.slice(0, 3), i * 3);
    nodeD[i] = dist(p) / maxD;
    nodeSeed[i] = r();
  });

  return { pos, aT, aPhase, aD, nodePos, nodeD, nodeSeed };
}
