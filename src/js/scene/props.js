import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { beanSurface, rng } from './shapes.js';
import { reportAssets } from '../loader.js';

// every loader below uses the default manager; its progress feeds the intro loader
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => reportAssets(loaded, total);

/* ───────────── assets (CC0 from Poly Haven; see README) ───────────── */
const base = import.meta.env.BASE_URL;
const gltf = new GLTFLoader();
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const loadCupSet = () => once('cup', () => gltf.loadAsync(`${base}models/cupset.glb`));
export const loadCroissant = () => once('croissant', () => gltf.loadAsync(`${base}models/croissant.glb`));
export const loadEnvironment = (renderer) =>
  once('env', async () => {
    const hdr = await new HDRLoader().loadAsync(`${base}env/comfy_cafe_1k.hdr`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    return env;
  });

export function prepareModel(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.material.envMapIntensity = 1;
    }
  });
  return root;
}

/** Inner radius of the cup at a given height, measured from its own vertices (so the coffee fits the real model). */
export function innerRadiusAt(mesh, y) {
  const pos = mesh.geometry.attributes.position;
  const radii = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.y - y) < 0.003) radii.push(Math.hypot(v.x, v.z));
  }
  radii.sort((a, b) => a - b);
  return radii[Math.floor(radii.length * 0.04)] || 0.04;
}

/* ───────────── coffee surface: crema with a poured heart ───────────── */
function latteTexture(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const r = rng(21);
  const blur = (px) => ('filter' in g ? `blur(${px}px)` : 'none');

  // crema: caramel centre, darker towards the wall
  const crema = g.createRadialGradient(R, R * 1.05, 0, R, R, R);
  crema.addColorStop(0, '#a5693a');
  crema.addColorStop(0.5, '#8c552a');
  crema.addColorStop(0.84, '#633417');
  crema.addColorStop(0.96, '#3f1f0b');
  crema.addColorStop(1, '#2a1306');
  g.fillStyle = crema;
  g.fillRect(0, 0, size, size);

  // soft mottling, the way crema breaks up as it settles
  g.save();
  g.filter = blur(size * 0.012);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * 0.85;
    g.fillStyle = r() > 0.5 ? 'rgba(70,32,10,0.16)' : 'rgba(205,150,95,0.14)';
    g.beginPath();
    g.arc(R + Math.cos(a) * d, R + Math.sin(a) * d, size * (0.015 + r() * 0.05), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // the poured heart, drawn on its own layer so its edges can be feathered into the crema
  const art = document.createElement('canvas');
  art.width = art.height = size;
  const a = art.getContext('2d');
  const jitter = () => (r() - 0.5) * size * 0.012;
  const heart = (cx, cy, w, h) => {
    a.beginPath();
    a.moveTo(cx + jitter(), cy + h * 0.52);
    a.bezierCurveTo(cx - w * 0.6 + jitter(), cy + h * 0.1, cx - w * 0.6 + jitter(), cy - h * 0.5, cx - w * 0.22, cy - h * 0.5);
    a.bezierCurveTo(cx - w * 0.07, cy - h * 0.5, cx, cy - h * 0.38, cx, cy - h * 0.28);
    a.bezierCurveTo(cx, cy - h * 0.38, cx + w * 0.07, cy - h * 0.52, cx + w * 0.24, cy - h * 0.5);
    a.bezierCurveTo(cx + w * 0.62 + jitter(), cy - h * 0.48, cx + w * 0.58 + jitter(), cy + h * 0.08, cx + jitter(), cy + h * 0.52);
    a.closePath();
  };
  const cx = R;
  const cy = R;
  a.fillStyle = '#f1e2cc';
  heart(cx, cy, R * 0.98, R * 0.86);
  a.fill();
  // two layers of crema pushed into the foam by the pour
  a.globalCompositeOperation = 'source-atop';
  a.strokeStyle = 'rgba(150,92,48,0.75)';
  a.lineWidth = size * 0.011;
  heart(cx, cy + R * 0.1, R * 0.7, R * 0.6);
  a.stroke();
  a.lineWidth = size * 0.008;
  heart(cx, cy + R * 0.2, R * 0.42, R * 0.36);
  a.stroke();
  // the pull-through
  a.lineWidth = size * 0.006;
  a.beginPath();
  a.moveTo(cx, cy - R * 0.42);
  a.quadraticCurveTo(cx + size * 0.004, cy + R * 0.1, cx, cy + R * 0.55);
  a.stroke();

  // a warm halo where foam mixes into crema, then the foam itself with soft edges
  g.save();
  g.filter = blur(size * 0.014);
  g.globalAlpha = 0.45;
  g.drawImage(art, 0, 0);
  g.filter = blur(size * 0.0035);
  g.globalAlpha = 0.97;
  g.drawImage(art, 0, 0);
  g.restore();

  // micro-bubbles
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,245,228,${0.04 + r() * 0.08})` : `rgba(60,28,8,${0.04 + r() * 0.08})`;
    g.fillRect(r() * size, r() * size, 1 + r(), 1 + r());
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCoffee(radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshPhysicalMaterial({
      map: latteTexture(),
      roughness: 0.38,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.6,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/* ───────────── roasted beans (instanced) ───────────── */
const BEAN_SCALE = 0.0037; // ~11 mm long

function beanGeometry(quality) {
  const geo = new THREE.SphereGeometry(1, quality === 'high' ? 48 : 28, quality === 'high' ? 32 : 20);
  const pos = geo.attributes.position;
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    beanSurface(pos.getX(i), pos.getY(i), pos.getZ(i), p);
    pos.setXYZ(i, p[0] * BEAN_SCALE, p[1] * BEAN_SCALE, p[2] * BEAN_SCALE);
  }
  geo.computeVertexNormals();
  return geo;
}

function roastBump() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, s, s);
  const r = rng(4);
  for (let i = 0; i < 1400; i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`;
    g.beginPath();
    g.arc(r() * s, r() * s, 1 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Beans that rain down and settle on the table around the cup.
 * `update(t)` with t 0..1 drives the fall; 1 = all resting.
 */
export function createBeans({ count = 28, quality = 'high', seed = 3, ring = [0.1, 0.22], drop = 0.5 } = {}) {
  const mesh = new THREE.InstancedMesh(
    beanGeometry(quality),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.55,
      clearcoat: 0.3,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.7,
      bumpMap: roastBump(),
      bumpScale: 0.6,
    }),
    count
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const r = rng(seed);
  const beans = [];
  const tones = [0x2a1407, 0x331909, 0x3b1d0b, 0x24110a, 0x432410];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = ring[0] + Math.pow(r(), 0.8) * (ring[1] - ring[0]);
    const restPos = new THREE.Vector3(Math.cos(a) * d, 0.82 * BEAN_SCALE * 0.98, Math.sin(a) * d);
    const flip = r() > 0.4 ? -1 : 1; // most lie crease-up
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler((flip * Math.PI) / 2, r() * Math.PI * 2, 0, 'YXZ'));
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
    beans.push({ restPos, rest, spin, height: drop * (0.7 + r() * 0.6), delay: r() * 0.55 });
    mesh.setColorAt(i, new THREE.Color(tones[Math.floor(r() * tones.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.04));
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  mesh.update = (t, time = 0) => {
    beans.forEach((b, i) => {
      const f = Math.min(1, Math.max(0, (t - b.delay) / 0.45));
      // gravity-like fall, then a small settling bounce
      const fall = f * f;
      const bounce = f > 0.85 ? Math.sin(((f - 0.85) / 0.15) * Math.PI) * 0.012 * (1 - f) * 6 : 0;
      p.copy(b.restPos);
      p.y += (1 - fall) * b.height + bounce;
      q.copy(b.spin).slerp(b.rest, Math.min(1, f * 1.15));
      if (f < 1) {
        const tumble = new THREE.Quaternion().setFromAxisAngle(one, (1 - f) * 4 + time * 0.3);
        q.multiply(tumble);
      }
      // beans still waiting above the frame are hidden, so they cast no stray shadows
      m.compose(p, q, f > 0 ? one : zero);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.update(1);
  return mesh;
}

/* ───────────── steam ───────────── */
const steamVert = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 p = position;
    float h = uv.y;
    p.x += sin(h * 5.0 + uTime * 0.9 + uSeed * 6.0) * 0.012 * h + sin(h * 11.0 - uTime * 1.3 + uSeed) * 0.004 * h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const steamFrag = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main(){
    vec2 uv = vUv;
    float t = uTime * 0.22;
    float n = fbm(vec2(uv.x * 3.0 + uSeed * 7.0, uv.y * 2.4 - t));
    n = fbm(vec2(uv.x * 2.5 + n * 1.4, uv.y * 2.0 - t * 1.3 + uSeed));
    float wisp = smoothstep(0.42, 0.78, n);
    float sides = smoothstep(0.0, 0.32, uv.x) * smoothstep(1.0, 0.68, uv.x);
    float vertical = smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.45, uv.y);
    float a = wisp * sides * vertical * uStrength;
    gl_FragColor = vec4(vec3(1.0, 0.985, 0.96), a * 0.55);
  }
`;

export function createSteam({ wisps = 3, width = 0.09, height = 0.2 } = {}) {
  const group = new THREE.Group();
  const uniforms = [];
  for (let i = 0; i < wisps; i++) {
    const u = { uTime: { value: 0 }, uSeed: { value: i * 1.37 + 0.3 }, uStrength: { value: 1 } };
    uniforms.push(u);
    const geo = new THREE.PlaneGeometry(width, height, 1, 40);
    geo.translate(0, height / 2, 0);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: steamVert,
        fragmentShader: steamFrag,
        uniforms: u,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.x = (i - (wisps - 1) / 2) * width * 0.22;
    mesh.position.z = (i % 2 ? 1 : -1) * 0.004;
    mesh.renderOrder = 10;
    group.add(mesh);
  }
  group.update = (time, camera, strength = 1) => {
    uniforms.forEach((u) => {
      u.uTime.value = time;
      u.uStrength.value = strength;
    });
    // billboard around the vertical axis so the wisps always face the viewer
    const cam = camera.getWorldPosition(new THREE.Vector3());
    const me = group.getWorldPosition(new THREE.Vector3());
    group.rotation.y = Math.atan2(cam.x - me.x, cam.z - me.z);
  };
  return group;
}

/* ───────────── shadows ───────────── */
export function createShadowCatcher(size = 3) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShadowMaterial({ color: 0x4a2a14, opacity: 0.22 })
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** Soft ambient-occlusion blob that grounds an object on the invisible table. */
export function createContactShadow(radius, strength = 0.35) {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      color: 0x3a2010,
      alphaMap: new THREE.CanvasTexture(c),
      transparent: true,
      opacity: strength,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0005;
  return m;
}
