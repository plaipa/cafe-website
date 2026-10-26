import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { beanSurface, buildNetwork, HEAD_BRAIN, rng, sampleBean, sampleCup, sampleHead } from './shapes.js';
import {
  dustFrag,
  dustVert,
  fibreFrag,
  fibreVert,
  haloFrag,
  haloVert,
  nodeFrag,
  nodeVert,
  particleFrag,
  particleVert,
  patchBeanMaterial,
  ringFrag,
  ringVert,
} from './shaders.js';

/* Scroll progress (0..1) → scene state. Every curve is a list of [progress, value] keys, eased between. */
const TIMELINE = {
  stage: [[0, 0], [0.2, 0], [0.34, 1], [0.5, 1], [0.62, 2], [1, 2]],
  dissolve: [[0, 0], [0.17, 0], [0.29, 1], [1, 1]],
  ignite: [[0, 0], [0.76, 0], [0.9, 1], [1, 1]],
  camZ: [[0, 9.6], [0.18, 8.2], [0.34, 9.6], [0.5, 9.8], [0.62, 10.4], [0.72, 7.4], [0.78, 7.6], [0.9, 9.4], [1, 11.6]],
  groupY: [[0, 0], [0.6, 0], [0.72, -1.3], [0.8, -1.05], [0.92, -0.2], [1, 0]],
  tilt: [[0, -0.4], [1, 0.22], [2, 0.02]], // keyed by stage, not progress
};

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function keyed(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      const t = (p - p0) / (p1 - p0);
      return lerp(v0, v1, t * t * (3 - 2 * t));
    }
  }
  return keys[keys.length - 1][1];
}

function beanBumpTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  const r = rng(11);
  for (let i = 0; i < 2600; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 2 + r() * 14;
    const v = r() > 0.5 ? 255 : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${v},${v},${v},${0.1 + r() * 0.16})`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

/** Ready-made states for the smaller scenes on inner pages. */
export const PRESETS = {
  bean: { stage: 0, dissolve: 0, ignite: 0, camZ: 8.4, groupY: 0 },
  cup: { stage: 1, dissolve: 1, ignite: 0, camZ: 9.4, groupY: 0 },
  head: { stage: 2, dissolve: 1, ignite: 0, camZ: 10.6, groupY: 0 },
};

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {'high'|'low'} [o.quality]
 * @param {boolean} [o.mirror]  flip the subject for left-to-right layouts (English)
 * @param {'journey'|'center'} [o.framing]  journey = scroll-driven home story; center = subject fills its own canvas
 * @param {keyof PRESETS} [o.preset]  start state for centered scenes
 */
export function createStory({ canvas, quality = 'high', mirror = false, framing = 'journey', preset = 'bean' }) {
  const high = quality === 'high';
  const COUNT = high ? (framing === 'journey' ? 64000 : 42000) : framing === 'journey' ? 26000 : 18000;
  const flip = mirror ? -1 : 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !high, // desktop goes through the composer, which uses FXAA
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setClearColor(0x0c0d0e, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.set(0, 0, 9.6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;

  const key = new THREE.DirectionalLight(0xf4f2ee, 3.4);
  key.position.set(-3.5, 4, 5);
  const rim = new THREE.PointLight(0xdfe3e8, 60, 18, 2); // cool steel rim, like the brand photography
  rim.position.set(4.5, -1.2, -2.5);
  scene.add(key, rim);

  /* — halo behind the subject — */
  const haloUniforms = {
    uColor: { value: new THREE.Color(0x8c8e90) },
    uStrength: { value: 0.5 },
    uTime: { value: 0 },
  };
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      vertexShader: haloVert,
      fragmentShader: haloFrag,
      uniforms: haloUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  halo.position.z = -3.5;
  halo.scale.setScalar(16);
  scene.add(halo);

  /* — the subject: everything lives in one group so it turns as one object — */
  const group = new THREE.Group();
  scene.add(group);

  const u = {
    uStage: { value: 0 },
    uTime: { value: 0 },
    uPx: { value: pixelRatio },
    uSize: { value: high ? 2.35 : 2.9 },
    uIgnite: { value: 0 },
    uReveal: { value: 0 },
    uBrain: { value: new THREE.Vector3(...HEAD_BRAIN) },
  };

  // solid bean (dissolves into particles)
  const beanUniforms = { uDissolve: { value: 0 } };
  const beanGeo = new THREE.SphereGeometry(1, high ? 360 : 200, high ? 240 : 130);
  {
    const pos = beanGeo.attributes.position;
    const tmp = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      beanSurface(pos.getX(i), pos.getY(i), pos.getZ(i), tmp);
      pos.setXYZ(i, tmp[0], tmp[1], tmp[2]);
    }
    beanGeo.computeVertexNormals();
  }
  const bump = beanBumpTexture();
  const beanMat = new THREE.MeshPhysicalMaterial({
    color: 0x2e2420, // dark roast, close to black
    roughness: 0.46,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    bumpMap: bump,
    bumpScale: 1.6,
    emissive: 0x0b0908,
    side: THREE.DoubleSide,
  });
  patchBeanMaterial(beanMat, beanUniforms);
  const bean = new THREE.Mesh(beanGeo, beanMat);
  group.add(bean);

  // morphing particles
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(sampleBean(COUNT, 1), 3));
  pGeo.setAttribute('aCup', new THREE.BufferAttribute(sampleCup(COUNT, 2), 3));
  pGeo.setAttribute('aHead', new THREE.BufferAttribute(sampleHead(COUNT, 3), 3));
  {
    const r = rng(5);
    const a = new Float32Array(COUNT * 4);
    for (let i = 0; i < a.length; i++) a[i] = r();
    pGeo.setAttribute('aRand', new THREE.BufferAttribute(a, 4));
  }
  const particles = new THREE.Points(
    pGeo,
    new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  particles.frustumCulled = false;
  group.add(particles);

  // neural network
  const net = buildNetwork({ nodes: high ? 250 : 170 });
  const shared = { uTime: u.uTime, uIgnite: u.uIgnite, uPx: u.uPx, uShow: { value: 0 } };
  const fibreGeo = new THREE.BufferGeometry();
  fibreGeo.setAttribute('position', new THREE.BufferAttribute(net.pos, 3));
  fibreGeo.setAttribute('aT', new THREE.BufferAttribute(net.aT, 1));
  fibreGeo.setAttribute('aPhase', new THREE.BufferAttribute(net.aPhase, 1));
  fibreGeo.setAttribute('aD', new THREE.BufferAttribute(net.aD, 1));
  const fibres = new THREE.LineSegments(
    fibreGeo,
    new THREE.ShaderMaterial({
      vertexShader: fibreVert,
      fragmentShader: fibreFrag,
      uniforms: shared,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  fibres.frustumCulled = false;
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(net.nodePos, 3));
  nodeGeo.setAttribute('aD', new THREE.BufferAttribute(net.nodeD, 1));
  nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(net.nodeSeed, 1));
  const nodes = new THREE.Points(
    nodeGeo,
    new THREE.ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      uniforms: shared,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  nodes.frustumCulled = false;
  group.add(fibres, nodes);

  // orbit rings around the awakened head
  const ringUniforms = [0, 1].map((i) => ({
    uTime: u.uTime,
    uShow: { value: 0 },
    uDash: { value: i ? 9 : 14 },
    uDir: { value: i ? -0.9 : 0.7 },
  }));
  const rings = ringUniforms.map((uni, i) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(i ? 2.35 : 2.0, i ? 2.365 : 2.016, 220),
      new THREE.ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        uniforms: uni,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    m.position.set(HEAD_BRAIN[0], HEAD_BRAIN[1] - 0.25, 0);
    m.rotation.set(1.2 + i * 0.35, i ? 0.5 : -0.35, i ? 0.4 : 0);
    group.add(m);
    return m;
  });

  // distant dust (parallax depth)
  const DUST = high ? 520 : 240;
  const box = new THREE.Vector3(9, 5.5, 5);
  const dGeo = new THREE.BufferGeometry();
  {
    const r = rng(9);
    const p = new Float32Array(DUST * 3);
    const a = new Float32Array(DUST * 4);
    for (let i = 0; i < DUST; i++) {
      p[i * 3] = (r() * 2 - 1) * box.x;
      p[i * 3 + 1] = (r() * 2 - 1) * box.y;
      p[i * 3 + 2] = (r() * 2 - 1) * box.z - 1;
      a.set([r(), r(), r(), r()], i * 4);
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    dGeo.setAttribute('aRand', new THREE.BufferAttribute(a, 4));
  }
  const dust = new THREE.Points(
    dGeo,
    new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms: { uTime: u.uTime, uPx: u.uPx, uBox: { value: box }, uColor: { value: new THREE.Color(0xdedfe0) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  /* — post-processing — */
  let composer = null;
  let bloom = null;
  if (high) {
    // no MSAA on the half-float target (not reliable on every GPU); FXAA after tone-mapping smooths edges instead
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.85, 0.8, 0.22);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new FXAAPass());
  }

  /* — sizing / layout — */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  /* — frame state — */
  let progress = 0;
  let shown = 0; // eased progress
  let manual = framing === 'center' ? { ...PRESETS[preset] } : null; // direct control instead of the scroll timeline
  const state = manual ? { ...manual } : { stage: 0, dissolve: 0, ignite: 0, camZ: 9.6, groupY: 0 };
  let running = false;
  let raf = 0;
  let elapsed = 0;
  let last = 0;
  const layout = { x: 0, y: 0, s: 1 };
  const tmpV = new THREE.Vector3();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Code Concept is monochrome: graphite halo → dim slate while tired → clean white light when awake
  const haloGold = new THREE.Color(0x8c8e90);
  const haloSleep = new THREE.Color(0x3a3d42);
  const haloAmber = new THREE.Color(0xd8dadc);

  function targetLayout() {
    if (framing === 'center') return { x: 0, y: 0, s: 1 };
    // subject beside the copy on wide screens (copy is on the reading-start side), above it on phones
    return camera.aspect > 1.15 ? { x: -0.2 * flip, y: 0, s: 1 } : { x: 0, y: 0.17, s: 0.8 };
  }

  function update(dt, elapsed, immediate) {
    const k = immediate ? 1 : 1 - Math.pow(0.0009, dt);
    if (manual) {
      for (const key of Object.keys(state)) state[key] = lerp(state[key], manual[key], immediate ? 1 : 1 - Math.pow(0.02, dt));
    } else {
      shown = lerp(shown, progress, k);
      const P = shown;
      state.stage = keyed(P, TIMELINE.stage);
      state.ignite = keyed(P, TIMELINE.ignite);
      state.dissolve = keyed(P, TIMELINE.dissolve);
      state.camZ = keyed(P, TIMELINE.camZ);
      state.groupY = keyed(P, TIMELINE.groupY);
    }
    const { stage, ignite } = state;

    u.uStage.value = stage;
    u.uIgnite.value = ignite;
    u.uTime.value = elapsed;
    beanUniforms.uDissolve.value = state.dissolve;
    bean.visible = state.dissolve < 0.995;
    shared.uShow.value = smooth(1.55, 2, stage);
    const ringShow = smooth(0.6, 1, ignite);
    ringUniforms.forEach((r, i) => (r.uShow.value = ringShow * (i ? 0.7 : 1)));
    rings.forEach((r, i) => (r.rotation.z += dt * (i ? -0.12 : 0.1) * ringShow));
    haloUniforms.uTime.value = elapsed;

    // halo mood: warm bean → soft cup glow → cold sleepy blue → blazing amber
    const sleepy = smooth(1, 2, stage);
    haloUniforms.uColor.value.copy(haloGold).lerp(haloSleep, sleepy).lerp(haloAmber, ignite);
    haloUniforms.uStrength.value = lerp(lerp(0.5, 0.3, sleepy), 0.62, ignite) * (1 - 0.45 * Math.sin(Math.PI * ignite)) * (framing === 'center' ? 0.7 : 1);
    if (bloom) bloom.strength = 0.75 + ignite * 0.45;

    const target = targetLayout();
    const lk = immediate ? 1 : 1 - Math.pow(0.001, dt);
    layout.x = lerp(layout.x, target.x, lk);
    layout.y = lerp(layout.y, target.y, lk);
    layout.s = lerp(layout.s, target.s, lk);

    camera.position.z = state.camZ;
    const viewH = 2 * Math.tan((camera.fov * Math.PI) / 360) * state.camZ;
    const viewW = viewH * camera.aspect;
    group.position.x = layout.x * viewW;
    group.position.y = layout.y * viewH + state.groupY * layout.s;
    group.scale.set(layout.s * flip, layout.s, layout.s);

    // pointer parallax (eased)
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.pow(0.01, dt));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.pow(0.01, dt));
    const t = reduce ? 0 : elapsed;
    const beanTurn = 0.45 + Math.sin(t * 0.32) * 0.6;
    const calmTurn = -0.12 + Math.sin(t * 0.22) * 0.18 + (manual ? 0 : shown * 0.25);
    group.rotation.y = (lerp(beanTurn, calmTurn, smooth(0.4, 1.4, stage)) + pointer.sx * 0.32) * flip;
    group.rotation.x = keyed(stage, TIMELINE.tilt) + pointer.sy * 0.16;
    camera.position.x = pointer.sx * 0.25;
    camera.position.y = pointer.sy * 0.15;
    camera.lookAt(0, 0, 0);

    dust.rotation.y = elapsed * 0.01 + pointer.sx * 0.08;
    rim.intensity = 70 + ignite * 40;
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    update(dt, elapsed, false);
    render();
    raf = requestAnimationFrame(loop);
  }

  let revealStart = null;
  function revealLoop(now) {
    if (revealStart === null) revealStart = now;
    const t = Math.min(1, (now - revealStart) / 1800);
    u.uReveal.value = 1 - Math.pow(1 - t, 3);
    if (t < 1) requestAnimationFrame(revealLoop);
  }

  return {
    /** Journey mode: scroll progress 0..1. */
    setProgress(p) {
      progress = p;
    },
    /** Centered mode: steer the scene directly, e.g. { ignite: 0.6 } or a whole preset. */
    set(values) {
      manual = { ...(manual || state), ...values };
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    /** Convert a point in the subject's local space to canvas pixel coordinates. */
    project(local) {
      tmpV.set(local[0], local[1], local[2]);
      group.localToWorld(tmpV);
      tmpV.project(camera);
      return { x: (tmpV.x * 0.5 + 0.5) * width, y: (-tmpV.y * 0.5 + 0.5) * height, visible: tmpV.z < 1 };
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reveal() {
      requestAnimationFrame(revealLoop);
    },
    /** Render one frame synchronously at the current target (first paint, screenshots, reduced motion). */
    renderStill(p = progress) {
      progress = p;
      u.uReveal.value = 1;
      update(0.016, elapsed + 3, true);
      render();
    },
    dispose() {
      this.stop();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
