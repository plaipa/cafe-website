import * as THREE from 'three';
import {
  createBeans,
  createCoffee,
  createContactShadow,
  createShadowCatcher,
  createSteam,
  innerRadiusAt,
  loadCroissant,
  loadCupSet,
  loadEnvironment,
  prepareModel,
} from './props.js';

const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

/**
 * A small photographic "set": transparent canvas over the page, café HDRI for
 * reflections, a warm window light with soft shadows, and an orbiting camera.
 * `side` shifts the framing so the subject sits beside the copy:
 * -1 = subject on the left (Persian pages), 1 = on the right (English), 0 = centred.
 */
export async function createWorld({ canvas, quality = 'high', side = 0 }) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, high ? 2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);

  scene.environment = await loadEnvironment(renderer);
  scene.environmentIntensity = 0.95;

  // late-afternoon window light
  const sun = new THREE.DirectionalLight(0xffe0bc, 2.6);
  sun.position.set(-0.7, 1.0, 0.55);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(high ? 2048 : 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -0.45;
  sun.shadow.camera.right = sun.shadow.camera.top = 0.45;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 3;
  sun.shadow.radius = 9;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a6a4a, 0.35));
  scene.add(createShadowCatcher());

  /* — framing & camera orbit — */
  const orbit = { r: 0.6, az: 28, el: 24, tx: 0, ty: 0.05, tz: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1;
  let height = 1;
  const frame = { x: 0, y: 0 };

  function framingFor(aspect) {
    if (!side) return { x: 0, y: 0 };
    return aspect > 1.15 ? { x: -side * 0.2, y: 0 } : { x: 0, y: 0.16 };
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
    camera.position.set(
      target.x + orbit.r * Math.cos(el) * Math.sin(az),
      target.y + orbit.r * Math.sin(el),
      target.z + orbit.r * Math.cos(el) * Math.cos(az)
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

/**
 * The table set shared by every scene: porcelain cup on its saucer with a
 * latte-art coffee, steam, optional beans and croissant.
 */
export async function buildTable(world, { beans = 0, croissant = false, quality = 'high', beanRing, beanDrop, side = 0 } = {}) {
  const [cupGltf, croissantGltf] = await Promise.all([loadCupSet(), croissant ? loadCroissant() : null]);
  const set = prepareModel(cupGltf.scene.clone(true));
  const cup = set.getObjectByName('tea_set_01_cup_small_01');
  const saucer = set.getObjectByName('tea_set_01_saucer_circular_03');
  // the cup's handle points along −z in the scan; turn it to the viewer's right
  cup.rotation.y = Math.PI * 0.62;
  cup.position.y = 0.0068; // resting in the saucer's well
  const table = new world.THREE.Group();
  table.add(set);
  table.add(createContactShadow(0.095, 0.4));

  // coffee fills the cup to ~80% of its height
  const cupMesh = cup.isMesh ? cup : cup.getObjectsByProperty('isMesh', true)[0];
  cupMesh.geometry.computeBoundingBox();
  const box = cupMesh.geometry.boundingBox;
  const level = box.min.y + (box.max.y - box.min.y) * 0.8;
  const coffee = createCoffee(innerRadiusAt(cupMesh, level) - 0.0006);
  coffee.position.y = cup.position.y + level;
  table.add(coffee);

  const steam = createSteam();
  steam.position.y = coffee.position.y + 0.004;
  table.add(steam);

  let beanMesh = null;
  if (beans) {
    beanMesh = createBeans({ count: beans, quality, ring: beanRing, drop: beanDrop });
    table.add(beanMesh);
  }
  let croissantObj = null;
  if (croissantGltf) {
    croissantObj = prepareModel(croissantGltf.scene.clone(true));
    // on the far side from the page copy, a little behind the cup
    const cx = side > 0 ? 0.16 : -0.16;
    croissantObj.position.set(side ? cx : 0.17, 0, -0.12);
    croissantObj.rotation.y = side > 0 ? -0.5 : 0.5;
    croissantObj.scale.setScalar(1.05);
    table.add(croissantObj);
    const blob = createContactShadow(0.11, 0.3);
    blob.position.copy(croissantObj.position).setY(0.0004);
    blob.scale.set(1, 0.6, 1);
    table.add(blob);
  }
  world.scene.add(table);
  return { table, cup, saucer, coffee, steam, beans: beanMesh, croissant: croissantObj, coffeeY: coffee.position.y, coffeeR: coffee.geometry.parameters.radius };
}
