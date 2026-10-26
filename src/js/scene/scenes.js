import * as THREE from 'three';
import { createWorld } from './world.js';
import {
  createBeanBurst,
  createBeanScatter,
  createCup,
  createDrop,
  createPortafilter,
  createRibbons,
  createShadowCatcher,
  createSteam,
  createStreams,
} from './props.js';
import { MoleculeField } from './molecule.js';
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

/* Scroll progress → shot. Three acts: the drop (0–⅓), the extraction (⅓–⅔), the reward (⅔–1). */
const ACTS = {
  camera: [
    // [radius, azimuth°, elevation°, targetY]
    [0, [0.62, 0, 4, 0]],
    [0.3, [0.6, -6, 6, 0]],
    [0.42, [0.64, -18, 10, 0]],
    [0.62, [0.7, -28, 12, 0]],
    [0.76, [0.54, 0, 6, -0.03]],
    [1, [0.5, 6, 8, -0.03]],
  ],
  dropY: [[0, -0.085], [0.26, -0.085], [0.38, 0.55]],
  dropSpin: [[0, 0], [0.38, 2.2]],
  ribbons: [[0, 1], [0.24, 1], [0.36, 0]],
  // portafilter: [x, y, rotX, rotY, rotZ]
  porta: [
    [0, [0, 0.6, 0.5, -0.6, 0.2]],
    [0.3, [0, 0.6, 0.5, -0.6, 0.2]],
    [0.42, [0, 0.01, 0.42, -0.75, 0.12]],
    [0.62, [0, 0.02, 0.32, -1.1, 0.05]],
    [0.76, [0, 0.045, 0, 0.35, 0]],
    [1, [0, 0.045, 0, 0.5, 0]],
  ],
  burst: [[0, 0], [0.36, 0], [0.58, 1], [0.66, 1.15], [0.76, 2.6]],
  cupY: [[0, -0.6], [0.64, -0.6], [0.78, -0.115]],
  pour: [[0, 0], [0.76, 0], [0.84, 1]],
  steam: [[0, 0], [0.86, 0], [1, 1]],
};

/** The home page story, driven by scroll progress. `side` puts the subject opposite the copy. */
export async function createJourney({ canvas, quality, side }) {
  const world = await createWorld({ canvas, quality, side: side * 0.25 });
  const { scene } = world;
  const high = quality === 'high';

  const drop = createDrop({ quality });
  scene.add(drop);
  const ribbons = createRibbons({ quality, count: high ? 3 : 2 });
  ribbons.position.set(side * 0.17, 0, -0.1);
  scene.add(ribbons);

  const porta = createPortafilter();
  scene.add(porta);
  const burst = createBeanBurst({ quality, count: high ? 170 : 90 });
  scene.add(burst);

  const cup = createCup({ crema: { swirl: true } });
  cup.rotation.y = -0.5;
  scene.add(cup);
  const streams = createStreams(2);
  scene.add(streams);
  const steam = createSteam();
  scene.add(steam);

  let progress = 0;
  let shown = 0;
  const tips = [new THREE.Vector3(), new THREE.Vector3()];
  world.onFrame((dt, time) => {
    shown = dt >= 1 ? progress : lerp(shown, progress, 1 - Math.pow(0.0015, dt));
    const P = shown;
    const [r, az, el, ty] = keyed(P, ACTS.camera);
    Object.assign(world.orbit, { r, az: az + Math.sin(time * 0.2) * 1.5, el, ty });

    // act 1 — the drop, bobbing, with caramel flowing beside it
    const dy = keyed(P, ACTS.dropY);
    drop.visible = dy < 0.5;
    drop.position.y = dy + Math.sin(time * 0.9) * 0.004;
    drop.rotation.y = time * 0.25 + keyed(P, ACTS.dropSpin);
    drop.userData.crema.rotation.z = time * 0.15;
    const ra = keyed(P, ACTS.ribbons);
    ribbons.visible = ra > 0.01;
    if (ribbons.visible) ribbons.update(time, ra);

    // act 2 — the portafilter arrives and beans burst around it
    const [px, py, rx, ry, rz] = keyed(P, ACTS.porta);
    porta.position.set(px, py + Math.sin(time * 0.7) * 0.003 * (P < 0.7 ? 1 : 0), 0);
    porta.rotation.set(rx, ry, rz);
    porta.visible = py < 0.55;
    const e = keyed(P, ACTS.burst);
    burst.visible = e > 0.001 && e < 2.5;
    burst.position.copy(porta.position);
    if (burst.visible) burst.update(e, time);

    // act 3 — the reward: espresso pours into the cup
    const cy = keyed(P, ACTS.cupY);
    cup.visible = cy > -0.55;
    cup.position.y = cy;
    cup.userData.coffee.rotation.z = time * 0.2;
    const pour = keyed(P, ACTS.pour);
    porta.updateMatrixWorld();
    porta.userData.spouts.forEach((s, i) => tips[i].copy(s).applyMatrix4(porta.matrixWorld));
    streams.place(tips, cy + cup.userData.level, pour, time);
    steam.position.set(0, cy + cup.userData.level, 0);
    steam.update(time, world.camera, keyed(P, ACTS.steam));
  });

  return {
    ...world,
    setProgress(p) {
      progress = p;
    },
    renderStill(p = progress) {
      progress = p;
      shown = p;
      world.renderOnce();
    },
  };
}

/* ───────────── inner pages ───────────── */
export async function createVignette({ canvas, quality, preset }) {
  const world = await createWorld({ canvas, quality, side: 0 });
  const { scene } = world;
  let tick = () => {};
  let setMolecules = () => {};

  if (preset === 'cup') {
    // menu: a cup with a poured heart, beans around it, slowly turning
    scene.add(createShadowCatcher(3, 0.5));
    const cup = createCup({ crema: { swirl: false, heart: true } });
    cup.rotation.y = -0.6;
    scene.add(cup, createBeanScatter({ quality, count: 14 }));
    const steam = createSteam();
    steam.position.y = cup.userData.level;
    scene.add(steam);
    Object.assign(world.orbit, { r: 0.36, az: 20, el: 28, ty: 0.035 });
    tick = (dt, time) => {
      world.orbit.az = 20 + time * 6;
      steam.update(time, world.camera, 1);
    };
  } else if (preset === 'pour') {
    // about: espresso pouring from the portafilter into the cup, on a loop
    const porta = createPortafilter();
    porta.position.y = 0.045;
    porta.rotation.y = 0.45; // handle off to the side, slightly away from the viewer
    const cup = createCup({ crema: { swirl: true } });
    cup.position.y = -0.115;
    cup.rotation.y = -0.5;
    const streams = createStreams(2);
    const steam = createSteam();
    steam.position.y = cup.position.y + cup.userData.level;
    scene.add(porta, cup, streams, steam);
    Object.assign(world.orbit, { r: 0.5, az: 4, el: 6, ty: -0.03 });
    const tips = [new THREE.Vector3(), new THREE.Vector3()];
    tick = (dt, time) => {
      world.orbit.az = 4 + Math.sin(time * 0.2) * 10;
      porta.updateMatrixWorld();
      porta.userData.spouts.forEach((s, i) => tips[i].copy(s).applyMatrix4(porta.matrixWorld));
      streams.place(tips, cup.position.y + cup.userData.level, 1, time);
      cup.userData.coffee.rotation.z = time * 0.2;
      steam.update(time, world.camera, 0.8);
    };
  } else if (preset === 'molecules') {
    // science: caffeine molecules hover above a cup; their number follows the caffeine level
    const MAX = 30;
    const cup = createCup({ crema: { swirl: true } });
    cup.rotation.y = -0.5;
    const steam = createSteam();
    steam.position.y = cup.userData.level;
    scene.add(cup, steam);
    const field = new MoleculeField({ max: MAX, unit: 0.0075, quality });
    scene.add(field);
    Object.assign(world.orbit, { r: 0.66, az: 10, el: 10, ty: 0.15 });
    const r = rng(5);
    const drift = Array.from({ length: MAX }, () => {
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.7) * 0.19;
      return {
        p: new THREE.Vector3(Math.cos(a) * d, 0.1 + r() * 0.17, Math.sin(a) * d * 0.6),
        spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
        speed: 0.2 + r() * 0.5,
        phase: r() * 10,
        size: 0,
      };
    });
    let wanted = 0;
    setMolecules = (n) => (wanted = Math.max(0, Math.min(MAX, Math.round(n))));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    tick = (dt, time) => {
      world.orbit.az = 10 + Math.sin(time * 0.2) * 6;
      steam.update(time, world.camera, 0.6);
      drift.forEach((d, i) => {
        const goal = i < wanted ? 1 : 0;
        d.size = dt >= 1 ? goal : lerp(d.size, goal, 1 - Math.pow(0.02, dt));
        if (d.size < 0.01) {
          field.hide(i);
          return;
        }
        pos.copy(d.p);
        pos.y += Math.sin(time * d.speed + d.phase) * 0.012;
        q.setFromAxisAngle(d.spin, time * d.speed + d.phase);
        field.set(i, m.compose(pos, q, one), { size: d.size });
      });
    };
  }

  world.onFrame((dt, time) => tick(dt, time));
  return {
    ...world,
    setMolecules: (n) => setMolecules(n),
    renderStill() {
      world.renderOnce();
    },
  };
}
