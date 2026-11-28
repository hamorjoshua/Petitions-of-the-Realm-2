# Vicarius Regis: The Chancery Idler — Unified Design Document

## 1. Core Identity & Historical Premise

**Vicarius Regis** (the `Petitions-of-the-Realm-2` codebase) is a **mobile-first, indirect medieval Chancery idler**.

You are not the King, and you are not a landlord running one estate among many. You are the **Vicarius Regis** (Royal Justiciar / Chief Clerk of the Chancery—in the mold of Hubert Walter or Ranulf de Glanvill holding England while the King is abroad). You do not own a centralized royal warehouse of grain and timber, and you do not play StarCraft placing granaries and dikes onto a hundred tiles.

Your power is **strictly indirect**: parchment, seals, writs, assizes, commissions, and tallies. You watch a living, unscripted medieval realm tick forward across seasons and decades, and you steer it exclusively by issuing legal instruments and delegating authority to self-interested lords, sheriffs, parishes, and travelling justices—then watching whether they obey, twist, skim, or defy your seal.

### Project Separation
| Project | Genre & Role |
| --- | --- |
| **Original *Vicarius Regis*** (`Vicarius-Regis-R16-`) | Tight, handcrafted, dryly funny strategy card game (15-minute runs, authored petitions, sharp turn-by-turn dilemmas). |
| ***Vicarius Regis: The Chancery Idler*** (`Petitions-of-the-Realm-2`) | Ambient mobile idler and indirect governance instrument powered by a 6-plane unscripted simulation. |

---

## 2. The Rule of Indirect Power (Replacing RTS & Warehouse Mechanics)

To prevent the game from degenerating into *StarCraft* or a micro-heavy *Europa Universalis* clone on a phone screen, **remove** the centralized Crown `Store` (grain/timber) and direct player-built `Works`.

### Crown Instruments (What You Actually Track)
| Gauge | Nature | What Raises It | What Drains It |
| --- | --- | --- | --- |
| **Legitimacy** (`0.0–5.0`) | Superstructure authority of the Great Seal | Consistent Assizes, Inscribed Rolls, Justices in Eyre, Solemn Penance, respecting sanctuary | Caprice (flip-flopping Assizes), sacrilege, encroaching on spiritual sovereignty, broken tallies |
| **Reach** (`0.0–5.0`) | Base enforcement across distance | Sheriffs & Wardens, Justices in Eyre, Royal Progress, collective surety (Frankpledge) | Defiant Wardens, concealment, tenant flight, connected-faction withdrawals (`>= 3` houses) |
| **Chancery Capacity (Writs)** | Seasonal administrative bandwidth (e.g., `3–5` sealed writs per season) | Stable Legitimacy & functioning Chancery | Issuing targeted Writs to lords, parishes, or shires (replenishes each season; cannot be hoarded endlessly) |
| **Royal Tallies (Crown Debt)** | Material requisitions cut on the absent King's credit | Purveyance writs, emergency relief orders, funding Eyres out of baron/abbey wealth | Repaying via Crown fines/feudal incidents, or letting tallies lapse (heavy Legitimacy & faction fury) |
| **Aggrieved Factions** | Connected clusters (`>= 3` linked houses) | Harsh assizes, unaddressed want, purveyance, strict bailiffs | Local exemptions (Charters), Stay of Debts, Royal Progress, resolving local feuds/interdicts |

### Weak Crown (No Sudden Game Over in Idler Mode)
In **The Chancery** (idler) mode, reaching `0.0` Legitimacy or `0.0` Reach does **not** trigger a Game Over screen. Instead, the Crown enters a **Weak Crown** state: standing Assizes go unheeded, lords ignore routine commissions, and feuds flare until you rebuild trust and obedience through targeted Writs, Royal Progress, and patient governance.

---

## 3. The Four Pillars of Indirect Control (Mobile Cockpit)

There are **zero pop-through petition cards** in **The Chancery** mode (petitions live strictly inside the optional **Regency** mode). Everything is governed from four compact, thumb-zone banks—designed for 30-second check-ins or long ambient runs at `1× / 5× / 20×`.

### Pillar I: Standing Assizes (Constitutional Law)
Four standing 3-way procedural laws on the Rolls. Changing an Assize within 52 weeks builds **Caprice** (draining Legitimacy); inscribing an Assize onto the permanent Roll (`roll: true`) boosts Legitimacy but triples Caprice if ever reversed.
1. **Assize of the Forest:** `Free Clearing` · `Stinted` · `King's Forest` *(timber/fields vs. downstream flood prevention)*.
2. **Assize of Movement & Ties:** `Free Movement` · `Customary` · `Bound to the Ground` *(tenant mobility vs. lord boon-work retention)*.
3. **Assize of Debt & Surety:** `Enforce (Individual)` · `Enforce (Frankpledge / Collective)` · `Mercy / Stay` *(credit health & self-policing Reach vs. peasant distress & faction anger)*.
4. **Assize of the Two Swords:** `Clerical Immunity` · `Concordat (Translate)` · `Royal Supremacy` *(sanctuary, mortmain, shrines, and stained clergy)*.

### Pillar II: Commissions & Officers (Delegated Authority)
You do not act directly on the land; you appoint and check **named powers** (Lords, Parishes, Composite Bodies):
- **Appoint / Revoke Sheriff or Warden:** Grants immediate and seasonal **Reach** in that lord's country and calms local grievances—while their `ambition` grows weekly. At `ambition >= 1.0`, they turn **Defiant**, pocket royal dues, and drain Reach.
- **Demand Hostage / Surety:** Freezes a lord's ambition and enforces a year of peace while held.
- **Grant / Revoke Royal Charter:** Confers a 10-year exemption from tallage/purveyance on a power or shire (calms factions there; resented by neighbors).
- **Back Parish vs. Lord:** Play the Two Swords against each other locally (uphold a parish's sanctuary/tithe against a grasping lord, or permit a lord to tax an unsanctioned folk shrine).

### Pillar III: Writs of Command (Indirect Place & Power Orders)
Tapping any shire on the map opens a compact inspector where you spend **Chancery Capacity (1 Writ)** to command local actors—never building or shipping goods yourself:
- **Writ of Purveyance (Relief):** Commands the nearest wealthy lord or abbey to deliver food to a starving shire on a **Royal Tally** (adds Crown Debt and angers the supplier; saves the starving shire).
- **Writ of Commission (Local Works):** Commands the local lord or composite body to raise a **Dike**, **Granary**, **Chapel**, or **Watch** *out of their own timber and labour*—whether they obey, delay, or shirk depends on Reach and loyalty.
- **Writ of Inquest / Distraint:** Orders local officials to expose concealed dues, fabricated debts, or unlawful enclosures on that shire.
- **Writ of the King's Peace / Intervention:** Context-aware writ naming the exact crisis on that shire (*lift an interdict*, *sanction or suppress a shrine*, *put a stained priest to penance*, *impose wergild on a feud*).
- **Royal Progress:** Moves the Chancery's seat (`Court.seat`) to that shire (`13w` cooldown). Local grievance fades `2×` faster and Reach/Legitimacy surge within radius `<= 2`, while distant Wardens grow bolder in your absence.

### Pillar IV: Realm Decrees (Timed Emergency Instruments)
Four rare, high-impact realm-wide pulls with visible burn-down timers:
- **Year of Stay (`52w`):** Halts debt seizures and boon-work escalation realm-wide *(calms factions; chills credit)*.
- **General Eyre (`26w`):** Dispatches travelling royal justices across the realm *(rebuilds Reach & Legitimacy and uncovers hidden wrongs; adds Tallies & local friction)*.
- **Solemn Penance & Vouch (`26w`):** Eases interdict dread, accelerates stain/ban decay, and cools newcomer shunning *(rebuilds Legitimacy)*.
- **General Tallage (`13w`):** Levies an extraordinary feudal aid across lords and abbeys to pay down **Royal Tallies** *(clears Crown Debt; spikes faction grievance)*.

---

## 4. Underlying Simulation & Honest Contiguity

### Six Orthogonal Planes (Preserved Unchanged)
The simulation engine (`sim/`) remains a pure, deterministic weekly step across six non-reducible planes:
1. **Material:** Needs, concave welfare, stocks, clearing, downstream floods, labour, credit.
2. **Positional:** Exclusive rights, land tenure, surplus ambition, jurisdiction.
3. **Relational:** Overlapping kin (`P.far: 8`), composite bodies, divided allegiance, collective liability, exit/flight.
4. **Normative:** Hard prohibitions (`fears`), positive duties (`duty:aid`, `boon`), social stain.
5. **Epistemic:** Spoken vs. witnessed bonds, denial, false claims, concealment, permanent inscribed rolls.
6. **Sacred (Superstructure):** Consecration, inalienable vows (`mortmain`), sanctuary blocking Base force, emergent folk shrines, interdicts, stained clergy, and 3-axis interpretive creeds (`rigour`, `folk`, `purity`).

### Pre-Sim Survival & Pacing Rules
- **6-year founding warm-up** so the realm enters Year 1 with history intact and healthy population (~180–220 souls on small realm).
- **Desperation overrides taboos:** Any house below `P.short` may defy feared-ground customs, incurring `stained` and priest/neighbor friction rather than quietly starving.
- **Boon-work floor:** Lords never draw boon-work from tenants in want, capped at `3` days/week.

### The Honest Contiguity Principle
The simulation computes adjacency, water flow (`low[i]`), movement, and local reach on an **integer `side × side` square grid** (`State.cells`). Therefore, **the visual map MUST be an honest square grid**.
- **Never render Voronoi polygons** over a 4-neighbor square grid; 5- and 6-sided polygons fabricate fake diagonal borders that misrepresent simulation physics.
- Embrace the honest square grid unapologetically—like an archival folio survey table or editorial tile-grid cartogram.

---

## 5. Visual, Typographic & Interaction Specification

### Aesthetic Voice: Historical Printed Atlas & Ledger
Purely informational (Dieter Rams / Edward Tufte discipline), **zero faux-antique gimmicks**, **zero video-game sprites**, and **zero anachronistic Helvetica/CAD dashboards**. The visual model is a **high-craft historical printed atlas or Renaissance folio ledger** (*The Times Atlas of World History*, Venetian printed books, Tufte's *Envisioning Information*).

### Palette (`:root`)
| Token | Light (Printed Stock) | Role |
| --- | --- | --- |
| `--bg` | `#f6f2ea` | Warm archival paper ground |
| `--panel` | `#fbf9f4` | Top strip, bottom dock, slide-up sheets |
| `--stone` | `#eae3d5` | Uniform dry land tile fill |
| `--water` | `#dce3e2` | Quiet warm archival slate for coastal water/inlets |
| `--rule` | `#d8d0bf` | Crisp `1px` hairlines & ledger dividers |
| `--ink` | `#1c1915` | Primary typography & outer lordship rules |
| `--soft` | `#6d6558` | Secondary labels, captions, muted values |
| `--red` | `#a43222` | Vermilion signal (Want, Factions, Interdict, Defiance) |
| `--blue` | `#235789` | Woad signal (Selection, Active Throttle, Reach) |
| `--amber` | `#916713` | Ochre signal (Sacred, Shrines, Crown Seat) |
| `--green` | `#1d6357` | Verdigris signal (Ecology, Recovery, Positive Trend) |

### Typography
- **Book Serif (`--display`):** `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` for masthead, headings, **map place names** (upright small-caps or Title Case), *italic* micro-data (`14w`), and Chronicle entries.
- **Crisp Sans (`--ui`):** `-apple-system, BlinkMacSystemFont, "Inter", sans-serif` strictly for tiny `10px` uppercase tracked (`0.08em`) micro-labels and compact controls.
- **Numerals:** `font-variant-numeric: tabular-nums` on every gauge, clock, count, and table cell. **No `Helvetica` on the map, no `monospace` bands.**
- **Folio Rules:** Use a classic `2px` + `1px` double hairline beneath the top instrument strip to anchor the printed-ledger identity without ornament.

### Honest Square-Grid Map (`ui/map.ts`)
- **Geometry:** Uniform `1×1` SVG `<rect data-cell="i">` tiles with `0.5px` (`vector-effect: non-scaling-stroke`) hairlines in `var(--bg)`—zero Voronoi slivers, zero gaps to mis-tap, zero diagonal lies.
- **Choropleth Encoding:** Quantize the active lens (`Want`, `Factions`, `Sacred`, `Lords`, `Land`) into **4 clean editorial steps** (`0% / 18% / 44% / 75%` of a single signal color mixed into `var(--stone)`). Include an unobtrusive inline 4-swatch legend (`None · Low · High · Severe`) above the bottom dock.
- **Borders & Water:** Clean `1.25px` outer coastline stroke (`var(--soft)`) separating dry squares from coastal/inlet water squares; solid `1.5px` ink outer boundary around contiguous lordships. **Zero cobweb road lines connecting dots.**
- **Minimal Marks:** Uniform tiny `3px` solid ink dot for settlements (`4px` hollow gilt-ringed dot for the Chancery's current seat), clean book-serif Title Case label (`Hazelstoke`) with *italic* terse datum (`14w`)—no concentric bullseye stacks, no clip-art trees/hills, no emoji.
- **Touch & Pinch-Zoom:** Lock pinch-to-zoom on the cockpit shell (`touch-action: manipulation` on controls, `gesturestart`/`gesturechange` prevented outside `.map-viewport` for iOS Safari). Allow smooth `1×–3.5×` pinch and pan exclusively inside `.map-viewport`.

### Mobile-First Layout & Modes (`ui/page.html`, `ui/main.ts`)
- **Three Modes on Landing Masthead:**
  1. **The Chancery** *(default — indirect ambient idler, Weak Crown instead of Game Over)*.
  2. **The Chronicle** *(pure observer terrarium, no Crown)*.
  3. **The Regency** *(classic 156-week manual petition challenge)*.
- **Top Instrument Strip:** 4 equal KPI columns (`LEGITIMACY`, `REACH`, `WRITS`, `TALLIES / FACTIONS`) using numeric readouts + `2px` hairline progress bars and seasonal trend arrows (`▲`/`▼`)—**zero red circle health pips**. Tapping any KPI opens a compact seasonal ledger breakdown (`.gpop`).
- **Compact Inline Toolbar:** `Y2 · W49 · Winter` + borderless `|| 1× 5× 20×` throttle on one line; **quiet `30px` underline text tabs** (`Want · Factions · Sacred · Lords · Land`) with tiny borderless `?` and `Fit` links right below—no chunky `44px` boxed buttons.
- **Bottom Dock (`48px`):** 5 thin-stroke icon + label tabs (`Assizes` · `Writs` · `Powers` · `Decrees` · `Chronicle`) opening a flat `0px`-radius editorial slide-up half-sheet (`max-height: 52dvh`) with `1px`-separated tabular rows.
- **Persistence & Long-Term Arc:** Auto-save to `localStorage` (`Resume Realm`), Decade Era stamps in the Chronicle, and **Watch / Pin** toggles on any house or shire.

---

## 6. Explicit Anti-Patterns (Constraints for All Implementers & LLMs)

| Anti-Pattern | Why It Is Rejected | Required Replacement |
| --- | --- | --- |
| Centralized Crown grain/timber `Store` | Turns the *Vicarius Regis* into a landlord/estate among estates; historically false | **Chancery Capacity (Writs)** + **Royal Tallies (Crown Debt)** via Purveyance |
| Player-built RTS `Works` on tiles | Feels like *StarCraft* / *EU4* micromanagement; unworkable across 100 tiles on mobile | **Writs of Commission** ordering local lords/bodies to build at *their* expense |
| Voronoi / 5–6-sided map polygons | Misleadingly implies diagonal contiguity when `sim/` uses a 4-neighbor square grid | **Honest `1×1` square grid** with crisp hairlines and lordship outer borders |
| Pop-through petitions in Idler mode | Jarring inbox whiplash; duplicates original *Vicarius Regis* card-game loop | **Map + Chronicle + Indirect Writs** (keep petitions strictly in **Regency** mode) |
| Red dot health pips (`●●●●●`), target rings, clip-art trees/hills, cobweb road lines | Reads as a crude indie video game rather than an informational instrument | **Numeric KPIs + `2px` bars**, uniform `3px` settlement dots, 4-step choropleth fills, zero roads |
| `Helvetica` + `monospace` + cyan `#e7edef` grid | Feels like an anachronistic 1990s CAD/software dashboard | **Book serif** (`Iowan Old Style` / `Palatino` / `Georgia`) + warm archival paper (`#f6f2ea`) + `tabular-nums` |
| Giant `44px` boxed lens bars & two-tone settled/empty land blotches | Cramped Lego-brick chrome and cow-spotted map readability | **Quiet `30px` underline text tabs** and uniform `var(--stone)` dry land fill |
