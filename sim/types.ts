// The state: flat tables of what exists. Stage 1 has land, matter (held in bodies' stores), people,
// bonds and bodies. Beliefs and practices arrive with minds.

/** What the Crown has built on a place, out of timber. A granary keeps what it holds of each kind. */
export interface Works { granary?: number[]; dike?: boolean; reserve?: boolean; post?: boolean; chapel?: boolean }
export type WorkKey = 'granary' | 'dike' | 'reserve' | 'post' | 'chapel';
export interface Cell {
  /** The Crown's works here (optional: realms kept from before works were built have none). */
  works?: Works;
  high: number;
  /** Cover taken off it by work lately, and by whom most: what makes the water run faster below. */
  cleared: number; clearedBy: number;
  /** The sacred: holiness (at P.sanctuary or more, force may not be used here); weeks of interdict left; a shrine, if one has
   *  risen here, whose it is, since when, whether sanctioned, and who shares its offerings; and how prone the place is to
   *  being thought holy, fixed at the founding. */
  sanctity: number; interdict: number; shrine: { of: number; since: number; sanctioned: boolean; to: number } | null; awe: number;
  soil: number; soil0: number;
  wet: number;
  water: number;
  /** The water that ran through this week, what the channel carries before it floods, and how far over it ran. */
  flow: number; bank: number; flood: number;
  /** How well this cell can bear each living or lying thing. */
  pot: number[];
  stock: number[];
}

export interface Person {
  id: number;
  born: number;
  sex: number;
  body: number;
  mother: number; father: number; spouse: number;
  alive: boolean;
  wear: number;
  /** Thresholds, fixed at birth. */
  sound: number; scruple: number; temper: number; spacing: number; credulous: number;
  /** How much they want what others cannot also have: ground beyond their need, a sole right, the lead of their body. */
  ambition: number;
  /** Drive toward the sacred, apart from any want; stain upon the person; weeks of being shunned left. */
  devotion: number; stained: number; ban: number;
  /** What the one who struck the last blow meant by it: to defend, from need, or for gain. */
  blowIntent: string;
  /** How the house stood when this person was born. */
  omen: number;
  bore: number;
  /** The record of the last blow taken, and when. */
  blow: number; blowAt: number;
  /** The body whose people struck that blow. */
  blowBy: number;
  /** How far each need was met last week. */
  fed: number[];
  /** A mind: what this person believes brings harm, the ways of dealing they know, and how good they are at each kind of work. */
  lore: Record<string, number>;
  ways: Record<string, { w: number; p: number }>;
  skill: number[];
  /** What they expect of the court, for each way of standing before it: how likely it is to find for the one who asks. */
  plea: number[];
  /** How much they believe a unit put onto the land returns, for each thing that can be sown. */
  hope: number[];
}

export interface Work { r: number; cell: number; days: number }

export interface Body {
  id: number;
  home: number;
  store: number[];
  members: number[];
  /** A body may be made of bodies, and may belong to one. */
  parts: number[];
  of: number;
  /** For a body of bodies: the hearth that leads it, and judges what is left to the body. */
  head: number;
  /** When it told its lord it would leave, or -1. */
  threat: number;
  /** What it has kept back from the Crown's share, kind by kind, and what it has paid of it, both fading. */
  hid: number[]; paidUp: number;
  /** The fellow it last left in want against a duty it holds, and when; and labour taken from it beyond custom, fading. */
  shirkedTo: number; shirkedAt: number; overworked: number;
  /** The member who speaks for it, if not its eldest; a constraint its speaker was seen to break, and when; harm from work upstream. */
  /** Whether its standing comes from declaring what is holy rather than holding ground or force; and its creed:
   *  rigour (norms over survival), folk (tolerance of shrines and signs not sanctioned), purity (rites of a stained man are void). */
  authority: 'none' | 'symbolic'; creed: { rigour: number; folk: number; purity: number };
  /** Force against it turned back by sanctuary: by whom, over which bond, when. Lately tolerated in a creed apart. */
  sheltered: { from: number; bond: number; t: number } | null; tolerated: number;
  speaker: number; breach: { sign: string; t: number } | null; harmedBy: { by: number; cell: number; loss: number; t: number } | null;
  alive: boolean;
  since: number;
  /** What its members will do next week, and where it means to go. */
  plan: Work[];
  spent: number;
  goto: number;
  /** For each need, the record that last cut its cover. */
  why: number[];
  /** The ways of dealing it knows: for each, how well it has served and the share it is used to conceding. */
  ways: Record<string, { w: number; p: number }>;
  /** Weeks it has wanted something and found no way to get it. */
  stuck: number;
  /** It has more to gather than hands to gather it: work owed to it is called in. */
  pressed: boolean;
  /** What it believes brings harm, and how strongly; and what it has lately met with. */
  lore: Record<string, number>;
  recent: [string, number][];
  /** How good its grown members are, together, at each kind of work. */
  skill: number[];
  /** A plan held over weeks: to make enough of a thing another wants, so as to get from them what it lacks. */
  /** What its speaker believes the land returns; and what it has put on and brought in since midwinter. */
  hope: number[]; put: number[]; got: number[];
  /** What its speaker expects of the court; and days its people are away at court this week. */
  plea: number[]; away: number;
  /** A label for what it was at the founding (a lord, a priest, the king's bailiff). No rule reads it. */
  rank: string;
  /** What it has taken in for the Crown and not yet sent up. */
  owedUp: number[];
  aim: { kind: number; q: number; for: number; worth: number; since: number; want: string } | null;
}

export type Basis = 'birth' | 'word' | 'use' | 'grant' | 'wrong' | 'bound' | 'vow';

/** Something that holds between parties about an object: a person, land, an act still owed, or another bond. */
export interface Bond {
  id: number;
  about: 'person' | 'land' | 'act' | 'bond' | 'yield' | 'right';
  /** person: a and b are people. land: a is the body that holds. act: a owes b.
   *  yield: a owes b a share of whatever a gathers from sown ground.
   *  right: a holds the sole right to one kind of work (`kind`, a way of making) on the ground about `cell`; anyone else who
   *         does it there owes a `share` of what they make. With `kind` -1 it is a ban until `due`: with `b` -1 nobody may work `cell`;
   *         with `b` set, that body may not work or deal within reach of `cell`.
   *  bond: a has a right in the bond `on`: its use for a share (a lease), or the bond itself should the debt `secures` be broken (a pledge). */
  a: number; b: number;
  cell: number;
  kind: number; q: number; due: number;
  /** What is owed is days of work, not matter. */
  labour: boolean;
  on: number; share: number; secures: number;
  /** When the right was last used. */
  used: number;
  basis: Basis;
  strength: number;
  since: number;
  broken: boolean;
  /** The record that made or last touched it. */
  rec: number;
  /** The way of dealing it came from. */
  way: string;
  /** Nothing is owed on it until this week: the court has eased it. */
  easedTo: number;
  /** For a debt that came of a taking: the body that truly did it, whoever it was laid to. */
  doer: number;
  /** What can be shown of it: spoken between two alone, witnessed, or on the court's roll. */
  proof: 'spoken' | 'witnessed' | 'roll';
  /** The one said to owe denies it. Whether it was ever made is another matter: `fabricated` is the ledger's truth. */
  denied: boolean; fabricated: boolean;
  /** For a holding of a lord: days a week owed him when he needs hands, by custom; and whether the court has held him to it. */
  boon: number; capped: boolean;
  /** For a wrong: what the doer meant by it. Need, defence and gain are judged differently. */
  intent: string;
}

/** One elementary happening. `k` is always the name of an act or a process, never of a situation. */
export interface Rec {
  id: number; t: number; k: string;
  a: number; b: number;
  cell: number;
  kind: number; q: number;
  kind2: number; q2: number;
  need: number;
  /** The record that led to this one, or -1. */
  cause: number;
  /** For a dealing: what was given for what. */
  way?: string;
}

export interface Wrong { by: number; to: number; kind: number; q: number; rec: number; doer: number; intent?: string }

/** A matter before the court: who brings it, against whom, about which bond or want, and why it climbed this far. */
export interface Petition { /** For a house in want: everything that weighs on it, heaviest first, and the shape of each. */ burdens: number[]; shapes: string[]; id: number; t: number; by: number; against: number; bond: number; need: number; rec: number; shape: string; side: 'owed' | 'owes' | 'outside' | 'bare' | 'asks' | 'fears' | 'exit' | 'suspects' | 'unaided' | 'exceeds' | 'heir' | 'appeal' | 'harmed' | 'mortmain' | 'sanctuary' | 'shrine' | 'unclean' | 'heresy'; work?: number; cell?: number; sign?: string; body?: number; press?: number; person?: number; /** A challenge to a standing law rather than a rule. */ law?: LawKey; reason: 'none' | 'clash' | 'challenge'; speaksFor: number; waited: number; urgency: number }
/** A rule: a bond that binds every member of a body, or the whole realm (scope -1). */
export interface Rule { /** Written on the roll: it cannot be challenged or undone. */ roll?: boolean; id: number; scope: number; shape: string; cut: string; since: number; uses: number }
/** The cockpit: standing laws, regulators and timed ordinances the regent sets, and how the realm is played. */
export type LawKey = 'credit' | 'tenure' | 'inherit' | 'liability' | 'jurisdiction' | 'swords';
export interface Laws { credit: 'strict' | 'ease' | 'forgive'; tenure: 'custom' | 'commute' | 'lord'; inherit: 'blood' | 'shared' | 'possession'; liability: 'individual' | 'kin' | 'body'; jurisdiction: 'crown' | 'ground' | 'person'; swords: 'defer' | 'concordat' | 'supremacy' }
export interface Dials { share: 0 | 0.05 | 0.1 | 0.15; relief: 'off' | 'starving' | 'want'; bailiff: 'light' | 'regular' | 'strict'; patronage: 'none' | 'church' | 'lords' }
export type OrdKey = 'stay' | 'granaries' | 'eyre' | 'penance';
export type LocalOrder = 'relief' | 'circuit' | 'charter' | 'intervene';
export type Mode = 'cockpit' | 'chronicle' | 'regency';
export interface Policy {
  laws: Laws;
  /** When each law was last laid down (-1: never; a law never laid down settles nothing), whether it is on the roll, and what it has settled. */
  lawSetAt: Record<LawKey, number>; inscribed: Record<LawKey, boolean>; lawHits: Record<LawKey, number>;
  dials: Dials;
  /** Weeks each ordinance has left to run. */
  ord: Record<OrdKey, number>;
  mode: Mode;
  /** The Crown has lost its hold: laws go unheeded and bailiffs send nothing up until it recovers. */
  weak: boolean;
}
export interface Court {
  policy: Policy;
  /** What moved the Crown's gauges, week by week, and why: kept for a year, so the regent can see what is doing it. */
  ledger?: { t: number; g: 'legitimacy' | 'reach' | 'store'; d: number; why: string }[];
  /** How the court last ruled on each kind of matter, how far it found for the one who asked, and when; and how often it has gone back on itself lately. */
  precedent: Record<string, { fav: number; t: number }>; caprice: number;
  /** The Crown's two capacities: whether its rulings are accepted (legitimacy) and whether it can enforce them (reach). Standing is the lesser. */
  legitimacy: number; reach: number; collected: number;
  standing: number; docket: Petition[]; rules: Rule[]; grief: Record<number, number>; seen: Record<string, number>; next: number; quiet: number; declined: number; chilled: number;
  /** What the Crown has laid by, kind by kind; and the regent's word, given and not yet made good. */
  store: number[]; words: { to: number; need: number; due: number }[]; wordsKept: number; wordsBroken: number; store0: number }
export interface Use { body: number; cell: number; days: number }

export interface State {
  seed: number;
  t: number;
  side: number;
  cells: Cell[];
  people: Person[];
  bodies: Body[];
  bonds: Bond[];
  /** Regard: `ties[a][b]` is how body a holds body b. */
  ties: Record<number, Record<number, number>>;
  sky: { aT: number[]; aR: number[]; temp: number[]; rain: number[] };
  wrongs: Wrong[];
  /** Days of each kind of work done on each cell (`"work:cell"`) by each body, fading. */
  worked: Record<string, Record<number, number>>;
  /** The court, when there is one. */
  court?: Court;
  uses: Use[];
  /** This week's records only. */
  log: Rec[];
  nrec: number;
  nbond: number;
}

export const weekOf = (t: number): number => ((t % 52) + 52) % 52;
export const ageOf = (s: State, born: number): number => (s.t - born) / 52;
