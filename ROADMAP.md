# Roadmap

What's built, what's open, and what might come next for the Operator + Black app.
Update it as things ship. Last updated 2026-10-16.

This file is the working record, written for whoever is building. The user-facing
summary of each release lives in `public/releases.js` and shows up in the app under
Setup → About this app → What's new.

## Open issues

Genuinely open: things that still need doing or confirming.

- **iPhone testing, still to confirm at the gym:** offline launch, whether the screen
  stays awake for a whole session, and the interval timer on the bike. Confirmed:
  home-screen install, Access login in the installed app, the update banner, rest
  alerts on the lock screen, spoken cues through AirPods with the app open, and the
  rest beep in a real session — **with the ring switch off as well as on**
  (2026-10-16), which the research said was impossible.
- **The timer, on the phone (3.25).** The two-paths bug is certain and fixed; the rest
  is research plus a model, not a device. What to check after a real session: that the
  interval timer's 3-2-1 and its changes sound every time with spoken cues on, that the
  rest beep comes on time, and that it is clearly louder. If anything is still off,
  Setup → Sound → Timer log has the answer — copy it straight after.
- **Does the coach give good advice?** The agreed gate for letting it apply changes
  rather than only suggest them. **2026-10-20: "OK so far, still evaluating."** It
  needs a few more weeks of reading what it said against what happened.
- **TB1's text still has ~139 run-together words** ("onlyapplies", "strengthmay") from
  the extractor dropping spaces at line wraps. 3.18 repaired every escape and the joins
  after punctuation and digits; these need a vocabulary to split, and a vocabulary gets
  "counterproductive" wrong as readily as it gets "strengthmay" right. They make TB1 a
  little harder for the coach to retrieve, since FTS cannot match "field" inside
  "thefield". The source PDF is no longer on disk, so a clean re-extract is not an
  option either.
- **Conditioning "last/best" across programs** only counts sessions whose format and
  activity are stored. Programs archived by the app stamp them automatically, so this
  only bites on hand-edited history.
- **Not separately confirmed, and minor:** that the beep ducks music rather than
  stopping it. The mid-session half of this is now confirmed — the rest timer sounds
  in a real session, not just from the test button.

## Settled, for the record

Closed. Here because the reasoning is worth keeping, not because anything is pending.

- **The rest beep works. Confirmed on a phone 2026-10-14**, ring switch on, through
  Setup → Sound → Test the beep. Four reports and four rounds of work; 1.84 was the one
  that landed, after settling the why (iOS audio sessions are exclusive or mixable,
  never both, and the web has no `mixWithOthers`), making it a three-way choice
  defaulting to ducking, undoing the `playback` regression 1.79 introduced, and fixing a
  real fault where an `interrupted` AudioContext was never woken.
  - **What "confirmed" covered, 2026-10-19:** the Test button, which only ever ran
    `beep()`. The interval timer and the guided holds had a second path, `tone()`, with
    none of these fixes. Merged in 3.25; see the shipped entry.
  - **Correction, 2026-10-16: it is audible with the ring switch off as well.** The
    entry above said that was impossible for a web app, which is what the research
    said and is apparently not what happens on this device — reported after a real
    session. Not chased further: the `takeover` mode's media clip exists precisely to
    beat the switch, and a home-screen web app may be treated differently from a tab.
    The Apple Watch tap is no longer needed as a workaround.
- **The calendar works. Confirmed 2026-10-16**, rescheduling included. It had been
  reported as not working well, and the cause was what it looked like: the adjacency
  rules were refusing most swaps, nearly all of them on rules that were ours rather
  than the books' (3.3). The three-way chooser and dragging came in the same week and
  helped, but the refusals were the problem.
  - Worth remembering if it ever gets awkward again: the month grid is seven cells
    across a phone, which is a poor drag target, and a week view with full-width rows
    was the next thing to try. It was not needed.
- **Checked against TB1 (3rd ed.) and TB2 on 2026-10-02:**
  - Wave weeks 5–6 are **3×5 @ 85%** and **3×2 @ 95%**. `plan.wave` matches the Operator
    table row for row; the disputed alternative was wrong.
  - **There is no strength deload in the book.** Operator runs six weeks and retests; the
    recovery guidance is a full week or more off every 3–6 months, plus the easy
    conditioning week. Our `2×5 @ 60%` deload is an app addition — kept, because a
    scheduled light week suits a civilian running this year-round, but labeled as ours.
  - **Retest:** rest 2–3 days first, warm up, then ramp per lift to a 3–5RM and calculate;
    a true single is optional. 6 weeks is the minimum between tests, 6 or 12 recommended,
    and waiting longer is explicitly fine. The whole cluster is tested in one session.
  - Still ours, and marked as such in the Guide: the bridge week, the per-day split on
    retest Saturday, and the deadlift's single set on non-cycle weeks.
- **Plyo PDF is a 10-week block with a week-10 jump retest.** The app runs its three
  phases back to back (9-week rotation) and tests jumps in the program's retest weeks
  instead, as the 18-week summary does. Deliberate.
- **Interval alerts arrive 1–3 s late** when the phone is locked (Apple push delivery).
  Fine for minutes-long intervals; on 30 s anaerobic work, keep the screen on and use
  the in-app beeps. Not fixable from the app.
- **Rest alerts fire even with the app open**, so you get the in-app beep and a
  notification together. iOS expects every push to show a notification, so this is
  deliberate.

## Next up

- **TB book coverage is done**, Ageless Athlete included. Twelve templates against five
  protocols, which is sixty combinations and a matrix test over all of them; three Base
  Building variants; two bridge weeks; 3-1-3-1 recovery weeks; TB III's named
  conditioning sessions. The only book content left out is AA's Base Building, declined
  by request, and I/A's floating schedule. Whatever comes next is new ground.
- **Tune the end-of-cycle review after Cycle 1.** Blocked until there is a finished
  cycle. On the current plan (bridge from 2026-09-28) cycle 1 runs 2026-10-05 to
  **2026-11-15**, and cycle 2 begins 11-16. Then check whether the grinder /
  missed-set / heavy-week-RPE thresholds suggested sensible next maxes, and adjust
  `recommend()` if they did not.
- **Zulu's A/B pairs and `orderIssues`.** Closed by 1.77's `strengthA`/`strengthB`, and
  most of what made the warnings noisy went with the adjacency rules in 3.3. Still
  worth a look once Zulu has actually been run, since a four-day template is where the
  remaining strength rule gets the most exercise.
- **Decide on one-tap apply for the coach.** Built read-only on purpose, with the
  response already shaped to carry structured suggestions, so the work is a view
  change rather than a rewrite. Waiting on a verdict about the advice, not on effort.

## Ideas

Not committed to. The technical ones first, because they protect what is already built;
within each group, roughly in order of how useful they'd be.

### Technical

- Nothing open here. The Worker is tested end to end, push included (3.30).

### Training and UX

- **Shorten Today on a lifting day.** Check-in, week summary, weekly check-in, PR card,
  then the session. Once a session is under way the cards above it are noise — collapse
  them, or jump straight to the first lift.
- **Share with a partner or coach:** opt-in, read-only progress view.
- **Half-minute rest options** (2:30, 3:30) in the per-lift rest picker.

## Parked

Decided against for now.

- **Spoken cues with the phone locked.** Closed 2026-09-30 as an iOS limitation.
  Notifications are delivered correctly to the lock screen, but Siri's Announce
  Notifications never reads them: iOS announces only Time Sensitive notifications and
  direct messages, and a web app cannot mark a notification Time Sensitive. Verified
  with AirPods Pro, the app enabled in the Announce list, and a unique tag per
  notification. Nothing further is available from the app side.
- **Locked-phone audio track.** Built and tested (one pre-rendered 8 kHz WAV per session
  from tones plus `say`-generated clips; the 100-second test played correctly with the
  phone locked), then removed at the user's request — it pauses music and is the wrong
  trade. See commit a983b65 if it is ever wanted again.
  **What works instead:** in-app spoken cues whenever the screen is on, with Auto-Lock
  set to Never for a session.
- **A native iOS app on TestFlight.** Tabled 2026-10-14: the web app does what is
  needed. The analysis is worth keeping because the conclusion was not the obvious one.
  - **The backend would not change at all.** The Worker, D1, KV, R2 and the Durable
    Object are untouched by any of this. "Architecture" here means the client shell.
  - **A WKWebView wrapper would lose push, not gain it.** Web push works on iOS only
    for home-screen web apps, which is why rest alerts reach the lock screen today. It
    does not work in a WKWebView, so wrapping would mean rebuilding alerts on APNs
    first. `webpush.js` is 95 lines and an APNs version is comparable; the Durable
    Object scheduling would be unchanged.
  - **Audio is the one real win.** Native `AVAudioSession` gives `.playback` +
    `.mixWithOthers`, which is exactly what the web platform refuses and what cost four
    rounds of work on the beep. A wrapper could beep over music *and* handle the ring
    switch properly. If this is ever revisited, that is the reason.
  - **Auth is the friction.** Cloudflare Access's SSO redirect needs a persistent
    `WKWebsiteDataStore` and probably `ASWebAuthenticationSession`. Cleaner: issue the
    app a long-lived device token the Worker validates, keeping Access for the browser.
    This is the only part that touches the Worker.
  - **Keep loading the live site** rather than bundling `public/`. Bundling makes
    offline unconditional but puts every change behind a TestFlight build; loading live
    keeps `npm run deploy` working as it does now, which is what makes this app quick
    to iterate on.
  - Rough effort: a weekend to get a build on a phone loading the live site with push
    punted, another two or three days to do push and audio properly. TestFlight needs
    the Apple Developer Program ($99/yr); internal testing skips App Review.
  - **Not worth considering:** a native rewrite. 7,376 lines of scheduling engine and
    284 tests, discarded, and the only things it buys over a wrapper are Apple Watch,
    HealthKit and background execution.

## Shipped

Newest first. The user-facing version of each entry is in `public/releases.js`.

**Settings done in Cloudflare**
- Deploys: closed as not needed. Changes go live with `npm run deploy` (wrangler,
  tagged with the commit). Pushing to GitHub does **not** deploy on its own; the
  Workers Builds connection has never triggered (last checked 2026-09-29).
- Access session duration set to 1 month. To add a person: Zero Trust → Access →
  Applications → Operator Black → policy → add their email (details in README).

**Treatment B, everywhere it applies (2026-10-20)**
- Asked for after 3.32 put B on the Macros card alone. "Everywhere" needed a definition,
  or it becomes restyling everything. B is three things, and each card gets the ones
  that fit:
  - **A number against a target** reads as value over target: the value that changes
    big, the target as caption, a bar toward it, the verdict in words and color.
    Sessions this week, readiness out of 100, calories eaten against the Macros card's
    target, last week's summary on Today, the pull-up best set against the next rung.
  - **A number with a direction and no target** gets the typography and a colored
    verdict, and **no bar** — a bar would invent a target. Strength maxes, bodyweight,
    body fat, climbing. Bodyweight and body fat are judged against the goal set in Setup
    (`trendTone`): "Gaining, as planned", "Losing while building". The "holding" bands
    are ours; the books set no weekly rate.
  - **Advice with an action** gets its own card. Only Macros has one on Status today.
- **Left alone, deliberately:** countdowns to the next cycle (no target, no direction),
  checklist counts in card headers (a bar on every header is clutter), session mode
  (it has its own progress bar) and History (the tables tab).
- **One function, `bRow`**, renders every one of them, Macros included — refactored first
  and checked against the existing Macros tests, so the helper was proven faithful before
  anything else moved onto it. Treatment A's row styles have no users left and are gone.
- **This week lost its "Last 4 weeks" tile**: the Keeping up verdict at the top says the
  same thing in words. One fact, one place.
- A test reads every rendered row on Status and Today and fails on a bar without a
  target beside it. Eight tests, eleven mutants, all caught; two verdicts survived the
  first pass until the words themselves were asserted.

**The Macros card, treatment B (2026-10-20)**
- From the mockup liked on 10-16. **Eaten is the big number and the target its
  caption** ("200 / 240 g"), because eaten is what changes day to day; **a bar per macro**
  so short or on target reads before anything is read; **the advice is its own card**
  with the action as a full-width button.
- **One change from the mockup:** it carried short / over / on target in bar color
  alone, which WCAG 1.4.1 rules out. Each row keeps the verdict in words beside the
  bar, in the same color — "40 short" is still the answer to the question the card is
  asked. Over is yellow now rather than short's red: over and short are different news.
- **Which days the averages cover is in plain sight**, not behind the disclosure as in
  treatment A: once the average is the headline, what it is an average of has to sit
  beside it. That was the 10-16 ask in the first place. The disclosure keeps only the
  formula.
- Two things nearly lost in the rewrite and restored, both caught by old tests: "Too few
  to read much into" on a thin window, and the empty-state wording that the grams belong
  to the day before.
- Done to this card only at first; 3.33 took it to everything it applies to.
- Three tests, five mutants, all caught. One new test had an early return that could
  have passed while testing nothing; it is an assertion now.

**The grey wall, and a type scale by decision (2026-10-20)**
- **331 lines were the same 13px grey**: what a card is for, what to do next, a count, a
  unit, where a number came from — all at one weight, so nothing told the eye where to
  land. Measured first, which made the split obvious: long `<p>` and `<div>` lines were
  almost all explanations (134), short `<div>` and `<span>` lines almost all captions.
- **Two tiers now.** An explanation is a `.note`: 14px, in a new `--ink-2` tone. A
  caption stays 13px muted. Contrast picked by the numbers, not by eye: notes 11.2:1
  light and 10.4:1 dark (AAA), captions ~6:1 (AA), body ink 14–17:1 — three tiers
  far enough apart to tell apart.
- 130 explanations converted, by length from the source, then checked against rendered
  Setup, Status, History and the Guide: of 67 rendered notes only two were short, and
  both were real explanations. **Provenance and caveats stay grey on purpose** —
  "Ours, and so is the deload week", "The book's own caveat", "so these are ours" —
  because an aside should read as one.
- **Thirteen font sizes instead of twenty-five**: 11/12/13/14/15 for text,
  16/18/20/22/26/34/44/52 for display. Odd half-pixels rounded up, never down, so
  nothing got harder to read; the rest-timer digits went from 48 to 52.
- **Fixed on the way, from 3.28:** a rated set button read "SET 1 · FAST", which does
  not fit a 56px button. The rating now takes the set number's place on screen, and the
  label a screen reader announces keeps both.
- Four tests, six mutants, all caught: sizes on the scale everywhere, the three tiers'
  contrast ordered and spaced in every theme block, no long explanation left grey.

**Push has tests, and the crypto is checked against the RFC (2026-10-20)**
- The last part of the Worker without tests, and the part that fails silently: if the
  encryption or the VAPID signature is wrong, the push service rejects every alert and
  the app says nothing — the rest just ends quietly on a locked phone.
- **The decryptor in the test is written from RFC 8291, not from `webpush.js`, and is
  first made to reproduce the RFC's own worked example value for value** — the ECDH
  secret, both PRKs, the IKM, the CEK, the nonce and the plaintext ("When I grow up, I
  want to be a watermelon"). Only then is it used to read what `webpush.js` produces.
  A round trip against a decryptor written from the same understanding would only
  prove the two agree with each other.
- Checked: a fresh salt and sender key per message; the wrong browser's keys fail
  authentication; the VAPID token verifies with ES256 against the server's key, its
  audience is the push service's origin rather than the endpoint, and it expires inside
  RFC 8292's 24 hours; TTL, Urgency and Topic go out as intended.
- **The Durable Object**, loaded with its `cloudflare:workers` import stubbed the way the
  app harness evals the app: subscriptions must be https with both keys; a schedule
  replaces the queue, sorted, and refuses anything stale, more than two hours out or
  over eighty whole; the alarm sends only the newest due alert, decrypted correctly on
  every device, then re-arms for the rest; 404 and 410 drop a device, a 503 does not.
- Twelve tests, eighteen mutants, all caught.

**The retest planner (2026-10-20)**
- Retest week already split its tests, but by hand: Thursday was hardcoded to squat and
  bench, Saturday took the last two, and Friday took whatever was left over — so with
  four or more Lift 3 variants Friday could be asked for three or more. TB III's bridge
  week did not split at all: its second test day took every remaining lift.
- **`testSplit(days)`, one planner for both.** At most two lifts a day while the days
  allow it, three only when they do not. Squat and deadlift never on the same day. The
  bridge week's pairing: squat with bench, deadlift with Lift 3, and a Lift 3 that does
  not fit overflows to a later day before it crowds squat and bench. Spare days fall
  between test days rather than after them, so each test day comes off a rest.
- **No change for the usual four lifts**: Thursday squat and bench, Friday off, Saturday
  deadlift and Lift 3 — exactly as before. Jumps go with the first test day, the
  pull-up test and the results button with the last.
- Ours, as the split always was: TB1 tests the whole cluster in one session. Split
  because tired singles measure fatigue rather than strength.
- The squat/deadlift rule holds by construction — squat opens the first test day and
  the deadlift opens the next — so the separate guard was unreachable and a mutant
  deleting it survived. Removed; a test checks the rule across every Lift 3
  combination and both week shapes instead.
- Five tests, seven mutants, all caught.

**Per-set effort, in the books' words (2026-10-20)**
- Every working set can be rated **Fast, Solid or Ground**. Built now because cycle 1
  ends 2026-11-15, and the review at the end of it is the thing this feeds.
- **No RPE.** None of the four books uses RPE or reps-in-reserve, so the scale uses
  their words instead: TB1's Golden Rule (every rep completed, no failure, and "if you
  feel relatively fresh after your strength session, you are doing it RIGHT") and
  Ageless Athlete's warning that grinding on day one makes day two worse. Ground is the
  books' word; the three-point scale is ours.
- **In session mode the rating is the Done tap**: Fast, Solid or Ground logs the set and
  moves on, so rating costs nothing. Done alone still works. Re-rating a set already
  logged only changes the rating. On the day card, the set just ticked gets the rating
  row, and each rated set button says how it went.
- **`ground()` is the one answer to "did it grind"** — the old whole-lift checkbox, or
  any set rated ground — read by the review, the "max is too high" banner, Status,
  aims, the check-in's next-day suggestion, the finish card and the export. Old logs
  keep counting. The checkbox only shows on a day that already used it, so it can be
  cleared.
- **The review gets real heavy-week evidence.** With four or more rated heavy sets,
  three in four fast means room for the bigger jump; fewer fast is on track. That
  outranks the session RPE, which was one number for the whole session and is now the
  fallback when there are too few ratings. Light-week sets count as nothing here: fast
  at 70% says nothing about whether 95% has room. Thresholds are ours.
- The coach sees each set's rating ("3 (fast, solid, ground)") and the export has a
  `set_effort` column, with the test rows padded so every row still lines up.
- Housekeeping: the Parked "AI coach not feasible" entry is gone (it is built), and
  TB1's remaining word joins are tracked as an open issue.
- Nine tests, thirteen mutants, all caught.

**Carries last, core just before them (2026-10-20)**
- Corrected the same day: heavy carries always go last; core work goes last otherwise.
  So a session runs everything else in your order, then core, then carries. 3.26 had
  put core after carries, which started any hanging core work on a fried grip.
- `accRank` gives each superset group a band — carry, core, or neither — and the sort
  is stable inside a band, so everything else keeps the order you set. A pair with a
  carry in it goes with the carries, whichever half the carry is.
- The whole carry slot counts, dead hangs and plate pinches included: they cost the
  grip the same way, which was always the slot's reason for going last. Its note says
  "Last" again.
- Four tests, four mutants, all caught.

**Core work last, and the ab triad (2026-10-20)**
- **Core work runs last in a session**, wherever the day lists it. Asked for, and it is
  where TB III puts abs too: its strength-endurance circuit runs *"bench press...
  squat... finish up with RDL and abs."* A tired trunk is a worse brace for everything
  after it. `accRunGroups` does it on groups rather than slots, so a superset with core
  in it — as either half — moves as a pair instead of being split. Setup keeps the
  order you set, because a pair is defined by which job comes next there; re-sorting
  that would re-draw pairs. Setup says core runs last so the two orders are not
  mistaken for each other.
- Both places that run a session's accessories — the day card and session mode — use
  it, and a test reads the order off each and asserts they agree, because two places
  disagreeing was the heavy-week bug.
- Carry used to say it went "Last". Only core comes after it now, and it says so. Worth
  knowing: a hanging core movement after carries starts with a tired grip.
- **The ab triad**, added as a core option: 3–5 rounds of 5 hanging leg raises, 5
  hanging knee raises, 5 toes-to-bar. Asked whether TB III had it: searched the full
  text in every spelling, then pulled the six image-only pages straight out of the PDF
  (they are pull-quote boxes). It is not in TB III. **It is from a book not in the
  library**, and it is recorded exactly as given — no rest, tempo or progression was
  given, so none is shown, and a test fails if one appears. The row says where it came
  from and that each round logs as a set.
- Found on the way: the extractor drops pages with no text and **renumbers the rest**,
  so a "page N" in a library extract is the Nth page with text, not the PDF's page N.
  Six TB III pages are image-only; they are pull quotes, so nothing was lost this time.
- Eight tests, seven mutants, all caught.

**The timer, taken apart again — and louder (2026-10-19)**
- Reported as "still very inconsistent", with a request to research properly before
  touching it. Researched first: the code, then WebKit bug reports and the Audio Session
  spec, then a model of what a phone speaker does to each tone.
- **There were two audio paths, and every beep fix had gone into one of them.** The rest
  beep, its warning and the generic timer used `beep()`, fixed four times. The interval
  timer (every change, the 3-2-1, the finish) and the guided holds used `tone()`, which
  had none of those fixes: it returned silently with no channel, never woke an
  `interrupted` one, and scheduled against the stale clock of one still waking. The Test
  button only exercised `beep()`, so "confirmed working" was true and said nothing about
  the rest. **Now one engine, `sfx`, and a test fails if a second place ever makes a
  tone.**
- **The spoken warning could cost you the end beep.** Developer reports show
  `speechSynthesis` parking an iOS audio context at `interrupted`, and a wake without a
  tap is unreliable. Before the warning existed the only speech came after the beep, and
  each rest began with a tap that woke the audio. "Ten seconds", spoken mid-rest, was the
  one sound between that tap and the end. **The warning is a tone only now** — it was
  never asked to speak; that was mine.
- **Keeping the channel awake.** A state-change watcher wakes it the moment it leaves
  `running` while the app is on screen — three tries in ten seconds, then it waits —
  and **every tap anywhere wakes it**, because a tap is the one moment iOS reliably
  honours a wake. In a session that is every Done. Speech never starts while a tone is
  sounding; `say()` waits it out.
- **Low Power Mode made late beeps look like missing ones.** iOS can refuse the screen
  lock; the screen sleeps, the page stops, and a beep sounds whenever the phone is next
  woken. The rest bar now says *Screen may sleep* when that happens.
- **Louder, measured.** Each note used to rise in 20 ms and then decay exponentially by
  74 dB, about **12 ms at full volume** — a blip. Held and released in 40 ms, the same
  note carries sixteen times the energy: +12 dB on its own. Peak 0.5 → 1.0: +6. And the
  tones below 1 kHz (the warning, the interval's easy cue, switch sides) got their 2nd
  and 3rd harmonics, because a phone speaker loses ~12 dB per octave below its ~1 kHz
  resonance; the 587 Hz warning was losing ~12 dB in the speaker alone, at 70% of the
  finish's gain. Modelled against a speaker-plus-A-weighting curve: **+15 to +27 dB per
  sound, every pitch unchanged.** +10 dB is roughly twice as loud. The model is a model;
  the phone is the test.
- **A timer log** in Setup → Sound: the last eighty events — each sound and the channel's
  state when it was asked for, how late each rest's end was noticed, screen lock
  granted or refused, the page hiding and returning. Five reports, four fixes; the next
  one should come with what happened.
- The harness learned to fail the way the phone does: interruptions, a refused wake, a
  wake that resolves but leaves the channel parked, gain envelopes, harmonics, speech
  and taps. **Four reproductions were written first and failed against 3.24.**
- Seventeen tests, seventeen mutants, all caught. Five survived the first pass — among
  them the speech deferral masking a returning spoken warning, because the test looked
  before the tone had finished.

**The movement library, mid-session (2026-10-19)**
- The descriptions existed but only on the day's card. Asked for them during a
  session, which is the screen you are actually looking at while doing the movement.
- **In the guided walkthrough**: a *How to do it* button under the timer, opening the
  same setup / execution / cues / errors panel. Off by default so it does not push the
  timer off a phone, and the choice follows you from one movement to the next —
  someone learning a routine wants it the whole way through, someone who knows it
  never wants it. Capped at 34vh and scrollable so a long entry cannot bury the
  controls.
- A movement with no entry gets no button rather than an empty panel, so a warm-up
  movement you typed in yourself offers nothing and claims nothing.
- Session mode's warm-up step keeps its list, since it already has *Guide me ›* to
  reach the one-at-a-time screen. It did still print "12–15 min" for every routine,
  left over from before routines existed; it asks the routine now.
- `gdHow` is a named function rather than a line in the click handler, which is the
  same lesson as `calSetMode` and `setMacroWin`: a handler is unreachable from the
  harness, and the mutant that stopped the toggle working survived until it was
  pulled out.
- Four tests, five mutants, all caught.

**Descriptions for the Agile 8 (2026-10-19)**
- Asked for a description of every movement in both routines. Ours already had one:
  all fourteen resolve to a movement-library entry with setup, execution, cues and
  common errors, reached from the little **i** on the row. Agile 8 had none, which is
  almost certainly why it looked as though neither did.
- Eight entries added, and the sourcing is the point. DeFranco describes the two foam
  rolls, the tennis-ball position, the groiner cue (*"use your upper arms to push your
  knees outward while you drop your butt down"*) and the one-side-at-a-time hip flexor
  hold, so those follow his text. His note on the glute release is kept whole: *"Feel
  free to cry."*
- **The rollovers, the fire hydrants and the mountain climbers he shows in a video
  rather than describing**, so those three carry the standard form of a common
  movement and their note says exactly that instead of passing it off as his. A test
  asserts the disclaimer is on those three and on no others.
- Last release said writing cues for someone else's routine would be inventing them.
  That still holds — the answer was to source them rather than to go without.
- They sit in the Guide as one group, *Agile 8 · Joe DeFranco*, rather than scattered
  through the existing ones, because it is one named routine by one author.
- Nothing is invented for a movement you typed in yourself: a custom warm-up movement
  has no entry and no panel, and a test asserts it.
- Three tests, four mutants, all caught. The existing "every entry is reachable from
  the Guide" test caught the new entries before I noticed they were orphaned.

**The warm-up is a choice now, and says whose it is (2026-10-19)**
- Asked how we decided the warm-up. We did not — **it is entirely ours**, and nothing
  said so. None of the fourteen movements appears in any of the four books: zero hits
  for 90/90, couch stretch, cat/cow, thread the needle, open book, world's greatest
  stretch. It predates the source-file split, so no commit explains it either.
- What the books give: TB1 a general temperature raise and warm-up *sets* (*"Kane jogs
  slowly on the treadmill for about ten minutes"*), TB3 *"do warm-up sets as
  required"* plus stretch longer if sore, TB2 nothing. Ageless Athlete is the only one
  to raise the subject and it hands the choice over: *"If you have a flexibility or
  mobility protocol you like to follow (not a bad idea), incorporate that as much as
  you like."* So ours contradicts nothing — it fills a gap the books leave open on
  purpose, which AA sanctions. It just never said so.
- **Three routines**: ours, DeFranco's Agile 8, and your own. Setup picks one and the
  card names it.
- **Agile 8 is the original**, from *Training Rules for Washed-up Meatheads*, at his
  doses. Checked against three sources because copies disagree: several swap in frog
  jumps or a bent-knee iron cross, and the first page I found had frog jumps. The
  original has mountain climbers and neither of those. A test fails if a variant's
  movement drifts in.
- **90/90 breathing and the hip switches are in every routine**, by request. Ours
  already contains them in their own positions, so that list is byte-identical and
  every tick logged against it on a past day still lines up; the other two get them
  prepended.
- **Your own** is stored like the mobility lists — one movement per line, dose after
  a comma. No dose guidance and no short version invented for it.
- The short version belongs to the routine, not to whichever items carry the flag: the
  core pair is marked short, so inferring it would have offered Agile 8 an empty
  *"Short · "* button.
- **Four readers, all moved together**: the card, the guided walkthrough, session mode
  and the warm-up aim. A test asserts they agree, because the heavy-week rule shipped
  broken from being fixed in one of its three homes.
- Switching routine clears the day's ticks, since they are an index into the list.
- Agile 8's movements have no entry in the movement library, so they carry no cue
  panel. Deliberate: writing coaching cues for someone else's routine would be
  inventing them.
- Five tests, six mutants, all caught.

**The Easy Week Principle, at the book's number (2026-10-19)**
- TB2, under *Black Protocol — Easy Week Principle*: "Every third week, (3, 6, 9)
  make your conditioning sessions easy. **Cut the number of rounds in half**, lower
  the duration and/or intensity. Don't strain — just 'grease the groove' with little
  effort."
- The timing was already right. The same page says the easy week "purposely coincides
  with Tactical Barbell's strength training heavy weeks (90%-95% loads)", which is
  exactly how `easyCondWeek` finds it. The amount was wrong: `ease` took the lowest
  **prescribed option**, and for `map`, `anaerobic`, `threshold` and `long` the lowest
  option is the default — so on four of seven formats the easy week changed nothing
  while the card said *"fewer rounds, shorter sessions. This is deliberate."*
- `easeRounds` separates the two reasons to go easier, which had been one flag.
  **Halving is the book's**, for the easy week. **The lowest option is ours**, for a
  day when readiness came back under par. When both apply the lower wins, so a soft
  day in an easy week is not harder than either alone.
- It halves *your* round count, not the book's default, so a number set in Setup is
  still the thing that gets cut.
- Odd counts round up: the book says grease the groove, not stop.
- FOBBITs were already fine — they are chosen in minutes from a short list the book
  gives, and the shortest is genuinely below the default in every case, so an easy
  week has always shortened them.
- Four tests, five mutants, all caught.

**The deload rule, checked (2026-10-19)**
- Same audit as the heavy week, opposite result. Both books that use the word mean a
  harder stop than we do: TB3's deload is the bridge week, *"simply taking a week off
  in between Blocks"*, and Ageless Athlete takes *"a complete deload from lifting (and
  a deep reduction of conditioning)"*. Dropping the supplementary work while keeping
  three light sessions is the gentler version of that, not a departure from it. Kept.
- What was wrong was the wording: *"None this week. Deload."* stated flat, exactly the
  register the heavy-week rule used. It now says it is ours, and that the deload week
  is ours too — TB1 prescribes no strength deload at all, which the roadmap already
  recorded but the card never did.
- The test asserts session mode agrees with the card, since that is what went wrong
  with the heavy-week fix.

**The same rule, in the two places I missed (2026-10-19)**
- The card stopped gating accessories on the heavy week; session mode and the week
  summary did not, so on weeks 3 and 6 the accessories were on the day's card and
  absent from the walkthrough. Fixing a rule in one of its three homes is not fixing
  it, and only the card had a test.
- `lsSteps` dropped the accessory steps on any heavy week — and, unlike the card,
  dropped them for a template that programs its own supplementary work too, so Grey
  Man's prescribed sets disappeared from the walkthrough on weeks 3 and 6.
- It respects the day's skip instead, which is the decision that actually exists: skip
  them on the card and the walkthrough does not march you through them.
- The week-ahead line said "Accessories are off." It now says they still run, and to
  cut them back if they start costing you the main lifts — TB1's test rather than ours.
- Four tests, three mutants, all caught. The first version of the week-summary test
  passed for the wrong reason: it searched the whole file, and the comment explaining
  the removal contains the old wording, so it now reads the pushed string instead.

**The TB1 extraction, and two things it got wrong (2026-10-19)**
- Asked whether the books say to skip accessories on the 3×3 weeks. They do not, and
  finding that out turned up why two earlier answers were wrong.
- **Root cause.** `library/tb1.txt` carried its special characters as BEL- and
  NUL-escaped sequences, which made the file binary. `file` called it *data* and plain
  `grep` printed nothing for every pattern. Zero matches read as an answer. Two
  conclusions were drawn from those zeros and both were wrong: that TB1 says nothing
  about accessories (it has 18 mentions) and that it prescribes no supplements (it has
  a full chapter).
- `tools/tb1repair.py` maps the eight sequences back. The mapping is pinned rather than
  guessed: the file held 51 `(` and no `)` against exactly 51 NUL-\f, and no `%` at all
  against 53 NUL-\b, in contexts like *"4 sets of 3 reps at 90[%] of your maximum"*.
  It also restores the 777 spaces lost after punctuation and digits. ~139 lowercase
  word joins are left and deliberately not touched: splitting them needs a vocabulary,
  and a vocabulary gets *counterproductive* wrong as readily as it gets *strengthmay*
  right. The library was rebuilt and reloaded into D1: 117 chunks.
- **A test now fails on a control character in any book file**, and a second asserts
  TB1 still contains `90%`, balanced brackets and real apostrophes. Both no-op where
  `library/` has not been built.
- **Accessories on a heavy week.** The skip was ours and read like the book's. TB1's
  actual rule is a test about recovery, not a calendar slot: *"If your accessory work
  is interfering with your recovery to the point it's affecting your main lifts, then
  you're not doing it right. Cut back or eliminate it."* Its only weeks-3-and-6
  concession is to the **main lift** — drop a set if the volume is too much — and the
  reason it gives is a gruelling conditioning session. So the week no longer decides:
  the accessories are shown with the book's test quoted, our part labelled **Ours**,
  and a one-tap skip on the day. A template that programs its supplementary work gets
  no note, because the book already decided.
- **Supplements, corrected.** TB1's chapter is the general one, not mass-specific, so
  creatine, protein, magnesium and caffeine are no longer mass-only — on an Operator
  cycle creatine now reads *TB1 and TB3 · highly recommended* instead of *for building
  mass*. Four entries added from TB1: zinc/ZMA, vitamin D, B complex, fish oil, with
  the author's own skepticism on the last two carried rather than smoothed off.
  Multivitamin stays mass-scoped because the books genuinely disagree — TB3 Level 1,
  TB1 *"I am just not sure that is worth it."*
- **Level 1 and Level 2 are TB3's scheme and nobody else's.** TB1 recommends in prose
  and TB2 says only that supplements "can be helpful"; both had been stamped with TB3
  levels. A test now fails if an entry carries a level without TB3 in its source, and
  "mandatory" only appears on a mass template.
- **Protein powder is off the list**, by request: it is food rather than a supplement,
  and the app already tracks protein as a macro with a target of its own, so ticking it
  here counted the same thing twice. The books do list it, so the card says why it is
  absent and labels the decision as ours. A tick left over from before is ignored
  rather than sent to the coach as something the user added themselves.
- Nine tests, twelve mutants, all caught.

**Supplements, out of the books (2026-10-19)**
- Asked for, and the books turned it from a checkbox list into something with content:
  TB3 has a whole Supplements chapter with Level 1 and Level 2, doses and timing, and
  TB2 has its own list for carrying a conditioning load. TB1 prescribes none and AA
  names the practice without naming products, so neither adds an entry.
- **Level 1 is mandatory only in the context it was written for.** TB3's list is
  explicitly "in the context of building mass", so on a mass template creatine reads
  *the book calls it mandatory* and on an Operator cycle it reads *TB3 Level 1, for
  building mass* — on offer, not prescribed. TB2's conditioning entries swap in.
- **Free text, by request.** Anything the books do not cover goes in a list of yours,
  marked *Yours*, with no dose and no level, because inventing either would be putting
  words in the book's mouth. The card says that is why.
- **Pre-training ones are on the session card**, not the check-in: caffeine and
  citrulline have windows in front of training (20–30 and 30–45 minutes) and a tick
  in the evening would mean nothing.
- **Creatine gets a streak** because that is what the book ties it to: *"you won't
  know you're a non-responder unless you try it for at least a month or two without
  skipping doses."* Today does not break the run until the day is over.
- The physician caveat is carried through from the book rather than dropped.
- The coach sees what you take and how many of the last 28 days you actually took it,
  with names rather than ids, and a flag saying whether each came from the books — so
  it cannot hand your own supplement back to you as the book's advice.
- Removing one from Setup stops it being offered and leaves the days you already
  logged it on alone.
- Ten tests across both suites, eight mutants, all caught.

**Last time, next to this time (2026-10-19)**
- Accessory sets were logged and never read back, so every session started from
  nothing and progressive overload was a memory exercise. Each slot now carries one
  line: *Last time, Fri 11/6: 50 × 12 · 45 × 10*, sitting above the set rows where
  the numbers get typed.
- **Matched on the movement, not the slot.** Swap the lat pulldown for a chin-up and
  the pulldown's numbers would be the wrong thing to chase, so a swapped slot shows
  nothing rather than something misleading.
- A session where the rows were added and left blank is skipped, so an abandoned entry
  does not become the number you are trying to beat. The most recent real session wins.
- Reads the way a set would be written: `60 × 8`, `12 reps` for unloaded bodyweight,
  `+25 × 8` for a loaded one.
- Five tests, six mutants, all caught. One survived the first pass: with a single
  session on file, newest-wins and oldest-wins are the same answer.

**The three verdicts at the top of Status (2026-10-16)**
- Pass two. Status presented evidence and left the reading to you; it now answers
  three questions first and keeps the evidence underneath.
- **Keeping up.** TB2: *"Don't miss a single conditioning session, and don't miss a
  single strength session... Many overestimate how consistent they are, and tend to
  miss more sessions then they think."* So it counts missed sessions against a
  standard of none and says what the standard is, rather than grading 67% as
  "needs work". Ours: two missed in four weeks is yellow rather than red, and a
  program with fewer than four sessions behind it is not judged at all.
- **Progress.** TB2: *"Compare yourself with yourself no earlier than every six
  months. Make no judgments until six months are up... Anything less is a waste of
  time."* A four-week progress verdict is exactly what a fitness app would draw here
  and exactly what the book forbids, so this line is a clock to the six-month mark
  plus an inventory of what has actually been measured. At the mark it changes job
  and says compare.
- **A projected max is not evidence.** Only a number someone entered counts as
  measured — a `proj` max is the increment doing arithmetic and a `lock` is that
  arithmetic frozen. The line says so when nothing has been retested.
- **Watch.** Pain, a readiness drop of ten or more against the week before, and three
  or more grinder sets. The most serious leads and the rest are kept in the sentence.
  The standalone pain banner folded into this.
- The rest-day flag was designed and then dropped: you cannot mark a scheduled rest
  day done, so it would have been dead code.
- Six tests, twelve mutants, all caught. Two survived the first pass — nothing
  exercised the readiness drop, and the ordering test had only one flag in it.

**Status says where you are, History says what happened (2026-10-16)**
- First of two passes on the Status tab. The tab had become ten cards and twenty trend
  charts on one scroll, and most of the lines were drawn twice: Status charted maxes by
  cycle, readiness, results per activity and broad jump, while History tabled all four.
- **The split is the fix.** Status answers "how am I doing" and keeps the current number
  and its direction. History answers "what happened" and keeps the line. Four chart
  groups moved: maxes by cycle, readiness over 28 days, results per activity, broad
  jump. Status went from 20 charts to 7, History from 0 to 13.
- The heaviest completed set, and the sentence about a logged weight implying a
  different 1RM, moved with the maxes table it explains.
- **Strength is rows now, not five sparklines** — lift, current max, and green or red
  for where it has gone since C1. The Macros row treatment, reused.
- **One fact, one place.** Readiness was a 7-day tile and a 28-day line four cards
  apart; the tile stays, the line is History's. All-time adherence went, since the
  heatmap beside it already shows the pattern rather than the rate.
- **Reordered to what gets looked at.** Macros, bodyweight and energy used to start at
  96% of the scroll and are now third, fourth and fifth. The pain banner moved above
  the numbers instead of four cards below them.
- Four tests: the two tabs never draw the same line, the lift rows carry a direction,
  readiness is said once, and the daily cards come before the monthly ones. Five
  mutants, all caught.
- **Pass two is the verdict block** — three lines at the top of Status saying whether
  you are keeping up, whether it is working, and what to watch, in words and in color.
  Not started; this pass was the cuts and the reorder.

**Everything you tap is big enough to tap (2026-10-16)**
- Asked for UI/UX recommendations for the app as a whole, not just the Macros card.
  Measured first: the primary button was 38px tall, the small one 30, the segmented
  control 36, a checkbox 18, the week-strip days 30. The guideline is 44, and it
  matters more here than in most apps — this is used standing, between sets, one
  handed, sometimes with chalk on.
- Nineteen selectors raised to a 44px minimum: buttons and small buttons, the
  segmented control, checkboxes and their boxes, nav tabs, the week strip, the
  calendar days, every `<summary>` that acts as a control, set buttons, aims, the
  timer buttons, the account rows and the warm-up remove.
- The silent-mode pill keeps its pill size and carries a 44px hit area on a
  `::after` instead, because a 44px-tall lozenge around 11px text is not the same
  design.
- Five `cursor:pointer` rules are deliberately exempt and the test says why for each:
  a chart's hit band, a row's own name, the 32px header avatar, a word inside a
  sentence and a wrapper around a button.
- **A test reads the stylesheet and fails on anything under 40px.** Widening it
  mattered more than writing it: the first version missed `.btn.sm` entirely, because
  a variant rule carries no `cursor` of its own, and the first height probe matched
  `line-height`. Six mutants, all caught.

**The Macros card, treatment A (2026-10-16)**
- Chosen off three mockups on a canvas. Same tokens, same information, nothing
  invented — the design system applied more decisively rather than replaced.
- **Rows, not a column of three big numbers.** The card is asked "am I short", and
  three headline figures at equal weight did not answer it. Each row is now
  label · target · verdict, with the verdict in words and in color: green for on
  target, red for short or over. The average drops to a caption under it, since it is
  the evidence rather than the answer.
- Both explanations fold behind one disclosure instead of sitting open under every
  card, and the window picker fills the width.
- The 500-calorie action is a full-width primary button rather than a small one.
- **Not a `<details>`.** Open state kept in the DOM does not survive a render — the
  rule the mobility panels already encode — and morph syncs attributes, so an `open`
  the render does not know about would be stripped anyway. It is a button with
  `aria-expanded` and a flag in JS.
- Treatment B — eaten as the headline with the target as caption, progress bars,
  advice split into its own card — is liked and parked, not rejected. It is a change
  of character rather than of styling, so it wants doing to every card at once or not
  at all.
- 323 tests, 6 mutants. Two survived until the color of the verdict and the
  disclosure's own state were asserted rather than just its text.

**Morphing the DOM instead of replacing it (2026-10-16)**
- Every render was `main.innerHTML = html`, which throws the screen away and builds it
  again, losing whatever the browser was holding and the app was not: focus, the caret,
  scroll position, a `<details>` that was open. The app had grown three workarounds —
  saving and restoring the focused element's id and selection around every render, and
  keeping panel state in JS Sets so a re-render could not forget it. The section-header
  bug earlier today was the same tax being paid again.
- `morph(root,html)` walks the new HTML against the DOM already there and changes only
  what differs. Two rules earn their place: an element with an id is matched to the
  element with that id wherever it moved to, so inserting a card above a focused input
  does not replace everything below it; and the value of a field with focus is never
  written, because the render is a keystroke behind by definition.
- **No framework and no dependency.** About 90 lines. Considered and rejected a port to
  a component framework: it would cost weeks, throw away a test harness that evals the
  bundle and calls internals directly, and buy a component model mostly used to
  re-implement what works. This was the one part worth taking.
- Falls back to replacing where there is no real DOM, which is the harness — so all
  319 existing tests went on passing untouched, and the fallback is itself tested.
- The algorithm is tested against a node tree built by hand rather than parsed from
  HTML: a parser is the one part the browser already provides and a test does not need
  to re-implement to check the walk.
- 323 tests, 9 mutants. One survived until a test covered the same tag under a
  different id — reusing one field as another would hand the browser's state for the
  first to the second.

**Setup sections: open state is state, not DOM (2026-10-16)**
- The `<details>` I shipped in 3.8 remembered one open section. Setup re-renders on
  every field change and a `<details>` keeps its open state in the DOM, so opening two
  sections and then typing in a field collapsed one of them.
- This codebase had already learned that with the mobility panels: `openPx` is a Set
  precisely because open state has to survive a re-render. There is even a test
  asserting "no native disclosure to race the re-render" on those rows. The new
  sections now keep a Set in `localStorage` for the same reason.
- The first test of it passed against a mutant that restored only one section, because
  the set is cached and the test never exercised the load path. Fixed by seeding
  storage on a fresh app, which is the only way the restore is actually tried.
- 319 tests.

**Unreadable section headers, and the reason (2026-10-16)**
- Shipped in 3.8 as near-black text on a near-black bar. The CSS I wrote used
  `var(--card,#1c1c1e)` and `var(--fg,#fff)`, and **neither token exists** — this
  stylesheet calls them `--surface` and `--ink`. So the hardcoded fallbacks won, and a
  dark bar got the light theme's dark text.
- The fallbacks were the whole problem. Without them an invented token inherits and
  usually still looks fine; with them it confidently paints the wrong color. Every
  `var()` fallback is now gone from the stylesheet, because every token here is always
  defined and a fallback can therefore only ever be a typo waiting to happen.
- **A test now reads the stylesheet** and asserts that every variable used is one the
  stylesheet defines, that no fallbacks exist, and that the light and dark themes
  define the same set. Checked against the bug: putting `var(--card,#1c1c1e)` back
  fails it.
- Contrast after the fix: 16.7:1 light, 14.0:1 dark, against a 4.5 requirement.
- Worth remembering for the rest of the theme work: I cannot see the rendered page, so
  anything visual needs either a measurement or a pair of eyes. This one was
  measurable and I did not measure it.
- 319 tests.

**Setup in sections, and one tab fewer (2026-10-16)**
- Setup had grown to 27 cards on one scroll, in the order they happened to be
  written: Maxes near the top, the wave and the cycle rules twenty cards below it,
  and three separate cards called some form of "Program".
- Six collapsible sections — Program, Training, Alerts and sound, About you, Your
  data, This app — with Program open on arrival, and which one you left open
  remembered per device. Six shut drawers would be worse than the scroll, because
  then you cannot even see what is in there.
- **Account stays above the sections.** It is who you are signed in as and where you
  sign out, which should not be two taps inside a collapsed group.
- The three "Program" cards are now **Programs and archive**, **Template and
  protocol** and **Start and units**.
- Done with a sentinel rather than a rewrite: each card is preceded by a NUL-delimited
  marker naming its section and the finished HTML is split on those and regrouped.
  Reordering two hundred lines of string building by hand is how you lose a card, and
  a NUL cannot occur in anything `esc()` produces, so the split cannot be fooled by
  content. The test asserts the section counts add up to every card.
- **The Guide moved off the tab bar** into the account menu, next to What's new. Eight
  tabs is about 48px each at phone width; it is reference material rather than a daily
  destination, and it was the only one of the eight nobody opens mid-session.
- 318 tests, 6 mutants, all caught.

**Macro averages, over a window you choose (2026-10-16)**
- The figure under each target said "200 g eaten", which reads as today and was not:
  it was a fourteen-day average, explained only in a line below that is easy to miss.
- It now reads **avg 200 · 40 short**, and the line under the card leads with
  <b>Averages are of days already eaten, not today</b> — grams are logged the morning
  after, so today's can never be in it. That sentence is the whole fix for the
  ambiguity; the rest is making the number more useful.
- **Three windows:** this week, 14 days, this block. A block counts back to week one
  of the cycle, so it answers "am I on track for this block" rather than "how was
  Tuesday". They disagree by design — a good week inside a bad fortnight should look
  like both of those things depending on what is asked.
- On target or short is said in words against each macro, with a five percent band so
  being two grams out does not read as a miss.
- The card says how many days in the window actually have grams, and says plainly when
  there are too few to read much into. Four entries in a fourteen-day window is a
  different claim from fourteen, and an average that hides which is worse than none.
- `setMacroWin` is a named function rather than an assignment in the click handler,
  because a test could not otherwise change the window — the first version of this
  looked like it worked and all three windows were returning the same number.
- 318 tests, 7 mutants, all caught.

**A warning before the rest ends, and macros for the coach (2026-10-16)**
- **A short low tone ten seconds out**, so you are back under the bar rather than
  finding out you are late. Off / 5 / 10 / 15 / 30 in Setup → Sound, defaulting to the
  ten that was asked for.
- Deliberately not the finishing sound: one note at 587 Hz against the finish's three
  rising to 1320, and a single 120 ms buzz against its long-short-long. If the two
  sounded alike you would have to look at the phone to tell which had happened, which
  is the thing a beep is there to save you. No media clip either — that exists to beat
  the ring switch by taking the speaker, and paying that twice a rest is not worth a
  warning.
- Skipped when the rest is shorter than twice the warning, or it would land on top of
  its own start. `restWarnDue` is its own function because the tick runs four times a
  second and those two guards are the whole behaviour — and because two mutants
  survived until it existed.
- **The coach could not see the macros**, the same omission as the bodyweight: the
  fields were added and never sent. Grams now go over per day, attributed to the day
  they were eaten, with the fortnight's mean and the target to compare them against.
- The target had to be computed in the Worker, which cannot import the app bundle. So
  the formula exists twice, and there is a test that loads both and asserts the
  multipliers and the output agree. Duplication with a guard beats duplication without
  one, and beats asking a model to apply a formula.
- 317 tests, 11 mutants, all caught.

**The coach holds a conversation (2026-10-16)**
- Each question used to be an island: no history, so "why?" meant nothing. Threads now
  (migration 0010), replayed as real turns, and the screen reads as a conversation
  with the box at the bottom.
- **The plan moved into the system block.** It is the same every turn, and leaving it
  in the user message would have paid for it once per turn of history. The retrieved
  passages stay with the question they were retrieved for, so the replay is only what
  was actually said.
- Bounded twice: eight turns and a 14,000-character budget, because one rambling
  exchange can be worth more than ten short ones.
- A thread id is only ever matched against the asker's own rows, so quoting someone
  else's gets you your own empty conversation; one that is not a uuid is ignored and a
  fresh one minted. Both have tests.
- The question appears immediately with nothing under it, so a slow reply reads as
  thinking rather than as nothing happening, and a failure puts the text back in the
  box rather than losing it.
- **The prompt talked about the state block using the same tag the block itself uses**,
  so a test looking for `<state>` found the sentence describing it first. The prompt
  says "the state block" now.
- 314 tests, 7 mutants. One survived because a stub returned no thread id, which made
  the assertion pass either way; the stub answers like the real endpoint now.

**A coach answer that came back empty (2026-10-16)**
- Reported: a question returned the citations and no text. The citations are built
  from our own retrieval, not from the model, so they render whether or not it said
  anything — which is how a blank answer looked like a successful reply.
- Now: three chances at an answer, and nothing is an error rather than an empty card.
  A reply that was meant to be JSON and got cut off is **not** used as prose: a test
  caught that fallback showing `{"answer":"` as the answer, which is worse than
  admitting nothing came back.
- `stop_reason` is logged (migration 0009). Without it an empty answer and a truncated
  one are indistinguishable, and the first time it happened there was nothing to look
  at. Running out of room now says so, because "ask something narrower" is actionable.
- `max_tokens` 1400 → 2600, and the prompt asks for under 250 words, so the ceiling is
  not discovered mid-sentence. A truncated answer is still shown, and labelled.
- Failures are logged but not counted against the monthly cap.
- **Web search is no longer a checkbox.** Asked for 2026-10-16: the tool is always
  offered and the model decides per question, told to reach for it only where the books
  do not cover the question and to name the source when it does. Whether the books
  answer something is a judgement that can only be made after reading them, which is
  not a thing to ask the person before they ask.
- 312 tests, 6 mutants, all caught.

**The back-to-back rules were mostly ours, and mostly wrong (2026-10-16)**
- Reported that the calendar refuses two conditioning days running. Checked the books
  before removing anything, and they are not ambiguous.
- **TB II:** "Your HIC and E can be done on any day, not just days 2, 4, and 6. You can
  do two days in a row, or whatever. As long as you're hitting your weekly minimums."
  So `hic` and `se` should never have been in `ADJACENT_BAN`. Removed.
- **TB1, on rearranging:** "It's not set in stone. As long as you adhere to the
  principles — one rest day. No back to back same sessions. Completed within 7 days."
  That is the one rule, and it is about the *same* session: Zulu's A and B are
  different sessions and are meant to touch, which the kinds already handle.
- Base Building's circuits were banned from touching too, on our reasoning that Block I
  is "built to avoid" it. The book's Block I guidelines are weekly counts and a rest
  day — "2-3 Strength-Endurance circuits per week", "Rest completely at least one day
  per week" — and say nothing about which days. Also removed.
- **Preferring is not refusing**, which is where this went wrong. `orderCrowding` is
  the new soft list, reported separately from `orderIssues`; `bestOrder` prices a
  crowded week above any amount of shuffling so it still spreads sessions when it can;
  and a swap that crowds now returns the order with a warning instead of a reason it
  cannot be done. Collapsing the two lists is exactly how a preference became a veto.
- The Guide now quotes both passages instead of asserting a rule the book does not have.
- 310 tests, 6 mutants, all caught.

**Three ways to move a day, and dragging to do it (2026-10-16)**
- The calendar already had a Rearrange mode: tap a session, tap a day, see the week
  previewed, apply. It only ever did one thing — shift the week around the request —
  and it was tap-only.
- A drop now asks what it meant: **swap the two days**, **move it and shift the rest**,
  or **do both on the same day**. All three already existed in the model; `swapOrder`
  is the only new one, and combining is the stacking built for the day view, so it
  answers to the same rule that everything may share a day except two lifting sessions.
- **Each unavailable option carries its reason.** In a full week most straight swaps
  break the rule against two hard days running, and "greyed out" with no explanation is
  what makes a tool feel broken. The swap refusal names the two days and points at
  shifting, which usually does work.
- **Pointer events, not the HTML5 drag API**, which iOS Safari does not implement — on
  a phone-first app that would have shipped a feature working only on the desktop
  nobody uses it from. `touch-action:none` only while rearranging, or the browser
  claims the gesture for scrolling and the drag never starts.
- Tapping still works and is the keyboard path. Both end at `calTarget`, so there is
  one set of rules rather than two, and the choices are identical either way.
- `calSetMode` and `calApply` are named functions rather than click-handler bodies, so
  a test can reach them. A mode the rules refused cannot be set, which is what stops a
  stale chooser applying something that was never on offer.
- 308 tests, 8 mutants, all caught after adding the past-day case.

**Goals, for the coach to read (2026-10-16)**
- A **Goals** card in Setup: what you are working toward, a date if there is one, where
  each lift stalls, and anything else worth knowing. Nothing in the app schedules off
  it, and the card says so.
- **The sticking points are the part that earns its place.** The app already has an
  accessory catalog with slots, so "stalls just off the chest" lets the coach name a
  movement that exists and the slot to put it in, rather than inventing an exercise.
  The slot list goes to the coach with the goals, and the prompt tells it not to make
  movements up.
- The same is true of lift variants: `VARS` already covers high bar, low bar, SSB,
  front and box for the squat, so advice on which to run points at something that can
  be switched on rather than at a general opinion.
- A date gets turned into weeks and counted down; a date gone by says so rather than
  counting backwards.
- Empty fields are dropped before being sent. A shape full of nulls reads to a model as
  "asked and left blank"; absent reads as "never asked".
- Named `plan.programGoals`, deliberately not `plan.goals`, because `plan.goal` is the
  food setting and the per-session `aims` are something else again. Three near-identical
  names for three different things is how `checkin.weight` happened.
- 304 tests, 6 mutants, all caught after adding an assertion for the prompt itself.

**Macros (2026-10-15)**
- Three boxes in the daily check-in next to the calories — protein, carbs, fat in
  grams — and a Macros card in Status with the target, what you have actually averaged
  and what to do when the scale will not move.
- **Building follows the book.** TB III p.108 gives the formula outright: bodyweight
  × 1.3 for protein, × 2 for carbs, half for fat. At 185 lb that is 240 / 370 / 95,
  which is the book's own worked example, and the test asserts those numbers.
- **Losing and holding are ours, and the card says so**, because Mass Protocol is a
  mass protocol and the other three leave food alone. Protein stays high, fat has a
  floor rather than a target, and carbohydrate takes the remainder of the calorie
  target — which also makes it the lever that moves when the target changes.
- The calorie target comes from `kcalTarget`, pulled out of the energy card so the two
  cannot drift apart.
- **The 500-calorie step is the book's**, including the wording: "add another 500
  calories per day using the same ratio". Offered only on a fortnight of weigh-ins
  going the wrong way, because a week is noise, and never while the plan is working.
  It compounds, so a month later it can be taken again.
- Grams are attributed to the day they were eaten, not the day they were typed — the
  same offset the calories have, and the trap that had just been fixed in the coach.
- A `proteinPerLb` of your own overrides the book's multiplier; the rest of the
  formula does not move.
- `macroTarget` defaults its adjustment to the stored one rather than taking it as a
  required argument, after a test caught a caller showing a target that ignored it.
- 301 tests, 10 mutants. One survived and was right to: a `maintain` guard that the two
  goal tests below it already covered, so it was removed rather than tested.

**The coach could not see the bodyweight (2026-10-15)**
- Reported: it said bodyweight was not logged, while a month of daily readings sat in
  the check-in. The summary read `checkin.weight`, and the field is `checkin.bw`.
- Checking the rest of it against the real check-in, most of what was sent was wrong:
  `sleep` does not exist (it is `sleepH` and `sleepQ`), and `protein`, `fuel`, `energy`
  were not being sent at all — the four fields most relevant to the nutrition questions
  the coach was always going to be asked.
- **Calories were a day out.** The check-in asks for *yesterday's* intake the next
  morning, which `kcalOn` has always known and the summary did not, so every figure was
  attributed to the wrong day.
- It now also hands over what the readings add up to — latest bodyweight and the date
  of it, pounds per week, mean intake, days logged, protein target — rather than making
  a model do arithmetic over 28 rows.
- **Two test-isolation faults found on the way, both the same kind.** The Anthropic
  stub replaced `globalThis.fetch` wholesale, and the Access check fetches its signing
  keys through that same global: every coach test turned into a 403 when run alone,
  and passed in the suite only because an earlier test had warmed the key cache. The
  stub now intercepts the model endpoint and passes everything else through. Then a
  file-wide regex meant to update the coach tests rewrote eleven lines in the admin
  tests too. Both suites now pass alone and together, and that is checked.
- 296 tests, 5 mutants, all caught.

**The coach's own calls were wrong (2026-10-15)**
- Shipped broken: asking anything returned a 400. The client called `api(path, init)`
  when the helper is `api(method, path, body)` and stringifies the body itself, so the
  POST went to `/apiundefined` with the method `coach`.
- **The tests could not have caught it.** `test/api.test.js` calls `handleApi` directly
  and `test/app.test.js` never exercised the client's half, so both ends were tested
  and the join between them was not. There is now a test that stubs `fetch` and asserts
  the URL, the method and the body shape, and checks nothing was requested from a route
  with `undefined` in it.
- Had to filter that test to coach routes: the app syncs in the background and those
  calls land in the same stub, which is why it passed alone and failed in the suite.
- 295 tests, 3 mutants, all caught — one of them being the exact bug that shipped.

**The coach, read-only (2026-10-15)**
- A **Coach** tab, between Setup and Guide. Ask a question; it answers from the books
  first, the plan second and its own reasoning last, and it says which of the three it
  is doing.
- **It cannot change anything**, and the card says so rather than leaving it to be
  inferred. Suggestions come back as structured items even though they render as text,
  so making them one-tap later is a change to the view, not to the contract.
- What it is told: the books (eight retrieved passages), and a *summary* of the plan
  and the last 28 days — template, protocol, maxes, basis, goal, and per day what was
  lifted, whether a set ground, the conditioning done, the check-in. Not the raw
  documents: more than the question needs, more to pay for, and it buries the few
  facts that matter.
- Grounding is ranked in the system prompt, because an unranked model treats a forum
  post and a book as equals. Web search is opt-in per question and capped at three.
- Every exchange is logged per user with the passages it was given — the only way to
  judge whether the advice is any good is to look back at what it said and what
  happened next, which is the whole point of starting read-only. 300 questions a
  month; a failed call is logged but not counted.
- Upstream errors are logged and not returned: the body can carry the key's own
  details. A model that returns fenced JSON, or prose instead of JSON, still renders.
- **Porter stemming, found by a test.** A question written as "am I recovering well
  enough" missed the passage that "how long should my recovery weeks be" found, because
  FTS5's default tokenizer treats "recovering" and "recovery" as unrelated. People ask
  questions the first way. Migration 0008 rebuilds the index with `tokenize='porter'`.
- 294 tests.

**A private library of the books (2026-10-15)**
- Groundwork for the coach: it should answer from what the books say, not from a
  model's recollection of them.
- **The content is not in the repo and cannot get there.** `library/` is gitignored
  alongside the PDFs, for the same reason and with the same note. What is committed is
  the machinery: `tools/pdfextract.py`, `tools/pdftext_cmap.py`, `tools/library.py`,
  and a migration. Text goes from a local PDF straight into D1, which sits behind
  Access.
- Both extractors are committed now rather than living in a scratchpad, because which
  one a book needs is a property of the book and that knowledge kept getting lost.
  TB_MP has a `/ToUnicode` map and wants the CMap reader; TB_V3 has none and wants
  `pdfextract.py --glyph=29`, its glyphs running 29 below ASCII.
- **The extractor choice is not cosmetic.** The first pass at TB III came out with no
  spaces between words, which FTS5 cannot tokenize — so the one book that answers
  "how much protein" was the one book the search could not find it in. The CMap reader
  fixed it, and the macro question now returns TB III first.
- Storage is FTS5 in D1, which it supports. 577 chunks across four books, chunked by
  page with short pages folded forward, each keeping the page it came from so an
  answer can be checked.
- Search is two-pass: AND the terms, and widen to OR only if that came back with fewer
  than three. One pass does not work — AND alone returns nothing the moment a word is
  missing, OR alone ranks whichever chunk uses the most ordinary words. Stopwords are
  dropped for the same reason.
- Every term is quoted before it reaches MATCH. FTS5 reads its input as syntax, so a
  stray quote or the word NEAR is a thrown query rather than an empty result; there is
  a test that feeds it eight such strings.
- Known and left: TB1's decode renders apostrophes as `ä`. It is cosmetic — FTS splits
  on non-alphanumerics either way — and guessing at a mapping was worse than leaving it.
- 288 tests, 6 mutants, all caught after fixing a vacuous cap assertion.

**The bout count, where you can see it (2026-10-14)**
- A placeholder in a field is easy to miss, and it was the only place the number
  appeared. Now it is in three, all off the one source (`specRounds`):
  - **The headline**, which for a base-then-bout session was showing the format's
    generic description ("An easy base, broken by bouts of work") when the app knew the
    actual prescription. It reads "10 bouts · 2 min of base between" now.
  - **A one-tap fill** next to the existing "Use 20 min", on the same pattern and with
    the same rule: it only appears while nothing is logged.
  - The placeholder, as before.
- Non-lead formats are untouched: MAP keeps its own description and grows no button.
- 284 tests, 5 mutants, all caught.

**Two things wrong on the FOBBIT card (2026-10-14)**
- Reported after using it. Both were introduced by the catalog work and neither was
  caught, because the tests checked that the prescription was right without looking at
  what sat around it.
- **The bouts field was blank.** The app knows exactly how many bouts the session is —
  `ivOpts` computes it and the timer runs it — but the field offered no placeholder, so
  you had to count. It suggests the number now, for every FOBBIT and for Predator.
- **A bare "Ours." under the picker.** The provenance line printed the source label and
  a full stop, which reads as a sentence fragment for the book-sourced ones and as
  nothing at all for ours. It is a sentence now, and the free-text FOBBIT has no line
  at all, having nothing to attribute.
- 284 tests, 3 mutants, all caught.

**Ageless Athlete (2026-10-14)**
- The book I had wrongly called covered. Five pieces, all read off the pages.
- **3-1-3-1 recovery weeks.** A `recovery` week after every third training week, so a
  six-week cycle takes eight — which the book says is the point. No barbells, no HIC,
  two easy sessions and nothing else; no plyos either, since `weekHasPlyo` never
  included the kind. Turning it on suppresses the scheduled deload, because the
  recovery weeks *are* the back-off.
- **The in-block check.** On the last lifting day of a week a recovery week follows,
  offer a heavy single above 95% or a rep max instead of a whole test week. Tied to the
  recovery weeks, so it is silent without them.
- **Old Warhorse.** Four blocks over Operator's percentages, with the volume band and
  the set flexibility moving block to block (5-10 / 4-8 / 4-5 / 3-4). The table on page
  143 was marked unverified in `AGELESS-AND-MASS.md`; it reads cleanly and is now the
  source. The training-max step between blocks is "2-5% (you can be a bit aggressive
  here)" — a judgment call, so the app prompts rather than inventing a number.
- **Back "Break", squat-only and deadlift-only.** One lower-body lift a week on the
  last day. These needed a prescription type the app did not have: `top`, where you work
  up to the best set of the day and the down sets are a percentage of *that* rather than
  of a 1RM. `rx` carries `top`/`down`/`downPct` and `liftCard` drops the percentage from
  the header when they are set.
- **The Ageless preset** writes three real settings (recovery weeks, training max at
  90%, no scheduled deload) instead of layering a hidden mode over them, so each stays
  visible in Setup and individually reversible. A training max already below 90% is left
  alone.
- Still not built, and not an oversight: AA's Base Building (declined) and I/A's 48-72h
  floating schedule (deliberately out).
- 284 tests, 12 mutants, all caught.

**TB III's named conditioning sessions (2026-10-14)**
- The last item on the list. Ruck, Recovery Run, Endurance Predator, Anabolic Sprints,
  RESET-20 and Hill Sprints, plus two protocols to put them in: `massgreen` and
  `massblack`. The book is explicit that these replace TB II's Green and Black while
  mass is the objective, so they are protocols rather than extra sessions bolted on.
- Walk, Ruck and Recovery Run were already expressible as LISS on the right activity.
  Four formats are new: `predator`, `sprints`, `reset20`, `hillsprint`.
- **Endurance Predator is a FOBBIT by shape** — hold an easy base, step off it for a
  bout — so rather than a second copy of that machinery, the accessors it needs now
  take a spec object (`specEvery`, `specCount`, `specBouts`, `specRounds`, ...) and the
  `fob*` functions are thin wrappers that look the spec up in the catalog. Predator's
  spec lives on its interval-timer entry. `IV.fobbit.fob` marks the formats whose spec
  comes from the catalog, which is also what gates the FOBBIT picker: before that,
  Predator inherited it just by reporting no distance.
- Over 30 minutes Predator reads as an E, which is what the book calls it. The rule
  generalised from "a FOBBIT over 30" to "any base-then-bout session over 30".
- **A pre-existing bug the matrix test could not see.** Mass's own book layout puts the
  deadlift day straight after day 5, and the Move tool warned about it on every
  protocol. Marking the deadlift day as a different half fixes it, as it did for Zulu.
  The matrix test missed it because it ran against a plan that had not started, so Mass
  never reached its four-day week; it now starts the plan, and 45 pairings are clean.
- 279 tests, 12 mutants, all caught.

**TB III's Base Building and its Bridge Week (2026-10-14)**
- Both read off the book's tables, the same way Specificity was.
- **Base Building, TB III's version.** Six weeks, not TB II's eight, and only two
  domains: SE three times a week on alternate days, E on the days between. No barbell
  strength week, no HIC, no recovery day. The reps climb inside the week (10, 20, 30)
  rather than across it, and weeks 4-6 add five percent. E is capped at 30 minutes and
  the book means a cap, not a minimum.
- The block already had a `ver` ('standard' / 'strength'), so this is a third. What it
  needed was for the length to stop being the literal 8 in four places: `BB_LEN` and
  `bbLen(ver)` now carry it, including for a frozen week resuming mid-block.
- SE rows grew a fourth field, the percentage. TB II's block prescribes none, so its
  rows are unchanged and its card keeps the 15-30% range; TB III's card shows the day's
  own number instead.
- **Bridge Week** is an insert alongside Deload, Retest, Travel and Off. Light activity
  for five days and two optional test days on 4 and 5 — the book says that if no
  testing is needed those become rest days, so they say so rather than being dropped.
  Distinct from the app's own bridge week, which is a calibration week at the start and
  is ours.
- 276 tests, 12 mutants, all caught.

**Specificity Alpha and Bravo (2026-10-14)**
- The last two templates. Both read off the book's tables rather than remembered: the
  PDF's tables are images, so they were pulled out by resolving each page's
  `/Resources /XObject` to an object number and reading the JPEGs.
- Shipped briefly labelled `Mass Protocol` on the claim that the roadmap had filed them
  under the wrong book. That was wrong and the roadmap was right: TB III is titled
  Tactical Barbell III: Mass Protocol, one book, and its contents run Mass Template,
  Grey Man, Gladiator, Fighter HT, Specificity Alpha, Specificity Bravo. Corrected to
  `TB3`, which is what their four siblings from the same book already said.
- Three-week blocks, four days a week on days 1, 2, 4 and 5. `wave` has three entries,
  so `cycleWeeks()` reports three and week four starts the block again — the same
  mechanism Gladiator and Mass already use.
- **Alpha** is half and half. MS days are bench, squat and deadlift at 3x6/75, 3x5/80,
  3x3/85, with the deadlift on its own programming at one work set (1x5, 1x4, 1x3).
  H days carry the cluster at 4x12/65, 4x10/70, 4x8/75.
- **Bravo** has no barbell work at all. Four hypertrophy days, 4-5 reps x 12/10/8, and
  the back half of the week runs five percent heavier than the front. That last part
  needed `accRxFor(wk)` to become `accRxFor(wk,day)`, since no template until now had
  supplementary numbers that moved within a week.
- **A lifting day with no lifts** is new. `LIFTSET.NONE` returns an empty array and the
  session is the accessory cluster, which the day view already renders after the lifts.
  The matrix test's "no empty lifting day" invariant was written when every lifting day
  had a barbell in it; it now bans a training day with neither lifts nor accessories,
  which is the thing actually worth banning.
- `half:'a'`/`'b'` on the days, so two training days running do not read as a clash.
  Zulu's mechanism, and the book's layout needs it.
- **Two real bugs found on the way.** Setup and the Guide both listed a template's day
  count as `days.length`, which for Mass and Grey Man is a function's arity: both were
  shown as one-day templates. And `accCard` dropped a prescription's `sMax`, so Bravo's
  "four to five sets" would have displayed as four.
- 273 tests, 12 mutants, all caught.

**Sandbag over the shoulder (2026-10-14)**
- A fourth sandbag FOBBIT, and the first thing added since the model was generalised:
  one entry, one movement, no other code touched. That is the test of whether the
  generalisation was worth doing.
- One movement rather than a pair, because each rep is already the whole chain — ground
  to shoulder, keep going, release behind you, turn round and pick it up again.
- The four sandbag entries are now the easiest pair in the catalog to let collapse into
  each other, so the test asserts they prescribe four different things rather than
  merely existing.
- Provenance was being asserted entry by entry, which would not have caught a new one
  claiming a book it did not come from. It is pinned as a set now: exactly six entries
  have a source, and anything added is ours until somebody checks a book.
- 269 tests, 3 mutants, one survivor (the provenance hole above), fixed.

**A FOBBIT is a shape, not a session (2026-10-14)**
- Asked whether the catalog came from the books, and it mostly did not. The books name
  one FOBBIT (TB2 HIC #9) and Mass Protocol gives a second; the other five shipped in
  1.99 were ours and nothing said so. Then the author's own two-part article turned up
  three more Mods, and they break every assumption the model had.
- What the sources actually disagree on: the base interval (2 min in TB2, 3 to 5 in
  Mod #1, 60 to 90 seconds in Mod #3), the number of movements (two, one, three), the
  dose (reps, a 60-second AMRAP, 3 reps at 70-75% of a 1RM), the duration (15 to 60+),
  and whether the minutes count the base alone or the whole session.
- So all of it is data now. A catalog entry carries `every`, `count`, `mv`, `mins`, `def`,
  `bpm` and `src`. A dose is a string when it is reps and an object when it is anything
  else. `fobBouts` normalises the lot into what the timer wants, and the timer rotates
  through however many movements there are instead of alternating two.
- **The rule that was prose and is now code.** "Any Fobbit over 30 minutes is an E -
  anything under is HIC" (Part II). The Guide said it; nothing enforced it. `sessHard`
  now asks the default FOBBIT's length when laying out a week, and `hicWasHard` asks the
  logged length when counting what you did, so a 45-minute FOBBIT stops being counted
  against your hard days.
- Thirteen entries, each labelled with where it came from: Tactical Barbell II, Mass
  Protocol, the three Mods, or Ours. The Guide prints the source in the table, because
  five of them are ours and the honest thing is to say so.
- Mod #1 defaults to 45 minutes rather than its floor of 30, because the article puts it
  in the week as the day-six E session and 30 exactly would still count as a HIC.
- Session length is picked in minutes now, not rounds. A length stored before this is
  read as a count of two-minute rounds so old sessions keep the length they were given.
- 269 tests, 16 mutants.

**The FOBBIT card describes the format, not one FOBBIT (2026-10-14)**
- The day's card still read "twenty swings, then ten per arm snatches" whatever was
  selected. The catalog shipped in 1.99 made that text a lie for six of the seven
  entries, and nothing caught it because the test asserted the hardcoded strings.
- Split in two. The general blurb says what a FOBBIT is and how it is shaped (easy base,
  step off every two minutes for a set of reps, alternating two movements) and names no
  movement at all. A second line names the pair, and it comes from the selection.
- `fobReps(id,ease,what)` in `01-constants.js` is now the single source of the pairing:
  the card, the interval timer's burst labels and the easy-week halving all read it, so
  the card cannot advertise one pair and the timer run another. `other` falls back to
  whatever you typed, and to a plain "Set" if you typed nothing.
- `halveReps(q)` halves only the leading count and leaves the unit: "10 / arm" halves to
  "5 / arm", and "20 with the 24 kg bell" does not halve the bell. It rounds up and
  never reaches zero.
- The old test asserted the literal strings, which is why it went stale silently; the
  new ones derive their expectations from `FOBBIT` and loop over every entry, so adding
  an eighth FOBBIT tests itself.
- 266 tests, 9 mutants. Two survived and both were worth fixing: halving was not pinned
  to the leading number, and nothing asserted the easy-week "reps are halved today" note.

**Sandbag over bar (2026-10-14)**
- A third sandbag FOBBIT, paired with push-ups so the burst is one loaded explosive
  movement and one that needs nothing.
- The test now also asserts no two entries prescribe the same pair, which is what stops
  a catalog quietly becoming a list of the same session under different names.
- 264 tests held, 2 mutants, both caught.

**A catalog of FOBBITs (2026-10-14)**
- There was one, hardcoded into the Guide's prose, and the movements were a free-text
  box on the day. `FOBBIT` is now a list: kettlebell (the original pairing, unchanged so
  old sessions still read right), two sandbag versions, bodyweight, dumbbells, and an
  `other` that keeps the text box.
- Chosen per session over a plan default, exactly as the conditioning activity is:
  `defFob()` / `fobOf(date)` / `setFob(date,v)`, and `setFob` stores a swap only when it
  differs from the default so changing the default still moves the sessions that never
  disagreed with it.
- `setFob` extracted from the change handler because the mutation that survived was
  "any typed value is stored as a choice" — the same unreachable-handler problem as
  `lsAct` and `wzSet`. That is three times now; handlers get a named function.
- 262 → 264 tests, 10 mutants, all caught.

**Stair machine (2026-10-13)**
- A `MOD` entry measuring `floors` on both HIC and LISS, which needed a case in
  `metricLabel` — without one a new field falls through to "Distance (floors)".
- Floors need no unit conversion, and `metricFor` only rewrites mi/yd/km/m, so no
  `fixedUnit` flag: adding one would have implied a conversion that cannot happen.
- Not in the impact list that `plyoWarnings` checks, which is right — it is the
  low-impact option, not another way to land on your feet.
- 261 → 262 tests, 3 mutants, all caught.

**Stacking two sessions on one day (2026-10-13)**
- Reported from a real week: ill on a conditioning day, wanted to do it after the next
  day's lift. The app could only *swap* days, so the week had one session per day and no
  way to say "both, here".
- **The guardrail was wrong, and the book says so.** TB II: "You can also do your
  conditioning sessions on the same days as your strength work. If you're doing them
  during the same session, do your strength work first, and conditioning afterward."
  Its own Black + Zulu sample week does exactly this. The caution the book attaches is
  about total weekly volume, not about combining days.
- `plan.stack[from]=to`, same week only. The source day reads as moved rather than
  missed; the target merges via the ride-along the Zulu work already built, so the
  lifting is always the base and the conditioning rides on it — whichever of the two was
  the one moved. That order is the book's.
- Refused: two lifting days in one (a different program), moving an empty day, moving
  onto a day that has already taken one, and crossing a Monday. Refused options stay
  visible and disabled with the reason in the title, rather than vanishing.
- 258 → 261 tests. 12 mutants, all caught. The survivor was the mirror case — a lift
  moved onto a conditioning day — which the first set of tests never tried.

**Plyo days did not look chosen (2026-10-13)**
- Reported: tapping a day in the wizard highlighted nothing. `wzset` coerced to a number
  for `deload` and `test` and nothing else — an allowlist — so `plyoDow` was stored as
  `"3"` and compared against `3`. Every numeric field added after that pair was broken
  the same way the moment it was added.
- `wzSet(k,v)` now reads the field's own starting type: `typeof wz[k]==='number'`. It is
  also extracted from the click handler, which is where the bug was hiding and where
  nothing was reachable from a test.
- **Both days lit.** One row of seven instead of two pickers, every chosen day lit and
  numbered. `plyoPick` slides the pair: tapping a chosen day does nothing, tapping a new
  one drops whichever was picked longer ago. The wizard and Setup draw the same control
  from `plyoDayRow`.
- `plyoDows` sorts, so Plyo 1 is the earlier session in the week whatever order the days
  were picked in.
- 256 → 258 tests. 7 mutants, all caught, including a reconstruction of the reported bug.
- **Worth keeping:** an allowlist of "the fields that are numbers" is a bug waiting on
  the next field. Derive it from the data.

**Plyo settings move to Setup, and get a wizard step (2026-10-13)**
- Correcting 1.94. "Plyos should be their own tab" meant a step in the setup wizard, not
  a seventh entry in the main nav; I built the wrong thing and shipped it. The nav tab
  and `vPlyo` are gone.
- The wizard has a **Plyos** step (eight now), lifted out of Conditioning where 1.93 had
  tucked it: on or off, one session or two, and the day or days.
- **Setup → Plyometrics** carries the same four choices. Nothing else moved there: the
  phases, exercises and pull-back rules stay in the Guide, and the broad-jump trend
  stays on Status. The tab had duplicated all three, which is the clearest sign it
  should not have existed.
- `plyoWarnings` takes an optional second day, so the wizard can warn about choices it
  has not saved yet rather than reading the live plan.
- 255 → 256 tests. 5 mutants, all caught.
- **Worth keeping:** a feature that duplicates three screens it does not own is usually
  the wrong shape, and that was visible while building it. Ask what the thing *is*
  before deciding where it goes.

**A plyometrics tab, and two sessions a week (2026-10-13)**
- **Its own tab**, between History and Setup: phase and target, the days, the broad-jump
  trend, this phase's exercises with their library entries, and the three rules. Logging
  stays on the day card — the tab is for understanding it, not filling it in.
- **`plyoPerWeek` 1 or 2.** Two **splits** the phase's contacts rather than doubling
  them: `plyoShare()` halves both the target and `plyoSets`. Second day defaults to three
  days on, and `plyoGap` measures across a seven-day loop so Monday and Sunday count as
  adjacent.
- Permission given to look beyond the plyo PDF for this one, so it was: two sessions a
  week is the common recommendation and often called optimal for a moderately trained
  athlete, with 48–72 hours between. The volume numbers in those sources conflict badly
  — per-session and per-week figures are quoted interchangeably — so keeping the week's
  total fixed is the app's own call, and the tab says so rather than implying a source.
- **Bug found by reading the output rather than the test:** `+null` is `0`, so an unset
  `plyoDow2` silently made Monday the default second day instead of three days on.
  `plyoDow2()` now checks for absence before coercing.
- 252 → 255 tests. 13 mutants, all caught. Three survived first, all of them tests not
  reaching far enough: the gap was never tested across the week boundary, the same-day
  case never checked that the day is listed once, and the tab was only ever called
  directly rather than through the view router.

**Plyos are a setup question, not an assumption (2026-10-13)**
- `plan.plyoOn` — they could not be turned off at all before, only moved a week at a
  time. `weekHasPlyo` honours it, so the whole plan loses them cleanly.
- Welcome setup asks on the Conditioning step (still seven steps): on or off, and which
  weekday. `plan.plyoDow` had no UI anywhere until now; it was reachable only as the
  thing the per-week override defaulted to.
- **`plyoWarnings(t,c,d,cardio)`** names what is already on the chosen day, from the
  week the pairing would draw: it lifts (plyos go first, so the barbell work takes the
  hit), it is the only rest day, or the conditioning is running and that is landing work
  too — which the day card already said, now said before you commit.
- **One warning deliberately left out.** "The day before is a lifting day" fired on the
  default Thursday and on most alternatives, because an alternating week puts a lifting
  day before every conditioning day. A warning that is true of nearly every option tells
  you nothing; the pull-back rule it came from stays on the plyo card.
- Fixed in passing: `PLYO_PULLBACK` still said "Wednesday's squat session... sore into
  Thursday", hardcoding the arrangement that 1.74 made movable.
- 250 → 252 tests. 11 mutants, all caught. Three survived first: the off-switch test
  was checking a bridge week, which never has plyos anyway; the rest-day warning was
  never checked against a week with days to spare; and a bounds guard was dead.

**American spelling throughout (2026-10-13)**
- The app had drifted into British spelling, most visibly in the Program step shipped
  hours earlier. ~60 occurrences across strings, release notes and markup. The word list
  lives in the test rather than here, so there is one copy of it and it is enforced.
- Two deliberate exceptions, both in the code: **Grey Man** is TB III's name for a
  template rather than a color, and the pre-1.92 `'knee to wall ankle mobilisation'`
  lookup alias stays so a mobility list edited before today still resolves to its entry.
- The test scans `src/app/*.js`, `releases.js` and `index.html` rather than rendered
  views — the first version rendered a handful of screens and a reintroduced
  "Program" in the Plan tab walked straight past it. Comments are stripped before the
  scan: they are written for whoever is building, and this is a test about what the app
  says. Add to its word list rather than trusting anyone to remember.
- 249 → 250 tests.

**Onboarding picks the program, and names the books' objections (2026-10-13)**
- Welcome setup gains a **Program** step (now seven): every template and protocol
  listed with its blurb, day count and source book, plus a **Base Building** tick.
  Previously the only way to a non-default program was finding the Setup dropdown.
- Base Building inserts after the bridge week when there is one, because its two
  strength days need maxes to work from, and at the start week when there is not.
- **`programWarnings(t,c,bb)`** turns the books' own statements into checks, each
  traceable to a page rather than invented:
  - *TB II, Black variations:* "I don't recommend using TB Mass template here… no more
    than 2 HIC sessions per week. No E at all."
  - *TB II, same page:* "Gladiator template can be used, but I recommend using a
    training max/conservative 1rm numbers." — which maps onto the existing `basis` setting.
  - *TB III, Conditioning:* "Green is used alongside General Mass… Black is used during
    Specificity."
  - *TB II, Green guidelines:* two strength sessions a week, so a 3+ day template is more
    lifting than Green asks for.
  - Plus the two the app knows itself: a `noStrength` protocol sets the template aside,
    and Base Building displaces both for eight weeks.
- **Warnings, not locks.** The books are advice and people have reasons; the app says
  what the page says and then gets out of the way. Shown while choosing, again on the
  summary, and in Setup where the pairing can also be changed.
- 246 → 249 tests. 11 mutants, all caught.

**Program templates, stage 6: Mass and Gladiator (2026-10-13)**
- **Mass.** Days 1/3/5 are bench + squat + weighted pull-up, day 6 is the deadlift on
  its own numbers (4×5 where the others run 4×8). **Week three drops day 5 entirely** —
  the book's table leaves that cell empty — so `T.slots` can now be a function of the
  week as well as `T.days`, via `tplSlots`.
- Mass takes `wpu` when Lift 3 has it and `pull` when it does not. The book wants
  weighted pull-ups if you can do twelve bodyweight and names a row or RDL as the
  substitute; never the overhead press, because every substitute it names is a pull.
- **Gladiator.** Days 1/2/4/5, two pairs run twice, reusing the `half` mechanism Zulu
  introduced so the paired days do not read as a clash. 4–5 sets in the build weeks and
  a flat 4 in the peak week.
  - The book names day 1 outright ("squat for 4 to 5 sets of 8 using 60%. Do the same
    with the overhead press") and its week-3 table peaks squat, bench, overhead press
    and deadlift on days 1, 2, 4 and 5. **The pairing of the other three days is
    inferred from those two facts** — it is the only arrangement where a four-lift
    cluster covers four days two at a time and each lift peaks once. Flagged here
    because it is the one thing in these two templates not read straight off a page.
- 242 → 246 tests. 13 mutants, all caught.
- **Seven templates, three books:** Operator, Fighter, Zulu (TB1); Mass, Grey Man,
  Gladiator, Fighter HT (TB III).

**Grey Man back inside the book's cap (2026-10-13)**
- Single-leg off `gm1`, so the supplementary clusters are six exercises again — TB III's
  stated ceiling. Squat is already on that day, which made single-leg the most redundant
  of the four.
- **The rule this settled, which is worth more than the change:** when something is
  genuinely in question, follow the book. I had left Grey Man one over, reasoning that
  the S clusters are the part the book hands the lifter to choose and so trimming was
  theirs. That is a defensible argument and it was the wrong call — the book states a
  cap, and a default that ignores it is the app overriding the program. Where the app
  does depart deliberately (the deload week, the accessory splits, the bridge week) it
  says so; silently exceeding a stated limit is not that.
- The test asserts the range 4–6 rather than the number 6, so it states the book's rule
  instead of today's list.

**Posterior chain on Zulu and Grey Man (2026-10-12)**
- Both had none anywhere in the week. Added to `z1` and `gm1`, the squat-and-bench days,
  rather than the days that already deadlift. Zulu runs each half twice, so that is two
  sessions of it.
- Grey Man goes to seven supplementary exercises against the book's "no more than four
  to six". Left one over on purpose: the S clusters are the part TB III hands the lifter
  outright, so trimming one is theirs to do, and removing something they might be using
  is worse than adding one they can delete.
- Fighter HT left alone: it gives the deadlift a session of its own, which meets the
  same need a different way. The new test accepts either.
- 241 → 242 tests, 3 mutants, all caught.

**Posterior chain on Operator day 1 (2026-10-12)**
- `ACC_DAYS.mon` gains `pchain`, first in the list. Operator squats three times a week
  and deadlifts once, so one hamstring job on Friday was the thinnest part of the split.
- Only the *default* list changed, so anyone with their own `plan.accSlots.mon` is
  untouched.
- Two tests broke, and the second was worth reading rather than patching: migration 2
  interprets old positional accessory ticks against the list **as it stands now**, so
  changing the list changes what unmigrated data means. Only reachable by a plan that
  has sat at schema 1 since before 1.53, but the test now derives its slots from
  `accSlots` instead of naming them, so it states the real contract.
- **Found while checking:** Zulu and Grey Man have no posterior-chain job on any day,
  and Fighter HT only reaches it through its deadlift session. Reported rather than
  changed — three templates' accessory splits is a separate decision.

**elitefts and Westside band presets (2026-10-12)**
- `BAND_PRESETS` is keyed by brand. Rogue publish a single peak figure per band;
  elitefts and Westside publish ranges, so those seed at the midpoint (`bandPresetW`)
  and the card shows the range (`bandPresetLabel`).
- Both brands contradict themselves in their own published material: elitefts list the
  Pro Mini at 25–54 lb and at 5–35 lb on different pages; Westside's articles quote
  higher figures than their product pages because the number depends on whether the band
  is choked, doubled or anchored, and on the lifter's height. Product-page ranges used,
  and the card says plainly that they are a starting point.
- Westside has no Average on its product pages, so there is none here. Not inventing one
  was the point of the whole design.
- Names carry the brand, so two charts coexist without one Red meaning two things.
- 241 tests held; 4 mutants, all caught after one survivor (an unknown brand falling
  back to Rogue) that only showed up once the test ran against an empty list first.

**Supersets, bands, and three movements (2026-10-12)**
- **Supersets** are stored as the *first* slot of each pair, per day
  (`plan.accSuper.mon=['biceps']`), and `accGroups(day)` turns the day's jobs into runs.
  Positional on purpose: storing both names means re-ordering or deleting a job can
  leave a pair pointing at something gone. `accCanSuper` requires the *next* group to be
  free as well — the first version let you pair a job and silently steal the first half
  of a pair that already existed.
- One step in session mode rather than two, done only when both halves are.
  `lsAccBlock` pulls out the per-job markup so one step can draw two.
- **Bands** are `plan.bands`, a list with a weight each, offered on any movement whose
  `gear` mentions a band. No color lookup: Rogue's own chart lists Red twice (18 lb and
  115 lb), third-party charts for the same bands differ by 50%, and the published figure
  is peak resistance at full stretch rather than anything felt at the bottom of a rep.
  Seeding from the maker's chart converts to kg, which is the one place a unit
  conversion is right — new data from a known unit, not a stored number rewritten.
- Reverse hyper (`pchain`) and Cossack squat (`sleg`) added. **RDL was already there**,
  as `rdl` and `slrdl`; said so rather than adding a duplicate.
- **Pre-existing bug found by reading:** session mode's Done button had no branch for an
  accessory step, so it fell through to the lifting branch and wrote
  `lifts.undefined.sets` into the day. Anyone who tapped Done on an accessory without
  logging sets has junk in that log.
- 236 → 241 tests. 13 mutants, all caught.

**Copenhagen planks (2026-10-12)**
- Added to `ALIB` under `core`, so it is offered on every template rather than one, and
  listed in `isBWAcc` so the set row asks for seconds instead of a weight.
- Missed its roadmap entry when it shipped; written up on 2026-10-13 during an audit.

**Sound: share the speaker or take it, and you choose (2026-10-12)**
- Fourth report on the beep, and the first one that got the question right: *keep my
  music playing and still beep*. Researched before touching anything, as asked.
- **The constraint is real and is not ours.** The Audio Session spec splits types into
  exclusive (`playback`, `play-and-record`, `transient-solo`) and mixable (`transient`,
  `ambient`). A native app combines the playback *category* with a `mixWithOthers`
  *option* and gets both; `navigator.audioSession.type` is one category and has no
  equivalent. So: share and be silenced by the ring switch, or seize and pause the music.
- `plan.soundMode` is `duck` | `takeover` | `silent`, defaulting to **duck**
  (`transient`). Migration 6 converts `quietTimer`. The WAV clip added in 1.79 now goes
  out only in takeover — a media element is for beating the ring switch, and beating it
  means holding the channel, which is the thing ducking exists to avoid.
- **1.79 set `playback` for everyone.** That was my regression and it is what started the
  music stopping; it was chasing audibility and traded away the thing actually wanted.
- **A separate real fault, and probably the oldest one here:** WebKit moves a page's
  AudioContext to `interrupted` when another app starts playing. Every check in the file
  tested for `suspended`. On a phone with music on, that is most of the time, and every
  beep after the music started went nowhere. Now `!== 'running'`.
- 233 → 236 tests. 13 mutants, all caught. The harness exposes the live stub context so
  `interrupted` is reachable from a test at all.
- **Left undone on purpose:** nothing can make a sound on a phone whose ring switch is
  off without taking the channel. The Apple Watch tap through the existing rest-alert
  notification is the answer there, and is deferred rather than unknown.

**Program templates, stage 5: two clusters, and Grey Man (2026-10-12)**
- **Days may vary by week.** `T.days` can be a function of the week, because Grey Man
  alternates A-B-A then B-A-B so the same weekday is a different session seven days
  later. `tplDays(T,wk)` is the one reader.
- **A template may prescribe its supplementary work.** `T.accRx(wk)` gives the day's
  second cluster its own sets, reps and percentage, separate from the main lifts.
  Operator's accessories stay what they were: deliberately unprogramd, two or three
  sets short of failure, skipped on heavy weeks. A program that prescribes them
  **overrides that skip** — dropping work the book programd would be wrong.
  - The book's Grey Man tops out at 80%, which is `mid`, so nothing in TB III reaches
    the skip today. The wave is user-editable though, so the guard is reachable by
    anyone who pushes week 3 up, and the test gets there the same way rather than
    through a contrivance.
- Deliberately **not** modelled: a 1RM per supplementary exercise. The book asks for a
  percentage but immediately hedges ("or keep it simple and do 4 sets of 12"), and
  tracking maxes for dips and shrugs is a lot of data entry for a hedge. The card shows
  the sets and reps as the target and names the percentage as guidance.
- The accessory editor lists each cluster once rather than once per day. Zulu has been
  showing both its lists twice since 1.77 — two editable copies of one thing.
- 228 → 232 tests. 11 mutants, all caught; the two survivors were both "which week's
  table gets read", which is the question this whole stage turns on.
- **Still to come from TB III:** Mass, Gladiator, Specificity Alpha/Bravo. Specificity
  needs nothing new in principle now — MS and H days are per-day lift sets with per-day
  prescriptions, both of which exist — but its H cluster is large and user-defined.
  Then its Bridge Week, Base Building variant, and named conditioning sessions.

**Program templates, stage 4: per-day prescriptions, and Fighter HT (2026-10-12)**
- First TB III template, and the enabling change it needed.
- **`dayRx(wk,k,date)`.** Operator, Fighter and Zulu run one prescription a week, which
  is what the wave is. TB III's tables are per day and sometimes per lift: Fighter HT's
  deadlift day diverges from week 2, and Specificity alternates max-strength days against
  hypertrophy days inside one week. A template may now define `rx(wk,day,k)`; the wave
  answers when it declines. All 224 existing tests passed untouched across the change.
- **History stays reproducible without storing a prescription per day**: a frozen week
  already pins the wave entry and the template, and a template's table is a pure function
  of the week number. A mutant proved the `wk.tpl` lookup matters — without it a frozen
  Fighter HT week starts reading Operator's numbers.
- **`own`** marks a template-set prescription so the generic "deadlift is one to three
  sets" rule leaves it alone. On Fighter HT the deadlift day *is* five sets of eight.
- **AMRAP** as a flag on the prescription rather than a day type, with the card saying
  what to do. Week 3 takes the last set of the day's named lift as far as it goes.
- Only a composed week can reach a template's table, because `day` is set by
  `composeSlot` alone — so deload, retest and Base Building keep their own numbers
  without being named. The first version also tested `wk.kind==='cycle'`, which was both
  redundant and wrong in principle; removed rather than tested.
- Reading the book properly first paid again: the MP text extractor was dropping the
  space glyph, and fixing it gave every table's caption, which is how each one was
  matched to its template instead of guessed from its shape.
- 224 → 228 tests. 11 mutants, all caught.
- **Still to come from TB III:** Mass, Grey Man, Gladiator, Specificity Alpha/Bravo. Those
  need a second exercise cluster (main + supplementary, or MS + H), which is the next
  model gap — Zulu's halves were a step toward it. Also its own Bridge Week, its Base
  Building variant, and its named conditioning sessions.

**A soft-frozen week never got its stamp (2026-10-12)**
- Spotted while reading the affected account's `frozen` during the sync bug above.
- The current week is frozen `soft`: identity only, so a changed wave or max still
  reaches it. When it passed, a trailing pass did `delete f.soft` and nothing else — so
  it never gained the `rx`/`l3`/`tpl` stamp a hard freeze adds, and went on following
  today's plan forever. A week trained at 80% could later read as 95%.
- The upgrade now happens in the main loop instead of a trailing special case: a week
  that is frozen-and-soft-and-no-longer-current falls through and is written properly.
  One place decides what a frozen week holds.
- Same fix removed the last hardcoded 6: a cycle's maxes lock when `f.w` reaches
  `waveOf(f.tpl).length`, read off the wave that week actually ran.
- 222 → 224 tests, 6 mutants, all caught. Two needed tests that were missing either way:
  that freezing twice writes nothing (otherwise every render queues a write), and that
  the max lock reads the week's wave rather than today's.

**A stale cache could overwrite the server on a schema bump (2026-10-12)**
- Reported as "my maxes are missing from Setup". It was data, not display, and it was a
  bug in the schema-versioning design I added — not in any migration.
- **The mechanism.** A queued write makes a document *pending*, and `applyState`
  deliberately keeps a pending local document rather than the server's, so unsent edits
  are never lost. But `loadLocal()` migrated the phone's cached plan and queued a write
  **before** `/api/state` had been heard from. On any schema bump, every device whose
  cache was behind therefore declared itself the winner and uploaded a stale plan.
- **The damage.** One account's plan reverted to roughly its 30 September state: squat,
  bench and deadlift back to null, losing the maxes its 4 October bridge week had
  converted, plus the lift variants, a booked travel week and the body profile. **Logs
  were untouched** — only `plan/main` is written at boot, which is the signature of this
  bug rather than of a bad migration.
- **The date was wrong at first, and the correction matters.** It was found on 12 October,
  the day the schema went to 5, and blamed on that bump. The 11 October R2 backup then
  showed the damage already done, so it happened somewhere in the 4–11 October window —
  three schema bumps, any of which could have been the one. Do not read the KV backup
  list and assume it is all of them: the Sunday backups moved to R2, and only looking
  there found the copy that disproved the first answer.
- **The fix.** `migrate(write)`; `loadLocal()` passes `false`. The boot pass migrates in
  memory so the screen is right and writes nothing; `applyState` migrates whatever copy
  actually won and writes that. Offline, the migrated shape still reaches the cache and
  is written on the next sync.
- Diagnosed from D1 and the backups rather than guessed: the 4 October maxes reconstruct
  exactly from the logged bridge-week 5RMs (225×5 → 255, 205×5 → 235, 275×5 → 315,
  145×5 → 165), which is how they were handed back with confidence.
- Verified afterwards that nothing else went: all 14 log documents present, none missing
  from or smaller than either the 4 or 11 October backup.
- 220 → 222 tests, including one that replays the exact sequence through `loadLocal()`
  and one that proves a genuine unsent edit still beats the server.
- **Worth keeping:** a sync rule that protects unsent work will protect unsent *nonsense*
  just as carefully. Anything that marks a document dirty without the user having changed
  something needs to ask whether it has earned the right to win.
- Related, still open: a week frozen while it was the current week keeps `soft` cleared
  later but never gains the `rx`/`tpl` stamp a hard freeze adds, so those weeks follow
  today's plan rather than what was trained. Visible in the affected account's `frozen`.

**Program templates, stage 3: Green (2026-10-12)**
- TB II's other continuation protocol, both variants, as `CPROTO` entries. The protocol
  extension point built in stage 1 carried them: `t:'se'` and per-session `short`/`note`
  were already tested against a scratch protocol, so Green needed no new session plumbing.
- **The layout learned hardness.** `weekShape` took a count; it now takes the sessions and
  only keeps *hard* ones apart. Green's own template runs E on days 5 and 6, and
  `sessKind` has always called LISS `'easy'` and left it out of `ADJACENT_BAN` — the
  layout just did not know. Without this, Fighter + Green left two days empty and pushed
  a session onto a lifting day for no reason.
- **A rest day survives everywhere.** `keepRest` now also holds one back when a lifting
  day can carry the overflow, not only when a slot is spare. Every protocol in the book
  asks for one; Operator + Green is 3 + 4 = seven sessions and used to spend it.
- **`noStrength`**: Progressive SE does no barbell work — the book is explicit — so the
  protocol drops the template's lifting slots and Setup says so rather than letting the
  lifting quietly vanish. Dropping the slots is enough; the days are then never reached.
- **Ride-alongs are generic.** A circuit riding on a lifting day was being drawn as a bike
  session, interval timer and all. The day carries `ride:'se'|'hic'` and the session's own
  fields, and the day view picks `seCard` or `hicCard`.
- Rep tables are the book's grids, not a formula: Progressive SE is 3×30/3×30/2×35 then
  40/40/45 then 50/50/50. A formula was close but wrong in week 3.
- New matrix test over every template × protocol pairing: seven days, a rest day, no
  empty lifting day, every session kept, no clash. That is what catches the next one.
- 216 → 220 tests. 14 mutants, all caught. The one survivor was dead code, removed rather
  than tested.
- **Not built: Bangkok.** Asked for, but it is in none of the four books on disk (TB1 3rd
  ed., TB II Conditioning, Mass Protocol, Ageless Athlete) — searched text and tables.
  Dropped for now rather than invented.
- **Next:** TB III's templates (Mass, Grey Man, Gladiator, Fighter HT, Specificity A/B),
  which need a hypertrophy prescription model and have their own bridge week.

**Program templates, stage 2b: Zulu (2026-10-12)**
- Four lifting days, the cluster split in half, each half twice a week.
- **Half-clusters.** `plan.halves` with `HALF_KEYS=['squat','bench','dead','l3']`, where
  `l3` is a token meaning whatever the Lift 3 rotation gives that day. `setHalf` refuses
  to empty a half, `halvesOf()` drops lifts the app does not track and falls back per
  half, so no stored shape can produce a lifting day with nothing on it. Editable in
  Setup, shown only for a template with `split:true`.
- **Adjacency learned about halves.** `sessKind` returns `strengthA`/`strengthB` for a
  split template and both are in `ADJACENT_BAN`, so A-next-to-B is fine and A-next-to-A
  is still a clash. `kindName` maps both back to "strength" for the warning text.
- **Conditioning can ride on a lifting day.** Zulu's four days plus Black's three sessions
  do not fit in seven, and TB II's own "Black + Zulu" week answers that by putting a HIC
  after the barbell work on day 1 rather than spending the rest day. `weekShape` now
  returns `SC` as well as `S`/`C`/`R`, preferring a ride-along over two conditioning days
  back to back, and keeping one rest day whenever the week has a slot to spare. The day
  view renders the session under the lifts, the way the bridge week's easy spin already
  did. Our Zulu + Black week comes out day for day identical to the book's.
- Asked before building rather than guessing: the scan of Zulu's table looked like the
  two day-pairs ran different percentages within a week, which would have needed a
  per-day prescription and a much bigger change. Confirmed against the book as one wave
  per week, so it fits the existing model.
- 213 → 216 tests. 22 mutants, all caught. Four survived the first pass, all of them
  stored-data guards and the ride-along's note/label/format — none reachable from the
  happy path.
- **Next:** TB II's Green protocol (E and SE sessions, which the protocol model already
  supports), then TB III's templates.

**Program templates, stage 2: Fighter (2026-10-12)**
- The first second template, and the first real exercise of the stage-1 model.
- **The books number the lifting days**, so that is data on the template (`slots`) rather
  than something `weekShape` infers: Operator is days 1/3/5, Fighter 1/4, Zulu 1/2/4/5.
  The first attempt derived positions by interleaving and put Fighter's two days one
  apart, which is worse training than the book's Mon/Thu and wrong besides. Conditioning
  now fills the free slots greedily, skipping any that would touch one already taken.
  - This also gets Zulu right for free: its A/B days are *meant* to be back to back,
    because they work different halves of the cluster. `orderIssues` will still call that
    a clash — something to fix when Zulu lands.
- **The wave moved onto the template.** Fighter's is a three-week block run twice with
  3–4 sets, not Operator's six. `plan.wave` became `plan.waves[template]` (migration 5),
  so switching across and back does not lose tuned numbers. `cycleWeeks()` derives the
  cycle length from the wave, which was hardcoded at 6 in two places.
- **Frozen weeks are stamped with the program they ran under**, so switching does not
  redraw October as a thing you never did. The stamp goes on the *hard* freeze only: the
  week you are in is prescription, not history, and follows a switch the same way it
  follows a changed wave. A surviving mutant found that inconsistency — the first version
  stamped the soft freeze too, which would have given the new wave with the old layout.
- Fighter gets its own accessory jobs (`f1`/`f2`), since two days must cover what three
  did, and the Setup accessory editor now takes its days from the template instead of a
  hardcoded mon/wed/fri. As with the three-day split, the lists are the app's and not the
  book's — TB1 prescribes no accessory work.
- The crash test used to break the plan with `plan.wave = null`; `waveOf()` now falls back
  to the template, so that no longer breaks anything. It breaks a wave row instead.
- 209 → 213 tests. 19 mutants, all caught.
- **Next:** Zulu (needs the A/B half-cluster, which the lift model has no notion of, and
  the adjacency rule relaxed for it), then TB II's Green protocol, then TB III.

**Program templates, stage 1: the model (2026-10-12)**
- Groundwork for building the rest of TB II's protocols and TB III's templates in. No
  user-visible change: 205 tests passed untouched across the refactor, and a new test
  deep-equals every composed slot against the literal array it replaced.
- `dayPlanSlot` wrote each week out as a hardcoded seven-day array per `wk.kind`. That was
  fine with one program and does not survive a second: strength template × conditioning
  protocol multiplies, and hand-maintained grids drift apart.
- Two independent axes instead, which is how the books present it — TB II's sample weeks
  are literally headed "Black + Zulu", "Black + Operator", "Black + Fighter".
  `src/app/01c-templates.js` holds `STEMPL` (lifting days and what is on them) and
  `CPROTO` (what sits between them); `composeSlot` is the only thing that knows the layout.
- `weekShape(nS,nC)` interleaves so no two days of the same banned kind touch, leading with
  the bigger pile and spending spare rest days as spacers. Operator + Black is 3 and 3,
  which derives S C S C S C R — the week the app has always drawn.
  - Separating n days of one kind needs n−1 others, so some combinations cannot be split
    (five conditioning days and two rests). The shape doubles up there and `orderIssues`
    reports it, rather than the layout pretending.
  - First version parked all rests at the end, which put two of Zulu's four strength days
    together when a rest could have gone between them. Caught by writing the four-day case
    down before Zulu exists.
- A protocol's session may set its own `t` and `short`, so Green's E and SE days are a data
  addition rather than another branch. There is a test for that extension point using a
  scratch protocol, because Black never exercises it and the mutant survived without one.
- Unknown `plan.stempl`/`plan.cproto` fall back to Operator/Black: a plan naming a template
  an older build does not have still trains.
- `dp.day` was dead already; kept so the composed slot deep-equals the old literal.
- 205 → 209 tests.
- **Next:** stage 2, the TB1 strength templates (Fighter, Zulu, Operator I/A, Gladiator),
  which should now be `days:` arrays. Then TB II's Black variations and Green, then TB III.

**The rest beep, taken apart properly (2026-10-09)**
- Third report of "the beep doesn't work". The first two fixes were guesses, and they were
  guesses because **the harness stubbed `AudioContext` as `undefined`**, so `audioCtx` was
  always null and every beep in every test was a silent no-op. Nothing about the alert
  sounds had ever been asserted. That is the root cause of the root cause.
- The harness now has a recording `AudioContext` (oscillators started, resumes counted, a
  clock that is frozen until resumed) and an `<audio>` stub that records `play()`.
- Two real defects fell out once it was testable:
  1. `resume()` is async. The old code called it and read `currentTime` on the very next
     line, off a context still suspended, then scheduled three oscillators against that
     stale clock. After a phone lock the clock jumps on resume, so all three were queued
     in the past and never sounded. `beepTones` now schedules inside the resume's `.then`.
  2. `audioSession.type` was `'transient'`, which ducks other audio **and is silenced by
     the iPhone ringer switch**. Now `'playback'`.
- Added a second route out: the beep is also an HTML media element, built as a ~6.5 KB
  WAV in memory (no asset, nothing to cache-bust). iOS silences bare Web Audio when the
  ringer is off but plays media elements, which is the case a gym timer exists for.
- `audioState()` is the pure inspector; `beepDiag()` beeps and reports. Splitting them
  mattered: the first version of the test read state through `beepDiag` and got six tones,
  because the inspector was making a noise of its own.
- Setup → Sound has **Test the beep**: runs the real path, prints plain-English advice per
  cause (`beepAdvice`), and copies as a report. Three rounds of guessing is enough.
- Still true and now said out loud in the UI: iPhone Safari has no Vibration API, so the
  buzz half can never work there.
- `lsAct(a,b)` extracted from session mode's click listener. Every button in session mode
  was unreachable from a test; three mutants that survived (the ramp nudge, the warm-up
  clock, the working-set nudge) are now caught through the real dispatcher.

**Adjust a ramp set by the lift's increment (2026-10-09)**
- `adjustWarm(date,k,j,delta,calc)` and `warmW(date,k,j,calc)`: session mode's warm-up step
  gets − / + stepping by `plan.round[k]`, floored at the bar. A weight you set beats the
  calculated ramp everywhere, so the step, the plate maths and the "Next:" line agree.
- It writes `lifts.<k>.warmup.<j>.w` — the same field the day card's typed input uses, so
  the two screens are one source of truth rather than two.
- 198 → 205 tests.

**Plyos come off the HIC day (2026-10-08)**
- Plyometrics were a day *type* (`t:'plyohic'`) in three week layouts, which made them
  inseparable from the Thursday conditioning session. They are now an *attribute*:
  `dayPlan()` attaches `{plyo:true}` to whichever weekday `plyoDow(monday)` names, and the
  day underneath keeps whatever it always was. The three `plyohic` layout slots are plain
  HIC/LISS again and `sessKind` lost its special case.
- `plan.plyoDow` (3, Thursday) is the usual day; `plan.plyoMove[monday]` overrides it for
  one week. `setPlyoDay` deletes the override when you pick the usual day again, so no-op
  entries do not accumulate, and refuses a week that has gone by, a day already past in
  this week, and a week with no plyo phase at all.
- The picker lives under Plyometrics in the existing Move… sheet, which is reachable from
  every day, rather than on the plyo card, which is only reachable from the plyo day.
- `dayPlan` rewrites `short` as well (`Plyo+Op 1`, `Plyo+HIC`, or just `Plyo` on a day with
  nothing else), so the week strip, the Plan calendar, the ICS feed and the CSV all name the
  day without any of them needing to know about `plan.plyoMove`.
- `sessionHtml` draws the plyo card first and returns early on a rest day, so plyos on a
  Sunday are the session rather than a card under "Full rest". The card's closing line
  ("before the conditioning" / "before you lift" / nothing) follows the day it landed on.
- 193 → 196 tests. All 14 mutants caught; the one that survived first time was dropping the
  `weekHasPlyo` guard from `setPlyoDay`.

**90 s between ramp sets, and a clock on the warm-up list (2026-10-08)**
- Two things from a session. Rest between warm-up sets was too short, and the only way to
  time a warm-up movement was to hand the whole block to "Guide me through it".
- `WARM_RESTS` drops 30 s and 45 s (now `[60,90,120,150]`), `warmRestSecs` floors at 60,
  and migration 4 lifts any stored value under a minute to 90. A rest someone deliberately
  made *longer* is left alone. The running timer already took +30 s, as many times as you
  want, which is the "extend" half of the ask.
- Session mode's warm-up and mobility checklists now carry the same ⏱ the day view's rows
  have. `lsHold(kind, i)` resolves the dose from the item's index in `WARMUP`/`MOB`, not
  its position in what is shown, so the short warm-up does not shift the clock onto the
  wrong movement — which is exactly the mutant that survived until a `warmShort` test
  existed.
- 196 → 198 tests.

**Conditioning gets its own aims (2026-10-08)**
- `AIMS_COND`: rounds hit, warm-up, holding the pace, keeping the easy parts easy,
  finishing with something left, cooling down, logging the number. Four are scored from
  what is already logged (`hic.rounds` against `ivOpts().rounds`, the warm-up and
  cool-down ticks, the metric); three are pacing judgements only you can make.
- `aimSet(date)` picks the set by day type and filters by an optional `when`, so a
  steady session is never asked about rounds or easy periods — it has neither.
- The pattern advice is set-specific. Fading repeatedly is told it went out too hard,
  not that the weight is too high.
- Nothing logged is not a pass: an unlogged round count, an unticked warm-up and a
  session with no number all report as missed. The mutation making an unlogged session
  count as success passed until a test for it existed.
- Test days and Base Building circuits still get no aims: neither set fits them.
- 190 → 193 tests.

**Aims are Operator days only (2026-10-08)**
- Every one of the eight questions is a lifting question: "complete every set as
  programd" means nothing on a bike. The card now shows on `t==='lift'` days only, and
  not on bridge or retest days either — setting an intention about technique before a
  max is a different exercise.
- The **note** is gated separately, on any training day. A conditioning note is worth
  reading back before the next conditioning session, and notes can already be written
  on those days from the session card.
- Conditioning would need its own questions and its own review rather than these
  reworded. Not built; sketched for a decision.

**A shared, curated exercise list (2026-10-08)**
- `acc_catalog` in D1 (migration `0005`), served to everyone with `/api/state` and cached
  locally. Admins add and retire from the Admin tab; nobody else can write to it.
- **Retiring is not deleting**, and that is the whole design. A retired movement stops
  being offered but still resolves, keeps its name, and stays in the picker of anyone
  who already chose it. Rewriting somebody's accessory mid-cycle because a list changed
  would be worse than letting them finish with it.
- Retiring a built-in is a row carrying only `hidden` — the built-in keeps its own name,
  so the two cannot drift apart. A hard delete of an added movement does fall back to the
  slot's default, which is the honest outcome when the thing no longer exists at all.
- Per-user additions are no longer offered: the list is curated now. Existing ones still
  resolve and Setup names them, so nothing anyone picked has broken.
- The fake D1 threw on the three new queries rather than ignoring them, which is exactly
  what it was built to do.
- Five mutations all fail. 182 → 189 tests.

**Three open issues closed (2026-10-08)**
- **Base Building circuits can no longer be put back to back.** `sessKind` gives `se` its
  own class. The rule lived in two places — `orderIssues` warned and `bestOrder` chose —
  and fixing only the warning left the arranger still producing the forbidden week, which
  the tests caught. Both now read one `ADJACENT_BAN` list, because when those disagree
  the arranger silently wins.
- **A retest splits the cluster across Thursday, Friday and Saturday** once it is more
  than a pair, the same split the bridge week already makes. Friday was sitting empty
  while Saturday tested four lifts. A small cluster still uses two days.
- **The week you are in keeps its identity.** `freezePast` now records the current week
  too, but *softly*: kind, cycle and number are fixed, the prescription is not. Changing
  the deload or retest cadence takes effect from next week rather than turning Wednesday
  into a deload; the wave and maxes still reach this week, which is what Setup promises.
  The soft mark is dropped once the week has passed and it freezes properly.
  - Consequence worth knowing: a cadence change does not retro-fit a deload to a boundary
    already behind the frozen week. It acts on the next boundary it can reach.
- Setup's locking note rewritten, since it had been promising the old behavior.
- Five mutations all fail. 179 → 182 tests.

**Swimming is always meters, and `fixedUnit` is real (2026-10-08)**
- Swimming is measured in meters because a pool is, not because of a preference. Joined
  the rower and ski erg under a new `fixedUnit` flag on the activity.
- The flag was **inert when first written** — the mutation that ignored it passed. The
  conversion only ran one way (`yd→m` on metric), so anything declared in meters was
  stuck there anyway and the flag protected nothing. Documentation wearing the costume
  of a mechanism.
- Fixed by making the conversion symmetric: metric converts `mi→km`/`yd→m`, imperial
  converts `km→mi`/`m→yd`. Now a distance can be declared in whichever unit is natural
  and still follow the setting, and `fixedUnit` genuinely opts out.
- The imperial half had no caller, so a test adds a throwaway activity declared in meters
  and asserts it reads as yards on imperial. Otherwise it was untested dead code that
  happened to be correct.

**Interval distances follow the unit setting (2026-10-08)**
- On imperial you got run and trail LISS in miles but run and trail **HIC in meters**.
  `metricFor` only ever converted `mi→km` and `yd→m`, so a distance written as meters
  never moved. An omission, not a decision — swim already converted.
- Fixed by declaring the self-measured distances in their imperial form (`yd`) so the
  existing conversion reaches them. No new rule.
- **The rower and ski erg keep a hard `m` deliberately**, and the comment says so: meters
  is what the machine's own display reads in either system, and relabelling it to yards
  would be telling the user something untrue.
- Checked before relabelling: no run or trail distances were logged, so nothing already
  stored changed meaning. Switching units has never converted stored values anywhere in
  this app, so the risk was real rather than theoretical.
- A test now asserts that anything self-measured is declared in a unit the setting can
  reach, so the next activity added cannot quietly repeat this.

**Hill sprints as an activity (2026-10-08)**
- Its own entry rather than a note under Run / sprints: the incline caps the top speed,
  which changes both the risk and what the session is for. Distance in meters on a hard
  day, elevation counted like trail, ruck and hike, and no LISS metric — a hill sprint
  session is not a steady one, so it asks for minutes instead of inventing a number.

**Session aims, and the note that comes back (2026-10-08)**
- Pick up to three things that matter before a session; get an honest account after.
  Not a restatement of the prescription — the numbers are already on the cards. This is
  how you mean to train, which is the part that drifts.
- Five of the eight are scored from what is already logged (sets against prescribed,
  warm-up flags, grinder flags, accessory completion, mobility). Three can only be
  self-judged and ask once at the end. The screen shows which is which rather than
  pretending to know.
- **The note is the point.** `logs[d].notes` already existed and went straight into a
  History table nobody reads. It is now shown before the next *comparable* session — the
  last lifting note before a lifting day, not yesterday's bike session — dismissible, and
  gone once the day is done.
- "Focus on this next time" only fires on a pattern: the same aim picked and reported
  slipped in two of the last three sessions. One bad session says nothing.
- `pickAim`/`rateAim` are named functions because the click handler is unreachable from a
  test — the cap mutation passed until they existed, since the tests were only checking
  that the markup *said* three was the limit. Third time this pattern has bitten.
- 172 → 176 tests.

**Accessories in session mode (2026-10-08)**
- They were one lump step of done-toggles while every real control — the exercise, the
  swap, the sets — lived only on Today's card. Each job is now its own step, after the
  working sets, with the picker, weight and reps, and a rest timer.
- Rest defaults to `plan.accRest` = **90 s**, against the two to five minutes the main
  lifts use. The global rest bar's ±30 s still applies.
- Accessories now count toward the session's progress rather than sitting outside it.
- Typing saves on every keystroke but re-renders only on blur: `lsRender` rebuilds the
  card and, unlike `renderMain`, does not restore focus. Writing on input and rendering
  on change avoids the caret problem rather than working around it.
- Four mutations — back to one lump step, an accessory that is never finished, no rest
  timer, no swap — all fail. 169 → 172 tests.

**The rest beep: silenced, not broken (2026-10-07)**
- Reported from the gym as "completely broken for all rest timers". It was not broken:
  `plan.quietTimer` was on, so `quiet()` short-circuited `beep()`. Three real problems
  behind that, though.
- **Silent suppressed vibration too.** The `return` sat above the `navigator.vibrate`
  call. Silent exists so iOS does not take the audio session off your music; vibration
  never touches audio. The buzz now fires first and unconditionally. (No help on iPhone,
  which has no Vibration API — right on Android and right in principle.)
- **Nothing said sound was off.** The rest timer now shows a **Silent** tag while
  `quietTimer` is on, tappable to turn sound back on. A timer that cannot make a noise
  should say so rather than read as faulty.
- **The Setup copy was false.** It promised "the countdown, the vibration and the screen
  still work" — vibration did not, and on iPhone never can. Rewritten to say plainly
  that Silent on an iPhone leaves the screen and the notification only.
- **Harness bug found doing it:** Node defines `navigator` as a read-only getter, so
  `global.navigator = {...}` had been silently doing nothing and every test was reading
  Node's own navigator. Nothing the app reads off navigator could be stubbed. Now defined
  with `Object.defineProperty`.
- `unquiet()` is a named function because the `#rest` click handler cannot be reached
  from a test — the same reason `addSet` is one. 167 → 169 tests.

**Restore has now run against real data (2026-10-07)**
- Closed the oldest open issue. A real backup was restored into a real account through
  the admin panel at 20:25 UTC: read, safety copy taken first, written in one batch,
  audited with the source backup and where the previous data went.
- It rolled a logged day off the account, correctly — the backup predated it — and that
  day is inside the `before-restore` copy, which is the undo working as designed rather
  than a loss.
- What this proves that the tests could not: the real R2 round trip, a real D1 batch, and
  the current log shapes (Base Building, per-day SE lists, slot-keyed accessories) all
  surviving a restore.

**Typing in a confirmation box no longer throws the caret out (2026-10-07)**
- Reported on the admin restore: every character needed a fresh tap on the field.
  `render()` replaces the whole of `#main`, and `renderMain` restores focus and the caret
  **by element id**. The confirmation input had no id, so every keystroke replaced the
  element and focus went nowhere. Every `data-bind`/`data-pbind` input in the app has an
  id; the two I added did not.
- Found alongside it: `data-accnew` had no id **and** never re-rendered, so the "Add it"
  button in Setup → Accessories stayed disabled however much you typed. Both fixed.
- Also gave the plyo upper-body `<select>` an id — pre-existing, same class, milder.
- New guard: a test scans `src/app/` for inputs carrying a render-triggering attribute and
  fails if any lacks an id. Same shape as the bare-`.banner` CSS test: a rule the codebase
  already followed everywhere except where I broke it.
- Only one confirmation box can be open at a time now, so the two ids never collide.

**An admin can restore a backup for someone (2026-10-07)**
- `GET /api/admin/users/<email>/backups` and `POST .../restore`. The restore goes through
  the same `restoreFrom` a person uses on themselves, so it takes a **before-restore copy
  of what it is about to replace** and writes in one batch.
- Same bar as a removal: the address typed back, because this replaces everything they
  have right now. Covered: no confirmation, wrong address, no backup named, a backup that
  is not there, a path, and the verification record — which parses as JSON and would
  otherwise reach the restore before being turned away. All refused without touching a row.
- Audited with which backup it came from and where their previous data went.
- Two test-harness notes. The fake D1's `exec` closes over its own arrays, so reassigning
  `env.DB.docs` silently detaches the test from the database — a `clearUser` helper now
  does it in place. And a near-equivalent mutation (dropping the name check) only failed
  once the `_check` case existed to distinguish it.

**Audit log: renamed, and actually refreshing (2026-10-07)**
- Reported as "exports are not showing up". They were: both rows were in `admin_log`. The
  panel loaded once behind a **Show** button and then cached forever, the screen's Refresh
  only reloaded the people list, and an export is a browser download the app never sees
  — so it was a stale snapshot taken before the exports happened.
- It loads on its own now, has its own Refresh, and the screen's Refresh reloads both.
- "What administrators have done" → **Audit log**. Inside a tab already called Admin,
  "Admin audit log" would say admin twice.
- A removal's stored JSON is rendered in words — "2 documents, 0 backups, calendar feed,
  alerts" — rather than sitting unused in the column.
- Times are local now, not UTC.

**Administration is its own tab (2026-10-07)**
- Moved out of Setup into a seventh nav tab, shipped `hidden` in `index.html` and revealed
  when `/api/state` reports `admin`. One entry point rather than two.
- The flag is remembered in `localStorage` so the tab survives a cold or offline open, and
  cleared by `switchUser`. It is a hint for the page only — every admin route checks
  again, so a stale yes grants nothing.
- A stored `view` of `admin` on a non-admin falls back to Setup, but only once the server
  has answered: an admin reopening the app should not be thrown off their own tab by a
  slow network.
- The harness's `querySelector` returned null for everything, so any code that shows or
  hides a nav tab was unreachable from a test — the "tab shown to everyone" mutation
  passed. It now answers the one selector the app uses, and that mutation fails.

**An administration view (2026-10-07)**
- Groundwork for more than one person using this. `ADMIN_EMAILS` names administrators;
  the check runs against the same verified Access token everyone else is checked against,
  so there is no second login and no password to keep.
- A non-admin gets **404 rather than 403** on every admin route: a 403 confirms the thing
  exists. The page asks the server whether it is an admin and only uses the answer to show
  a link; the server re-checks every route regardless.
- Lists people with counts, bytes, last activity and backup health. **No route reads a
  training log** — that is not administration. The export hands a file back whole.
- Removal takes documents, every backup, the backup check record, the calendar feed and
  the push Durable Object (new `wipe` op in `alerts.js`). A half-deleted account is worse
  than either extreme. It needs the address typed back, refuses your own account, and is
  recorded in `admin_log` (migration 0004) with every export.
- Seven mutations — dropping the admin check, the confirmation, the self-delete guard,
  the backup or calendar cleanup, the audit write, or telling everyone they are an admin
  — all fail. 152 → 158 tests.
- Needs two things this repo cannot do: the secret and the migration. Deploying without
  them is inert rather than broken, since nobody is an administrator by default.
- Still to come: the shared, admin-curated exercise catalogue.

**JM press added to the triceps catalogue (2026-10-07)**

**Carries moved to the end of OP3 (2026-10-07)**
- Grip work last, so a fried grip is not making the curls and the rows that follow worse.
  OP3: Single-leg · Posterior chain · Biceps · Triceps · Carry / grip.

**Shoulders split into a press and a raise (2026-10-07)**
- One slot doing "shoulders" was really two jobs. **Shoulder press** on OP1 (eight
  options, dumbbell press by default) and **Lateral raise** on OP2.
- The raise keeps the `delts` id rather than being renamed. Everything already logged and
  picked is keyed by it, and that catalogue was only ever lateral raises, so the id still
  means exactly what it did — a rename would have needed a migration to achieve nothing.
- OP1: Shoulder press · Rear delt · Core · Biceps · Triceps.
  OP2: Horizontal pull · Lateral raise · Pull-up progression · Biceps · Triceps.
  OP3 unchanged. Five jobs a day on all three.
- Pike push-ups join the bodyweight list so the weight box reads "bw" rather than lb.

**Accessory days rearranged around the overhead press (2026-10-07)**
- Shoulders move to **OP1**, away from whichever day the overhead press lands on when it
  is the Lift 3. The horizontal pull moves to **OP2** to balance that press.
- Rear delts stay with the shoulders rather than following the row: that slot is shoulder
  health under a lot of benching, not back volume. If it should move, it is two taps in
  Setup now rather than a code change — which is the point of 1.53.
- OP1: Shoulders · Rear delt · Core · Biceps · Triceps. OP2: Horizontal pull · Pull-up
  progression · Biceps · Triceps. OP3 unchanged.
- Defaults only. A day whose slots have been edited in Setup keeps what was set.

**Arms on every Operator day, and picks keyed by day (2026-10-07)**
- Biceps and triceps now appear on all three Operator days, not one each.
- That exposed a flaw in 1.53: a slot's exercise was global, so a job appearing three
  times a week meant the same curl three times a week. `accPickFor` is now keyed by
  **day and slot**, so Monday can be barbell curls and Friday incline.
- Setup is simpler for it. One segmented control picks whether you are editing this cycle
  or later ones, and each day lists its jobs with the picker inline — instead of two
  columns of selects in a separate section.
- Migration 3 spreads a 1.53 flat pick to every day that has that job, and leaves an
  already-converted shape alone, so running it twice is safe.
- Four mutations — a pick that ignores the day, a migration that spreads twice or onto
  days without the job, and arms back on one day each — all fail. 150 → 152 tests.

**Accessories become slots, exercises and sets (2026-10-07)**
- Replaces lines of text with a tick. A **slot** is the job (Horizontal pull, Biceps,
  Carry); an **exercise** fills it, picked **per cycle** like the cluster lifts; a
  **one-session swap** covers a taken barbell. Sets, weight and reps are logged like the
  main lifts, or just Mark done.
- This retires the "accessory ticks are stored by position" open issue by making it
  impossible rather than patching it: everything is keyed by slot. Migration 2 pins old
  positional ticks to the slot they meant, and archived programs — whose day layout is
  not this plan's — are read in place by position rather than guessed at.
- `ALIB` holds ~60 exercises tagged with slot and kit; `plan.accCustom` takes your own,
  validated on read so a malformed entry cannot break the picker. **No admin portal**:
  one person uses this app, and a second auth surface plus a data deploy path to add a
  curl variation is not a trade worth making. The same pattern already exists for lift
  variants and SE circuits.
- Five mutations — ignoring the day swap, ignoring the cycle pick, losing old
  by-position logs, a migration that drops ticks, unvalidated custom entries — all fail.
  145 → 150 tests.

**Backups check themselves, and a crossed change says so (2026-10-07)**
- Every backup is read straight back after it is written and compared with what was meant
  to be stored: byte length, the plan, the log and program counts, the owner. The verdict
  is kept beside the backups under a name no backup can have, so the **weekly run leaves a
  record** rather than failing in silence, and Setup shows a tick or a warning.
- This is the roadmap's "verify by restoring", done without restoring over live data —
  which would have been a scheduled job that writes, to protect against a risk that is
  mostly about reading. Restore itself is now covered by tests instead.
- Caught by the tests: a truncated write, a write that vanished, and the subtle one — a
  store that hands back valid JSON of the right shape but not the bytes we gave it. That
  last case is the only one the byte-length check catches on its own, and without a test
  for it the check was dead weight.
- **Two devices offline on the same day** is no longer silent. `applyState` kept this
  device's unsent version and dropped the server's without a word; it now records the
  clash and Setup lists the days under **Changes that crossed**. Detection, not merging:
  last write still wins, which is almost always right for one person, but "my Tuesday
  looks wrong" has an answer now. Device-local, deduped per day, capped at 10.
- Not done, deliberately: per-document version checks. Whole-document writes mean a real
  merge needs field-level timestamps, which is a large change to the riskiest code in the
  app, for a case that needs two devices editing the same day while both are offline.
- 140 → 145 tests.

**Restore, the document routes and the calendar endpoints are tested (2026-10-07)**
- A D1 stand-in that interprets the handful of statements `src/api.js` actually issues,
  over real rows, so restore's delete-then-insert can be checked rather than assumed. It
  throws on any query it does not recognise, so a new one cannot slip past by being
  ignored.
- Restore: it replaces rather than merges, takes a time-stamped safety backup of what it
  is about to destroy, does it in **one batch with the DELETE first**, refuses anything
  that is not a backup before touching a row, skips malformed entries, and cannot reach
  another person's documents.
- Document routes: per-user scoping (one person's state never contains another's), the
  path allowlist, PUT-only, and the JSON/size checks.
- Calendar: on / rotate / off, upload rejected without a feed or without a calendar body,
  the feed served as `text/calendar`, an unknown token refused, and **rotate killing the
  old address immediately**.
- Found while writing them: `logs/2026-02-31` and `logs/2026-13-99` were accepted, by the
  document route and by restore. The pattern matched the shape of a date without asking
  whether the date exists. `realDate()` now checks both places.
- Six mutations — skipping the safety backup, not clearing first, accepting a non-backup,
  allowing impossible dates in either place, accepting any body as a calendar — all fail.
  127 → 140 tests.

**A number that looks wrong says so (2026-10-07)**
- `oddNote()` inside `numIn` and `pIn`, so every numeric input gets the check from one
  place rather than each card remembering to ask.
- A note, never a block: the value is stored exactly as typed and the wording says so.
  It also does not dismiss — it stays until the number changes, because a typo should
  keep asking rather than be waved away once and forgotten.
- Bands are deliberately wide (bodyweight 60–400 lb, lifts 0–1200 lb) so a genuinely
  strong or genuinely light person never sees one. They convert with the unit setting,
  and measurements switch to centimeters, so kilograms are not all flagged.
- Covered: ordinary values stay silent, the roadmap's two cases are caught, blanks and
  non-numbers say nothing, fields with no sensible band are left alone, warm-up rows are
  excluded (too cramped for a note), and the unit conversion works both ways.
- The one row-flex label that holds a numeric input (working weight) wraps now, so the
  note lands on its own line instead of squeezing the field.

**A crash says so instead of going blank (2026-10-07)**
- `render()` splits into a thin `render()` that catches and `renderMain()` that does the
  work. A thrown view now paints a banner with the message, a Reload and a Copy details,
  rather than leaving whatever was on screen or nothing at all.
- `window.onerror` and `unhandledrejection` are recorded too, so a failure that never
  touches `render()` is still reportable.
- The last 5 errors live in `localStorage` under `ob.errs` and surface as a **Problems**
  card in Setup, with Copy all details and Clear. **Device-local, never synced**: a stack
  trace can name a lift or a date and there is no reason for that to reach the server.
  The card says so, because "we collected your errors" should never be a surprise.
- Found while testing: a plan broken enough to kill Today also killed **Setup**, which is
  where the Problems card lives — the recovery screen failed in the one case it exists
  for. The wave table now tolerates a non-array `plan.wave`, and the crash banner carries
  its own Copy details so no other screen is needed.
- Mutation-checked: removing the catch, not recording, dropping the cap, or keeping the
  oldest rather than the newest all fail the suite. 122 → 125 tests.

**Measured the render cost, and fixed the real one (2026-10-07)**
- **The premise of the old roadmap item was wrong.** It said every `data-bind` input calls
  `render()`. It does not: the `input` listener only writes state, and `render()` hangs off
  `change`, which for text and number fields fires on blur. Typing has never re-rendered.
  The cost is per *interaction* — a set tick, a checkbox, a day change — not per keystroke.
- Measured against 353 day logs (a year), building the HTML in Node and applying it in
  headless Chrome. **The DOM was never the problem**: parsing and laying out even Status's
  58 kB and 971 nodes costs 3.4 ms. Building the string was 19–25 ms.
- `vToday` spent **15.7 of its 19.1 ms inside `weekSummaryCard`**, which produces about a
  kilobyte. `weekRecap` calls `prsOn` once for each of the week's seven days, `prCard` asks
  an eighth time, and each call rebuilt `prList()` — a walk over every log, several times
  over, per call. Roughly 64 full scans of a year of training to render one card.
- Fixed by caching `prList()` against `planV + logsV`, the way `weeks()` and `maxFor()`
  already are. `logsV` is new: every other path that replaces `logs` wholesale already
  bumped `planV`, so only `setLog` and `applyState` needed it.
- **Today: 19.1 ms → 2.7 ms to build, 5.0 ms including the DOM.** About 25 ms on a phone
  five times slower, which is below the threshold where a tap feels delayed.
- Status is now the slow one at 26 ms (about 130 ms on that phone), but the profile is
  flat — no hotspot, just a lot of date parsing across a year of charts. It is a view you
  open deliberately rather than one that re-renders under your thumb, so it is left alone.
  Worth revisiting only if it is ever felt.
- Tooling note for next time: `node --test` output through `| tail` buffers until the pipe
  closes, which made a working script look hung for ten minutes. Redirect to a file.

**The service worker's cache name is stamped by the build (2026-10-07)**
- `VERSION` was typed by hand. Change an icon or the manifest, deploy, and every
  installed app kept serving the old one out of a cache nothing invalidated — which
  looks like a broken deploy rather than a missed step.
- `build.js` now reads the worker's own `SHELL` array and hashes the files it names.
  One source of truth: the list the worker caches is the list the version is computed
  from, so the two cannot drift. A precached file that is not on disk is a build error
  now, where before it was a silent cache miss.
- `build.js` exports `build`, `shellFiles`, `shellVersion` and `stampServiceWorker` and
  only runs when invoked directly, so the build is testable rather than a script.
- `test/build.test.js`, 8 tests: the name is stamped and matches, every precached file
  exists, a changed icon / manifest / page moves it, a non-shell file does not, a
  missing file or a worker with no `SHELL` or `VERSION` line is a build error, building
  twice changes nothing, and an icon change alone moves the name through a full build.
- Everything that writes runs in a throwaway copy of the repo. The first version called
  `build()` on the real tree, and since `node --test` runs test *files* in parallel it
  rewrote `public/app.js` underneath the other suites: `schedule.test.js` failed with
  "could not replace the boot block" about one run in three. Verified with ten
  consecutive clean runs rather than one.
- Mutation testing caught the same shape of hole as last time, twice running. Asserting
  that `sw.js` is correct *now* proves nothing, because the last build made it correct;
  deleting the stamping step left every test passing. The fix is a test that breaks the
  file first and checks the build repairs it. Worth internalising: a test of current
  state is not a test of the thing that maintains it.
- 113 → 121 tests.

**The Access JWT check is tested (2026-10-07)**
- Tested with **real cryptography**, not a stubbed verifier. The suite generates RSA-2048
  keypairs with `crypto.subtle`, serves them as a JWKS from a stubbed `fetch`, and mints
  genuine RS256 tokens. Nothing about the verification is faked, so a forged token has to
  actually fail the real signature check rather than a mock of it.
- Nine cases: a valid token identifies by its signed claims; a tampered payload with the
  original signature is refused; a token signed by an unpublished key is refused; a token
  from another Access application on the same team is refused (`aud`, as both a string
  and an array); wrong issuer, expired, no expiry, absent and malformed tokens; key
  rotation forcing a refetch rather than failing out of a stale cache; `ALLOWED_EMAILS`
  as a second lock applied after the signature; case-insensitive addresses; and a missing
  `ACCESS_AUD` or team domain closing the door rather than opening it.
- Mutation-checked. Removing the signature, audience, issuer or expiry check, bypassing
  `ALLOWED_EMAILS`, or dropping the lowercasing all fail the suite.
- One mutation does **not** fail, and it should not: replacing `if (!jwk) throw` with a
  fall back to `keys[0]`. A token signed with an unpublished key then fails the signature
  check instead of the `kid` lookup, so the outcome is identical. An equivalent mutant,
  not a hole — and a reminder that the signature is the gate and the `kid` is a hint.
- 104 → 113 tests.

**Backup retention per kind, and the first Worker tests (2026-10-07)**
- `KEEP = {auto:26, manual:6, safety:6}` replacing one shared pool of 26. A run of manual
  backups used to delete weekly history one for one, silently, and the weekly history is
  the part worth having.
- Counting rather than ageing is deliberate: the newest of each kind survives however old
  it is. An R2 lifecycle rule deleting by age would clear the lot during a long break,
  exactly when there is nothing newer to fall back on.
- `backupsToPrune()` is pure and exported, so the decision is testable without a runtime.
- **First tests for `src/api.js`**, with hand-written stand-ins for the R2 and KV bindings
  (paginating at 2 so the cursor loops are actually exercised). 9 tests: retention by
  kind, never emptying a kind, R2 writes and reads, KV still listable and restorable,
  R2 winning a duplicate name, delete clearing both stores, the no-R2 fallback, per-user
  scoping, and the weekly roll-call.
- Worth recording: mutation testing caught a hole in my own tests. Reverting `backupNow`
  to the old shared-pool prune left all 8 of them passing, because they exercised
  `backupsToPrune` in isolation and never checked that `backupNow` calls it. Added a
  ninth that drives the whole path. A unit test of a helper proves nothing about the
  caller.

**Backups moved to R2 (2026-10-07)**
- Bucket `operator-black-backups`, binding `R2BACKUPS`. KV capped a value at 25 MB and is
  priced for small hot reads rather than whole-history JSON; R2 is also browsable in the
  dashboard, which was the point of the idea.
- **No data was migrated, by design.** `listBackups` merges both stores and `readBackup`
  tries R2 then KV, so every backup taken before today is still listed, downloadable and
  restorable. They age out of the 26-week window on their own and the KV binding can be
  dropped then. A name in R2 wins over the same name in KV.
- Writes fall back to KV if the binding is absent, so a deploy without the bucket
  degrades instead of failing.
- Pruning now deletes from both stores, so the 26 kept are 26 in total rather than 26 each.
- Untested, like all of `api.js`. This is backup code, which is the worst place in the
  project to have no tests, and it moves the Worker-tests item up the list.

**Calendar feed: training time and reminders (2026-10-07)**
- `plan.cal` = `{mode,time,weekend,alarm}`, so the setting syncs across devices and a
  change queues an upload through the existing plan-write hook.
- Timed events use **floating local time**: `DTSTART:20260907T060000`, no `Z` and no
  `TZID`. 6am stays 6am when you travel, and it avoids embedding a `VTIMEZONE` block,
  which is the usual reason hand-rolled ICS breaks.
- Duration per session type, and conditioning asks `ivPartsLabel(fmt, ivOpts(date,fmt))`
  so the calendar block matches what the session card promises rather than a round hour.
- `VALARM` with `ACTION:DISPLAY` and a relative `TRIGGER`. All-day mode offers only
  −4 h, which is 8pm the night before, since offsets from midnight are meaningless.
- Covered: defaults stay all-day with no alarm, durations, the weekend clock, a late start
  rolling `DTEND` into the next day, every trigger value, and malformed times falling back
  to 06:00 without producing a broken calendar. 91 → 95 tests.

**Calendar feed: Guide section (2026-10-07)**
- Step-by-step for both platforms in the Guide, above the warm-up reference cards. The
  Android path is the one worth having written down: Google Calendar cannot add a
  subscription from the phone app at all, and the new calendar stays invisible on the
  phone until Sync is switched on for it in the app's settings.
- Also fixed: switching the feed on left the body empty for the debounce interval, so
  subscribing straight away hit the same 404 as an unknown token. Enabling now pushes
  with no delay; ordinary plan changes keep the 4 s debounce.

**Calendar feed (2026-10-07)**
- A subscribable `.ics` of the plan: `/cal/<token>.ics`, generated by the app and stored
  verbatim by the Worker (`cal_feeds` in D1, migration `0003`). The schedule lives only in
  `src/app/`, and a second implementation on the server would drift from it, so the client
  that already knows the answer is the one that writes the file.
- Consequence to be honest about: the feed is as fresh as the last time the app was
  opened. For a plan that changes a few times a cycle that is not a real cost.
- `icsFeed()` emits all-day events for the training days in a −2/+18 week window, with
  the lifts, the prescription and the working weight. Stable per-day UIDs so a refresh
  updates rather than duplicates; CRLF and 75-octet folding, both tested.
- Change detection compares with `DTSTAMP` stripped (`icsKey`), or an identical calendar
  would upload on every app open. Normally this uploads once a day, when the window moves.
- **Needs a dashboard step this repo cannot do**: an Access **Bypass** policy on `/cal/*`,
  since a calendar client cannot sign in. Written up in the README. The token is the whole
  authentication for that path, so the feed carries the schedule and nothing else.
- Still untested on the server side, like the rest of `api.js` — the three new endpoints
  and `calendarFeed()` have no coverage. That is the Worker-tests gap, now slightly bigger.

**A schema version on the stored data (2026-10-07)**
- `plan.schema` plus an ordered `MIGRATIONS` list in `01-constants.js`, run by `migrate()`
  in `05-persistence.js` on load and after every sync. Costs one integer comparison when
  there is nothing to do, and writes back only the documents a migration actually changed.
- The half that matters is backwards, not forwards: data stamped **newer** than `SCHEMA`
  sets `schemaAhead`, which makes `readOnly()` true, so an out-of-date copy stops writing
  instead of flattening a shape it cannot read. A banner says so with a Reload button.
  This only protects against clients from 1.34 on; older ones cannot know to check.
- Migration 1 turns numeric-keyed objects back into arrays in logs and archived programs.
  That shape is why `wuList`, `wuListFor` and two `Array.isArray` guards exist. The guards
  stay for now (an old export can be restored at any time) but the stored data is clean.
- Near-miss worth recording: the set range nearly shipped as `{s:[3,10]}`. An old client
  doing `+v.s` on an array gets `NaN` and writes it back over every working weight. Two
  scalars avoided it by luck, not design — this is the machinery that would have caught it.
- 88 tests across `app`, `schedule` and `weights`.

**Change an SE day's exercises on the day (2026-10-07)**
- The cluster is a Setup choice, which is right for a block and wrong for a Tuesday when
  somebody else is on the bar. Every exercise on a strength-endurance day is a button now:
  swap it, remove it or add one, for that day only (`logs[d].se.ex`).
- Stored as the day's whole list rather than a diff, which is what keeps the ticks
  slot-indexed: a swap keeps the circuits already done against that slot, a removal splices
  the row out, and clearing it ("Back to Barbell") falls through to the cluster again.
  `seDayList(date)` is the single read and `seEdited(date)` is what the card's banner reads.
- The picker offers every cluster's movements plus `plan.se.custom`, deduped by name, and
  takes free text, so a tool the app has never heard of needs no code.

**Base Building as an insertable block (2026-10-07)**
- TB2's Block I, offered from the Plan tab's Change menu on any future week: eight weeks of
  endurance and strength endurance, then Operator resumes on the same maxes. `BB_WEEKS` is
  the book's template day for day, and `weeks()` carries `bbLeft`/`bbVer` so the block runs
  to completion and the next cycle week picks up after it.
- SE circuits are a new session type: `SE_CLUSTERS` (the book's bodyweight, barbell,
  kettlebell and dumbbell lists, plus your own), ticks per circuit, and a short rest between
  exercises against two minutes between circuits (`SE_RESTS`, `plan.se.rest`).
- Two things in it are ours, and the Guide says so: weeks 6–8's two strength days run on the
  Operator wave percentages, because the book says to lift again without saying at what, and
  the strength-first variant's late SE weeks ramp 3×30 / 3×40 / 3×50 (`BB_SF_SE`), because
  the book only says to reverse the order and gives no numbers for those weeks.
- Explicitly **not** the Ageless Athlete version of Base Building, by request.

**Elevation as distance, and a word after lifting (2026-10-06)**
- `flatEquiv(x)` turns gain into distance at `plan.elevPer` (1,000 ft, or 190 m, per mile),
  and `hicValue(x)` is what "last" and "best" compare for trail runs, hikes and rucks — so a
  hard climbing day stops reading worse than an easy flat one. The raw numbers stay on screen
  beside the equivalent, and nothing feeds readiness or the deload prompt. Deliberate: a
  comparison is worth having, an extra lever on the programming is not.
- Status gained a climbing total: this week, the last four weeks, and the direction against
  the four before that.
- The post-lift check-in asks two more things: how it moved (`FEELS`) and whether anything
  hurt (`PAINS`, and where, from `PAIN_AT`). A niggle is only ever reported back to you.
  Sharp pain is the one input that outranks every other rule in `recommend()` — once holds
  that lift's max at the end of the cycle, twice brings it down, and the review names the
  joint. It sits above the grinder and RPE branches on purpose: an averaged score can be
  argued with, a joint cannot.

**Trail running, and elevation gain (2026-10-06)**
- Trail run as its own activity rather than a flavour of Run: pace means nothing on uneven
  ground, so the hard efforts go by breathing, and the advice leads on the descents being
  what leaves you sore two days later. Elevation gain on trail runs and hikes, feet for
  pounds and meters for kilos, in History beside the distance and in the sessions CSV.
- Rucking got the same field the same afternoon (1.38), next to the pack weight, which is the
  pairing that says what the session actually was.
- Shipped as data only — nothing in the programming read it yet. Splitting it from 1.39 that
  way was right: the field had real sessions in it before any number was derived from it.

**One wake lock for the whole session (2026-10-06)**
- Two reports, one cause. The rest between working sets often did not beep, and the screen
  went dark mid-session: the lock was owned by the rest timer and released the instant a rest
  hit zero, so the phone slept while you were lifting, and with the screen asleep iOS had
  suspended the `AudioContext`, which is why the next rest was silent.
- `wantScreen()` is the single answer to whether the screen should stay on (session mode, a
  guided block, a live rest, a live interval, an unpaused generic timer) and `syncScreen()`
  is called wherever any of those change. `holdScreen` re-checks `wakeLock.released` first,
  and a `visibilitychange` handler re-takes the lock and resumes audio on return.
- Lesson worth keeping: a released wake lock is indistinguishable from a held one unless you
  read `.released`, so every re-request was being skipped as redundant. Any API the platform
  can revoke under you needs a re-check on the way in, not a flag of your own.
- The warm-up rest was labeled "Ramp rest", which reads like something off a bike test and
  appeared on Operator days too, since every session has a warm-up. It says "Warm-up rest".

**A timer for anything (2026-10-05)**
- `src/app/10b-timer.js`: a countdown or a stopwatch from the ⏱ at the end of the tab row, on
  any tab, with no session started and nothing logged. Presets, typed minutes, ±30s, pause
  and resume.
- Like the other two timers it runs off absolute times (`gt.end`, or `gt.start` plus
  `gt.pausedMs`), so locking the phone or reloading the app does not make it drift, and it
  stacks above the rest bar rather than replacing it, so a rest keeps counting underneath.
  State is in `ob.gt`, and a run left going for more than 12 hours is dropped on load.
- It only touches the push queue when nothing in a session owns it, so a scheduled rest alert
  is never cancelled by a timer started beside it.

**Longer rests between warm-up sets (2026-10-04)**
- Reported as "30 seconds is too short"; it was actually 45, and the correction mattered less
  than the point. `DEF.warmRest` is 90 s, per lift, editable from the warm-up block on the
  lift card (`WARM_RESTS`: 30/45/60/90/120 s). The rest before the first working set is
  unchanged — that is still the lift's own 2–5 min.
- `warmRestSecs(k)` is the only reader, so the lift card, session mode's ramp rests and the
  ±30s buttons mid-rest cannot disagree.

**No-metric formats, properly (2026-10-02)**
- Putting FOBBIT in the format list (right: it runs on any modality) left it offerable as
  a benchmark, where `benchmarkState` filters on a logged result — so a pinned FOBBIT
  benchmark read "never run, due" no matter how many you had done.
- Replaced the `fmt==='fobbit'` special cases with a `noMetric` flag on the format, used
  by `metricFor`, `hicSessions`, the benchmark picker and `benchmark()` (which now drops a
  stale pin). The burst fields key off `noMetric` and the base-first copy off `IV[f].lead`,
  so a second format of either kind needs no new branches.
- A test walks `HIC` and asserts the benchmark picker offers exactly the formats that
  produce a comparable number.

**Release notes rewritten in a plainer voice (2026-10-02)**
- All 34 entries reworded. Em-dashes 52 -> 1 (the one left quotes the interface), contractions
  30 -> 90, and the habit of ending every bullet on a tidy aphorism mostly gone.
- Facts verified unchanged: all 58 numeric tokens across every entry match the previous file
  exactly. Only `FOBBITs cannot be benchmarks` -> `FOBBITs can't be benchmarks` changed in a
  title. No version bump, since nothing was added or removed.
- The file header now says rewording a shipped entry is allowed (the facts are the history,
  not the prose) and what the voice should be, so this does not drift back.

**Add a set on the day, from the lift card (2026-10-02)**
- 1.32 made the ceiling a Setup field, which still meant leaving the session to change it.
  A `+` tile now sits at the end of the sets on every lift card, and `+ One more set` on the
  last working set in the full-screen stepper. It writes `logs[date].lifts[k].extra`, so it
  is a decision about today: the plan is untouched and the next session is back to normal.
- `addSet(k,delta,date)` holds the ceiling (the book's ten, or higher if the wave says so)
  and the guard that stops a ticked set being pulled out from under its own tick. Both
  surfaces call it, and because the stub DOM in the harness dispatches no events, having the
  logic in a named function is the only way any of it is testable — worth remembering for
  the Worker/API gap, which has the same shape.
- `rx()` folds `extra` into `sMax`, so the day summary, session stepper, rest-timer "next up"
  and CSV all picked it up without changes.

**Optional sets on the wave — Operator I/A's volume choice (2026-10-02)**
- A wave entry can carry `sMax`, a ceiling above the prescribed sets. `rx()` now returns `s`
  (required) and `sMax` (ceiling); the lift card renders the surplus as dashed buttons, the
  session-mode stepper marks them `opt` so skipping them is not a gap, and the day summary
  shows `2/3+`.
- This absorbed the deadlift's 1–3 rule, which was duplicated at six call sites
  (day view ×2, session mode ×2, alerts, CSV). Deadlift is now just the first wave entry
  with a range, and `rx()` is the only place that knows.
- Setup's wave table gained an **Up to** column, blank by default. That table had four number
  inputs at a fixed 84px and already scrolled sideways on a phone; `.wavetbl` tightens the
  cells so all four editable columns fit at 390px.
- Deliberately *not* I/A: the 48–72h floating schedule. See AGELESS-AND-MASS.md's addendum
  — I/A indexes by session where this app indexes by date, and the book's own author keeps
  a fixed three-a-week calendar and takes his variability in volume instead.

**All PDFs out of the repo (2026-10-02)**
- The repo is public. `*.pdf` is now absolute: the `!Plyometric_Program_Thursday.pdf`
  exception is gone and that file is untracked (still on disk, still the source for the
  plyo library -- only the source comments in `01-constants.js` point at it now).
- History rewritten and force-pushed: `git filter-branch --index-filter` stripped the two
  commercial books from every commit, so they are gone from `main` entirely rather than
  just untracked. Gitignoring alone would not have done this -- the blobs were public and
  downloadable from the old `92130aa` for a day. Every SHA from that commit forward
  changed (`92130aa` is now `5f48111`); any older clone has the pre-rewrite history.
- Backup kept locally until this is confirmed settled: tag `pre-pdf-purge` and
  `refs/original/refs/heads/main`, both at the old `150a3f5`. Deleting those two refs and
  running `git gc --prune=now` drops the blobs from this machine too.
- Left in history deliberately: `Plyometric_Program_Thursday.pdf`, which is ours.
- GitHub Support still has to purge their cached objects. A force-push leaves the old
  commit reachable by SHA on github.com until their GC runs.

**FOBBITs rebuilt from the book (2026-10-02)**
- Second correction to the same feature. 1.29 fixed the timing but kept a 30–90 second
  burst picker, which the book never prescribes: its bursts are **sets of reps** — 20 KB
  swings, then 10 snatches per arm, alternating — and the base is a pace *just under* a jog.
- Segments gained `hold`. A held segment auto-pauses on entry, shows the rep prescription
  instead of a countdown, and the Pause button becomes Done; finishing resumes and skips to
  the end of the segment, reusing the existing pause/skip machinery rather than rewriting
  `ivPos`. Held time is excluded from `ivParts`, `ivPartsLabel.total`, the card's suggested
  minutes and the timer header, so every number on the card is base-only and they all agree.
- Session length is the thing you pick (15 / 20 / 30 min of base = 7 / 10 / 15 rounds).
  The easy conditioning week takes the book's basic version: 15 minutes *and* halved reps.
- Worth noting for anything built off `AGELESS-AND-MASS.md`: twice now the structure was
  right and the prescription was wrong. The rendered page is the source; a plausible-looking
  parameter is not.

**Default cadence set to the book's (2026-10-02)**
- `DEF.testEvery` 3 → **2** and `DEF.deloadEvery` 2 → **0**. TB1 runs six-week blocks back
  to back and retests after two of them; it has no deload week, and prescribes a full week
  or more off every 3–6 months instead.
- The scheduled deload stays as an option, labeled in Setup and the Guide as our addition
  rather than the book's, because a light week suits running this year-round outside a unit.
- A stored plan beats the defaults in `deepMerge(clone(DEF), saved)`, so existing users keep
  their cadence until they act. Hence the **Match the book** button: it runs through
  `replan()`, so it reports what moved ("retest 11/30 → 12/7") and is undoable. No silent
  rewrite of somebody's training schedule.
- Two older tests leaned on the old defaults rather than setting them; both now pin
  `deloadEvery`/`testEvery` explicitly. Note the interaction that caught one of them: when
  `testEvery` and `deloadEvery` are equal the retest wins every time and no deload ever
  appears.

**Read against the source books (2026-10-02)**
- The user supplied TB1 (3rd ed.) and TB2 directly, which settled the open content
  questions. `plan.wave` is confirmed correct against the Operator table.
- **Implemented TB2's Easy Week Principle**, which we had missed. Every third week the
  conditioning load comes down, and the book says it is designed to coincide with the
  90–95% strength weeks — in a six-week wave, weeks 3 and 6. `easyCondWeek(date)` is
  exactly `tier()==='heavy'` on a cycle week; `ivOpts` then uses the low end of the round
  range and trims LISS from 35 to 25 min. Previously conditioning only eased on a poor
  readiness score, so the hardest lifting weeks carried a full conditioning load.
- **Corrected the FOBBIT prescription shipped in 1.27.** The book's twenty minutes counts
  base time only — the timer stops for the bursts — so a session is 10 × (2 min base +
  burst), about 30 minutes in total, not 20. `IV.fobbit` gained `def:10` and emits
  base-then-burst per round, alternating Burst A / Burst B because the session alternates
  two movements. Also dropped the "over 30 minutes it stops being a HIC" line: that came
  from the forum, and the book's own advanced version runs to 30 minutes.
- Lesson: 1.27 was built from a web search because the book was not to hand. The structure
  was right and the arithmetic was not. Where a number comes from the source, cite it.

**FOBBITs (2026-10-02)**
- A TB II conditioning format, added to `HIC` rather than to `MOD`: it is a session
  structure, not a tool. Checked against tacticalbarbell.com rather than built from
  memory — 2 min easy base, 30–90 s burst of an alternative movement, ~20 min, classed
  as an aerobic-based HIC, and an endurance session rather than a HIC past 30 minutes.
- It inverts the interval model, so `IV.fobbit` carries `lead:true` (a base segment opens
  the session) and `burst:[30,45,60,90]` (per-session, in `hic.iv.burst`). Unlike every
  other format it keeps the easy period after the final round, so six bursts have seven
  bases: 6×60 + 7×120 = exactly the 20 minutes prescribed.
- `ivOpts` defaults `warm` to false when a format has `lead` — the base is the warm-up.
  `ivParts` counts the lead segment as work, not warm-up, and the suggested-length
  sentence has a FOBBIT branch, since "no easy period after the last one" is false here.
- `metricFor` returns null for it and `hicSessions` accepts it on minutes or bursts: the
  work is a movement, so there is no distance or calorie number to compare.

**Full day-view read-through (2026-10-02)**
- Rendered `vToday()` for every day type at phone width — lift, plyo+HIC, HIC, deload,
  both retest days, off, bridge — with a seeded history, after two UI bugs in a row got
  through by checking only the card that changed. Two blemishes, both cosmetic: the
  suggested-minutes explanation began with a dash because the button wrapped above it,
  and the Lift 3 swap said "Today" where the variant swap said "This session".
- Worth keeping as a habit: `scratchpad/days.js` renders a list of dates into side-by-side
  iframes at 390px, which is how both were spotted.

**Banner/button class collision (2026-10-02)**
- Reported with a screenshot: the bridge-week banner rendered as a tiny blue column with
  its text leaking out around the cards. 1.24's movement button was styled `.info`, and
  `.banner.info` is an existing modifier — so the bare rule (22px, round, no wrap) hit
  every info banner in the app. Renamed `.libinfo`.
- A test now fails on a bare rule in `app.css` for any of the modifier names the markup
  composes with (`info`, `warn`, `alert`, `light`, `heavy`, `mid`). Those words are
  adjectives in this codebase, never components.

**The library button, properly (2026-10-02)**
- 1.23 shipped the ℹ as a `::after` on the row's `<label for>` inside a `<summary>`.
  Tapping it ticked the checkbox, which fired `change` → `render()`, which rebuilt the
  row *before* the browser's `toggle` event could reach `openPx` — so the panel opened
  and was immediately thrown away. It looked like a dead control.
- No native disclosure on these rows now. A real `<button data-act="mlib">` flips the key
  in `openPx` and `checkRow` renders the panel from that, so the state cannot race the
  re-render. The capturing click guard that existed only for the old structure is gone.
- Lesson for anything inside a row that re-renders on input: drive disclosure from state,
  not from the DOM element's own open attribute.
- Verified over the DevTools protocol rather than by reading the markup: the button opens
  the panel, does not tick the box, the panel survives ticking a box, and a second click
  closes it.

**Warm-up and mobility library (2026-10-02)**
- `MLIB` in `src/app/01a-movements.js`: 28 entries in the same shape as `PLIB`, covering
  every movement in `WARMUP` and in all five `MOB` blocks. `libBody(e)` is the shared
  renderer both libraries use now.
- Names in those lists are editable text, so entries are matched through `MLIB_ALIAS` on a
  normalised name (`mnorm`). A test asserts every built-in item still resolves, which is
  what catches a reworded item silently losing its entry. A movement the library does not
  know renders as a plain row.
- `checkRow` returns a `<details>` whose `<summary>` is the whole row when there is an
  entry, so the explanation opens full width rather than inside one grid column. A
  capturing click handler stops a checkbox inside a summary from toggling the disclosure
  as well as itself.
- Also in the Guide, grouped by what they are for rather than by which block they appear
  in, since several appear in more than one.

**The 5RM+Spin note counts its own lifts (2026-10-02)**
- Reported from the app: with two Lift 3 variants on, `l3On().slice(1)` leaves the bridge
  Saturday a single lift, but the note was written for the three-variant case and still
  said "test these first — two lifts per day". It is built from `rest.length` now and
  names the lift when there is one. A test asserts the note matches the day's lift count
  for both configurations.

**Pull-up road, benchmarks, variety and plan previews (2026-10-02)**
- `PULLUP` is five rungs with a rep threshold, a prescription and the reason it is the
  thing that moves you up. `pullupState(date)` reads the best `logs[d].pullups` **up to
  that date**, so a past day shows the rung you were on then, and `pullupCard()` goes on
  Status. Wednesday's accessory line prints the rung's own prescription.
- `benchmark()` returns `plan.benchmark` or, until one is pinned in Setup, the hard
  activity/format pairing with the most logged results. `benchmarkState(date)` adds the
  series, the best, days since and whether it is due (`plan.benchEvery`, default 35).
  Charted on Status; the check-in asks for it on a conditioning day when it is due.
- `hicRut(date,6)` flags six hard sessions in a row sharing a format or a tool. LISS is
  excluded — it is meant to be samey.
- `replan(label,fn)` captures `milestones()` either side of a plan change and appends the
  difference to the undo toast: "Deload week added · retest 11/30 → 12/7". Used by the
  deload cadence, the deload prompt, and insert / remove / skip / unskip. A change that
  moves nothing adds nothing.
- Chose "act, then say what moved, with undo" over a preview-then-confirm step: on a phone
  the second tap is the cost, and undo is already there.

**The planned length shows its working (2026-10-01)**
- Asked where 23 minutes came from for 8 × 1:00/1:00, which reads like 16 + warm-up. It
  is right: `ivSegments` omits the easy period after the final round, so the work block is
  `rounds` hard and `rounds - 1` easy = 15 min, and the warm-up is 5:00 plus three pickups
  with their easy periods = 8:15, not the 5:00 its label implied.
- `ivParts(segs)` splits a session into warm-up / work / cool-down and `ivPartsLabel()`
  renders it, so the suggestion explains itself instead of asserting a number. The
  warm-up checkbox now reads "5 min + 3 pickups ≈ 8 min".
- A test pins the arithmetic for every format, so a change to the segment builder that
  quietly alters session length fails rather than drifts.

**Conditioning minutes without the timer (2026-10-01)**
- Reported from use: the interval timer stopped the phone's music, so it went unused and
  no minutes were logged. On iOS, opening an `AudioContext` hands the audio session to the
  page and pauses whatever was playing; `navigator.audioSession.type='transient'` does not
  save you on current Safari. `plan.quietTimer` (Setup → Sound) makes `quiet()` true and
  `unlockAudio`, `beep`, `tone` and `say` all return before touching audio at all — the
  only reliable fix, since the problem is opening the channel, not the volume.
- The minutes field is on every conditioning card now, not just LISS, with a
  `minplan` button offering `ivTotal(ivSegments(...))` for the chosen format and options.
- `ivFinish` writes `ivElapsed()` into `hic.min` for any format when the field is empty,
  so a finished timer logs what it actually ran rather than only LISS's planned length.
- Minutes-per-week shows the current week's total when no completed week exists yet, and
  the "this week is dashed" note no longer appears when no chart was drawn.

**Collapsible weekly check-in (2026-10-01)**
- It became a `<details>` only when the week's measurements were logged on an *earlier*
  day; filling it in today left the form open all day. Now any logged week renders the
  `<details>`, with the inputs still inside so same-day corrections work.
- Open/closed is remembered through `openPx` under `wkmeas`, like every other collapsible
  block. The empty form seeds that key, so completing it does not snap the card shut
  mid-entry; closing it keeps it closed on later days and next week's empty form re-opens
  it.

**Custom lift variants, and no generic back squat (2026-10-01)**
- `back` (r 1) sat alongside `high` (r 1) and `low` (r 1.03), which is a distinction
  without a difference: a back squat is high bar, low bar or a safety squat bar. `high` is
  the reference now and `ssb` (.9) joins the list. A stored `liftVar` of `'back'` falls
  back to the reference, which is the same number it was using.
- `varsOf(k)` merges `plan.customVar[k]` (`{id,name,short,r}`) over the built-in list, and
  every lookup by id goes through it — `liftName`, `varOf`, `blockVar`, `varDefault`,
  `varMax`, the Setup selects, the Today picker. Entries without a name or a positive
  ratio are dropped rather than prescribed.
- Add and remove in Setup; removing one that a cycle or the default points at clears
  those too, with an undo. Validation rejects a blank name, a duplicate name and anything
  outside 25–150%.
- A custom variant needs no other machinery: a name and a share of the reference max is
  all the prescription ever used.

**Variants: block lift vs one-off (2026-10-01)**
- 1.13 had this backwards. It treated `maxes[k]` as the *reference* lift's max always, and
  derived every variant from it by ratio — so choosing trap bar gave you a trap bar
  prescription computed from a conventional number you were never asked for, and the
  bridge week still said "Conventional deadlift". Reported from the app.
- Now: `blockVar(k,date)` is what the cycle runs on (`plan.cycleVar[c][k]`, else
  `plan.liftVar[k]`, else the reference) and **its max is the max you stored, unscaled**.
  `varOf()` returns a per-day swap (`logs[d].var[k]`) over it, and `varMax()` scales only
  that case, by `r(day) / r(block)`. Test and bridge weeks return `blockVar` even against
  an explicit swap.
- Per-cycle rather than per-program because that is the template: cluster lifts are picked
  for a block and kept for the block. Setup has one select for the current cycle and one
  for later cycles, and says that changing mid-cycle is a deviation — the wave builds to
  heavy weeks on a max set for a particular lift.
- `plan.liftMax` (a tested max per variant) is gone: the block lift's max *is* the stored
  max, so there was nothing left for it to hold.
- Also fixed: `liftName(k)` defaults to `sel`, so the day summary printed the *selected*
  day's lift for every other day in the week. Anywhere a date is in scope now passes it.

**Both variant slots are barbell only (2026-10-01)**
- Goblet and double KB front squat out of `VARS.squat`, following the RDL out of
  `VARS.dead`. Same rule, applied consistently: if the limit is what you can hold or
  there is no lockout to test, there is no 1RM and the percentages mean nothing. They
  live in the travel week's squat slot instead.
- `r:null` has no instances left, so the branches that served it are gone: the
  "needs its own max" banner on the lift card, the `— needs its own max` suffix in the
  Setup picker, and a dead `base&&r==null?null:null` in `varMax`. A test asserts every
  variant has `r > 0`, so the dead paths cannot come back without the case coming back.

**RDL out of the deadlift variants (2026-10-01)**
- It shipped in `VARS.dead` with `r:null` an hour earlier. Wrong category: an RDL has no
  lockout and no reset on the floor, so there is no 1RM to hang percentages on at all —
  not merely one that is hard to estimate. It is named in Friday's accessory slot instead.
- Goblet and KB front squat initially stayed in `VARS.squat` by request, then came out
  the same day once the rule was applied consistently (see above).
- A `plan.liftVar.dead` of `'rdl'` left over from 1.13 falls back to the reference,
  because `varDefault()` checks the key still exists.

**Squat and deadlift variants (2026-10-01)**
- `VARS` keyed by lift: nine squats, eight deadlifts. The first entry of each is the
  reference. `varOf(k,date)` resolves a per-day swap (`logs[d].var[k]`) over
  `plan.liftVar[k]`; `varMax(k,c,date)` returns a tested `plan.liftMax[k][v]` if there is
  one, otherwise the reference max × the variant's ratio. `rx()` takes an optional date
  and routes any lift in `VARS` through it.
- `r:null` (goblet, KB front, RDL) means no honest ratio to a barbell max exists — the
  hold or the range caps the lift — so the card refuses to prescribe and asks for a
  tested max instead of inventing one.
- Deliberate boundary: variants change the **working weight only**. `maxFor()` and so the
  PR board, the strength charts, the cycle review and the retest cards all stay on the
  reference lift, and `varOf()` forces the reference on test and bridge weeks even
  against an explicit per-day swap. Otherwise a front-squat single would be written back
  as a back-squat max and silently drop every weight in the next cycle by 15%.
- Two bugs caught by tests while building it: the retest guard first returned
  `varDefault()` (the user's choice) rather than `varRef()`, and the CSV's test rows were
  not given the new variant column, so every field after it shifted left by one.
- Watch for: the generic rewrite of `liftName`/`varOf` replaced a span of `03-utils.js`
  that also held `l3On`, `l3For` and `isBW`. Anchor replacements on both ends.

**Weekly check-in (2026-10-01)**
- `weeklyCard()` on Today: measurements once a week, from Monday until they are logged,
  then a collapsed summary for the rest of the week. Last week's numbers are the input
  placeholders, the body-fat estimate updates as you type, and the change since the
  previous entry is spelled out.
- They were in the daily check-in's Optional group, which asked a weekly question every
  morning and made it both easy to skip and easy to over-log. The week summary card next
  to it is a recap with no inputs, so this is a separate card rather than a section of it.
- Renders only when `sel` is today, because `data-bind` writes to the selected day.
- Shipped under 1.11 by mistake and corrected with 1.12 the same morning: the release
  note is what tells someone the card exists, so it has to go out with it.

**A running burn estimate (2026-10-01)**
- `tdeeOn(date)` is the number the card leads with: the longest window with the data
  (28 → 21 → 14 days), blended with Mifflin-St Jeor by `w = min(1, days logged in the
  last 42 / 42)`. One rule rather than two — an earlier version multiplied a
  window-reliability term by a coverage term and stuck at 73% for anyone who missed one
  day in eight, which permanently kept a formula that was 600 kcal out.
- `tdeeSeries()` charts it weekly, each point from its own 28-day window, so metabolic
  adaptation across a cut is visible. Over 100 kcal of drift gets a line of prose.
- Fallback is explicit in both directions: no data yet → the formula, named as such;
  calories logged and then abandoned → back to the formula rather than a stale number.
- `endAvg()` walks the date range instead of every log, since the chart calls it ~24
  times per render.
- Watch for: the card quotes two burn numbers on purpose — what your own data says, and
  the blended headline — and the deficit sentence must use the measured one, or it
  contradicts the weight trend in the same sentence.

**Calories, TDEE and body fat (2026-10-01)**
- Calories per day in the check-in (`checkin.kcal`), asked the morning after, so
  `kcalOn(d)` reads day d+1's answer: intake belongs to the day it was eaten.
- `tdeeMeasured(date,days)` is energy balance, not a formula: mean intake over the window
  minus the trend-weight change × 3500/lb (7700/kg) over the real gap between the two
  ends. Both ends average their own 7 days, so the window needs no history before it, and
  the divisor is the gap between the two groups' *mean dates* — not the window length,
  which would overstate the burn by a third. Needs calories on 60% of the days and two
  weigh-ins at each end, or it returns null rather than guessing.
- `bmr()`/`tdeePredicted()` are Mifflin-St Jeor × an activity factor, shown until there
  is enough data for the measured number, and alongside it after. New `plan.sex`,
  `plan.height`, `plan.birthYear`, `plan.activity` in Setup → About you.
- `navyBf()` is the US Navy circumference method from `logs[d].meas` (neck, waist, hip),
  collected by the weekly check-in. Men use waist − neck, women add the hips; hips are
  still tracked for men because the trend is worth having. Returns null rather than a
  number when the profile is incomplete or the measurements are impossible.
- Why measured over predicted: Mifflin is a population average and was out by ~300 kcal
  against the test data. The adaptive number is the one the card leads with.

**Bodyweight card (2026-10-01)**
- Its own card on Status, replacing the small chart that lived in Body and recovery:
  every weigh-in as a faint second series behind the 7-day average, a 30 / 90 / all range
  kept per device in `ob.bwRange`, and the current average, range change and weekly rate
  above it. `lineChart` grew an optional `y2` per point for the raw series, and includes
  it in the scale.
- The range change compares the mean of the first `k` weigh-ins with the mean of the last
  `k` (k up to 7), not first reading to last: with the old method a noisy first morning
  made a 90-day cut look larger than the whole program.

**One release per deploy (2026-10-01)**
- Release 1.7 had been treated as a bucket for "recent work": entries kept being appended
  to it across two days and seven deploys, so the What's new page said 1.7 contained
  things that shipped after people had already installed 1.7. A release is now one deploy
  run — shipped entries are history, new work starts a new entry and bumps the minor
  version. Today's Status charts moved out of 1.7 into 1.8, and the rule is in the README
  and at the top of `public/releases.js`.
- A test enforces newest-first order, non-increasing dates, `major.minor` format, no
  reused version, and that every entry has a title and items.

**More Status charts (2026-10-01)**
- **Conditioning minutes per week**, twelve weeks, at the top of the Conditioning card.
  Only LISS asks you for minutes, so `hicMinutes()` uses what you logged and otherwise
  counts the session the interval timer would have run for that format — warm-up,
  rounds, rest and cool-down — and the card says which it did. The current week is drawn
  hollow and left out of the four-week average, since it is still running.
- **Adherence heatmap**: twelve weeks × seven days under the adherence percentages,
  colored by the same `sessState()` the week dots use, with the week label (C2W5, DL,
  RT, Br, Tr) down the side. Weeks before the start are not drawn.
- **Estimated 1RM from logged top sets** was in Ideas, and is a trap in this program:
  the working weight is computed *from* the max, so a set done exactly as prescribed
  implies `pct / PCT5[reps]` × max every time — always below it, and nothing to do with
  how the set felt. Printing it invites the wrong conclusion. What shipped instead, under
  each lift's chart: the heaviest set you actually completed (weight × reps, percentage,
  date), plus a claim about your 1RM **only** when you logged your own weight in session
  mode (`lifts.<k>.used`), and a note when it ground, which is what the cycle review reads.

**First live backup confirmed (2026-10-01)**
- Setup → Back up now wrote `backup:<hash>:2026-09-30-manual` to the KV namespace:
  plan, three logs and the `user`/`backedUpAt` envelope the restore path expects. The
  binding, the write and the metadata all work, so the Sunday 09:00 UTC cron has nothing
  left to prove. Restore from a backup is still untested against real data.

**Account menu in the header (2026-09-30)**
- Signing out was one `small` link inside the About this app card, near the bottom of
  Setup. There is now an avatar button in the header (initials from the Access email)
  opening a menu: signed-in address, sync status in words, Profile and settings, What's
  new, Sign out. Setup opens with an Account card carrying the same, and the About card
  keeps only versions.
- The button doubles as the sync indicator. The brand row cannot hold the wordmark, the
  status text and the avatar at phone widths, so `#status` is hidden below 520px and a
  colored dot on the avatar carries the state, with the words inside the menu. The
  wordmark steps down at 400/360/340px so the button always fits.
- The two menu items shipped dead and were fixed the next morning (2026-10-01).
  Two gotchas behind it. The `data-act` click handler is bound to `#main`, so static markup
  in the header that carries `data-act` looks wired and does nothing — the menu items use
  `data-view` and the shell's own listener instead, and a test now fails on any `data-act`
  inside `<header>`. And those breakpoints have to sit after the base `.brand h1` rule in
  `app.css`: same specificity, so source order decides.

**The plyo phase label (2026-09-30)**
- The day header carried `Plyo: <phase>` on every day of a cycle week. The wave
  prescription belongs there because it applies to three days; the plyo phase applies to
  one, so the other six days showed unexplained jargon with no number on it. It now
  renders only on `plyohic`/`plyobase` days, with the contact target beside it and halved
  when the session is. The Plan tab's week listing keeps it — that view is week-level.
- The Extensive phase description now says what the word means.

**Days say what they contain (2026-09-30)**
- The bridge week's Saturday is labeled `5RM+Spin` when Lift 3 has two movements to
  test, and the note asked for 30–40 min of easy cardio, but the day rendered only the
  lift tests: nowhere to pick an activity, log the minutes or run the timer. The day plan
  now carries `cardio:true, fmt:'liss'` and the test branch renders `hicCard` under the
  lifts, so the ride is logged like any other LISS session (and reaches the CSV, the
  conditioning records and the day summary, which already keyed off `L.hic`).
- The retest week's mobility-only Tuesday was also labeled `Easy`, which reads like a
  conditioning day; it is `Mobility` now. A test walks every scheduled day and fails if
  one whose label mentions conditioning has no card to log it on.

**Jump tests get a warm-up and an entry each (2026-09-30)**
- The bridge week's jump day rendered the three test fields and nothing else: three
  maximal attempts, cold. Both jump-test days (bridge Thursday and every retest week)
  now show the general warm-up and the jump drills above the tests, in that order. The
  drills moved out of `plyoCard` into `plyoWarmBlock` so the two days share one block
  and one set of ticks.
- Library entries for the vertical and the standing triple jump, which the PDF tests but
  never described, with an ⓘ on each field of the jump card and a Jump tests group in
  the Guide's library. Both entries lead on measurement: a vertical is meaningless
  without the same standing reach every time.

**Optional upper-body power (2026-09-30)**
- A block on the Thursday plyo card, off by default (`plan.plyoUpper`). Operator's bench
  is deliberately sub-maximal and the bike does nothing above the waist, so there is a
  genuine gap; it is small, capped at about five minutes, and the first thing the
  pull-back banner tells you to cut.
- Each phase is movement *slots*, not fixed exercises: a total-body throw, a push,
  rotation, a pull. What fills a slot is a per-phase choice stored in `plan.plyoUp`, so
  the same block runs with a med ball, with nothing (plyo push-ups, explosive pull-ups),
  with a barbell (DB snatch, high pull, speed press) or with one band on the road. Reps
  and rest come from the chosen movement, and all twelve have full Guide entries.
- Throws are counted separately from ground contacts, the sets halve with the cut toggle,
  and each tick starts that movement's rest timer.

**Travel week and launch screens (2026-09-30)**
- Travel week: add one from the Plan tab and the cycle pauses for a week of dumbbell and
  bodyweight work (three sessions with rep targets, conditioning and plyos unchanged).
  Nothing touches your maxes, and because it is not a cycle week the end-of-cycle review
  ignores it. Movements are editable in Setup → Travel week.
- Launch screens for ten iPhone sizes instead of a white flash, generated by
  `node tools/splash.js`. They live under `/brand/splash/` so the existing Access bypass
  serves them before sign-in — iOS fetches them without a session.

**Source split into files (2026-09-30)**
- `src/app/*.js` (22 ordered sections) joined by `build.js` into `public/app.js`;
  `index.html` is down to 74 lines. Deliberately concatenation rather than ES modules:
  251 functions share mutable state, so real modules would mean either a large state
  refactor or hand-maintained import lists for every symbol. The bundle is byte-identical
  to the script it replaced. The build stamps a content hash on the asset tags so the
  update banner still fires, `npm test`/`npm run deploy` build first, and CI fails if the
  committed bundle has drifted from its sources.

**Smaller index.html (2026-09-30)**
- Styles moved to `public/app.css` and the release notes to `public/releases.js`,
  taking `index.html` from 3,148 to 2,728 lines with no build step and no behavior
  change. The service worker caches both and refreshes them in the background, so a
  style or notes change lands on the next load without bumping its VERSION.

**Release notes and a fix (2026-09-30)**
- **What's new** page listing every release and what it added, reached from Setup →
  About this app and from the update banner. When something user-facing ships, add a
  `RELEASES` entry and bump `package.json`'s version to match — a test enforces it, and
  the deploy tag (`v<version>-<commit>`) carries it so About this app can name both the
  running and the deployed release.
- About this app leads with the release version ("1.6 · Records, coaching and polish")
  instead of the asset fingerprint, which is now fine print. `APP_VERSION` comes from
  `RELEASES[0].v`; `tagVersion()` parses the deployed tag for the Latest row.
- Restored the **About this app** card, which a bad edit removed alongside the audio-cue
  card in `eed4fc2` (signed-in address, versions, update check). A test now asserts every
  Setup card is present so that cannot happen quietly again.

**Tests and undo (2026-09-30)**
- 31 tests over the calculations, run by `npm test`, before every deploy, and on every
  push via GitHub Actions. `test/harness.js` loads the app's script into Node against a
  stub DOM, so no browser is needed. Two of them guard the app's shape rather than its
  maths: every Setup card is present, and the version numbers agree.
- Undo for the taps that are easy to get wrong: set ticks, marking a session done,
  lowering a max, adding/skipping/removing a week, moving days, resetting a week's
  order, clearing the warm-up or mobility, and applying a review or test results.

**Data safety**
- Past weeks and finished cycles' maxes locked against settings changes.
- End-of-cycle review with suggested max changes, applied on approval.
- Weekly backups to Workers KV (26 kept), listed in Setup with Back up now.

**Averages, appearance, polish (2026-09-30)**
- Bodyweight runs off a 7-day rolling average (`bwAvg`/`bwFor`/`bwRate`): the Status
  chart plots the average with the weekly rate, the protein target and weighted pull-up
  loads use it, and the trend advice compares averages 14 days apart instead of two raw
  weigh-ins. Falls back to the latest single reading until the window has two.
- Appearance in Setup, per device: Match device / Light / Dark, plus gym mode (bigger
  buttons and inputs, firmer borders). An explicit theme also moves the phone's status
  bar color.
- Session complete card on a finished day listing what was logged and what's still open;
  a tick animation on the set you just pressed; clearer empty states.

**Records, week summary, guided blocks (2026-09-30)**
- Personal records across every program (tested 1RMs, pull-ups, all three jumps, best
  result per conditioning activity and format), on Status with the date and the gain.
  A day that sets one shows a "New personal best" card on Today with the value it beat.
- Week summary on Today at the start of each week: last week's sessions, readiness and
  bests, then what this week holds and when the next deload and retest fall. Dismissable.
- Guided run through the warm-up and mobility blocks: full screen, one movement at a
  time, timed items count down (both sides where the dose says per side), rep items wait
  for a tap, each one ticked off as it completes. **Auto-advance** is a toggle in the
  runner (`plan.guideAuto`): on, it flows straight into the next side and movement; off,
  it holds at 0:00 with a Start side 2 / Next button so you set up in your own time.

**Rearranging, calendar, timers (2026-09-29)**
- Move a session: pick what you'll actually do today and the app finds the week order
  that moves the fewest days, never putting two strength days or two hard conditioning
  days back to back (including across week boundaries). Days already done stay put.
  Stored per week in `plan.order[monday]`; reset to standard from the same panel.
- Calendar view in Plan: month grid with week bands, session labels and done/missed dots,
  and a Rearrange mode — tap a session, tap the day to move it to, see the whole week
  previewed with the shifted days outlined, then Apply.
- Hold timers (⏱) on warm-up and mobility items with a real duration, running each side
  in turn; the last ramp set now gets the lift's full rest before the first working set.

**Warm-up and mobility (2026-09-29)**
- Warm-up checklist on every lifting and test day (full 12–15 min or the 7-min short
  version), with progress in the summary; plyo warm-up drills get check-offs too.
- Mobility block at the end of every session, matched to what the day loaded (hips /
  posterior chain / hip flexors + calves / ankles / full on rest days), editable in
  Setup, with check-offs.
- Both appear as steps in session mode (warm-up first, mobility last) and as counts in
  the sessions CSV.

**Gym flow, onboarding, restore (2026-09-29)**
- Welcome setup for new people (units, bodyweight, Lift 3, start week, bridge week or
  known 1RM/5RM maxes, conditioning tool, then deloads and retests on their own step);
  re-run from Setup.
- Lifting session mode: full-screen, one set at a time with drawn plates, ramp and
  working rests on the same screen, ±weight, grinder, accessories, summary + RPE.
- Session mode on test days (bridge 5RMs, retest singles): ramp to the target (or a
  typed target when there's no max yet), log weight × reps with a live est. 1RM,
  3+ min rest between lifts, max pull-ups, results summary.
- Visual plate loader in bumper colors and a plate inventory; unloadable targets flagged
  with the nearest load.
- Restore any backup or a downloaded file, with a time-stamped safety backup first.
- Spoken cues for interval changes and rest ends (toggle).

**Core (2026-09-29)**
- Operator + Black schedule with endless 6-week cycles, bridge week, automatic deload
  and retest weeks, and inserting or skipping deload/retest/off weeks from the Plan tab.
- Working weights, rounding, plate math, ramp-up sets, set tracking, grinder flag with
  "lower max 5%", and a deload prompt after repeated hard sessions.
- Bike/conditioning logging, plyo phases with the 5% broad-jump stop rule,
  accessories that skip on heavy weeks, holiday flags.
- Bridge-week 5RM → 1RM conversion; retest results carried into the next cycle.

**Hosting**
- Cloudflare Worker + static assets at operatorblack.com (www redirects), D1 storage,
  Cloudflare Access login verified on every API call.

**Logging and coaching**
- Warm-up sets calculated from the working weight, with plates per side, loggable.
- Daily check-in (sleep, energy, soreness, stress, yesterday's eating, bodyweight) with
  a readiness score and session, recovery and nutrition suggestions.
- Status tab: position in cycle, milestones, adherence, strength/conditioning/body
  trend charts.

**Phone**
- Installable home-screen app, offline cache, local copy of data and an unsent-changes
  queue.
- Rest timer, 2–5 min per lift, with ±30s, beep, screen wake, and "next set" label.

**Flexibility**
- Lift 3 variants (lat pulldown, OHP, weighted pull-up) with rotation modes and
  per-day swap; weighted pull-up math on bodyweight + added weight.
- Editable accessory lists (arms on Monday).
- Conditioning activities beyond the Echo bike, each with its own measure;
  like-for-like progress only.

**Plyos and alerts**
- Plyo program and exercise library from Plyometric_Program_Thursday.pdf: per-phase
  sessions with set ticks and program rest times, inline library entries, pull-back
  check, full library in the Guide.
- Background rest alerts via Web Push: Durable Object alarm at the rest's end time,
  rescheduled on ±30s/skip/new set, test button in Setup.

**Updates**
- Update-available banner on the home-screen app (page fingerprint vs deployed),
  plus About this app in Setup with a manual check.

**Interval timer**
- Guided HIC/LISS timer from the Black formats with round picker, optional warm-up
  pickups and cool-down, full-screen or minimized display, 3-2-1 beeps, screen wake,
  lock-screen alerts for every interval change, and result logging at the end.

**People and programs**
- Per-user data: every document, backup and alert store is scoped to the signed-in
  Access email; legacy data claimed by the owner; phone cache reset on user switch.
- Programs: archive the current program and start over (carry maxes or bridge week),
  with read-only archived programs viewable from History, Status and Plan.

**Login page**
- Branded Access login page: public `/brand/logo.png` via a Bypass → Everyone
  Access application for `operatorblack.com/brand/*`; everything else stays locked.

**Export**
- CSV export (Setup): sessions (one row per day) and lifts (one row per lift per
  session, prescribed vs working, warm-ups, tests with est. 1RM), across every
  program, via the share sheet on iPhone.

**Deload choice**
- Setup: scheduled deload as a clear choice (As needed · After every cycle · After
  every 2 cycles) with a preview of the next deload and retest dates. "As needed" plus
  retest every 3 cycles matches the 18-week program summary (retest week of 2/8/2027).
- Deload check-in on Today in weeks 5–6 of every second cycle (first: 12/14–12/25/2026):
  current setting, next deload date, a two-cycle recap, Keep or change. Can be turned
  off in Setup.
