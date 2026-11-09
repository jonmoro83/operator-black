// Correctness only, no style rules. The point is to catch what otherwise surfaces at
// runtime in a gym: a misspelled name, a duplicate key, a branch that cannot run.
//
// The app is 37 fragments sharing one scope, so src/app/*.js cannot be linted one by one
// (every file would be "undefined names" from the others). The built bundle can, and is.
const js = require("@eslint/js");
const globals = require("globals");

const rules = {
  ...js.configs.recommended.rules,
  // The code catches and ignores on purpose in many places: `catch(e){}` around
  // localStorage, audio, the clipboard. An empty block there is the intent.
  "no-empty": ["error", { allowEmptyCatch: true }],
  // Unused function arguments and caught errors are the house style (`catch(e)`).
  "no-unused-vars": ["warn", { vars: "all", args: "none", caughtErrors: "none" }],
  // Regex escapes like \- are harmless and common in the templates.
  "no-useless-escape": "off",
  // `while(true)`-style loops and `if(0)` toggles are not in use; keep the default.
};

module.exports = [
  { ignores: ["node_modules/", ".wrangler/", "-Users-*/", "public/releases.js", "public/brand/"] },
  {
    // The built app: one classic script in the browser.
    files: ["public/app.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "script",
      globals: { ...globals.browser, RELEASES: "readonly" },
    },
    rules,
  },
  {
    files: ["public/sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.serviceworker },
    rules,
  },
  {
    // The Worker: ES modules on the Workers runtime.
    files: ["src/*.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "module",
      globals: { ...globals.serviceworker, HTMLRewriter: "readonly" },
    },
    rules,
  },
  {
    files: ["build.js", "eslint.config.js", "test/**/*.js", "tools/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
    rules,
  },
];
