import * as THREE from 'three';
import { buildTable, createWorld } from './world.js';
import { CAFFEINE, MoleculeField } from './molecule.js';
import { rng } from './shapes.js';

const lerp = (a, b, t) => a + (b - a) * t;
function keyed(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      const t = (p - p0) / (p1 - p0);
      const e = t * t * (3 - 2 * t);
      return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], e)) : lerp(v0, v1, e);
    }
  }
  return keys[keys.length - 1][1];
}

/* Scroll progress → shot. Camera keys are [r, azimuth°, elevation°, targetY]. */
const JOURNEY = {
  camera: [
    [0, [0.6, 26, 22, 0.05]],
    [0.1, [0.58, 30, 20, 0.05]],
    [0.3, [0.52, 44, 15, 0.04]],
    [0.42, [0.36, 58, 72, 0.06]],
    [0.5, [0.36, 70, 74, 0.06]],
    [0.6, [0.5, 24, 16, 0.15]],
    [0.72, [0.38, 8, 10, 0.19]],
    [0.86, [0.4, -12, 14, 0.19]],
    [0.94, [0.62, 14, 22, 0.1]],
    [1, [0.8, 22, 26, 0.07]],
  ],
  beans: [[0, 0], [0.1, 0], [0.32, 1], [1, 1]],
  steam: [[0, 1], [0.42, 1.25], [0.56, 0.7], [0.9, 0.7], [1, 1]],
  assembly: [[0, 0], [0.55, 0], [0.71, 1], [1, 1]],
  molSize: [[0, 0], [0.53, 0], [0.57, 1], [0.92, 1], [1, 0]],
  molY: [[0, 0.1], [0.55, 0.12], [0.7, 0.19], [0.92, 0.19], [1, 0.08]],
  sun: [[0, 2.6], [0.9, 2.6], [1, 3.2]],
};

/** The home page story, driven by scroll progress. */
export async function createJourney({ canvas, quality, side }) {
  const world = await createWorld({ canvas, quality, side });
  const set = await buildTable(world, { beans: quality === 'high' ? 34 : 22, croissant: true, quality, beanDrop: 0.55, side });

  const field = new MoleculeField({ max: 1, unit: 0.011, quality });
  world.scene.add(field);
  const r = rng(12);
  // atoms rise from random points on the coffee surface
  const sources = CAFFEINE.atoms.map(() => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * set.coffeeR * 0.8;
    return new THREE.Vector3(Math.cos(a) * d, set.coffeeY, Math.sin(a) * d);
  });

  let progress = 0;
  let shown = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  world.onFrame((dt, time) => {
    shown = dt >= 1 ? progress : lerp(shown, progress, 1 - Math.pow(0.0015, dt));
    const P = shown;
    const [rad, az, el, ty] = keyed(P, JOURNEY.camera);
    Object.assign(world.orbit, { r: rad, az: az + Math.sin(time * 0.15) * 2, el, ty });

    set.beans.update(keyed(P, JOURNEY.beans), time);
    set.steam.update(time, world.camera, keyed(P, JOURNEY.steam));
    world.sun.intensity = keyed(P, JOURNEY.sun);

    const size = keyed(P, JOURNEY.molSize);
    field.visible = size > 0.001;
    if (field.visible) {
      e.set(0.35 + Math.sin(time * 0.4) * 0.15, time * 0.35 + P * 3, 0.1);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(0, keyed(P, JOURNEY.molY), 0), q, new THREE.Vector3(1, 1, 1));
      field.set(0, m, { assembly: keyed(P, JOURNEY.assembly), sources, size });
    }
  });

  const tmp = new THREE.Vector3();
  return {
    ...world,
    setProgress(p) {
      progress = p;
    },
    /** Screen position of a named atom of the molecule (for DOM labels). */
    atomOnScreen(index) {
      tmp.copy(field.atom(0, index));
      field.localToWorld(tmp);
      return world.project(tmp);
    },
    renderStill(p = progress) {
      progress = p;
      shown = p;
      world.renderOnce();
    },
  };
}

/* ───────────── inner pages ───────────── */
const VIGNETTES = {
  // menu: the cup up close, slowly turning
  cup: { beans: 12, croissant: false, camera: [0.42, 30, 30, 0.04], spin: 7, ring: [0.09, 0.16] },
  // about: a little still life with a croissant
  still: { beans: 20, croissant: true, camera: [0.62, 18, 34, 0.03], spin: 0, sway: 10, ring: [0.1, 0.26] },
  // science: caffeine molecules floating above the cup; their number follows the caffeine level
  molecules: { beans: 0, croissant: false, camera: [0.66, 14, 12, 0.17], spin: 0, sway: 6, molecules: 30 },
};

export async function createVignette({ canvas, quality, preset }) {
  const cfg = VIGNETTES[preset];
  const world = await createWorld({ canvas, quality, side: 0 });
  const set = await buildTable(world, { beans: cfg.beans, croissant: cfg.croissant, quality, beanRing: cfg.ring });
  const [rad, az, el, ty] = cfg.camera;
  Object.assign(world.orbit, { r: rad, az, el, ty });

  let field = null;
  let wanted = 0;
  const shownSize = [];
  const drift = [];
  if (cfg.molecules) {
    field = new MoleculeField({ max: cfg.molecules, unit: 0.0075, quality });
    world.scene.add(field);
    const r = rng(5);
    for (let i = 0; i < cfg.molecules; i++) {
      // a loose cloud above the cup, denser near the middle
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.7) * 0.2;
      drift.push({
        p: new THREE.Vector3(Math.cos(a) * d, 0.1 + r() * 0.17, Math.sin(a) * d * 0.6),
        spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
        speed: 0.2 + r() * 0.5,
        phase: r() * 10,
      });
      shownSize.push(0);
    }
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  world.onFrame((dt, time) => {
    world.orbit.az = az + time * cfg.spin + (cfg.sway ? Math.sin(time * 0.2) * cfg.sway : 0);
    set.steam.update(time, world.camera, field ? 0.6 : 1);
    if (!field) return;
    drift.forEach((d, i) => {
      const goal = i < wanted ? 1 : 0;
      shownSize[i] = dt >= 1 ? goal : lerp(shownSize[i], goal, 1 - Math.pow(0.02, dt));
      if (shownSize[i] < 0.01) {
        field.hide(i);
        return;
      }
      pos.copy(d.p);
      pos.y += Math.sin(time * d.speed + d.phase) * 0.012;
      q.setFromAxisAngle(d.spin, time * d.speed + d.phase);
      m.compose(pos, q, one);
      field.set(i, m, { size: shownSize[i] });
    });
  });

  return {
    ...world,
    /** Science page: how many molecules to show (each stands for ~10 mg of caffeine). */
    setMolecules(n) {
      wanted = Math.max(0, Math.min(cfg.molecules || 0, Math.round(n)));
    },
    renderStill() {
      world.renderOnce();
    },
  };
}
