# Vicarius Regis: The Chancery Idler — Unified Design Document

## 1. Core Identity & Historical Premise

**Vicarius Regis** (the `Petitions-of-the-Realm-2` codebase) is a **mobile-first, indirect medieval Chancery idler**.

You are not the King, and you are not a landlord running one estate among many. You are the **Vicarius Regis** (Royal Justiciar / Chief Clerk of the Chancery—in the mold of Hubert Walter or Ranulf de Glanvill holding England while the King is abroad). You do not own a centralized royal warehouse of grain and timber, and you do not play StarCraft placing granaries and dikes onto a hundred tiles.

Your power is **strictly indirect**: parchment, seals, writs, assizes, commissions, tallies, and legal commensurabilities. You watch a living, unscripted medieval realm tick forward across seasons and decades, and you steer it exclusively by issuing legal instruments, tuning official labour-exchange rates, and delegating authority to self-interested lords, sheriffs, parishes, and travelling justices—then watching whether they obey, twist, skim, or defy your seal.

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

## 3. Fine-Grained Indirect Controls (Zero New Subsystems)

There are **zero pop-through petition cards** in **The Chancery** mode (petitions live strictly inside the optional **Regency** mode). Every fine-grained lever below is **3–5 lines gating an existing process** inside `sim/processes/`—zero bespoke subsystems, zero RTS building.

### Pillar I: Standing Statutes & Assizes (Grouped Cleanly in the `Laws` Sheet)
Changing any standing statute within 52 weeks builds **Caprice** (draining Legitimacy); inscribing a statute onto the permanent Roll (`roll: true`) boosts Legitimacy but triples Caprice if reversed.

#### A. Land, Tenure & Lord–Subject Statutes
| Statute | Existing Sim Hook | Options | Strategic Trade-off |
| --- | --- | --- | --- |
| **Assize of the Forest** | `choose.ts`, `make.ts` clearing | `Free Clearing` · `Stinted` · `King's Forest` | Timber/fields vs. downstream flood prevention |
| **Movement & Ties** | `bind.ts`, `choose.ts` flight | `Free Movement` · `Customary` · `Bound to Ground` | Tenant mobility vs. lord boon-work retention |
| **Subletting (*Quia Emptores*, 1290)** | `bind.ts`, `choose.ts` (`about: 'bond'`) | `Allowed` · `Barred` | Tangled sub-tenant chains vs. clean direct lordship |
| **Enclosure & Waste** | `court.ts`, `choose.ts` (`P.idle`) | `Protect Commons` · `Idle Claimable` · `Lords May Enclose` | Poor access vs. ambitious lords & ecological recovery |
| **Prescription / Quiet Title** | `court.ts`, `learn.ts` (`claim:${cell}`) | `Claims Forever` · `10-Year Bar` · `3-Year Bar` | Ancestral justice vs. settled tenure & fewer heir feuds |
| **Wardship (Minor Heirs)** | `gather.ts` death with minors | `Kin Holds` · `Lord Holds Until Grown` · `Crown Holds` | Kin security vs. feudal revenue & resentment |
| **Widow's Third / Dower (*Magna Carta c. 7*)** | `gather.ts` spouse death | `Widow Keeps All` · `Widow's Third` · `Reverts to Heir/Lord` | Household survival vs. rapid land consolidation |
| **Inheritance** | `gather.ts` `handOver()` | `Kin First` · `Creditors First` · `Escheat (no kin → Lord)` | Bloodline stability vs. credit health (`upheld()`) |

#### B. Social, Cultural, Market & Order Statutes
| Statute | Existing Sim Hook | Options | Strategic Trade-off |
| --- | --- | --- | --- |
| **Marriage (*Merchet*)** | `bind.ts` marriage check (`P.far`) | `Free` · `Local Only` · `Lord's Leave` · `Barred Across Estates` | Cross-valley kin networks vs. lord control |
| **Contracts & Usury** | `choose.ts` `ways` filter | Toggleable bans: `Land Pledges`, `Spoken Debts`, `Deferred Credit` | Protects debtors vs. chills credit (`chilled()`) |
| **Forestalling & Hoarding** | `choose.ts` grain `store` cap in dearth | `Allowed` · `Fined` · `Seizable in Dearth` | Curbs famine hoarding vs. angers wealthy houses |
| **Sumptuary Law** | `choose.ts` `cloth` / `ale` / `brine` | `Open` · `Lords & Clergy Only` | Forces peasant days into grain/timber vs. grievance |
| **Sworn Leagues** | `gather.ts` `band()` | `Free Banding` · `Chartered Only` · `Forbidden` | Local mutual aid vs. rival composite bodies |
| **Liability (Frankpledge)** | `bind.ts`, `court.ts` | `Individual` · `Kin / House` · `Whole Body` | Self-policing Reach vs. collective faction anger |
| **Outlawry (*Caput Lupinum*)** | `choose.ts`, `bind.ts` (`stain`/`wrong`) | `Crown Law Only` · `Hue & Cry` · `Outlawry` | Cheap local policing vs. vigilantism & flight |

#### C. Church, Crown & Superstructure Statutes (The Two Swords)
| Statute | Existing Sim Hook | Options | Strategic Trade-off |
| --- | --- | --- | --- |
| **Advowson (Who Picks the Priest)** | `gather.ts`, `court.ts` (`body.speaker`) | `Church Elects` · `Local Lord Presents` · `Crown Appoints` | Spiritual independence vs. loyal (or resented) clergy |
| **Benefit of Clergy / *Praemunire*** | `court.ts` clergy wrongs | `Church Courts Only` · `Crown Tries Blood` · `All Under Crown` | Legitimacy with clergy vs. royal Reach & equality |
| **Statute of Mortmain** | `gather.ts` extinction `vow` | `Allowed` · `Licensed` · `Barred` | Devout peace vs. arable land locked forever in church hands |
| **Tithe & Mortuary Dues** | `bind.ts`, `gather.ts` | `Tithe + Death-Due` · `Tithe Only` · `Capped` | Rich independent parishes vs. peasant relief |
| **Pilgrimage & Folk Shrines** | `sacred.ts` `shrine` & `P.far` gifts | `Open` · `Sanctioned Only` · `Suppressed` | Folk devotion & local boom vs. clerical orthodoxy |

### Pillar II: Universal Labour Measure & Schedule of Assized Rates (`Dials` Sheet)
**Labour (days of work)** is the single universal numéraire (matching medieval manorial *opera* and the existing `TOIL[kind]` table in `sim/tables.ts`). Because every tradeable good is priced directly in **days of labour**, cross-rates between any two goods (`grain` vs. `timber`, `cloth` vs. `blade`, etc.) derive automatically as the ratio of their labour rates—guaranteeing **zero arbitrage loops**.

1. **Schedule of Assized Rates (12 Tradeable `KINDS`):**
   - Rendered as a clean, scrollable printed-ledger table covering all 12 non-fixed goods in `sim/tables.ts`:
     - **Food & Drink:** `grain`, `meat`, `haul` (fish), `cured`, `brine` (salt), `ale`
     - **Fuel & Dress:** `timber`, `fleece`, `cloth`
     - **Iron & Tools:** `ore`, `blade`, `coulter`
   - Each good has a stepped multiplier `assizeRate[kind]` (`0.5×` · `0.75×` · `1.0× Customary` · `1.35×` · `2.0×`) applied directly to `TOIL[kind]` in `bind.ts` and `court.ts` during debt conversions, substitutions, commutations, and purveyance tallies.
   - **Emergent price-control distortion (zero new subsystems):** Setting a good *below* its true production toil (`< 1.0×`) eases debtors and tenants who need it, but drives producers to hoard it, refuse formal deals (`chilled()`), or shift to unwitnessed spoken black-market bargains. Setting it *above* (`> 1.0×`) encourages production and creditor acceptance in kind, while squeezing buyers.
2. **Core Royal Measure & Labour Dials:**
   - **Assize of Weights & Measures (*Magna Carta c. 35*):** `Lord's Bushel` *(favours landlords/creditors)* · `King's Standard` *(even)* · `Small Measure` *(eases tenants/debtors)*.
   - **Lord's Boon-Work Cap:** `0d` · `1d` · `2d` · `3d` · `Unchecked` *(directly gates `P.boonMax` in `bind.ts`)*.

### Pillar III: Commissions & Officers (`Powers` Sheet — Delegated Authority)
Act on **named powers** (Lords, Parishes, Composite Bodies):
- **Appoint / Revoke Sheriff or Warden:** Grants immediate and seasonal **Reach** in that lord's country and calms local grievances—while their `ambition` grows weekly. At `ambition >= 1.0`, they turn **Defiant**, pocket royal dues, and drain Reach.
- **Demand Hostage / Surety:** Freezes a lord's ambition and enforces a year of peace while held.
- **Grant / Revoke Royal Charter:** Confers a 10-year exemption from tallage/purveyance on a power or shire (calms factions there; resented by neighbors).
- **Back Parish vs. Lord:** Play the Two Swords locally (uphold a parish's sanctuary/tithe against a grasping lord, or permit a lord to tax an unsanctioned folk shrine).

### Pillar IV: Writs of Command & Realm Decrees (Indirect Local & Timed Actions)
Tapping any shire spends **Chancery Capacity (1 Writ)** to command local actors—never building or shipping goods yourself:
- **Writ of Purveyance (Relief):** Commands the nearest wealthy lord or abbey to deliver food to a starving shire on a **Royal Tally** (adds Crown Debt and angers the supplier; saves the starving shire).
- **Writ of Commission (Local Works):** Commands the local lord or composite body to raise a **Dike**, **Granary**, **Chapel**, or **Watch** *out of their own timber and labour*—compliance depends on Reach and loyalty.
- **Writ of Inquest / Distraint:** Orders local officials to expose concealed dues, fabricated debts, or unlawful enclosures on that shire.
- **Writ of the King's Peace:** Context-aware writ naming the exact crisis (*lift an interdict*, *sanction or suppress a shrine*, *put a stained priest to penance*, *impose wergild on a feud*).
- **Royal Progress:** Moves the Chancery's seat (`Court.seat`) to that shire (`13w` cooldown). Local grievance fades `2×` faster and Reach/Legitimacy surge within radius `<= 2`, while distant Wardens grow bolder in your absence.
- **Realm Decrees (Timed):** `Year of Stay (52w)`, `General Eyre (26w)`, `Solemn Penance & Vouch (26w)`, and `General Tallage (13w)` (levies feudal aid to pay down **Royal Tallies**).

---

## 4. Underlying Simulation & Honest Contiguity

### Six Orthogonal Planes (Preserved Unchanged)
The simulation engine (`sim/`) remains a pure, deterministic weekly step across six non-reducible planes: **Material**, **Positional**, **Relational**, **Normative**, **Epistemic**, and **Sacred (Superstructure)**, with the 6-year founding warm-up and survival fixes (`desperate` taboo defiance + `boon` cap).

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
- **Three Modes on Landing Masthead:** **The Chancery** *(default indirect idler)*, **The Chronicle** *(pure observer)*, and **The Regency** *(classic 156-week petition challenge)*.
- **Top Instrument Strip:** 4 equal KPI columns (`LEGITIMACY`, `REACH`, `WRITS`, `TALLIES / FACTIONS`) using numeric readouts + `2px` hairline progress bars and seasonal trend arrows (`▲`/`▼`)—**zero red circle health pips**. Tapping any KPI opens a compact seasonal ledger breakdown (`.gpop`).
- **Compact Inline Toolbar:** `Y2 · W49 · Winter` + borderless `|| 1× 5× 20×` throttle on one line; **quiet `30px` underline text tabs** (`Want · Factions · Sacred · Lords · Land`) with tiny borderless `?` and `Fit` links right below—no chunky `44px` boxed buttons.
- **Bottom Dock (`48px`):** 5 thin-stroke icon + label tabs (`Laws` · `Dials` · `Powers` · `Decrees` · `Chronicle`) opening a flat `0px`-radius editorial slide-up half-sheet (`max-height: 52dvh`) with `1px`-separated tabular rows.
- **Persistence & Long-Term Arc:** Auto-save to `localStorage` (`Resume Realm`), Decade Era stamps in the Chronicle, and **Watch / Pin** toggles on any house or shire.

---

## 6. Low-Priority Backlog
- **Readable Historical Display Units:** Map internal simulation floats (e.g., `2.5 grain`) to clean, intuitive medieval display units (**bushels** or **quarters** of grain, **loads** of timber, **days** of work) at the presentation layer without altering underlying `sim/tables.ts` math.

---

## 7. Explicit Anti-Patterns (Constraints for All Implementers & LLMs)

| Anti-Pattern | Why It Is Rejected | Required Replacement |
| --- | --- | --- |
| Centralized Crown grain/timber `Store` | Turns the *Vicarius Regis* into a landlord/estate among estates; historically false | **Chancery Capacity (Writs)** + **Royal Tallies (Crown Debt)** via Purveyance |
| Player-built RTS `Works` on tiles | Feels like *StarCraft* / *EU4* micromanagement; unworkable across 100 tiles on mobile | **Writs of Commission** ordering local lords/bodies to build at *their* expense |
| Bespoke new subsystems for every statute | Bloats ontology and breaks emergent simplicity | **3–5 line gates on existing `sim/processes/` checks** (`ways`, `band()`, `P.far`, `TOIL`, `body.speaker`) |
| Pairwise good-to-good rate sliders | Creates arbitrage triangles across 12 tradeable goods | **Universal Labour numéraire** (`assizeRate[kind] * TOIL[kind]`) |
| Voronoi / 5–6-sided map polygons | Misleadingly implies diagonal contiguity when `sim/` uses a 4-neighbor square grid | **Honest `1×1` square grid** with crisp hairlines and lordship outer borders |
| Pop-through petitions in Idler mode | Jarring inbox whiplash; duplicates original *Vicarius Regis* card-game loop | **Map + Chronicle + Indirect Writs** (keep petitions strictly in **Regency** mode) |
| Red dot health pips (`●●●●●`), target rings, clip-art trees/hills, cobweb road lines | Reads as a crude indie video game rather than an informational instrument | **Numeric KPIs + `2px` bars**, uniform `3px` settlement dots, 4-step choropleth fills, zero roads |
| `Helvetica` + `monospace` + cyan `#e7edef` grid | Feels like an anachronistic 1990s CAD/software dashboard | **Book serif** (`Iowan Old Style` / `Palatino` / `Georgia`) + warm archival paper (`#f6f2ea`) + `tabular-nums` |
| Giant `44px` boxed lens bars & two-tone settled/empty land blotches | Cramped Lego-brick chrome and cow-spotted map readability | **Quiet `30px` underline text tabs** and uniform `var(--stone)` dry land fill |
