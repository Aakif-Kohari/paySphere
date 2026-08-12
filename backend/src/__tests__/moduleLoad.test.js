/**
 * Every module under `backend/src` must parse.
 *
 * This is the test that was missing. `main` shipped two files that were not
 * valid JavaScript — `app.js` and `models/payroll.model.js`, both wrecked by a
 * merge that kept both sides of a whitespace conflict — and the only signal was
 * 31 jest suites reporting "Test suite failed to run", which reads like an
 * environment problem rather than "the product does not start" (#792).
 *
 * A parse check is cheap and unambiguous. It does not execute anything, so it
 * cannot be tripped up by a missing database, a missing Redis or a missing
 * optional dependency; it only answers the one question a duplicated-conflict
 * merge gets wrong.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..');

/** Directories that hold no runtime source. */
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'logs', 'coverage']);

/**
 * Every `.js` file under `backend/src`, tests excluded.
 *
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function collectSourceFiles(dir) {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectSourceFiles(path.join(dir, entry.name)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      if (entry.name.endsWith('.test.js')) continue;
      found.push(path.join(dir, entry.name));
    }
  }

  return found;
}

const sourceFiles = collectSourceFiles(SRC);
const relative = (file) => path.relative(SRC, file);

describe('backend source tree', () => {
  it('finds a plausible number of source files', () => {
    // A guard on the guard: if the walker breaks and returns [], every
    // it.each below silently passes and the suite is worthless.
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it.each(sourceFiles.map((file) => [relative(file), file]))(
    '%s parses as CommonJS',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');

      // `new vm.Script` compiles without running. Wrapping in the same function
      // header Node uses for a CJS module means a legitimate top-level `return`
      // is accepted while a top-level `await` — the #539 failure — is not.
      expect(() => {
        new vm.Script(
          `(function (exports, require, module, __filename, __dirname) {\n${source}\n});`,
          { filename: file },
        );
      }).not.toThrow();
    },
  );

  it.each(sourceFiles.map((file) => [relative(file), file]))(
    '%s has no leftover conflict markers',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const markers = source
        .split('\n')
        .filter((line) => /^(<{7}|={7}|>{7})(\s|$)/.test(line));

      expect(markers).toEqual([]);
    },
  );

  it.each(sourceFiles.map((file) => [relative(file), file]))(
    '%s requires only modules that exist',
    (_name, file) => {
      // Parsing is not enough. `services/anomaly.service.js` parsed perfectly
      // and required `./logger`, which is not there — and since
      // `payroll.controller.js` requires it, that one wrong path took the whole
      // server down at boot. `controllers/monthlyUpdates.controller.js`
      // required a model that had never been written, and
      // `user.controller.js` had a `require('../utils/generateToken')` buried
      // inside `login`, so every login answered 500.
      //
      // Relative paths only: a bare specifier is a package, and whether it is
      // installed is `npm ci`'s problem, not this test's.
      const source = fs.readFileSync(file, 'utf8');
      const dir = path.dirname(file);
      const missing = [];

      for (const match of source.matchAll(
        /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
      )) {
        const specifier = match[1];
        const target = path.resolve(dir, specifier);

        const resolves =
          fs.existsSync(target) ||
          fs.existsSync(`${target}.js`) ||
          fs.existsSync(`${target}.json`) ||
          fs.existsSync(path.join(target, 'index.js'));

        if (!resolves) missing.push(specifier);
      }

      expect(missing).toEqual([]);
    },
  );

  it('declares no identifier twice at the top level of a module', () => {
    // The specific shape of the #785 merge: the same `const foo = require(...)`
    // appearing twice in one file. `new vm.Script` already rejects it, but the
    // failure message is a bare SyntaxError with no filename in the output, so
    // this reports which file and which name.
    const offenders = [];

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const seen = new Map();

      source.split('\n').forEach((line, index) => {
        const match = /^const\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
        if (!match) return;

        const name = match[1];
        if (seen.has(name)) {
          offenders.push(
            `${relative(file)}: "${name}" declared on lines ${seen.get(name)} and ${index + 1}`,
          );
          return;
        }

        seen.set(name, index + 1);
      });
    }

    expect(offenders).toEqual([]);
  });
});
