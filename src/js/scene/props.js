import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { beanSurface, rng } from './shapes.js';
import { reportAssets } from '../loader.js';
// imported as an asset so the URL is right from any page, including /en/
import studioHdr from '../../assets/studio_small_09_1k.hdr?url';

/* Minimal, procedurally modelled props for the coffee story:
   a matte-black cup, a glass drop of espresso, caramel ribbons, a chrome
   portafilter, roasted beans, espresso streams and steam. Units are metres. */

// every loader uses the default manager; its progress feeds the intro loader
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => reportAssets(loaded, total);

let envPromise = null;
/** Soft-box studio HDRI (Poly Haven, CC0) for clean reflections on glass, glaze and chrome. */
export function loadEnvironment(renderer) {
  envPromise ??= new HDRLoader().loadAsync(studioHdr).then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    return env;
  });
  return envPromise;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ───────────── crema (canvas texture) ───────────── */
export function cremaTexture({ size = 1024, swirl = true, heart = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const r = rng(21);
  const blur = (px) => ('filter' in g ? `blur(${px}px)` : 'none');

  const crema = g.createRadialGradient(R, R, 0, R, R, R);
  crema.addColorStop(0, '#b97a42');
  crema.addColorStop(0.55, '#9d5f2d');
  crema.addColorStop(0.85, '#6e3a16');
  crema.addColorStop(0.97, '#3a1b08');
  crema.addColorStop(1, '#1e0d04');
  g.fillStyle = crema;
  g.fillRect(0, 0, size, size);

  g.save();
  g.filter = blur(size * 0.01);
  for (let i = 0; i < 80; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * 0.85;
    g.fillStyle = r() > 0.5 ? 'rgba(80,36,10,0.18)' : 'rgba(225,165,100,0.16)';
    g.beginPath();
    g.arc(R + Math.cos(a) * d, R + Math.sin(a) * d, size * (0.015 + r() * 0.04), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  if (swirl) {
    // the marbled spiral a fresh pour leaves in the crema
    g.save();
    g.filter = blur(size * 0.006);
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = k === 1 ? 'rgba(245,215,170,0.55)' : 'rgba(70,30,8,0.45)';
      g.lineWidth = size * (0.02 - k * 0.004);
      g.beginPath();
      for (let t = 0; t < 1; t += 0.004) {
        const ang = t * Math.PI * 5 + k * 2.1;
        const rad = R * (0.08 + t * 0.72);
        const x = R + Math.cos(ang) * rad;
        const y = R + Math.sin(ang) * rad * 0.92;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  if (heart) {
    const art = document.createElement('canvas');
    art.width = art.height = size;
    const a = art.getContext('2d');
    a.fillStyle = '#f2e3cc';
    a.beginPath();
    const w = R * 0.9;
    const h = R * 0.8;
    a.moveTo(R, R + h * 0.52);
    a.bezierCurveTo(R - w * 0.6, R + h * 0.1, R - w * 0.6, R - h * 0.5, R - w * 0.22, R - h * 0.5);
    a.bezierCurveTo(R - w * 0.07, R - h * 0.5, R, R - h * 0.38, R, R - h * 0.28);
    a.bezierCurveTo(R, R - h * 0.38, R + w * 0.07, R - h * 0.52, R + w * 0.24, R - h * 0.5);
    a.bezierCurveTo(R + w * 0.62, R - h * 0.48, R + w * 0.58, R + h * 0.08, R, R + h * 0.52);
    a.fill();
    g.save();
    g.filter = blur(size * 0.012);
    g.globalAlpha = 0.4;
    g.drawImage(art, 0, 0);
    g.filter = blur(size * 0.003);
    g.globalAlpha = 0.96;
    g.drawImage(art, 0, 0);
    g.restore();
  }

  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,240,220,${0.04 + r() * 0.07})` : `rgba(40,18,5,${0.04 + r() * 0.07})`;
    g.fillRect(r() * size, r() * size, 1 + r(), 1 + r());
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cremaDisc(radius, opts) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshPhysicalMaterial({ map: cremaTexture(opts), roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 })
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/* ───────────── matte-black cup ───────────── */
const glaze = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x151110,
    roughness: 0.38,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
  });

/** A simple cappuccino cup: smooth flared bowl, small foot, loop handle. ~9 cm wide. */
export function createCup({ crema = { swirl: true } } = {}) {
  const H = 0.07;
  const wall = 0.0034;
  const outer = (t) => 0.029 + 0.016 * Math.pow(t, 0.85) + Math.sin(Math.PI * t) * 0.0035;
  const y = (t) => 0.006 + t * (H - 0.006);
  const pts = [new THREE.Vector2(0.0001, 0), new THREE.Vector2(0.024, 0), new THREE.Vector2(0.026, 0.0012), new THREE.Vector2(0.026, 0.004)];
  for (let i = 0; i <= 40; i++) pts.push(new THREE.Vector2(outer(i / 40), y(i / 40)));
  // rounded lip
  const rim = outer(1);
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(rim - wall / 2 + Math.cos(a) * (wall / 2), H + Math.sin(a) * (wall / 2) * 0.8));
  }
  for (let i = 40; i >= 4; i--) pts.push(new THREE.Vector2(outer(i / 40) - wall, y(i / 40)));
  pts.push(new THREE.Vector2(0.022, 0.0115), new THREE.Vector2(0.0001, 0.0115));
  const mat = glaze();
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 128), mat);

  const handlePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(outer(0.82) - 0.001, y(0.82), 0),
    new THREE.Vector3(outer(0.8) + 0.016, 0.062, 0),
    new THREE.Vector3(outer(0.6) + 0.024, 0.044, 0),
    new THREE.Vector3(outer(0.4) + 0.016, 0.026, 0),
    new THREE.Vector3(outer(0.35) - 0.001, y(0.33), 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handlePath, 64, 0.0042, 20), mat);

  const level = y(0.86);
  const coffee = cremaDisc(outer(0.86) - wall - 0.0004, crema);
  coffee.position.y = level;

  const cup = new THREE.Group();
  cup.add(bowl, handle, coffee);
  cup.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  cup.userData = { coffee, level, height: H };
  return cup;
}

/* ───────────── a glass drop holding espresso ───────────── */
export function createDrop({ quality = 'high' } = {}) {
  const H = 0.17;
  const R = 0.058;
  // teardrop: round belly low down, tapering to a point at the top
  const radius = (t) => R * Math.sin(Math.PI * Math.pow(t, 0.62)) * Math.pow(1 - t, 0.18);
  const profile = (scale = 1, upTo = 1) => {
    const pts = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * upTo;
      pts.push(new THREE.Vector2(Math.max(0.0001, radius(t) * scale), t * H * scale + (1 - scale) * H * 0.35));
    }
    return pts;
  };
  const seg = quality === 'high' ? 128 : 64;
  // glass against a dark backdrop: almost invisible face-on, bright at the edges (Fresnel)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.2,
    transparent: true,
    depthWrite: false,
  });
  glassMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.4);
       diffuseColor.a = mix(0.05, 0.85, fres);
       #include <opaque_fragment>`
    );
  };
  const glass = new THREE.Mesh(new THREE.LatheGeometry(profile(1), seg), glassMat);
  glass.renderOrder = 5;
  // espresso inside, filled to just past the widest point, with crema on top
  const fill = 0.52;
  const liquid = new THREE.Mesh(
    new THREE.LatheGeometry(profile(0.93, fill), seg),
    new THREE.MeshPhysicalMaterial({ color: 0x2a1205, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 })
  );
  const crema = cremaDisc(radius(fill) * 0.93, { swirl: true, size: 512 });
  crema.position.y = fill * H * 0.93 + 0.07 * H * 0.35;

  const drop = new THREE.Group();
  drop.add(liquid, crema, glass);
  drop.userData = { height: H, crema };
  return drop;
}

/* ───────────── caramel ribbons (thick, glossy, flowing) ───────────── */
/**
 * Each ribbon is an elliptical tube swept along a gently curving path whose
 * width, thickness and twist ripple over time, so it reads as poured syrup.
 */
export function createRibbons({ count = 3, quality = 'high', seed = 8 } = {}) {
  const U = quality === 'high' ? 140 : 80;
  const V = quality === 'high' ? 28 : 16;
  const r = rng(seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x9a4f1a,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffa860),
    sheenRoughness: 0.35,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  const ribbons = [];
  for (let k = 0; k < count; k++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((U + 1) * (V + 1) * 3);
    const idx = [];
    for (let i = 0; i < U; i++)
      for (let j = 0; j < V; j++) {
        const a = i * (V + 1) + j;
        const b = a + V + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    ribbons.push({
      mesh,
      pos,
      seed: r() * 10,
      x: (k - (count - 1) / 2) * 0.07 + (r() - 0.5) * 0.02,
      z: (r() - 0.5) * 0.08 - k * 0.03,
      width: 0.06 + r() * 0.035,
      thick: 0.016 + r() * 0.008,
    });
  }

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);
  group.update = (time, amount = 1) => {
    for (const rb of ribbons) {
      const path = (u, out) => {
        // a tall S-curve that drifts and breathes
        const y = (u - 0.5) * 0.4 - 0.06;
        const x = rb.x + Math.sin(u * 3.2 + rb.seed + time * 0.35) * 0.06 + Math.sin(u * 7 + time * 0.6 + rb.seed) * 0.012;
        const z = rb.z + Math.cos(u * 2.4 + rb.seed - time * 0.3) * 0.05;
        return out.set(x, y, z);
      };
      let o = 0;
      for (let i = 0; i <= U; i++) {
        const u = i / U;
        path(u, P);
        path(Math.min(1, u + 1 / U), T).sub(path(Math.max(0, u - 1 / U), N)).normalize();
        N.crossVectors(T, up).normalize();
        B.crossVectors(N, T).normalize();
        const twist = Math.sin(u * 4 + time * 0.5 + rb.seed) * 1.2;
        const c = Math.cos(twist);
        const s = Math.sin(twist);
        const nx = N.x * c + B.x * s;
        const ny = N.y * c + B.y * s;
        const nz = N.z * c + B.z * s;
        const bx = B.x * c - N.x * s;
        const by = B.y * c - N.y * s;
        const bz = B.z * c - N.z * s;
        // swell in the middle, taper to threads at both ends
        const env = Math.pow(Math.sin(Math.PI * u), 0.6) * amount;
        const w = rb.width * env * (1 + 0.25 * Math.sin(u * 9 - time * 1.4 + rb.seed));
        const th = rb.thick * env;
        for (let j = 0; j <= V; j++) {
          const a = (j / V) * Math.PI * 2;
          const cw = Math.cos(a) * w;
          const st = Math.sin(a) * th;
          rb.pos[o++] = P.x + nx * cw + bx * st;
          rb.pos[o++] = P.y + ny * cw + by * st;
          rb.pos[o++] = P.z + nz * cw + bz * st;
        }
      }
      rb.mesh.geometry.attributes.position.needsUpdate = true;
      rb.mesh.geometry.computeVertexNormals();
    }
  };
  group.update(0);
  return group;
}

/* ───────────── chrome portafilter ───────────── */
export function createPortafilter() {
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe6e3df, metalness: 1, roughness: 0.14, envMapIntensity: 1.3 });
  const brushed = new THREE.MeshPhysicalMaterial({ color: 0xbdb8b2, metalness: 1, roughness: 0.32 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x141110, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const v2 = (list) => list.map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();

  // basket body with a flared lip
  const body = new THREE.LatheGeometry(
    v2([
      [0.0001, -0.012],
      [0.022, -0.012],
      [0.027, -0.006],
      [0.03, 0.006],
      [0.031, 0.02],
      [0.037, 0.022],
      [0.037, 0.026],
      [0.031, 0.026],
      [0.029, 0.008],
      [0.0001, 0.008],
    ]),
    96
  );
  g.add(new THREE.Mesh(body, chrome));
  // locking ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.012), chrome);
    ear.position.set(0, 0.024, side * 0.04);
    g.add(ear);
  }
  // spout block and two spouts
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.014, 32), brushed);
  block.position.y = -0.019;
  g.add(block);
  const spouts = [];
  for (const side of [-1, 1]) {
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0042, 0.018, 20), brushed);
    spout.position.set(side * 0.008, -0.033, 0);
    spout.rotation.z = side * 0.32;
    g.add(spout);
    spouts.push(new THREE.Vector3(side * 0.0108, -0.042, 0));
  }
  // handle: chrome neck then a tapered black grip
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.009, 0.04, 24), chrome);
  neck.rotation.z = Math.PI / 2;
  neck.position.set(0.05, 0.004, 0);
  g.add(neck);
  const grip = new THREE.Mesh(
    new THREE.LatheGeometry(
      v2([
        [0.0001, 0],
        [0.0105, 0.004],
        [0.012, 0.03],
        [0.0135, 0.09],
        [0.0128, 0.11],
        [0.008, 0.118],
        [0.0001, 0.119],
      ]),
      48
    ),
    black
  );
  grip.rotation.z = -Math.PI / 2 + 0.08;
  grip.position.set(0.068, 0.004, 0);
  g.add(grip);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  g.userData.spouts = spouts;
  return g;
}

/* ───────────── espresso streams ───────────── */
export function createStreams(count = 2) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x6e3510, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vFlow;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float f = position.y * 60.0 + uTime * 9.0;
         transformed.xz *= 0.85 + 0.25 * sin(f) * sin(f * 0.37);
         transformed.x += sin(position.y * 23.0 + uTime * 4.0) * 0.0003;
         vFlow = f;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.8 + 0.35 * sin(vFlow * 0.5);');
  };
  const streams = [];
  for (let i = 0; i < count; i++) {
    const geo = new THREE.CylinderGeometry(0.0017, 0.0013, 1, 16, 120, true);
    geo.translate(0, -0.5, 0); // hangs down from its top
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    group.add(m);
    streams.push(m);
  }
  /** Place each stream from a spout tip (world) down to `bottomY`; `amount` 0..1 grows the pour. */
  group.place = (tips, bottomY, amount, time) => {
    uniforms.uTime.value = time;
    streams.forEach((m, i) => {
      const tip = tips[i];
      const len = Math.max(0.0001, (tip.y - bottomY) * amount);
      m.position.copy(tip);
      const on = amount > 0.001 ? 1 : 0;
      m.scale.set(on, len, on);
    });
  };
  return group;
}

/* ───────────── roasted beans (instanced) ───────────── */
const BEAN_SCALE = 0.0042;
const BEAN_TONES = [0x2a1407, 0x331909, 0x3b1d0b, 0x24110a, 0x46260f];

function beanGeometry(quality) {
  const geo = new THREE.SphereGeometry(1, quality === 'high' ? 40 : 24, quality === 'high' ? 28 : 18);
  const pos = geo.attributes.position;
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    beanSurface(pos.getX(i), pos.getY(i), pos.getZ(i), p);
    pos.setXYZ(i, p[0] * BEAN_SCALE, p[1] * BEAN_SCALE, p[2] * BEAN_SCALE);
  }
  geo.computeVertexNormals();
  return geo;
}
const beanMaterial = () => new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });

/** A burst of beans around a point. `update(e)` with e 0..1: 0 = packed tight, 1 = flung out. */
export function createBeanBurst({ count = 160, quality = 'high', radius = 0.42, seed = 3 } = {}) {
  const mesh = new THREE.InstancedMesh(beanGeometry(quality), beanMaterial(), count);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const r = rng(seed);
  const beans = [];
  for (let i = 0; i < count; i++) {
    // directions biased to a flattened shell so the burst reads as a ring around the portafilter
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    beans.push({
      dir: new THREE.Vector3(Math.cos(a) * s, u * 0.65, Math.sin(a) * s * 0.7).normalize(),
      dist: radius * (0.35 + Math.pow(r(), 0.7) * 0.75),
      spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      speed: 1 + r() * 3,
      phase: r() * 6,
      scale: 0.85 + r() * 0.35,
    });
    mesh.setColorAt(i, new THREE.Color(BEAN_TONES[Math.floor(r() * BEAN_TONES.length)]));
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  mesh.update = (e, time) => {
    const ease = 1 - Math.pow(1 - Math.min(1, Math.max(0, e)), 3);
    const shown = smooth(0, 0.08, e);
    beans.forEach((b, i) => {
      p.copy(b.dir).multiplyScalar(0.02 + b.dist * ease);
      p.y += Math.sin(time * 0.6 + b.phase) * 0.004 * ease;
      q.setFromAxisAngle(b.spin, b.phase + time * 0.25 * b.speed + ease * b.speed * 2);
      m.compose(p, q, sc.setScalar(shown * b.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.update(0, 0);
  return mesh;
}

/** A handful of beans lying on a surface around a point (for still lifes). */
export function createBeanScatter({ count = 16, quality = 'high', ring = [0.07, 0.16], seed = 4 } = {}) {
  const mesh = new THREE.InstancedMesh(beanGeometry(quality), beanMaterial(), count);
  mesh.castShadow = mesh.receiveShadow = true;
  const r = rng(seed);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = ring[0] + Math.pow(r(), 0.8) * (ring[1] - ring[0]);
    const flip = r() > 0.4 ? -1 : 1;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((flip * Math.PI) / 2, r() * Math.PI * 2, 0, 'YXZ'));
    m.compose(new THREE.Vector3(Math.cos(a) * d, 0.82 * BEAN_SCALE, Math.sin(a) * d), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color(BEAN_TONES[Math.floor(r() * BEAN_TONES.length)]));
  }
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
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), wisp * sides * vertical * uStrength * 0.32);
  }
`;

export function createSteam({ wisps = 3, width = 0.08, height = 0.18 } = {}) {
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
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.x = (i - (wisps - 1) / 2) * width * 0.22;
    mesh.position.z = (i % 2 ? 1 : -1) * 0.004;
    mesh.renderOrder = 10;
    group.add(mesh);
  }
  const cam = new THREE.Vector3();
  const me = new THREE.Vector3();
  group.update = (time, camera, strength = 1) => {
    uniforms.forEach((u) => {
      u.uTime.value = time;
      u.uStrength.value = strength;
    });
    camera.getWorldPosition(cam);
    group.getWorldPosition(me);
    group.rotation.y = Math.atan2(cam.x - me.x, cam.z - me.z);
  };
  return group;
}

/* ───────────── shadows ───────────── */
export function createShadowCatcher(size = 4, opacity = 0.45) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ color: 0x000000, opacity }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
