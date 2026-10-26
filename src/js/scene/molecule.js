import * as THREE from 'three';

/* ───────────── Caffeine, C8H10N4O2 ─────────────
   Planar purine core (a six-ring fused to a five-ring) built from regular
   polygons with ~1.39 Å bonds; carbonyl O at 1.23 Å, methyl C at 1.47 Å,
   C–H at 1.09 Å with tetrahedral hydrogens. Units are ångström. */

function buildCaffeine() {
  const atoms = [];
  const bonds = [];
  const add = (el, x, y, z = 0) => atoms.push({ el, p: new THREE.Vector3(x, y, z) }) - 1;
  const bond = (a, b, order = 1) => bonds.push([a, b, order]);
  const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

  // six-membered ring around the origin
  const R6 = 1.39;
  const C5 = add('C', ...polar(R6, 30));
  const C6 = add('C', ...polar(R6, 90));
  const N1 = add('N', ...polar(R6, 150));
  const C2 = add('C', ...polar(R6, 210));
  const N3 = add('N', ...polar(R6, 270));
  const C4 = add('C', ...polar(R6, 330));
  // five-membered ring fused on the C4–C5 edge
  const cp = new THREE.Vector2(R6 * Math.cos(Math.PI / 6) + 1.39 / (2 * Math.tan(Math.PI / 5)), 0);
  const Rp = 1.39 / (2 * Math.sin(Math.PI / 5));
  const onPent = (deg) => [cp.x + Rp * Math.cos((deg * Math.PI) / 180), cp.y + Rp * Math.sin((deg * Math.PI) / 180)];
  const N7 = add('N', ...onPent(72));
  const C8 = add('C', ...onPent(0));
  const N9 = add('N', ...onPent(-72));

  bond(N1, C2);
  bond(C2, N3);
  bond(N3, C4);
  bond(C4, C5, 2);
  bond(C5, C6);
  bond(C6, N1);
  bond(C5, N7);
  bond(N7, C8);
  bond(C8, N9, 2);
  bond(N9, C4);

  // substituents point away from their ring's centre
  const outward = (i, centre, len, el) => {
    const d = atoms[i].p.clone().sub(centre).setZ(0).normalize();
    return add(el, atoms[i].p.x + d.x * len, atoms[i].p.y + d.y * len);
  };
  const c6 = new THREE.Vector3(0, 0, 0);
  const c5 = new THREE.Vector3(cp.x, cp.y, 0);
  const O2 = outward(C2, c6, 1.23, 'O');
  const O6 = outward(C6, c6, 1.23, 'O');
  bond(C2, O2, 2);
  bond(C6, O6, 2);
  const H8 = outward(C8, c5, 1.08, 'H');
  bond(C8, H8);

  const methyls = [];
  for (const [n, centre] of [
    [N1, c6],
    [N3, c6],
    [N7, c5],
  ]) {
    const m = outward(n, centre, 1.47, 'C');
    bond(n, m);
    methyls.push(m);
    // three hydrogens in a tetrahedral fan around the N→C axis
    const axis = atoms[m].p.clone().sub(atoms[n].p).normalize();
    const side = new THREE.Vector3(-axis.y, axis.x, 0);
    const up = new THREE.Vector3(0, 0, 1);
    for (const phi of [90, 210, 330]) {
      const r = (phi * Math.PI) / 180;
      const dir = axis
        .clone()
        .multiplyScalar(0.334)
        .add(side.clone().multiplyScalar(0.943 * Math.cos(r)))
        .add(up.clone().multiplyScalar(0.943 * Math.sin(r)));
      const h = add('H', ...atoms[m].p.clone().addScaledVector(dir, 1.09).toArray());
      bond(m, h);
    }
  }

  // centre on the centroid of the heavy atoms
  const centroid = new THREE.Vector3();
  const heavy = atoms.filter((a) => a.el !== 'H');
  heavy.forEach((a) => centroid.add(a.p));
  centroid.divideScalar(heavy.length);
  atoms.forEach((a) => a.p.sub(centroid));

  return { atoms, bonds, marks: { O6, N7, methyl: methyls[0], C8 } };
}

export const CAFFEINE = buildCaffeine();

const ELEMENTS = {
  C: { color: 0x3a3634, radius: 0.36 },
  N: { color: 0x3f6fd1, radius: 0.34 },
  O: { color: 0xd8483a, radius: 0.35 },
  H: { color: 0xf4f1ec, radius: 0.22 },
};

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Many caffeine molecules drawn with a handful of instanced meshes
 * (one per element plus one for bond sticks), so dozens cost a few draw calls.
 * `unit` is metres per ångström.
 */
export class MoleculeField extends THREE.Group {
  constructor({ max = 1, unit = 0.012, quality = 'high' } = {}) {
    super();
    this.max = max;
    this.unit = unit;
    const seg = quality === 'high' ? 28 : 16;
    const sphere = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    const stick = new THREE.CylinderGeometry(1, 1, 1, quality === 'high' ? 16 : 10, 1, true);
    stick.translate(0, 0.5, 0); // pivot at one end

    this.meshes = {};
    this.slots = {}; // atom index -> instance slot within its element mesh
    const counts = {};
    CAFFEINE.atoms.forEach((a, i) => {
      counts[a.el] = (counts[a.el] || 0) + 1;
      this.slots[i] = counts[a.el] - 1;
    });
    for (const [el, def] of Object.entries(ELEMENTS)) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        roughness: el === 'H' ? 0.32 : 0.26,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.1,
      });
      const mesh = new THREE.InstancedMesh(sphere, mat, counts[el] * max);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.meshes[el] = { mesh, per: counts[el], radius: def.radius };
      this.add(mesh);
    }
    // each double bond is two thinner parallel sticks
    this.sticks = CAFFEINE.bonds.flatMap(([a, b, order]) =>
      order === 2 ? [[a, b, -1], [a, b, 1]] : [[a, b, 0]]
    );
    this.bondMesh = new THREE.InstancedMesh(
      stick,
      new THREE.MeshPhysicalMaterial({ color: 0xd9d2c8, roughness: 0.35, clearcoat: 0.6 }),
      this.sticks.length * max
    );
    this.bondMesh.castShadow = true;
    this.bondMesh.frustumCulled = false;
    this.add(this.bondMesh);

    this.positions = Array.from({ length: max }, () => CAFFEINE.atoms.map(() => new THREE.Vector3()));
    this.visible01 = Array.from({ length: max }, () => CAFFEINE.atoms.map(() => 0));
    for (let i = 0; i < max; i++) this.hide(i);
  }

  hide(i) {
    tmpM.makeScale(0, 0, 0);
    for (const { mesh, per } of Object.values(this.meshes)) for (let k = 0; k < per; k++) mesh.setMatrixAt(i * per + k, tmpM);
    for (let k = 0; k < this.sticks.length; k++) this.bondMesh.setMatrixAt(i * this.sticks.length + k, tmpM);
    this.dirty();
  }

  /**
   * Place molecule `i`. `matrix` maps molecule space (Å, scaled by `this.unit`) into this group.
   * `assembly` 0..1 flies the atoms in from `sources` (one Vector3 per atom, group space);
   * `size` 0..1 grows/shrinks the whole molecule.
   */
  set(i, matrix, { assembly = 1, sources = null, size = 1 } = {}) {
    const pos = this.positions[i];
    const vis = this.visible01[i];
    CAFFEINE.atoms.forEach((atom, a) => {
      tmpV.copy(atom.p).multiplyScalar(this.unit).applyMatrix4(matrix);
      let t = 1;
      if (sources && assembly < 1) {
        // heavier atoms arrive first, hydrogens last
        const delay = (atom.el === 'H' ? 0.45 : 0.1) + ((a * 0.137) % 0.25);
        t = ease(Math.min(1, Math.max(0, (assembly - delay * 0.8) / 0.45)));
        tmpV.lerpVectors(sources[a], tmpV, t);
      }
      pos[a].copy(tmpV);
      vis[a] = t;
      const { mesh, per, radius } = this.meshes[atom.el];
      const r = radius * this.unit * size * (0.35 + 0.65 * t);
      tmpM.compose(tmpV, tmpQ.identity(), tmpS.set(r, r, r));
      mesh.setMatrixAt(i * per + this.slots[a], tmpM);
    });
    this.sticks.forEach(([a, b, side], k) => {
      const shown = Math.min(vis[a], vis[b]) > 0.97 ? size : 0;
      const from = pos[a];
      const dir = tmpV.subVectors(pos[b], from);
      const len = dir.length();
      tmpQ.setFromUnitVectors(Y, dir.normalize());
      const r = (side ? 0.055 : 0.085) * this.unit * shown;
      const offset = new THREE.Vector3();
      if (side) {
        // spread the two sticks of a double bond apart, perpendicular to the bond, in the ring plane
        const n = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
        offset.crossVectors(dir, n).normalize().multiplyScalar(side * 0.11 * this.unit * size);
      }
      tmpM.compose(from.clone().add(offset), tmpQ, tmpS.set(r, len * (shown ? 1 : 0), r));
      this.bondMesh.setMatrixAt(i * this.sticks.length + k, tmpM);
    });
    this.dirty();
  }

  dirty() {
    for (const { mesh } of Object.values(this.meshes)) mesh.instanceMatrix.needsUpdate = true;
    this.bondMesh.instanceMatrix.needsUpdate = true;
  }

  /** Current position (group space) of an atom of molecule `i`; used to pin DOM labels. */
  atom(i, a) {
    return this.positions[i][a];
  }
}
