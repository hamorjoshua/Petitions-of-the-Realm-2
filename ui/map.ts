// The map as drawn: each square cell of the realm becomes a shire-like polygon around a relaxed, jittered point, so
// places read as valleys and parishes rather than a grid. Only the drawing changes; the realm's cells are untouched.

type Pt = [number, number];
export interface Geometry { side: number; pts: Pt[]; polys: Pt[][]; nbrs: number[][] }

/** A small seeded generator, for the drawing only: the same realm is always drawn the same way. */
export function rand(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

/** Keep the part of a polygon on the near side of the perpendicular bisector between p and q. */
function clip(poly: Pt[], p: Pt, q: Pt): Pt[] {
  const nx = q[0] - p[0], ny = q[1] - p[1], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  const side = (v: Pt): number => (v[0] - mx) * nx + (v[1] - my) * ny;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
const d2 = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
function centroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i]!, q = poly[(i + 1) % poly.length]!, k = p[0] * q[1] - q[0] * p[1]; a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k; }
  return Math.abs(a) < 1e-9 ? poly[0]! : [cx / (3 * a), cy / (3 * a)];
}
function cells(side: number, pts: Pt[]): Pt[][] {
  return pts.map((p, i) => {
    const x = i % side, y = Math.floor(i / side);
    let poly: Pt[] = [[0, 0], [side, 0], [side, side], [0, side]];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < side && Y < side) poly = clip(poly, p, pts[Y * side + X]!); }
    return poly;
  });
}

const cache = new Map<string, Geometry>();
/** The polygons of a realm of side × side cells, seeded by the realm's seed, relaxed twice toward their centroids. */
export function geometry(side: number, seed: number): Geometry {
  const key = `${side}:${seed}`, hit = cache.get(key);
  if (hit) return hit;
  const r = rand(seed + 7919);
  let pts: Pt[] = [];
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) pts.push([x + 0.2 + 0.6 * r(), y + 0.2 + 0.6 * r()]);
  let polys = cells(side, pts);
  for (let pass = 0; pass < 2; pass++) { pts = polys.map(centroid); polys = cells(side, pts); }
  const nbrs = polys.map((poly, i) => {
    const x = i % side, y = Math.floor(i / side), out: number[] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy, j = Y * side + X; if ((dx || dy) && X >= 0 && Y >= 0 && X < side && Y < side && poly.filter(v => Math.abs(d2(v, pts[i]!) - d2(v, pts[j]!)) < 1e-6).length >= 2) out.push(j); }
    return out;
  });
  const g = { side, pts, polys, nbrs };
  cache.set(key, g);
  return g;
}

/** The edge two neighbouring polygons share, if any. */
export function shared(g: Geometry, i: number, j: number): [Pt, Pt] | null {
  const on = g.polys[i]!.filter(v => Math.abs(d2(v, g.pts[i]!) - d2(v, g.pts[j]!)) < 1e-6);
  return on.length >= 2 ? [on[0]!, on[on.length - 1]!] : null;
}

export const f = (n: number): string => n.toFixed(3);
export const polyPath = (poly: Pt[]): string => poly.map(v => `${f(v[0])},${f(v[1])}`).join(' ');

/** Lines along the edges where a key differs between neighbours (lordships, or land and water). */
export function edgesWhere(g: Geometry, differ: (i: number, j: number) => boolean): string {
  const out: string[] = [];
  for (let i = 0; i < g.pts.length; i++) for (const j of g.nbrs[i]!) {
    if (j <= i || !differ(i, j)) continue;
    const e = shared(g, i, j);
    if (e) out.push(`M${f(e[0][0])},${f(e[0][1])}L${f(e[1][0])},${f(e[1][1])}`);
  }
  return out.join('');
}

/** Rivers as a board game draws them: along the shared edge between a place and the place its water runs to, wherever
 *  the water runs strong enough. */
export function riverEdges(g: Geometry, low: number[], flow: number[], over: number, water: (i: number) => boolean): string {
  const out: string[] = [];
  for (let i = 0; i < g.pts.length; i++) for (const j of g.nbrs[i]!) {
    if (j <= i || (water(i) && water(j))) continue;
    if (!((flow[i]! >= over && low[i] === j) || (flow[j]! >= over && low[j] === i))) continue;
    const e = shared(g, i, j);
    if (e) out.push(`M${f(e[0][0])},${f(e[0][1])}L${f(e[1][0])},${f(e[1][1])}`);
  }
  return out.join('');
}

/** Filters: the island's lift off the table, and the pieces' shadows. */
export const FILTERS = `
<filter id="board-drop" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0.08" stdDeviation="0.12" flood-opacity="0.22"/></filter>
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .17  0 0 0 0 .13  0 0 0 1 0"/></filter>
<filter id="token-drop" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0.02" stdDeviation="0.02" flood-opacity="0.35"/></filter>`;
