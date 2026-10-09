/* ---------------- what matters today ----------------
Pick up to three things to pay attention to before a session, and get an honest account
of them afterwards. Not a restatement of the prescription — the numbers are already on
the cards. This is about how you mean to train, which is the part that drifts.

Some aims the app can check from what you logged. Some only you can judge, so those ask
you once at the end rather than being guessed at. The difference is visible on screen:
a scored line says what it counted, a self-rated line asks.

And the note you write afterwards is shown before the next comparable session, which is
the whole reason to write one. `logs[d].notes` already existed and went straight into a
table nobody reads. */

const AIM_MAX = 3;

// check(date) -> {ok, detail} for an aim the app can score, or null for one only you can.
const AIMS_LIFT = [
  { id: 'sets', label: 'Complete every set as programmed', check(d) {
      const dp = dayPlan(d), wk = weekOf(d);
      if (!wk || !(dp.lifts || []).length) return null;
      let want = 0, got = 0;
      for (const k of dp.lifts) {
        const r = rx(wk, k, d), done = ((lg(d).lifts || {})[k] || {}).sets || [];
        want += r.s; got += Math.min(r.s, done.filter(Boolean).length);
      }
      return { ok: got >= want, detail: `${got} of ${want}.` };
    } },
  { id: 'warmup', label: 'Do the full warm-up, not the short one', check(d) {
      const L = lg(d), flags = Array.isArray(L.warmup) ? L.warmup : [];
      const idx = WARMUP.map((x, i) => i).filter(i => !L.warmShort || WARMUP[i].s);
      const got = idx.filter(i => flags[i]).length;
      if (L.warmShort) return { ok: false, detail: `The short version, ${got} of ${idx.length}.` };
      return { ok: got >= idx.length, detail: `${got} of ${idx.length}.` };
    } },
  { id: 'technique', label: 'Keep technique tight — no ugly reps' },
  { id: 'rest', label: 'Take the full rest between sets' },
  { id: 'short', label: 'Stop short of failure', check(d) {
      const lifts = Object.entries((lg(d).lifts) || {}).filter(([, v]) => v && v.grinder);
      if (!lifts.length) return { ok: true, detail: 'Nothing logged as a grinder.' };
      return { ok: false, detail: lifts.map(([k]) => liftName(k, d)).join(', ') + ' ground.' };
    } },
  { id: 'acc', label: 'Get the accessories done, not skipped', check(d) {
      const dp = dayPlan(d); if (!dp.acc) return null;
      const slots = accSlots(dp.acc), got = accDoneCount(d, dp.acc);
      return { ok: got >= slots.length, detail: `${got} of ${slots.length}.` };
    } },
  { id: 'mob', label: 'Finish with the mobility block', check(d) {
      const items = mobList(mobKind(dayPlan(d))), flags = lg(d).mobility || [];
      const got = items.filter((_, i) => flags[i]).length;
      return { ok: got >= items.length, detail: `${got} of ${items.length}.` };
    } },
  { id: 'unhurried', label: 'Keep it unhurried' },
];

// Conditioning asks different questions. The lifting ones are about execution; these
// are about where the effort went, which is the thing that actually goes wrong on a
// bike. `when` keeps a question off a day it cannot mean anything on -- there are no
// rounds, and no easy periods, in a steady session.
const AIMS_COND = [
  { id: 'crounds', label: 'Hit every round as prescribed',
    when: d => ivRounds(d) > 0,
    check(d) {
      const want = ivRounds(d), got = +((lg(d).hic || {}).rounds);
      if (!want) return null;
      if (!isFinite(got) || !got) return { ok: false, detail: 'No rounds logged.' };
      return { ok: got >= want, detail: `${got} of ${want}.` };
    } },
  { id: 'cwarm', label: 'Warm up properly before the hard efforts',
    when: d => effFmt(d) !== 'liss',
    check(d) {
      const on = (((lg(d).hic || {}).iv) || {}).warm;
      return { ok: !!on, detail: on ? 'Logged.' : 'Not logged \u2014 the session started cold, or it went unticked.' };
    } },
  { id: 'cpace', label: 'Hold the pace \u2014 no fading on the last rounds', when: d => ivRounds(d) > 0 },
  { id: 'ceasy', label: 'Keep the easy periods genuinely easy', when: d => ivRounds(d) > 0 },
  { id: 'cspare', label: 'Finish able to do one more, not emptied' },
  { id: 'ccool', label: 'Cool down instead of stopping dead', check(d) {
      const on = (((lg(d).hic || {}).iv) || {}).cool;
      return { ok: !!on, detail: on ? 'Logged.' : 'Not logged.' };
    } },
  { id: 'clog', label: 'Log the number so it can be compared', check(d) {
      const H = lg(d).hic || {}, met = metricFor(modOf(d), effFmt(d));
      if (met) { const v = H[met[0]]; return { ok: v != null && v !== '', detail: v != null && v !== '' ? `${n(v)} ${met[1]}.` : 'Nothing logged to compare against.' } }
      const m = H.min; return { ok: m != null && m !== '', detail: m ? `${n(m)} min.` : 'No minutes logged.' };
    } },
];
// How many hard rounds the day's format asks for, or 0 for a steady session.
function ivRounds(d) {
  try { const f = effFmt(d); if (!f || f === 'liss') return 0; return +(ivOpts(d, f) || {}).rounds || 0 } catch (e) { return 0 }
}

// Which set of questions a day gets, already filtered to the ones that can apply.
function aimSet(date) {
  const t = (dayPlan(date) || {}).t;
  const base = t === 'lift' ? AIMS_LIFT : t === 'hic' ? AIMS_COND : [];
  return base.filter(a => !a.when || a.when(date));
}
function aimById(date, id) { return aimSet(date).find(a => a.id === id) || null }
function aimsOn(date) { const a = lg(date).aims; return Array.isArray(a) ? a.filter(id => aimById(date, id)) : [] }
function aimRating(date, id) { return ((lg(date).aimsRated) || {})[id] || null }
const RATE = { yes: 'Held up', part: 'Slipped late on', no: 'No' };

// Toggling an aim, with the cap enforced here rather than only in the markup: the click
// handler cannot be reached from a test, so the rule has to live somewhere that can.
function pickAim(date, id) {
  if (!aimById(date, id)) return false;
  const cur = aimsOn(date);
  if (cur.includes(id)) { setLog(date, 'aims', cur.filter(x => x !== id)); return true }
  if (cur.length >= AIM_MAX) return false;
  setLog(date, 'aims', [...cur, id]);
  return true;
}
function rateAim(date, id, v) {
  if (!aimById(date, id) || !RATE[v]) return;
  setLog(date, 'aimsRated.' + id, aimRating(date, id) === v ? null : v);
}

// A day you can set an aim on: one that asks something of you.
// Any day that asks something of you. The note you leave is worth reading back whatever
// the session was, so it is gated on this rather than on the aims.
function trainingDay(date) { const t = (dayPlan(date) || {}).t; return !['off', 'pre', 'convert'].includes(t) }
// Lifting days get the lifting questions, conditioning days the conditioning ones, and
// anything else — a test day, a Base Building circuit — gets none. A test day is not
// the place to be setting intentions about technique.
function aimsDay(date) { return aimSet(date).length > 0 }

/* ---------------- the note you left last time ---------------- */

// The most recent note from a comparable session, falling back to the most recent of
// any kind. Comparable means the same sort of day: your last squat note is the one
// worth reading before squatting, not Tuesday's bike session.
function lastNote(date) {
  const kind = d => { const t = (dayPlan(d) || {}).t; return t === 'lift' || t === 'rm5' || t === 'test' ? 'lift' : t };
  const want = kind(date);
  const days = Object.keys(logs).filter(d => d < date && (logs[d].notes || '').trim()).sort().reverse();
  const same = days.find(d => kind(d) === want);
  const d = same || days[0];
  if (!d) return null;
  return { date: d, text: String(logs[d].notes).trim(), short: (dayPlan(d) || {}).short || '', same: !!same };
}
function noteCard(date) {
  if (viewing || !trainingDay(date) || lg(date).noteSeen || lg(date).done) return '';
  const n = lastNote(date); if (!n) return '';
  return `<div class="card"><div class="lift-h"><h3>From your last ${esc(n.same && n.short ? n.short : 'session')}</h3><span class="small muted">${esc(fmtD(n.date, true))}</span></div>
  <p style="margin:0;white-space:pre-wrap">${esc(n.text)}</p>
  <div class="row"><button class="btn sm ghost" data-act="noteseen">Got it</button></div></div>`;
}

/* ---------------- before ---------------- */

function aimsCard(date) {
  if (viewing || !aimsDay(date)) return '';
  if (lg(date).done) return aimsReport(date);
  const picked = aimsOn(date);
  return `<div class="card"><div class="lift-h"><h3>What matters today</h3><span class="small muted">${picked.length ? picked.length + ' of ' + AIM_MAX : 'pick up to ' + AIM_MAX}</span></div>
  <p class="small muted" style="margin:0">Not the numbers — those are on the cards below. This is how you mean to train today, and you get an honest account of it afterwards.</p>
  <div class="stack" style="gap:4px">${aimSet(date).map(a => {
    const on = picked.includes(a.id), full = picked.length >= AIM_MAX && !on;
    return `<button class="aim${on ? ' on' : ''}" data-act="aim" data-id="${a.id}"${full ? ' disabled' : ''} aria-pressed="${on}">${on ? '✓' : ''} ${esc(a.label)}</button>`;
  }).join('')}</div>
  ${picked.length >= AIM_MAX ? '<div class="small muted">Three is the limit. Any more and none of them is a focus.</div>' : ''}</div>`;
}

/* ---------------- after ---------------- */

// Has this aim been slipping? Only across sessions, never from one.
function aimPattern(date, id) {
  const prior = Object.keys(logs).filter(d => d < date && aimsOn(d).includes(id) && aimRating(d, id))
    .sort().reverse().slice(0, 3);
  const bad = prior.filter(d => aimRating(d, id) !== 'yes').length;
  if (prior.length < 2 || bad < 2) return '';
  const a = aimById(date, id); if (!a) return '';
  const why = id === 'technique' ? 'That usually means the weight, not the focus.'
    : id === 'short' ? 'A max set too high will do that. Lowering it is the fix.'
    : id === 'cpace' ? 'Going out too hard on the first rounds is the usual cause, not a lack of fitness.'
    : id === 'cspare' ? 'These are meant to be repeatable. Emptying yourself on one is borrowing from the next.'
    : id === 'ceasy' ? 'If the easy parts are not easy, the hard parts cannot be hard. Slow them right down.'
    : 'Worth changing something rather than trying harder at it.';
  return `You have picked “${esc(a.label)}” ${prior.length + 1} sessions running and it has not held up. ${why}`;
}

function aimsReport(date) {
  const picked = aimsOn(date);
  let h = `<div class="card"><div class="lift-h"><h3>How it went</h3></div>`;
  if (!picked.length) h += `<p class="small muted" style="margin:0">You did not set anything for this one.</p>`;
  for (const id of picked) {
    const a = aimById(date, id); if (!a) continue;
    const res = a.check ? a.check(date) : null;
    if (res) {
      h += `<div class="aim-row"><div><b>${res.ok ? '✓' : '✗'} ${esc(a.label)}</b><div class="small muted">${esc(res.detail)}</div></div></div>`;
    } else {
      const r = aimRating(date, id);
      h += `<div class="aim-row"><div><b>${r === 'yes' ? '✓' : r ? '✗' : ''} ${esc(a.label)}</b>
      <div class="seg" style="margin-top:4px">${Object.entries(RATE).map(([k, l]) => `<button class="segb${r === k ? ' on' : ''}" data-act="aimrate" data-id="${id}" data-v="${k}" aria-pressed="${r === k}">${l}</button>`).join('')}</div></div></div>`;
    }
    const p = aimPattern(date, id);
    if (p) h += `<div class="banner info"><div class="small">${p}</div></div>`;
  }
  const L = lg(date);
  h += `<label class="f" style="margin-top:4px">Anything to remember?<textarea id="aim-notes" data-bind="notes" rows="3" placeholder="How it moved, what to change, what to watch">${esc(L.notes || '')}</textarea></label>
  <div class="small muted">This is shown to you before your next ${esc((dayPlan(date) || {}).short || 'session')}, which is the point of writing it.</div></div>`;
  return h;
}
