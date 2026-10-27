import * as THREE from 'three';
import { createStudio } from './studio.js';
import { createGlass } from './glass.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** Interpolate keyed values ([[p, value], …]); values may be numbers, arrays or CSS hex colours. */
function keyed(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      const e = smooth((p - p0) / (p1 - p0));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], e));
      if (typeof v0 === 'string') return mixHex(v0, v1, e);
      return lerp(v0, v1, e);
    }
  }
  return keys[keys.length - 1][1];
}
const ca = new THREE.Color();
const cb = new THREE.Color();
const mixHex = (a, b, t) => `#${ca.set(a).lerp(cb.set(b), t).getHexString()}`;

/** The latte the home page builds, bottom up. */
export const LATTE = [
  ['espresso', 36],
  ['crema', 5],
  ['milk', 140],
  ['foam', 22],
];

/* Scroll progress → shot. Camera keys are [targetY, radius, azimuth°, elevation°]. */
export const STORY = {
  camera: [
    [0, [0.07, 0.62, 0, 7]], // cover: the empty glass in front of the name
    [0.1, [0.07, 0.62, 0, 7]],
    [0.17, [0.065, 0.5, -24, 12]], // 01 the glass
    [0.3, [0.03, 0.34, 12, 24]], // 02 espresso, close and from above
    [0.38, [0.035, 0.36, 18, 20]],
    [0.5, [0.06, 0.42, 26, 12]], // 03 milk
    [0.64, [0.1, 0.34, 32, 50]], // 04 foam: look into the glass at the heart
    [0.69, [0.1, 0.36, 36, 46]],
    [0.8, [0.165, 0.98, -14, 12]], // 05 anatomy, exploded
    [0.88, [0.165, 1.0, -6, 13]],
    [0.96, [0.07, 0.6, 6, 9]], // the whole cup again
  ],
  // how much of each layer has been poured
  fills: [
    [[0, 0], [0.22, 0], [0.34, 1]], // espresso
    [[0, 0], [0.34, 0], [0.39, 1]], // crema
    [[0, 0], [0.43, 0], [0.55, 1]], // milk
    [[0, 0], [0.59, 0], [0.67, 1]], // foam
  ],
  explode: [[0, 0], [0.72, 0], [0.8, 1], [0.89, 1], [0.95, 0]],
  // each chapter is shot against its own colour, like spreads in a magazine
  background: [
    [0, '#efe9df'],
    [0.1, '#efe9df'],
    [0.16, '#e3e4df'],
    [0.26, '#ead2c0'],
    [0.38, '#ead2c0'],
    [0.46, '#f2eee7'],
    [0.56, '#f2eee7'],
    [0.62, '#efe4bf'],
    [0.7, '#efe4bf'],
    [0.76, '#d3d9c9'],
    [0.9, '#d3d9c9'],
    [0.96, '#efe9df'],
  ],
  wordmark: [[0, 1], [0.06, 1], [0.13, 0]],
};

/**
 * A giant wordmark printed on the backdrop, always facing the camera and centred on screen.
 * It is opaque and coloured exactly like the backdrop, so the glass refracts the letters.
 */
async function createWordmark(studio, text) {
  if (document.fonts) await document.fonts.load('400 300px "Instrument Serif"').catch(() => {});
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 760;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ddd7ce';
  g.font = '400 690px "Instrument Serif", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height * 0.56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const strength = { value: 1 };
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uStrength = strength;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uStrength;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        'vec4 texel = texture2D( map, vMapUv );\n diffuseColor.rgb *= mix( vec3( 1.0 ), texel.rgb, uStrength );'
      );
  };
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, c.height / c.width), mat);
  studio.scene.add(plane);
  const ndc = new THREE.Vector3();
  const dir = new THREE.Vector3();
  return {
    set(s, color) {
      strength.value = s;
      mat.color.set(color);
      plane.visible = s > 0.002;
    },
    /** Keep it behind the glass, square to the camera, filling the width of the screen. */
    follow(cam, distance) {
      ndc.set(0, 0.4, 0.5).unproject(cam);
      dir.copy(ndc).sub(cam.position).normalize();
      plane.position.copy(cam.position).addScaledVector(dir, distance);
      plane.quaternion.copy(cam.quaternion);
      const h = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);
      plane.scale.setScalar(Math.min(h * cam.aspect, h * 2.4) * 0.86);
    },
  };
}

/** The home page story, driven by scroll progress. `side`: which side the copy is on (see studio). */
export async function createJourney({ canvas, quality, side, wordmark = 'STRATA' }) {
  const studio = createStudio({ canvas, quality, side, background: STORY.background[0][1] });
  const glass = createGlass({ quality });
  glass.setDrink(LATTE);
  studio.scene.add(glass);
  const mark = await createWordmark(studio, wordmark);

  let progress = 0;
  let shown = 0;
  studio.onFrame((dt, time) => {
    shown = dt >= 1 ? progress : lerp(shown, progress, 1 - Math.pow(0.002, dt));
    const P = shown;
    const [ty, r, az, el] = keyed(P, STORY.camera);
    studio.orbit.target.set(0, ty, 0);
    Object.assign(studio.orbit, { r, az: az + Math.sin(time * 0.2) * 2, el });
    STORY.fills.forEach((keys, i) => (glass.fills[i] = keyed(P, keys)));
    glass.setExplode(keyed(P, STORY.explode));
    glass.rotation.y = time * 0.05 + P * 1.2;
    glass.update(1);
    const bg = keyed(P, STORY.background);
    studio.setBackground(bg);
    studio.setContact(0.05, 1 - glass.getExplode() * 0.6);
    mark.set(keyed(P, STORY.wordmark), bg);
  });
  // the wordmark follows the camera once it has moved for this frame
  studio.onCamera(() => mark.follow(studio.camera, studio.orbit.r + 0.45));

  const out = new THREE.Vector3();
  return {
    ...studio,
    glass,
    setProgress(p) {
      progress = p;
    },
    /** Page background that matches the backdrop at the current progress. */
    backgroundAt: (p) => keyed(p, STORY.background),
    /** Screen position of the edge of layer `i` (or the glass when i < 0), on the side away from the copy. */
    labelOnScreen(i) {
      const dir = studio.screenRight().clone().multiplyScalar(side || 1);
      const p = i < 0 ? glass.glassAnchor(dir, out) : glass.anchor(i, dir, out);
      return studio.project(p);
    },
    renderStill(p = progress) {
      progress = p;
      shown = p;
      studio.renderOnce();
    },
  };
}

/* ───────────── inner pages ───────────── */
export async function createVignette({ canvas, quality, preset }) {
  const studio = createStudio({ canvas, quality, side: 0, background: canvas.dataset.bg || '#efe9df' });
  const glass = createGlass({ quality });
  studio.scene.add(glass);
  let explodeTarget = 0;
  let explode = 0;

  if (preset === 'about') {
    glass.setDrink(LATTE);
    explodeTarget = 1;
    studio.orbit.target.set(0, 0.165, 0);
    Object.assign(studio.orbit, { r: 1.0, el: 12 });
  } else {
    // menu: a glass that rebuilds itself as whichever drink is chosen
    studio.orbit.target.set(0, 0.07, 0);
    Object.assign(studio.orbit, { r: 0.58, el: 11 });
  }

  studio.onFrame((dt, time) => {
    explode = dt >= 1 ? explodeTarget : lerp(explode, explodeTarget, 1 - Math.pow(0.01, dt));
    glass.setExplode(explode);
    glass.rotation.y = time * 0.12;
    studio.orbit.az = Math.sin(time * 0.15) * 10;
    if (preset !== 'about') {
      studio.orbit.target.y = lerp(0.07, 0.165, explode);
      studio.orbit.r = lerp(0.58, 1.0, explode);
    }
    glass.update(dt);
    studio.setContact(0.05, 1 - explode * 0.6);
  });

  return {
    ...studio,
    glass,
    setDrink: (layers) => glass.setDrink(layers),
    setExplode: (e) => (explodeTarget = e),
    setBackground: (c) => studio.setBackground(c),
    renderStill() {
      studio.renderOnce();
    },
  };
}
