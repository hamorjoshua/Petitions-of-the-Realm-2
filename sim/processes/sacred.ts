// The sacred. A layer that is not conserved: holiness, stain, shunning, shrines and creeds are made by being declared,
// held and told, not by being produced, and they bear on what the conserved layer may do. Nothing here draws by chance;
// whether a place is prone to being thought holy was fixed when the land was made.

import { BY_HARM, Kn, NK, P } from '../tables.ts';
import { askAhead, cover } from '../value.ts';
import { around, dist, grown, head, hearthIndex, rec } from '../util.ts';
import { statute } from '../court/court.ts';
import type { State } from '../types.ts';

export function sacred(s: State): void {
  for (const p of s.people) if (p.alive) { p.stained *= 0.99; p.ban = Math.max(0, p.ban - 1); }
  for (const c of s.cells) c.interdict = Math.max(0, c.interdict - 1);
  const idx = hearthIndex(s), first = BY_HARM[0]!;

  // Under interdict there are no rites; those who heed such things hold it against the court.
  if (s.court) for (let i = 0; i < s.cells.length; i++) {
    if (s.cells[i]!.interdict <= 0) continue;
    for (const b of idx[i]!) { const h = head(s, b); if (h && h.credulous >= P.heed) s.court.grief[b.id] = (s.court.grief[b.id] ?? 0) + P.interdictGrief * h.credulous; }
  }

  // Where water came over the banks on ground prone to it, and the people there are credulous, a shrine rises,
  // kept by whoever there has most.
  const struck = new Set(s.log.filter(r => r.k === 'decay' && r.q2 === 1 && r.cell >= 0).map(r => r.cell));
  for (const i of struck) {
    const c = s.cells[i]!;
    if (c.shrine || c.awe >= P.shrineChance || statute(s, 'shrines') === 'suppressed') continue;
    const hs = idx[i]!.filter(b => b.alive && b.members.length);
    const heads = hs.map(b => head(s, b)).filter(h => h !== undefined);
    if (!heads.length || heads.reduce((x, h) => x + h!.credulous, 0) / heads.length < 0.55) continue;
    const keeper = hs.sort((x, y) => y.store.reduce((a, q) => a + q, 0) - x.store.reduce((a, q) => a + q, 0))[0]!;
    c.shrine = { of: keeper.id, since: s.t, sanctioned: false, to: -1 };
    rec(s, 'shrine', { a: keeper.id, cell: i });
  }

  // The credulous with plenty bring offerings to a shrine within a long walk; the place grows holier with every one.
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i]!, sh = c.shrine;
    if (!sh || !s.bodies[sh.of]?.alive) continue;
    // Offerings go only to sanctioned shrines, or to none, if the statute on pilgrimage says so.
    const pil = statute(s, 'shrines');
    if (pil === 'suppressed' || (pil === 'sanctioned' && !sh.sanctioned)) continue;
    const keeper = s.bodies[sh.of]!, share = sh.sanctioned && sh.to >= 0 && s.bodies[sh.to]?.alive ? s.bodies[sh.to]! : undefined;
    for (const h of around(idx, s.side, i, P.far)) {
      const sp = head(s, h);
      if (!sp || h === keeper || sp.credulous < 0.6 || dist(s.side, h.home, i) > P.far || cover(h.store, askAhead(s, h))[first]! <= P.content) continue;
      let k = -1;
      for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && (k < 0 || h.store[j]! > h.store[k]!)) k = j;
      if (k < 0) continue;
      const q = Math.min(h.store[k]! * 0.5, P.shrineGift * askAhead(s, h)[first]!);
      h.store[k] = h.store[k]! - q;
      if (share) { keeper.store[k] = keeper.store[k]! + q * 0.75; share.store[k] = share.store[k]! + q * 0.25; } else keeper.store[k] = keeper.store[k]! + q;
      c.sanctity = Math.min(0.9, c.sanctity + 0.005);
    }
  }

  // Deaths from want harden a house's creed: stricter in what it asks, purer in whom it will accept.
  for (const r of s.log) {
    if (r.k !== 'die' || r.need < 0) continue;
    const b = s.bodies[r.b];
    if (!b || !b.alive || !grown(s, b).length) continue;
    b.creed.rigour = Math.min(1, b.creed.rigour + 0.08); b.creed.purity = Math.min(1, b.creed.purity + 0.08);
  }

  // A creed apart that the court has let be draws its neighbours toward it.
  for (const H of s.bodies) {
    if (!H.alive || s.t - H.tolerated > 52) continue;
    for (const x of around(idx, s.side, H.home, 1)) {
      if (x === H || x.authority === 'symbolic') continue;
      for (const k of ['rigour', 'folk', 'purity'] as const) x.creed[k] += 0.01 * (H.creed[k] - x.creed[k]);
    }
  }
}
