// The court. A matter is a bond that stands between someone and what they need: one they are owed on
// and cannot get, one they owe on and cannot bear, or one another holds over something they lack. It
// reaches the regent only when no rule covers its shape, when two bodies' rules answer it differently,
// or when a rule is itself challenged. The court can do five things to any bond: enforce it, part it,
// strike it, stay it, or turn it over to the one who asks. A ruling is made for this case, for one body,
// or for the realm; once there is a rule, like cases are settled below and the regent never sees them.
// Nothing here names a kind of case. A matter's shape is read off the bond, the need and the parties.

import { BY_HARM, KINDS, Kn, NEEDS, NK, NN, P, Rc, St, TOIL } from '../tables.ts';
import { askAhead, cover, drive } from '../value.ts';
import { around, bond, dist, setTie, fellows, grown, head, hearthIndex, kinOf, leaves, living, might, near, rec, top, warm } from '../util.ts';
import { body, handOver, shift } from '../processes/gather.ts';
import type { Body, Bond, Court, Dials, LawKey, Laws, LocalOrder, Mode, OrdKey, Petition, Policy, PowerAct, Rule, State, WorkKey } from '../types.ts';

export type Width = 'case' | 'body' | 'realm';
export interface Ruling { petition: number; cut: string; width: Width }

export function openCourt(s: State, mode: Mode = 'regency'): Court {
  // The Crown's store: for each pressing need, what would see the whole realm through a week or so, in the thing that keeps best.
  const store = new Array<number>(NK).fill(0);
  let heads = 0;
  for (const p of s.people) if (p.alive) heads++;
  for (let n = 0; n < NN; n++) {
    if (NEEDS[n]!.harm < 0.25) continue;
    let k = -1;
    for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && Kn[j]!.serves[n]! > 0 && (k < 0 || Kn[j]!.keep < Kn[k]!.keep)) k = j;
    if (k >= 0) store[k] = Math.max(store[k]!, (heads * P.crownWeeks * (NEEDS[n]!.per + NEEDS[n]!.cold * 5) * Kn[k]!.use) / Kn[k]!.serves[n]!);
  }
  const policy: Policy = {
    ...freshLaws(),
    dials: freshDials(),
    ord: { stay: 0, granaries: 0, eyre: 0, penance: 0 }, mode, weak: false,
  };
  const court: Court = { policy, seat: s.bodies.find(b => b.alive && b.rank === 'bailiff')?.home ?? Math.floor(s.cells.length / 2), legitimacy: 5, reach: 5, collected: 0, precedent: {}, caprice: 0, standing: 5, docket: [], rules: [], grief: {}, seen: {}, next: 0, quiet: 0, declined: 0, chilled: 0, store, words: [], wordsKept: 0, wordsBroken: 0, store0: store.reduce((x, y) => x + y, 0) };
  s.court = court;
  levies(s);
  return court;
}

/** Give a house three weeks of what it needs out of the Crown's store. False if the store has not got it. */
function relieve(s: State, c: Court, to: Body, need: number): number {
  let k = -1;
  for (let j = 0; j < NK; j++) if (Kn[j]!.serves[need]! > 0 && c.store[j]! > (k < 0 ? 0.05 : c.store[k]!)) k = j;
  if (k < 0) return 0;
  const q = Math.min(c.store[k]!, (3 * askAhead(s, to)[need]! * Kn[k]!.use) / Kn[k]!.serves[need]!);
  if (q < 0.05) return 0;
  c.store[k] = c.store[k]! - q; to.store[k] = to.store[k]! + q;
  return q;
}

/** Move a gauge, and note why. */
const gauge = (s: State, c: Court, g: 'legitimacy' | 'reach', d: number, why: string): void => { c[g] += d; note(s, c, g, d, why); };
const note = (s: State, c: Court, g: 'legitimacy' | 'reach' | 'store', d: number, why: string): void => {
  if (Math.abs(d) < 1e-6) return;
  const l = (c.ledger ??= []), last = l[l.length - 1];
  if (last && last.t === s.t && last.g === g && last.why === why) last.d += d; else l.push({ t: s.t, g, d, why });
  if (l.length > 600) l.splice(0, l.length - 500);
};
const storeOf = (c: Court): number => c.store.reduce((x, y) => x + y, 0);
const grieve = (c: Court, id: number, by: number): void => { if (id >= 0) c.grief[id] = Math.max(0, (c.grief[id] ?? 0) + by); };
const scopeOf = (s: State, id: number): number => { const t = top(s, s.bodies[id]!); return t.id === id ? -2 : t.id; };

/** The form of a bond, without its parties: what it is about, all the way down, and on what basis. */
export function formOf(byId: Map<number, Bond>, b: Bond | undefined, depth = 0): string {
  if (!b || depth > 12) return 'gone';
  if (b.about === 'bond') return `${b.secures >= 0 ? 'pledge' : b.share > 0 ? 'lease for a share' : 'lease'} of ${formOf(byId, byId.get(b.on), depth + 1)}`;
  if (b.about === 'land') return `holding by ${b.basis}`;
  if (b.about === 'right') return b.kind < 0 ? 'ban on working the ground' : `sole right to ${Rc[b.kind]!.id} by ${b.basis}`;
  if (b.about === 'yield') return `share of all it gathers owed by ${b.basis}${b.way ? ' (' + b.way + ')' : ''}`;
  if (b.about === 'act') return `${b.labour ? 'work' : 'goods'} owed by ${b.basis}${b.way ? ' (' + b.way + ')' : ''}${b.denied ? ', denied, with no witness' : ''}`;
  return `tie of ${b.basis}`;
}

export const SIDES = ['owed', 'owes', 'outside', 'bare'] as const;
/** How far a cut finds for the one who asked, by how they stood. */
export const FAVOUR: Record<string, Record<string, number>> = {
  owed: { pardon: 0, enforce: 1, redeem: 1, answer: 0.9, expel: 0.7, bar: 0.6, surety: 0.6, remit: 0.5, part: 0.5, stay: 0.2, strike: 0 },
  owes: { strike: 1, redeem: 1, give: 1, rival: 0.9, stay: 0.7, ease: 0.7, surety: 0.6, part: 0.5, remit: 0.5, enforce: 0, dismiss: 0 },
  outside: { turn: 1, strike: 0.9, rival: 0.9, part: 0.6, remit: 0.5, enforce: 0 },
  asks: { charter: 1, install: 1, sell: 0.7, remit: 0.5, refuse: 0, confirm: 0 },
  fears: { forbid: 1, inscribe: 1, remit: 0.5, dismiss: 0.1, override: 0 },
  exit: { free: 1, release: 0.8, ease: 0.7, tie: 0 },
  suspects: { assess: 1, inquire: 0.7, dismiss: 0 },
  unaided: { compel: 1, remit: 0.5, dismiss: 0, dispense: 0 },
  exceeds: { custom: 1, commute: 0.7, remit: 0.5, uphold: 0 },
  mortmain: { break: 1, commute: 0.7, uphold: 0 },
  sanctuary: { extract: 1, abjure: 0.7, respect: 0 },
  shrine: { suppress: 1, inquire: 0.6, sanction: 0 },
  unclean: { depose: 1, penance: 0.6, compel: 0 },
  heresy: { silence: 1, remit: 0.6, tolerate: 0 },
  heir: { restore: 1, divide: 0.6, remit: 0.5, uphold: 0 },
  appeal: { speak: 1, divide: 0.7, uphold: 0 },
  harmed: { compensate: 1, restrain: 0.8, remit: 0.5, dismiss: 0 },
  bare: { give: 1, vouch: 1, levy: 1, promise: 0.8, dismiss: 0 },
};

/** A house that has been before the court, and those who live near enough to see, change what they expect of it. */
function teach(s: State, idx: Body[][], by: number, side: string, found: number, own: number): void {
  const k = SIDES.indexOf(side as (typeof SIDES)[number]), home = s.bodies[by]!.home;
  if (k < 0) return;
  for (const b of around(idx, s.side, home, P.reach)) {
    const w = b.id === by ? own : P.pleaSeen;
    for (const p of grown(s, b)) p.plea[k] = p.plea[k]! + w * (found - p.plea[k]!);
  }
}

/**
 * How far a bond of some form, were it made today between two bodies, could be counted on by the one it
 * would favour. People know the rules they live under: where a rule says such bonds are struck or stayed,
 * the one who would be owed counts on less. Where there is no rule, they go by what they expect of the court.
 */
export function upheld(s: State, side: string, way: string, bearer: number, gainer: number): number {
  const c = s.court;
  if (!c) return 1;
  const part = side === 'L' || side === 'LS' ? `goods owed by word (${way})` : side === 'D' || side === 'DS' ? `work owed by word (${way})` : side === 'Y' ? 'lease for a share of' : side === 'U' ? 'lease of' : 'pledge of';
  const A = s.bodies[bearer]!, B = s.bodies[gainer]!, same = A.of >= 0 && top(s, A).id === top(s, B).id ? top(s, A).id : -9;
  let sum = 0, n = 0;
  for (const r of c.rules) {
    if ((r.scope !== -1 && r.scope !== same) || !r.shape.includes(part)) continue;
    if (r.shape.startsWith('owed on')) { sum += FAVOUR.owed![r.cut] ?? 0.5; n++; }
    else if (r.shape.startsWith('bound by')) { sum += 1 - (FAVOUR.owes![r.cut] ?? 0.5); n++; }
  }
  // A court that goes back on itself makes every promise less certain.
  const doubt = 1 - Math.min(0.5, 0.04 * c.caprice);
  if (n) return (0.2 + sum / n) * doubt;
  return Math.max(0.7, Math.min(1.2, 0.5 + (B.plea[0] ?? 0.5))) * doubt;
}

/** One who found nobody to deal with because of what the law now says holds it against the court. */
export function chilled(s: State, id: number): void {
  if (!s.court) return;
  s.court.chilled++;
  grieve(s.court, id, P.harmChilled);
}

/** The five planes a matter can set against one another. */
export type Plane = 'material' | 'positional' | 'relational' | 'normative' | 'epistemic' | 'sacred';

/** The plane a burden on a house belongs to. */
function planeOfBond(s: State, bd: Bond, by: number): Plane {
  if (bd.about === 'yield') return bd.way === 'tithe' ? 'normative' : 'positional';
  if (bd.about === 'right' || bd.about === 'land' || (bd.about === 'bond' && bd.secures < 0)) return 'positional';
  if (bd.about === 'act' && bd.denied) return 'epistemic';
  return 'relational';
}

/**
 * The two planes a matter sets against each other: where the demands of one cannot be met without breaking another.
 * A reading for the screen and the measures; nothing in the rules looks at it.
 */
export function planesOf(s: State, p: Petition): [Plane, Plane] {
  const pair = (a: Plane, b: Plane): [Plane, Plane] => (a <= b ? [a, b] : [b, a]);
  if (p.reason === 'challenge') return pair('normative', 'material');
  if (p.burdens.length) { const bd = s.bonds.find(b => b.id === p.burdens[0]); return pair('material', bd ? planeOfBond(s, bd, p.by) : 'relational'); }
  if (p.side === 'asks') return pair('positional', p.body !== undefined ? 'relational' : 'material');
  if (p.side === 'fears') return pair('normative', (p.sign ?? '').startsWith('house:') || p.sign === 'new' ? 'relational' : 'material');
  if (p.side === 'exit') return pair('relational', 'positional');
  if (p.side === 'suspects') return pair('epistemic', 'positional');
  if (p.side === 'unaided') return pair('normative', 'relational');
  if (p.side === 'heir') return pair('positional', 'relational');
  if (p.side === 'mortmain') return pair('sacred', 'positional');
  if (p.side === 'sanctuary') return pair('sacred', 'material');
  if (p.side === 'shrine') return pair('sacred', 'epistemic');
  if (p.side === 'unclean') return pair('sacred', 'relational');
  if (p.side === 'heresy') return pair('sacred', 'normative');
  if (p.side === 'appeal') return pair('normative', 'relational');
  if (p.side === 'harmed') return pair('normative', 'material');
  if (p.side === 'exceeds') return pair('normative', 'positional');
  const bd = s.bonds.find(b => b.id === p.bond);
  if (!bd) return pair(p.shape.includes('shunned') ? 'normative' : 'material', 'material');
  if (bd.about === 'act' && bd.denied) return pair('epistemic', 'material');
  if (bd.about === 'act' && bd.basis === 'wrong') return pair(bd.way === 'blood' ? 'relational' : 'material', p.side === 'owes' || bd.way !== 'blood' ? 'epistemic' : 'material');
  if (bd.about === 'act') return pair('material', 'relational');
  return pair('positional', 'material');
}

/** Who answers for a bond on the other side from a body. */
const other = (bd: Bond, by: number): number => (bd.a === by ? bd.b : bd.a);

/**
 * Who holds sway over a matter below the court: the body both parties belong to, or the lord one of them holds of.
 * A matter left to them is settled by their interest, not by the regent's.
 */
export function localPower(s: State, p: Petition): number {
  const A = s.bodies[p.by]!, B = p.against >= 0 ? s.bodies[p.against]! : undefined;
  if (B && A.of >= 0 && B.of >= 0 && top(s, A).id === top(s, B).id) return top(s, A).id;
  for (const id of [p.by, p.against]) {
    if (id < 0) continue;
    const m = s.bonds.find(x => x.about === 'bond' && x.a === id && x.way === 'manor');
    if (m && s.bodies[m.b]!.alive) return m.b;
  }
  return -1;
}

/**
 * Every power below the court that could claim a matter: the body both parties share, or each party's own body and
 * each party's lord. Where the parties answer to different powers, which of them decides is itself in question.
 */
export function localPowers(s: State, p: Petition): number[] {
  const out: number[] = [];
  const A = s.bodies[p.by]!, B = p.against >= 0 ? s.bodies[p.against]! : undefined;
  if (B && A.of >= 0 && B.of >= 0 && top(s, A).id === top(s, B).id) return [top(s, A).id];
  for (const X of [A, B]) {
    if (!X) continue;
    if (X.of >= 0) out.push(top(s, X).id);
    const m = s.bonds.find(x => x.about === 'bond' && x.a === X.id && x.way === 'manor');
    if (m && s.bodies[m.b]!.alive) out.push(m.b);
  }
  // And whoever holds the ground where the matter lies, though neither party may answer to them.
  const bd = p.bond >= 0 ? s.bonds.find(x => x.id === p.bond) : undefined;
  let cell = p.cell ?? (bd?.about === 'land' ? bd.cell : -1);
  if (cell < 0 && bd?.about === 'bond') { const root = s.bonds.find(x => x.id === bd.on); if (root?.about === 'land') cell = root.cell; }
  if (cell >= 0) { const owner = s.bonds.find(x => x.about === 'land' && x.cell === cell && s.bodies[x.a]?.alive && s.bodies[x.a]!.rank === 'lord'); if (owner) out.push(owner.a); }
  return [...new Set(out)].filter(id => id !== p.by && id !== p.against || s.bodies[id]!.rank === 'lord').slice(0, 3);
}

/** Who decides for a local power: a lord himself, or the head of a body of bodies. */
export function judgeOf(s: State, scope: number): number {
  const b = s.bodies[scope];
  if (!b) return -1;
  return b.parts.length && b.head >= 0 && s.bodies[b.head]?.alive ? b.head : scope;
}

/** Leave a matter to whoever holds sway locally: they choose the cut, and the loser blames them more than the court. */
function leaveTo(s: State, c: Court, p: Petition, judge: number, cut: string, parties: number[]): void {
  const before = parties.map(w => c.grief[w] ?? 0);
  carry(s, c, p, cut);
  parties.forEach((w, i) => { const d = (c.grief[w] ?? 0) - before[i]!; if (d > 0) { c.grief[w] = before[i]! + d * 0.25; if (w !== judge && judge >= 0) warm(s, w, judge, -0.3); } });
}

const fellowsOf = (s: State, b: Body): Body[] => fellows(s, b).map(i => s.bodies[i]!);

/** Sacrilege: the court itself has broken what is holy. Its legitimacy suffers, the place falls under interdict, and
 *  all who heed such things nearby hold it against the court. */
function sacrilege(s: State, c: Court, cell: number): void {
  gauge(s, c, 'legitimacy', -P.sacrilegeCost, 'sacrilege');
  s.cells[cell]!.interdict = 13;
  for (const x of around(hearthIndex(s), s.side, cell, P.dealReach)) if ((head(s, x)?.credulous ?? 0) >= P.heed) grieve(c, x.id, P.harmPaid);
  rec(s, 'sacrilege', { cell });
}

/** The words a constraint is held in, for its shape. */
export function constraintWords(sign: string): string {
  if (sign.startsWith('cell:')) return 'work on ground where harm was done';
  if (sign.startsWith('way:')) return `dealing by ${sign.slice(4)}`;
  if (sign.startsWith('house:')) return 'a house it holds brings harm';
  if (sign === 'new') return 'newcomers among them';
  return sign;
}

/** The kin of a debtor best able to stand surety for it: the one within reach with the most laid by. */
export function suretyFor(s: State, debtor: number): number {
  const D = s.bodies[debtor]!;
  let best = -1, most = 0;
  for (const k of kinOf(s).get(debtor) ?? []) {
    const K = s.bodies[k]!;
    if (!K.alive || K.parts.length || dist(s.side, K.home, D.home) > P.dealReach) continue;
    const held = K.store.reduce((x, q, i) => x + (Kn[i]!.fixed ? 0 : q), 0);
    if (held > most) { most = held; best = k; }
  }
  return best;
}

/** The cuts the court could make in a matter. They follow from what stands in the way. */
export function cuts(s: State, p: Petition): string[] {
  if (p.reason === 'challenge') return ['uphold', 'strike'];
  // A house in want with things weighing on it: any one of them may be eased for a year, or relief given, or neither.
  if (p.burdens.length) return [...p.burdens.filter(id => s.bonds.some(b => b.id === id)).map(id => `ease:${id}`), 'give', 'dismiss'];
  const lpow = localPower(s, p), powers = localPowers(s, p);
  const remit = powers.length > 1 ? powers.map(id => `remit:${id}`) : lpow >= 0 ? ['remit'] : [];
  // A contest for the lead of a body: install the one who asks, keep the one who leads, or let the body settle it.
  if (p.side === 'asks' && p.body !== undefined) return ['install', 'confirm', 'remit'];
  // Leave sought for a sole right: grant it, sell it, or refuse it.
  if (p.side === 'asks') return ['charter', 'sell', 'refuse'];
  // A constraint one side will not give up: uphold it in their bounds, override it, leave it to the local power, or neither.
  // A body's custom may be written on the roll, where it binds for good.
  if (p.side === 'fears') return ['forbid', 'override', ...remit, s.bodies[p.by]!.of >= 0 ? 'inscribe' : 'dismiss'];
  // A tenant who says it will leave: give it its ground outright, let it go, tie it to the land, or lift the lord's share a year.
  if (p.side === 'exit') return ['free', 'release', 'tie', `ease:${p.bond}`];
  // The bailiff suspects a house of keeping back the Crown's share: find out, assess it on his word, or send him away.
  if (p.side === 'suspects') return ['inquire', 'assess', 'dismiss'];
  // A fellow left in want against a duty: compel the aid, dispense the duty, leave it to the body, or neither.
  if (p.side === 'unaided') return ['compel', 'dispense', ...remit, 'dismiss'];
  // A lord taking more labour than custom: hold him to custom, back him, or turn the labour into a share of the yield.
  if (p.side === 'exceeds') { const m = s.bonds.find(x => x.id === p.bond); return ['custom', 'uphold', ...(m && m.boon > 0 && m.share <= 0.45 ? ['commute'] : []), ...remit]; }
  // The sacred: each matter can be upheld on its own terms, overridden by force, or translated into the other layer.
  if (p.side === 'mortmain') return ['uphold', 'break', 'commute'];
  if (p.side === 'sanctuary') return ['respect', 'extract', 'abjure'];
  if (p.side === 'shrine') return ['suppress', 'sanction', 'inquire'];
  if (p.side === 'unclean') return ['compel', 'depose', 'penance'];
  if (p.side === 'heresy') return ['silence', 'tolerate', `remit:${p.by}`];
  // An heir's claim by blood to ground another now holds: restore it, uphold the holder, divide it, or leave it below.
  if (p.side === 'heir') return ['restore', 'uphold', 'divide', ...remit];
  // One of a house appeals against its head: let them speak for the house, keep the head, or let them go with their share.
  if (p.side === 'appeal') return ['speak', 'uphold', 'divide'];
  // Harm with no wrong behind it: make the one whose work caused it pay, stop the work, leave it below, or call it no one's fault.
  if (p.side === 'harmed') return ['compensate', 'restrain', ...remit, 'dismiss'];
  const bd = s.bonds.find(b => b.id === p.bond);
  // A want with nothing behind it: relief, or none. One shunned may also be vouched for.
  if (!bd) return p.shape.includes('shunned') ? ['vouch', 'give', 'dismiss'] : ['give', 'dismiss'];
  // Ground: it stays with its holder or goes to the one who asks.
  // A sole right: upheld, broken, or matched with a right of the asker's own.
  if (bd.about === 'right') return ['enforce', 'strike', 'rival'];
  if (bd.about === 'land') return ['enforce', 'turn', ...remit];
  // Anything owed: held to, let go, or put off a year; a debt put off on a kinsman's surety where there is one.
  // The third way is a different kind of ruling where one fits: bar a wrongdoer, cast a party out of the body both belong to,
  // or lay half on kin. Only where none fits is the matter merely put off.
  const shared = lpow >= 0 && (s.bodies[lpow]!.parts.length ?? 0) > 0;
  const inBody = bd.about === 'act' && s.bodies[bd.a]!.of >= 0;
  const excused = bd.about === 'act' && bd.basis === 'wrong' && (bd.intent === 'need' || bd.intent === 'defence');
  const third = bd.about === 'act' && bd.basis === 'wrong' ? 'bar' : shared ? 'expel' : inBody ? 'answer' : bd.about === 'act' && suretyFor(s, bd.a) >= 0 ? 'surety' : 'stay';
  // A wrong done from need or in defence may be pardoned, which is not the same as letting it go.
  const c = ['enforce', excused ? 'pardon' : 'strike', third, ...remit];
  // Whoever is said to have done a wrong may or may not have. An inquest can be held on any of them, once.
  if (bd.about === 'act' && ((bd.basis === 'wrong' && bd.doer >= 0) || bd.denied)) c.push('inquire');
  // A promise spoken with nobody by can be written on the roll on the court's say-so, true or not; then it cannot be denied.
  if (bd.about === 'act' && bd.proof === 'spoken' && p.side === 'owed') c.push('inscribe');
  return c;
}

/** Carry out a cut on whatever the matter is about. Returns false if there was nothing left to cut. */
function carry(s: State, c: Court, p: Petition, cut: string): boolean {
  const by = s.bodies[p.by]!;
  // Left to one named power of two: that one decides.
  let via = -1;
  if (cut.startsWith('remit:')) {
    via = Number(cut.slice(6)); cut = 'remit';
    // The powers passed over resent it, and the one chosen over them.
    for (const other of p.side === 'heresy' ? [] : localPowers(s, p)) {
      if (other === via) continue;
      const who = judgeOf(s, other), chosen = judgeOf(s, via);
      if (who < 0) continue;
      grieve(c, who, P.harmPaid);
      if (chosen >= 0) warm(s, who, chosen, -0.2);
    }
  }
  const powerFor = (): number => (via >= 0 ? via : localPower(s, p));
  if (p.reason === 'challenge' && p.law) {
    if (cut === 'strike') { c.policy.lawSetAt[p.law] = -1; c.grief[p.by] = 0; rec(s, 'rule', { a: p.by, kind2: -1, q2: -3, way: `law ${p.law}` }); }
    else { grieve(c, p.by, P.harmReversed); c.seen[`law:${p.law}`] = s.t + 100000; }
    return true;
  }
  if (p.reason === 'challenge') {
    const i = c.rules.findIndex(r => r.id === p.bond);
    if (i < 0) return false;
    if (cut === 'strike') { rec(s, 'rule', { a: p.by, kind2: -1, q2: c.rules[i]!.scope, way: c.rules[i]!.shape }); c.rules.splice(i, 1); c.grief[p.by] = 0; }
    else { grieve(c, p.by, P.harmReversed); c.seen[`c${p.bond}`] = s.t + 100000; }
    return true;
  }
  if (cut.startsWith('ease:')) {
    const eb = s.bonds.find(b => b.id === Number(cut.slice(5)));
    if (!eb) return false;
    if (eb.about === 'act') { eb.due = Math.max(eb.due, s.t) + 52; eb.broken = false; } else eb.easedTo = s.t + 52;
    if (p.side === 'exit') by.threat = -1;
    grieve(c, other(eb, p.by), P.harmUnheard * 2);
    rec(s, 'judge', { a: p.by, b: other(eb, p.by), need: p.need, cause: eb.rec, way: `ease ${formOf(new Map(s.bonds.map(b => [b.id, b])), eb)}` });
    return true;
  }
  if (p.side === 'mortmain') {
    const held = s.bonds.find(b => b.id === p.bond), holy = p.against;
    if (!held || held.about !== 'land') return false;
    if (cut === 'uphold') grieve(c, p.by, P.harmPaid);
    else {
      held.a = p.by; held.basis = 'grant';
      // Broken outright, it is sacrilege. Commuted, the house has its ground and owes the holy body a tenth for ever.
      if (cut === 'break') sacrilege(s, c, held.cell);
      else { bond(s, { about: 'yield', a: p.by, b: holy, share: 0.1, due: s.t, basis: 'vow', way: 'vow' }); grieve(c, holy, P.harmUnheard); }
    }
    rec(s, 'judge', { a: p.by, b: holy, cell: held.cell, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'sanctuary') {
    const T = s.bodies[p.against]!, bd = s.bonds.find(b => b.id === p.bond);
    if (cut === 'respect') { grieve(c, p.by, P.harmPaid); gauge(s, c, 'reach', -0.15, 'sanctuary respected'); }
    else if (cut === 'extract') {
      // Taken from holy ground by the court's own hand: sacrilege.
      if (bd && bd.about === 'act' && bd.kind >= 0) { const pay = Math.min(bd.q, T.store[bd.kind]!); T.store[bd.kind] = T.store[bd.kind]! - pay; by.store[bd.kind] = by.store[bd.kind]! + pay; bd.q -= pay; }
      sacrilege(s, c, T.home);
    } else {
      // Abjuration: the sanctuary holds, but the one sheltering gives up half of what it has and leaves the place.
      for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed) { const q = T.store[k]! * 0.5; T.store[k] = T.store[k]! - q; by.store[k] = by.store[k]! + q; }
      if (bd) bd.q = 0;
      const away = near(s.side, T.home, P.scout).find(x => x !== T.home && s.cells[x]!.sanctity < P.sanctuary && !s.cells[x]!.water);
      if (away !== undefined) T.goto = away;
    }
    T.sheltered = null;
    rec(s, 'judge', { a: p.by, b: T.id, cell: T.home, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'shrine') {
    const cell = s.cells[p.cell ?? -1], sh = cell?.shrine;
    if (!cell || !sh) return false;
    let how = cut, clean = false;
    // An inquest tests the sign: a keeper of little scruple made it up, and it is put down; otherwise it is sanctioned. No one can quarrel with that.
    if (cut === 'inquire') { how = (head(s, s.bodies[sh.of]!)?.scruple ?? 1) < 0.4 ? 'suppress' : 'sanction'; clean = true; }
    if (how === 'suppress') {
      cell.shrine = null; cell.sanctity *= 0.5;
      if (!clean) { grieve(c, sh.of, P.harmLost); for (const x of around(hearthIndex(s), s.side, p.cell!, P.reach)) if ((head(s, x)?.credulous ?? 0) >= P.heed) grieve(c, x.id, P.harmUnheard); }
    } else {
      sh.sanctioned = true; sh.to = p.by;
      if (!clean) for (const x of s.bodies) if (x.alive && x.authority === 'symbolic' && x.id !== p.by && x.creed.rigour > 0.6 && dist(s.side, x.home, p.cell!) <= P.far) grieve(c, x.id, P.harmPaid);
    }
    rec(s, 'judge', { a: p.by, b: sh.of, cell: p.cell, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'unclean') {
    const S = s.bodies[p.against]!, sp = head(s, S), idx = hearthIndex(s);
    const purists = around(idx, s.side, S.home, P.dealReach).filter(x => x.authority !== 'symbolic' && x.creed.purity > 0.6);
    if (cut === 'compel') for (const x of purists) grieve(c, x.id, P.harmPaid);
    else if (cut === 'depose') {
      // The court sets another of that holy body in the stained man's place: a breach of the other sovereignty.
      const next = grown(s, S).filter(m => m !== sp).sort((x, y) => x.stained - y.stained)[0];
      if (next) S.speaker = next.id; else if (sp) sp.stained *= 0.3;
      gauge(s, c, 'legitimacy', -0.5, 'a priest deposed');
      for (const x of s.bodies) if (x.alive && x.authority === 'symbolic' && x !== S && x.creed.purity <= 0.6) grieve(c, x.id, P.harmPaid);
    } else {
      // Penance: the office stands; a seventh of what the holy body holds goes to those in want nearby, and the stain is halved.
      const needy = around(idx, s.side, S.home, P.dealReach).filter(x => x !== S && cover(x.store, askAhead(s, x))[BY_HARM[0]!]! < P.short);
      for (let k = 0; k < NK; k++) { if (Kn[k]!.fixed || !needy.length) continue; const q = S.store[k]! * 0.15; S.store[k] = S.store[k]! - q; for (const x of needy) x.store[k] = x.store[k]! + q / needy.length; }
      if (sp) sp.stained /= 2;
    }
    rec(s, 'judge', { a: p.by, b: S.id, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'heresy') {
    const H = s.bodies[p.against]!, hp = head(s, H), S = by;
    if (cut === 'silence') {
      if (hp) hp.ban = 26;
      grieve(c, H.id, P.harmLost);
      for (const k of [...(kinOf(s).get(H.id) ?? []), ...fellows(s, H)]) grieve(c, k, P.harmUnheard);
    } else if (cut === 'tolerate') { H.tolerated = s.t; grieve(c, S.id, P.harmPaid); }
    else {
      // Left to the holy body: the Crown keeps out of it, and a strict body shuns the one apart.
      if (S.creed.rigour > 0.6 && hp) hp.ban = 13;
      grieve(c, H.id, P.harmPaid);
    }
    rec(s, 'judge', { a: S.id, b: H.id, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'heir') {
    const held = s.bonds.find(b => b.id === p.bond), heir = p.person ?? -1;
    if (!held || held.about !== 'land') return false;
    if (cut === 'remit') { const judge = judgeOf(s, powerFor()); if (judge < 0) return false; leaveTo(s, c, p, judge, judge === held.a ? 'uphold' : 'restore', [p.by, held.a]); return true; }
    if (cut === 'restore') { grieve(c, held.a, P.harmLost); held.a = p.by; held.basis = 'birth'; }
    else if (cut === 'divide') { held.strength /= 2; bond(s, { about: 'land', a: p.by, cell: held.cell, basis: 'birth', strength: held.strength }); grieve(c, held.a, P.harmPaid); }
    else grieve(c, p.by, P.harmLost);
    // Restored or not, the claim is settled for this generation.
    if (heir >= 0) for (const m of living(s, by)) delete m.lore[`claim:${held.cell}`];
    rec(s, 'judge', { a: p.by, b: p.against, cell: held.cell, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'appeal') {
    const m = s.people[p.person ?? -1];
    if (!m || !m.alive || m.body !== p.by) return false;
    if (cut === 'speak') by.speaker = m.id;
    else if (cut === 'divide') {
      // They leave with their spouse, their young children, and a share of what the house holds.
      const nb = body(s, by.home), wife = m.spouse >= 0 ? s.people[m.spouse] : undefined;
      const going = living(s, by).filter(x => x === m || x === wife || (x.spouse < 0 && (x.mother === m.id || x.father === m.id) && (s.t - x.born) / 52 < 14));
      if (going.length >= living(s, by).length) return false;
      for (const x of going) shift(s, x, nb);
      handOver(s, by, nb, going.length / (going.length + living(s, by).length));
    }
    by.breach = null;
    rec(s, 'judge', { a: p.by, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'harmed') {
    const H = s.bodies[p.against]!, loss = by.harmedBy?.loss ?? 0;
    if (cut === 'remit') { const judge = judgeOf(s, powerFor()); if (judge < 0) return false; leaveTo(s, c, p, judge, judge === H.id ? 'dismiss' : 'compensate', [p.by, H.id]); return true; }
    if (cut === 'compensate') {
      let k = -1;
      for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && (k < 0 || H.store[j]! > H.store[k]!)) k = j;
      if (k < 0) return false;
      const q = Math.min(H.store[k]! * 0.3, loss * 0.5);
      H.store[k] = H.store[k]! - q; by.store[k] = by.store[k]! + q;
      grieve(c, H.id, P.harmPaid);
    } else if (cut === 'restrain') {
      bond(s, { about: 'right', a: p.by, b: H.id, cell: p.cell ?? H.home, kind: -1, share: 1, due: s.t + P.banWeeks, basis: 'grant', way: 'restraint' });
      grieve(c, H.id, P.harmLost);
    } else grieve(c, p.by, P.harmUnheard * 2);
    by.harmedBy = null;
    rec(s, 'judge', { a: p.by, b: H.id, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'unaided') {
    const X = s.bodies[p.against]!, first = BY_HARM[0]!;
    if (cut === 'remit') { const judge = judgeOf(s, powerFor()); if (judge < 0) return false; leaveTo(s, c, p, judge, (s.bodies[judge]?.lore['duty:aid'] ?? 0) > P.heed ? 'compel' : 'dismiss', [p.by, p.against]); return true; }
    if (cut === 'compel') {
      // The court orders the aid the duty asks: three weeks of the first need, from what the shirker has most of.
      let k = -1;
      for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && Kn[j]!.serves[first]! > 0 && (k < 0 || X.store[j]! > X.store[k]!)) k = j;
      if (k < 0) return false;
      const q = Math.min(X.store[k]! * 0.3, (3 * askAhead(s, by)[first]! * Kn[k]!.use) / Kn[k]!.serves[first]!);
      X.store[k] = X.store[k]! - q; by.store[k] = by.store[k]! + q;
      grieve(c, X.id, P.harmPaid);
    } else if (cut === 'dispense') {
      // The duty does not bind here: those who hold it hold it the less, and the one left in want is left.
      for (const b of [X, by, ...fellowsOf(s, X)]) { if (b.lore['duty:aid']) b.lore['duty:aid'] *= 0.5; for (const m of grown(s, b)) if (m.lore['duty:aid']) m.lore['duty:aid'] *= 0.5; }
      grieve(c, p.by, P.harmLost);
    } else grieve(c, p.by, P.harmUnheard * 2);
    X.shirkedTo = -1;
    rec(s, 'judge', { a: p.by, b: X.id, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'exceeds') {
    const m = s.bonds.find(b => b.id === p.bond), lord = p.against;
    if (!m) return false;
    if (cut === 'remit') { const judge = judgeOf(s, powerFor()); leaveTo(s, c, p, judge, judge === lord ? 'uphold' : 'custom', [p.by, lord]); return true; }
    if (cut === 'custom') { m.capped = true; grieve(c, lord, P.harmPaid); }
    else if (cut === 'commute') { m.boon = 0; m.share = Math.min(0.5, m.share + 0.05); grieve(c, lord, P.harmUnheard); }
    else grieve(c, p.by, P.harmLost);
    by.overworked = 0;
    rec(s, 'judge', { a: p.by, b: lord, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'suspects') {
    const X = s.bodies[p.against]!, hidden = X.hid.reduce((a, q) => a + (q ?? 0), 0);
    const e = rec(s, 'judge', { a: p.by, b: X.id, q: hidden, way: `${cut} ${p.shape}` });
    if (cut === 'inquire') {
      // The truth: what was kept back is paid to the Crown and the house is shamed, or the bailiff is shown wrong.
      e.q2 = hidden > 1 ? 1 : 0;
      if (hidden > 1) {
        for (let k = 0; k < X.hid.length; k++) { const pay = Math.min(X.hid[k] ?? 0, X.store[k]!); X.store[k] = X.store[k]! - pay; c.store[k] = c.store[k]! + pay; }
        X.hid = [];
        for (const x of around(hearthIndex(s), s.side, X.home, P.reach)) if (x !== X) x.lore[`house:${X.id}`] = Math.min(1.5, (x.lore[`house:${X.id}`] ?? 0) + 0.3);
        grieve(c, X.id, P.harmPaid);
      } else { grieve(c, X.id, P.harmUnheard); warm(s, X.id, p.by, -0.3); }
    } else if (cut === 'assess') {
      // On the bailiff's word: a share of what it has most of goes to the Crown, guilty or not.
      let k = -1;
      for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && (k < 0 || X.store[j]! > X.store[k]!)) k = j;
      if (k < 0) return false;
      const q = X.store[k]! * 0.15;
      X.store[k] = X.store[k]! - q; c.store[k] = c.store[k]! + q;
      X.hid = [];
      grieve(c, X.id, hidden > 1 ? P.harmPaid : P.harmLost); warm(s, X.id, p.by, -0.3);
    } else grieve(c, p.by, P.harmUnheard);
    return true;
  }
  if (p.side === 'exit') {
    const m = s.bonds.find(b => b.id === p.bond), lord = p.against;
    if (!m) return false;
    if (cut === 'free') {
      // Its ground becomes its own. The lord loses the ground and the share.
      const held = s.bonds.find(b => b.id === m.on);
      if (held) { held.a = p.by; held.basis = 'grant'; }
      m.due = s.t; m.share = 0; by.threat = -1;
      grieve(c, lord, P.harmLost);
    } else if (cut === 'release') {
      // It may go, and the ground goes back to the lord.
      m.due = s.t; m.share = 0; by.threat = s.t - P.wait; gauge(s, c, 'reach', -0.1, 'a tenant let go');
      grieve(c, lord, P.harmPaid);
    } else {
      // Tied to the land: it may not leave.
      m.basis = 'bound'; by.threat = -1;
      grieve(c, p.by, P.harmLost);
    }
    rec(s, 'judge', { a: p.by, b: lord, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'asks' && p.body !== undefined) {
    const cb = s.bodies[p.body], head = p.against;
    if (!cb || !cb.alive || cb.head !== head) return false;
    if (cut === 'remit') { const kin = kinOf(s), win = might(s, kin, by, head) >= might(s, kin, s.bodies[head]!, p.by); leaveTo(s, c, p, -1, win ? 'install' : 'confirm', [p.by, head]); return true; }
    if (cut === 'install') { cb.head = p.by; grieve(c, head, P.harmLost); warm(s, head, p.by, -0.5); for (const id of leaves(s, cb)) if (id !== p.by && id !== head) warm(s, id, p.by, -0.05); }
    else grieve(c, p.by, P.harmUnheard * 2);
    rec(s, 'judge', { a: p.by, b: head, kind2: p.body, way: `${cut} ${p.shape}` });
    return true;
  }
  if (p.side === 'asks') {
    const work = p.work ?? -1, at = p.cell ?? -1;
    if (work < 0 || at < 0) return false;
    if (cut === 'refuse') { grieve(c, p.by, P.harmUnheard * 2); rec(s, 'judge', { a: p.by, cell: at, kind2: work, way: `refuse ${p.shape}` }); return true; }
    if (cut === 'sell') {
      // The Crown sells the right: the asker pays out of whatever it has most of.
      let k = -1;
      for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && (k < 0 || by.store[j]! > by.store[k]!)) k = j;
      if (k < 0 || by.store[k]! < P.charterFee / 2) return false;
      const fee = Math.min(by.store[k]! * 0.5, P.charterFee);
      by.store[k] = by.store[k]! - fee; c.store[k] = c.store[k]! + fee;
    }
    const e = rec(s, 'judge', { a: p.by, cell: at, kind2: work, way: `${cut} ${p.shape}` });
    bond(s, { about: 'right', a: p.by, cell: at, kind: work, share: P.toll, due: -1, used: s.t, basis: 'grant', way: cut, rec: e.id });
    // Those who did the same work there now owe for it.
    for (const cell of near(s.side, at, 1)) for (const id in s.worked[`${work}:${cell}`] ?? {}) if (Number(id) !== p.by && (s.worked[`${work}:${cell}`]![id] ?? 0) >= 10) grieve(c, Number(id), P.harmUnheard);
    return true;
  }
  if (p.side === 'fears') {
    // A constraint: the one who asks, and any near it who hold the same, will not abide something done in their bounds.
    const sign = p.sign ?? '', idx = hearthIndex(s), at = p.cell ?? by.home;
    const holders = around(idx, s.side, by.home, P.reach).filter(b => (b.lore[sign] ?? 0) > P.heed);
    if (cut === 'remit') {
      const lp = powerFor(), judge = judgeOf(s, lp);
      if (lp < 0) return false;
      leaveTo(s, c, p, judge, (s.bodies[judge]?.lore[sign] ?? 0) > P.heed ? 'forbid' : 'dismiss', [p.by, p.against]);
      return true;
    }
    if (cut === 'inscribe') {
      // Written on the roll: the custom binds every like matter within that body, for good, and cannot be challenged.
      const scope = scopeOf(s, p.by);
      if (scope < 0) return false;
      c.rules = c.rules.filter(r => !(r.shape === p.shape && r.scope === scope));
      c.rules.push({ id: c.next++, scope, shape: p.shape, cut: 'forbid', since: s.t, uses: 0, roll: true });
      rec(s, 'rule', { a: p.by, kind2: 0, q2: scope, way: `inscribe ${p.shape}` });
      return carry(s, c, p, 'forbid');
    }
    if (cut === 'forbid') {
      if (sign.startsWith('cell:')) {
        // Nobody may work that ground for two years. Those who held it lose their hold on it.
        bond(s, { about: 'right', a: p.by, cell: at, kind: -1, share: 1, due: s.t + P.banWeeks, basis: 'grant', way: 'ban' });
        for (const h of s.bonds) if (h.about === 'land' && h.cell === at && h.a !== p.by) { h.strength = 0; grieve(c, h.a, P.harmLost); }
      } else if (sign.startsWith('way:')) {
        // Every such dealing within their bounds is void.
        const way = sign.slice(4);
        for (const x of s.bonds) {
          if (x.way !== way || (x.about !== 'act' && x.about !== 'bond')) continue;
          if (![x.a, x.b].some(id => id >= 0 && s.bodies[id]?.alive && dist(s.side, s.bodies[id]!.home, by.home) <= P.reach)) continue;
          if (x.about === 'act') { if (x.q > 0) grieve(c, x.b, P.harmPaid); x.q = 0; } else { x.share = 0; x.secures = x.secures >= 0 ? -2 : x.secures; x.due = s.t; }
        }
      } else if (p.against >= 0) {
        // The house they will not abide is barred from working or dealing near them, and must go elsewhere.
        bond(s, { about: 'right', a: p.by, b: p.against, cell: by.home, kind: -1, share: 1, due: s.t + P.banWeeks, basis: 'grant', way: 'bar' });
      }
      if (p.against >= 0) grieve(c, p.against, P.harmLost);
      for (const b of holders) grieve(c, b.id, -P.harmPaid);
    } else if (cut === 'override') {
      // They must abide it. Their belief weakens, and they hold it against the court.
      for (const b of holders) {
        b.lore[sign] = b.lore[sign]! * 0.3;
        for (const m of grown(s, b)) if (m.lore[sign]) m.lore[sign] = m.lore[sign]! * 0.3;
        grieve(c, b.id, b.id === p.by ? P.harmLost : P.harmUnheard);
      }
    } else { grieve(c, p.by, P.harmUnheard * 2); for (const b of holders) if (b.id !== p.by) grieve(c, b.id, 1); }
    rec(s, 'judge', { a: p.by, b: p.against, cell: at, way: `${cut} ${p.shape}` });
    return true;
  }
  const bd = s.bonds.find(b => b.id === p.bond);
  if (!bd || cut === 'give' || cut === 'dismiss' || cut === 'vouch') {
    // A want with nothing standing in its way that the court can cut: it can be laid on those nearby who have most.
    // Out of the Crown's own store, now; or the regent's word that it will come.
    if (cut === 'give') { const q = relieve(s, c, by, p.need); if (q <= 0) return false; rec(s, 'judge', { a: p.by, q, need: p.need, cause: p.rec, way: `give ${p.shape}` }); return true; }
    if (cut === 'vouch') {
      // The regent vouches for a house its neighbours will not deal with. They defer, and hold it against him.
      for (const x of around(hearthIndex(s), s.side, by.home, P.dealReach)) {
        if (x === by || (x.lore.new ?? 0) <= P.heed) continue;
        x.lore.new = x.lore.new! * 0.3;
        for (const m of grown(s, x)) if (m.lore.new) m.lore.new *= 0.3;
        grieve(c, x.id, P.harmUnheard);
      }
      by.since = -1e6;
      rec(s, 'judge', { a: p.by, need: p.need, cause: p.rec, way: `vouch ${p.shape}` });
      return true;
    }
    if (cut === 'promise') { c.words.push({ to: p.by, need: p.need, due: s.t + P.wordWeeks }); rec(s, 'judge', { a: p.by, need: p.need, cause: p.rec, way: `promise ${p.shape}` }); return true; }
    if (cut !== 'levy') { grieve(c, p.by, P.harmUnheard * 2); rec(s, 'judge', { a: p.by, q2: 0, need: p.need, way: `dismiss ${p.shape}` }); return true; }
    let best: Body | undefined, bestK = -1, most = 0;
    for (const x of around(hearthIndex(s), s.side, by.home, P.dealReach)) {
      if (x === by) continue;
      for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && Kn[k]!.serves[p.need]! > 0 && x.store[k]! > most) { most = x.store[k]!; best = x; bestK = k; }
    }
    if (!best || most < 1) return false;
    const q = Math.min(most * P.part, (3 * askAhead(s, by)[p.need]! * Kn[bestK]!.use) / Kn[bestK]!.serves[p.need]!);
    best.store[bestK] = best.store[bestK]! - q; by.store[bestK] = by.store[bestK]! + q;
    const e = rec(s, 'judge', { a: p.by, b: best.id, kind: bestK, q, need: p.need, cause: p.rec, way: `levy ${p.shape}` });
    bond(s, { about: 'act', a: by.id, b: best.id, kind: bestK, q, due: s.t + P.term, basis: 'grant', rec: e.id });
    grieve(c, best.id, P.harmPaid);
    return true;
  }
  if (bd.about === 'act' && bd.q <= 0.05) return false;
  // Who gains by the bond and who bears it.
  const bears = bd.about === 'right' ? p.by : bd.about === 'act' || bd.about === 'yield' ? bd.a : bd.about === 'land' ? (p.side === 'outside' ? p.by : other(bd, p.by)) : bd.secures >= 0 ? bd.b : bd.a;
  const gains = bd.about === 'right' ? bd.a : bd.about === 'act' || bd.about === 'yield' ? bd.b : bd.about === 'land' ? bd.a : bd.secures >= 0 ? bd.a : bd.b;
  const e = rec(s, 'judge', { a: p.by, b: p.against, kind: bd.kind, q: bd.q, cell: bd.cell, need: p.need, cause: bd.rec, way: `${cut} ${p.shape}` });
  if (cut === 'inquire' && bd.denied) {
    // An inquest into a debt denied: was it ever made? A false claim is struck and its maker shamed; a true one goes on
    // the roll, and the one who denied it is shamed.
    const liar = bd.fabricated ? bd.b : bd.a;
    e.q2 = bd.fabricated ? 1 : 0; e.kind2 = liar;
    for (const x of around(hearthIndex(s), s.side, s.bodies[liar]!.home, P.reach)) if (x.id !== liar) x.lore[`house:${liar}`] = Math.min(1.5, (x.lore[`house:${liar}`] ?? 0) + 0.3);
    // A false claim harmed nobody who was believed, but it was meant to: its maker is fined to the Crown.
    if (bd.fabricated) { bd.q = 0; grieve(c, bd.a, -P.harmPaid); const L = s.bodies[liar]!; for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed) { const f = L.store[k]! * 0.1; L.store[k] = L.store[k]! - f; c.store[k] = c.store[k]! + f; } }
    else { bd.denied = false; bd.proof = 'roll'; }
    return true;
  }
  if (cut === 'inquire') {
    // An inquest shows what the ledger knows: who truly did it.
    e.b = bd.doer; e.q2 = bd.doer !== bd.a ? 1 : 0;
    if (bd.doer !== bd.a && s.bodies[bd.doer]!.alive) {
      // The one wrongly held to it is cleared; the debt falls on the one who did it. If it was the accused who asked, their matter is done.
      grieve(c, bd.a, -P.harmLost);
      if (p.side === 'owes') { bd.a = bd.doer; bd.doer = -1; return false; }
      bd.a = bd.doer; p.against = bd.doer;
    }
    bd.doer = -1;
    return true;
  }
  if (cut === 'remit') {
    // Left to whoever holds sway locally. They decide as suits them: for themselves if they are a party, else for the stronger.
    const scope = powerFor(), lp = judgeOf(s, scope);
    if (scope < 0 || lp < 0) return false;
    const kin = kinOf(s);
    const forGains = lp === gains || (lp !== bears && might(s, kin, s.bodies[gains]!, bears) >= might(s, kin, s.bodies[bears]!, gains));
    const before = [gains, bears].map(w => c.grief[w] ?? 0);
    e.way = `remit ${p.shape}`; e.kind2 = lp;
    carry(s, c, p, forGains ? 'enforce' : bd.about === 'land' ? 'turn' : 'strike');
    // The court is spared most of the ill will; the one who lost holds it against the one who judged.
    [gains, bears].forEach((w, i) => { const d = (c.grief[w] ?? 0) - before[i]!; if (d > 0) { c.grief[w] = before[i]! + d * 0.25; if (w !== lp) warm(s, w, lp, -0.3); } });
    return true;
  }
  if (cut === 'inscribe' && bd.about === 'act') {
    // On the roll it stands, whether it was ever truly made or not. The one who denied it is held to it.
    bd.proof = 'roll'; bd.denied = false; bd.broken = true; bd.due = s.t;
    grieve(c, bd.a, bd.fabricated ? P.harmLost : P.harmPaid);
    return true;
  }
  if (cut === 'pardon') {
    // A wrong done from need or in defence is pardoned: nothing is owed, and the doer's name is not blackened by it.
    if (bd.about !== 'act') return false;
    bd.q = 0;
    grieve(c, bd.b, P.harmPaid);
    for (const x of around(hearthIndex(s), s.side, s.bodies[bd.a]!.home, P.reach)) if (x.lore[`house:${bd.a}`]) x.lore[`house:${bd.a}`] = x.lore[`house:${bd.a}`]! * 0.5;
    return true;
  }
  if (cut === 'answer') {
    // The body the debtor belongs to answers for the debt. Its fellows think the less of the debtor.
    const D = s.bodies[bd.a]!, parent = D.of >= 0 ? s.bodies[D.of] : undefined;
    if (!parent || !parent.alive || bd.about !== 'act') return false;
    bd.a = parent.id; bd.broken = false; bd.due = Math.max(bd.due, s.t);
    for (const f of leaves(s, parent)) if (f !== D.id) warm(s, f, D.id, -0.15);
    if (parent.head >= 0) grieve(c, parent.head, P.harmPaid);
    return true;
  }
  if (cut === 'bar') {
    // The one held to the wrong may not work or deal near the one it wronged for two years. Nothing is paid.
    const to = s.bodies[bd.b]!;
    bond(s, { about: 'right', a: bd.b, b: bd.a, cell: to.home, kind: -1, share: 1, due: s.t + P.banWeeks, basis: 'grant', way: 'bar', rec: e.id });
    bd.q = 0;
    grieve(c, bd.a, P.harmPaid); grieve(c, bd.b, P.harmLost * 0.5);
    return true;
  }
  if (cut === 'expel') {
    // The body both belong to casts out the one who bears the bond. The bond stands; its fellows no longer stand with it.
    const out = s.bodies[bears]!, parent = out.of >= 0 ? s.bodies[out.of] : undefined;
    if (!parent) return false;
    parent.parts = parent.parts.filter(x => x !== out.id);
    out.of = -1;
    const lead = parent.head >= 0 ? parent.head : gains;
    warm(s, out.id, lead, -0.5);
    grieve(c, out.id, P.harmLost);
    return true;
  }
  if (cut === 'surety') {
    // Half the debt is laid on the debtor's kin, and the rest put off a year. The kin are bound now too.
    const k = suretyFor(s, bd.a);
    if (k < 0 || bd.about !== 'act') return false;
    const half = bd.q / 2;
    bond(s, { about: 'act', a: k, b: bd.b, kind: bd.kind, q: half, due: s.t + 52, labour: bd.labour, basis: 'grant', way: 'surety', rec: e.id });
    bd.q -= half; bd.due = Math.max(bd.due, s.t) + 52; bd.broken = false;
    e.kind2 = k;
    warm(s, k, bd.a, -0.3);
    grieve(c, k, P.harmPaid); grieve(c, bd.b, P.harmUnheard);
    return true;
  }
  if (cut === 'redeem') {
    // The Crown pays what is owed, as far as its store goes, and the rest is let go.
    const pay = Math.min(bd.q, c.store[bd.kind]!);
    if (pay < 0.5 * bd.q) return false;
    c.store[bd.kind] = c.store[bd.kind]! - pay; s.bodies[bd.b]!.store[bd.kind] = s.bodies[bd.b]!.store[bd.kind]! + pay;
    bd.q = 0;
    return true;
  }
  if (cut === 'stay') { if (bd.about === 'act') { bd.due = Math.max(bd.due, s.t) + 52; bd.broken = false; } else bd.easedTo = s.t + 52; grieve(c, gains, P.harmUnheard); return true; }
  const share = cut === 'enforce' ? 1 : cut === 'part' ? 0.5 : 0;
  if (bd.about === 'act') {
    const D = s.bodies[bd.a]!, C = s.bodies[bd.b]!;
    if (!D.alive || !C.alive) return false;
    const owed = bd.q * share;
    if (owed > 0 && !bd.labour) {
      // What is enforced is paid now as far as it can be, and the rest is worked off.
      const pay = Math.min(owed, D.store[bd.kind]!);
      // The court keeps a share of what it enforces.
      D.store[bd.kind] = D.store[bd.kind]! - pay; C.store[bd.kind] = C.store[bd.kind]! + pay * (1 - P.crownFee); c.store[bd.kind] = c.store[bd.kind]! + pay * P.crownFee;
      if (owed - pay > 0.05) bond(s, { about: 'act', a: D.id, b: C.id, kind: bd.kind, q: (owed - pay) * TOIL[bd.kind]!, due: s.t, labour: true, basis: 'grant', rec: e.id, way: bd.way });
      const after = cover(D.store, askAhead(s, D));
      grieve(c, D.id, P.harmPaid + (after.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.dire) ? P.harmLost : 0));
      bd.q = 0;
    } else if (owed > 0) { bd.q = owed; grieve(c, D.id, P.harmPaid); } else bd.q = 0;
    if (share < 1) grieve(c, C.id, P.harmLost * (1 - share));
    return true;
  }
  if (bd.about === 'right') {
    if (cut === 'enforce') grieve(c, bears, P.harmPaid);
    else if (cut === 'strike') { bd.share = 0; grieve(c, gains, P.harmLost); }
    else { bond(s, { about: 'right', a: p.by, cell: bd.cell, kind: bd.kind, share: bd.share, due: -1, used: s.t, basis: 'grant', way: 'rival', rec: e.id }); grieve(c, gains, P.harmPaid); }
    return true;
  }
  if (bd.about === 'land') {
    // Ground: confirmed to its holder, shared with the one who asks, taken from the holder, or turned over.
    if (cut === 'enforce') { bd.strength = Math.max(bd.strength, 3); grieve(c, p.by, P.harmUnheard * 2); }
    else if (cut === 'part') { bd.strength /= 2; bond(s, { about: 'land', a: p.by, cell: bd.cell, basis: 'grant', strength: bd.strength, rec: e.id }); grieve(c, gains, P.harmLost / 2); }
    else if (cut === 'strike') { bd.strength = 0; grieve(c, gains, P.harmLost); }
    else { grieve(c, gains, P.harmLost); bd.a = p.by; bd.basis = 'grant'; }
    return true;
  }
  if (bd.about === 'yield') {
    // A standing share of what is gathered: confirmed, halved, ended, or lifted for a year.
    if (cut === 'enforce') grieve(c, bears, P.harmPaid);
    else if (cut === 'part') { bd.share /= 2; grieve(c, gains, P.harmPaid); }
    else { bd.share = 0; grieve(c, gains, P.harmLost); }
    return true;
  }
  // A bond about a bond: a surety or a letting.
  if (cut === 'enforce') {
    if (bd.secures >= 0) { const held = s.bonds.find(x => x.id === bd.on); const debt = s.bonds.find(x => x.id === bd.secures); if (held && debt) { held.a = bd.a; held.basis = 'grant'; debt.q = 0; bd.secures = -2; } }
    else bd.due = Math.max(bd.due, s.t + P.lease);
    grieve(c, bears, P.harmLost);
  } else if (cut === 'part') { if (bd.share > 0) bd.share /= 2; else bd.due = Math.min(bd.due, s.t + 26); grieve(c, gains, P.harmPaid); }
  else { if (bd.secures >= 0) bd.secures = -2; else bd.due = s.t; grieve(c, gains, P.harmLost); }
  return true;
}

export const LAWS: LawKey[] = ['forest', 'movement', 'credit', 'swords'];
/** The dials as a new court finds them. */
export const freshDials = (): Dials => ({ grainShare: P.crownDue, timberShare: P.crownDue, relief: 'off', bailiff: 'regular', boonCap: 3, tithe: 'protected', toll: 0, budget: { spend: 0, relief: 34, reach: 33, legitimacy: 33 } });
/** Work out the levies from the dials: grain's share on everything sown that feeds; timber's on timber, wherever it is cut. */
export function levies(s: State): void {
  const pol = s.court?.policy;
  if (!pol) return;
  const tk = KINDS.findIndex(k => k.id === 'timber');
  pol.levy = Kn.map((k, i) => (i === tk ? pol.dials.timberShare : pol.dials.grainShare));
  pol.levyWork = Kn.map((_k, i) => (i === tk ? pol.dials.timberShare : 0));
}
/** What share of the tithe the Crown takes. */
export const titheSkim = (s: State): number => { const pol = s.court?.policy; return !pol || pol.mode !== 'cockpit' || pol.weak ? 0 : pol.dials.tithe === 'taxed' ? 0.5 : pol.dials.tithe === 'shared' ? 0.25 : 0; };
/** What the Crown takes of a trade between two places, and puts in its store. */
export function tollOn(s: State, a: number, b: number): number {
  const pol = s.court?.policy;
  if (!pol || pol.mode !== 'cockpit' || pol.weak || !pol.dials.toll) return 0;
  return dist(s.side, a, b) > P.reach ? pol.dials.toll : 0;
}
export function toCrown(s: State, k: number, q: number, why: string): void {
  const c = s.court;
  if (!c || q <= 0) return;
  c.store[k] = c.store[k]! + q;
  note(s, c, 'store', q, why);
}
/** Why the Crown cannot hold court at a place now, or '' if it can: a royal progress. */
export function whyNotSeat(s: State, cell: number): string {
  const c = s.court;
  if (!c || c.policy.mode !== 'cockpit') return 'No Crown';
  if (c.seat === cell) return 'Here now';
  const w = 13 - (s.t - (c.seatMoved ?? -999));
  if (w > 0) return `${w}w left`;
  const gk = KINDS.findIndex(k => k.id === 'grain');
  if (gk >= 0 && c.store[gk]! < P.progressCost) return `Need ${P.progressCost} grain`;
  return '';
}
export function moveSeat(s: State, cell: number): boolean {
  const c = s.court;
  if (!c || whyNotSeat(s, cell)) return false;
  const gk = KINDS.findIndex(k => k.id === 'grain');
  if (gk >= 0) { c.store[gk] = c.store[gk]! - P.progressCost; note(s, c, 'store', -P.progressCost, 'a royal progress'); }
  c.seat = cell; c.seatMoved = s.t;
  rec(s, 'judge', { a: -1, cell, way: 'royal progress' });
  return true;
}
const nearSeat = (s: State, c: Court, home: number): boolean => c.seat !== undefined && dist(s.side, c.seat, home) <= 2;
/** The laws as a new court finds them: none laid down. */
export const freshLaws = (): Pick<Policy, 'laws' | 'lawSetAt' | 'inscribed' | 'lawHits'> => {
  const per = <T,>(v: T) => Object.fromEntries(LAWS.map(k => [k, v])) as Record<LawKey, T>;
  return { laws: { forest: 'free', movement: 'free', credit: 'enforce', swords: 'immunity' }, lawSetAt: per(-1), inscribed: per(false), lawHits: per(0) };
};
export const ORD_WEEKS: Record<OrdKey, number> = { stay: 52, granaries: 13, eyre: 26, penance: 26 };
const live = (c: Court): boolean => c.policy.mode !== 'regency';

/** Lay down a standing law. Changing one within the year it was laid down is caprice; changing one on the roll is worse, and takes it off the roll. */
export function setLaw<K extends LawKey>(s: State, key: K, val: Laws[K]): void {
  const c = s.court, pol = c?.policy;
  if (!c || !pol) return;
  const was = pol.lawSetAt[key];
  if (was >= 0 && pol.laws[key] === val) return;
  if (pol.inscribed[key] || (was >= 0 && s.t - was < 52)) {
    c.caprice += pol.inscribed[key] ? 3 : 1; gauge(s, c, 'legitimacy', -(pol.inscribed[key] ? 0.5 : 0.15), pol.inscribed[key] ? 'a law on the roll undone' : 'a law changed within the year');
    rec(s, 'caprice', { a: -1, b: -1, way: `law ${key}` });
  }
  pol.inscribed[key] = false;
  pol.laws[key] = val; pol.lawSetAt[key] = s.t;
  rec(s, 'rule', { a: -1, kind2: 0, q2: -3, way: `law ${key} ${val}` });
}
export function setDial<K extends keyof Dials>(s: State, key: K, val: Dials[K]): void {
  const pol = s.court?.policy;
  if (!pol) return;
  pol.dials[key] = val;
  // The Crown's share is written into every holding's due to the king's bailiff.
  if (key === 'grainShare' || key === 'timberShare') levies(s);
}
export function issueOrdinance(s: State, key: OrdKey): boolean {
  const pol = s.court?.policy;
  if (!pol || pol.ord[key] > 0) return false;
  pol.ord[key] = ORD_WEEKS[key];
  rec(s, 'rule', { a: -1, kind2: 0, q2: -4, way: `decree ${key}` });
  return true;
}
/** Write a standing law on the roll: it gains the court legitimacy, and nobody may challenge it; but undoing it is caprice of the worst kind. */
export function inscribeLaw(s: State, key: LawKey): boolean {
  const c = s.court, pol = c?.policy;
  if (!c || !pol || pol.inscribed[key] || pol.lawSetAt[key] < 0) return false;
  pol.inscribed[key] = true; gauge(s, c, 'legitimacy', 0.35, 'a law written on the roll');
  rec(s, 'rule', { a: -1, kind2: 0, q2: -5, way: `inscribe ${key}` });
  return true;
}

/** Which standing law speaks to a matter, if any. What none speaks to goes to whoever holds sway locally. */
export function lawOf(s: State, p: Petition): LawKey | null {
  if (p.reason !== 'none') return null;
  if (p.burdens.length) return 'credit';
  if (p.side === 'heresy' || p.side === 'mortmain' || p.side === 'sanctuary' || p.side === 'shrine' || p.side === 'unclean') return 'swords';
  if (p.side === 'exceeds' || p.side === 'exit') return 'movement';
  const bd = s.bonds.find(b => b.id === p.bond);
  if (bd && bd.about === 'act' && (p.side === 'owed' || p.side === 'owes')) return 'credit';
  return null;
}
/** What the standing laws would cut on a matter: the first of their preferred answers the matter allows. */
export function lawCut(s: State, p: Petition): string | null {
  const c = s.court, pol = c?.policy, key = lawOf(s, p);
  if (!c || !pol || p.reason !== 'none') return null;
  const L = pol.laws, can = cuts(s, p);
  const remits = can.filter(x => x === 'remit' || x.startsWith('remit:'));
  const first = (...xs: string[]): string | null => xs.find(x => can.includes(x)) ?? null;
  // Whatever no law reaches: the local lord or body, or, where there is none, things are left as they stand.
  const below = (): string | null => remits[0] ?? first('uphold', 'confirm', 'enforce', 'refuse', 'dismiss');
  if (!key || pol.lawSetAt[key] < 0) return key === 'credit' || key === null ? below() : below();
  const v = L[key] as string;
  if (key === 'credit') {
    if (p.burdens.length) return v === 'mercy' ? can.find(x => x.startsWith('ease:')) ?? null : 'dismiss';
    return v === 'enforce' ? first('enforce') : v === 'mercy' ? first('surety', 'pardon', 'stay', 'answer', 'bar') : remits[0] ?? first('answer', 'surety', 'enforce');
  }
  if (key === 'movement') return p.side === 'exit' ? first(v === 'free' ? 'release' : 'tie') : first(v === 'free' ? 'custom' : 'uphold');
  if (p.side === 'heresy') return v === 'immunity' ? remits[0] ?? null : v === 'concordat' ? first('silence') : first('tolerate');
  return v === 'immunity' ? first('uphold', 'respect', 'sanction', 'compel') : v === 'concordat' ? first('commute', 'abjure', 'inquire', 'penance') : first('break', 'extract', 'suppress', 'depose');
}
/** Settle a matter by standing law. In the Regency a hurt party may challenge a law; in the Cockpit there is no one to hear it. */
function byLaw(s: State, c: Court, p: Petition): boolean {
  if (!live(c) || c.policy.weak) return false;
  const key = lawOf(s, p), cut = lawCut(s, p);
  if (!cut) return false;
  if (!carry(s, c, p, cut)) return false;
  teach(s, hearthIndex(s), p.by, p.side, FAVOUR[p.side]?.[cut.split(':')[0]!] ?? 0.5, P.pleaOwn);
  const byLawItself = key && pol(c).lawSetAt[key] >= 0;
  if (byLawItself) c.policy.lawHits[key]++;
  rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: byLawItself ? -3 : -6, way: p.shape });
  return true;
}
const pol = (c: Court): Policy => c.policy;

/** An order for one place on the map. False if it cannot be given there now. */
export function localOrder(s: State, cell: number, kind: LocalOrder): boolean {
  const c = s.court;
  // Orders for a place still go out when the Crown is weak: they are how it wins back trust and obedience.
  if (!c || !live(c)) return false;
  const key = `local:${kind}:${cell}`;
  if (s.t - (c.seen[key] ?? -999) < 13) return false;
  const idx = hearthIndex(s), here = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length && b.home === cell);
  const near = around(idx, s.side, cell, 1), stL = storeOf(c);
  let done = false;
  if (kind === 'relief') {
    for (const b of here) {
      const cov = cover(b.store, askAhead(s, b));
      for (let k = 0; k < NN; k++) if (NEEDS[k]!.harm >= 0.5 && cov[k]! < P.short) { if (relieve(s, c, b, k) > 0) { done = true; grieve(c, b.id, -P.harmPaid); } break; }
    }
  } else if (kind === 'circuit') {
    // The bailiffs ride through: what was kept back is paid, false claims are found out, and the Crown is seen.
    for (const X of near) {
      if (X.hid.reduce((a, q) => a + (q ?? 0), 0) > 0.5) { for (let k = 0; k < X.hid.length; k++) { const pay = Math.min(X.hid[k] ?? 0, X.store[k]!); X.store[k] = X.store[k]! - pay; c.store[k] = c.store[k]! + pay; } X.hid = []; grieve(c, X.id, P.harmPaid); }
      for (const bd of s.bonds) if (bd.about === 'act' && bd.fabricated && bd.denied && bd.q > 0 && bd.b === X.id) { bd.q = 0; X.lore[`house:${X.id}`] = 0; }
    }
    gauge(s, c, 'reach', 0.15, 'bailiffs sent'); done = true;
  } else if (kind === 'charter') {
    // A year's remission of the Crown's share for the place: the store goes without, and the place remembers it.
    for (const bd of s.bonds) if (bd.about === 'yield' && bd.way === 'crown' && here.some(b => b.id === bd.a)) { bd.easedTo = s.t + 52; done = true; }
    for (const b of here) grieve(c, b.id, -P.harmPaid * 2);
    if (done) gauge(s, c, 'legitimacy', 0.1, 'the Crown’s share remitted');
  } else {
    const cl = s.cells[cell]!;
    if (cl.interdict > 0) { cl.interdict = 0; gauge(s, c, 'legitimacy', 0.1, 'an interdict lifted'); done = true; }
    else if (cl.shrine && !cl.shrine.sanctioned) { cl.shrine.sanctioned = true; gauge(s, c, 'legitimacy', 0.05, 'a shrine sanctioned'); done = true; }
    else {
      const priest = here.find(b => b.rank === 'priest' && (head(s, b)?.stained ?? 0) >= P.stainMark);
      if (priest) { const h = head(s, priest)!; h.stained /= 2; done = true; }
      else {
        // A feud: two houses here or beside it that will not deal with one another. The Crown imposes its peace.
        for (const a of near) for (const b of near) if (a.id < b.id && (s.ties[a.id]?.[b.id] ?? 0) <= -0.6) { setTie(s, a.id, b.id, -0.2); setTie(s, b.id, a.id, -0.2); done = true; }
        if (done) gauge(s, c, 'reach', -0.1, 'the king’s peace imposed');
      }
    }
  }
  if (!done) return false;
  note(s, c, 'store', storeOf(c) - stL, kind === 'relief' ? 'relief sent' : kind === 'circuit' ? 'bailiffs sent' : 'an order');
  c.seen[key] = s.t;
  rec(s, 'judge', { a: -1, cell, way: `local ${kind}` });
  return true;
}
/** The kind the Crown pays for works in. */
export const timberKind = (): number => KINDS.findIndex(k => k.id === 'timber');
/** The kind a granary keeps: what feeds and keeps best. */
const grainKind = (): number => { const n = BY_HARM[0]!; let k = -1; for (let j = 0; j < NK; j++) if (!Kn[j]!.fixed && Kn[j]!.serves[n]! > 0 && (k < 0 || Kn[j]!.keep < Kn[k]!.keep)) k = j; return k; };
/** Why a work cannot be built at a place now, or '' if it can. */
export function whyNotBuild(s: State, cell: number, key: WorkKey): string {
  const c = s.court, w = s.cells[cell]!.works ?? {};
  if (!c || c.policy.mode !== 'cockpit') return 'No Crown';
  if (w[key]) return 'Built';
  const tk = timberKind();
  if (tk < 0 || c.store[tk]! < P.workCost[key]!) return `Need ${P.workCost[key]} timber`;
  return '';
}
/** Build a work at a place, paid out of the Crown's timber. */
export function build(s: State, cell: number, key: WorkKey): boolean {
  const c = s.court;
  if (!c || whyNotBuild(s, cell, key)) return false;
  const tk = timberKind(), cl = s.cells[cell]!, w = (cl.works ??= {});
  c.store[tk] = c.store[tk]! - P.workCost[key]!;
  note(s, c, 'store', -P.workCost[key]!, 'works built');
  if (key === 'granary') w.granary = new Array<number>(NK).fill(0);
  else w[key] = true;
  // A chapel makes the place holier.
  if (key === 'chapel') cl.sanctity = Math.min(1, cl.sanctity + 0.3);
  rec(s, 'build', { a: -1, cell, way: key });
  return true;
}
/** The works' week: granaries take in what houses can spare and give it back in want; posts and chapels calm the places about them. */
function worksWeek(s: State, c: Court): void {
  const idx = hearthIndex(s), gk = grainKind(), food = BY_HARM[0]!;
  let posts = 0, chapels = 0;
  s.cells.forEach((cl, i) => {
    const w = cl.works;
    if (!w) return;
    if (w.granary && gk >= 0) {
      const g = w.granary;
      for (let k = 0; k < NK; k++) g[k] = (g[k] ?? 0) * (1 - Kn[k]!.keep * P.granaryKeep);
      for (const b of around(idx, s.side, i, P.workReach)) {
        if (b.parts.length || !b.members.length) continue;
        const ahead = askAhead(s, b), perWeek = (ahead[food]! * Kn[gk]!.use) / Kn[gk]!.serves[food]!, weeks = perWeek > 0 ? b.store[gk]! / perWeek : 0;
        if (weeks > P.granaryFull) { const q = (b.store[gk]! - P.granaryFull * perWeek) * P.granaryShare; b.store[gk] = b.store[gk]! - q; g[gk] = g[gk]! + q; }
        else if (weeks < P.short && g[gk]! > 0) { const q = Math.min(g[gk]!, 3 * perWeek); b.store[gk] = b.store[gk]! + q; g[gk] = g[gk]! - q; if (q > 0.5) rec(s, 'judge', { a: b.id, q, cell: i, way: 'fed from the granary' }); }
      }
    }
    // Grievance fades faster near a bailiff's post or a chapel: the Crown is seen to be there.
    if (w.post || w.chapel) for (const b of around(idx, s.side, i, P.postReach)) if (c.grief[b.id]) c.grief[b.id] = c.grief[b.id]! * (w.post && w.chapel ? 0.94 : 0.96);
    if (w.post) posts++;
    if (w.chapel) chapels++;
  });
  if (s.t % 13 === 0 && !c.policy.weak) {
    if (posts) gauge(s, c, 'reach', Math.min(0.5, 0.05 * posts), 'bailiffs’ posts');
    if (chapels) gauge(s, c, 'legitimacy', Math.min(0.5, 0.05 * chapels), 'chapels endowed');
  }
}
/** Houses near a bailiff's post do not join a faction against the Crown. */
const guarded = (s: State, b: Body): boolean => s.cells.some((cl, i) => cl.works?.post && dist(s.side, i, b.home) <= P.postReach);

/** The powers of the realm: lords, parishes, and bodies of houses. */
export function powersOf(s: State): Body[] {
  return s.bodies.filter(b => b.alive && (b.rank === 'lord' || b.rank === 'priest' || (b.parts.length > 0 && b.of < 0)));
}
/** The hearths a power answers for: its own body's, or, for a lord or priest, those about its seat. */
export function underPower(s: State, P0: Body): Body[] {
  const hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length);
  if (P0.parts.length) return hs.filter(h => top(s, h).id === P0.id);
  return hs.filter(h => h.id !== P0.id && dist(s.side, h.home, P0.home) <= P.postReach);
}
/** The lord nearest a place, if any lies within reach. */
const lordNear = (s: State, cell: number, not = -1): Body | undefined => s.bodies.filter(b => b.alive && b.rank === 'lord' && b.id !== not && dist(s.side, b.home, cell) <= P.far).sort((a, b) => dist(s.side, a.home, cell) - dist(s.side, b.home, cell) || a.id - b.id)[0];
const shrineFor = (s: State, lord: Body): number => s.cells.findIndex((cl, i) => cl.shrine && cl.shrine.to !== lord.id && dist(s.side, i, lord.home) <= P.postReach);
/** Why an act cannot be done with a power now, or '' if it can. */
export function whyNotAct(s: State, id: number, act: PowerAct): string {
  const c = s.court, B = s.bodies[id];
  if (!c || c.policy.mode !== 'cockpit' || !B?.alive) return 'Gone';
  const ps = c.policy.powers?.[id] ?? {}, last = ps.last?.[act] ?? -999;
  if (s.t - last < 26) return `${26 - (s.t - last)}w left`;
  if (act === 'warden') return B.rank !== 'lord' ? 'Lords only' : ps.warden !== undefined ? 'Already' : '';
  if (act === 'revoke') return ps.warden === undefined ? 'Not a warden' : '';
  if (act === 'charter') return (ps.charter ?? -1) > s.t ? 'Chartered' : '';
  if (act === 'uncharter') return (ps.charter ?? -1) > s.t ? '' : 'No charter';
  if (act === 'church') return B.rank === 'priest' ? (lordNear(s, B.home) ? '' : 'No lord near') : B.rank === 'lord' ? (shrineFor(s, B) >= 0 ? '' : 'No shrine near') : 'Lords & parishes';
  return (ps.hostage ?? -1) > s.t ? 'Held' : '';
}
/** Deal with a named power. */
export function actOn(s: State, id: number, act: PowerAct): boolean {
  const c = s.court;
  if (!c || whyNotAct(s, id, act)) return false;
  const B = s.bodies[id]!, ps = ((c.policy.powers ??= {})[id] ??= {}), under = underPower(s, B);
  (ps.last ??= {})[act] = s.t;
  const crownBonds = (hs: Body[]) => s.bonds.filter(bd => bd.about === 'yield' && bd.way === 'crown' && hs.some(h => h.id === bd.a || h.id === id));
  if (act === 'warden') {
    // A warden keeps the king's peace in his country: obedience now, and a following of his own in time.
    ps.warden = s.t; ps.ambition = 0; ps.defiant = false;
    gauge(s, c, 'reach', 0.5, `a warden appointed`);
    c.grief[id] = 0;
  } else if (act === 'revoke') {
    // Taking the office back from a man who has built a following costs what he has built.
    const amb = ps.ambition ?? 0;
    if (amb > 0.5 || ps.defiant) { gauge(s, c, 'reach', -1, 'a warden unseated'); for (const h of under) grieve(c, h.id, P.harmPaid); }
    grieve(c, id, P.harmPaid * 3);
    delete ps.warden; delete ps.ambition; delete ps.defiant;
  } else if (act === 'charter') {
    // Ten years free of the Crown's share for the power and those under it. Its neighbours see who is favoured.
    ps.charter = s.t + 520;
    for (const bd of crownBonds(under)) bd.easedTo = ps.charter;
    for (const h of [B, ...under]) c.grief[h.id] = 0;
    for (const x of around(hearthIndex(s), s.side, B.home, P.postReach + 1)) if (x.id !== id && !under.includes(x)) grieve(c, x.id, P.harmPaid / 2);
  } else if (act === 'uncharter') {
    ps.charter = s.t;
    for (const bd of crownBonds(under)) bd.easedTo = s.t;
    grieve(c, id, P.harmPaid * 2);
    for (const x of around(hearthIndex(s), s.side, B.home, P.postReach + 1)) if (x.id !== id && !under.includes(x) && c.grief[x.id]) c.grief[x.id] = c.grief[x.id]! * 0.5;
  } else if (act === 'church') {
    if (B.rank === 'priest') {
      // The Crown backs the parish against the lord who presses on it.
      const L = lordNear(s, B.home)!;
      gauge(s, c, 'legitimacy', 0.15, 'the parish backed against its lord');
      grieve(c, L.id, P.harmPaid * 2); c.grief[id] = 0; warm(s, L.id, id, -0.2);
      const lp = c.policy.powers?.[L.id]; if (lp?.ambition) lp.ambition = Math.max(0, lp.ambition - 0.2);
      rec(s, 'judge', { a: id, b: L.id, way: 'power church' });
    } else {
      // The lord may take a share of a rich shrine's offerings: he is pleased; the pious are not.
      const i = shrineFor(s, B), sh = s.cells[i]!.shrine!;
      sh.to = id; c.grief[id] = 0;
      grieve(c, sh.of, P.harmPaid * 2);
      for (const x of around(hearthIndex(s), s.side, i, P.reach)) if ((head(s, x)?.credulous ?? 0) > 0.55) grieve(c, x.id, P.harmPaid / 2);
      rec(s, 'judge', { a: id, cell: i, way: 'power shrine' });
    }
  } else {
    // A hostage for a year: the power keeps the peace, and its ambition is checked; it does not forgive the Crown.
    ps.hostage = s.t + 52;
    if (ps.ambition !== undefined) { ps.ambition = Math.min(ps.ambition, 0.3); ps.defiant = false; }
    for (const x of around(hearthIndex(s), s.side, B.home, 1)) if ((s.ties[id]?.[x.id] ?? 0) < -0.3) { setTie(s, id, x.id, -0.3); setTie(s, x.id, id, -0.3); }
    grieve(c, id, P.harmPaid * 2);
  }
  rec(s, 'judge', { a: -1, b: id, way: `power ${act}` });
  return true;
}
/** The powers' week: wardens keep their country quiet and grow in ambition; one grown too great defies the Crown. */
function powersWeek(s: State, c: Court): void {
  const all = c.policy.powers;
  if (!all) return;
  for (const [k, ps] of Object.entries(all)) {
    const id = Number(k), B = s.bodies[id];
    if (!B?.alive) { delete all[id]; continue; }
    if (ps.warden === undefined) continue;
    const under = underPower(s, B);
    for (const h of under) if (c.grief[h.id]) c.grief[h.id] = c.grief[h.id]! * 0.97;
    if (s.t % 13 === 0 && !ps.defiant && !c.policy.weak) gauge(s, c, 'reach', 0.05, 'wardens keeping the peace');
    // Ambition grows with the country he keeps, unless a hostage of his is held.
    if ((ps.hostage ?? -1) <= s.t) ps.ambition = (ps.ambition ?? 0) + P.wardenAmbition * (1 + under.length / 8) * (c.seat !== undefined && dist(s.side, c.seat, B.home) > 5 ? 1.5 : 1);
    if (!ps.defiant && (ps.ambition ?? 0) >= 1) { ps.defiant = true; rec(s, 'defy', { a: id, way: 'warden' }); }
    if (ps.defiant) {
      // A defiant warden keeps the Crown's share of his country for himself.
      for (const bd of s.bonds) if (bd.about === 'yield' && bd.way === 'crown' && under.some(h => h.id === bd.a)) bd.easedTo = Math.max(bd.easedTo, s.t + 1);
      gauge(s, c, 'reach', -0.02, `a defiant warden at #${B.home}`);
    }
  }
}

/** What intervening locally would do at a place, if anything. */
export function interventionAt(s: State, cell: number): string {
  const cl = s.cells[cell]!;
  if (cl.interdict > 0) return 'interdict';
  if (cl.shrine && !cl.shrine.sanctioned) return 'shrine';
  const here = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length && b.home === cell);
  if (here.some(b => b.rank === 'priest' && (head(s, b)?.stained ?? 0) >= P.stainMark)) return 'stained';
  const near = around(hearthIndex(s), s.side, cell, 1);
  for (const a of near) for (const b of near) if (a.id < b.id && (s.ties[a.id]?.[b.id] ?? 0) <= -0.6) return 'feud';
  return '';
}

/** The Cockpit's week: decrees run down, the relief floor, the bailiffs' posture, patronage, and whether the Crown has lost or regained its hold. */
function policyWeek(s: State, c: Court): void {
  const pol = c.policy;
  if (pol.mode === 'regency') return;
  worksWeek(s, c);
  powersWeek(s, c);
  const idx = hearthIndex(s);
  // Relief from the Crown's store for houses below the floor; the granaries open wider while ordered.
  let st1 = storeOf(c);
  const floor = pol.dials.relief === 'want' ? P.short : pol.dials.relief === 'starving' || pol.ord.granaries > 0 ? P.dire : -1;
  if (floor > 0 && !pol.weak) {
    let n = pol.ord.granaries > 0 ? 6 : 3;
    const want: [Body, number, number][] = [];
    for (const b of s.bodies) {
      if (!b.alive || b.parts.length || !b.members.length || b.rank) continue;
      const cov = cover(b.store, askAhead(s, b));
      for (let k = 0; k < NN; k++) if (NEEDS[k]!.harm >= 0.5 && cov[k]! < floor) { want.push([b, k, cov[k]!]); break; }
    }
    want.sort((x, y) => x[2] - y[2] || x[0].id - y[0].id);
    for (const [b, need] of want) { if (n <= 0) break; const q = relieve(s, c, b, need); if (q > 0) { n--; rec(s, 'judge', { a: b.id, q, need, way: 'relief by the floor' }); } }
  }
  note(s, c, 'store', storeOf(c) - st1, 'the relief floor'); st1 = storeOf(c);
  // A strict posture, or the eyre: false claims are found out, and what was kept back from the Crown is paid.
  const strict = pol.dials.bailiff === 'strict', eyre = pol.ord.eyre > 0;
  if (strict && !pol.weak) gauge(s, c, 'reach', -0.01, 'strict bailiffs');
  if (eyre) { gauge(s, c, 'reach', 0.04, 'the royal eyre'); gauge(s, c, 'legitimacy', 0.03, 'the royal eyre'); }
  if ((strict || eyre) && !pol.weak) {
    for (const bd of s.bonds) if (bd.about === 'act' && bd.fabricated && bd.denied && bd.q > 0) {
      bd.q = 0; grieve(c, bd.b, -P.harmPaid);
      for (const x of around(idx, s.side, s.bodies[bd.b]!.home, P.reach)) if (x.id !== bd.b) x.lore[`house:${bd.b}`] = Math.min(1.5, (x.lore[`house:${bd.b}`] ?? 0) + 0.3);
      rec(s, 'judge', { a: bd.a, b: bd.b, q2: 1, way: 'a false claim found out' });
    }
    if (strict) for (const X of s.bodies) {
      if (!X.alive || X.hid.reduce((a, q) => a + (q ?? 0), 0) <= 1) continue;
      for (let k = 0; k < X.hid.length; k++) { const pay = Math.min(X.hid[k] ?? 0, X.store[k]!); X.store[k] = X.store[k]! - pay; c.store[k] = c.store[k]! + pay; }
      X.hid = []; grieve(c, X.id, P.harmPaid);
      rec(s, 'judge', { b: X.id, q2: 1, way: 'the Crown’s share kept back, found out' });
    }
  }
  note(s, c, 'store', storeOf(c) - st1, 'shares found hidden'); st1 = storeOf(c);
  // Solemn penance: interdicts lift sooner, stains fade, the fear of strangers and of heresy cools.
  if (pol.ord.penance > 0) {
    for (const cl of s.cells) if (cl.interdict > 0) cl.interdict = Math.max(0, cl.interdict - 2);
    for (const p of s.people) if (p.alive) { p.stained *= 0.9; p.ban *= 0.9; }
    for (const b of s.bodies) { if (b.lore.new) b.lore.new *= 0.85; for (const m of grown(s, b)) if (m.lore.new) m.lore.new *= 0.85; }
  }
  // Tenants bound to the ground, and in want, hold it against the Crown that bound them.
  if (s.t % 13 === 0 && pol.lawSetAt.movement >= 0 && pol.laws.movement === 'bound' && !pol.weak) {
    for (const bd of s.bonds) if (bd.about === 'bond' && bd.way === 'manor') {
      const T = s.bodies[bd.a];
      if (T?.alive && cover(T.store, askAhead(s, T)).some((x, k) => NEEDS[k]!.harm >= 0.5 && x < P.short)) grieve(c, T.id, P.harmPaid);
    }
  }
  // The seasonal budget: a share of the store spent on relief for the neediest, on the bailiffs' reach, and on the parishes' goodwill.
  const bud = pol.dials.budget;
  if (bud.spend > 0 && s.t % 13 === 0 && !pol.weak) {
    const total = storeOf(c), spend = (total * bud.spend) / 100;
    if (spend > 1) {
      const fr = bud.relief / 100, fe = bud.reach / 100, fl = bud.legitimacy / 100;
      for (let k = 0; k < NK; k++) c.store[k] = c.store[k]! * (1 - (bud.spend / 100) * (fe + fl));
      if (fe > 0) gauge(s, c, 'reach', 0.5 * fe * (bud.spend / 5), 'the budget: bailiffs');
      if (fl > 0) gauge(s, c, 'legitimacy', 0.5 * fl * (bud.spend / 5), 'the budget: parishes');
      if (fr > 0) {
        let left = spend * fr;
        const want: [Body, number, number][] = [];
        for (const b of s.bodies) { if (!b.alive || b.parts.length || !b.members.length || b.rank) continue; const cov = cover(b.store, askAhead(s, b)); for (let n = 0; n < NN; n++) if (NEEDS[n]!.harm >= 0.5 && cov[n]! < P.short) { want.push([b, n, cov[n]!]); break; } }
        want.sort((x, y) => x[2] - y[2] || x[0].id - y[0].id);
        for (const [b, need] of want) { if (left <= 0) break; left -= relieve(s, c, b, need); }
      }
    }
  }
  // The boon cap: a low one pleases tenants and galls lords; the tithe, if the Crown takes of it, costs it the church's goodwill.
  if (s.t % 13 === 0 && !pol.weak) {
    const cap = pol.dials.boonCap;
    if (cap < 3) for (const b of s.bodies) if (b.alive && b.rank === 'lord') grieve(c, b.id, (P.harmPaid * (3 - cap)) / 3);
    if (cap < 3) for (const bd of s.bonds) if (bd.about === 'bond' && bd.way === 'manor' && c.grief[bd.a]) c.grief[bd.a] = c.grief[bd.a]! * 0.9;
    if (pol.dials.tithe !== 'protected') {
      gauge(s, c, 'legitimacy', pol.dials.tithe === 'taxed' ? -0.15 : -0.05, 'the Crown takes of the tithe');
      for (const b of s.bodies) if (b.alive && b.rank === 'priest') grieve(c, b.id, pol.dials.tithe === 'taxed' ? P.harmPaid : P.harmPaid / 2);
    }
  }
  // Near the Crown's seat, grievance fades fast.
  if (c.seat !== undefined) for (const b of around(idx, s.side, c.seat, 2)) if (c.grief[b.id]) c.grief[b.id] = c.grief[b.id]! * 0.95;
  note(s, c, 'store', storeOf(c) - st1, 'the budget');
  for (const k of Object.keys(pol.ord) as OrdKey[]) if (pol.ord[k] > 0) pol.ord[k]--;
  // The Crown that has lost its hold is not ended; it is ignored, until it is trusted and obeyed again.
  if (!pol.weak && (c.legitimacy <= 0 || c.reach <= 0)) { pol.weak = true; rec(s, 'withdraw', { q: -1, q2: 0 }); }
  else if (pol.weak && c.legitimacy > 1 && c.reach > 1) { pol.weak = false; rec(s, 'withdraw', { q: -2, q2: 0 }); }
}

/** The rule that settles a matter below, if there is one answer to it. */
function ruleFor(s: State, c: Court, p: Petition): Rule | 'clash' | null {
  const a = scopeOf(s, p.by), b = p.against >= 0 ? scopeOf(s, p.against) : a;
  // A kind of matter left to whoever holds sway locally goes to them, wherever there is such a one.
  const lp = localPower(s, p), lps = localPowers(s, p);
  const remit = c.rules.find(r => r.cut === 'remit' && r.shape === p.shape && (r.scope === -1 ? lp >= 0 && lps.length < 2 : lps.includes(r.scope)));
  if (remit) return remit;
  const find = (scope: number): Rule | undefined => c.rules.find(r => r.shape === p.shape && r.scope === scope && r.cut !== 'remit');
  // Two of one body are settled by that body's rule. Two of different bodies whose rules differ cannot be.
  if (a >= 0 && a === b) { const r = find(a); if (r) return r; }
  else if (a >= 0 && b >= 0) { const m = find(a), t = find(b); if (m && t && m.cut !== t.cut) return 'clash'; }
  return find(-1) ?? null;
}

/** Settle a matter by a rule. One hurt enough by it may challenge the rule, once. */
function below(s: State, c: Court, p: Petition, r: Rule): void {
  const before = [p.by, p.against].map(w => (w >= 0 ? c.grief[w] ?? 0 : 0));
  carry(s, c, p, r.cut);
  teach(s, hearthIndex(s), p.by, p.side, FAVOUR[p.side]?.[r.cut] ?? 0.5, P.pleaOwn);
  r.uses++;
  rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: r.scope, way: p.shape });
  [p.by, p.against].forEach((who, i) => {
    if (r.roll || who < 0 || !s.bodies[who]!.alive || (c.grief[who] ?? 0) - before[i]! < P.harmPaid || (c.grief[who] ?? 0) < P.aggrieved) return;
    const key = `c${r.id}`;
    if (s.t - (c.seen[key] ?? -999) < 52) return;
    c.seen[key] = s.t;
    c.docket.push({ id: c.next++, t: s.t, by: who, against: -1, bond: r.id, need: -1, rec: -1, shape: `against the rule: ${r.cut} ${r.shape}`, burdens: [], shapes: [], side: 'bare', reason: 'challenge', speaksFor: leaves(s, top(s, s.bodies[who]!)).length, waited: 0, urgency: 0 });
  });
}

/**
 * The audience. Gathers the week's matters, settles below whatever a rule covers, and seats the most
 * urgent of the rest, one of each shape. Returns those seated.
 */
export function audience(s: State): Petition[] {
  const c = s.court;
  if (!c) return [];
  const stA = storeOf(c);
  const byId = new Map<number, Bond>();
  for (const b of s.bonds) byId.set(b.id, b);
  const kin = kinOf(s), idx = hearthIndex(s);
  const fresh: Petition[] = [];
  const shapeFor = (by: number, against: number, bd: Bond | undefined, side: Petition['side'], need: number, extra = ''): string => {
    const A = s.bodies[by]!, B = against >= 0 ? s.bodies[against]! : undefined;
    const near = !B ? 'nobody' : kin.get(by)?.has(against) ? 'kin' : A.of >= 0 && top(s, A).id === top(s, B).id ? 'of one body' : dist(s.side, A.home, B.home) <= P.reach ? 'a neighbour' : 'a stranger';
    return `${side === 'owed' ? 'owed on' : side === 'owes' ? 'bound by' : side === 'outside' ? 'shut out by' : side === 'asks' ? 'asks leave for' : side === 'fears' ? 'will not abide' : side === 'exit' ? 'will leave' : side === 'suspects' ? 'suspects' : side === 'unaided' ? 'was left unaided against' : side === 'heir' ? 'claims by blood' : side === 'mortmain' ? 'claims back from the holy' : side === 'sanctuary' ? 'is kept from by sanctuary' : side === 'shrine' ? 'objects to' : side === 'unclean' ? 'will not accept' : side === 'heresy' ? 'accuses' : side === 'appeal' ? 'appeals against' : side === 'harmed' ? 'was harmed by' : side === 'exceeds' ? 'is worked beyond custom under' : 'in want'} ${bd ? formOf(byId, bd) : extra}; for ${need >= 0 ? NEEDS[need]!.id : 'nothing pressing'}; against ${near}`;
  };
  const add = (by: number, against: number, bd: Bond | undefined, side: Petition['side'], need: number, recId: number, extra = '', keyed = ''): void => {
    const key = keyed || (bd ? `${side}${bd.id}` : `w${by}:${need}`);
    if (s.t - (c.seen[key] ?? -999) < 26) return;
    const A = s.bodies[by]!, B = against >= 0 ? s.bodies[against]! : undefined;
    // Whether to go to court at all. A house weighs what it expects of the court, less the trouble of going,
    // against its own way: what its might would win in a struggle, or what dealing may yet bring.
    const hope = A.plea[(SIDES as readonly string[]).indexOf(side)] ?? 0.5;
    let own = A.stuck >= P.stuck ? 0 : 0.25;
    if (side === 'owed' && B) { const mA = might(s, kin, A, B.id), mB = might(s, kin, B, A.id); own = mA + mB > 0 ? mA / (mA + mB) - 0.15 : 0.35; }
    if (hope - P.pleaCost <= own) { c.seen[key] = s.t - 18; c.declined++; return; }
    c.seen[key] = s.t;
    A.away += P.pleaDays;
    // One who has gone to court holds their hand while the matter waits.
    if (bd && bd.about === 'act' && side === 'owed') bd.due = Math.max(bd.due, s.t + P.wait);
    const shape = shapeFor(by, against, bd, side, need, extra);
    fresh.push({ burdens: [], shapes: [], id: c.next++, t: s.t, by, against, bond: bd ? bd.id : -1, need, rec: recId, shape, side, reason: 'none', speaksFor: leaves(s, top(s, A)).length, waited: 0, urgency: 0 });
  };

  // What each hearth lacks most, if it lacks anything.
  const lack = new Map<number, number>();
  for (const b of s.bodies) {
    if (!b.alive || b.parts.length || !b.members.length) continue;
    const cov = cover(b.store, askAhead(s, b));
    let worst = -1, by = 0;
    for (let n = 0; n < NN; n++) { const v = NEEDS[n]!.harm * (1 - cov[n]! / P.short); if (NEEDS[n]!.harm >= 0.25 && v > by) { by = v; worst = n; } }
    if (worst >= 0) lack.set(b.id, worst);
    else if (cov.some((x, n) => NEEDS[n]!.harm >= 0.25 && x < P.dire)) lack.set(b.id, cov.findIndex((x, n) => NEEDS[n]!.harm >= 0.25 && x < P.dire));
  }
  const rights = new Map<number, number>(), letOn = new Set<number>();
  for (const bd of s.bonds) {
    if (bd.about === 'land' && bd.strength >= P.held) rights.set(bd.a, (rights.get(bd.a) ?? 0) + 1);
    else if (bd.about === 'bond' && bd.secures < 0) { rights.set(bd.a, (rights.get(bd.a) ?? 0) + 1); letOn.add(bd.on); }
  }
  // What weighs on each house in want. It comes to court once, with all of it.
  const weights = new Map<number, Bond[]>();
  const weigh = (id: number, bd: Bond): void => { const l = weights.get(id); if (l) l.push(bd); else weights.set(id, [bd]); };
  const landShort = (b: Body): boolean => (rights.get(b.id) ?? 0) < grown(s, b).length;
  for (const bd of s.bonds) {
    if (bd.about === 'person') continue;
    const A = s.bodies[bd.a], B = bd.b >= 0 ? s.bodies[bd.b] : undefined;
    if (!A || !A.alive || (B && !B.alive)) continue;
    if (bd.about === 'act') {
      if (bd.q <= 0.05 || !B) continue;
      // Owed on and not met: the one owed asks. Owing and in want: the one who owes asks.
      if ((!bd.labour && bd.broken) || bd.basis === 'wrong') add(bd.b, bd.a, bd, 'owed', lack.get(bd.b) ?? -1, bd.rec);
      // One held to a wrong they did not do asks to be cleared of it.
      // So, brazenly, may one who did.
      if (bd.basis === 'wrong' && bd.doer >= 0 && (bd.doer !== bd.a || (head(s, A)?.scruple ?? 1) < 0.4)) add(bd.a, bd.b, bd, 'owes', lack.get(bd.a) ?? -1, bd.rec);
      if (lack.has(bd.a) && (bd.labour || bd.due - s.t < 13)) weigh(bd.a, bd);
    } else if (bd.about === 'right' && bd.kind >= 0) {
      // Those who do the same work about the place: in want, it weighs on them; prospering, they ask that it be broken.
      for (const cell of near(s.side, bd.cell, 1)) for (const sid in s.worked[`${bd.kind}:${cell}`] ?? {}) {
        const id = Number(sid), d = s.worked[`${bd.kind}:${cell}`]![sid]!;
        if (id === bd.a || d < 4 || !s.bodies[id]?.alive || s.bonds.some(x => x.about === 'right' && x.a === id && x.kind === bd.kind && dist(s.side, x.cell, cell) <= 1)) continue;
        if (lack.has(id)) { if (bd.easedTo <= s.t) weigh(id, bd); } else if (d >= 12) add(id, bd.a, bd, 'outside', -1, bd.rec);
      }
    } else if (bd.about === 'yield' && B) {
      if (lack.has(bd.a) && bd.due <= s.t && bd.easedTo <= s.t) weigh(bd.a, bd);
    } else if (bd.about === 'bond' && B) {
      // A surety or a letting weighs on one side of it when that side is in want.
      const bears = bd.secures >= 0 ? bd.b : bd.a;
      if (lack.has(bears) && (bd.secures >= 0 || bd.share > 0) && bd.easedTo <= s.t) weigh(bears, bd);
      // One who let ground and is now short of it asks for it back.
      if (bd.secures < 0 && landShort(B)) add(bd.b, bd.a, bd, 'owed', lack.get(bd.b) ?? -1, bd.rec);
    } else if (bd.about === 'land' && bd.strength >= 0.5 && !letOn.has(bd.id) && s.t - bd.used >= P.idle && s.t - bd.since >= P.idle) {
      // Ground held and left idle, within reach of one who has too little: the one shut out asks.
      for (const x of around(idx, s.side, bd.cell, P.reach)) {
        if (x.id === bd.a || !landShort(x) || !lack.has(x.id)) continue;
        add(x.id, bd.a, bd, 'outside', lack.get(x.id)!, bd.rec);
        break;
      }
    }
  }
  const heft = (bd: Bond): number => (bd.about === 'yield' || bd.about === 'right' || (bd.about === 'bond' && bd.secures < 0) ? bd.share * 100 : bd.about === 'bond' ? 40 : bd.q / 5);
  for (const [id, all] of weights) {
    const list = all.filter(b => other(b, id) !== id);
    if (!list.length) continue;
    list.sort((x, y) => heft(y) - heft(x) || x.id - y.id);
    // One of each kind of thing owed to each party is enough to say what weighs on it.
    const kinds = new Set<string>();
    const top3 = list.filter(b => { const k = `${other(b, id)}|${b.about}|${b.secures >= 0}|${b.way}|${b.labour}`; if (kinds.has(k)) return false; kinds.add(k); return true; }).slice(0, 3), before = fresh.length;
    add(id, other(top3[0]!, id), top3[0], 'owes', lack.get(id)!, top3[0]!.rec, '', `o${id}`);
    if (fresh.length === before) continue;
    const p = fresh[fresh.length - 1]!;
    p.burdens = top3.map(b => b.id);
    p.shapes = top3.map(b => shapeFor(id, other(b, id), b, 'owes', lack.get(id)!));
  }
  // A prosperous house that does most of some kind of work about a place asks leave to hold it alone.
  for (const key in s.worked) {
    const [w, cellS] = key.split(':'), work = Number(w), at = Number(cellS), r = Rc[work]!;
    if (r.to.length || r.from.some(([st]) => St[st]!.sown) || (!r.from.length && !r.inp.length)) continue;
    const row = s.worked[key]!;
    let total = 0, topId = -1, topD = 0, second = -1, secondD = 0;
    for (const sid in row) { const d = row[sid]!; total += d; if (d > topD) { second = topId; secondD = topD; topId = Number(sid); topD = d; } else if (d > secondD) { second = Number(sid); secondD = d; } }
    if (topId < 0 || topD < 0.4 * total || total - topD < 5) continue;
    const A = s.bodies[topId];
    // Only a house past want, reaching for more, asks; the harder it reaches, the less of the work it needs to have done.
    if (!A || !A.alive || A.parts.length || lack.has(topId)) continue;
    const reach = drive(s, A);
    if (reach < 0.15 || topD < P.charterDays * (1.2 - reach)) continue;
    if (s.bonds.some(x => x.about === 'right' && x.kind === work && dist(s.side, x.cell, at) <= 2)) continue;
    const before = fresh.length;
    add(topId, second, undefined, 'asks', -1, -1, `the sole right to ${r.id}`, `a${topId}`);
    if (fresh.length > before) { const q = fresh[fresh.length - 1]!; q.work = work; q.cell = at; }
  }
  // Constraints. What half or more of a body holds is its custom, and its members will not abide it broken within their bounds.
  // A house's own strong belief about a piece of ground binds it the same way. Each holder raises at most one a week.
  const customs = new Map<number, Set<string>>();
  for (const cb of s.bodies) {
    if (!cb.alive || !cb.parts.length) continue;
    const ls = leaves(s, cb).map(i => s.bodies[i]!);
    if (ls.length < 2) continue;
    const cnt = new Map<string, number>();
    for (const m of ls) for (const sg in m.lore) if (m.lore[sg]! > P.heed) cnt.set(sg, (cnt.get(sg) ?? 0) + 1);
    for (const [sg, n] of cnt) if (n * 2 >= ls.length && n >= 2) for (const m of ls) { let set = customs.get(m.id); if (!set) { set = new Set(); customs.set(m.id, set); } set.add(sg); }
  }
  const barredNear = (id: number, cell: number): boolean => s.bonds.some(x => x.about === 'right' && x.kind < 0 && x.b === id && x.due > s.t && dist(s.side, x.cell, cell) <= P.reach);
  // One matter for each thing objected to and each house that does it, however many hold the objection; a few a week at most.
  let raised = 0;
  for (const b of s.bodies) {
    if (raised >= 3) break;
    if (!b.alive || b.parts.length || !b.members.length) continue;
    const held = new Set(customs.get(b.id) ?? []);
    for (const sg in b.lore) if (sg.startsWith('cell:') && b.lore[sg]! > P.heed + 0.2) held.add(sg);
    for (const sg of held) {
      const holds = (x: Body): boolean => (x.lore[sg] ?? 0) > P.heed;
      let against = -1, at = b.home;
      if (sg.startsWith('cell:')) {
        at = Number(sg.slice(5));
        if (dist(s.side, b.home, at) > P.reach || s.bonds.some(x => x.about === 'right' && x.kind < 0 && x.b < 0 && x.cell === at && x.due > s.t)) continue;
        let most = 5;
        for (const key in s.worked) { if (!key.endsWith(`:${at}`)) continue; for (const sid in s.worked[key]!) { const d = s.worked[key]![sid]!; if (Number(sid) !== b.id && d > most && !holds(s.bodies[Number(sid)]!)) { most = d; against = Number(sid); } } }
      } else if (sg.startsWith('way:')) {
        const way = sg.slice(4);
        for (const x of s.bonds) {
          if (x.way !== way || (x.about !== 'act' && x.about !== 'bond') || (x.about === 'act' && x.q <= 0.05)) continue;
          for (const id of [x.a, x.b]) { const X = s.bodies[id]; if (X && X.alive && id !== b.id && !holds(X) && dist(s.side, X.home, b.home) <= P.reach) { against = id; break; } }
          if (against >= 0) break;
        }
      } else if (sg.startsWith('house:') || sg === 'new') {
        for (const X of around(idx, s.side, b.home, 1)) {
          if (X === b || holds(X) || barredNear(X.id, b.home)) continue;
          if (sg === 'new' ? X.since > -1e5 && s.t - X.since < 52 : sg === `house:${X.id}`) { against = X.id; break; }
        }
      } else continue;
      if (against < 0) continue;
      const before = fresh.length;
      add(b.id, against, undefined, 'fears', -1, -1, constraintWords(sg), `f${sg}:${against}`);
      if (fresh.length > before) { const q = fresh[fresh.length - 1]!; q.sign = sg; q.cell = at; raised++; break; }
    }
  }
  // The king's bailiff suspects those who pay least for the ground they hold. Some hide what they owe; some had a bad year.
  for (const B of s.bodies) {
    if (!B.alive || B.rank !== 'bailiff') continue;
    const dues = s.bonds.filter(x => x.about === 'yield' && x.b === B.id && x.way === 'crown' && s.bodies[x.a]?.alive && !s.bodies[x.a]!.rank);
    const held = (id: number): number => s.bonds.filter(x => (x.about === 'land' && x.a === id && x.strength >= 0.5) || (x.about === 'bond' && x.a === id && x.way === 'manor')).length;
    const rate = dues.map(x => ({ x, h: held(x.a), r: s.bodies[x.a]!.paidUp / Math.max(1, held(x.a)) })).filter(v => v.h >= 1);
    if (rate.length < 4) continue;
    const median = rate.map(v => v.r).sort((a, b) => a - b)[rate.length >> 1]!;
    const low = rate.filter(v => median > 0.5 && v.r < 0.5 * median).sort((a, b) => a.r - b.r)[0];
    if (low) add(B.id, low.x.a, low.x, 'suspects', -1, low.x.rec, '', `s${low.x.a}`);
  }
  // A fellow left in want by one who holds the duty to aid it; a tenant worked beyond custom by its lord.
  for (const X of s.bodies) {
    if (!X.alive || X.shirkedTo < 0 || s.t - X.shirkedAt > 8 || !s.bodies[X.shirkedTo]?.alive) continue;
    add(X.shirkedTo, X.id, undefined, 'unaided', lack.get(X.shirkedTo) ?? BY_HARM[0]!, -1, 'aid its fellows owe it', `u${X.shirkedTo}:${X.id}`);
  }
  for (const T of s.bodies) {
    if (!T.alive || T.overworked < 6) continue;
    const m = s.bonds.find(x => x.about === 'bond' && x.a === T.id && x.way === 'manor');
    if (m && s.bodies[m.b]?.alive) add(T.id, m.b, m, 'exceeds', lack.get(T.id) ?? -1, m.rec, '', `e${T.id}`);
  }
  // The sacred. Ground left to a holy body that the blood still claims; one kept from what it is owed by sanctuary;
  // a shrine a holy body of strict creed will not have; a stained holy office the pure will not accept; a creed apart.
  for (const bd of s.bonds) {
    if (bd.about !== 'land' || bd.basis !== 'vow' || s.t - bd.since > 52 || !s.bodies[bd.a]?.alive) continue;
    const K = s.bodies.find(x => x.alive && !x.parts.length && x.id !== bd.a && grown(s, x).some(m => m.lore[`claim:${bd.cell}`] !== undefined));
    if (K) add(K.id, bd.a, bd, 'mortmain', lack.get(K.id) ?? -1, bd.rec, '', `mm${bd.id}`);
  }
  for (const T of s.bodies) {
    const sh = T.sheltered;
    if (!T.alive || !sh || s.t - sh.t > 8 || s.cells[T.home]!.sanctity < P.sanctuary || !s.bodies[sh.from]?.alive) continue;
    const bd = s.bonds.find(x => x.id === sh.bond);
    if (!bd || bd.q <= 0.05) continue;
    add(sh.from, T.id, bd, 'sanctuary', lack.get(sh.from) ?? -1, bd.rec, '', `sa${T.id}`);
  }
  const holyBodies = s.bodies.filter(x => x.alive && x.authority === 'symbolic');
  for (let i = 0; i < s.cells.length; i++) {
    const sh = s.cells[i]!.shrine;
    if (!sh || sh.sanctioned || !s.bodies[sh.of]?.alive) continue;
    const S = holyBodies.find(x => x.creed.folk < 0.4 && dist(s.side, x.home, i) <= P.far);
    if (!S) continue;
    const before = fresh.length;
    add(S.id, sh.of, undefined, 'shrine', -1, -1, 'a shrine it never sanctioned', `sh${i}`);
    if (fresh.length > before) fresh[fresh.length - 1]!.cell = i;
  }
  for (const S of holyBodies) {
    if ((head(s, S)?.stained ?? 0) < P.stainMark) continue;
    const purists = around(idx, s.side, S.home, P.dealReach).filter(x => x.authority !== 'symbolic' && x.creed.purity > 0.6 && x.members.length);
    if (purists.length >= 2) add(purists[0]!.id, S.id, undefined, 'unclean', -1, -1, 'a stained holy office', `uc${S.id}`);
  }
  for (const H of s.bodies) {
    if (!H.alive || H.parts.length || H.authority === 'symbolic' || !H.members.length) continue;
    const hp = head(s, H);
    if (!hp || hp.devotion < 0.7 || hp.ban > 0 || s.t - H.tolerated <= 52) continue;
    const S = holyBodies.find(x => dist(s.side, x.home, H.home) <= P.far && Math.max(...(['rigour', 'folk', 'purity'] as const).map(k => Math.abs(H.creed[k] - x.creed[k]))) >= P.schism);
    if (S) add(S.id, H.id, undefined, 'heresy', -1, -1, 'a creed apart', `he${H.id}`);
  }
  // Inside a house: an heir's claim by blood to ground another holds; one of the house appealing against its head's
  // breach of custom. From outside: harm from ground cleared upstream.
  for (const X of s.bodies) {
    if (!X.alive || X.parts.length || !X.members.length) continue;
    const g = grown(s, X), spk = X.speaker >= 0 && s.people[X.speaker]?.alive ? X.speaker : (head(s, X)?.id ?? -1);
    let heirDone = false;
    for (const m of g) {
      if (heirDone) break;
      for (const sg in m.lore) {
        if (!sg.startsWith('claim:')) continue;
        // An ancestral claim: made by one born after the ground was lost, or by one who saw it lost, years on. Not the week after.
        const lostAt = m.lore[sg]!;
        if (!(m.born > lostAt || s.t - lostAt >= P.heirYears * 52)) continue;
        const cell = Number(sg.slice(6)), held = s.bonds.find(x => x.about === 'land' && x.cell === cell && x.a !== X.id && x.strength >= 0.5 && s.bodies[x.a]?.alive);
        if (!held) continue;
        const before = fresh.length;
        add(X.id, held.a, held, 'heir', lack.get(X.id) ?? -1, held.rec, '', `h${m.id}:${cell}`);
        if (fresh.length > before) { fresh[fresh.length - 1]!.person = m.id; heirDone = true; break; }
      }
    }
    if (X.breach && s.t - X.breach.t <= 8) {
      const sg = X.breach.sign, m = g.find(x => x.id !== spk && (x.lore[sg] ?? 0) > P.heed + 0.2);
      if (m) { const before = fresh.length; add(X.id, -1, undefined, 'appeal', -1, -1, 'its head’s breach of custom', `ap${X.id}:${sg}`); if (fresh.length > before) { const q = fresh[fresh.length - 1]!; q.person = m.id; q.sign = sg; } }
    }
    if (X.harmedBy && s.t - X.harmedBy.t <= 8 && s.bodies[X.harmedBy.by]?.alive) {
      const before = fresh.length;
      add(X.id, X.harmedBy.by, undefined, 'harmed', lack.get(X.id) ?? -1, -1, 'harm from work upstream', `hm${X.id}:${X.harmedBy.by}`);
      if (fresh.length > before) fresh[fresh.length - 1]!.cell = X.harmedBy.cell;
    }
  }
  // A tenant that has told its lord it will leave comes to the court before it goes.
  for (const b of s.bodies) {
    if (!b.alive || b.threat < 0 || s.t - b.threat >= P.wait) continue;
    const m = s.bonds.find(x => x.about === 'bond' && x.a === b.id && x.way === 'manor');
    if (!m || !s.bodies[m.b]?.alive) continue;
    add(b.id, m.b, m, 'exit', lack.get(b.id) ?? -1, m.rec, '', `x${b.id}`);
  }
  // A house past want and reaching for more contends for the lead of the body it belongs to.
  for (const cb of s.bodies) {
    if (!cb.alive || !cb.parts.length || cb.head < 0 || !s.bodies[cb.head]?.alive) continue;
    const H = s.bodies[cb.head]!, dh = drive(s, H);
    for (const id of leaves(s, cb)) {
      if (id === cb.head) continue;
      const M = s.bodies[id]!, dm = drive(s, M);
      if (dm < dh + 0.25 || might(s, kin, M, H.id) < 0.8 * might(s, kin, H, M.id)) continue;
      const before = fresh.length;
      add(id, H.id, undefined, 'asks', -1, -1, 'the lead of its body', `p${id}:${cb.id}`);
      if (fresh.length > before) { fresh[fresh.length - 1]!.body = cb.id; break; }
    }
  }
  // A dire want with nothing the court can cut.
  for (const [id, n] of lack) {
    const b = s.bodies[id]!;
    if (fresh.some(f => f.by === id)) continue;
    // A house lately come, in want, whose neighbours hold that newcomers bring harm and will not deal with it.
    let shut = 0;
    if (b.since > -1e5 && s.t - b.since < 52) for (const x of around(idx, s.side, b.home, P.dealReach)) if (x !== b && (x.lore.new ?? 0) > P.heed) shut++;
    if (shut >= 2) add(id, -1, undefined, 'bare', n, b.why[n]!, 'and shunned as a newcomer');
    else if (cover(b.store, askAhead(s, b))[n]! < P.dire) add(id, -1, undefined, 'bare', n, b.why[n]!, b.why[n]! >= 0 ? 'after a loss' : 'with nothing behind it');
  }

  // Settle below what a rule covers; what two bodies' rules answer differently goes up.
  for (const p of fresh) {
    if (p.burdens.length) {
      // Whatever weighs on it that a rule already eases is eased below, and it need not come up.
      let eased = false;
      p.burdens.forEach((id, i) => {
        const r = c.rules.find(x => x.shape === p.shapes[i] && x.cut === 'stay' && (x.scope === -1 || x.scope === scopeOf(s, p.by)));
        if (!r || !carry(s, c, p, `ease:${id}`)) return;
        r.uses++; eased = true;
        rec(s, 'rule', { a: p.by, kind2: 1, q2: r.scope, way: p.shapes[i]! });
      });
      if (eased) teach(s, idx, p.by, 'owes', 0.7, P.pleaOwn); else if (!byLaw(s, c, p)) c.docket.push(p);
      continue;
    }
    const r = ruleFor(s, c, p);
    if (r === 'clash') { p.reason = 'clash'; p.shape = `two rules on: ${p.shape}`; c.docket.push(p); } else if (r) below(s, c, p, r); else if (!byLaw(s, c, p)) c.docket.push(p);
  }
  // In the Cockpit nobody is seated: what no law of the Crown settles goes to whoever holds sway locally, or the parties are left to it.
  if (c.policy.mode === 'cockpit') {
    for (const p of c.docket) {
      if (!s.bodies[p.by]!.alive || p.reason === 'challenge') continue;
      const lower = cuts(s, p).find(x => x === 'remit' || x.startsWith('remit:'));
      if (lower && carry(s, c, p, lower)) rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: -6, way: p.shape });
      else grieve(c, p.by, P.harmUnheard);
    }
    c.docket = [];
    note(s, c, 'store', storeOf(c) - stA, 'settlements below');
    return [];
  }
  // Those who waited too long, or whose matter is gone, leave; the rest are ranked.
  c.docket = c.docket.filter(p => {
    if (!s.bodies[p.by]!.alive) return false;
    if (p.burdens.length) { if (!p.burdens.some(id => byId.has(id))) return false; } else if (p.reason !== 'challenge' && p.bond >= 0) { const bd = byId.get(p.bond); if (!bd || (bd.about === 'act' && bd.q <= 0.05) || (bd.about === 'land' && bd.strength < 0.05)) return false; }
    // Left unheard a whole season: that is held against the court by the week.
    if (p.waited > P.wait) {
      // Outside the Regency the realm does not wait on the court: what has a local lord or body is settled by them.
      const lower = live(c) && p.reason === 'none' ? cuts(s, p).find(x => x === 'remit' || x.startsWith('remit:')) : undefined;
      if (lower && carry(s, c, p, lower)) { rec(s, 'rule', { a: p.by, b: p.against, kind2: 1, q2: -6, way: p.shape }); return false; }
      grieve(c, p.by, P.harmUnheard * p.waited); gauge(s, c, 'legitimacy', live(c) ? -0.005 : -0.02, 'matters left unheard'); teach(s, idx, p.by, p.side, 0, P.pleaOwn / 2); return false;
    }
    return true;
  });
  for (const p of c.docket) {
    const b = s.bodies[p.by]!, cov = cover(b.store, askAhead(s, b));
    let press = 0;
    for (let n = 0; n < NN; n++) press = Math.max(press, NEEDS[n]!.harm * Math.max(0, 1 - cov[n]! / P.short));
    p.press = press;
    p.urgency = press * 3 + Math.log2(1 + p.speaksFor) + p.waited / 4 + (p.reason !== 'none' ? 1 : 0);
  }
  c.docket.sort((x, y) => y.urgency - x.urgency || x.id - y.id);
  const seated: Petition[] = [], shapes = new Set<string>();
  for (const p of c.docket) { if (seated.length >= P.seats) break; if (shapes.has(p.shape)) continue; shapes.add(p.shape); seated.push(p); }
  // Seats left over go to the most urgent of the rest, so the bench is never half empty while a crowd waits.
  for (const p of c.docket) { if (seated.length >= P.seats) break; if (!seated.includes(p)) seated.push(p); }
  note(s, c, 'store', storeOf(c) - stA, 'settlements below');
  return seated;
}

/** The hearings: up to three rulings, or a fourth at a cost in standing. Then the week's reckoning. */
export function hear(s: State, rulings: Ruling[]): void {
  const c = s.court;
  if (!c) return;
  const cap = P.hearings;
  const heard = rulings.slice(0, cap + 1), stH = storeOf(c);
  if (heard.length > cap) gauge(s, c, 'legitimacy', -0.5, 'a fourth hearing');
  for (const r of heard) {
    const p = c.docket.find(x => x.id === r.petition);
    if (!p || !cuts(s, p).includes(r.cut)) continue;
    const done = carry(s, c, p, r.cut);
    if (r.cut === 'inquire' && done && p.side !== 'suspects') continue;
    const favour = done ? FAVOUR[p.side]?.[r.cut.split(':')[0]!] ?? 0.5 : 0;
    if (p.reason === 'none') teach(s, hearthIndex(s), p.by, p.side, favour, P.pleaOwn);
    // One the court found for thinks the better of it.
    // A court that rules one way on a kind of matter and the other way within the year is arbitrary. The one who lost
    // feels the law changed under them; and nobody trusts a ruling in their favour to stick.
    const prior = c.precedent[p.shape];
    if (done && p.reason === 'none' && prior && s.t - prior.t <= 52 && Math.abs(prior.fav - favour) >= 0.5) {
      c.caprice += 1; gauge(s, c, 'legitimacy', -0.1, 'rulings that contradict');
      grieve(c, favour >= 0.5 ? p.against : p.by, P.harmReversed);
      rec(s, 'caprice', { a: p.by, b: p.against, way: p.shape });
    }
    if (done && p.reason === 'none') c.precedent[p.shape] = { fav: favour, t: s.t };
    if (favour >= 0.7) c.grief[p.by] = Math.max(0, (c.grief[p.by] ?? 0) - P.harmPaid / (1 + 0.25 * c.caprice));
    c.docket = c.docket.filter(x => x !== p);
    if (r.width === 'case' || p.reason === 'challenge') continue;
    // A rule: for the body the petitioner belongs to, or for everyone. It replaces any rule it contradicts there.
    const easing = r.cut.startsWith('ease:'), ruleCut = easing ? 'stay' : r.cut.startsWith('remit') ? 'remit' : r.cut;
    const scope = r.width === 'realm' ? -1 : ruleCut === 'remit' ? (r.cut.startsWith('remit:') ? Number(r.cut.slice(6)) : localPower(s, p)) : scopeOf(s, p.by);
    if (scope === -2 || (ruleCut === 'remit' && scope < 0 && r.width !== 'realm')) continue;
    if (!easing && p.burdens.length) continue;
    const shape = easing ? p.shapes[p.burdens.indexOf(Number(r.cut.slice(5)))] ?? p.shape : p.shape.replace(/^two rules on: /, '');
    const old = c.rules.findIndex(x => x.shape === shape && x.scope === scope);
    // What is on the roll cannot be undone; ruling against it is caprice of the worst kind.
    if (old >= 0 && c.rules[old]!.roll) { c.caprice += 3; continue; }
    if (old >= 0) c.rules.splice(old, 1);
    const rule: Rule = { id: c.next++, scope, shape, cut: ruleCut, since: s.t, uses: 0 };
    c.rules.push(rule);
    rec(s, 'rule', { a: p.by, kind2: 0, q2: scope, way: `${ruleCut} ${shape}` });
    // Everyone already waiting with a like matter is answered by it at once. Those answered against had built on the old understanding.
    for (const q of c.docket.slice()) {
      const bi = q.shapes.indexOf(shape);
      if (q.burdens.length) {
        if (!easing || bi < 0 || !(scope === -1 || scope === scopeOf(s, q.by))) continue;
        c.docket = c.docket.filter(x => x !== q);
        if (carry(s, c, q, `ease:${q.burdens[bi]}`)) { rule.uses++; rec(s, 'rule', { a: q.by, kind2: 1, q2: scope, way: shape }); teach(s, hearthIndex(s), q.by, 'owes', 0.7, P.pleaOwn); }
        continue;
      }
      if (q.shape !== shape || q.reason !== 'none' || ruleFor(s, c, q) !== rule) continue;
      c.docket = c.docket.filter(x => x !== q);
      below(s, c, q, rule);
      if (scope === -1) grieve(c, r.cut === 'enforce' ? (q.side === 'owed' ? q.against : q.by) : q.side === 'owed' ? q.by : q.against, P.harmReversed);
    }
  }
  note(s, c, 'store', storeOf(c) - stH, 'your rulings');
  // What the Crown has laid by spoils like anything else. The regent's word falls due: kept out of the store, or broken before everyone.
  let st0 = storeOf(c);
  for (let k = 0; k < NK; k++) c.store[k] = c.store[k]! * (1 - Kn[k]!.keep);
  note(s, c, 'store', storeOf(c) - st0, 'spoilage');
  c.caprice *= 0.99;
  const idx = hearthIndex(s);
  c.words = c.words.filter(w => {
    if (w.due > s.t) return true;
    const to = s.bodies[w.to]!;
    if (!to.alive) return false;
    if (relieve(s, c, to, w.need) > 0) { c.wordsKept++; rec(s, 'keep', { b: w.to, need: w.need, q2: 9 }); teach(s, idx, w.to, 'bare', 1, P.pleaOwn); return false; }
    c.wordsBroken++; gauge(s, c, 'legitimacy', -0.5, 'your word broken');
    rec(s, 'break', { b: w.to, need: w.need, q2: 9 });
    grieve(c, w.to, P.harmWord);
    for (const b of around(idx, s.side, to.home, P.reach)) if (b.id !== w.to) grieve(c, b.id, P.harmWord / 5);
    teach(s, idx, w.to, 'bare', 0, P.pleaOwn);
    return false;
  });
  // The king's bailiffs send up what they took in for the Crown. When the store runs low they take for the king
  // from those with most, and pay nothing: a taking like any other, and the court's own.
  st0 = storeOf(c);
  const live2 = c.policy.mode !== 'regency', round = live2 ? ({ light: 26, regular: 13, strict: 6 } as const)[c.policy.dials.bailiff] : 1;
  const low = c.store.reduce((x, y) => x + y, 0) < 0.5 * c.store0 && s.t % (live2 ? round : 13) === 0 && !(live2 && c.policy.dials.bailiff === 'light');
  for (const b of s.bodies) {
    if (!b.alive || b.rank !== 'bailiff' || c.policy.weak || s.t % round !== 0) continue;
    for (let k = 0; k < NK; k++) { const up = Math.min(b.owedUp[k] ?? 0, b.store[k]!); if (up > 0) { c.collected += up; b.store[k] = b.store[k]! - up; c.store[k] = c.store[k]! + up; } }
    b.owedUp = [];
    if (!low) continue;
    const payers = s.bonds.filter(x => x.about === 'yield' && x.b === b.id && x.way === 'crown').map(x => s.bodies[x.a]!).filter(x => x.alive && !x.rank);
    let kind = -1;
    for (let k = 0; k < NK; k++) if (!Kn[k]!.fixed && Kn[k]!.serves.some((v, n) => v > 0 && NEEDS[n]!.harm >= 0.5) && (kind < 0 || c.store[k]! < c.store[kind]!)) kind = k;
    if (kind < 0) continue;
    for (const v of payers.sort((x, y) => y.store[kind]! - x.store[kind]! || x.id - y.id).slice(0, 3)) {
      const q = v.store[kind]! * 0.15;
      if (q < 1) continue;
      v.store[kind] = v.store[kind]! - q; c.store[kind] = c.store[kind]! + q;
      const e = rec(s, 'take', { a: b.id, b: v.id, kind, q, kind2: -3 });
      s.wrongs.push({ by: b.id, to: v.id, kind, q, rec: e.id, doer: b.id });
      grieve(c, v.id, P.harmPaid);
    }
  }
  note(s, c, 'store', storeOf(c) - st0, 'the bailiffs');
  // Those still waiting in real want hold it against the court. (Urgency is no test of that: it also counts whom they speak for.)
  for (const p of c.docket) { p.waited++; if ((p.press ?? 0) > 0.5) grieve(c, p.by, P.harmUnheard); }
  // Enough houses with enough grievance withdraw their confidence.
  // Enough aggrieved houses bound to one another, as kin, as fellows of one body, or as neighbours, make a faction.
  // Scattered grudges do not: it is the largest such group that counts.
  let hearths = 0;
  const aggrieved: Body[] = [];
  for (const b of s.bodies) if (b.alive && !b.parts.length && b.members.length) { hearths++; if ((c.grief[b.id] ?? 0) >= P.aggrieved && !(c.policy.mode === 'cockpit' && (guarded(s, b) || nearSeat(s, c, b.home)))) aggrieved.push(b); }
  const kinMap = kinOf(s), seenF = new Set<number>();
  let sore = 0, factionAt = -1;
  for (const start of aggrieved) {
    if (seenF.has(start.id)) continue;
    let size = 0;
    const stack = [start];
    seenF.add(start.id);
    while (stack.length) {
      const x = stack.pop()!;
      size++;
      for (const y of aggrieved) {
        if (seenF.has(y.id)) continue;
        if (kinMap.get(x.id)?.has(y.id) || dist(s.side, x.home, y.home) <= 1 || (x.of >= 0 && top(s, x).id === top(s, y).id)) { seenF.add(y.id); stack.push(y); }
      }
    }
    if (size > sore) factionAt = start.home;
    sore = Math.max(sore, size);
  }
  for (const k in c.grief) { const v = c.grief[k]! * P.griefFade; if (v < 0.5 || !s.bodies[Number(k)]!.alive) delete c.grief[k]; else c.grief[k] = v; }
  // Confidence once withdrawn is not withdrawn again for a season: people wait to see what the court does next.
  c.quiet++;
  if (hearths > 0 && sore >= Math.max(P.factionMin, P.faction * hearths) && c.quiet > 8 && c.reach > 0) {
    // A faction that withdraws its confidence no longer does the Crown's bidding: its reach shrinks.
    gauge(s, c, 'reach', -1, `a faction${factionAt >= 0 ? ' at #' + factionAt : ''}`); c.quiet = 0;
    for (const k in c.grief) c.grief[k] = c.grief[k]! * 0.5;
    rec(s, 'withdraw', { q: sore, q2: hearths });
  } else if (c.quiet % 13 === 0) {
    // A quiet season restores legitimacy if the court has kept to its word; reach comes back where the bailiffs collect.
    if (c.caprice < 1) gauge(s, c, 'legitimacy', 0.25, 'a quiet season');
    if (c.collected > 0 || c.policy.weak) gauge(s, c, 'reach', 0.25, 'a quiet season');
    c.collected = 0;
  }
  policyWeek(s, c);
  c.legitimacy = Math.max(0, Math.min(5, c.legitimacy)); c.reach = Math.max(0, Math.min(5, c.reach));
  c.standing = Math.min(c.legitimacy, c.reach);
}

/** Whether clearing (taking what holds the soil) is forbidden at a place, for a house living at home: by a forest the
 *  Crown has reserved there, or by its forest law — stinted, a place cleared past the stint; the king's forest, anywhere
 *  but a house's own ground. */
export function clearingBarred(s: State, cell: number, home: number): boolean {
  const c = s.cells[cell]!;
  if (c.works?.reserve) return true;
  const pol = s.court?.policy;
  if (!pol || pol.mode !== 'cockpit' || pol.lawSetAt.forest < 0 || pol.weak) return false;
  if (pol.laws.forest === 'kings') return cell !== home;
  if (pol.laws.forest === 'stinted') return c.cleared > P.stint;
  return false;
}
/** Whether tenants are bound to the ground by the Crown's law. */
export function boundByLaw(s: State): boolean {
  const pol = s.court?.policy;
  return !!pol && pol.mode === 'cockpit' && !pol.weak && pol.lawSetAt.movement >= 0 && pol.laws.movement === 'bound';
}
/** Whether tenants may go freely by the Crown's law, without a season's notice. */
export function freeByLaw(s: State): boolean {
  const pol = s.court?.policy;
  return !!pol && pol.mode === 'cockpit' && !pol.weak && pol.lawSetAt.movement >= 0 && pol.laws.movement === 'free';
}

