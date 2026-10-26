import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { beanSurface, rng } from './shapes.js';
import { reportAssets } from '../loader.js';
// assets are imported as URLs so they resolve from any page, including /en/
import bustUrl from '../../assets/marble_bust.glb?url';
import hdrUrl from '../../assets/studio_small_09_1k.hdr?url';
import plasterDiffUrl from '../../assets/plaster_diff.jpg?url';
import plasterNorUrl from '../../assets/plaster_nor.jpg?url';
import plasterRoughUrl from '../../assets/plaster_rough.jpg?url';

/* A small, real-world "set" in the spirit of Code Concept's photography:
   a brushed-steel table against a smooth concrete wall, window light with leaf
   shadows, roasted beans, the café's clear cup, and a marble bust.
   Units are metres; the table top sits at y = 0. */

THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => reportAssets(loaded, total);

const TAU = Math.PI * 2;
// laid out for left-to-right reading; mirrored on the x axis for Persian pages
const SPOTS = {
  beans: new THREE.Vector3(0.15, 0, 0.13),
  cup: new THREE.Vector3(0, 0, 0.03),
  bust: new THREE.Vector3(0.33, 0, -0.16),
};

/* ───────────── textures drawn on canvas ───────────── */
function canvasTexture(size, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Dappled window light: a light "cookie" with soft leaf silhouettes, projected by the sun lamp. */
function leafGobo() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, s, s);
    const r = rng(31);
    g.filter = 'blur(5px)';
    g.fillStyle = '#000';
    for (let i = 0; i < 46; i++) {
      // little branches of leaves
      const x = r() * s;
      const y = r() * s;
      const ang = r() * TAU;
      for (let k = 0; k < 6; k++) {
        const lx = x + Math.cos(ang) * k * 16 + (r() - 0.5) * 12;
        const ly = y + Math.sin(ang) * k * 16 + (r() - 0.5) * 12;
        g.beginPath();
        g.ellipse(lx, ly, 6 + r() * 9, 3 + r() * 4, ang + (r() - 0.5) * 1.4, 0, TAU);
        g.fill();
      }
    }
    // a soft window frame bar across the light
    g.fillRect(s * 0.62, 0, s * 0.035, s);
  });
}

/** Fine directional streaks for brushed stainless steel (used as roughness + bump). */
function brushedSteel() {
  return canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = '#7a7a7a';
      g.fillRect(0, 0, s, s);
      const r = rng(9);
      for (let i = 0; i < 2600; i++) {
        const v = 90 + Math.floor(r() * 90);
        g.fillStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`;
        g.fillRect(r() * s, r() * s, 40 + r() * 220, 1);
      }
    },
    { srgb: false, repeat: true }
  );
}

function roastBump() {
  return canvasTexture(
    256,
    (g, s) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, s, s);
      const r = rng(4);
      for (let i = 0; i < 1400; i++) {
        const v = r() > 0.5 ? 255 : 0;
        g.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`;
        g.beginPath();
        g.arc(r() * s, r() * s, 1 + r() * 4, 0, TAU);
        g.fill();
      }
    },
    { srgb: false, repeat: true }
  );
}

/** The café's cup label: white paper, the wordmark, a line of small print. */
function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f5';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#111';
  g.textBaseline = 'alphabetic';
  // only the middle third faces the viewer; keep the type centred there
  const cx = c.width / 2;
  g.textAlign = 'center';
  g.font = '800 92px Manrope, Arial, sans-serif';
  g.fillText('code', cx, 150);
  g.font = '300 44px Manrope, Arial, sans-serif';
  g.save();
  g.translate(cx, 205);
  g.scale(1.25, 1);
  g.fillText('c o n c e p t', 0, 0);
  g.restore();
  g.font = '500 24px Manrope, Arial, sans-serif';
  g.fillText('THIS PLACE RUNS ON CODE', cx, 290);
  g.fillRect(cx - 140, 315, 280, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ───────────── the café's clear cup: iced latte, black lid, straw, label ───────────── */
function createCup() {
  const H = 0.128;
  const rAt = (y) => 0.029 + (y / H) * 0.016; // tapered PET cup
  const g = new THREE.Group();

  const shellPts = [];
  for (let i = 0; i <= 24; i++) {
    const y = (i / 24) * H;
    shellPts.push(new THREE.Vector2(rAt(y), y));
  }
  shellPts.unshift(new THREE.Vector2(0.0001, 0.002), new THREE.Vector2(rAt(0) - 0.002, 0.0015));
  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 0.003,
    ior: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    specularIntensity: 1,
  });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(shellPts, 96), plastic);
  g.add(shell);

  // iced latte: milk settles at the bottom, espresso floats on top, marbling where they meet
  const fill = 0.098;
  const liqPts = [new THREE.Vector2(0.0001, 0.003)];
  for (let i = 0; i <= 20; i++) {
    const y = 0.003 + (i / 20) * (fill - 0.003);
    liqPts.push(new THREE.Vector2(rAt(y) - 0.0016, y));
  }
  liqPts.push(new THREE.Vector2(0.0001, fill));
  const latte = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  latte.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float ang = atan(vLocal.z, vLocal.x);
         float swirl = sin(ang * 3.0 + vLocal.y * 160.0) * 0.006 + sin(ang * 7.0 - vLocal.y * 90.0) * 0.003;
         float t = smoothstep(0.045, 0.075, vLocal.y + swirl);
         vec3 milk = vec3(0.93, 0.89, 0.82);
         vec3 coffee = vec3(0.36, 0.2, 0.1);
         diffuseColor.rgb = mix(milk, coffee, t);`
      );
  };
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liqPts, 64), latte);
  g.add(liquid);

  // ice, catching the light just under and above the surface
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.12, thickness: 0.02, ior: 1.31 });
  const r = rng(77);
  for (let i = 0; i < 5; i++) {
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.019, 0.02, 3, 0.004), ice);
    const a = (i / 5) * TAU + r();
    cube.position.set(Math.cos(a) * 0.016, fill - 0.006 + r() * 0.012, Math.sin(a) * 0.016);
    cube.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(cube);
  }

  // black dome lid with a rolled rim
  const lidPts = [
    [rAt(H) - 0.001, H - 0.006],
    [rAt(H) + 0.0022, H - 0.004],
    [rAt(H) + 0.0024, H + 0.002],
    [rAt(H) - 0.0005, H + 0.004],
    [0.04, H + 0.012],
    [0.032, H + 0.026],
    [0.022, H + 0.033],
    [0.012, H + 0.0355],
    [0.0001, H + 0.036],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const blackPlastic = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const lid = new THREE.Mesh(new THREE.LatheGeometry(lidPts, 96), blackPlastic);
  g.add(lid);

  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.23, 20), blackPlastic);
  straw.position.set(0.006, 0.1, 0.004);
  straw.rotation.z = -0.2;
  g.add(straw);

  // label wrapped on the front of the cup (follows the taper)
  const ly0 = 0.04;
  const ly1 = 0.088;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(rAt(ly1) + 0.0004, rAt(ly0) + 0.0004, ly1 - ly0, 64, 1, true, -1.05, 2.1),
    new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.55 })
  );
  label.position.y = (ly0 + ly1) / 2; // the arc is centred on +z, facing the viewer
  g.add(label);

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = o !== shell;
    }
  });
  g.userData = { height: H, top: new THREE.Vector3(0, fill, 0), straw: new THREE.Vector3(0.025, 0.21, 0.004) };
  return g;
}

/* ───────────── roasted beans: a pile that can rain down onto the table ───────────── */
const BEAN = 0.0042;
function createBeans({ count = 40, quality = 'high', seed = 3 } = {}) {
  const geo = new THREE.SphereGeometry(1, quality === 'high' ? 40 : 24, quality === 'high' ? 28 : 18);
  const pos = geo.attributes.position;
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    beanSurface(pos.getX(i), pos.getY(i), pos.getZ(i), p);
    pos.setXYZ(i, p[0] * BEAN, p[1] * BEAN, p[2] * BEAN);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, bumpMap: roastBump(), bumpScale: 0.6 }),
    count
  );
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const r = rng(seed);
  const tones = [0x2a1407, 0x331909, 0x3b1d0b, 0x24110a, 0x46260f];
  const beans = [];
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.085;
    // a low mound: beans near the middle sit on the ones below
    const layer = d < 0.035 && r() > 0.4 ? 1 : 0;
    const restPos = new THREE.Vector3(Math.cos(a) * d * 1.3, 0.82 * BEAN + layer * 0.0065, Math.sin(a) * d);
    const flip = r() > 0.4 ? -1 : 1;
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler((flip * Math.PI) / 2 + (r() - 0.5) * 0.5 * layer, r() * TAU, (r() - 0.5) * 0.3, 'YXZ'));
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
    beans.push({ restPos, rest, spin, height: 0.3 + r() * 0.25, delay: r() * 0.55 });
    mesh.setColorAt(i, new THREE.Color(tones[Math.floor(r() * tones.length)]));
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const axis = new THREE.Vector3(1, 1, 0).normalize();
  const tumble = new THREE.Quaternion();
  /** t 0..1: 0 = still above the frame, 1 = all resting on the table */
  mesh.update = (t) => {
    beans.forEach((b, i) => {
      const f = Math.min(1, Math.max(0, (t - b.delay) / 0.45));
      const fall = f * f;
      const bounce = f > 0.85 ? Math.sin(((f - 0.85) / 0.15) * Math.PI) * 0.01 * (1 - f) * 6 : 0;
      v.copy(b.restPos);
      v.y += (1 - fall) * b.height + bounce;
      q.copy(b.spin).slerp(b.rest, Math.min(1, f * 1.15));
      if (f < 1) q.multiply(tumble.setFromAxisAngle(axis, (1 - f) * 5));
      m.compose(v, q, f > 0 ? one : zero);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.update(1);
  return mesh;
}

/* ───────────── the room ───────────── */
function createRoom(quality) {
  const room = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const tex = (url, srgb) => {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.2, 1.2);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // smooth concrete wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 2.6),
    new THREE.MeshStandardMaterial({
      map: tex(plasterDiffUrl, true),
      normalMap: tex(plasterNorUrl),
      roughnessMap: tex(plasterRoughUrl),
      color: 0xd9d8d5,
      roughness: 1,
      normalScale: new THREE.Vector2(0.6, 0.6),
    })
  );
  wall.position.set(0, 1.25, -0.46);
  wall.receiveShadow = true;
  room.add(wall);

  // brushed stainless-steel table
  const streaks = brushedSteel();
  streaks.repeat.set(2, 4);
  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xc9cbcd,
    metalness: 1,
    roughness: 0.42,
    roughnessMap: streaks,
    bumpMap: streaks,
    bumpScale: 0.15,
    anisotropy: 0.8,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
  });
  const top = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.03, 0.92, 2, 0.006), steel);
  top.position.y = -0.015;
  top.receiveShadow = true;
  room.add(top);
  // a concrete floor far below so the table edge reads against something
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0xbfbebb, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.75;
  floor.receiveShadow = quality === 'high';
  room.add(floor);
  return room;
}

/* ───────────── world: renderer, light, camera ───────────── */
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;
const gltf = new GLTFLoader();
let bustPromise = null;
let envPromise = null;

/**
 * Build the whole set. `side`: -1 subject left of the copy (Persian), 1 right (English), 0 centred.
 * Returns the scene parts plus a small API (orbit, mood, start/stop, project…).
 */
export async function createSet({ canvas, quality = 'high', side = 0, background = 0xe8e7e4 }) {
  const high = quality === 'high';
  // the bust always stands on the far side from the page copy
  const mirror = side < 0 ? -1 : 1;
  const at = (v) => v.clone().setX(v.x * mirror);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, high ? 1.75 : 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.fog = new THREE.Fog(background, 2.2, 5);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);

  envPromise ??= new HDRLoader().loadAsync(hdrUrl).then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    return env;
  });
  bustPromise ??= gltf.loadAsync(bustUrl);
  // the cup label is drawn in Manrope, so wait for it before painting the canvas
  const fontReady = document.fonts ? Promise.all([document.fonts.load('800 40px Manrope'), document.fonts.load('300 40px Manrope')]) : null;
  const [env, bustGltf] = await Promise.all([envPromise, bustPromise, fontReady]);
  scene.environment = env;
  scene.environmentIntensity = 0.6;

  // window light: a soft spot whose light is broken up by leaves outside
  const sun = new THREE.SpotLight(0xfff6ea, 26, 6, 0.55, 0.85, 1.4);
  sun.position.set(-1.25 * mirror, 1.75, 1.05);
  sun.target.position.set(0.1 * mirror, 0.12, -0.2);
  sun.map = leafGobo();
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(high ? 2048 : 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 5;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0xf2f4f6, 0x8f8c88, 0.55);
  scene.add(fill);

  scene.add(createRoom(quality));

  const beans = createBeans({ quality, count: high ? 46 : 30 });
  beans.position.copy(at(SPOTS.beans));
  scene.add(beans);

  const cup = createCup();
  cup.position.copy(at(SPOTS.cup));
  cup.rotation.y = 0.15;
  scene.add(cup);

  const bust = bustGltf.scene.clone(true);
  bust.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = true;
      o.material.envMapIntensity = 0.9;
    }
  });
  bust.position.copy(at(SPOTS.bust));
  bust.rotation.y = -0.45 * mirror; // turned a little towards the cup
  bust.scale.setScalar(0.95);
  scene.add(bust);

  /* — framing & camera — */
  const orbit = { r: 1, az: 0, el: 10, target: new THREE.Vector3(0, 0.1, 0) };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // shift the picture so the subject sits opposite the copy (or above it on phones)
    const wide = camera.aspect > 1.15;
    const fx = side && wide ? -side * 0.18 : 0;
    const fy = side && !wide ? 0.12 : 0;
    camera.setViewOffset(width, height, fx * width, fy * height, width, height);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);

  function placeCamera(dt) {
    const k = 1 - Math.pow(0.02, dt);
    pointer.sx = lerp(pointer.sx, pointer.x, k);
    pointer.sy = lerp(pointer.sy, pointer.y, k);
    const az = (orbit.az + pointer.sx * 5) * DEG;
    const el = Math.min(80, Math.max(-5, orbit.el + pointer.sy * 3)) * DEG;
    const fit = camera.aspect < 1 ? Math.pow(1 / Math.max(0.5, camera.aspect), 0.85) : 1;
    const r = orbit.r * fit;
    const t = orbit.target;
    camera.position.set(t.x + r * Math.cos(el) * Math.sin(az), t.y + r * Math.sin(el), t.z + r * Math.cos(el) * Math.cos(az));
    camera.lookAt(t);
  }

  /** mood 0 = tired (cool, dim light) … 1 = awake (warm, bright window light) */
  const cool = new THREE.Color(0xdfe6ef);
  const warm = new THREE.Color(0xfff3e2);
  function setMood(m, time = 0) {
    sun.intensity = lerp(7, 30, m);
    sun.color.copy(cool).lerp(warm, m);
    scene.environmentIntensity = lerp(0.32, 0.62, m);
    fill.intensity = lerp(0.35, 0.55, m);
    // leaves sway a little in the breeze
    sun.map.offset.set(Math.sin(time * 0.35) * 0.012, Math.cos(time * 0.27) * 0.008);
  }

  const tasks = [];
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    for (const fn of tasks) fn(dt, time);
    placeCamera(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  const v = new THREE.Vector3();
  return {
    scene,
    camera,
    renderer,
    orbit,
    mirror,
    beans,
    cup,
    bust,
    sun,
    setMood,
    onFrame(fn) {
      tasks.push(fn);
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    project(p) {
      v.copy(p).project(camera);
      return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
    },
    /** One frame with every eased value snapped to its target (first paint, screenshots). */
    renderOnce() {
      for (const fn of tasks) fn(1, time);
      placeCamera(1);
      renderer.render(scene, camera);
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
