#!/usr/bin/env node
// Concatenates src/app/*.js (in filename order) into public/app.js inside one IIFE, then
// stamps index.html with a content hash so a changed bundle is always fetched fresh and
// the in-app update banner still fires. No dependencies, no transforms: the bundle is
// the source files joined in order, so what runs is what you wrote.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
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
const hash = crypto.createHash("sha256").update(bundle + css + releases).digest("hex").slice(0, 10);

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

console.log(`built public/app.js — ${files.length} files, ${bundle.split("\n").length} lines, build ${hash}`);
