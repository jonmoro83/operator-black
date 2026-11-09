// Checks the tests make of the app that the app no longer makes of itself. These used
// to live in src/app with nothing calling them but the suite; moving them here keeps the
// coverage and takes the dead code out of the bundle. Each takes the loaded app (`x`
// from the harness) and reads the same rules the app uses.

/** Names a session kind in words, the way a warning would. */
function kindName(k) {
  return /^strength[AB]?$/.test(k) ? "strength" : k === "se" ? "strength-endurance" : "hard conditioning";
}

// The week as a run of kinds, the day before and the day after included, under the
// given day order. `ord[i]` is which planned slot sits on weekday i.
function kindsAround(x, monday, ord) {
  const K = [], N = [], prev = x.addDays(monday, -1), next = x.addDays(monday, 7);
  K.push(x.idxOf(prev) >= 0 ? x.sessKind(x.dayPlan(prev)) : "other"); N.push(x.DAYN[6] + " before");
  for (let i = 0; i < 7; i++) { K.push(x.sessKind(x.dayPlanSlot(x.addDays(monday, i), ord[i]))); N.push(x.DAYN[i]) }
  K.push(x.weekOf(next) ? x.sessKind(x.dayPlan(next)) : "other"); N.push("next " + x.DAYN[0]);
  return { K, N };
}

/* What must not land on consecutive days: only strength, and only the same session
   twice. That is the book's own principle for moving things around (TB1: "one rest day.
   No back to back same sessions. Completed within 7 days."). Zulu's A and B are different
   sessions, so they carry their own kinds and may touch. Conditioning is deliberately not
   here: TB II allows HIC and E on any days, two in a row included. The arranger in the app
   prefers to spread them, and these lists are the test's view of what it may not do. */
const ADJACENT_BAN = ["strength", "strengthA", "strengthB"];
// Worth avoiding when there is a choice, without being a reason to refuse an
// arrangement the books allow.
const ADJACENT_SOFT = ["hic", "se"];
const clashes = (x, a, b) => !!a && a === b && ADJACENT_BAN.includes(a);
const crowds = (x, a, b) => !!a && a === b && ADJACENT_SOFT.includes(a);

/** Pairs of consecutive days the books forbid: the same strength session twice. */
function orderIssues(x, monday, ord) {
  const { K, N } = kindsAround(x, monday, ord), out = [];
  for (let i = 1; i < K.length; i++) if (clashes(x, K[i], K[i - 1])) out.push({ a: N[i - 1], b: N[i], kind: K[i] });
  return out;
}

/** Pairs the app would rather avoid but allows: two HICs or two circuits together. */
function orderCrowding(x, monday, ord) {
  const { K, N } = kindsAround(x, monday, ord), out = [];
  for (let i = 1; i < K.length; i++) if (crowds(x, K[i], K[i - 1])) out.push({ a: N[i - 1], b: N[i], kind: K[i] });
  return out;
}

// The FOBBIT catalog read per session id, the way the old one-line wrappers did.
const fobEvery = (x, id) => x.specEvery(x.FOBBIT[id]);
const fobCount = (x, id) => x.specCount(x.FOBBIT[id]);
const fobMinOpts = (x, id) => x.specMinOpts(x.FOBBIT[id]);
const fobRounds = (x, id, mins) => x.specRounds(x.fobDef(id) || x.FOBBIT[id], mins);

module.exports = { kindName, clashes, crowds, orderIssues, orderCrowding, fobEvery, fobCount, fobMinOpts, fobRounds, ADJACENT_BAN, ADJACENT_SOFT };
