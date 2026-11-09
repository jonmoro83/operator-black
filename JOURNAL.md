# Journal

The investigation record: what was tried, what the device said, what turned out to be
wrong and why. Moved here from ROADMAP.md on 2026-11-08 so the roadmap can stay a list.
Newest findings at the top of each entry, as they were written. ROADMAP.md's Open issues
names each still-open thread in one line and points here.

## Open investigations

As they stood on 2026-11-08. The one-line status of each is in ROADMAP.md.

- **Rest beeps: the real-session failure, reframed 2026-11-01, fix in 3.61, awaiting a
  session log.** The user's report that settled it: *the tests always work; it fails in
  real sessions, especially after going to another app and coming back.* A test plays
  from the tap that asked for it; a rest plays from a timer minutes after the last tap.
  Two mechanisms fit, both invisible to the old log:
  1. **A dead channel that reads `running`.** Another app takes the speaker and WebKit
     hands the context back reporting `running` with no output. Five guards trusted
     `state==='running'` -- `gestureWake` returned early on it -- so it was never
     repaired and every silent beep logged `played`. That is why the logs looked
     healthy for weeks.
  2. **iOS evicting the PWA in the background.** It reloads on return, looks the same
     (state is in localStorage), and has no audio until a tap.
  3.61: returning from another app marks the channel stale; the next tap closes it and
  makes a fresh `AudioContext` inside the gesture (never within 1.5 s of opening one, or
  the same tap's touchend undoes its pointerdown); `audioClockSample` checks
  `currentTime` actually advances, from the rest and interval ticks; a **"Sound needs
  a tap"** prompt on the rest bar, interval bar and session-mode rest box; and the log
  gains `app · started` (with what was running), `rebuilt by a tap`, `clock stopped`,
  and a heard/not-heard note beside each `played`. **Next:** a real session on 3.61
  with an app switch in it, then the log -- it now says which of the two it was.
  **3.62 rewrote the alert layer** (the locked-phone half): the DO keeps one slot per
  timer per device (`kind|endpoint`), each write replacing that slot's list and carrying
  a client revision -- an older revision is ignored, and an emptied slot is kept as a
  tombstone so a late schedule cannot resurrect a cancel. That closes the Plyo -> HIC
  race (stopRest's cancel and ivStart's schedule used to hit one replace-on-write queue
  as two concurrent requests) and the generic timer losing its alert to any rest. Alerts
  target the setting device (falling back to all if it is not registered, so nothing is
  lost to bookkeeping); the push `Topic` is the timer kind. Client side, `syncPush`,
  `ivPush` and `gtPush` are gone: one `alarmSync()` diffs wanted against confirmed,
  sends with `keepalive`, times out at 10 s, retries 2/5/15/30 s and on `online` and
  visible, ignores answers to superseded writes, and persists confirmed slots so a
  restarted page can still cancel. The DO logs every send with lateness against the
  alert's own time; the report prints it. Old clients' `/push/schedule` and `cancel`
  map to a `legacy|*` slot through the switchover. **Still to check on the phone:**
  Settings -> Notifications -> Operator -> Sounds, since 3.56's ring-switch theory rested
  on logs contaminated by the 3.53 speech bug, and the user hears in-app beeps in duck
  mode, so the switch is on.
  **First real result (2026-11-01, on 3.63):** the user ran a HIC session and the timer
  "worked exactly as expected", which they called a big improvement. No report was sent,
  so it is not known whether that session included a trip to another app. Still open:
  a lifting session with rests and app switches, which is where the failure was worst.
  **3.69 (2026-11-03): check before asking.** Asked whether the re-arm tap could go.
  It cannot go entirely (iOS starts web audio only from a gesture; a native wrapper is
  the only full fix), but 3.61 asked after *every* return. Now `probeAudio` runs on
  return and on a start mid-timer: resume the existing context and watch `currentTime`
  for `PROBE_MS`; if it doesn't move, rebuild without a gesture and watch again; only
  then show the prompt (held back while probing). Log lines: `still working after
  coming back`, `reopened without a tap`, `needs a tap (...)`, `check abandoned`.
  **Next session's log answers** whether step 2 ever succeeds on iOS; if it never does,
  it can go and the eviction case simply asks.
- **Rest alerts: cause found 2026-10-24, fixed in 3.55, not yet confirmed on the
  phone.** The device report settled the half I had wrong: Apple accepted the test
  push on all three registered devices (201 each) and the notification appeared, so
  the subscription, the Durable Object, the VAPID signing and iOS display all work.
  The difference between the test, which always worked, and a rest alert, which never
  did, was **when the request is made**. `syncPush` waited 300 ms before posting the
  schedule. The test is tapped while you watch the screen; a rest is started by
  ticking the last set and pocketing the phone, and iOS freezes a hidden page well
  inside 300 ms, so the timer never ran and no request was ever made. Nothing recorded
  a failure because nothing was attempted. Now sent synchronously; the DO replaces its
  queue on every schedule, so frequency is harmless, and an identical repeat is
  skipped by a key. `gtPush` had the same debounce and the same fix.
- **Superseded: the earlier "rest alerts reported dead, cause not found" entry.** Attributed to the
  3.37-3.48 run of changes, and I could not find anything in them that would do it:
  - `src/alerts.js` (the Durable Object), `src/api.js`, `src/webpush.js` and
    `wrangler.toml` are untouched by every commit in that run. `public/sw.js` changed
    only in its build-stamped `VERSION`, which moves on every deploy and always has.
  - The live Worker has the `ALERTS` Durable Object bound (`wrangler deploy --dry-run`).
  - Driven in the harness with alerts on, `startRest` still POSTs `/api/push/schedule`.
  - So: client schedules, server is unchanged and bound, service worker is unchanged.
    Either it is something the device is doing, or it predates this run and was noticed
    now. Saying "I broke it" without finding it would be a guess either way.
- **What 3.49 added instead of a fix**, because there were no tests on this path at all
  (the long-standing "no tests for the Worker" gap, and this is what it costs): every
  push call recorded its outcome rather than ending in `.catch(()=>{})`, and Setup
  shows it against `/push/status` — devices registered, alerts queued, next alarm.
  **Next report should come with that card copied.** First attempt produced nothing,
  because all five copy buttons in the app shared one shape —
  `if(navigator.clipboard) ...writeText(t).then(done,()=>{})` — which does nothing at
  all, silently, when the clipboard is missing or refuses. 3.50 gives them execCommand
  as a second try and an on-screen selectable box as a third, and puts the alert
  failure on the card itself rather than inside a closed disclosure.
- **The likeliest silent cause, named but unconfirmed:** the DO refuses any alert
  outside `now - 5s .. now + 2h` with a 400, and the rejection was swallowed. A phone
  clock a few minutes slow fails every rest it ever schedules, silently and forever.
- **A second, better candidate found 2026-10-24, and fixed in 3.51.** `sendAll`
  collects the push service's HTTP status per device and `alarm()` — the path every
  real alert takes — discarded it. A 404 or 410 deletes the subscription server-side
  while the phone keeps its endpoint in localStorage and the card keeps saying On:
  alerts stop dead with no error on either side. And `healAlerts` re-registered the
  *same* endpoint whenever `devices` hit 0, so a rejected subscription was handed back
  to be rejected again, forever. The DO now keeps `lastSend` and a `dead` list,
  `/push/status` returns both, and the client unsubscribes and makes a fresh
  subscription when its own endpoint is on that list.
  - Unprovable after the fact, because nothing recorded it. It is the only failure in
    the chain that produces exactly the reported symptom.
- **The harness never exposed `async function`**, so `enableAlerts`, `healAlerts`,
  `testAlert`, `holdScreen` and every other async top-level function had no tests and
  could not have had any. That is most of the alert path. Fixed; worth checking what
  else this uncovers.

- **iPhone testing, still to confirm at the gym:** offline launch, whether the screen
  stays awake for a whole session, and the interval timer on the bike. Confirmed:
  home-screen install, Access login in the installed app, the update banner, rest
  alerts on the lock screen, spoken cues through AirPods with the app open, and the
  rest beep in a real session — **with the ring switch off as well as on**
  (2026-10-16), which the research said was impossible.
- **HIC beeps stop partway through a session. Reported 2026-10-21; cause found, fix
  shipped in 3.38, not yet confirmed on the phone.** It was never an audio bug. The
  clue that cracked it was the second half of the report: *"if I lock and then unlock
  the timer will beep even if it's in the middle of a rest period or interval."*
  - **What was happening.** A sleeping screen freezes the page, so no beep due while it
    slept ever fires, and the one you hear on unlocking is `ivRender` catching up on a
    segment change it slept through. The screen was sleeping because the wake lock was
    taken once at `ivStart` and never again: the `release` handler wrote the state down
    and stopped there, and the only other caller was `visibilitychange` — which cannot
    run until you have already picked the phone up. One release from iOS and the screen
    slept for the rest of the session. "First couple of rounds beep and then it stops"
    is that, from the other end.
  - **Fixed:** the lock is re-requested the moment it is released while something still
    wants it and the page is visible, and both timers call `syncScreen()` as they tick,
    which is free while the lock is held. `SCREEN_RETRY` (4 s) stops a refusal turning a
    5 Hz tick into five requests a second.
  - **Also fixed:** a change cue more than `IV_CUE_LATE` (1.5 s) into its segment is
    dropped and logged instead of sounded. At a 200 ms tick a real change is caught
    within 200 ms, so anything later means the page was not running, and a cue for a
    round that started a minute ago is worse than none.
  - **Also fixed:** a refused lock (Low Power Mode) warns on the interval panel, not
    only the rest bar, which is not the screen you are looking at on a bike.
  - **To confirm:** one HIC session with the phone left alone. The beeps should run the
    whole way. If they still stop, the log holds a whole session now (3.37) — look for
    `screen · released` without a `taking it back` after it, `screen · refused`, and
    `page hidden`.
  - **Not pursued, and still possible as a second cause:** with alerts on, `ivPush`
    queues a lock-screen notification for every segment change and they keep arriving
    while the app is in the foreground, where each one can take the audio session. If
    3.38 does not settle it, that is next. The fix would be to cancel the queue while
    the page is visible and re-arm it when it hides, which is a real behaviour change
    (lock the phone mid-session and there is a race), so it waits on evidence.
- **The timer, on the phone (3.25).** The two-paths bug is certain and fixed; the rest
  is research plus a model, not a device. Still to check: that the rest beep comes on
  time and is clearly louder.
- **Does the coach give good advice?** The agreed gate for letting it apply changes
  rather than only suggest them. **2026-10-20: "OK so far, still evaluating."** It
  needs a few more weeks of reading what it said against what happened.
- **The first weekly debrief lands Monday 2026-10-26** (the week of 10-19). Worth reading
  against the week as you remember it: does it notice what mattered, and is it short
  enough to read on a Monday? The prompt is `DEBRIEF_ASK` in `src/api.js`.
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


- **The rest alert chain, end to end, 2026-10-24.** Six reports off the device settled
  what six rounds of reasoning from a laptop had not. In order of discovery:
  1. `gestureWake` primed `speechSynthesis` on the capture phase of every pointerdown,
     parking the AudioContext the instant it opened (3.53).
  2. `syncPush` debounced the schedule by 300 ms, and iOS freezes a hidden page well
     inside that — so pocketing the phone meant the request was never made (3.55).
     This was the reported "notifications do not work at all".
  3. The channel is taken away the moment it opens on a ducking session, which is what
     the ring switch looks like from inside a page. Named as a suspicion (3.56).
  4. The beep then ran ~1 s late because every sound had to `resume()` first. Woken
     three seconds ahead now (3.57).
  - **The method, which is the part worth keeping:** nothing moved until the app could
    send a diagnostic to the server by itself. Two copy buttons produced nothing the
    user could send, and the clipboard is a bad channel on a phone. `/api/report` plus
    one visible button is what turned this from guessing into reading.

- **Two functions named `hhmm`, 2026-10-24.** Mine in `16-alerts.js` formats a
  timestamp; `21a-calendar.js` already had one that *parses* `"09:30"` and returns
  `null` for anything else. The build joins every file into one scope in filename
  order, so the calendar's declaration won and every time in the alerts diagnostic
  printed as `null` — including on the report the user sent, which is how it was
  found. A test now walks `src/app/*.js` and fails on any top-level function name
  declared in two files. With 251 functions sharing one scope this was overdue.

- **The app was interrupting its own audio channel, every page load. Found from a
  device log 2026-10-24, fixed in 3.53.** Six rounds of work on "the beep does not
  sound" had all been reasoning from a laptop; the first real log off the phone showed
  it in four lines:

      audio · channel opened    [audio suspended]
      audio · woken by a tap    [audio suspended]
      audio · interrupted       [audio interrupted]
      audio · woken by a tap x5 [audio interrupted]

  `gestureWake` is bound to pointerdown on the capture phase, so it runs before any
  button's own handler. It called `unlockAudio()`, which primes `speechSynthesis` with
  a silent utterance — and on iOS speaking takes the audio session. So the app opened
  its channel and parked it in the same gesture, every time, and every sound after
  that had to win a `resume()` race first. 3.52's `{voice:false}` on the beep test was
  useless: the priming had already happened on the way in.
  - The rule, now stated in the code: **waking the audio must never make a sound.**
  - Worth remembering about capture-phase global handlers: they are invisible when you
    read the button's own code, which is where I kept looking.
- **Asking for the screen lock on a hidden page** earns `NotAllowedError`, which
  `holdScreen` recorded as `wakeState='refused'` — the same state Low Power Mode
  produces. So putting the phone in a pocket made the timer warn that the screen might
  sleep. 3.38 made it worse by calling `syncScreen()` on every tick. It only asks while
  the page is visible now; `visibilitychange` already handles the way back.

Closed. Here because the reasoning is worth keeping, not because anything is pending.

- **"Can the timer run in the background, unaffected by locks or app switching?"
  Asked 2026-10-21. Half of it already does; the other half is not available to a web
  app at all.**
  - **The count is already lock-proof** and always has been. Every timer is an absolute
    end time in localStorage, not a tick count, so locking the phone, switching apps or
    reloading cannot make it drift. It is right whenever you next look at it.
  - **The sound cannot be.** iOS freezes a web page when the screen locks or the app
    goes to the background: no script, no `setInterval`, no Web Audio. There is no API
    that changes this. A service worker cannot run on a schedule (Periodic Background
    Sync is Chrome-only and absent on iOS), and a Web Worker is frozen with its page.
  - **The one thing that does make a noise is the server.** Web Push: the Durable Object
    holds an alarm per rest and per interval change, queued in advance at `ivStart`, so
    a lock cannot disturb it. That *is* the background timer, and it is already built.
    What was missing was any sign of it from the timer itself, so 3.39 puts the state on
    both bars.
  - **The two ways to get real audio while locked, both already weighed:** a
    pre-rendered audio track for the session, built and tested in `a983b65` and removed
    at the user's request because it pauses music; and a native wrapper, whose single
    real win is `AVAudioSession` `.playback` + `.mixWithOthers` — see the tabled
    TestFlight analysis below. Nothing has changed to reopen either.

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
