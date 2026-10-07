// The build step itself. The service worker's cache name used to be bumped by hand,
// which meant a changed icon could ship behind a cache nobody invalidated and look like
// a failed deploy. These tests are about that not coming back.
//
// Everything that writes runs in a throwaway copy of the repo. `node --test` runs test
// FILES in parallel, so calling build() on the real tree rewrites public/app.js while
// the other suites are reading it, and they fail with "could not replace the boot
// block" perhaps one run in three. Read the real tree here, never write to it.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { shellFiles, shellVersion, stampServiceWorker, build } = require("../build.js");

const root = path.join(__dirname, "..");
const read = (dir, f) => fs.readFileSync(path.join(dir, "public", f), "utf8");

/** A complete throwaway copy of everything build() reads and writes. */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ob-build-"));
  fs.cpSync(path.join(root, "public"), path.join(dir, "public"), { recursive: true });
  fs.cpSync(path.join(root, "src", "app"), path.join(dir, "src", "app"), { recursive: true });
  return dir;
}
function drop(dir) { fs.rmSync(dir, { recursive: true, force: true }) }

test("the service worker's cache name is stamped, not typed", () => {
  const sw = read(root, "sw.js");
  const m = sw.match(/^const VERSION = "([^"]*)";$/m);
  a.ok(m, "there is a VERSION line");
  a.match(m[1], /^ob-[0-9a-f]{10}$/, `a hand-written version is left in sw.js: ${m[1]}`);
  a.equal(m[1], shellVersion(root), "and it matches what the shell hashes to right now");
});

test("every file the worker precaches actually exists", () => {
  const files = shellFiles(root);
  a.ok(files.length >= 6, `expected a real shell, got ${files.length} entries`);
  for (const { url, file } of files) {
    a.ok(fs.existsSync(file), `sw.js precaches ${url}, which is not on disk`);
  }
  // The things most likely to be changed and forgotten.
  const urls = files.map((f) => f.url);
  for (const need of ["/", "/manifest.webmanifest", "/icon-192.png"]) {
    a.ok(urls.includes(need), `${need} should be precached`);
  }
});

test("changing a precached file moves the cache name", () => {
  const dir = sandbox();
  try {
    const before = shellVersion(dir);
    a.equal(before, shellVersion(dir), "stable while nothing changes");

    // An icon is the case from the roadmap: easy to change, easy to forget.
    fs.appendFileSync(path.join(dir, "public", "icon-192.png"), Buffer.from([0]));
    const afterIcon = shellVersion(dir);
    a.notEqual(afterIcon, before, "a changed icon invalidates the cache");

    fs.appendFileSync(path.join(dir, "public", "manifest.webmanifest"), " ");
    const afterManifest = shellVersion(dir);
    a.notEqual(afterManifest, afterIcon, "and a changed manifest");

    fs.appendFileSync(path.join(dir, "public", "index.html"), "<!-- -->");
    a.notEqual(shellVersion(dir), afterManifest, "and a changed page");
  } finally { drop(dir) }
});

test("a file the worker does not precache leaves the cache name alone", () => {
  const dir = sandbox();
  try {
    const before = shellVersion(dir);
    // sw.js itself is not in SHELL: changing it installs a new worker on its own, and
    // should not also throw away a cache whose contents are still correct.
    fs.appendFileSync(path.join(dir, "public", "sw.js"), "\n// a comment\n");
    a.equal(shellVersion(dir), before, "the worker's own source is not shell content");
  } finally { drop(dir) }
});

test("the build refuses to stamp a shell it cannot account for", () => {
  const dir = sandbox();
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ob-build-"));
  try {
    fs.rmSync(path.join(dir, "public", "icon-512.png"));
    a.throws(() => shellVersion(dir), /icon-512\.png does not exist/, "a missing precached file is a build error, not a silent miss");

    // A worker with nothing to stamp is a build error too, rather than a quiet no-op.
    fs.mkdirSync(path.join(bare, "public"));
    fs.writeFileSync(path.join(bare, "public", "sw.js"), 'const SHELL = ["/"];\n');
    fs.writeFileSync(path.join(bare, "public", "index.html"), "<!doctype html>");
    a.throws(() => stampServiceWorker(bare), /no `const VERSION/, "a worker with no VERSION line");

    fs.writeFileSync(path.join(bare, "public", "sw.js"), 'const VERSION = "x";\n');
    a.throws(() => shellFiles(bare), /no `const SHELL/, "a worker with no SHELL line");
  } finally { drop(dir); drop(bare) }
});

test("building twice in a row changes nothing", () => {
  const dir = sandbox();
  try {
    const first = build(dir);
    const sw = read(dir, "sw.js"), index = read(dir, "index.html"), app = read(dir, "app.js");
    const second = build(dir);
    a.deepEqual(second, first, "same result");
    a.equal(read(dir, "sw.js"), sw, "sw.js untouched");
    a.equal(read(dir, "index.html"), index, "index.html untouched");
    a.equal(read(dir, "app.js"), app, "app.js untouched");
  } finally { drop(dir) }
});

test("the build repairs a stale cache name rather than trusting what is there", () => {
  // Asserting that sw.js is correct right now cannot tell whether the build keeps it
  // that way: it is correct because the last build made it so. Breaking it first is
  // the only way to prove the stamping still happens.
  const dir = sandbox();
  try {
    const good = read(dir, "sw.js");
    fs.writeFileSync(path.join(dir, "public", "sw.js"), good.replace(/^const VERSION = "[^"]*";$/m, 'const VERSION = "ob-stale00";'));
    a.match(read(dir, "sw.js"), /ob-stale00/, "it really is stale now");
    build(dir);
    a.equal(read(dir, "sw.js"), good, "the build put the right name back");
  } finally { drop(dir) }
});

test("an icon change alone is enough to move the cache name through a full build", () => {
  // End to end: the roadmap's scenario, with nothing else touched.
  const dir = sandbox();
  try {
    const before = build(dir).version;
    fs.appendFileSync(path.join(dir, "public", "icon-512.png"), Buffer.from([0]));
    const after = build(dir).version;
    a.notEqual(after, before, "a new icon reaches installed apps instead of sitting behind a cache");
    a.match(read(dir, "sw.js"), new RegExp(`const VERSION = "${after}";`), "and it is written into the worker");
  } finally { drop(dir) }
});
