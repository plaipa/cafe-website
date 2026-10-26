import * as THREE from 'three';
import { createSet } from './set.js';
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

/* Scroll progress → shot. Camera keys are [targetX, targetY, targetZ, radius, azimuth°, elevation°]. */
const STORY = {
  camera: [
    [0, [0.15, 0.17, -0.06, 1.55, 2, 8]], // intro: the still life
    [0.1, [0.1, 0.09, 0.02, 0.95, 4, 14]],
    [0.3, [0.1, 0.075, 0.08, 0.78, 26, 13]], // 01 beans rain onto the steel
    [0.42, [0.0, 0.09, 0.03, 0.52, -6, 6]], // 02 the cup
    [0.52, [0.02, 0.095, 0.02, 0.54, -12, 7]],
    [0.66, [0.31, 0.34, -0.16, 0.62, -20, 2]], // 03 the bust, in tired light
    [0.75, [0.29, 0.34, -0.14, 0.64, -16, 3]],
    [0.86, [0.17, 0.29, -0.03, 0.82, -4, 4]], // 04 caffeine travels from the cup to the head
    [0.94, [0.12, 0.17, -0.04, 1.5, 3, 10]], // 05 the whole picture
    [1, [0.12, 0.17, -0.04, 1.56, 4, 11]],
  ],
  beans: [[0, 0], [0.1, 0], [0.32, 1], [1, 1]],
  mood: [[0, 0.9], [0.55, 0.9], [0.63, 0.12], [0.76, 0.12], [0.88, 1], [1, 1]],
  assembly: [[0, 0], [0.76, 0], [0.88, 1], [1, 1]],
  molSize: [[0, 0], [0.75, 0], [0.78, 1], [0.94, 1], [1, 0.7]],
};

/** The home page story, driven by scroll progress. `side` puts the subject opposite the copy. */
export async function createJourney({ canvas, quality, side }) {
  const set = await createSet({ canvas, quality, side });
  const field = new MoleculeField({ max: 1, unit: 0.012, quality });
  set.scene.add(field);

  // the molecule's atoms rise out of the cup and gather beside the bust's face
  const straw = set.cup.userData.straw.clone().add(set.cup.position);
  const r = rng(12);
  const sources = CAFFEINE.atoms.map(() =>
    straw.clone().add(new THREE.Vector3((r() - 0.5) * 0.04, (r() - 0.5) * 0.04 - 0.05, (r() - 0.5) * 0.04))
  );
  const home = new THREE.Vector3(0.1 * set.mirror, 0.31, 0.06);

  let progress = 0;
  let shown = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  set.onFrame((dt, time) => {
    shown = dt >= 1 ? progress : lerp(shown, progress, 1 - Math.pow(0.0015, dt));
    const P = shown;
    const [tx, ty, tz, rad, az, el] = keyed(P, STORY.camera);
    set.orbit.target.set(tx * set.mirror, ty, tz);
    Object.assign(set.orbit, { r: rad, az: (az + Math.sin(time * 0.15) * 1.2) * set.mirror, el });
    set.beans.update(keyed(P, STORY.beans));
    set.setMood(keyed(P, STORY.mood), time);

    const size = keyed(P, STORY.molSize);
    field.visible = size > 0.001;
    if (field.visible) {
      e.set(0.3 + Math.sin(time * 0.4) * 0.15, time * 0.3 + P * 2, 0.1);
      m.compose(home, q.setFromEuler(e), one);
      field.set(0, m, { assembly: keyed(P, STORY.assembly), sources, size });
    }
  });

  const tmp = new THREE.Vector3();
  return {
    ...set,
    setProgress(p) {
      progress = p;
    },
    /** Screen position of an atom of the molecule (for the DOM labels). */
    atomOnScreen(index) {
      tmp.copy(field.atom(0, index));
      field.localToWorld(tmp);
      return set.project(tmp);
    },
    renderStill(p = progress) {
      progress = p;
      shown = p;
      set.renderOnce();
    },
  };
}

/* ───────────── inner pages ───────────── */
export async function createVignette({ canvas, quality, preset }) {
  const set = await createSet({ canvas, quality, side: 0 });
  set.setMood(1);
  let tick = () => {};
  let setMolecules = () => {};

  if (preset === 'cup') {
    // menu: the café's cup, slowly circling it
    set.orbit.target.set(0, 0.085, 0.03);
    Object.assign(set.orbit, { r: 0.5, el: 8 });
    tick = (dt, time) => {
      set.orbit.az = Math.sin(time * 0.18) * 28;
      set.setMood(1, time);
    };
  } else if (preset === 'still') {
    // about: the whole still life
    set.orbit.target.set(0.15, 0.17, -0.05);
    Object.assign(set.orbit, { r: 1.45, el: 9 });
    tick = (dt, time) => {
      set.orbit.az = 2 + Math.sin(time * 0.12) * 8;
      set.setMood(1, time);
    };
  } else if (preset === 'molecules') {
    // science: caffeine molecules hover over the cup; their number follows the caffeine level
    const MAX = 30;
    set.orbit.target.set(0.02, 0.17, 0);
    Object.assign(set.orbit, { r: 0.8, el: 6, az: 4 });
    const field = new MoleculeField({ max: MAX, unit: 0.0075, quality });
    set.scene.add(field);
    const r = rng(5);
    const drift = Array.from({ length: MAX }, () => ({
      p: new THREE.Vector3(-0.17 + r() * 0.36, 0.17 + r() * 0.2, -0.06 + r() * 0.12),
      spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      speed: 0.2 + r() * 0.5,
      phase: r() * 10,
      size: 0,
    }));
    let wanted = 0;
    setMolecules = (n) => (wanted = Math.max(0, Math.min(MAX, Math.round(n))));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    tick = (dt, time) => {
      set.orbit.az = 4 + Math.sin(time * 0.2) * 6;
      set.setMood(1, time);
      drift.forEach((d, i) => {
        const goal = i < wanted ? 1 : 0;
        d.size = dt >= 1 ? goal : lerp(d.size, goal, 1 - Math.pow(0.02, dt));
        if (d.size < 0.01) {
          field.hide(i);
          return;
        }
        pos.copy(d.p);
        pos.y += Math.sin(time * d.speed + d.phase) * 0.01;
        field.set(i, m.compose(pos, q.setFromAxisAngle(d.spin, time * d.speed + d.phase), one), { size: d.size });
      });
    };
  }

  set.onFrame((dt, time) => tick(dt, time));
  return {
    ...set,
    setMolecules: (n) => setMolecules(n),
    renderStill() {
      set.renderOnce();
    },
  };
}
