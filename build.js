#!/usr/bin/env node
// Concatenates src/app/*.js (in filename order) into public/app.js inside one IIFE, then
// stamps index.html with a content hash so a changed bundle is always fetched fresh and
// the in-app update banner still fires. No dependencies, no transforms: the bundle is
// the source files joined in order, so what runs is what you wrote.
//
// It also stamps the service worker's cache name. That used to be bumped by hand, which
// is exactly the step that gets forgotten: change an icon or the manifest, deploy, and
// every installed app keeps serving the old one out of a cache nobody invalidated. The
// name is now a hash of the files the worker actually precaches, so it moves by itself
// when one of them does and stays put when none of them have.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);

/** The worker's own SHELL list, resolved to files on disk. One source of truth: the list
 *  the worker caches is the list the version is computed from, so they cannot drift. */
function shellFiles(root = __dirname) {
  const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  const m = sw.match(/^const SHELL = (\[[^\]]*\]);$/m);
  if (!m) throw new Error("sw.js has no `const SHELL = [...]` line to read");
  return JSON.parse(m[1]).map((url) => ({
    url,
    // "/" is index.html; everything else is its own path under public/.
    file: path.join(root, "public", url === "/" ? "index.html" : url),
  }));
}

/** Cache name for the service worker: a hash of everything it precaches. */
function shellVersion(root = __dirname) {
  const parts = shellFiles(root).map(({ url, file }) => {
    if (!fs.existsSync(file)) throw new Error(`sw.js precaches ${url}, but ${path.relative(root, file)} does not exist`);
    return url + ":" + sha(fs.readFileSync(file));
  });
  return "ob-" + sha(parts.join("\n"));
}

function stampServiceWorker(root = __dirname) {
  const p = path.join(root, "public", "sw.js");
  const before = fs.readFileSync(p, "utf8");
  const version = shellVersion(root);
  const after = before.replace(/^const VERSION = "[^"]*";$/m, `const VERSION = "${version}";`);
  if (!after.includes(`const VERSION = "${version}";`)) throw new Error("sw.js has no `const VERSION = \"…\";` line to stamp");
  if (after !== before) fs.writeFileSync(p, after);
  return version;
}

function build(root = __dirname) {
  const srcDir = path.join(root, "src", "app");
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort();
  if (!files.length) throw new Error("no source files in src/app");

  const body = files
    .map((f) => fs.readFileSync(path.join(srcDir, f), "utf8").replace(/\s+$/, ""))
    .join("\n\n");
  const bundle = `(function(){\n"use strict";\n${body}\n})();\n`;
  fs.writeFileSync(path.join(root, "public", "app.js"), bundle);

  const css = fs.readFileSync(path.join(root, "public", "app.css"), "utf8");
  const releases = fs.readFileSync(path.join(root, "public", "releases.js"), "utf8");
  const hash = sha(bundle + css + releases);

  const indexPath = path.join(root, "public", "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const before = html;
  html = html.replace(/(href="\/app\.css)(\?b=[0-9a-f]+)?"/, `$1?b=${hash}"`);
  html = html.replace(/(src="\/releases\.js)(\?b=[0-9a-f]+)?"/, `$1?b=${hash}"`);
  html = html.replace(/(src="\/app\.js)(\?b=[0-9a-f]+)?"/, `$1?b=${hash}"`);
  for (const need of ["/app.css?b=", "/releases.js?b=", "/app.js?b="]) {
    if (!html.includes(need)) throw new Error(`index.html is missing a tag for ${need}`);
  }
  if (html !== before) fs.writeFileSync(indexPath, html);

  // After index.html, since the worker precaches "/" and its contents just moved.
  const version = stampServiceWorker(root);
  return { files: files.length, lines: bundle.split("\n").length, hash, version };
}

if (require.main === module) {
  const r = build();
  console.log(`built public/app.js — ${r.files} files, ${r.lines} lines, build ${r.hash}, sw ${r.version}`);
}

module.exports = { build, shellFiles, shellVersion, stampServiceWorker, sha };
