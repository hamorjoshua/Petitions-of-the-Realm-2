// The screen. A reader and a player's hands: it shows what the court knows and passes rulings to it.
// It changes the realm only through `hear` and `advance`.

import { found } from '../sim/found.ts';
import { advance } from '../sim/step.ts';
import { audience, cuts, hear, judgeOf, localPower, openCourt, planesOf, suretyFor, type Plane, type Ruling, type Width } from '../sim/court/court.ts';
import { askAhead, cover } from '../sim/value.ts';
import { KINDS, NEEDS, P, RECIPES } from '../sim/tables.ts';
import { grown, top } from '../sim/util.ts';
import { Readers, wayWords } from '../readers/readers.ts';
import { placeName } from '../readers/names.ts';
import type { Bond, Petition, State } from '../sim/types.ts';

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
  if (h >= 0 && b.rank === 'lord') return `Lord ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'priest') return `Father ${nameOf(h)} of ${cellWords(b.home)}`;
  if (h >= 0 && b.rank === 'bailiff') return `${nameOf(h)}, the king’s bailiff at ${cellWords(b.home)}`;
  return h < 0 ? `house ${id}` : `${nameOf(h)}’s house`;
}
/** Who they are: the speaker, and who is in the house. */
function who(id: number): string {
  const b = s.bodies[id]!, h = speaker(id);
  if (h < 0) return '';
  const p = s.people[h]!, alive = b.members.map(i => s.people[i]!).filter(x => x.alive), young = alive.filter(x => (s.t - x.born) / 52 < 14).length;
  const lone = p.spouse < 0 && young > 0 ? (p.sex ? 'a widow' : 'a widower') : p.spouse < 0 && alive.length === 1 ? 'alone' : '';
  return `${nameOf(h)} of ${cellWords(b.home)}, ${ageOf(h)}${lone ? ', ' + lone : ''}, with ${alive.length} in the house${young ? ` (${young} of them children)` : ''}`;
}
const owedWords = (bd: Bond): string => (bd.labour ? `${Math.round(bd.q)} days of work` : `${bd.q < 10 ? bd.q.toFixed(1) : Math.round(bd.q)} of ${KINDS[bd.kind]?.id ?? 'goods'}`);
const Cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);

/** A line from the record, with houses called by name. */
const named = (x: string): string => x.replace(/house (\d+)/g, (_m, n: string) => house(Number(n))).replace(/\((\d+), ?(\d+)\)/g, (_m, cx: string, cy: string) => placeName(s, Number(cy) * s.side + Number(cx)));

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
  if (p.side === 'heresy') return `${A} says ${B} holds a creed apart from its own and leads others into it. ${Cap(B)} is devout, and neither poor nor in want.`;
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
  const mouths = (id: number): number => s.bodies[id]!.members.filter(i => s.people[i]!.alive).length;
  const pb = s.bonds.find(b => b.id === p.bond);
  if (p.side === 'mortmain') return ['“A dead man’s piety has left his kin with nothing.”', '“It was given to God. What is given to God is not taken back.”'];
  if (p.side === 'sanctuary') return ['“They owe us, and they hide behind the altar.”', '“We are on holy ground. Touch us here and answer for it.”'];
  if (p.side === 'shrine') return ['“It is idolatry, and it takes the offerings that are owed to us.”', '“The water stopped at that stone. Everyone saw it.”'];
  if (p.side === 'unclean') return ['“A man in sin cannot make bread holy. We will not have it from his hand.”', '“The office is holy, not the man. The rites stand.”'];
  if (p.side === 'heresy') return ['“They lead people from the true way.”', '“We keep the faith more strictly than they do.”'];
  if (p.side === 'heir') return ['“My grandfather ploughed that ground. It was ours before it was theirs.”', '“It came to us fairly. What was lost is lost.”'];
  if (p.side === 'appeal') return ['“The custom is older than any of us. He had no right to break it for the house.”', ''];
  if (p.side === 'harmed') return ['“Before they stripped the hill, the water never came this high.”', '“It was our own ground, and wood is wanted. We did nothing wrong.”'];
  if (p.side === 'unaided') return ['“We would have done as much for them. It is what our fellows have always done.”', '“We have our own to think of.”'];
  if (p.side === 'exceeds') return ['“Two days was the custom in our fathers’ time. Now he takes four, and our own corn rots.”', '“The harvest will not wait. They hold of me, and they will work when I need them.”'];
  if (p.side === 'exit') return ['“There is better ground elsewhere, and none of it owes him a fifth.”', '“They are bound to this land as their fathers were.”'];
  if (p.side === 'suspects') return ['“They gather as much as their neighbours and pay a third as much.”', '“It was a poor year. Look in our barns if you doubt it.”'];
  if (p.side === 'asks' && p.body !== undefined) return ['“We are stronger and have more to spare. Let us lead.”', '“We have led well. Why should that change?”'];
  if (pb && pb.about === 'act' && pb.denied) return ['“We agreed it, the two of us. There was nobody else by.”', '“We never agreed any such thing.”'];
  if (p.side === 'asks') return ['“We have worked it longest and best. Let it be ours.”', p.against >= 0 ? '“We have done that work there as long as anyone. Must we pay them for it now?”' : ''];
  if (p.side === 'fears') return ['“Nothing has gone right since the harm there. Whoever works that ground brings it on us all.”', p.against >= 0 ? `“It is good ground, and we have ${mouths(p.against)} mouths to feed.”` : ''];
  if (pb && pb.about === 'right') return ['“We have always done that work there. Now we must pay them for it.”', holderSays(pb)];
  const ask = p.need >= 0 ? `“We are ${mouths(p.by)} mouths with ${weeks(p.by, p.need) < 10 ? weeks(p.by, p.need).toFixed(1) : Math.round(weeks(p.by, p.need))} weeks of ${NEEDS[p.need]!.id}.”` : '“We ask only what is ours.”';
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
  } else if (bd.about === 'act') ans = p.side === 'owed' ? (pressed(p.against) ? `“We have ${mouths(p.against)} mouths and little laid by. Take it and we starve.”` : '“We will pay when the corn is in.”') : pressed(p.against) ? '“We need it ourselves.”' : '“A debt is a debt.”';
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
  if (cut.startsWith('remit')) { const lp = judgeOf(s, cut.startsWith('remit:') ? Number(cut.slice(6)) : localPower(s, p)), L = lp >= 0 ? house(lp) : 'the local lord'; return [`Leave it to ${L}`, lp === p.by || lp === p.against ? `${Cap(L)} is a party, and will judge for itself. The loser blames them, not you.` : 'They will judge for whoever is stronger. The loser blames them, not you.']; }
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
    ${(() => { const [a, b] = pleas(p); if (!p.burdens.length) return `<p>${esc(Cap(house(p.by)))}: ${a}</p>${b ? `<p>${esc(Cap(house(p.against)))}: ${b}</p>` : ''}`; return `<p>${esc(Cap(house(p.by)))}: ${a}</p>` + p.burdens.map(id => s.bonds.find(x => x.id === id)).filter((x): x is Bond => !!x).map(x => `<p>${esc(Cap(house(x.a === p.by ? x.b : x.a)))}: ${holderSays(x)}</p>`).join(''); })()}
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
  return `<section><h2>The rolls</h2><div class="tbl"><table><thead><tr><th>Rule</th><th>Binds</th><th>Made</th><th>Settled below</th></tr></thead><tbody>${c.rules.slice().sort((a, b) => b.uses - a.uses).map(r => `<tr><td><strong>${esc(CUT[r.cut] ?? cap(r.cut))}</strong> when ${esc(plain(r.shape))}</td><td>${r.scope === -1 ? 'the realm' : 'body ' + r.scope}</td><td>week ${r.since + 1}</td><td>${r.uses}</td></tr>`).join('')}</tbody></table></div></section>`;
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

// --- Beginning ---

function start(seed: number, side: number, souls: number, years: number): void {
  s = found(seed, -years * 52, side, souls);
  R = new Readers();
  over = ''; lastWeek = []; tab = 'week';
  const total = years * 52;
  const tick = (): void => {
    const t0 = performance.now();
    while (s.t < 0 && performance.now() - t0 < 60) { advance(s); for (const r of s.log) if (r.k !== 'make') R.index.set(r.id, r); }
    if (s.t < 0) {
      app.innerHTML = `<div class="wrap"><section class="start"><h1>The realm before you</h1><p>The realm is living through the ${years} years before your coming: ${s.people.filter(p => p.alive).length} souls, year ${Math.floor((total + s.t) / 52) + 1} of ${years}.</p><progress id="past" max="${total}" value="${total + s.t}"></progress></section></div>`;
      setTimeout(tick, 0);
      return;
    }
    openCourt(s);
    openWeek();
    render();
  };
  tick();
}

function welcome(): void {
  app.innerHTML = `<div class="wrap"><section class="start">
    <h1>Vicarius Regis</h1>
    <p>The king is away for three years and you hold his court. Each week those whom nothing below could settle come before you. Rule on up to three. A ruling for one case settles one case, and the question will come back. A rule for the realm settles every like case without you, and every arrangement built on the old understanding is disturbed.</p>
    <p class="soft">Nothing in this realm is scripted. Its people farm, deal, quarrel and believe by their own lights, and they will learn what to expect of you.</p>
    <div><label class="label" for="seed">Seed of the realm</label><br><input id="seed" type="number" min="1" value="${1 + Math.floor(Math.random() * 999)}"></div>
    <div class="choices"><button class="go" id="small">A small realm: about 200 souls, ready in seconds</button><button id="full">The realm: about 900 souls, takes a minute to found</button></div>
  </section></div>`;
}

app.addEventListener('click', ev => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const seedOf = (): number => Math.max(1, Number((document.getElementById('seed') as HTMLInputElement | null)?.value) || 1);
  if (b.id === 'small') return start(seedOf(), P.side, P.souls, 12);
  if (b.id === 'full') return start(seedOf(), P.realmSide, P.realmSouls, 10);
  if (b.id === 'again') return welcome();
  if (b.id === 'pass') { passWeek(); render(); window.scrollTo(0, 0); return; }
  if (b.dataset.tab) { tab = b.dataset.tab as typeof tab; render(); return; }
  if (b.dataset.cut) {
    const at = b.dataset.cut.indexOf(':'), id = b.dataset.cut.slice(0, at), cut = b.dataset.cut.slice(at + 1), pid = Number(id), had = chosen.get(pid);
    if (had?.cut === cut) chosen.delete(pid);
    else if (had || chosen.size <= P.hearings) chosen.set(pid, { cut: cut!, width: had?.width ?? 'case' });
    render();
    return;
  }
  if (b.dataset.width) { const [id, w] = b.dataset.width.split(':'), had = chosen.get(Number(id)); if (had) { had.width = w as Width; render(); } }
});

welcome();
