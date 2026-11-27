// The map as drawn: each square cell of the realm becomes an organic polygon around a jittered point, so places
// read as valleys and parishes rather than a grid. Only the drawing changes; the realm's cells are untouched.

type Pt = [number, number];
export interface Geometry { side: number; pts: Pt[]; polys: Pt[][]; nbrs: number[][] }

/** A small seeded generator, for the drawing only: the same realm is always drawn the same way. */
function rand(seed: number): () => number {
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

const cache = new Map<string, Geometry>();
/** The polygons of a realm of side × side cells, seeded by the realm's seed. */
export function geometry(side: number, seed: number): Geometry {
  const key = `${side}:${seed}`, hit = cache.get(key);
  if (hit) return hit;
  const r = rand(seed + 7919), pts: Pt[] = [];
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) pts.push([x + 0.18 + 0.64 * r(), y + 0.18 + 0.64 * r()]);
  const polys: Pt[][] = [], nbrs: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const x = i % side, y = Math.floor(i / side);
    let poly: Pt[] = [[0, 0], [side, 0], [side, side], [0, side]];
    const cand: number[] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx, Y = y + dy;
      if ((dx || dy) && X >= 0 && Y >= 0 && X < side && Y < side) { cand.push(Y * side + X); poly = clip(poly, pts[i]!, pts[Y * side + X]!); }
    }
    polys.push(poly);
    // Neighbours: those whose bisector actually bounds this polygon.
    nbrs.push(cand.filter(j => poly.filter(v => Math.abs(d2(v, pts[i]!) - d2(v, pts[j]!)) < 1e-6).length >= 2));
  }
  const g = { side, pts, polys, nbrs };
  cache.set(key, g);
  return g;
}
const d2 = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The edge two neighbouring polygons share, if any. */
export function shared(g: Geometry, i: number, j: number): [Pt, Pt] | null {
  const on = g.polys[i]!.filter(v => Math.abs(d2(v, g.pts[i]!) - d2(v, g.pts[j]!)) < 1e-6);
  return on.length >= 2 ? [on[0]!, on[on.length - 1]!] : null;
}

const f = (n: number): string => n.toFixed(3);
export const polyPath = (poly: Pt[]): string => poly.map(v => `${f(v[0])},${f(v[1])}`).join(' ');

/** Lines between places held by different lords or bodies. */
export function borders(g: Geometry, lordOf: (i: number) => number): string {
  const out: string[] = [];
  for (let i = 0; i < g.pts.length; i++) for (const j of g.nbrs[i]!) {
    if (j <= i) continue;
    const a = lordOf(i), b = lordOf(j);
    if (a === b || (a < 0 && b < 0)) continue;
    const e = shared(g, i, j);
    if (e) out.push(`M${f(e[0][0])},${f(e[0][1])}L${f(e[1][0])},${f(e[1][1])}`);
  }
  return out.join('');
}

/** Rivers: from each place whose water runs strong enough to the place below it, as a curve through the shared edge. */
export function rivers(g: Geometry, low: number[], flow: number[], over: number): { d: string; w: number }[] {
  const out: { d: string; w: number }[] = [];
  for (let i = 0; i < g.pts.length; i++) {
    const j = low[i]!;
    if (j < 0 || flow[i]! < over) continue;
    const a = g.pts[i]!, b = g.pts[j]!, e = shared(g, i, j);
    const m: Pt = e ? [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    out.push({ d: `M${f(a[0])},${f(a[1])}Q${f(m[0])},${f(m[1])} ${f((m[0] + b[0]) / 2)},${f((m[1] + b[1]) / 2)}T${f(b[0])},${f(b[1])}`, w: Math.min(0.14, 0.03 + 0.05 * Math.log2(1 + flow[i]! / over)) });
  }
  return out;
}
