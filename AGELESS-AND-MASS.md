# Ageless Athlete and Mass Protocol — reading notes and an implementation plan

**Status: design only. No app code has been changed.** This is my interpretation of the two
books and how I would build them into Operator + Black if we decide to. Nothing here is
scheduled; `ROADMAP.md` remains the list of what is actually committed.

## Sources, and what I could and could not read

| | |
|---|---|
| `TB_AA.pdf` | *Tactical Barbell: Ageless Athlete*, **Jim Madden**, 2017. 206pp. Text extracted cleanly. Note this is not K. Black — it is a book written *about* training TB past forty, by a philosophy professor who took up BJJ and lost 100lb. |
| `TB_MP.pdf` | *Tactical Barbell: Mass Protocol*, Zulu23 Group, 2018. 146pp. **19 pages are image-only** — which is exactly where the template grids live. I rendered and read the ones that matter; the rest are flagged at the bottom as unverified. |

Numbers below come from grids I actually looked at. Anything I have not confirmed is marked
**[unverified]**. This matters: v1.27 shipped a wrong FOBBIT prescription because I built it
from a web search rather than the source, and the structure was right while the arithmetic
was not. Do not implement a flagged line without checking the page first.

---

## Part 1 — Ageless Athlete

### The interpretation

The book asks outright whether an older athlete needs a special strength program and answers
**no**. Trainees past forty thrive on high-frequency, high-intensity, low-rep work; the
author's position is that Operator I/A is already close to ideal for them. What changes is not
the programming shape but the *dosing and the scaffolding around it*.

So this should **not** be a new template in the app. It is a **mode**: a set of defaults,
caps and guard rails layered over the program we already run. That framing is what makes it
cheap to build.

### The programmable claims

1. **Operator I/A over Operator Standard.** *(Partly shipped in 1.32 — see the note below;
   this entry understated what full I/A involves.)* Flexible set ranges rather than fixed
   sets, so volume can be dialled up or down session by session without leaving the plan.
2. **Always train off a training max**, never a true 1RM. The book's rule of thumb: you should
   have complete confidence you can finish every session in the block.
3. **3‑1‑3‑1 recovery.** Three training weeks, one recovery week, three, one. A recovery week
   means *no barbells and no HIC* — at most two easy sessions (general conditioning, grip,
   core or LSS), plus any mobility work. Every other block, the second recovery week is taken
   completely off. Consequence worth stating plainly in the UI: a six-week block now takes
   eight weeks, and that is the point.
4. **One non-negotiable rest day per week, plus one flex day.**
5. **Base building capped at 3 × 30 min LSS per week**, against TB2's 3 × 60. The author calls
   30 minutes the minimum effective dose for someone who is not chasing endurance
   performance. Weeks 1–5 are LSS plus "Tango" strength-endurance circuits with no barbell
   work at all; weeks 6–8 bring max strength and HIC back in.
6. **Test only when you have reason to think you will learn something.** Preferred alternative
   to a test week: an in-block check on the last day before a recovery week — one heavy single
   above 95%, or a rep max.
7. **Back "Break" templates.** For a block when the spine needs a rest: one lower-body barbell
   lift, once a week, worked up to a best set *for that day* with perfect form, then optional
   down sets. Wave: best 6 then 1–3×6 @ 80%, best 5 then @ 85%, best 3 then @ 90%.
8. **Old Warhorse.** For advanced lifters who find 90%+ expensive: open the block at a
   deliberately low training max (~80%), play with volume, then force 2–5% progression per
   block rather than testing. **[unverified: the full table]**
9. **Accessories kept deliberately few.** The three it endorses alongside Operator are Plank &
   Shank, the dumbbell farmer's carry, and the kettlebell swing — all of which we already have
   or could add trivially.

### How I would build it

A single `plan.mode = 'standard' | 'ageless'` that layers constraints, plus one new week kind:

- **New week kind `recovery`.** `weeks()` gains a 3‑1‑3‑1 rule alongside the existing deload
  and retest rules. Its day layout is: two optional easy sessions, the rest off, with the
  barbell and HIC cards simply absent rather than greyed out.
- **Defaults it flips:** `basis` to training max, `tmPct` to 90, `deloadEvery` to 0 (the
  recovery weeks replace it), conditioning defaults toward the low end of every round range.
- **A cap, not just a default,** on base-building LSS: 30 minutes, with the reason shown.
- **Accessory list trimmed** to the three endorsed movements.
- **Retest guidance changes** rather than the schedule: offer the in-block check (a single
  above 95%, or a rep max, on the last day before a recovery week) as an alternative to a full
  retest week, and let that write a new max.

Back Break and Old Warhorse are separate templates, not part of the mode — see Part 3.

---

## Part 2 — Mass Protocol

### The interpretation

This one is genuinely different, because the goal is different: hypertrophy with concurrent
strength, for the patrol officer / firefighter / corrections population where visible mass is
an occupational asset rather than a liability. Three structural departures from what we run:

- **Three-week waves**, not six.
- **Four lifting days**, with the deadlift on its own day.
- **A rotation at the top level** (OMS), where the *template itself* changes every few weeks.

That last one is the real work. Our `weeks()` derives everything from a cycle number on the
assumption that every cycle is the same programme.

### Mass Template

Cluster: bench, squat, weighted pull-up, deadlift. Bench/squat/WPU are each performed three
times a week on alternate days (days 1, 3, 5); the deadlift gets its own day at the end
(day 6). Weighted pull-ups are gated at **12+ bodyweight pull-ups** — below that, substitute
barbell rows, bodyweight pull-ups or Romanian deadlifts.

Three-week wave, as sets × reps / % of 1RM:

| Week | Bench / Squat / WPU | Deadlift (day 6) |
|---|---|---|
| 1 | 4 × 8 @ 65% | 4 × 5 @ 65% |
| 2 | 4 × 6 @ 75% | 4 × 5 @ 75% |
| 3 | 4 × 3 @ 80%, one lift per session taken to AMRAP or a peak single | 1 × 3 @ 80% (+) |

Execution rules worth encoding as app behaviour: rest 2–3 minutes, 5+ if you are failing
reps, and if you are still failing, drop the max 5–10% and recalculate. That last one is a
nice fit for our existing "felt like a grinder" signal and the end-of-cycle review.

Week 3's AMRAP/peak is **one exercise per session**, chosen in advance — a natural fit for the
day card as a single toggle rather than a free-for-all.

### Grey Man

An alternating A‑B‑A / B‑A‑B split. Main cluster is bench, squat, overhead press, deadlift;
alongside it a user-defined **supplementary cluster** of isolation work. Leaves four days
clear, which is why it is the one the book recommends to people carrying a real conditioning
load. **[unverified: the loading grid, p45–50]**

### Bridge week

A week off between blocks, with optional 1RM testing mid-week (days 4–5) and the rest rest.
We already have a bridge week concept, but ours means something different — ours converts
5RMs into maxes to *start* the programme. Worth renaming one of them before both exist.

### OMS

The long-term rotation: **O**perator (3–6 weeks) → **M**ass (3–6 weeks) → **S**pecificity
(3–6 weeks), repeating, with bridge weeks between blocks. Operator supplies maximal strength,
Mass supplies hypertrophy, Specificity is targeted work and can be anything — kettlebells,
bodyweight, grip, or isolation. You can also just rotate Operator and Mass and drop
Specificity in when something needs attention.

### Conditioning and nutrition

Conditioning's *role* inverts under this protocol. It is no longer a competing priority to be
fitted around strength; it is there to keep work capacity and between-set recovery high, and
the book's explicit test for a session is whether it supports or opposes anabolism. Practical
consequence for us: the conditioning picker should steer away from long catabolic endurance
work while a mass block is running, which is the opposite of the Easy Week nudge we just
shipped.

Nutrition has a usable formula. Standard version, for average or lean builds, per pound of
bodyweight: **protein = BW × 1.3 g, carbs = BW × 2 g, fat = BW ÷ 2 g**. There is a second
formula for anyone starting overweight. **[unverified: Formula 2]**

This is directly implementable against what we already track — we have bodyweight, calories
and a protein target, so a mass block could set the targets rather than the user guessing.

---

## Part 3 — What the app would actually need

### Where the current model breaks

| Assumption in the code | Broken by |
|---|---|
| `plan.wave` is a **six**-entry array of `{s,r,p}` | Mass is a three-week wave; Operator I/A has set *ranges*, not fixed sets |
| `dayPlanSlot()` hard-codes one seven-day shape per week kind, with the clusters baked in as `SBP` / `SBD` and exactly **three** lifting days | Mass needs four lifting days with the deadlift isolated; Grey Man needs an alternating A/B split |
| `weeks()` yields only `cycle | deload | test | bridge`, all derived from a cycle counter | Ageless needs a `recovery` kind on a 3‑1‑3‑1 rule; OMS needs the *template* to change per block |
| One cluster for the whole programme | Grey Man has a main plus a supplementary cluster; Mass gates the WPU slot on a pull-up standard |

Two things are already in our favour: `basis`/`tmPct` gives us training maxes, and the
per-cycle lift-variant work from v1.21 means a block can already change which movement a slot
holds.

### Proposed shape

1. **Lift the day layouts into data.** A `TEMPLATES` table keyed by id, each entry carrying
   its wave, block length, cluster requirements and a per-slot day descriptor.
   `dayPlanSlot()` reads from it instead of its hard-coded arrays. `plan.template` selects one.
   This is a pure refactor with no behaviour change, and the existing schedule tests should
   pass untouched — which is exactly how we would know it was done right.
2. ~~**Allow a wave entry to be a range.**~~ **Done in 1.32**, as `{s:3, sMax:10, r:5, p:75}`
   rather than the `s:[3,5]` tuple sketched here — two scalar fields bind straight to the
   existing `data-pbind` path handling and survive `deepMerge` without any parsing. `rx()`
   now returns both `s` (required) and `sMax` (ceiling), and it absorbed the deadlift's
   1–3 rule, which had been duplicated at six call sites.
3. **Add the `recovery` week kind** and the 3‑1‑3‑1 rule, behind `plan.mode = 'ageless'`.
4. **Add Mass Template** once 1 and 2 exist: a three-week wave and a four-day layout.
5. **Block rotation last.** `plan.rotation = [{template, weeks}, …]` consumed by `weeks()`,
   replacing the "every cycle is the same" assumption. This is the structural change and the
   one most likely to break the frozen-past-weeks guarantee, so it should go last and come
   with its own tests.

### Sequencing, if we do it

Steps 1–3 are worth doing on their own: the refactor pays for itself, and Ageless mode is
mostly defaults plus one week kind, which is a lot of value for little structural risk. Mass
is a bigger lift and only worth it if you actually want a hypertrophy block. OMS only makes
sense once two templates exist to rotate between.

My honest read: **Ageless mode is the one that fits what this app is for.** Mass Protocol is a
coherent programme, but it is aimed at someone whose job rewards visible size, and it would
roughly double the app's scheduling complexity to support a block type you might run once.

---

## Not yet verified

Image-only pages I have not transcribed. Check these before implementing anything that
depends on them:

- Grey Man loading grid (p45–50)
- Gladiator grid (p51–54)
- Fighter HT (p55–57)
- Specificity Alpha and Bravo (p67–83)
- Mass Protocol's conditioning session list — whether it differs from TB2's vault
- Nutrition Formula 2, for trainees starting overweight
- Ageless Athlete's Old Warhorse progression table

---

## Addendum (2026-10-02) — what Operator I/A actually costs

Re-read of pp. 75–78 after the first pass. The entry above files I/A under "flexible set
ranges", which is the smallest of the three things it changes. The book's spec:

- Three workouts at 75%, three at 80%, three at 85/90% — **nine sessions to a wave**, two
  waves to a block, then test or force progression. Five reps in the 75–80% range, three in
  the 85–90% range, and whether 90% happens at all is the trainee's call.
- **Up to ten sets per lift**, against standard Operator's fixed sets.
- A **floating 48–72 hour** gap between sessions.
- For the kettlebell accessory work, I/A uses **70–80–90** rather than the standard
  75–85–95 (p. 93).

### The part that is not a parameter change

I/A's unit of progression is the **session**. This app's is the **date**: everything descends
from `idxOf(date)` → `weekOf` → `wkRx(wk)` → `plan.wave[wk.w-1]`. Under I/A a session's
percentage depends on how many sessions have been logged, not on today's date. That inverts
the primary key, and with it `freezePast()` (locks maxes on `w===6`), `easyCondWeek()`
(defined as `tier()==='heavy'` over a six-entry wave), `dayPlanSlot()`'s seven-day array, the
plyo phases and the week grid. A 72-hour gap across three sessions spans nine days, so the
existing within-week `dayOrder` reordering cannot express it either.

That calendar-as-index choice is also *why* all of those features were cheap. Trading it for
I/A would be a bad deal.

### Worth recording: I/A tests twice as often

Two I/A waves is 18 sessions. A standard Operator block is 6 weeks × 3 = 18 sessions, and our
`testEvery:2` means testing at 36. So `testEvery` would not carry across; anyone running real
I/A retests at half the session count.

### What we shipped instead, and why

The three loosenings separate cleanly. Variable sets and friendlier percentages are nearly
free — 1.32 does the first, and the second was always just data in the Setup wave table.
The floating schedule is the expensive one, and we left it.

The argument is the book's own, not convenience. Madden recommends I/A as "close to the ideal
for the ageless athlete" and then does not run the floating part (p. 77):

> You don't need to take 72 hours of rest between your Operator I/A workouts. That's just a
> card you have up your sleeve. For the most part I still take 48 hours... it works to keep
> the three sessions/week schedule in place. The variability for the intensity/reps/sets is,
> however, **absolutely integral** to my approach now.

Fixed calendar, variable volume. That is what the app now supports.

**Update (1.33):** the ceiling alone still meant a trip to Setup, which is the opposite of
deciding in the gym. A `+` on the lift card and in the session stepper now adds a set to the
day's log (`lifts[k].extra`), leaving the program alone. Setup's **Up to** stays as the way to
declare a standing I/A-style range for a week; the `+` is the per-session decision the book
actually describes.

**Still not supported, and deliberately:** session-indexed waves, the 48–72h float, the
nine-session wave shape, and the 70–80–90 accessory ladder. Anyone wanting real I/A should
know the app will not keep their place.

