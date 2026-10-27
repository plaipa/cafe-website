import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glass as GLASS, kinds } from '../../../partials/menu-data.js';

/* The STRATA glass and what goes into it.
   A tapered tumbler with a thick base, sitting on a travertine coaster. Its contents
   are a stack of solid layers that follow the inside of the glass exactly, so a drink
   can be built, rebuilt as another drink, or pulled apart into an exploded view. */

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

const COASTER = { r: 0.056, h: 0.006 };
const outerR = (y) => GLASS.rBottom + ((GLASS.rTop - GLASS.rBottom) * y) / GLASS.height;
/** Inside radius of the glass at height `y` (above the coaster top). */
export const innerR = (y) => outerR(y) - GLASS.wall;
/** Millilitres → height inside the glass. */
export const mlToHeight = (ml) => (ml / GLASS.ml) * (GLASS.fillTop - GLASS.base);

function arc(points, cx, cy, r, a0, a1, steps) {
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    points.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

/** Profile of the glass, walked so that every normal points out of the glass. */
function glassProfile() {
  const { height: H, base: B, wall: t } = GLASS;
  const p = [new THREE.Vector2(0, 0)];
  // underside, with a softly rounded outer foot
  arc(p, outerR(0) - 0.004, 0.004, 0.004, -Math.PI / 2, 0, 6);
  // outer wall up to the rim, then over the rounded lip and down the inside
  for (let i = 1; i <= 10; i++) {
    const y = lerp(0.004, H - t / 2, i / 10);
    p.push(new THREE.Vector2(outerR(y), y));
  }
  arc(p, outerR(H) - t / 2, H - t / 2, t / 2, 0, Math.PI, 8);
  for (let i = 1; i <= 10; i++) {
    const y = lerp(H - t / 2, B + 0.004, i / 10);
    p.push(new THREE.Vector2(innerR(y), y));
  }
  // rounded inner corner, then across the top of the solid base to the axis
  arc(p, innerR(B) - 0.004, B + 0.004, 0.004, 0, -Math.PI / 2, 6);
  p.push(new THREE.Vector2(0, B));
  return p;
}

/** A solid layer between y0 and y1, its side following the glass, edges softly rounded. */
function layerProfile(y0, y1, inset = 0.0004) {
  const h = Math.max(0.00001, y1 - y0);
  const round = Math.min(0.0016, h / 2.2);
  const r0 = innerR(y0) - inset;
  const r1 = innerR(y1) - inset;
  const p = [new THREE.Vector2(0, y0)];
  arc(p, r0 - round, y0 + round, round, -Math.PI / 2, 0, 3);
  arc(p, r1 - round, y1 - round, round, 0, Math.PI / 2, 3);
  p.push(new THREE.Vector2(0, y1));
  return p;
}

/* — textures drawn on canvas — */
function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The top of the foam: a ring of crema and a poured heart. */
function latteArt() {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    g.fillStyle = kinds.foam.tone;
    g.fillRect(0, 0, s, s);
    const ring = g.createRadialGradient(c, c, s * 0.18, c, c, s * 0.5);
    ring.addColorStop(0, '#c99a6a');
    ring.addColorStop(0.55, '#b98552');
    ring.addColorStop(1, '#a8723f');
    g.fillStyle = ring;
    g.beginPath();
    g.arc(c, c, s * 0.5, 0, TAU);
    g.fill();
    // the heart, pulled through at the end of the pour
    g.save();
    g.translate(c, c + s * 0.03);
    g.fillStyle = kinds.foam.tone;
    g.shadowColor = 'rgba(120,70,30,0.35)';
    g.shadowBlur = s * 0.02;
    g.beginPath();
    const w = s * 0.25;
    g.moveTo(0, w * 0.95);
    g.bezierCurveTo(-w * 1.25, w * 0.15, -w * 0.95, -w * 0.95, 0, -w * 0.42);
    g.bezierCurveTo(w * 0.95, -w * 0.95, w * 1.25, w * 0.15, 0, w * 0.95);
    g.fill();
    g.restore();
    // a few tiny bubbles keep it from looking printed
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * s * 0.48;
      g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
      g.beginPath();
      g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 0.6 + Math.random() * 1.6, 0, TAU);
      g.fill();
    }
  });
}

/** Tiger-striped crema for an espresso that ends the drink. */
function cremaTop() {
  return canvasTexture(256, (g, s) => {
    const c = s / 2;
    const grad = g.createRadialGradient(c * 0.9, c * 0.9, 0, c, c, c);
    grad.addColorStop(0, '#c58f58');
    grad.addColorStop(0.7, '#a86e3a');
    grad.addColorStop(1, '#6c3d1c');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '90,45,18' : '214,170,120'},${0.08 + Math.random() * 0.12})`;
      g.beginPath();
      g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 0, TAU);
      g.fill();
    }
  });
}

/** Fine noise used as a bump map so milk and foam aren't plastic-smooth. */
function grain() {
  const tex = canvasTexture(256, (g, s) => {
    const img = g.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/** One material per kind of ingredient, built once and shared. */
function makeMaterials() {
  const bump = grain();
  const M = (kind, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(kinds[kind].tone), roughness: 0.5, ...extra });
  return {
    espresso: M('espresso', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    crema: M('crema', { roughness: 0.55, bumpMap: bump, bumpScale: 0.4 }),
    chocolate: M('chocolate', { roughness: 0.3, clearcoat: 0.4 }),
    syrup: M('syrup', { roughness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.05 }),
    milk: M('milk', { roughness: 0.62, sheen: 0.5, sheenColor: new THREE.Color('#fff6ea'), sheenRoughness: 0.6 }),
    saffron: M('saffron', { roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#fff0c8') }),
    matcha: M('matcha', { roughness: 0.6, bumpMap: bump, bumpScale: 0.25 }),
    tea: M('tea', { roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.05 }),
    water: M('water', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.05 }),
    tonic: M('tonic', { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.05 }),
    foam: M('foam', { roughness: 0.9, bumpMap: bump, bumpScale: 0.8 }),
    ice: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(kinds.ice.tone), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 }),
    art: new THREE.MeshStandardMaterial({ map: latteArt(), roughness: 0.85 }),
    cremaTop: new THREE.MeshStandardMaterial({ map: cremaTop(), roughness: 0.4 }),
  };
}

/**
 * Build the glass on its coaster, with up to `slots` layers of drink.
 * Returns a THREE.Group with a small API:
 *   setDrink(layers)   [[kind, ml], …] from the bottom up; the stack eases into it
 *   fills              per-layer 0..1 multipliers (the home story pours layer by layer)
 *   setExplode(e)      0..1 pulls the layers apart vertically, the glass drops away
 *   update(dt)         ease towards the targets (dt >= 1 snaps)
 *   anchor(i, dir, out) world point at the edge of layer i, towards screen direction `dir`
 */
export function createGlass({ quality = 'high', slots = 5 } = {}) {
  const high = quality === 'high';
  const group = new THREE.Group();
  const mats = makeMaterials();

  // travertine coaster
  const coaster = new THREE.Mesh(
    new THREE.CylinderGeometry(COASTER.r, COASTER.r, COASTER.h, 96),
    new THREE.MeshStandardMaterial({ color: 0xbdb3a5, roughness: 0.95, bumpMap: grain(), bumpScale: 1.5 })
  );
  coaster.position.y = COASTER.h / 2;
  coaster.castShadow = coaster.receiveShadow = true;
  group.add(coaster);

  // the glass: real transmission, a touch of thickness and a clean rim
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.0016,
    ior: 1.4,
    specularIntensity: 1,
    envMapIntensity: 1.4,
    attenuationColor: new THREE.Color('#eef4f0'),
    attenuationDistance: 0.25,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(), high ? 128 : 72), glassMat);
  const body = new THREE.Group(); // glass + contents, standing on the coaster
  body.position.y = COASTER.h;
  body.add(glass);
  group.add(body);

  // layers of drink
  const segs = high ? 96 : 56;
  const layers = Array.from({ length: slots }, () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mats.milk);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    const top = new THREE.Mesh(new THREE.CircleGeometry(1, segs), mats.art);
    top.rotation.x = -Math.PI / 2;
    top.visible = false;
    mesh.add(top);
    body.add(mesh);
    return { mesh, top, kind: null, h: 0, target: 0, key: '', ice: null };
  });

  // ice is a handful of rounded cubes rather than a solid layer
  const cube = new RoundedBoxGeometry(0.019, 0.017, 0.019, 3, 0.0035);
  function iceFor(layer) {
    if (layer.ice) return layer.ice;
    const ice = new THREE.Group();
    const spots = [
      [-0.011, 0.009, 0.006, 0.3],
      [0.01, 0.01, -0.008, 1.1],
      [0.004, 0.011, 0.012, 2.2],
      [-0.006, 0.027, -0.006, 0.7],
      [0.008, 0.028, 0.006, 1.8],
    ];
    for (const [x, y, z, r] of spots) {
      const m = new THREE.Mesh(cube, mats.ice);
      m.position.set(x, y, z);
      m.rotation.set(r * 0.4, r, r * 0.3);
      m.castShadow = true;
      ice.add(m);
    }
    layer.mesh.add(ice);
    layer.ice = ice;
    return ice;
  }

  const fills = new Array(slots).fill(1);
  let explode = 0;

  function setDrink(list) {
    layers.forEach((l, i) => {
      const item = list[i];
      if (item) {
        const [kind, ml] = item;
        if (l.kind !== kind) {
          // a new ingredient grows in from nothing
          if (l.kind) l.h = 0;
          l.kind = kind;
        }
        l.target = mlToHeight(ml);
      } else {
        l.target = 0;
      }
    });
  }

  function rebuild(l, y0, y1, isTop) {
    const key = `${y0.toFixed(5)}:${y1.toFixed(5)}:${l.kind}:${isTop}`;
    if (key === l.key) return;
    l.key = key;
    const ice = l.kind === 'ice';
    const show = y1 - y0 > 0.0002;
    l.mesh.visible = show;
    if (!show) return;
    if (ice) {
      l.mesh.geometry.dispose();
      l.mesh.geometry = new THREE.BufferGeometry();
      const g = iceFor(l);
      g.visible = true;
      g.position.y = y0;
      g.scale.setScalar(Math.min(1, (y1 - y0) / 0.035));
      l.top.visible = false;
      return;
    }
    if (l.ice) l.ice.visible = false;
    l.mesh.geometry.dispose();
    l.mesh.geometry = new THREE.LatheGeometry(layerProfile(y0, y1), segs);
    l.mesh.material = mats[l.kind] || mats.milk;
    // the last layer shows its face: latte art on foam, crema on espresso
    const face = isTop && (l.kind === 'foam' ? mats.art : l.kind === 'espresso' ? mats.cremaTop : null);
    l.top.visible = !!face;
    if (face) {
      l.top.material = face;
      l.top.position.y = y1 + 0.00015;
      l.top.scale.setScalar(innerR(y1) - 0.0016);
    }
  }

  // exploded view: every layer clears the rim, stacked with a small gap, the top one leaving first
  const GAP = 0.022;
  const LIFT = GLASS.height - GLASS.base + 0.014;
  const lift = (i, n) => {
    const t = Math.min(1, Math.max(0, explode * 1.35 - (n - 1 - i) * 0.09));
    return (LIFT + i * GAP) * t * t * (3 - 2 * t);
  };
  function update(dt) {
    const k = dt >= 1 ? 1 : 1 - Math.pow(0.004, dt);
    let y = GLASS.base;
    let topIndex = -1;
    layers.forEach((l, i) => {
      l.h = lerp(l.h, l.target, k);
      if (l.h * fills[i] > 0.0002) topIndex = i;
    });
    const n = topIndex + 1;
    layers.forEach((l, i) => {
      if (!l.kind) return;
      const h = l.h * fills[i];
      rebuild(l, y, y + h, i === topIndex);
      l.mesh.position.y = lift(i, n);
      y += h;
    });
  }
  const count = () => layers.reduce((n, l, i) => (l.kind && l.h * fills[i] > 0.0002 ? i + 1 : n), 0);

  const tmp = new THREE.Vector3();
  return Object.assign(group, {
    slots: layers,
    fills,
    glass,
    coaster,
    setDrink,
    update,
    setExplode(e) {
      explode = e;
    },
    getExplode: () => explode,
    /** Height of the drink's surface (for steam, labels…), in group space. */
    surface() {
      return layers.reduce((y, l, i) => y + (l.kind ? l.h * fills[i] : 0), GLASS.base) + COASTER.h;
    },
    /**
     * World point on the rim of layer `i` (middle of its height), pushed out
     * towards `dir` (a world direction, usually the camera's screen-right).
     */
    anchor(i, dir, out = new THREE.Vector3()) {
      let y = GLASS.base;
      for (let j = 0; j < i; j++) y += layers[j].kind ? layers[j].h * fills[j] : 0;
      const l = layers[i];
      const h = l.kind ? l.h * fills[i] : 0;
      const mid = y + h / 2;
      tmp.copy(dir).setY(0).normalize().multiplyScalar(innerR(mid) + 0.001);
      // the glass is round, so its spin doesn't matter: measure in world space
      out.set(tmp.x, COASTER.h + mid + lift(i, count()), tmp.z);
      return out.add(group.position);
    },
    /** World point on the glass wall (for its own label). */
    glassAnchor(dir, out = new THREE.Vector3()) {
      const y = GLASS.height * 0.9;
      tmp.copy(dir).setY(0).normalize().multiplyScalar(outerR(y));
      out.set(tmp.x, COASTER.h + y, tmp.z);
      return out.add(group.position);
    },
  });
}
