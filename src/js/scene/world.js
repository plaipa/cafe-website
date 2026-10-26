import * as THREE from 'three';
import { loadEnvironment } from './props.js';

const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

/**
 * A small product-photography "set": transparent canvas over the page, a soft-box
 * studio HDRI for reflections, a warm key light, a caramel rim light behind, and an orbiting camera.
 * `side` shifts the framing so the subject sits beside the copy:
 * -1 = subject on the left (Persian pages), 1 = on the right (English), 0 = centred.
 */
export async function createWorld({ canvas, quality = 'high', side = 0 }) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, high ? 2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);

  scene.environment = await loadEnvironment(renderer);
  scene.environmentIntensity = 0.85;

  // warm key from above-left (casts the soft shadows)
  const sun = new THREE.DirectionalLight(0xffe4c4, 2.4);
  sun.position.set(-0.8, 1.2, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(high ? 2048 : 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -0.5;
  sun.shadow.camera.right = sun.shadow.camera.top = 0.5;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 4;
  sun.shadow.radius = 9;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0006;
  // caramel rim from behind: the glow that outlines glass, glaze and chrome
  const rim = new THREE.DirectionalLight(0xff9a50, 3.2);
  rim.position.set(0.9, 0.5, -1.1);
  scene.add(sun, sun.target, rim, rim.target);
  scene.add(new THREE.HemisphereLight(0xffeedd, 0x2a1a10, 0.25));

  /* — framing & camera orbit — */
  const orbit = { r: 0.6, az: 28, el: 24, tx: 0, ty: 0.05, tz: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;
  const frame = { x: 0, y: 0 };

  function framingFor(aspect) {
    if (!side) return { x: 0, y: 0 };
    return aspect > 1.15 ? { x: -side * 0.2, y: 0 } : { x: 0, y: 0.04 };
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const f = framingFor(camera.aspect);
    frame.x = f.x;
    frame.y = f.y;
    // render an off-centre window of a virtual frame: the subject shifts without moving the scene
    camera.setViewOffset(width, height, frame.x * width, frame.y * height, width, height);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  const target = new THREE.Vector3();
  function placeCamera(dt) {
    const k = 1 - Math.pow(0.02, dt);
    pointer.sx = lerp(pointer.sx, pointer.x, k);
    pointer.sy = lerp(pointer.sy, pointer.y, k);
    const az = (orbit.az + pointer.sx * 6) * DEG;
    const el = Math.min(85, Math.max(2, orbit.el + pointer.sy * 4)) * DEG;
    target.set(orbit.tx, orbit.ty, orbit.tz);
    // portrait screens: step back so the subject fits between the headline and the copy
    const fit = camera.aspect < 1 ? Math.pow(1 / Math.max(0.5, camera.aspect), 0.8) : 1;
    const r = orbit.r * fit;
    camera.position.set(
      target.x + r * Math.cos(el) * Math.sin(az),
      target.y + r * Math.sin(el),
      target.z + r * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(target);
  }

  /* — loop — */
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
    THREE,
    scene,
    camera,
    renderer,
    sun,
    rim,
    orbit,
    get time() {
      return time;
    },
    onFrame(fn) {
      tasks.push(fn);
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    /** World position → canvas pixels (accounts for the off-centre framing). */
    project(p) {
      v.copy(p).project(camera);
      return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
    },
    /** Draw one frame with every eased value snapped to its target (first paint, screenshots). */
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
    dispose() {
      this.stop();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
