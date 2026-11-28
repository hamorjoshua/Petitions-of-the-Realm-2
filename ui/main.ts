// The screen. A reader and a player's hands: it shows what the court knows and passes rulings to it.
// It changes the realm only through `hear` and `advance`.

import { found } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { levies, ORD_WEEKS, actOn, freshDials, moveSeat, whyNotSeat, powersOf, underPower, whyNotAct, audience, build, clearingBarred, freshLaws, timberKind, whyNotBuild, cuts, hear, inscribeLaw, interventionAt, issueOrdinance, judgeOf, localOrder, localPower, openCourt, planesOf, setDial, setLaw, suretyFor, type Plane, type Ruling, type Width } from '../sim/court/court.ts';
import { askAhead, cover } from '../sim/value.ts';
import { KINDS, NEEDS, P, RECIPES, St } from '../sim/tables.ts';
import { grown, top } from '../sim/util.ts';
import { Readers, wayWords } from '../readers/readers.ts';
import { placeName } from '../readers/names.ts';
import { edgesWhere, geometry, polyPath } from './map.ts';
import { route } from '../sim/processes/move.ts';
import type { Body, Bond, Dials, LawKey, LocalOrder, Mode, OrdKey, Petition, PowerAct, State, WorkKey } from '../sim/types.ts';

const app = document.getElementById('app')!;
const esc = (x: string): string => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** A shape or rule in plain words: the short codes for ways of dealing are spelled out. */
/** Each kind of work, as people would name the trade. */
const TRADE: Record<string, string> = { netting: 'fishing', felling: 'felling timber', digging: 'digging ore', panning: 'salt-making', forging: 'smithing', wrighting: 'making ploughshares', weaving: 'weaving', salting: 'salting meat', smoking: 'smoking fish', brewing: 'brewing', raising: 'building', culling: 'keeping beasts', reaping: 'reaping', sowing: 'sowing' };
const trade = (work: number | undefined): string => (work === undefined || work < 0 ? 'work' : TRADE[RECIPES[work]!.id] ?? RECIPES[work]!.id);
/** The planes, as a matter's tag names them, and each ruling's plane with the verb the screen gives it. */
const PLANE: Record<Plane, string> = { sacred: 'The holy', material: 'Goods', positional: 'Place and right', relational: 'Kin and fellows', normative: 'Custom', epistemic: 'Truth' };
const VERB: Record<Plane, string> = { sacred: 'Hallow or profane', material: 'Reallocate', positional: 'Grant or bound', relational: 'Bind or sever', normative: 'Uphold or dispense', epistemic: 'Inquire' };
const CUT_PLANE: Record<string, Plane> = {
  enforce: 'material', strike: 'material', stay: 'material', give: 'material', ease: 'material', dismiss: 'material', assess: 'material', redeem: 'material',
  charter: 'positional', sell: 'positional', refuse: 'positional', rival: 'positional', turn: 'positional', install: 'positional', confirm: 'positional', free: 'positional', remit: 'positional', bar: 'positional',
  break: 'sacred', respect: 'sacred', extract: 'sacred', abjure: 'relational', suppress: 'sacred', sanction: 'sacred', depose: 'sacred', penance: 'material', silence: 'sacred', tolerate: 'sacred',
  restore: 'positional', divide: 'relational', speak: 'relational', compensate: 'material', restrain: 'positional', pardon: 'normative', inscribe: 'epistemic',
  forbid: 'normative', override: 'normative', uphold: 'normative', compel: 'normative', dispense: 'normative', custom: 'normative', commute: 'material',
  surety: 'relational', expel: 'relational', answer: 'relational', release: 'relational', tie: 'relational', vouch: 'relational',
  inquire: 'epistemic',
};
/** The plane and verb tags are for whoever is building the realm; they show only with ?debug=1 in the address. */
const DEBUG = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search);
const planeOfCut = (p: Petition, cut: string): Plane => (p.reason === 'challenge' ? 'normative' : CUT_PLANE[cut.split(':')[0]!] ?? 'material');
/** A ruling as the rolls name it. */
const CUT: Record<string, string> = { break: 'Break the vow', respect: 'Respect sanctuary', extract: 'Take it from holy ground', abjure: 'Abjuration', suppress: 'Put down the shrine', sanction: 'Sanction the shrine', depose: 'Depose the stained', penance: 'Penance', silence: 'Silence them', tolerate: 'Let them be', restore: 'Restore to the blood', divide: 'Divide', speak: 'Let them speak for the house', compensate: 'Make them pay for the loss', restrain: 'Stop the work', pardon: 'Pardon', inscribe: 'Write it on the roll', compel: 'Order the aid', dispense: 'Release from the duty', custom: 'Hold the lord to custom', commute: 'Turn labour into a share', answer: 'Their body answers for it', free: 'Free their ground to them', release: 'Let them go', tie: 'Tie them to the land', assess: 'Assess on the bailiff’s word', expel: 'Cast out of the body', bar: 'Bar them', override: 'Override the custom', install: 'Install the challenger', confirm: 'Keep the head', enforce: 'Hold to it', strike: 'Let it go', stay: 'Put it off a year', turn: 'Turn the ground over', give: 'Give relief', dismiss: 'Send away', vouch: 'Vouch for them', inquire: 'Hold an inquest', surety: 'Kin stand surety', remit: 'Leave it to the local lord or body', charter: 'Grant the right', sell: 'Sell the right', refuse: 'Refuse', rival: 'Grant a rival right', forbid: 'Forbid work there', bless: 'Have it blessed', uphold: 'Uphold' };
const plain = (x: string): string => x.replace(/\(([A-Z]+>[A-Z]+)\)/g, (_m, w: string) => `(${wayWords(w)})`).replace(/sole right to (\w+)/g, (_m, w: string) => `sole right to ${TRADE[w] ?? w}`);
const cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);
const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
const seasonOf = (t: number): string => SEASONS[Math.floor((((t % 52) + 52 + 4) % 52) / 13)]!;

let s: State, R: Readers;
let seated: Petition[] = [];
const chosen = new Map<number, { cut: string; width: Width }>();
let tab: 'week' | 'rolls' | 'realm' | 'record' = 'week';
let lastWeek: string[] = [];
let over = '';

// --- Words ---

const HE = ['Aldred', 'Osric', 'Godwin', 'Leofric', 'Wulfstan', 'Edric', 'Thurstan', 'Hereward', 'Alwin', 'Sigeric', 'Oswin', 'Eadmer', 'Brihtric', 'Cuthbert', 'Dunstan', 'Ordgar', 'Ulf', 'Wigmund', 'Tostig', 'Hugh', 'Ralph', 'Gilbert', 'Walter', 'Simon'];
const SHE = ['Aldith', 'Edith', 'Godgifu', 'Leofrun', 'Wulfhild', 'Mildred', 'Hilda', 'Eadgyth', 'Sunniva', 'Aelfwen', 'Osburh', 'Cwen', 'Beatrix', 'Maud', 'Agnes', 'Emma', 'Avice', 'Juliana', 'Isolde', 'Cecily', 'Golda', 'Ragnhild', 'Thora', 'Estrild'];
const nameOf = (id: number): string => { const p = s.people[id]!; const l = p.sex ? SHE : HE; return l[(id * 7 + (p.born & 1023)) % l.length]!; };
const ageOf = (id: number): number => Math.floor((s.t - s.people[id]!.born) / 52);
const cellWords = (c: number): string => placeName(s, c);
/** The one who speaks for a house: the eldest of its grown people. */
function speaker(id: number): number {
  const b = s.bodies[id]!, g = grown(s, b);
  let h = -1;
  for (const p of g.length ? g : b.members.map(i => s.people[i]!).filter(x => x.alive)) if (h < 0 || p.born < s.people[h]!.born) h = p.id;
  return h;
}
/** A house as the court would call it. */
function house(id: number): string {
  if (id < 0) return 'nobody';
  const b = s.bodies[id]!;
  const h = speaker(id);
  if (h >= 0 && b.rank === 'lord') return `${s.people[h]!.sex ? 'Lady' : 'Lord'} ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'priest') return `${s.people[h]!.sex ? 'Mother' : 'Father'} ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'bailiff') return `${nameOf(h)}, the king’s bailiff at ${cellWords(b.home)}`;
  return h < 0 ? `a house at ${cellWords(b.home)}, now gone` : `${nameOf(h)}’s house`;
}
/** Who they are: the speaker, and who is in the house. */
function who(id: number): string {
  const b = s.bodies[id]!, h = speaker(id);
  if (h < 0) return '';
  const p = s.people[h]!, alive = b.members.map(i => s.people[i]!).filter(x => x.alive), young = alive.filter(x => (s.t - x.born) / 52 < 14).length;
  const grownUp = (s.t - p.born) / 52 >= P.wedShe, theirs = alive.filter(x => x.id !== h && (x.mother === h || x.father === h)).length;
  const lone = !grownUp ? (alive.length === 1 ? 'orphaned and alone' : 'orphaned') : p.spouse < 0 && theirs > 0 ? (p.sex ? 'a widow' : 'a widower') : p.spouse < 0 && alive.length === 1 ? 'alone' : '';
  return `${nameOf(h)} of ${cellWords(b.home)}, ${ageOf(h)}${lone ? ', ' + lone : ''}, with ${alive.length} in the house${young ? ` (${young} of them children)` : ''}`;
}
const owedWords = (bd: Bond): string => (bd.labour ? `${Math.round(bd.q)} days of work` : `${bd.q < 10 ? bd.q.toFixed(1) : Math.round(bd.q)} of ${KINDS[bd.kind]?.id ?? 'goods'}`);
const Cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);
/** A house is "it"; a titled lord, priest or bailiff speaks as a person. */
const its = (id: number): string => { const b = s.bodies[id], h = speaker(id); return b?.rank && h >= 0 ? (s.people[h]!.sex ? 'her' : 'his') : 'its'; };
const itself = (id: number): string => { const b = s.bodies[id], h = speaker(id); return b?.rank && h >= 0 ? (s.people[h]!.sex ? 'herself' : 'himself') : 'itself'; };

/** A line from the record, with houses called by name. */
const named = (x: string): string => x.replace(/([Hh])ouse (\d+)/g, (_m, H: string, n: string) => (H === 'H' ? Cap(house(Number(n))) : house(Number(n)))).replace(/\((\d+), ?(\d+)\)/g, (_m, cx: string, cy: string) => placeName(s, Number(cy) * s.side + Number(cx)));

/** One thing that weighs on a house, as a clause. */
function burdenWords(bd: Bond, by: number): string {
  const B = house(bd.a === by ? bd.b : bd.a);
  if (bd.about === 'right') return `it must give ${house(bd.a)} a fifth of all the ${trade(bd.kind)} it does about ${cellWords(bd.cell)}`;
  if (bd.about === 'yield') return bd.way === 'tithe' ? `it owes ${B} a tenth of all it gathers` : `it owes ${B} the Crown’s twentieth of all it gathers`;
  if (bd.about === 'bond') return bd.secures >= 0 ? `it has pledged its ground to ${B} against a debt` : bd.way === 'manor' ? `it holds its ground of ${B} by birth, for ${Math.round(bd.share * 100)} parts in a hundred of the yield` : `it has ground from ${B} for ${Math.round(bd.share * 100)} parts in a hundred of the yield`;
  return `it owes ${B} ${owedWords(bd)}${bd.way === 'blood' ? ' as the price of blood' : ''}`;
}

const constraintPlain = (sg: string): string => sg.startsWith('cell:') ? `no work on the ground at ${cellWords(Number(sg.slice(5)))}` : sg.startsWith('way:') ? `no dealing by ${wayWords(sg.slice(4))}` : sg.startsWith('house:') ? `nothing to do with ${house(Number(sg.slice(6)))}` : sg === 'duty:aid' ? 'fellows must aid fellows' : sg === 'new' ? 'no newcomers' : sg;
const leavesCount = (b: { parts: number[] }): number => { let n = 0; const st = [...b.parts]; while (st.length) { const x = s.bodies[st.pop()!]!; if (x.parts.length) st.push(...x.parts); else n++; } return n; };

function matterWords(p: Petition): string {
  const A = Cap(house(p.by)), B = house(p.against);
  if (p.burdens.length) {
    const bs = p.burdens.map(id => s.bonds.find(b => b.id === id)).filter((b): b is Bond => !!b);
    return `${A} is in want of ${NEEDS[p.need]!.id}. ${bs.length > 1 ? `${['', 'One thing weighs', 'Two things weigh', 'Three things weigh'][bs.length]} on it` : 'One thing weighs on it'}: ${bs.map(b => burdenWords(b, p.by)).join('; ')}.`;
  }
  if (p.reason === 'challenge') { const r = s.court!.rules.find(x => x.id === p.bond); return `${A} has been hurt by a rule of yours and asks that it be struck. The rule: ${r ? esc(plain(r.cut + ' when ' + r.shape)) : 'one now gone'}.`; }
  const bd = s.bonds.find(b => b.id === p.bond);
  if (p.side === 'mortmain') { const hb = s.bonds.find(x => x.id === p.bond); return `${A} says the ground at ${hb ? cellWords(hb.cell) : 'that place'} is theirs by blood. The last of the house that held it died devout and left it to ${B} for ever, and a vow cannot be undone.`; }
  if (p.side === 'sanctuary') { const bd2 = s.bonds.find(x => x.id === p.bond); return `${A} is owed ${bd2 ? owedWords(bd2) : 'what it is owed'} by ${B}, which has taken refuge on holy ground at ${cellWords(s.bodies[p.against]!.home)}. No one who fears God will lay hands on it there.`; }
  if (p.side === 'shrine') return `${A} says the shrine ${B} keeps at ${cellWords(p.cell ?? 0)} was never sanctioned. The people bring offerings there all the same, and call the place holy.`;
  if (p.side === 'unclean') return `${A} and others of pure creed will not take the rites of ${B}, whose head is stained, nor pay it the tithe. The office says its rites are good whoever performs them.`;
  if (p.side === 'heresy') return `${A} says ${B} holds a creed apart from ${its(p.by)} own and leads others into it. ${Cap(B)} is devout, and neither poor nor in want.`;
  if (p.side === 'heir') { const m = s.people[p.person ?? -1], hb = s.bonds.find(x => x.id === p.bond); return `${m ? `${nameOf(m.id)}, ${ageOf(m.id)}, of ${house(p.by)},` : A} says the ground at ${hb ? cellWords(hb.cell) : 'that place'} was theirs by blood: their house held it once and lost it. ${Cap(B)} holds it now.`; }
  if (p.side === 'appeal') { const m = s.people[p.person ?? -1]; return `${m ? `${nameOf(m.id)}, ${ageOf(m.id)},` : 'One'} of ${house(p.by)} appeals against the head of their own house, who broke the house’s custom (${esc(constraintPlain(p.sign ?? ''))}). They ask to speak for the house in its place, or to leave it.`; }
  if (p.side === 'harmed') return `${A} lost ${Math.round(s.bodies[p.by]!.harmedBy?.loss ?? 0)} of what it had to flood water. Upstream, ${B} cleared the cover from the ground at ${cellWords(p.cell ?? 0)}, and the water came down faster. ${Cap(B)} broke no law.`;
  if (p.side === 'unaided') return `${A} is in want. ${Cap(B)}, of the same body, has plenty, holds as its fellows do that fellows must aid one another, and gave nothing.`;
  if (p.side === 'exceeds') return `${A} holds its ground of ${B}, and owes him ${P.boon} days of work a week when he needs hands. He has been taking more than that.`;
  if (p.side === 'exit') return `${A} holds its ground of ${B} and says it will leave unless something changes. It could do better elsewhere, and its lord would lose its share.`;
  if (p.side === 'suspects') return `${A} says ${B} keeps back part of the Crown’s share. ${Cap(B)} has paid little for the ground it holds.`;
  if (p.side === 'asks' && p.body !== undefined) { const cb = s.bodies[p.body]!; return `${A} asks to lead the body of ${leavesCount(cb)} houses it belongs to, in place of ${B}. It has more to spare than ${B} and is as strong.`; }
  if (p.side === 'asks') return `${A} does most of the ${trade(p.work)} about ${cellWords(p.cell ?? 0)} and asks for the sole right to it. Anyone else who does that work there would owe it a fifth of what they make${p.against >= 0 ? `, ${B} among them` : ''}.`;
  if (p.side === 'fears') return `${A} holds that the ground at ${cellWords(p.cell ?? 0)} brings harm, since crops were lost there. It asks that ${B}, who works it, be stopped.`;
  if (bd && bd.about === 'right') return `${A} does the ${trade(bd.kind)} about ${cellWords(bd.cell)} too, and must give ${B} a fifth of what it makes there, by a right ${B} holds of your court. It asks that the right be broken.`;
  if (!bd) return p.shape.includes('shunned') ? `${A} came here within the year and is in want of ${NEEDS[p.need]!.id}. Its neighbours hold that newcomers bring harm, and will not deal with it.` : `${A} is in dire want of ${NEEDS[p.need]!.id}, and nobody stands between it and what it needs.`;
  if (bd.about === 'act' && bd.way === 'blood') {
    const d = R.index.get(bd.rec), dead = d && d.k === 'die' ? `${nameOf(d.a)}, ${Math.floor(d.q)},` : 'One';
    const how = bd.intent === 'defence' ? ` ${Cap(B)} struck in defence of what was theirs.` : bd.intent === 'need' ? ` ${Cap(B)} came to take, in want.` : bd.intent === 'claim' ? ` ${Cap(B)} came to take what it was owed.` : '';
    return p.side === 'owed' ? `${A} asks the price of blood. ${dead} of that house died of wounds after a struggle with ${B}.${how} The custom is ${P.bloodPrice} days of work.` : `${A} is held to owe ${B} the price of blood for ${dead.replace(/,$/, '')}, who died of wounds after they struggled, and says it should not be.`;
  }
  if (bd.about === 'act' && bd.denied) return `${A} says ${B} owes it ${owedWords(bd)}, agreed between the two of them with nobody by. ${Cap(B)} says no such thing was ever agreed.`;
  if (bd.about === 'act' && bd.basis === 'wrong') {
    const king = s.bodies[bd.a]!.rank === 'bailiff';
    const why = bd.intent === 'need' ? ' It was taken in want.' : bd.intent === 'defence' ? ' It was done defending what was theirs.' : bd.intent === 'gain' ? ' It was done for gain.' : '';
    if (p.side === 'owed') return (king ? `${A} says ${B} took ${owedWords(bd)} for the Crown and paid nothing.` : `${A} says ${B} took ${owedWords(bd)} from it, and asks to be made whole.`) + why;
    return `${A} is held to owe ${B} ${owedWords(bd)} for a taking, and says it never did it.`;
  }
  if (bd.about === 'act') {
    const how = bd.basis === 'grant' ? 'by an order of this court' : bd.way ? `having agreed to give ${wayWords(bd.way)}` : 'by its word';
    return p.side === 'owed' ? `${A} says ${B} owes it ${owedWords(bd)}, ${how}, and will not pay.` : `${A} owes ${B} ${owedWords(bd)}, ${how}, and says it cannot bear it.`;
  }
  if (bd.about === 'yield') return bd.way === 'tithe' ? `${A} owes ${B} a tenth of all it gathers, as everyone in the parish does, and says it cannot bear it this year.` : `${A} owes ${B} the Crown’s share of all it gathers, and says it cannot bear it this year.`;
  if (bd.about === 'land') return `${A} has too little ground. ${Cap(B)} holds ground at ${cellWords(bd.cell)} and has left it idle for more than a year.`;
  if (bd.secures >= 0) return `${A} pledged its ground to ${B} against a debt, and in its want fears to lose it.`;
  if (bd.way === 'manor') return `${A} holds its ground of ${B} by birth, as its forebears did, for ${Math.round(bd.share * 100)} parts in a hundred of what it yields, and says that is more than it can bear.`;
  return p.side === 'owed' ? `${A} let ground to ${B}, is now short of ground itself, and asks for it back.` : `${A} has the use of ground from ${B} for ${Math.round(bd.share * 100)} parts in a hundred of what it yields, and says the share is more than it can bear.`;
}

/** What each side says. Each speaks from what it holds true, or wants believed. */
/** What the one on the other side of a burden says of it. */
function holderSays(bd: Bond): string {
  if (bd.about === 'right') return bd.way === 'sell' ? '“We paid the Crown for that right.”' : '“Your own court granted it.”';
  if (bd.about === 'yield') return bd.way === 'tithe' ? '“The tenth is God’s, and was granted before any of us was born.”' : '“It is the king’s due, and I must answer for it.”';
  if (bd.about === 'bond') return bd.way === 'manor' ? '“They hold of me by birth, as their fathers held of mine.”' : bd.secures >= 0 ? '“We lent on that ground. Without it we lent on nothing.”' : '“We agreed the share between us.”';
  return bd.way === 'blood' ? '“A life was taken. Let them pay for it.”' : '“A debt is a debt.”';
}

function pleas(p: Petition): [string, string] {
  if (p.reason === 'challenge') return ['“Your rule has ruined us.”', ''];
  const weeks = (id: number, n: number): number => cover(s.bodies[id]!.store, askAhead(s, s.bodies[id]!))[n]!;
  const pressed = (id: number): boolean => { const c = cover(s.bodies[id]!.store, askAhead(s, s.bodies[id]!)); return c.some((x, n) => NEEDS[n]!.harm >= 0.5 && x < P.short); };
  const mouths = (id: number): string => { const n = s.bodies[id]!.members.filter(i => s.people[i]!.alive).length; return n === 1 ? 'one mouth' : `${n} mouths`; };
  const pb = s.bonds.find(b => b.id === p.bond);
  if (p.side === 'mortmain') return ['“A dead man’s piety has left his kin with nothing.”', '“It was given to God. What is given to God is not taken back.”'];
  if (p.side === 'sanctuary') return ['“They owe us, and they hide behind the altar.”', '“We are on holy ground. Touch us here and answer for it.”'];
  if (p.side === 'shrine') return ['“It is idolatry, and it takes the offerings that are owed to us.”', '“The water stopped at that stone. Everyone saw it.”'];
  if (p.side === 'unclean') return ['“A man in sin cannot make bread holy. We will not have it from his hand.”', '“The office is holy, not the man. The rites stand.”'];
  if (p.side === 'heresy') return ['“They lead people from the true way.”', '“We keep the faith more strictly than they do.”'];
  if (p.side === 'heir') return ['“My grandfather ploughed that ground. It was ours before it was theirs.”', '“It came to us fairly. What was lost is lost.”'];
  if (p.side === 'appeal') { const hd = speaker(p.by); return [`“The custom is older than any of us. ${hd >= 0 && s.people[hd]!.sex ? 'She' : 'He'} had no right to break it for the house.”`, '“I lead this house, and I answer for what it does.”']; }
  if (p.side === 'harmed') return ['“Before they stripped the hill, the water never came this high.”', '“It was our own ground, and wood is wanted. We did nothing wrong.”'];
  if (p.side === 'unaided') return ['“We would have done as much for them. It is what our fellows have always done.”', '“We have our own to think of.”'];
  if (p.side === 'exceeds') return ['“Two days was the custom in our fathers’ time. Now he takes four, and our own corn rots.”', '“The harvest will not wait. They hold of me, and they will work when I need them.”'];
  if (p.side === 'exit') return ['“There is better ground elsewhere, and none of it owes him a fifth.”', '“They are bound to this land as their fathers were.”'];
  if (p.side === 'suspects') return ['“They gather as much as their neighbours and pay a third as much.”', '“It was a poor year. Look in our barns if you doubt it.”'];
  if (p.side === 'asks' && p.body !== undefined) return ['“We are stronger and have more to spare. Let us lead.”', '“We have led well. Why should that change?”'];
  if (pb && pb.about === 'act' && pb.denied) return ['“We agreed it, the two of us. There was nobody else by.”', '“We never agreed any such thing.”'];
  if (p.side === 'asks') return ['“We have worked it longest and best. Let it be ours.”', p.against >= 0 ? '“We have done that work there as long as anyone. Must we pay them for it now?”' : ''];
  if (p.side === 'fears') return ['“Nothing has gone right since the harm there. Whoever works that ground brings it on us all.”', p.against >= 0 ? `“It is good ground, and we have ${mouths(p.against)} to feed.”` : ''];
  if (pb && pb.about === 'right') return ['“We have always done that work there. Now we must pay them for it.”', holderSays(pb)];
  const ask = p.need >= 0 ? `“We are ${mouths(p.by)} with ${weeks(p.by, p.need) < 10 ? weeks(p.by, p.need).toFixed(1) : Math.round(weeks(p.by, p.need))} weeks of ${NEEDS[p.need]!.id}.”` : '“We ask only what is ours.”';
  if (p.against < 0) return [ask, ''];
  const bd = s.bonds.find(b => b.id === p.bond), B = s.bodies[p.against]!;
  let ans = '';
  if (!bd) ans = '';
  else if (bd.about === 'act' && bd.way === 'blood') ans = p.side === 'owed' ? '“They came at us first.”' : '“A life was taken. Let them pay for it.”';
  else if (bd.about === 'act' && bd.basis === 'wrong') {
    if (p.side === 'owes') ans = '“Our ground was stripped, and we know that house.”';
    else if (B.rank === 'bailiff') ans = '“The king’s store was empty. I took what was needed, as my office allows.”';
    else if (bd.doer === -1) ans = '“The inquest has spoken.”';
    else { const h = speaker(p.against), frank = bd.doer === bd.a && h >= 0 && s.people[h]!.scruple >= 0.4 && pressed(p.against); ans = frank ? '“We took it. Our children were starving.”' : '“It was not us. Ask who was seen there.”'; }
  } else if (bd.about === 'act') ans = p.side === 'owed' ? (pressed(p.against) ? `“We have ${mouths(p.against)} and little laid by. Take it and we starve.”` : '“We will pay when the corn is in.”') : pressed(p.against) ? '“We need it ourselves.”' : '“A debt is a debt.”';
  else if (bd.about === 'yield') ans = bd.way === 'tithe' ? '“The tenth is God’s, and was granted before any of us was born.”' : '“It is the king’s due, and I must answer for it.”';
  else if (bd.about === 'land') ans = `“It is ours by ${bd.basis === 'use' ? 'long use' : bd.basis === 'grant' ? 'grant' : 'right'}, these ${Math.max(1, Math.floor((s.t - bd.since) / 52))} years.”`;
  else if (bd.way === 'manor') ans = '“They hold of me by birth, as their fathers held of mine.”';
  else ans = bd.secures >= 0 ? '“We lent on that ground. Without it we lent on nothing.”' : '“We agreed the share between us.”';
  if ((B.lore[`house:${p.by}`] ?? 0) > P.heed) ans += ' “And everyone knows that house brings harm.”';
  return [ask, ans];
}

function cutWords(p: Petition, cut: string): [string, string] {
  return cutWordsOf(p, cut) ?? [CUT[cut.split(':')[0]!] ?? cut, ''];
}

function cutWordsOf(p: Petition, cut: string): [string, string] | undefined {
  const bd = s.bonds.find(b => b.id === p.bond), B = house(p.against), A = house(p.by);
  const storeOf = (k: number): number => Math.round(s.court!.store[k] ?? 0);
  if (p.reason === 'challenge') return cut === 'uphold' ? ['Uphold the rule', 'It stands, and cannot be challenged again.'] : ['Strike the rule', 'Like cases will come to you again.'];
  if (p.side === 'mortmain') return ({
    uphold: ['Uphold the vow', 'The ground stays with the holy body for ever.'],
    break: ['Break the vow', 'The ground goes back to the blood. It is sacrilege: the place falls under interdict and your legitimacy suffers.'],
    commute: ['Return it for a perpetual due', `The ground goes back; ${A} owes the holy body a tenth of all it gathers, for ever.`],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'sanctuary') return ({
    respect: ['Respect sanctuary', 'They stay safe, and the debt waits. Your reach suffers.'],
    extract: ['Take it from holy ground', 'The debt is paid by force. It is sacrilege: interdict, and your legitimacy suffers.'],
    abjure: ['Abjuration', 'Sanctuary holds, but they give up half of what they have and leave the place.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'shrine') return ({
    suppress: ['Put down the shrine', 'Its keeper and the credulous nearby will hold it against you.'],
    sanction: ['Sanction the shrine', 'The holy body takes a quarter of its offerings. Strict holy bodies will hold it against you.'],
    inquire: ['Hold an inquest', 'Find out whether the sign was made up. Whatever you then do, no one can quarrel with it.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'unclean') return ({
    compel: ['Compel obedience', 'The office stands and its rites are good. The pure will hold it against you.'],
    depose: ['Depose the stained man', 'Another of that holy body takes his place. You have meddled in the other sovereignty; your legitimacy suffers.'],
    penance: ['Penance', 'He keeps the office, gives a seventh of the holy body’s goods to those in want nearby, and the stain is halved.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'heresy') return ({
    silence: [`Silence ${B}`, 'Shunned for half a year. Its kin and fellows will hold it against you.'],
    tolerate: [`Let ${B} be`, 'Its creed will spread to its neighbours. The holy body will hold it against you.'],
  } as Record<string, [string, string]>)[cut] ?? ['Leave it to the holy body', 'The Crown keeps out of it. A strict holy body will shun them.'];
  if (p.side === 'heir' && !cut.startsWith('remit')) return ({
    restore: ['Restore it to the blood', `The ground goes back to ${A}. ${Cap(B)} loses it.`],
    uphold: [`Uphold ${B}`, 'What was lost stays lost. The claim is settled for this generation.'],
    divide: ['Divide it', 'Each holds half.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'appeal') return ({
    speak: ['Let them speak for the house', 'The head is set aside. The house will act on what they hold true.'],
    uphold: ['Keep the head', 'The house goes on as it is.'],
    divide: ['Let them leave with their share', 'They take their spouse, their young children and a share of the house’s goods.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'harmed' && !cut.startsWith('remit')) return ({
    compensate: [`Make ${B} pay for the loss`, 'Up to half of it, from what it has most of.'],
    restrain: [`Stop ${B} working there`, 'Barred from the ground upstream for two years.'],
    dismiss: ['Call it no one’s fault', 'The water came as water does. They will hold it against you.'],
  } as Record<string, [string, string]>)[cut];
  if (cut === 'pardon') return ['Pardon it', 'It was done from need or in defence. Nothing is owed, and no name is blackened by it.'];
  if (cut === 'inscribe' && p.side === 'owed') return ['Write the promise on the roll', 'On your word it was made. It can never be denied, true or not.'];
  if (cut === 'inscribe') return ['Write their custom on the roll', 'It binds every like matter in their body, for good, and can never be challenged.'];
  if (p.side === 'unaided' && !cut.startsWith('remit')) return ({
    compel: [`Order ${B} to give`, 'Three weeks of what they lack, from what it has most of.'],
    dispense: ['Release it from the duty', 'The duty binds the less, here and among its fellows. The one in want is left.'],
    dismiss: ['Send them away', 'They will hold it against the court.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'exceeds' && !cut.startsWith('remit')) return ({
    custom: ['Hold the lord to custom', `${P.boon} days a week and no more, from now on.`],
    uphold: ['Back the lord', 'He may take what he needs. They will hold it against you.'],
    commute: ['Turn the labour into a share', 'They owe no days, but a twentieth more of what their ground yields.'],
  } as Record<string, [string, string]>)[cut];
  if (p.side === 'exit') return ({
    free: ['Free their ground to them', `It becomes theirs outright. ${Cap(B)} loses the ground and the share.`],
    release: ['Let them go', `They leave, and the ground goes back to ${B}.`],
    tie: ['Tie them to the land', 'They may not leave. They will hold it against you.'],
  } as Record<string, [string, string]>)[cut] ?? ['Lift the lord’s share for a year', 'They stay for now.'];
  if (p.side === 'suspects') return ({
    inquire: ['Hold an inquest', 'Find out. If they hid it, they pay and are shamed; if not, the bailiff is shown wrong.'],
    assess: ['Assess them on the bailiff’s word', 'They pay a share of what they have, whether or not they hid anything.'],
    dismiss: ['Send the bailiff away', 'If they are hiding it, they go on hiding it.'],
  } as Record<string, [string, string]>)[cut]!;
  if (p.side === 'asks' && p.body !== undefined) return ({
    install: [`Make ${A} its head`, `${Cap(B)} loses the lead and will not forgive it.`],
    confirm: [`Keep ${B} at its head`, `${Cap(A)} will hold it against you.`],
    remit: ['Let the body settle it', 'The stronger will take it. The loser blames them, not you.'],
  } as Record<string, [string, string]>)[cut]!;
  if (cut === 'answer') { const ab = s.bonds.find(x => x.id === p.bond)!, parent = s.bodies[s.bodies[ab.a]!.of]; return ['Their body answers for it', `The body ${house(ab.a)} belongs to owes it now${parent && parent.head >= 0 ? `, led by ${house(parent.head)}` : ''}. Its fellows will think the less of ${house(ab.a)}.`]; }
  if (cut === 'expel') return ['Cast them out of their body', 'The bond stands, but their fellows no longer stand with them.'];
  if (cut === 'inquire' && s.bonds.find(x => x.id === p.bond)?.denied) return ['Hold an inquest', 'Find out whether it was ever agreed. Whoever lied is shamed.'];
  if (p.side === 'asks') return ({
    charter: ['Grant the right', `Anyone else who does that work there owes ${A} a fifth.`],
    sell: ['Sell the right', `As granting it, but ${A} pays the Crown’s store first.`],
    refuse: ['Refuse', `${Cap(A)} will hold it against you.`],
  } as Record<string, [string, string]>)[cut]!;
  if (p.side === 'fears' && !cut.startsWith('remit')) {
    const sg = p.sign ?? '';
    const forbid: [string, string] = sg.startsWith('cell:') ? ['Forbid all work there', 'For two years. Whoever holds the ground loses their hold on it.']
      : sg.startsWith('way:') ? ['Forbid such dealing near them', 'Every such dealing within their bounds is void. Those owed lose it.']
      : [`Drive ${B} out`, 'Barred from working or dealing near them for two years. They must go elsewhere.'];
    return ({
      forbid,
      override: ['Override their custom', 'They must abide it. Their belief weakens, and they will hold it against you.'],
      dismiss: ['Send them away', 'They will go on believing it.'],
    } as Record<string, [string, string]>)[cut]!;
  }
  if (cut.startsWith('remit')) { const lp = judgeOf(s, cut.startsWith('remit:') ? Number(cut.slice(6)) : localPower(s, p)), L = lp >= 0 ? house(lp) : 'the local lord'; return [`Leave it to ${L}`, lp === p.by || lp === p.against ? `${Cap(L)} is a party, and will judge for ${itself(lp)}. The loser blames them, not you.` : 'They will judge for whoever is stronger. The loser blames them, not you.']; }
  if (cut === 'surety') { const sb = s.bonds.find(b => b.id === p.bond)!, k = suretyFor(s, sb.a); return [`Put it off on ${house(k)}’s surety`, `${Cap(house(k))}, kin to ${house(sb.a)}, is bound for half now. The rest waits a year.`]; }
  if (cut.startsWith('ease:')) {
    const eb = s.bonds.find(b => b.id === Number(cut.slice(5)))!, E = house(eb.a === p.by ? eb.b : eb.a);
    const what = eb.about === 'right' ? `${E}’s fifth of the ${trade(eb.kind)}` : eb.about === 'yield' ? (eb.way === 'tithe' ? 'the tithe' : 'the Crown’s share') : eb.about === 'bond' ? (eb.secures >= 0 ? 'the pledge' : `${E}’s share`) : `what it owes ${E}`;
    return [`Lift ${what} for a year`, eb.way === 'crown' ? 'Your own store goes without it.' : `${Cap(E)} goes without it, and will hold it against you.`];
  }
  if (!bd || cut === 'give' || cut === 'dismiss' || cut === 'vouch') return ({
    vouch: ['Vouch for them', 'Their neighbours must deal with them, and will hold it against you.'],
    give: ['Relief from the Crown’s store', `Three weeks of ${NEEDS[p.need]!.id}, now.`],
    levy: ['Lay it on the neighbours', 'Whoever nearby has most must give, and is owed it back.'],
    promise: ['Give your word', `Relief within ${P.wordWeeks} weeks. A broken word is the worst harm there is.`],
    dismiss: ['Send them away', 'They will hold it against the court.'],
  } as Record<string, [string, string]>)[cut]!;
  if (bd.about === 'right') return ({
    enforce: ['Uphold the right', `${Cap(A)} goes on paying ${B}.`],
    strike: ['Break the right', `${Cap(B)} loses it for good.`],
    rival: [`Grant ${A} a right of its own`, 'Neither owes the other. Others there owe both.'],
  } as Record<string, [string, string]>)[cut]!;
  const debtor = house(bd.a);
  if (bd.about === 'act') return ({
    enforce: [`Hold ${debtor} to it`, 'Paid now as far as it can be; the rest is worked off. The court keeps a tenth.'],
    part: ['Part it', 'Half is paid, half is let go.'],
    strike: ['Let the debt go', `${house(bd.b)} loses what it was owed.`],
    stay: ['Stay it a year', 'Nothing is due until then.'],
    redeem: ['The Crown pays it', `Out of the store, which holds ${storeOf(bd.kind)} of ${KINDS[bd.kind]?.id ?? 'it'}.`],
    inquire: ['Hold an inquest', 'Find who truly did it. The matter stays before you.'],
    bar: [`Bar ${debtor} from ${house(bd.b)}’s ground`, 'For two years it may not work or deal near it. Nothing is paid.'],
  } as Record<string, [string, string]>)[cut]!;
  if (bd.about === 'land') return ({
    enforce: [`Confirm ${B} in its ground`, `${A} gets nothing.`],
    part: ['Share the ground', 'Each holds half.'],
    strike: [`Take the ground from ${B}`, 'It lies open to whoever works it.'],
    turn: [`Give the ground to ${A}`, `${B} loses it.`],
  } as Record<string, [string, string]>)[cut]!;
  if (bd.about === 'yield') return ({
    enforce: ['Hold them to it', 'The share stands as it always has.'],
    part: ['Halve the share', `${Cap(B)} takes half as much from now on.`],
    strike: ['Free them of it', `${Cap(B)} loses the share for good.`],
    stay: ['Lift it for a year', 'Nothing is owed until then.'],
  } as Record<string, [string, string]>)[cut]!;
  const pledge = bd.secures >= 0;
  return ({
    enforce: pledge ? ['Let the ground pass', 'The creditor takes it now and the debt is done.'] : ['Hold them to the letting', 'It runs its full term again.'],
    part: pledge ? ['Shorten it', 'Half a year more, no longer.'] : ['Halve it', 'The share is halved, or the term cut to half a year.'],
    strike: pledge ? ['Free the ground', 'The surety is void; the debt stands bare.'] : ['End the letting', 'The ground goes back.'],
    stay: ['Stay it a year', 'Nothing changes until then.'],
  } as Record<string, [string, string]>)[cut]!;
}

// --- The pieces of the page ---

function tally(): string {
  const c = s.court!, seals = [0, 1, 2, 3, 4].map(i => `<span class="seal${c.standing >= i + 1 ? '' : c.standing >= i + 0.5 ? ' half' : ' gone'}"></span>`).join('');
  const alive = s.people.filter(p => p.alive).length, store = c.store.map((q, k) => [q, k] as const).filter(([q]) => q >= 1).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([q, k]) => `${Math.round(q)} ${KINDS[k]!.id}`).join(', ') || 'empty';
  return `<div class="tally"><div class="in">
    <span class="when">${seasonOf(s.t)}, year ${Math.floor(s.t / 52) + 1}, week ${(s.t % 52) + 1}</span>
    <span class="stat"><span class="label">Standing</span><span class="seals" title="${c.standing.toFixed(1)} of 5">${seals}</span></span>
    <span class="stat" title="What you can give in relief. A tenth of what you enforce and the Crown’s share of every harvest come into it."><span class="label">Crown’s store</span><span class="gilt">${store}</span></span>
    <span class="stat"><span class="label">Souls</span><span>${alive}</span></span>
    <span class="stat"><span class="label">Weeks left</span><span>${Math.max(0, P.reign - s.t)}</span></span>
  </div></div>`;
}

function matterCard(p: Petition): string {
  const b = s.bodies[p.by]!, cov = cover(b.store, askAhead(s, b)), pick = chosen.get(p.id);
  const want = p.need >= 0 ? `It has ${cov[p.need]! < 10 ? cov[p.need]!.toFixed(1) : Math.round(cov[p.need]!)} weeks of ${NEEDS[p.need]!.id} laid by.` : 'It is not in want.';
  const chain = (p.rec >= 0 ? R.chain(p.rec, 4) : []).map(named);
  const inBody = top(s, b).id !== b.id;
  const widths: [Width, string][] = [['case', 'This case only'], ...(inBody && p.reason !== 'challenge' ? [['body', 'A rule for their body'] as [Width, string]] : []), ...(p.reason !== 'challenge' ? [['realm', 'A rule for the realm'] as [Width, string]] : [])];
  return `<article class="matter${pick ? ' chosen' : ''}">
    <header><h3>${esc(cap(house(p.by)))}${p.reason === 'challenge' ? ' against a rule' : p.burdens.length ? ', in want' : p.side === 'asks' ? (p.body !== undefined ? ' asks to lead' : ' asks leave') : p.against >= 0 ? ' against ' + esc(house(p.against)) : ''}</h3>
      <span class="small soft">${p.speaksFor > 1 ? `one of a body of ${p.speaksFor} houses · ` : ''}${p.waited ? `waited ${p.waited} week${p.waited > 1 ? 's' : ''}` : 'new this week'}${p.reason === 'clash' ? ' · two bodies’ rules disagree' : ''}</span></header>
    ${DEBUG ? `<p class="planes">${(() => { const [x, y] = planesOf(s, p); return x === y ? esc(PLANE[x]) : `${esc(PLANE[x])} against ${esc(PLANE[y])}`; })()}</p>` : ''}
    <p>${matterWords(p)}</p>
    <p class="small soft">${esc(who(p.by))}${!p.burdens.length && p.against >= 0 && !s.bodies[p.against]!.rank ? ' — against ' + esc(who(p.against)) : ''}</p>
    ${(() => { const [a, b] = pleas(p); if (p.side === 'appeal') { const m = p.person ?? -1, hd = speaker(p.by); return `<p>${esc(m >= 0 ? nameOf(m) : 'The one who appeals')}: ${a}</p>${hd >= 0 ? `<p>${esc(nameOf(hd))}, head of the house: ${b}</p>` : ''}`; } if (!p.burdens.length) return `<p>${esc(Cap(house(p.by)))}: ${a}</p>${b ? `<p>${esc(Cap(house(p.against)))}: ${b}</p>` : ''}`; return `<p>${esc(Cap(house(p.by)))}: ${a}</p>` + p.burdens.map(id => s.bonds.find(x => x.id === id)).filter((x): x is Bond => !!x).map(x => `<p>${esc(Cap(house(x.a === p.by ? x.b : x.a)))}: ${holderSays(x)}</p>`).join(''); })()}
    ${chain.length ? `<div><span class="label">How it came about</span><ol class="chain">${chain.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>` : ''}
    <div class="cuts">${cuts(s, p).map(c => { const [t, d] = cutWords(p, c); return `<button data-cut="${p.id}:${c}" aria-pressed="${pick?.cut === c}">${DEBUG ? `<em class="layer">${VERB[planeOfCut(p, c)]}</em>` : ''}${esc(t)}<span>${esc(d)}</span></button>`; }).join('')}</div>
    ${pick && pick.cut !== 'inquire' && !(p.burdens.length && !pick.cut.startsWith('ease:')) && widths.length > 1 ? `<div><span class="label">How far it reaches</span><div class="widths">${widths.map(([w, t]) => `<button data-width="${p.id}:${w}" aria-pressed="${pick.width === w}">${t}</button>`).join('')}</div></div>` : ''}
    ${p.reason === 'challenge' || p.burdens.length ? '' : `<p class="shape">A rule here would cover: ${esc(plain(p.shape))}</p>`}
  </article>`;
}

function weekPanel(): string {
  const n = chosen.size, c = s.court!;
  const waiting = c.docket.length - seated.length;
  return `<section><div class="bar"><div><h2>The audience</h2><p class="soft small">${seated.length ? `${seated.length} seated${waiting > 0 ? `, ${waiting} more waiting` : ''}. You may hear ${P.hearings}; a fourth costs half a seal.` : 'Nobody waits on you this week.'}</p></div>
    <button class="go" id="pass">${n ? `Give ${n} ruling${n > 1 ? 's' : ''} and let the week pass` : 'Let the week pass'}</button></div>
    <div class="matters">${seated.map(matterCard).join('')}</div></section>
    ${lastWeek.length ? `<section><h2>Last week</h2><ul class="list">${lastWeek.map(x => `<li>${x}</li>`).join('')}</ul></section>` : ''}`;
}

function rollsPanel(): string {
  const c = s.court!;
  if (!c.rules.length) return '<section><h2>The rolls</h2><p class="soft">You have made no rule yet. Until you do, every like case comes back to you.</p></section>';
  return `<section><h2>The rolls</h2><div class="tbl"><table><thead><tr><th>Rule</th><th>Binds</th><th>Made</th><th>Settled below</th></tr></thead><tbody>${c.rules.slice().sort((a, b) => b.uses - a.uses).map(r => `<tr><td><strong>${esc(CUT[r.cut] ?? cap(r.cut))}</strong> when a house ${esc(plain(r.shape))}</td><td>${r.scope === -1 ? 'the realm' : 'body ' + r.scope}</td><td>week ${r.since + 1}</td><td>${r.uses}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function realmPanel(): string {
  const c = s.court!, hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length), bodies = s.bodies.filter(b => b.alive && b.parts.length).length;
  const sum = (k: number): number => Math.round(hs.reduce((x, b) => x + b.store[k]!, 0));
  const sore = Object.values(c.grief).filter(g => g >= P.aggrieved).length;
  const ways = new Set(hs.flatMap(b => Object.keys(b.ways)));
  const expect = ['Owed on a bond', 'Bound by a bond', 'Shut out by a bond', 'In bare want'].map((t, k) => `<tr><td>${t}</td><td>${Math.round((100 * hs.reduce((x, b) => x + (b.plea[k] ?? 0.5), 0)) / Math.max(1, hs.length))} in 100</td></tr>`).join('');
  const cell = (t: string, v: string, cls = ''): string => `<div><div class="label">${t}</div><div class="num ${cls}">${v}</div></div>`;
  return `<section><h2>The realm</h2><div class="grid">
    ${cell('Souls', String(s.people.filter(p => p.alive).length))}${cell('Houses', String(hs.length))}${cell('Bodies of houses', String(bodies))}
    ${cell('Aggrieved houses', String(sore), sore >= P.faction * hs.length * 0.7 ? 'bad' : '')}${cell('Needed to withdraw confidence', String(Math.ceil(P.faction * hs.length)))}
    ${cell('Grain laid by', String(sum(0)))}${cell('Word given, not yet made good', String(c.words.length))}${cell('Word kept / broken', `${c.wordsKept} / ${c.wordsBroken}`, c.wordsBroken ? 'bad' : '')}
  </div></section>
  <section><h3>Places</h3><div class="tbl"><table><thead><tr><th>Place</th><th>Houses</th><th>Souls</th><th>Who is there</th></tr></thead><tbody>${(() => {
    const at = new Map<number, typeof hs>();
    for (const b of hs) { const l = at.get(b.home); if (l) l.push(b); else at.set(b.home, [b]); }
    return [...at].sort((x, y) => y[1].length - x[1].length).slice(0, 30).map(([cell, l]) => `<tr><td>${esc(cellWords(cell))}</td><td>${l.length}</td><td>${l.reduce((x, b) => x + b.members.filter(i => s.people[i]!.alive).length, 0)}</td><td>${esc(l.filter(b => b.rank).map(b => Cap(house(b.id)).replace(/ (of|at) [A-Z][a-z]+$/, '')).join('; '))}</td></tr>`).join('');
  })()}</tbody></table></div></section>
  <section><h3>What houses expect of your court</h3><p class="soft small">How likely they think you are to find for the one who asks. It decides who comes.</p><div class="tbl"><table><tbody>${expect}</tbody></table></div></section>
  <section><h3>Ways of dealing known in the realm</h3><ul class="list">${[...ways].sort().map(w => `<li>${esc(wayWords(w))}</li>`).join('') || '<li class="soft">Only goods for goods.</li>'}</ul></section>`;
}

function recordPanel(): string {
  const ev = R.events.slice(-40).reverse();
  return `<section><h2>The record</h2><ul class="list">${ev.map(e => `<li>${esc(named(e.text))}${e.chain[0] ? `<div class="small soft">because ${esc(named(e.chain[0]))}</div>` : ''}</li>`).join('') || '<li class="soft">Nothing the chroniclers thought worth writing yet.</li>'}</ul></section>`;
}

function render(): void {
  if (over) { app.innerHTML = `${tally()}<div class="wrap"><section class="start"><h1>${over}</h1><p>${s.court!.standing > 0 ? `You kept the realm for ${Math.floor(s.t / 52)} years, with ${s.court!.standing.toFixed(1)} of 5 in standing. You made ${s.court!.rules.length} rules, and they settled ${s.court!.rules.reduce((x, r) => x + r.uses, 0)} matters without you.` : `Too many houses had had enough. It took ${s.t} weeks.`}</p><div class="choices"><button class="go" id="again">Begin another reign</button></div></section>${rollsPanel()}${recordPanel()}</div>`; return; }
  const tabs: [typeof tab, string][] = [['week', 'The audience'], ['rolls', `The rolls (${s.court!.rules.length})`], ['realm', 'The realm'], ['record', 'The record']];
  app.innerHTML = `${tally()}<div class="wrap"><nav class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</nav>${tab === 'week' ? weekPanel() : tab === 'rolls' ? rollsPanel() : tab === 'realm' ? realmPanel() : recordPanel()}</div>`;
}

// --- The week ---

function openWeek(): void {
  s.log = [];
  seated = audience(s);
  chosen.clear();
}

function passWeek(): void {
  const c = s.court!, before = c.standing;
  const rulings: Ruling[] = [...chosen].map(([petition, v]) => ({ petition, cut: v.cut, width: v.width }));
  const said = rulings.map(r => { const p = seated.find(x => x.id === r.petition)!; return `You ruled: <strong>${esc(cutWords(p, r.cut)[0])}</strong>, ${esc(house(p.by))}${p.against >= 0 ? ' against ' + esc(house(p.against)) : ''}${r.width !== 'case' && r.cut !== 'inquire' ? `, as a rule for ${r.width === 'realm' ? 'the realm' : 'their body'}` : ''}.`; });
  hear(s, rulings);
  const below = s.log.filter(r => r.k === 'rule' && r.kind2 === 1).length, withdrew = s.log.some(r => r.k === 'withdraw');
  const words = s.log.filter(r => r.q2 === 9 && (r.k === 'keep' || r.k === 'break')).map(r => (r.k === 'keep' ? `Your word to house ${r.b} was kept out of the store.` : `<span class="bad">Your word to house ${r.b} was broken: the store had nothing to give.</span>`));
  const seen = R.events.length;
  advance(s, true);
  R.read(s);
  lastWeek = [...said, ...words];
  if (below) lastWeek.push(`${below} matter${below > 1 ? 's were' : ' was'} settled below by your rules.`);
  if (withdrew) lastWeek.push(`<span class="bad">Enough houses had had enough: they withdrew their confidence. Standing fell from ${before.toFixed(1)} to ${c.standing.toFixed(1)}.</span>`);
  else if (c.standing < before) lastWeek.push(`A fourth hearing cost you half a seal.`);
  for (const e of R.events.slice(seen)) lastWeek.push(esc(named(e.text)));
  if (c.standing <= 0) over = 'The regency has fallen';
  else if (s.t >= P.reign) over = 'The king returns';
  else openWeek();
}

// --- The cockpit: the realm runs on its own. The regent trims it with laws, the treasury and decrees, and gives orders place by place ---

let mode: Mode = 'cockpit';
let speed: 0 | 1 | 5 | 20 = 0, acc = 0, lastFrame = 0, lastPaint = 0, dirty = false;
type Lens = 'want' | 'factions' | 'sacred' | 'jurisdiction' | 'ecology';
let view: 'map' | 'chronicle' = 'map', deck: 'dials' | 'laws' | 'works' | 'powers' | 'chronicle' = 'laws', lens: Lens = 'want';
/** Whether the dock's half-sheet is up, and whether the map key is showing. */
let dockOpen = false, keyOpen = false;
/** Where the river runs from each place, worked out once per realm. */
let lowOf: number[] = [], lowFor = '';
let focusPower = -1;
let picked = -1, majorOnly = false;
/** The gauges a season back, for the arrows; which gauge's breakdown is open; which gauges are flashing, until when. */
let hist: { t: number; legitimacy: number; reach: number; store: number }[] = [];
let openGauge: '' | 'legitimacy' | 'reach' | 'store' = '';
let flash: Partial<Record<'legitimacy' | 'reach' | 'store', 'good' | 'bad' | 'warn'>> = {}, flashTimer = 0;
/** Houses ("b:12") and places ("c:40") the regent is following. */
const watched = new Set<string>();
/** Decades: where the present one began, what it has seen so far, and the stamps of those past. */
let eraFrom = 0, eraStats = { pop: 0, hunger: 0, withdrawals: 0, shrines: 0, floods: 0, defied: 0 };
let eras: { t: number; html: string }[] = [];
/** The map's zoom and pan, and the pointers on it. */
let zoom = 1, panX = 0, panY = 0, gesturing = false;
/** What the cockpit has to say that the chroniclers do not: laws laid down, decrees, orders, what was settled below, the Crown's hold. */
let feed: { t: number; text: string; major: boolean }[] = [];
const RATE = { 0: 0, 1: 1 / 1.5, 5: 3, 20: 20 } as const;
const capOf = (): number => P.hearings;

const LAW_WORDS: Record<LawKey, [string, [string, string][]]> = {
  forest: ['Forest & clearing', [['free', 'Free clearing'], ['stinted', 'Stinted'], ['kings', 'King’s forest']]],
  movement: ['Movement & ties', [['free', 'Free movement'], ['bound', 'Bound to the ground']]],
  credit: ['Credit & debt', [['enforce', 'Enforce'], ['mercy', 'Mercy'], ['custom', 'Local custom']]],
  swords: ['The two swords', [['immunity', 'Clerical immunity'], ['concordat', 'Concordat'], ['supremacy', 'Royal supremacy']]],
};
const LAW_HINT: Record<LawKey, string> = {
  forest: 'Free: more timber and fields, and faster floods below. Stinted: no place cleared past its stint. King’s forest: no clearing but on a house’s own ground.',
  movement: 'Free: tenants leave bad lords at once. Bound: they may not leave, lords keep their boon-work, and tenants in want hold it against you.',
  credit: 'Enforce: debts are held to. Mercy: put off, pardoned, or stood surety for; burdens lifted from houses in want. Local custom: the local lord or body decides.',
  swords: 'The holy: leave it to the church, strike a bargain with it, or rule over it.',
};
const DIALS: { key: keyof Dials; name: string; vals: (number | string)[]; show: (v: any) => string; hint: string }[] = [
  { key: 'grainShare', name: 'Grain levy', vals: [0, 0.05, 0.1, 0.15, 0.2], show: v => `${Math.round(v * 100)}%`, hint: 'Of every harvest from sown ground, to the bailiffs. Feeds the store; weighs on every house.' },
  { key: 'timberShare', name: 'Timber levy', vals: [0, 0.05, 0.1, 0.15, 0.2], show: v => `${Math.round(v * 100)}%`, hint: 'Of all timber cut. It pays for works.' },
  { key: 'boonCap', name: 'Boon-work cap', vals: [0, 1, 2, 3, 6], show: v => `${v} days`, hint: 'The most a lord may draw from a tenant each week. Below three, tenants are calmer and lords aggrieved.' },
  { key: 'tithe', name: 'The tithe', vals: ['protected', 'shared', 'taxed'], show: v => ({ protected: 'Protected', shared: 'A quarter', taxed: 'A half' })[v as string]!, hint: 'What of the church’s tithes comes to the store. It costs legitimacy each season, and the priests’ goodwill.' },
  { key: 'toll', name: 'Tolls', vals: [0, 0.05, 0.12], show: v => `${Math.round(v * 100)}%`, hint: 'Of goods traded between valleys, to the store.' },
  { key: 'relief', name: 'Relief floor', vals: ['off', 'starving', 'want'], show: v => ({ off: 'Off', starving: 'Starving', want: 'In want' })[v as string]!, hint: 'Up to three houses a week below the floor are fed from the store.' },
  { key: 'bailiff', name: 'Bailiff posture', vals: ['light', 'regular', 'strict'], show: v => ({ light: 'Light', regular: 'Regular', strict: 'Strict inquest' })[v as string]!, hint: 'Light: twice a year, and they never take. Strict: every six weeks, and hidden shares and false claims are found out, at a cost to your reach.' },
];
const ORDS: [OrdKey, string, string][] = [
  ['stay', 'Year of stay', 'Nothing is seized or forfeit, and lords ask no more than custom, for a year.'],
  ['granaries', 'Open the granaries', 'The relief floor feeds six houses a week, at least the starving, for a season.'],
  ['eyre', 'Royal eyre', 'Your justices ride the realm for half a year: false claims are found out, and your legitimacy and reach rebuild.'],
  ['penance', 'Solemn penance', 'For half a year interdicts lift sooner, stains and bans fade, and the fear of strangers cools.'],
];
const WORKS: [WorkKey, string, string, string][] = [
  ['granary', 'Granary', '▣', 'Houses here and next door put by part of what they hold beyond ten weeks’ food, and draw on it in want. It spoils slowly.'],
  ['dike', 'Dike', '═', 'Raises the bank: the river must run much higher before it floods this place.'],
  ['reserve', 'Forest reserve', '♣', 'No one may clear the woods here, so the water upstream of others runs slower.'],
  ['post', 'Bailiff’s post', '⚑', 'Houses within two places do not join factions, grievance fades faster, and your reach grows a little each season.'],
  ['chapel', 'Endowed chapel', '✝', 'The place grows holier, grievance near it fades faster, and your legitimacy grows a little each season.'],
];
const LEGEND: Record<Lens, string> = {
  want: 'Percentage of local households short of at least one essential need.',
  factions: 'Percentage of local households whose grievance reaches the Crown’s threshold.',
  sacred: 'The index combines sanctity, shrines and interdicts. Red identifies an interdict.',
  jurisdiction: 'Colour identifies the local lordship. Figures give the settlement population.',
  ecology: 'The index combines soil depletion, flooding and clearance.',
};
const GLYPHS = 'Dots mark villages, squares mark ranked settlements, and a ring marks the Crown seat. Short diagonal hatches mark uplands, fine dots mark woodland, and open ground is plain. Dashed lines separate lordships.';

const storeTotal = (): number => (s.court ? s.court.store.reduce((x, y) => x + y, 0) : 0);
/** Up, down or level against a season ago. */
function trend(g: 'legitimacy' | 'reach' | 'store'): string {
  const c = s.court!, then = hist.find(h => h.t >= s.t - 13) ?? hist[0];
  if (!then || then.t >= s.t) return '';
  const now = g === 'store' ? storeTotal() : c[g], was = then[g], eps = g === 'store' ? Math.max(2, was * 0.03) : 0.05;
  return now > was + eps ? '<b class="up">▲</b>' : now < was - eps ? '<b class="down">▼</b>' : '';
}
function seals(g: 'legitimacy' | 'reach', label: string): string {
  const v = s.court![g];
  return `<button class="inst gauge${flash[g] ? ' flash-' + flash[g] : ''}" data-gauge="${g}" aria-expanded="${openGauge === g}"><span class="label">${label} ${trend(g)}</span><span class="seals" title="${v.toFixed(1)} of 5">${[0, 1, 2, 3, 4].map(i => `<span class="seal${v >= i + 1 ? '' : v >= i + 0.5 ? ' half' : ' gone'}"></span>`).join('')}</span></button>`;
}
/** What moved a gauge over the last season, largest first. */
function breakdown(g: 'legitimacy' | 'reach' | 'store'): string {
  const c = s.court!, by = new Map<string, number>();
  for (const e of c.ledger ?? []) if (e.g === g && e.t > s.t - 13) by.set(e.why, (by.get(e.why) ?? 0) + e.d);
  const then = hist.find(h => h.t >= s.t - 13) ?? hist[0], now = g === 'store' ? storeTotal() : c[g];
  const fmt = (d: number): string => (g === 'store' ? `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d))}` : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}`);
  const lines = [...by].filter(([, d]) => Math.abs(d) >= (g === 'store' ? 0.5 : 0.005)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4)
    .map(([why, d]) => `<li><b class="${d > 0 ? 'up' : 'down'}">${fmt(d)}</b> ${esc(why.replace(/#(\d+)/g, (_m, n: string) => cellWords(Number(n))))}</li>`);
  const name = ({ legitimacy: 'Legitimacy', reach: 'Reach', store: 'The store' })[g];
  return `<div class="gpop"><div class="bar"><strong>${name}, the last season${then && then.t < s.t ? `: ${fmt(now - then[g])} in all` : ''}</strong><button data-gauge="" aria-label="Close">✕</button></div><ul class="list small">${lines.join('') || '<li class="soft">Nothing moved it.</li>'}</ul>${g !== 'store' ? '<p class="small soft">Each gauge runs from 0 to 5; what would carry it past either end is lost.</p>' : ''}</div>`;
}
function doFlash(f: typeof flash): void {
  flash = { ...flash, ...f };
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { flash = {}; paint(); }, 900);
}
const factionNeed = (hearths: number): number => Math.max(P.factionMin, Math.ceil(P.faction * hearths));
function strip(): string {
  const c = s.court, hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length);
  const when = `Y${Math.floor(s.t / 52) + 1} · W${(s.t % 52) + 1} · ${seasonOf(s.t)}`;
  const speeds = `<div class="speeds">${([0, 1, 5, 20] as const).map(v => `<button data-speed="${v}" aria-pressed="${speed === v}" aria-label="${v ? v + ' times' : 'Pause'}">${v ? v + '×' : '❙❙'}</button>`).join('')}</div>`;
  const kpi = (label: string, value: string, frac: number, bad: boolean, gauge = ''): string => `<${gauge ? `button data-gauge="${gauge}" aria-expanded="${openGauge === gauge}"` : 'div'} class="kpi${gauge && flash[gauge as 'legitimacy'] ? ' flash-' + flash[gauge as 'legitimacy'] : ''}"><span class="label">${label}${gauge ? ' ' + trend(gauge as 'legitimacy') : ''}</span><span class="val">${value}</span><span class="bar"><i class="${bad ? 'bad' : ''}" style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></i></span></${gauge ? 'button' : 'div'}>`;
  const tool = `<div class="toolbar"><button class="home" data-home="1" aria-label="Save and leave">⌂</button><span class="when">${when}${c?.policy.weak ? ' · <span class="bad">Crown weak</span>' : ''}</span>${speeds}</div>`;
  if (!c) return `<header class="strip"><div class="kpis">${kpi('Souls', String(s.people.filter(p => p.alive).length), 1, false)}${kpi('Houses', String(hs.length), 1, false)}</div>${tool}</header>`;
  const sore = Object.values(c.grief).filter(g => g >= P.aggrieved).length, need = factionNeed(hs.length);
  const gk = KINDS.findIndex(k => k.id === 'grain'), tk = KINDS.findIndex(k => k.id === 'timber'), grain = c.store[gk] ?? 0, timber = c.store[tk] ?? 0;
  const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');
  return `<header class="strip"><div class="kpis">
    ${kpi('Legitimacy', c.legitimacy.toFixed(1), c.legitimacy / 5, c.legitimacy <= 1.5, 'legitimacy')}
    ${kpi('Reach', c.reach.toFixed(1), c.reach / 5, c.reach <= 1.5, 'reach')}
    ${kpi('Store', `${fmt(grain)} / ${fmt(timber)}`, storeTotal() / Math.max(1, c.store0), storeTotal() < 0.5 * c.store0, 'store')}
    ${kpi('Factions', `${sore} / ${need}`, sore / need, sore >= need)}</div>${tool}${openGauge ? breakdown(openGauge) : ''}</header>`;
}

/** The realm's dominant lord or body at each place, for borders and the jurisdiction lens. */
function lordAt(at: Map<number, Body[]>, i: number): number {
  const l = at.get(i);
  if (!l?.length) return -1;
  // Only a real lordship counts: a lord's, a parish's, or a body of houses. A free house belongs to none.
  const tops = l.map(b => top(s, b)).map(t => (t.rank === 'lord' || t.rank === 'priest' || t.parts.length ? t.id : -1));
  return tops.sort((x, y) => tops.filter(t => t === y).length - tops.filter(t => t === x).length || x - y)[0]!;
}
/** A heraldic palette for lordships: woad, ochre, sage, terracotta, plum, slate. */
const HERALDRY = ['#3d5f7a', '#b07d2b', '#7d8f5a', '#b5643c', '#6e4a6b', '#5d6870'];
/** Pale tabletop washes for shires: soft ochre, sage, warm cream, stone. */
const WASH = ['#c9a45c', '#93a57a', '#e0c99a', '#a9a293'];
const herald = (id: number): string => HERALDRY[((id % HERALDRY.length) + HERALDRY.length) % HERALDRY.length]!;
/** A quiet figure for a named place, by the active lens. */
function microData(i: number, at: Map<number, Body[]>): string {
  const l = at.get(i) ?? [], souls = l.reduce((a, b) => a + b.members.filter(m => s.people[m]!.alive).length, 0);
  return souls ? String(souls) : '';
}
const titleCase = (x: string): string => x.replace(/\b([a-z])/g, m => m.toUpperCase());
/** The lens's four steps, as a small legend above the dock. */
function legend(): string {
  if (lens === 'jurisdiction') return `<div class="measure-key"><span class="measure-unit">Colour denotes lordship · labels show population</span></div>`;
  const household = lens === 'want' || lens === 'factions';
  const col = lens === 'sacred' ? 'var(--gilt)' : lens === 'ecology' ? 'var(--good)' : 'var(--seal)';
  const ranges = household ? ['0%', '>0%', '≥25%', '≥50%'] : ['0', '>0', '≥25', '≥50'];
  return `<div class="measure-key"><span class="measure-unit">${household ? 'Share of local households' : 'Index · 0–100'}</span>
    <div class="measure-bands">${MAP_INKS.map((ink, i) => `<span><i style="background:${mapInk(col, ink)}"></i>${ranges[i]}</span>`).join('')}</div>
    ${household ? '<small><i></i>No households</small>' : lens === 'sacred' ? '<small class="interdict"><i></i>Under interdict</small>' : ''}</div>`;

}
const MAP_INKS = [0, 27, 56, 88] as const;
const mapInk = (color: string, amount: number): string => `color-mix(in srgb, ${color} ${amount}%, var(--stone))`;
/** Room around the realm so nothing at its edge is clipped. */
const PAD = 0.45;
const labelMeasure = document.createElement('canvas').getContext('2d')!;
labelMeasure.font = '600 100px Helvetica, Arial, sans-serif';
function mapView(): string {
  const hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length), at = new Map<number, Body[]>();
  for (const b of hs) { const l = at.get(b.home); if (l) l.push(b); else at.set(b.home, [b]); }
  const ranked = new Map<number, Body>();
  for (const b of s.bodies) if (b.alive && b.rank && !ranked.has(b.home)) ranked.set(b.home, b);
  const c = s.court, g = geometry(s.side, s.seed), N = s.side;
  if (lowFor !== `${s.seed}:${s.side}`) { lowOf = route(s, () => 1).low; lowFor = `${s.seed}:${s.side}`; }
  const xy = (i: number): [number, number] => [i % N, Math.floor(i / N)];
  const highs = s.cells.map(x => x.high), hsort = highs.slice().sort((a, b) => a - b);
  const q = (p: number): number => hsort[Math.floor(p * (hsort.length - 1))]!;
  // The island: the outer ring is sea where it lies low or nobody lives there; never a place anyone holds or the Crown sits.
  const seat = c?.seat ?? s.bodies.find(b => b.alive && b.rank === 'bailiff')?.home ?? Math.floor(s.cells.length / 2);
  const held = (i: number): boolean => (at.get(i)?.length ?? 0) > 0 || ranked.has(i) || i === seat || !!s.cells[i]!.works || !!s.cells[i]!.shrine;
  const ring = (i: number): number => { const [x, y] = xy(i); return Math.min(x, y, N - 1 - x, N - 1 - y); };
  const wet = new Set<number>();
  for (let i = 0; i < s.cells.length; i++) if (ring(i) === 0 && !held(i)) wet.add(i);
  for (let i = 0; i < s.cells.length; i++) if (ring(i) === 1 && !held(i) && highs[i]! <= q(0.12) && g.nbrs[i]!.some(j => wet.has(j))) wet.add(i);
  // Lakes: two or three of the lowest basins inland, where water gathers and finds no way out.
  const basins = s.cells.map((_x, i) => i).filter(i => ring(i) >= 2 && !held(i) && (lowOf[i] ?? 0) < 0).sort((a, b) => highs[a]! - highs[b]! || a - b);
  const inland = (basins.length >= 2 ? basins : s.cells.map((_x, i) => i).filter(i => ring(i) >= 2 && !held(i)).sort((a, b) => highs[a]! - highs[b]! || a - b)).slice(0, 3);
  for (const i of inland) wet.add(i);
  const water = (i: number): boolean => wet.has(i);
  // Shires: each place belongs to the nearest settled place within two steps; that place's lordship, if it has one.
  const shire = s.cells.map((_x, i) => { if (water(i)) return -2; let best = -1, bd = 9; for (const k of at.keys()) { const [kx, ky] = xy(k), [ix, iy] = xy(i), d = Math.max(Math.abs(kx - ix), Math.abs(ky - iy)); if (d <= 2 && (d < bd || (d === bd && k < best))) { bd = d; best = k; } } return best; });
  const washOf = (i: number): string => { const k = shire[i]!; if (k < 0) return ''; const L = lordAt(at, k); return WASH[(L >= 0 ? L : k) % WASH.length]!; };
  // Each place belongs to the lordship of the nearest settled place within two steps.
  const land = s.cells.map((_x, i) => { if (water(i)) return -2; let best = -1, bd = 9; for (const k of at.keys()) { const [kx, ky] = xy(k), [ix, iy] = xy(i), d = Math.max(Math.abs(kx - ix), Math.abs(ky - iy)); if (d <= 2 && (d < bd || (d === bd && k < best))) { bd = d; best = k; } } return best < 0 ? -1 : lordAt(at, best); });
  const sore = (i: number): boolean => !!c && (at.get(i) ?? []).some(b => (c.grief[b.id] ?? 0) >= P.aggrieved);
  const lensOf = (i: number): [number, string] => {
    const cell = s.cells[i]!, l = at.get(i) ?? [];
    if (lens === 'ecology') { const worn = Math.max(0, 1 - cell.soil / Math.max(0.01, cell.soil0)); return [Math.min(1, worn * 2.5 + Math.min(0.5, cell.flood * 2) + Math.min(0.3, cell.cleared / 200)), 'var(--good)']; }
    if (lens === 'sacred') return [Math.min(1, cell.sanctity + (cell.shrine ? 0.4 : 0) + (cell.interdict > 0 ? 0.6 : 0)), cell.interdict > 0 ? 'var(--seal)' : 'var(--gilt)'];
    if (lens === 'jurisdiction') { const L = land[i]!; return L < 0 ? [0, 'var(--soft)'] : [l.length ? 0.5 : 0.25, herald(L)]; }
    if (lens === 'factions') return [c ? l.filter(b => (c.grief[b.id] ?? 0) >= P.aggrieved).length / Math.max(1, l.length) : 0, 'var(--seal)'];
    if (!l.length) return [0, 'var(--soft)'];
    if (lens === 'want') return [l.filter(b => cover(b.store, askAhead(s, b)).some((x, k) => NEEDS[k]!.harm >= 0.5 && x < P.short)).length / l.length, 'var(--seal)'];
    return [c ? l.filter(b => (c.grief[b.id] ?? 0) >= P.aggrieved).length / l.length : 0, 'var(--seal)'];
  };
  const readings = s.cells.map((_cell, i) => lensOf(i));
  const householdLens = lens === 'want' || lens === 'factions';
  let figure: string, caption: string;
  if (householdLens) {
    let affected = 0;
    for (const [i, homes] of at) affected += Math.round(readings[i]![0] * homes.length);
    figure = String(affected);
    caption = `of ${hs.length} households`;
  } else if (lens === 'jurisdiction') {
    figure = String(new Set(land.filter(id => id >= 0)).size);
    caption = 'lordships in the realm';
  } else {
    const dry = readings.filter((_, i) => !water(i));
    figure = String(Math.round(100 * dry.reduce((sum, [value]) => sum + value, 0) / Math.max(1, dry.length)));
    caption = 'mean land index / 100';
  }
  const title = { want: 'Households in want', factions: 'Grievance', sacred: 'Sacred influence', ecology: 'Land stress', jurisdiction: 'Lordships' }[lens];
  swap('plate-title', `<h1>${title}</h1><div class="plate-stat"><b>${figure}</b><span>${caption}</span></div>`);
  const upland = q(.75), grove = St.findIndex(row => row.id === 'grove');
  const terrain: string[] = [];
  const regions = g.polys.map((poly, i) => {
    if (water(i)) return `<polygon data-cell="${i}" class="water${i === picked ? ' on' : ''}" points="${polyPath(poly)}"><title>${esc(cellWords(i))}</title></polygon>`;
    const points = polyPath(poly), cell = s.cells[i]!;
    const texture = cell.high >= upland ? 'upland' : cell.stock[grove]! >= St[grove]!.thin ? 'woodland' : '';
    if (texture) terrain.push(`<polygon points="${points}" fill="url(#${texture})"/>`);
    const [v, col] = readings[i]!;
    const missing = (lens === 'want' || lens === 'factions') && !at.has(i);
    const ink = MAP_INKS[v <= 0 ? 0 : v < .25 ? 1 : v < .5 ? 2 : 3];
    const fill = missing ? 'var(--unsettled)' : mapInk(col, lens === 'jurisdiction' && land[i]! >= 0 ? 60 : ink);
    return `<polygon data-cell="${i}" class="${i === picked ? 'on' : ''}" points="${points}" style="fill:${fill}"><title>${esc(cellWords(i))}</title></polygon>`;

  }).join('');
  // Jurisdictions: a lordship where there is one, otherwise the shire about a settled place. Their outer edges are inked.
  const realm = s.cells.map((_x, i) => { if (water(i)) return -2; const k = shire[i]!; if (k < 0) return -1; const L = lordAt(at, k); return L >= 0 ? 100000 + L : k; });
  const borders = edgesWhere(g, (i, j) => { const a = land[i]!, b = land[j]!; return a !== b && a !== -2 && b !== -2 && (a >= 0 || b >= 0); });
  void realm;
  // A land edge shared by two dry cells is inland. Each remaining edge faces water.
  const shore = new Map<string, string>();
  g.polys.forEach((poly, i) => {
    if (water(i)) return;
    const vertices = polyPath(poly).split(' ');
    vertices.forEach((start, k) => {
      const end = vertices[(k + 1) % vertices.length]!;
      if (start === end) return;
      const edge = start < end ? start + '|' + end : end + '|' + start;
      if (!shore.delete(edge)) shore.set(edge, `M${start}L${end}`);
    });
  });
  const tokens: string[] = [], labels: string[] = [];
  const labelSize = 11 * (N + 2 * PAD) / (mapBox().m * zoom);
  const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
  // Give the seat and the selected place first choice of label space.
  const priority = (i: number): number => i === picked ? 2 : i === seat ? 1 : 0;
  const places = g.pts.map((_, i) => i).sort((a, b) => priority(b) - priority(a) || readings[b]![0] - readings[a]![0]);
  places.forEach(i => {
    const [x, y] = g.pts[i]!;
    const named = ranked.has(i) || i === seat;
    if (water(i) || (!named && !at.has(i))) return;
    if (i === seat) tokens.push(`<circle class="seat-ring" cx="${x}" cy="${y}" r=".12"/>`);
    else if (named) tokens.push(`<rect x="${x - .075}" y="${y - .075}" width=".15" height=".15"/>`);
    else tokens.push(`<circle cx="${x}" cy="${y}" r=".06"/>`);
    if (named) {
      const name = titleCase(cellWords(i));
      const value = Math.round(readings[i]![0] * 100);
      const fig = lens === 'jurisdiction' ? microData(i, at) : (lens === 'want' || lens === 'factions') ? (at.has(i) ? value + '%' : '') : String(value);
      const width = labelSize * (.65 + Math.max(labelMeasure.measureText(name).width / 100, fig.length * .56));
      const height = labelSize * (fig ? 2.5 : 1.45);
      const left = Math.max(-PAD, Math.min(N + PAD - width, x - width / 2));
      const gap = .13 + .12 * labelSize;
      const top = y + gap + height <= N + PAD ? y + gap : y - gap - height;
      const right = left + width, bottom = top + height;
      if (occupied.some(box => left < box.right && right > box.left && top < box.bottom && bottom > box.top)) return;
      occupied.push({ left, right, top, bottom });
      labels.push(`<g transform="translate(${left} ${top})"><rect width="${width}" height="${height}"/>
        <text style="font-size:${labelSize}px" x="${width / 2}" y="${.22 * labelSize}">${esc(name)}${fig ? `<tspan class="fig" x="${width / 2}" dy="1.22em">${esc(fig)}</tspan>` : ''}</text></g>`);

    }
  });
  return `<div class="map-viewport"><div class="map" style="--map-zoom:${zoom};transform:translate(${panX}px,${panY}px) scale(${zoom})"><svg viewBox="${-PAD} ${-PAD} ${N + 2 * PAD} ${N + 2 * PAD}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <pattern id="upland" width=".17" height=".17" patternUnits="userSpaceOnUse">
        <path d="M.045 .12l.072-.078" stroke="#33474a" stroke-width=".014" stroke-linecap="round"/>
      </pattern>
      <pattern id="woodland" width=".18" height=".18" patternUnits="userSpaceOnUse">
        <circle cx=".045" cy=".045" r=".016"/><circle cx=".135" cy=".135" r=".016"/>
      </pattern>
    </defs>
    <g class="regions">${regions}</g>
    <g class="terrain" aria-hidden="true">${terrain.join('')}</g>
    <g class="borders"><path d="${borders}"/></g><path class="coast" d="${[...shore.values()].join('')}"/>
    <g class="tokens">${tokens.join('')}</g>
    <g class="labels">${labels.join('')}</g></svg></div></div>`;
}
/** The lens bar, and the key when asked for. */
function lensBar(): string {
  const lenses = (['want', 'factions', 'sacred', 'jurisdiction', 'ecology'] as const).map(k => `<button data-lens="${k}" aria-pressed="${lens === k}">${({ want: 'Want', factions: 'Factions', sacred: 'Sacred', jurisdiction: 'Lords', ecology: 'Land' })[k]}</button>`).join('');
  return `<nav class="lenstabs">${lenses}<span class="spacer"></span><button class="tlink" data-key="1" aria-pressed="${keyOpen}" aria-label="Map key">?</button><button class="tlink" data-reset="1">Fit</button></nav>${keyOpen ? `<p class="key small">${LEGEND[lens]} ${GLYPHS}</p>` : ''}`;
}
function sheet(): string {
  if (picked < 0 || view !== 'map') return '';
  const i = picked, cell = s.cells[i]!, c = s.court, l = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length && b.home === i);
  const iv = interventionAt(s, i), ivWords = ({ interdict: 'Lift interdict', shrine: 'Sanction shrine', stained: 'Penance', feud: 'King’s peace' } as Record<string, string>)[iv];
  const wait = (k: string): number => (c ? Math.max(0, 13 - (s.t - (c.seen[`local:${k}:${i}`] ?? -999))) : 0);
  const act = (attr: string, t: string, why: string): string => `<button class="alink" ${attr} ${why ? `disabled title="${esc(why)}"` : ''}>${t}${why ? `<small>${esc(why)}</small>` : ''}</button>`;
  const order = (k: LocalOrder, t: string, why = ''): string => { const w = wait(k); return act(`data-local="${k}"`, t, w > 0 ? `${w}w` : why); };
  const inWant = l.some(b => cover(b.store, askAhead(s, b)).some((x, k) => NEEDS[k]!.harm >= 0.5 && x < P.short));
  const dues = s.bonds.filter(bd => bd.about === 'yield' && bd.way === 'crown' && l.some(b => b.id === bd.a));
  const star = (key: string): string => `<button class="star" data-watch="${key}" aria-pressed="${watched.has(key)}" aria-label="${watched.has(key) ? 'Stop watching' : 'Watch'}">${watched.has(key) ? '★' : '☆'}</button>`;
  const souls = l.reduce((a, b) => a + b.members.filter(m => s.people[m]!.alive).length, 0), food = NEEDS.findIndex(n => n.harm >= 0.5);
  const weeks = l.length ? Math.min(...l.map(b => cover(b.store, askAhead(s, b))[food] ?? 0)) : -1;
  const lordB = l.map(b => top(s, b)).find(t => t.rank === 'lord' || t.rank === 'priest' || t.parts.length);
  const status = cell.interdict > 0 ? '<span class="bad">Interdict</span>' : c && l.some(b => (c.grief[b.id] ?? 0) >= P.aggrieved) ? '<span class="bad">Aggrieved</span>' : inWant ? '<span class="bad">In want</span>' : l.length ? 'Quiet' : 'Empty';
  const kpis = `<div class="pk"><span><b>${souls}</b> souls</span><span><b>${weeks < 0 ? '—' : weeks < 10 ? weeks.toFixed(1) + 'w' : Math.round(weeks) + 'w'}</b> food</span><span>${lordB ? esc(Cap(house(lordB.id)).replace(/ (of|at) [A-Z][a-z]+$/, '')) : 'Free'}</span><span>${status}</span></div>`;
  const live = c && mode === 'cockpit';
  return `<div class="sheet inspector"><div class="bar"><h3>${star(`c:${i}`)} ${esc(cellWords(i))}</h3><button class="x" data-cell="-1" aria-label="Close">✕</button></div>
    ${kpis}
    ${live ? `<div class="alinks">${order('relief', 'Relief', !l.length ? 'nobody' : inWant ? '' : 'no want')}${order('circuit', 'Bailiffs')}${order('charter', 'Remit', !dues.length ? 'no dues' : dues.every(bd => bd.easedTo > s.t) ? 'remitted' : '')}${order('intervene', ivWords ?? 'Intervene', iv ? '' : 'nothing amiss')}${act('data-seat="1"', 'Move seat', whyNotSeat(s, i).replace(/^Here now$/, 'here'))}</div>
      <div class="alinks build"><span class="label">Build</span>${WORKS.map(([k, name]) => act(`data-build="${k}"`, Cap(name.replace(/^(Endowed |Bailiff’s |Forest )/, '')), whyNotBuild(s, i, k).replace(/^Need (\d+) timber$/, '$1 timber').replace(/^Built$/, 'built'))).join('')}</div>` : ''}
    ${l.length ? `<ul class="houses">${l.map(b => `<li>${star(`b:${b.id}`)}<span>${esc(Cap(house(b.id)))}</span><span class="soft">${b.members.filter(m => s.people[m]!.alive).length}</span>${c && (c.grief[b.id] ?? 0) >= P.aggrieved ? '<span class="bad">aggrieved</span>' : ''}${live && (b.rank === 'lord' || b.rank === 'priest' || top(s, b).id !== b.id) ? `<button class="alink" data-power="${b.rank ? b.id : top(s, b).id}">${b.rank ? 'Deal' : 'Body'}</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${cell.works?.granary ? `<p class="small soft">Granary: ${Math.round(cell.works.granary.reduce((a, q) => a + q, 0))} grain.</p>` : ''}</div>`;
}
function chronicleView(): string {
  const homes = new Set<number>([...watched].filter(k => k.startsWith('b:')).map(k => s.bodies[Number(k.slice(2))]?.home ?? -1));
  const mine = (e: { cell: number; who: number[] }): boolean => watched.has(`c:${e.cell}`) || homes.has(e.cell) || e.who.some(w => watched.has(`b:${w}`));
  const ev = R.events.slice(-150).map(e => ({ t: e.t1, text: esc(named(e.text)), major: e.chain.length > 0 || e.size >= 3 || mine(e), why: e.chain[0], watch: mine(e), era: false }));
  const all = [...ev, ...feed.map(f => ({ ...f, why: '' as string | undefined, watch: false, era: false })), ...eras.map(e => ({ t: e.t, text: e.html, major: true, why: '' as string | undefined, watch: false, era: true }))]
    .filter(x => !majorOnly || x.major).sort((a, b) => b.t - a.t || Number(b.era) - Number(a.era)).slice(0, 80);
  return `<div class="pills"><button data-major="0" aria-pressed="${!majorOnly}">All</button><button data-major="1" aria-pressed="${majorOnly}">Major</button></div>
    <ul class="list chron">${all.map(x => `<li class="${x.era ? 'era' : x.watch ? 'watch' : x.major ? 'major' : ''}"><span class="label">Y${Math.floor(x.t / 52) + 1}·W${(x.t % 52) + 1}</span> ${x.text}${x.why ? `<div class="small soft">because ${esc(named(x.why))}</div>` : ''}</li>`).join('') || '<li class="soft">Nothing yet. Let time run.</li>'}</ul>`;
}

function lawsDeck(): string {
  const pol = s.court!.policy;
  return (Object.keys(LAW_WORDS) as LawKey[]).map(k => {
    const [name, opts] = LAW_WORDS[k], set = pol.lawSetAt[k] >= 0, warm = set && s.t - pol.lawSetAt[k] < 52;
    return `<div class="law row" title="${esc(LAW_HINT[k])}"><div class="lname"><strong>${name}</strong>${pol.inscribed[k] ? ' <span class="gilt" title="On the roll">◉</span>' : ''}${warm ? ' <span class="dot" title="Laid down within the year: changing it now is caprice"></span>' : ''}<span class="small soft">${!set ? 'not laid down' : k === 'forest' ? `${s.cells.filter((_x, i) => clearingBarred(s, i, -1)).length} places closed to clearing` : `${pol.lawHits[k]} settled`}</span></div>
      <div class="small soft hint">${esc(LAW_HINT[k])}</div>
      <div class="seg">${opts.map(([v, t]) => `<button data-law="${k}:${v}" aria-pressed="${set && pol.laws[k] === v}">${t}</button>`).join('')}</div></div>`;
  }).join('');
}
function treasuryDeck(): string {
  const d = s.court!.policy.dials as Record<string, any>, bud = s.court!.policy.dials.budget;
  const part = (k: 'relief' | 'reach' | 'legitimacy', name: string): string => `<div class="dial"><div><strong>${name}</strong></div><div class="step"><button data-budget="${k}:-10" ${bud[k] <= 0 ? 'disabled' : ''} aria-label="Less">−</button><span>${bud[k]}%</span><button data-budget="${k}:10" ${bud[k] >= 100 ? 'disabled' : ''} aria-label="More">+</button></div></div>`;
  const budget = `<div class="label">The season’s budget</div><div class="dial"><div><strong>Spend each season</strong><div class="small soft">A share of the store, divided below.</div></div><div class="step"><button data-spend="-1" ${bud.spend <= 0 ? 'disabled' : ''} aria-label="Less">−</button><span>${bud.spend}% of the store</span><button data-spend="1" ${bud.spend >= 10 ? 'disabled' : ''} aria-label="More">+</button></div></div>${part('relief', 'Relief for the neediest')}${part('reach', 'The bailiffs: reach')}${part('legitimacy', 'The parishes: legitimacy')}`;
  return budget + '<div class="label">Rates</div>' + DIALS.map(x => { const i = x.vals.indexOf(d[x.key]); return `<div class="dial"><div><strong>${x.name}</strong><div class="small soft">${x.hint}</div></div><div class="step"><button data-dial="${x.key}:-1" ${i <= 0 ? 'disabled' : ''} aria-label="Less">−</button><span>${x.show(d[x.key])}</span><button data-dial="${x.key}:1" ${i >= x.vals.length - 1 ? 'disabled' : ''} aria-label="More">+</button></div></div>`; }).join('');
}
function decreesDeck(): string {
  const pol = s.court!.policy;
  const can = (Object.keys(LAW_WORDS) as LawKey[]).filter(k => pol.lawSetAt[k] >= 0 && !pol.inscribed[k]);
  return ORDS.map(([k, name, hint]) => { const left = pol.ord[k]; return `<button class="ord" data-ord="${k}" ${left > 0 ? 'disabled' : ''}><strong>${name}</strong><span class="small soft">${left > 0 ? `${left}w left` : hint}</span>${left > 0 ? `<progress max="${ORD_WEEKS[k]}" value="${left}"></progress>` : ''}</button>`; }).join('')
    + `<div class="ord"><strong>Write a law on the roll</strong><span class="small soft">It gains you legitimacy; undoing it later is caprice of the worst kind.</span><div class="seg">${can.map(k => `<button data-inscribe="${k}">${LAW_WORDS[k][0]}</button>`).join('') || '<span class="small soft">Lay a law down first.</span>'}</div></div>`;
}

function worksDeck(): string {
  const c = s.court!, tk = timberKind(), have = Math.round(c.store[tk] ?? 0);
  const built = s.cells.map((cl, i) => [cl, i] as const).filter(([cl]) => cl.works && Object.values(cl.works).some(Boolean));
  return `<p class="small">You have <strong class="gilt">${have} timber</strong>. Tap a place on the map to build there.</p>`
    + WORKS.map(([k, name, g, hint]) => `<div class="dial"><div><strong>${g} ${name}</strong> <span class="small gilt">${P.workCost[k]} timber</span><div class="small soft">${hint}</div></div></div>`).join('')
    + `<div class="label">Built</div>${built.length ? `<ul class="list small">${built.map(([cl, i]) => `<li><button class="link" data-goto="${i}">${esc(cellWords(i))}</button>: ${WORKS.filter(([k]) => cl.works![k]).map(w => `${w[2]} ${w[1]}`).join(', ')}${cl.works!.granary ? ` <span class="soft">(${Math.round(cl.works!.granary.reduce((a, q) => a + q, 0))} grain)</span>` : ''}</li>`).join('')}</ul>` : '<p class="small soft">Nothing yet.</p>'}`;
}

/** A power, as the realm would name it. */
function powerName(id: number): string {
  const B = s.bodies[id]!;
  if (B.rank) return Cap(house(id));
  const n = underPower(s, B).length;
  return `A body of ${n} houses${B.head >= 0 ? `, led by ${house(B.head)}` : ''}`;
}
function powersDeck(): string {
  const c = s.court!, ps = c.policy.powers ?? {};
  const list = powersOf(s).map(B => [B, underPower(s, B)] as const).sort((a, b) => (b[0].id === focusPower ? 1 : 0) - (a[0].id === focusPower ? 1 : 0) || b[1].length - a[1].length || a[0].id - b[0].id);
  const act = (id: number, a: PowerAct, t: string): string => { const why = whyNotAct(s, id, a); return `<button data-act="${id}:${a}" ${why ? 'disabled' : ''}>${t}${why ? `<span class="why">${why}</span>` : ''}</button>`; };
  return `<p class="small soft">Lords, parishes and bodies of houses. What you grant them buys loyalty, and what you give a lord he may turn against you.</p>` + list.map(([B, under]) => {
    const p = ps[B.id] ?? {}, sore = under.filter(h => (c.grief[h.id] ?? 0) >= P.aggrieved).length + ((c.grief[B.id] ?? 0) >= P.aggrieved ? 1 : 0);
    const kind = B.rank === 'lord' ? 'lord' : B.rank === 'priest' ? 'parish' : 'body of houses';
    const flags = [p.warden !== undefined ? `<span class="${p.defiant ? 'bad' : 'gilt'}">${p.defiant ? 'Defiant warden' : 'Warden'}</span>` : '', (p.charter ?? -1) > s.t ? `<span class="gilt">Chartered, ${Math.ceil((p.charter! - s.t) / 52)}y left</span>` : '', (p.hostage ?? -1) > s.t ? `<span>Hostage held, ${p.hostage! - s.t}w</span>` : '', sore ? `<span class="bad">${sore} aggrieved</span>` : ''].filter(Boolean).join(' · ');
    const church = B.rank === 'priest' ? 'Back the parish against its lord' : B.rank === 'lord' ? 'Let him tax a shrine' : '';
    return `<div class="power${B.id === focusPower ? ' focus' : ''}"><div class="lname"><strong><button class="link" data-goto="${B.home}">${esc(powerName(B.id))}</button></strong><span class="small soft">${kind}, ${under.length === 1 ? 'one house' : `${under.length} houses`}</span></div>
      ${flags ? `<div class="small">${flags}</div>` : ''}
      ${p.warden !== undefined ? `<div class="small soft">Ambition</div><progress class="amb${p.defiant ? ' over' : ''}" max="1" value="${Math.min(1, p.ambition ?? 0)}"></progress>` : ''}
      <div class="orders">${B.rank === 'lord' ? (p.warden === undefined ? act(B.id, 'warden', 'Appoint warden') : act(B.id, 'revoke', 'Revoke the wardenship')) : ''}${(p.charter ?? -1) > s.t ? act(B.id, 'uncharter', 'Revoke the charter') : act(B.id, 'charter', 'Grant a charter')}${church ? act(B.id, 'church', church) : ''}${act(B.id, 'hostage', 'Demand a hostage')}</div></div>`;
  }).join('');
}

/** Small monochrome icons for the dock, drawn in 1.5px strokes. */
const icon = (d: string): string => `<svg class="ico" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">${d}</svg>`;
const ICON: Record<string, string> = {
  dials: icon('<path d="M2 4h10M2 10h10"/><circle cx="5" cy="4" r="1.6"/><circle cx="9" cy="10" r="1.6"/>'),
  laws: icon('<rect x="3" y="1.75" width="8" height="10.5" rx="1"/><path d="M5 5h4M5 7.5h4M5 10h2.5"/>'),
  works: icon('<path d="M2 12V6.5L7 2.5l5 4V12z"/><path d="M5.5 12V9h3v3"/>'),
  powers: icon('<path d="M2 11.5h10M2.5 11.5 2 5l3 2.5L7 3l2 4.5L12 5l-.5 6.5"/>'),
  chronicle: icon('<path d="M2 3h10M2 6h10M2 9h10M2 12h6"/>'),
};
function shell(): void {
  const live = mode === 'cockpit';
  document.body.classList.add('cockpit-on');
  if (!live) deck = 'chronicle';
  const tabs = live ? (['dials', 'laws', 'works', 'powers', 'chronicle'] as const) : (['chronicle'] as const);
  app.innerHTML = `<div class="cockpit full"><header id="plate-title"></header><main class="view map-host" id="view"></main>
    <div class="hud-top"><details class="court-controls"><summary>Court &amp; time</summary><div id="strip"></div></details><div id="lensbar"></div></div>
    <div id="sheet"></div>
    <div id="legend"></div>
    <footer class="dock"><div class="half" id="deck"></div><nav class="tabs">${tabs.map(d => `<button data-deck="${d}" aria-pressed="${dockOpen && deck === d}">${ICON[d]}<span>${({ dials: 'Dials', laws: 'Laws', works: 'Works', powers: 'Powers', chronicle: 'Chronicle' })[d]}</span></button>`).join('')}</nav></footer></div>`;
  zoom = 1; panX = 0; panY = 0;
  paint(true);
}
const swap = (id: string, html: string): void => { const el = document.getElementById(id); if (el && el.dataset.h !== html) { const top = el.scrollTop; el.innerHTML = html; el.dataset.h = html; el.scrollTop = top; } };
function paint(force = false): void {
  const cockpit = document.querySelector<HTMLElement>('.cockpit.full');
  if (cockpit) cockpit.dataset.season = seasonOf(s.t);
  if (force) for (const id of ['strip', 'view', 'deck', 'sheet', 'lensbar', 'legend']) { const el = document.getElementById(id); if (el) el.dataset.h = ''; }
  document.querySelectorAll<HTMLButtonElement>('[data-deck]').forEach(b => b.setAttribute('aria-pressed', String(dockOpen && b.dataset.deck === deck)));
  document.querySelector('.dock')?.classList.toggle('open', dockOpen);
  swap('strip', strip());
  swap('lensbar', lensBar());
  swap('legend', dockOpen || picked >= 0 ? '' : legend());
  const defiant = Object.values(s.court?.policy.powers ?? {}).some(p => p.defiant);
  document.querySelector('[data-deck="powers"]')?.classList.toggle('alert', defiant);
  if (!gesturing) swap('view', mapView());
  swap('sheet', dockOpen ? '' : sheet());
  swap('deck', !dockOpen ? '' : deck === 'chronicle' ? chronicleView() : !s.court ? '' : deck === 'dials' ? treasuryDeck() + '<div class="label">Decrees</div>' + decreesDeck() : deck === 'laws' ? lawsDeck() : deck === 'works' ? worksDeck() : powersDeck());
}

/** One week of the living realm: the court's reckoning, the realm lives, and the next week's matters are settled below by the laws. */
function tickWeek(): void {
  const c = s.court;
  if (c) {
    const weak = c.policy.weak;
    hear(s, []);
    if (s.log.some(r => r.k === 'withdraw' && (r.q ?? 0) > 0)) feed.push({ t: s.t, text: '<span class="bad">A faction withdrew its confidence: your reach falls.</span>', major: true });
    if (!weak && c.policy.weak) feed.push({ t: s.t, text: '<span class="bad">The Crown has lost its hold. Your laws go unheeded and the bailiffs send nothing up, until you are trusted and obeyed again.</span>', major: true });
    if (weak && !c.policy.weak) feed.push({ t: s.t, text: '<span class="good">The Crown has its hold again.</span>', major: true });
  }
  advance(s, true);
  R.read(s);
  for (const r of s.log) {
    if (r.k === 'die' && r.need >= 0) eraStats.hunger++;
    else if (r.k === 'withdraw' && (r.q ?? 0) > 0) eraStats.withdrawals++;
    else if (r.k === 'shrine') eraStats.shrines++;
    else if (r.k === 'decay' && r.q2 === 1 && r.a < 0) eraStats.floods++;
    else if (r.k === 'defy') eraStats.defied++;
  }
  s.log = [];
  if (s.t - eraFrom >= 520) closeEra();
  if (c) hist.push({ t: s.t, legitimacy: c.legitimacy, reach: c.reach, store: storeTotal() });
  if (hist.length > 60) hist = hist.slice(-53);
  if (s.t % 13 === 0) save();
  if (c) {
    audience(s);
    const byLaw = s.log.filter(r => r.k === 'rule' && r.kind2 === 1 && r.q2 === -3).length, byLord = s.log.filter(r => r.k === 'rule' && r.kind2 === 1 && r.q2 === -6).length;
    if (byLaw + byLord) feed.push({ t: s.t, text: `<span class="soft">Settled below: ${[byLaw ? `${byLaw} by your laws` : '', byLord ? `${byLord} by the lords and bodies` : ''].filter(Boolean).join(', ')}.</span>`, major: false });
  }
  if (feed.length > 400) feed = feed.slice(-300);
}
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
/** Close a decade: what it was, in a line, and a name the chroniclers would give it. */
function closeEra(): void {
  const hs = s.bodies.filter(b => b.alive && !b.parts.length && b.members.length), pop = s.people.filter(p => p.alive).length, st = eraStats, was = st.pop || pop;
  const name = st.hunger > was * 0.1 ? 'the Hungry Years' : pop < was * 0.85 ? 'the Thinning' : st.withdrawals >= 3 ? 'the Years of Faction' : st.shrines >= 2 ? 'the Years of Signs' : st.floods >= 6 ? 'the Wet Years' : st.defied >= 5 ? 'the Years of Broken Taboos' : pop > was * 1.15 ? 'the Fat Years' : 'the Quiet Years';
  const lords = s.bodies.filter(b => b.alive && b.rank === 'lord').map(b => [b, hs.filter(h => top(s, h).id === top(s, b).id).length] as const).sort((a, b) => b[1] - a[1])[0];
  const priests = s.bodies.filter(b => b.alive && b.rank === 'priest').map(b => [b, s.bonds.filter(x => x.about === 'yield' && x.way === 'tithe' && x.b === b.id).length] as const).sort((a, b) => b[1] - a[1])[0];
  const pol = s.court?.policy, roll = pol ? (Object.keys(LAW_WORDS) as LawKey[]).filter(k => pol.inscribed[k]).map(k => LAW_WORDS[k][0]) : [];
  const bits = [`souls ${was} → ${pop}`, lords ? `the greatest lord ${esc(house(lords[0].id))}` : '', priests && priests[1] ? `the largest parish ${esc(house(priests[0].id))}'s, ${priests[1]} houses` : '', roll.length ? `on the roll: ${roll.join(', ')}` : '', st.hunger ? `${st.hunger} dead of want` : ''].filter(Boolean);
  eras.push({ t: s.t, html: `<strong>The ${ORDINAL[eras.length] ?? `${eras.length + 1}th`} decade, ${name}.</strong> <span class="small">${bits.join('; ')}.</span>` });
  eraFrom = s.t; eraStats = { pop, hunger: 0, withdrawals: 0, shrines: 0, floods: 0, defied: 0 };
}

// --- Keeping a realm between visits ---
const SAVE = 'vicarius-regis-realm';
function save(): void {
  if (!s || mode === 'regency' || !document.getElementById('view')) return;
  try { localStorage.setItem(SAVE, JSON.stringify({ v: 2, mode, s, events: R.events.slice(-300), feed: feed.slice(-200), hist, eras, eraFrom, eraStats, watched: [...watched], lens, deck })); } catch { /* full or blocked: the realm simply is not kept */ }
}
function saved(): { mode: Mode; t: number; seed: number; souls: number } | null {
  try { const raw = localStorage.getItem(SAVE); if (!raw) return null; const j = JSON.parse(raw); return { mode: j.mode, t: j.s.t, seed: j.s.seed, souls: j.s.people.filter((p: { alive: boolean }) => p.alive).length }; } catch { return null; }
}
function resume(): void {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE)!);
    s = j.s; R = new Readers();
    // A realm kept under the old laws keeps its works and its history, but its laws begin again.
    if (s.court && !('forest' in s.court.policy.laws)) Object.assign(s.court.policy, freshLaws());
    if (s.court && !('grainShare' in s.court.policy.dials)) { const old = s.court.policy.dials as Partial<Dials>; s.court.policy.dials = { ...freshDials(), ...(old.relief ? { relief: old.relief } : {}), ...(old.bailiff ? { bailiff: old.bailiff } : {}) }; levies(s); }
    if (s.court && s.court.seat === undefined) s.court.seat = s.bodies.find(b => b.alive && b.rank === 'bailiff')?.home ?? Math.floor(s.cells.length / 2); R.events = j.events ?? []; mode = j.mode; feed = j.feed ?? []; hist = j.hist ?? []; eras = j.eras ?? []; eraFrom = j.eraFrom ?? 0; eraStats = j.eraStats ?? eraStats;
    watched.clear(); for (const w of j.watched ?? []) watched.add(w);
    lens = j.lens ?? 'want'; deck = (['dials', 'laws', 'works', 'powers', 'chronicle'].includes(j.deck) ? j.deck : 'laws'); dockOpen = false;
    over = ''; speed = 0; picked = -1; view = 'map'; openGauge = ''; zoom = 1; panX = 0; panY = 0;
    shell();
  } catch { welcome(); }
}
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

function frame(now: number): void {
  if (s && mode !== 'regency' && document.getElementById('view')) {
    const dt = Math.min(0.25, (now - (lastFrame || now)) / 1000);
    acc = Math.min(3, acc + dt * RATE[speed]);
    const t0 = performance.now();
    while (acc >= 1 && speed > 0 && performance.now() - t0 < 14) { acc -= 1; tickWeek(); dirty = true; }
    if (speed === 0) acc = 0;
    if (dirty && now - lastPaint > 250) { paint(); dirty = false; lastPaint = now; }
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Zooming the map, and only the map ---
// iOS Safari ignores user-scalable=no, so pinches outside the map are stopped here; on the map, two fingers zoom and one pans.
for (const g of ['gesturestart', 'gesturechange']) document.addEventListener(g, e => { if (!(e.target as HTMLElement)?.closest?.('.map-viewport')) e.preventDefault(); }, { passive: false });
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, zoom0 = 1, pan0 = { x: 0, y: 0 }, start0 = { x: 0, y: 0 }, moved = false;
/** The map is a square as wide as the screen's narrower side; at the zoom that fills the screen, panning reaches its edges. */
const mapBox = (): { w: number; h: number; m: number } => { const vp = document.querySelector('.map-host') as HTMLElement | null; const w = vp?.clientWidth ?? 390, h = vp?.clientHeight ?? 800; return { w, h, m: Math.min(w, h) }; };
const clampPan = (): void => { const { w, h, m } = mapBox(), mx = Math.max(0, (m * zoom - w) / 2 + 24), my = Math.max(0, (m * zoom - h) / 2 + 120); panX = Math.max(-mx, Math.min(mx, panX)); panY = Math.max(-my, Math.min(my, panY)); };
const applyZoom = (): void => { const m = document.querySelector('.map') as HTMLElement | null; if (m) { m.style.setProperty('--map-zoom', String(zoom)); m.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`; } };
app.addEventListener('pointerdown', e => {
  if (!(e.target as HTMLElement).closest('.map-viewport')) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  gesturing = true; moved = false;
  const pts = [...ptrs.values()];
  if (pts.length === 2) { pinch0 = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y); zoom0 = zoom; }
  pan0 = { x: panX, y: panY }; start0 = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...ptrs.values()];
  if (pts.length >= 2 && pinch0 > 0) { zoom = Math.max(1, Math.min(3.5, (zoom0 * Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)) / pinch0)); moved = true; }
  else if (pts.length === 1) { const dx = e.clientX - start0.x, dy = e.clientY - start0.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; panX = pan0.x + dx; panY = pan0.y + dy; }
  clampPan(); applyZoom();
});
const lift = (e: PointerEvent): void => {
  if (!ptrs.delete(e.pointerId)) return;
  if (ptrs.size < 2) pinch0 = 0;
  if (ptrs.size === 1) { const p = [...ptrs.values()][0]!; start0 = { x: p.x, y: p.y }; pan0 = { x: panX, y: panY }; }
  if (!ptrs.size) { gesturing = false; setTimeout(() => { moved = false; paint(); }, 0); }
};
window.addEventListener('pointerup', lift); window.addEventListener('pointercancel', lift);
// A drag or a pinch that ends on a place is not a tap on it.
app.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (moved && t.closest('.map-viewport')) { e.stopImmediatePropagation(); e.preventDefault(); return; }
  // A tap on a place picks it; with the dock up, it lowers the dock as well.
  const poly = t.closest?.('polygon[data-cell]') as SVGElement | null;
  if (poly) { e.stopImmediatePropagation(); dockOpen = false; picked = Number(poly.dataset.cell); paint(); return; }
}, true);

function cockpitClick(b: HTMLButtonElement): boolean {
  const c = s?.court;
  if (b.dataset.speed !== undefined) { speed = Number(b.dataset.speed) as typeof speed; paint(); return true; }
  if (b.dataset.gauge !== undefined) { openGauge = openGauge === b.dataset.gauge ? '' : (b.dataset.gauge as typeof openGauge); paint(); return true; }
  if (b.dataset.home) { save(); speed = 0; welcome(); return true; }
  if (b.dataset.watch) { const k = b.dataset.watch; if (watched.has(k)) watched.delete(k); else watched.add(k); paint(); return true; }
    if (b.dataset.deck) { const d = b.dataset.deck as typeof deck; dockOpen = !(dockOpen && deck === d); deck = d; paint(); return true; }
  if (b.dataset.key) { keyOpen = !keyOpen; paint(); return true; }
  if (b.dataset.lens) { lens = b.dataset.lens as Lens; paint(); return true; }
  if (b.dataset.reset) { zoom = 1; panX = 0; panY = 0; applyZoom(); paint(); return true; }
  if (b.dataset.cell !== undefined) { picked = Number(b.dataset.cell); paint(); return true; }
  if (b.dataset.power !== undefined) { focusPower = Number(b.dataset.power); deck = 'powers'; dockOpen = true; paint(); document.getElementById('deck')?.scrollTo(0, 0); return true; }
  if (b.dataset.act) {
    const [id, a] = b.dataset.act.split(':') as [string, PowerAct];
    const leg0 = c?.legitimacy ?? 0, reach0 = c?.reach ?? 0;
    if (actOn(s, Number(id), a)) {
      doFlash({ ...(c!.legitimacy > leg0 ? { legitimacy: 'good' as const } : c!.legitimacy < leg0 ? { legitimacy: 'bad' as const } : {}), ...(c!.reach > reach0 ? { reach: 'good' as const } : c!.reach < reach0 ? { reach: 'bad' as const } : {}) });
      feed.push({ t: s.t, text: `You dealt with ${esc(powerName(Number(id)))}: <strong>${esc(b.textContent?.replace(/\d+w left.*/, '') ?? a)}</strong>.`, major: true });
    }
    paint(); return true;
  }
  if (b.dataset.goto !== undefined) { picked = Number(b.dataset.goto); dockOpen = false; paint(); return true; }
  if (b.dataset.major !== undefined) { majorOnly = b.dataset.major === '1'; paint(); return true; }
  if (!c) return false;
  if (b.dataset.law) { const [k, v] = b.dataset.law.split(':') as [LawKey, string]; const leg0 = c.legitimacy; setLaw(s, k, v as never); if (c.legitimacy < leg0) doFlash({ legitimacy: 'bad' }); feed.push({ t: s.t, text: `You laid down the law: <strong>${LAW_WORDS[k][0]}: ${LAW_WORDS[k][1].find(x => x[0] === v)![1]}</strong>.`, major: true }); paint(); return true; }
  if (b.dataset.dial) { const [k, d] = b.dataset.dial.split(':') as [keyof Dials, string]; const x = DIALS.find(y => y.key === k)!, i = x.vals.indexOf((c.policy.dials as any)[k]) + Number(d); if (i >= 0 && i < x.vals.length) { setDial(s, k, x.vals[i] as never); doFlash(k === 'tithe' ? { store: 'good', legitimacy: 'bad' } : k === 'grainShare' || k === 'timberShare' || k === 'toll' ? { store: Number(d) > 0 ? 'good' : 'warn' } : k === 'relief' ? { store: 'warn' } : k === 'bailiff' ? (x.vals[i] === 'strict' ? { store: 'good', reach: 'bad' } : {}) : {}); } paint(); return true; }
  if (b.dataset.spend) { const bud = c.policy.dials.budget, vals = [0, 5, 10] as const, i = vals.indexOf(bud.spend) + Number(b.dataset.spend); if (i >= 0 && i < 3) { bud.spend = vals[i]!; doFlash({ store: 'warn' }); } paint(); return true; }
  if (b.dataset.budget) {
    // Moving one share moves the largest of the others the other way, so the three always come to a hundred.
    const [k, d] = b.dataset.budget.split(':') as ['relief' | 'reach' | 'legitimacy', string], bud = c.policy.dials.budget, step = Number(d);
    const others = (['relief', 'reach', 'legitimacy'] as const).filter(x => x !== k).sort((x, y) => (step > 0 ? bud[y] - bud[x] : bud[x] - bud[y]));
    const o = others.find(x => (step > 0 ? bud[x] >= step : bud[x] + -step <= 100));
    if (o && bud[k] + step >= 0 && bud[k] + step <= 100) { bud[k] += step; bud[o] -= step; }
    paint(); return true;
  }
  if (b.dataset.seat !== undefined && picked >= 0) { if (moveSeat(s, picked)) { doFlash({ store: 'warn', legitimacy: 'good' }); feed.push({ t: s.t, text: `You held court at ${esc(cellWords(picked))}: a royal progress.`, major: true }); } paint(); return true; }
  if (b.dataset.ord) { const k = b.dataset.ord as OrdKey; if (issueOrdinance(s, k)) doFlash(({ stay: { legitimacy: 'good' }, granaries: { store: 'warn' }, eyre: { store: 'warn', legitimacy: 'good', reach: 'good' }, penance: { legitimacy: 'good' } } as Record<OrdKey, typeof flash>)[k]);
    if (c.policy.ord[k] === ORD_WEEKS[k]) feed.push({ t: s.t, text: `You decreed: <strong>${ORDS.find(o => o[0] === k)![1]}</strong>.`, major: true }); paint(); return true; }
  if (b.dataset.inscribe) { const k = b.dataset.inscribe as LawKey; if (inscribeLaw(s, k)) { doFlash({ legitimacy: 'good' }); } if (c.policy.inscribed[k] && c.policy.lawSetAt[k] >= 0) feed.push({ t: s.t, text: `You wrote the law on the roll: <strong>${LAW_WORDS[k][0]}</strong>.`, major: true }); paint(); return true; }
  if (b.dataset.build && picked >= 0) {
    const k = b.dataset.build as WorkKey, w = WORKS.find(x => x[0] === k)!;
    if (build(s, picked, k)) { doFlash({ store: 'warn', ...(k === 'post' ? { reach: 'good' } : k === 'chapel' ? { legitimacy: 'good' } : {}) }); feed.push({ t: s.t, text: `You built ${w[2]} <strong>${w[1].toLowerCase()}</strong> at ${esc(cellWords(picked))}.`, major: true }); }
    paint(); return true;
  }
  if (b.dataset.local && picked >= 0) {
    const k = b.dataset.local as LocalOrder, what = b.textContent?.replace(/\s*\(\d+w\)/, '') ?? k;
    const ok = localOrder(s, picked, k);
    if (ok) doFlash(({ relief: { store: 'warn' }, circuit: { reach: 'good', store: 'good' }, charter: { store: 'warn', legitimacy: 'good' }, intervene: { legitimacy: 'good' } } as Record<LocalOrder, typeof flash>)[k]);
    feed.push({ t: s.t, text: ok ? `You ordered at ${esc(cellWords(picked))}: <strong>${esc(what)}</strong>.` : `<span class="soft">Your order at ${esc(cellWords(picked))} came to nothing.</span>`, major: true });
    paint(); return true;
  }
  return false;
}

// --- Beginning ---

function start(seed: number, side: number, souls: number, years: number): void {
  s = found(seed, -years * 52, side, souls);
  R = new Readers();
  over = ''; lastWeek = []; tab = 'week'; chosen.clear(); seated = []; zoom = 1; panX = 0; panY = 0;
  const total = years * 52;
  const tick = (): void => {
    const t0 = performance.now();
    while (s.t < 0 && performance.now() - t0 < 60) { advance(s); for (const r of s.log) if (r.k !== 'make') R.index.set(r.id, r); }
    if (s.t < 0) {
      app.innerHTML = `<div class="wrap"><section class="start"><h1>The realm before you</h1><p>The realm is living through the ${years} years before your coming: ${s.people.filter(p => p.alive).length} souls, year ${Math.floor((total + s.t) / 52) + 1} of ${years}.</p><progress id="past" max="${total}" value="${total + s.t}"></progress></section></div>`;
      setTimeout(tick, 0);
      return;
    }
    if (mode === 'regency') { document.body.classList.remove('cockpit-on'); openCourt(s); openWeek(); render(); return; }
    if (mode === 'cockpit') { openCourt(s, 'cockpit'); audience(s); s.log = []; }
    speed = 0; feed = []; picked = -1; view = 'map'; deck = 'laws'; dockOpen = false; hist = []; eras = []; eraFrom = s.t; openGauge = ''; watched.clear();
    eraStats = { pop: s.people.filter(p => p.alive).length, hunger: 0, withdrawals: 0, shrines: 0, floods: 0, defied: 0 };
    shell(); save();
  };
  tick();
}

function welcome(): void {
  document.body.classList.remove('cockpit-on'); speed = 0;
  const modes = [['cockpit', 'The Cockpit', 'Govern from above: laws, treasury, works and powers, while time runs on.'], ['chronicle', 'The Chronicle', 'Watch the realm live for decades, with no court and no Crown.'], ['regency', 'The Regency', 'Three years in the king’s court, hearing petitioners week by week.']] as const;
  app.innerHTML = `<div class="wrap landing">
    <header class="masthead"><h1>Vicarius Regis</h1><p>A living medieval realm, kept in the king’s name.</p></header>
    ${(() => { const k = saved(); return k ? `<button class="moderow resume" id="resume"><span><strong>Resume your realm</strong><small>${k.mode === 'cockpit' ? 'The Cockpit' : 'The Chronicle'} · year ${Math.floor(k.t / 52) + 1} · ${k.souls} souls</small></span><i>→</i></button>` : ''; })()}
    <div class="moderows">${modes.map(([k, t, d]) => `<button class="moderow" data-mode="${k}" aria-pressed="${mode === k}"><span><strong>${t}</strong><small>${d}</small></span><i>→</i></button>`).join('')}</div>
    <div class="seedrow"><label class="label" for="seed">Seed</label><input id="seed" type="number" min="1" value="${1 + Math.floor(Math.random() * 999)}"><button class="go" id="small">Small realm</button><button id="full">Full realm</button></div>
    <p class="small soft">Small: about 200 souls, ready in seconds. Full: about 900, a minute to found. Nothing in the realm is scripted.</p>
  </div>`;
}

app.addEventListener('click', ev => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const seedOf = (): number => Math.max(1, Number((document.getElementById('seed') as HTMLInputElement | null)?.value) || 1);
  if (b.id === 'small') return start(seedOf(), P.side, P.souls, 6);
  if (b.id === 'full') return start(seedOf(), P.realmSide, P.realmSouls, 6);
  if (b.id === 'again') return welcome();
  if (b.id === 'resume') return resume();
  if (b.dataset.mode) { mode = b.dataset.mode as Mode; document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.mode === mode))); return; }
  if (mode !== 'regency' && s && document.getElementById('view') && cockpitClick(b as HTMLButtonElement)) return;
  if (b.id === 'pass') { passWeek(); render(); window.scrollTo(0, 0); return; }
  if (b.dataset.tab) { tab = b.dataset.tab as typeof tab; render(); return; }
  if (b.dataset.cut) {
    const at = b.dataset.cut.indexOf(':'), id = b.dataset.cut.slice(0, at), cut = b.dataset.cut.slice(at + 1), pid = Number(id), had = chosen.get(pid);
    if (had?.cut === cut) chosen.delete(pid);
    else if (had || chosen.size <= capOf()) chosen.set(pid, { cut: cut!, width: had?.width ?? 'case' });
    if (mode !== 'regency' && document.getElementById('view')) paint(); else render();
    return;
  }
  if (b.dataset.width) { const [id, w] = b.dataset.width.split(':'), had = chosen.get(Number(id)); if (had) { had.width = w as Width; if (mode !== 'regency' && document.getElementById('view')) paint(); else render(); } }
});


welcome();
