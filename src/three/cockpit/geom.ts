import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry helpers for the cockpit: a profile sweep (with crisp creases and metre-based UVs),
 * curve framing, and merging into a few static draw calls.
 */

/** 2D profile point: [x, y, sharp crease]. */
export type P2 = readonly [x: number, y: number, sharp?: 0 | 1];

/** A frame along a path: origin, tangent, and the axes the profile's x / y map onto. */
export interface Frame {
  p: Vector3;
  t: Vector3;
  n: Vector3;
  b: Vector3;
}

export interface SweepOptions {
  /** Profile is a loop (start it mid-way along a flat side so the seam is invisible). */
  closed?: boolean;
  /** Cap both ends with the triangulated profile. */
  caps?: boolean;
  /** Reverse the winding (normals point the other way). */
  flip?: boolean;
}

const _v = new Vector3();

/**
 * Sweeps `profile` along `frames` (profile x → frame.n, y → frame.b, n × b = t).
 * A counter-clockwise profile gets outward normals. Sharp points are split so faces meeting there shade crisply.
 * UVs: u = arc length along the path (m), v = arc length along the profile (m).
 */
export function sweep(profile: readonly P2[], frames: readonly Frame[], opts: SweepOptions = {}): BufferGeometry {
  const { closed = false, caps = false, flip = false } = opts;
  const pts = closed ? [...profile, profile[0]] : [...profile];
  type E = { x: number; y: number; v: number; start: boolean };
  const ex: E[] = [];
  let v = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, y, s] = pts[k];
    if (k > 0) v += Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]);
    ex.push({ x, y, v, start: false });
    if (s && k > 0 && k < pts.length - 1) ex.push({ x, y, v, start: true });
  }
  const E = ex.length;
  const F = frames.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let u = 0;
  for (let i = 0; i < F; i++) {
    const f = frames[i];
    if (i > 0) u += f.p.distanceTo(frames[i - 1].p);
    for (const e of ex) {
      _v.copy(f.p).addScaledVector(f.n, e.x).addScaledVector(f.b, e.y);
      pos.push(_v.x, _v.y, _v.z);
      uv.push(u, e.v);
    }
  }
  for (let i = 0; i < F - 1; i++) {
    for (let j = 0; j < E - 1; j++) {
      if (ex[j + 1].start) continue;
      const a = i * E + j;
      const b = a + 1;
      const c = a + E;
      const d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const body = geo.toNonIndexed();
  geo.dispose();
  if (!caps) return body;

  const contour = profile.map(([x, y]) => new Vector2(x, y));
  const tris = ShapeUtils.triangulateShape(contour, []);
  const cap = (f: Frame, dir: number) => {
    const cp: number[] = [];
    const cn: number[] = [];
    const cu: number[] = [];
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const put = (p: Vector3, k: number) => {
      cp.push(p.x, p.y, p.z);
      cn.push(f.t.x * dir, f.t.y * dir, f.t.z * dir);
      cu.push(profile[k][0], profile[k][1]);
    };
    const at = (k: number, out: Vector3) => out.copy(f.p).addScaledVector(f.n, profile[k][0]).addScaledVector(f.b, profile[k][1]);
    for (const [i0, i1, i2] of tris) {
      at(i0, a);
      at(i1, b);
      at(i2, c);
      const nrm = _v.copy(b).sub(a).cross(c.clone().sub(a));
      const ok = nrm.dot(f.t) * dir > 0;
      if (ok) {
        put(a, i0);
        put(b, i1);
        put(c, i2);
      } else {
        put(a, i0);
        put(c, i2);
        put(b, i1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(cp, 3));
    g.setAttribute('normal', new Float32BufferAttribute(cn, 3));
    g.setAttribute('uv', new Float32BufferAttribute(cu, 2));
    return g;
  };
  return merge([body, cap(frames[0], -1), cap(frames[F - 1], 1)]);
}

/**
 * Frames along sampled points. `up(p, t)` returns the reference for the profile's y axis
 * (made perpendicular to the tangent); x = y × t.
 */
export function framesFromPoints(points: readonly Vector3[], up: (p: Vector3, t: Vector3) => Vector3): Frame[] {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    const b = up(p, t).clone();
    b.addScaledVector(t, -b.dot(t)).normalize();
    const nn = new Vector3().crossVectors(b, t).normalize();
    return { p: p.clone(), t, n: nn, b };
  });
}

/** Samples a centripetal Catmull-Rom curve through `pts` into `count` evenly spaced points. */
export function curvePoints(pts: readonly (readonly [number, number, number])[], count: number, closed = false): Vector3[] {
  const curve = new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z)), closed, 'centripetal');
  return curve.getSpacedPoints(count - 1);
}

/** Frames whose profile y axis points at `target` (e.g. the pilot's eye). */
export const towards = (target: Vector3) => (p: Vector3) => _tmpUp.copy(target).sub(p);
const _tmpUp = new Vector3();

/** Rounded rectangle profile centred on x, spanning y0..y1 (counter-clockwise, starting mid top edge). */
export function roundedRect(w: number, y0: number, y1: number, r: number, seg = 3): P2[] {
  const hw = w / 2;
  const out: P2[] = [[0, y1]];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let s = 0; s <= seg; s++) {
      const a = a0 + (s / seg) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(-hw + r, y1 - r, Math.PI / 2);
  corner(-hw + r, y0 + r, Math.PI);
  corner(hw - r, y0 + r, (3 * Math.PI) / 2);
  corner(hw - r, y1 - r, 0);
  return out;
}

/** Keeps only position/normal/uv, non-indexed, so geometries can be merged. */
export function normalize(geo: BufferGeometry): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
  if (g !== geo) geo.dispose();
  return g;
}

/** Merges geometries into one (disposing the inputs). */
export function merge(geos: BufferGeometry[]): BufferGeometry {
  const list = geos.map(normalize);
  const out = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  if (!out) throw new Error('cockpit: geometry merge failed');
  return out;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();

/** Applies a transform built from position, quaternion and scale to a geometry (in place). */
export function place(geo: BufferGeometry, p: Vector3, q: Quaternion = _q.identity(), s: Vector3 = _s.set(1, 1, 1)): BufferGeometry {
  _m.compose(p, q, s);
  geo.applyMatrix4(_m);
  return geo;
}

/** Applies a basis matrix (x, y, z axes + origin) to a geometry (in place). */
export function placeBasis(geo: BufferGeometry, m: Matrix4): BufferGeometry {
  geo.applyMatrix4(m);
  return geo;
}

/** Scales a geometry's UVs (e.g. to metres for unit-UV primitives). */
export function scaleUv(geo: BufferGeometry, su: number, sv: number, ou = 0, ov = 0): BufferGeometry {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  uv.needsUpdate = true;
  return geo;
}
