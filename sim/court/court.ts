// The court. A matter is a bond that stands between someone and what they need: one they are owed on
// and cannot get, one they owe on and cannot bear, or one another holds over something they lack. It
// reaches the regent only when no rule covers its shape, when two bodies' rules answer it differently,
// or when a rule is itself challenged. The court can do five things to any bond: enforce it, part it,
// strike it, stay it, or turn it over to the one who asks. A ruling is made for this case, for one body,
// or for the realm; once there is a rule, like cases are settled below and the regent never sees them.
// Nothing here names a kind of case. A matter's shape is read off the bond, the need and the parties.

import { BY_HARM, Kn, NEEDS, NK, NN, P, Rc, St, TOIL } from '../tables.ts';
import { askAhead, cover, drive } from '../value.ts';
import { around, bond, dist, fellows, grown, head, hearthIndex, kinOf, leaves, might, near, rec, top, warm } from '../util.ts';
import type { Body, Bond, Court, Petition, Rule, State } from '../types.ts';

export type Width = 'case' | 'body' | 'realm';
export interface Ruling { petition: number; cut: string; width: Width }

export function openCourt(s: State): Court {
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
  return (s.court = { precedent: {}, caprice: 0, standing: 5, docket: [], rules: [], grief: {}, seen: {}, next: 0, quiet: 0, declined: 0, chilled: 0, store, words: [], wordsKept: 0, wordsBroken: 0, store0: store.reduce((x, y) => x + y, 0) });
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
const FAVOUR: Record<string, Record<string, number>> = {
  owed: { enforce: 1, redeem: 1, answer: 0.9, expel: 0.7, bar: 0.6, surety: 0.6, remit: 0.5, part: 0.5, stay: 0.2, strike: 0 },
  owes: { strike: 1, redeem: 1, give: 1, rival: 0.9, stay: 0.7, ease: 0.7, surety: 0.6, part: 0.5, remit: 0.5, enforce: 0, dismiss: 0 },
  outside: { turn: 1, strike: 0.9, rival: 0.9, part: 0.6, remit: 0.5, enforce: 0 },
  asks: { charter: 1, install: 1, sell: 0.7, remit: 0.5, refuse: 0, confirm: 0 },
  fears: { forbid: 1, remit: 0.5, dismiss: 0.1, override: 0 },
  exit: { free: 1, release: 0.8, ease: 0.7, tie: 0 },
  suspects: { assess: 1, inquire: 0.7, dismiss: 0 },
  unaided: { compel: 1, remit: 0.5, dismiss: 0, dispense: 0 },
  exceeds: { custom: 1, commute: 0.7, remit: 0.5, uphold: 0 },
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
export type Plane = 'material' | 'positional' | 'relational' | 'normative' | 'epistemic';

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
  return [...new Set(out)].filter(id => id !== p.by && id !== p.against || s.bodies[id]!.rank === 'lord').slice(0, 2);
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
  if (p.side === 'fears') return ['forbid', 'override', ...remit, 'dismiss'];
  // A tenant who says it will leave: give it its ground outright, let it go, tie it to the land, or lift the lord's share a year.
  if (p.side === 'exit') return ['free', 'release', 'tie', `ease:${p.bond}`];
  // The bailiff suspects a house of keeping back the Crown's share: find out, assess it on his word, or send him away.
  if (p.side === 'suspects') return ['inquire', 'assess', 'dismiss'];
  // A fellow left in want against a duty: compel the aid, dispense the duty, leave it to the body, or neither.
  if (p.side === 'unaided') return ['compel', 'dispense', ...remit, 'dismiss'];
  // A lord taking more labour than custom: hold him to custom, back him, or turn the labour into a share of the yield.
  if (p.side === 'exceeds') return ['custom', 'uphold', 'commute', ...remit];
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
  const third = bd.about === 'act' && bd.basis === 'wrong' ? 'bar' : shared ? 'expel' : inBody ? 'answer' : bd.about === 'act' && suretyFor(s, bd.a) >= 0 ? 'surety' : 'stay';
  const c = ['enforce', 'strike', third, ...remit];
  // Whoever is said to have done a wrong may or may not have. An inquest can be held on any of them, once.
  if (bd.about === 'act' && ((bd.basis === 'wrong' && bd.doer >= 0) || bd.denied)) c.push('inquire');
  return c;
}

/** Carry out a cut on whatever the matter is about. Returns false if there was nothing left to cut. */
function carry(s: State, c: Court, p: Petition, cut: string): boolean {
  const by = s.bodies[p.by]!;
  // Left to one named power of two: that one decides.
  let via = -1;
  if (cut.startsWith('remit:')) { via = Number(cut.slice(6)); cut = 'remit'; }
  const powerFor = (): number => (via >= 0 ? via : localPower(s, p));
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
      m.due = s.t; m.share = 0; by.threat = s.t - P.wait;
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
    if (bd.fabricated) { bd.q = 0; grieve(c, bd.a, -P.harmPaid); }
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
    if (who < 0 || !s.bodies[who]!.alive || (c.grief[who] ?? 0) - before[i]! < P.harmPaid || (c.grief[who] ?? 0) < P.aggrieved) return;
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
  const byId = new Map<number, Bond>();
  for (const b of s.bonds) byId.set(b.id, b);
  const kin = kinOf(s), idx = hearthIndex(s);
  const fresh: Petition[] = [];
  const shapeFor = (by: number, against: number, bd: Bond | undefined, side: Petition['side'], need: number, extra = ''): string => {
    const A = s.bodies[by]!, B = against >= 0 ? s.bodies[against]! : undefined;
    const near = !B ? 'nobody' : kin.get(by)?.has(against) ? 'kin' : A.of >= 0 && top(s, A).id === top(s, B).id ? 'of one body' : dist(s.side, A.home, B.home) <= P.reach ? 'a neighbour' : 'a stranger';
    return `${side === 'owed' ? 'owed on' : side === 'owes' ? 'bound by' : side === 'outside' ? 'shut out by' : side === 'asks' ? 'asks leave for' : side === 'fears' ? 'will not abide' : side === 'exit' ? 'will leave' : side === 'suspects' ? 'suspects' : side === 'unaided' ? 'was left unaided against' : side === 'exceeds' ? 'is worked beyond custom under' : 'in want'} ${bd ? formOf(byId, bd) : extra}; for ${need >= 0 ? NEEDS[need]!.id : 'nothing pressing'}; against ${near}`;
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
  for (const [id, list] of weights) {
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
      if (eased) teach(s, idx, p.by, 'owes', 0.7, P.pleaOwn); else c.docket.push(p);
      continue;
    }
    const r = ruleFor(s, c, p);
    if (r === 'clash') { p.reason = 'clash'; p.shape = `two rules on: ${p.shape}`; c.docket.push(p); } else if (r) below(s, c, p, r); else c.docket.push(p);
  }
  // Those who waited too long, or whose matter is gone, leave; the rest are ranked.
  c.docket = c.docket.filter(p => {
    if (!s.bodies[p.by]!.alive) return false;
    if (p.burdens.length) { if (!p.burdens.some(id => byId.has(id))) return false; } else if (p.reason !== 'challenge' && p.bond >= 0) { const bd = byId.get(p.bond); if (!bd || (bd.about === 'act' && bd.q <= 0.05) || (bd.about === 'land' && bd.strength < 0.05)) return false; }
    // Left unheard a whole season: that is held against the court by the week.
    if (p.waited > P.wait) { grieve(c, p.by, P.harmUnheard * p.waited); teach(s, idx, p.by, p.side, 0, P.pleaOwn / 2); return false; }
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
  return seated;
}

/** The hearings: up to three rulings, or a fourth at a cost in standing. Then the week's reckoning. */
export function hear(s: State, rulings: Ruling[]): void {
  const c = s.court;
  if (!c) return;
  const heard = rulings.slice(0, P.hearings + 1);
  if (heard.length > P.hearings) c.standing -= 0.5;
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
      c.caprice += 1;
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
  // What the Crown has laid by spoils like anything else. The regent's word falls due: kept out of the store, or broken before everyone.
  for (let k = 0; k < NK; k++) c.store[k] = c.store[k]! * (1 - Kn[k]!.keep);
  c.caprice *= 0.99;
  const idx = hearthIndex(s);
  c.words = c.words.filter(w => {
    if (w.due > s.t) return true;
    const to = s.bodies[w.to]!;
    if (!to.alive) return false;
    if (relieve(s, c, to, w.need) > 0) { c.wordsKept++; rec(s, 'keep', { b: w.to, need: w.need, q2: 9 }); teach(s, idx, w.to, 'bare', 1, P.pleaOwn); return false; }
    c.wordsBroken++;
    rec(s, 'break', { b: w.to, need: w.need, q2: 9 });
    grieve(c, w.to, P.harmWord);
    for (const b of around(idx, s.side, to.home, P.reach)) if (b.id !== w.to) grieve(c, b.id, P.harmWord / 5);
    teach(s, idx, w.to, 'bare', 0, P.pleaOwn);
    return false;
  });
  // The king's bailiffs send up what they took in for the Crown. When the store runs low they take for the king
  // from those with most, and pay nothing: a taking like any other, and the court's own.
  const low = c.store.reduce((x, y) => x + y, 0) < 0.5 * c.store0 && s.t % 13 === 0;
  for (const b of s.bodies) {
    if (!b.alive || b.rank !== 'bailiff') continue;
    for (let k = 0; k < NK; k++) { const up = Math.min(b.owedUp[k] ?? 0, b.store[k]!); if (up > 0) { b.store[k] = b.store[k]! - up; c.store[k] = c.store[k]! + up; } }
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
  // Those still waiting in real want hold it against the court. (Urgency is no test of that: it also counts whom they speak for.)
  for (const p of c.docket) { p.waited++; if ((p.press ?? 0) > 0.5) grieve(c, p.by, P.harmUnheard); }
  // Enough houses with enough grievance withdraw their confidence.
  // Enough aggrieved houses bound to one another, as kin, as fellows of one body, or as neighbours, make a faction.
  // Scattered grudges do not: it is the largest such group that counts.
  let hearths = 0;
  const aggrieved: Body[] = [];
  for (const b of s.bodies) if (b.alive && !b.parts.length && b.members.length) { hearths++; if ((c.grief[b.id] ?? 0) >= P.aggrieved) aggrieved.push(b); }
  const kinMap = kinOf(s), seenF = new Set<number>();
  let sore = 0;
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
    sore = Math.max(sore, size);
  }
  for (const k in c.grief) { const v = c.grief[k]! * P.griefFade; if (v < 0.5 || !s.bodies[Number(k)]!.alive) delete c.grief[k]; else c.grief[k] = v; }
  // Confidence once withdrawn is not withdrawn again for a season: people wait to see what the court does next.
  c.quiet++;
  if (hearths > 0 && sore >= P.faction * hearths && c.quiet > 8) {
    c.standing -= 1; c.quiet = 0;
    for (const k in c.grief) c.grief[k] = c.grief[k]! * 0.5;
    rec(s, 'withdraw', { q: sore, q2: hearths });
  } else if (c.quiet % 13 === 0 && c.standing < 5) c.standing = Math.min(5, c.standing + 0.25);
}
