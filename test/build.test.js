// The build step itself. The service worker's cache name used to be bumped by hand,
// which meant a changed icon could ship behind a cache nobody invalidated and look like
// a failed deploy. These tests are about that not coming back.
const { test } = require("node:test");
const a = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { shellFiles, shellVersion, stampServiceWorker, build } = require("../build.js");

const root = path.join(__dirname, "..");
const swText = () => fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

/** A throwaway root holding only what shellVersion reads: sw.js and the shell files. */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ob-build-"));
  fs.mkdirSync(path.join(dir, "public"));
  fs.copyFileSync(path.join(root, "public", "sw.js"), path.join(dir, "public", "sw.js"));
  for (const { file } of shellFiles(root)) {
    fs.copyFileSync(file, path.join(dir, "public", path.basename(file)));
  }
  return dir;
}

test("the service worker's cache name is stamped, not typed", () => {
  const sw = swText();
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
  const before = shellVersion(dir);
  a.equal(before, shellVersion(dir), "stable while nothing changes");

  // An icon is the case from the roadmap: easy to change, easy to forget.
  const icon = path.join(dir, "public", "icon-192.png");
  fs.appendFileSync(icon, Buffer.from([0]));
  const afterIcon = shellVersion(dir);
  a.notEqual(afterIcon, before, "a changed icon invalidates the cache");

  // So does the manifest, and so does the page itself.
  fs.appendFileSync(path.join(dir, "public", "manifest.webmanifest"), " ");
  const afterManifest = shellVersion(dir);
  a.notEqual(afterManifest, afterIcon, "and a changed manifest");

  fs.appendFileSync(path.join(dir, "public", "index.html"), "<!-- -->");
  a.notEqual(shellVersion(dir), afterManifest, "and a changed page");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a file the worker does not precache leaves the cache name alone", () => {
  const dir = sandbox();
  const before = shellVersion(dir);
  // sw.js itself is not in SHELL: changing it installs a new worker on its own, and
  // should not also throw away a cache whose contents are still correct.
  fs.appendFileSync(path.join(dir, "public", "sw.js"), "\n// a comment\n");
  a.equal(shellVersion(dir), before, "the worker's own source is not shell content");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the build refuses to stamp a shell it cannot account for", () => {
  const dir = sandbox();
  fs.rmSync(path.join(dir, "public", "icon-512.png"));
  a.throws(() => shellVersion(dir), /icon-512\.png does not exist/, "a missing precached file is a build error, not a silent miss");

  // And a worker with nothing to stamp is a build error too, rather than a quiet no-op.
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ob-build-"));
  fs.mkdirSync(path.join(bare, "public"));
  fs.writeFileSync(path.join(bare, "public", "sw.js"), 'const SHELL = ["/"];\n');
  fs.writeFileSync(path.join(bare, "public", "index.html"), "<!doctype html>");
  a.throws(() => stampServiceWorker(bare), /no `const VERSION/, "a worker with no VERSION line");

  fs.writeFileSync(path.join(bare, "public", "sw.js"), 'const VERSION = "x";\n');
  a.throws(() => shellFiles(bare), /no `const SHELL/, "a worker with no SHELL line");

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bare, { recursive: true, force: true });
});

test("building twice in a row changes nothing", () => {
  const first = build(root);
  const sw = swText(), index = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const second = build(root);
  a.deepEqual(second, first, "same result");
  a.equal(swText(), sw, "sw.js untouched");
  a.equal(fs.readFileSync(path.join(root, "public", "index.html"), "utf8"), index, "index.html untouched");
});

test("the build repairs a stale cache name rather than trusting what is there", () => {
  // Asserting that sw.js is correct right now cannot tell whether the build keeps it
  // that way: it is correct because the last build made it so. Breaking it first is
  // the only way to prove the stamping still happens.
  const p = path.join(root, "public", "sw.js");
  const good = fs.readFileSync(p, "utf8");
  try {
    fs.writeFileSync(p, good.replace(/^const VERSION = "[^"]*";$/m, 'const VERSION = "ob-stale00";'));
    a.match(fs.readFileSync(p, "utf8"), /ob-stale00/, "it really is stale now");
    build(root);
    a.equal(fs.readFileSync(p, "utf8"), good, "the build put the right name back");
  } finally {
    fs.writeFileSync(p, good);   // never leave the repo broken, even on a failure
  }
});
