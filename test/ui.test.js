// The UI pass of 3.71, through the real DOM: the find boxes on Setup and the Guide, the
// Status fold for cards with nothing to show, the Start session button on the week line,
// and the stylesheet's floors for type and touch targets.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadDom } = require("./dom.js");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "public", "app.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

function ready({ now = "2026-10-19", maxes = true } = {}) {
  const x = loadDom({ now });
  x.plan.startMonday = "2026-09-07"; x.plan.bridge = false; x.plan.onboarded = true;
  if (maxes) Object.assign(x.plan.maxes, { squat: 300, bench: 200, pull: 180, ohp: 135, dead: 400 });
  x.bump(); x.render();
  return x;
}
const type = (x, el, v) => { el.value = v; x.fire(el, "input") };

test("the stylesheet has no type under 10px, and small buttons reach 44px", () => {
  // The floor was 12px until 3.72. The instrument-panel labels are set in B612 Mono,
  // a face designed for legibility at small sizes on cockpit displays, and sit at 10px;
  // gym mode lifts them. Anything under 10px is still a mistake.
  a.equal((css.match(/font-size:\s*(\d+(\.\d+)?)px/g) || []).filter((m) => parseFloat(m.replace(/[^\d.]/g, "")) < 10).length, 0, "10px is the floor");
  a.match(css, /^\.btn\.sm\{[^}]*min-height:44px/m, "the small button meets the 44pt target");
  a.match(css, /\[data-gym="1"\] \.day \.dn[^{]*\{font-size:13px\}/, "gym mode lifts the day-strip labels");
  a.match(css, /input\[type=search\]/, "the find box is styled with the other inputs");
});

test("the header menus are labelled with the attribute browsers actually read", () => {
  a.equal((html.match(/aria-labeledby/g) || []).length, 0, "no misspelled attribute");
  a.ok(html.includes('id="acct-m" class="acct-m" hidden role="menu" aria-labelledby="acct"'), "the account menu is labelled by its button");
  a.ok(html.includes('aria-labelledby="tmr-b"'), "and so is the timer menu");
});

test("Find a setting keeps only the cards that mention the word, and opens their section", () => {
  const x = ready();
  x.view = "setup"; x.render();
  const before = x.$$("#main .setup-sec").length;
  a.ok(before >= 5, `Setup has its sections: ${before}`);
  const box = x.$("#setup-find");
  a.ok(box, "the box is at the top of Setup");
  a.equal(box.type, "search");

  type(x, box, "calendar");
  const secs = x.$$("#main .setup-sec");
  a.ok(secs.length < before, `fewer sections: ${secs.length} of ${before}`);
  for (const s of secs) a.ok(s.hasAttribute("open"), `${s.dataset.sec} is opened for the result`);
  const heads = x.$$("#main .setup-sec h2").map((h) => h.textContent);
  a.ok(heads.includes("Calendar feed"), `Calendar feed is among ${heads}`);
  a.ok(!heads.includes("Maxes"), "Maxes is not");
  a.match(x.$("#main .setup-sec summary").textContent, /found/, "the summary says these are hits");
  a.equal(x.$("#setup-find").value, "calendar", "the field keeps what was typed across the render");
  a.ok(x.$('#main [data-act="findclear"]'), "and offers to clear");

  type(x, box, "zzzxq");
  a.equal(x.$$("#main .setup-sec").length, 0);
  a.match(x.$("#main").textContent, /No setting mentions “zzzxq”/);

  x.fire(x.$('#main [data-act="findclear"]'), "click");
  a.equal(x.$("#setup-find").value, "");
  a.equal(x.$$("#main .setup-sec").length, before, "clearing brings everything back");
  a.ok(x.$("#main #account"), "the account card is never filtered");
});

test("the Guide's box keeps the cards that match and opens what they fold away", () => {
  const x = ready();
  x.view = "guide"; x.render();
  const all = x.$$("#main .card").length;
  const closed = x.$$("#main details:not([open])").length;
  a.ok(closed > 10, `the guide folds most of itself: ${closed} closed disclosures`);
  type(x, x.$("#guide-find"), "pull-up");
  const hits = x.$$("#main .card").length;
  a.ok(hits > 0 && hits < all, `${hits} of ${all} cards mention pull-ups`);
  a.equal(x.$$("#main details:not([open])").length, 0, "every disclosure in a hit is open");
  for (const c of x.$$("#main .card")) a.match(c.textContent.toLowerCase(), /pull-up/);
});

test("Status folds the cards that have nothing to show into one, and lets them back as data arrives", () => {
  const x = ready();
  x.view = "status"; x.render();
  const heads = () => x.$$("#main .card h3").map((h) => h.textContent);
  a.ok(heads().includes("Not tracking yet"), `the fold is there: ${heads()}`);
  for (const gone of ["Macros", "Bodyweight", "Energy and composition", "Pull-ups", "Personal records"]) {
    a.ok(!heads().includes(gone), `${gone} is not its own card while empty`);
  }
  const fold = x.$$("#main .card").find((c) => /Not tracking yet/.test(c.textContent));
  a.match(fold.textContent, /Macros.*Bodyweight.*Energy and composition.*Pull-ups.*Personal records/s, "listed in the order the cards would have come");
  a.match(fold.textContent, /daily check-in/, "each says where the data comes from");
  a.ok(heads().includes("Strength"), "cards with something to show are untouched");

  // One weigh-in: Bodyweight has a partial card of its own again, and leaves the fold.
  x.seed({ "2026-10-18": { date: "2026-10-18", checkin: { bw: 185 } } });
  x.render();
  a.ok(heads().includes("Bodyweight"), "a weigh-in brings the card back");
  a.doesNotMatch(x.$$("#main .card").find((c) => /Not tracking yet/.test(c.textContent)).textContent, /Bodyweight/);
});

test("a card that is empty outside Status still renders as itself", () => {
  const x = ready();
  x.view = "history"; x.render();
  a.match(x.prBoard(), /<h3>Personal records<\/h3>/, "called from anywhere else it is the usual card");
});

test("the week line offers Start session on today's lifting day, and only then", () => {
  const x = ready({ now: "2026-10-19" });   // Monday: Operator day 1
  const line = x.$("#main .wkline");
  a.ok(line, "the week line is drawn");
  const btn = line.querySelector('[data-act="lsstart"]');
  a.ok(btn, "Start session sits on the week line");
  a.equal(btn.textContent, "Start session");
  a.ok(line.querySelector('[data-act="move"]'), "Move… is still there");
  a.ok(!line.querySelector('[data-act="move"]').getAttribute("style"), "and no longer pushes itself to the right, since Start does");

  x.fire(btn, "click");
  a.ok(x.ls && x.ls.date === "2026-10-19", "the tap opens session mode for today");

  const y = ready({ now: "2026-10-25" });   // Sunday: off
  a.equal(y.$("#main .wkline") && y.$("#main .wkline").querySelector('[data-act="lsstart"]'), null, "a rest day has no session to start");
  const z = ready({ now: "2026-10-19" });
  z.sel = "2026-10-21"; z.render();           // Wednesday, looked at from Monday
  a.equal(z.$("#main .wkline").querySelector('[data-act="lsstart"]'), null, "not for a day that is not today");
  a.match(z.$("#main .wkline").querySelector('[data-act="move"]').getAttribute("style") || "", /margin-left:auto/, "Move… takes the right edge back");
});
