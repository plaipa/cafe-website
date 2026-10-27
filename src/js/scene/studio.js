import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* A photo studio for one object: a flat, seamless colour backdrop (the "cove"),
   a soft key light from the upper left, a room environment for reflections,
   and a shadow that falls onto the backdrop itself. Units are metres; the
   floor is y = 0. No downloads: everything here is generated. */

const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

/** A soft round shadow drawn on canvas, laid on the floor under the object. */
function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * `side`: where the page copy is, so the subject can sit opposite it
 *   (1 = copy on the left, subject right; -1 = copy right, subject left; 0 = centred).
 */
export function createStudio({ canvas, quality = 'high', side = 0, background = '#efe9df' }) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, high ? 2 : 1.5));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.transmissionResolutionScale = high ? 1 : 0.5;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(background);
  scene.background = bg;
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 20);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();

  // key light: big and soft, from the upper left, slightly warm
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(-0.55, 1.1, 0.7);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(high ? 1024 : 512);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -0.5;
  sc.right = sc.top = 0.5;
  sc.near = 0.3;
  sc.far = 3;
  scene.add(key);
  // a cool rim from behind gives the glass its outline
  const rim = new THREE.DirectionalLight(0xe8f0ff, 1.1);
  rim.position.set(0.6, 0.5, -0.9);
  scene.add(rim);

  // the cove: the backdrop colour is the background; the floor only catches shadow,
  // and stays inside the shadow camera so its edge never shows
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.42, 64), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.0004;
  contact.renderOrder = -1;
  scene.add(contact);

  /* — framing & camera — */
  const orbit = { r: 0.5, az: 0, el: 10, target: new THREE.Vector3(0, 0.06, 0) };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // slide the picture so the subject sits opposite the copy (or above it on phones)
    const wide = camera.aspect > 1.15;
    const fx = side && wide ? -side * 0.22 : 0;
    const fy = side && !wide ? 0.16 : 0;
    camera.setViewOffset(width, height, fx * width, fy * height, width, height);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);

  function placeCamera(dt) {
    const k = dt >= 1 ? 1 : 1 - Math.pow(0.02, dt);
    pointer.sx = lerp(pointer.sx, pointer.x, k);
    pointer.sy = lerp(pointer.sy, pointer.y, k);
    const az = (orbit.az + pointer.sx * 6) * DEG;
    const el = Math.min(80, Math.max(-2, orbit.el + pointer.sy * 3)) * DEG;
    // portrait screens: step back so the object still fits
    const fit = camera.aspect < 1 ? Math.pow(1 / Math.max(0.45, camera.aspect), 0.9) : 1;
    const r = orbit.r * fit;
    const t = orbit.target;
    camera.position.set(t.x + r * Math.cos(el) * Math.sin(az), t.y + r * Math.sin(el), t.z + r * Math.cos(el) * Math.cos(az));
    camera.lookAt(t);
  }

  const tasks = [];
  const afterCamera = [];
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  function frame(dt) {
    for (const fn of tasks) fn(dt, time);
    placeCamera(dt);
    camera.updateMatrixWorld();
    for (const fn of afterCamera) fn(dt, time);
    renderer.render(scene, camera);
  }
  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    frame(dt);
    raf = requestAnimationFrame(tick);
  }

  const v = new THREE.Vector3();
  const right = new THREE.Vector3();
  return {
    scene,
    camera,
    renderer,
    orbit,
    side,
    /** Backdrop colour (any CSS colour); the page behind the canvas should match it. */
    setBackground(color) {
      bg.set(color);
    },
    /** Size the soft contact shadow to an object of radius `r` (fade it with `opacity`). */
    setContact(r, opacity = 1) {
      contact.scale.setScalar(r * 3.2);
      contact.material.opacity = 0.6 * opacity;
    },
    onFrame(fn) {
      tasks.push(fn);
    },
    /** Runs after the camera has been placed for the frame, just before rendering. */
    onCamera(fn) {
      afterCamera.push(fn);
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    /** World point → CSS pixels within the canvas. */
    project(p) {
      v.copy(p).project(camera);
      return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
    },
    /** The camera's screen-right direction in world space (for placing labels beside things). */
    screenRight() {
      return right.setFromMatrixColumn(camera.matrixWorld, 0);
    },
    /** One frame with every eased value snapped to its target (first paint, screenshots). */
    renderOnce() {
      frame(1);
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
