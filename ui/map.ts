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
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) pts.push([x + 0.18 + 0.64 * r(), y + 0.18 + 0.64 * r()]);
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

/** Faint ripples off a coast: short strokes parallel to each land–water edge, set out into the water. */
export function ripples(g: Geometry, water: (i: number) => boolean): string {
  const out: string[] = [];
  for (let i = 0; i < g.pts.length; i++) if (water(i)) for (const j of g.nbrs[i]!) {
    if (water(j)) continue;
    const e = shared(g, i, j);
    if (!e) continue;
    const w = g.pts[i]!, mx = (e[0][0] + e[1][0]) / 2, my = (e[0][1] + e[1][1]) / 2, ox = w[0] - mx, oy = w[1] - my, L = Math.hypot(ox, oy) || 1;
    for (const k of [0.1, 0.2]) {
      const dx = (ox / L) * k, dy = (oy / L) * k, s = 0.75 - k;
      const ax = mx + (e[0][0] - mx) * s + dx, ay = my + (e[0][1] - my) * s + dy, bx = mx + (e[1][0] - mx) * s + dx, by = my + (e[1][1] - my) * s + dy;
      out.push(`M${f(ax)},${f(ay)}Q${f(mx + dx * 1.4)},${f(my + dy * 1.4)} ${f(bx)},${f(by)}`);
    }
  }
  return out.join('');
}

/** Rivers as continuous courses: from each headwater, follow the water down until it joins a river already drawn, reaches
 *  water, or leaves the realm. Each stretch is its own short curve so the stroke can widen as the river gathers. */
export function rivers(g: Geometry, low: number[], flow: number[], over: number, water: (i: number) => boolean): { d: string; w: number }[] {
  const n = g.pts.length, into = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) if (low[i]! >= 0 && flow[i]! >= over) into[low[i]!]++;
  const fmax = Math.max(over * 1.0001, ...flow), seen = new Set<number>(), out: { d: string; w: number }[] = [];
  // Off the hamlet: the course runs a little to one side of each place's centre.
  const at = (i: number): Pt => { const p = g.pts[i]!; return [p[0] + 0.14 * Math.sin(i * 2.3), p[1] + 0.14 * Math.cos(i * 1.7)]; };
  const width = (q: number): number => 0.018 + (0.08 - 0.018) * Math.min(1, Math.log(1 + q / over) / Math.log(1 + fmax / over));
  for (let h = 0; h < n; h++) {
    if (flow[h]! < over || into[h]! > 0 || water(h)) continue;
    const course: number[] = [h];
    let i = h;
    while (low[i]! >= 0 && !seen.has(i) && !water(i)) { seen.add(i); i = low[i]!; course.push(i); }
    const P = course.map(at);
    // The last point is drawn to the shared edge if it is water, so the river meets the coast.
    for (let k = 0; k + 1 < P.length; k++) {
      const a = P[k]!, b = P[k + 1]!, prev = P[k - 1] ?? a, next = P[k + 2] ?? b;
      const c1: Pt = [a[0] + (b[0] - prev[0]) / 6, a[1] + (b[1] - prev[1]) / 6], c2: Pt = [b[0] - (next[0] - a[0]) / 6, b[1] - (next[1] - a[1]) / 6];
      out.push({ d: `M${f(a[0])},${f(a[1])}C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(b[0])},${f(b[1])}`, w: width(flow[course[k]!]!) });
    }
  }
  return out;
}

/** Small ink drawings, as SVG symbols in a 1×1 box, drawn with currentColor. */
export const SYMBOLS = `
<symbol id="s-keep" viewBox="0 0 10 10"><path d="M2 9V4h1V2.6h1V4h2V2.6h1V4h1v5H6V6.6H4V9z" fill="currentColor"/></symbol>
<symbol id="s-steeple" viewBox="0 0 10 10"><path d="M5 .6 6.4 4H6v1.6h1.6V9H2.4V5.6H4V4h-.4z" fill="currentColor"/><path d="M5 1.6v1.5M4.4 2.2h1.2" stroke="var(--panel)" stroke-width=".35"/></symbol>
<symbol id="s-hut" viewBox="0 0 10 10"><path d="M1.5 5 5 2l3.5 3v4h-7z" fill="currentColor"/></symbol>
<symbol id="s-crown" viewBox="0 0 10 10"><path d="M1.2 7.6 .8 3l2.4 2L5 1.8 6.8 5l2.4-2-.4 4.6z" fill="currentColor"/><path d="M1.2 8.6h7.6" stroke="currentColor" stroke-width=".9"/></symbol>
<symbol id="s-granary" viewBox="0 0 10 10"><path d="M2 4.4 5 2l3 2.4V9H2z" fill="none" stroke="currentColor" stroke-width=".8"/><path d="M3.6 6h2.8M3.6 7.5h2.8" stroke="currentColor" stroke-width=".6"/></symbol>
<symbol id="s-dike" viewBox="0 0 10 10"><path d="M1 7.5h8M2 7.5 3.5 4h3L8 7.5" fill="none" stroke="currentColor" stroke-width=".8"/></symbol>
<symbol id="s-tree" viewBox="0 0 10 10"><path d="M5 1.2c2 0 3.2 1.6 3 3.3C7.8 6 6.4 6.6 5 6.6S2.2 6 2 4.5C1.8 2.8 3 1.2 5 1.2z" fill="currentColor"/><path d="M5 6.4V9" stroke="currentColor" stroke-width=".8"/></symbol>
<symbol id="s-flag" viewBox="0 0 10 10"><path d="M2.6 9V1.2" stroke="currentColor" stroke-width=".8"/><path d="M2.9 1.4h5l-1.4 1.6 1.4 1.6h-5z" fill="currentColor"/></symbol>
<symbol id="s-cross" viewBox="0 0 10 10"><path d="M5 1v8M2.6 3.6h4.8" stroke="currentColor" stroke-width="1.1"/></symbol>
<symbol id="s-shrine" viewBox="0 0 10 10"><path d="M5 1.2 6 4h3L6.6 5.8 7.5 8.8 5 7 2.5 8.8l.9-3L1 4h3z" fill="currentColor"/></symbol>
<symbol id="s-interdict" viewBox="0 0 10 10"><path d="m2 2 6 6M8 2 2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></symbol>
<symbol id="s-flood" viewBox="0 0 10 10"><path d="M1 4q1-1 2 0t2 0 2 0 2 0M1 6.6q1-1 2 0t2 0 2 0 2 0" fill="none" stroke="currentColor" stroke-width=".8"/></symbol>
<symbol id="s-feud" viewBox="0 0 10 10"><path d="M2 2.2 8 8M8 2.2 2 8M1.4 1.6l1.6.2-.2-1.6M8.6 1.6 7 1.8l.2-1.6" fill="none" stroke="currentColor" stroke-width=".9"/></symbol>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .14  0 0 0 0 .12  0 0 0 0 .1  0 0 0 .9 0"/></filter>`;

/** Hills: two or three woodcut humps with a shaded right flank. */
export function hills(p: Pt, n: number, r: () => number): string {
  let d = '', sh = '';
  for (let k = 0; k < n; k++) {
    const x = p[0] - 0.28 + k * 0.2 + r() * 0.06, y = p[1] + 0.24 + (k % 2) * 0.05, w = 0.11 + r() * 0.05, h = 0.1 + r() * 0.05;
    d += `M${f(x - w)},${f(y)}Q${f(x)},${f(y - h * 2)} ${f(x + w)},${f(y)}`;
    sh += `M${f(x + w * 0.25)},${f(y - h * 0.55)}L${f(x + w * 0.55)},${f(y - 0.01)}M${f(x + w * 0.5)},${f(y - h * 0.3)}L${f(x + w * 0.75)},${f(y - 0.01)}`;
  }
  return `<path class="hill" d="${d}"/><path class="hill-shade" d="${sh}"/>`;
}
/** Trees: a small clump of ink tree-tops. */
export function trees(p: Pt, n: number, r: () => number): string {
  let out = '';
  for (let k = 0; k < n; k++) {
    const x = p[0] + 0.12 + (k % 2) * 0.13 + r() * 0.05, y = p[1] - 0.2 + Math.floor(k / 2) * 0.13 + r() * 0.04;
    out += `<use href="#s-tree" x="${f(x - 0.07)}" y="${f(y - 0.07)}" width="0.14" height="0.14" class="tree"/>`;
  }
  return out;
}
