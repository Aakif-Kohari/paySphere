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

/**
 * Runtime source files that are *not* `.js`.
 *
 * The gap this closes (#1008). `collectSourceFiles` above only ever collected
 * `.js`, so a source file in another language was not something it could report
 * on — it was simply invisible. Two of them sat in the tree for months:
 *
 *     src/middlewares/auth.middleware.ts
 *     src/utils/jwt.utils.ts
 *
 * `backend` is CommonJS started with `node src/index.js` and no build step, so
 * `require('../middlewares/auth.middleware')` resolved to nothing. Forty-eight
 * modules require that path. The server could not boot at all, and this suite —
 * the one written in #792 specifically to answer "does the product start" —
 * passed, because the file it needed to look at did not end in `.js`.
 *
 * Extensions that are data or config are fine anywhere. This is about
 * *executable* source that Node cannot load.
 *
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function collectNonJsSourceFiles(dir) {
  const COMPILED_LANGUAGE_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.jsx',
    '.coffee',
  ]);
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectNonJsSourceFiles(path.join(dir, entry.name)));
      continue;
    }

    if (
      entry.isFile() &&
      COMPILED_LANGUAGE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      found.push(path.join(dir, entry.name));
    }
  }

  return found;
}

/**
 * Source with comments blanked out.
 *
 * The require scan below reads raw text, which was fine until this suite could
 * actually run (#1008) and two files failed on requires that are not requires:
 *
 *     services/elasticsearch.service.js
 *     services/notificationDispatcher.service.js
 *
 * Both carry a header comment explaining a historical bug — the literal text
 * "`require('./logger')` — the logger is at `utils/logger.js`" — and the regex
 * happily matched the example being warned about. A test that fails on its own
 * documentation trains people to ignore it.
 *
 * Comments are replaced with spaces rather than removed so every offset in the
 * file is preserved; that keeps line numbers meaningful if this ever reports
 * one. Quoted strings are tracked because `'http://x'` contains `//` and would
 * otherwise swallow the rest of the line — including a real `require` after it.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | single | double | template

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        out += '  ';
        i += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block';
        out += '  ';
        i += 2;
        continue;
      }
      if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';

      out += char;
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (char === '\n') {
        state = 'code';
        out += '\n';
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      // Newlines are kept so line numbering survives a block comment.
      out += char === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    // Inside a string literal. Copy verbatim, honour backslash escapes, and
    // only leave on the matching unescaped quote.
    if (char === '\\') {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }

    const closes =
      (state === 'single' && char === "'") ||
      (state === 'double' && char === '"') ||
      (state === 'template' && char === '`');

    if (closes) state = 'code';

    out += char;
    i += 1;
  }

  return out;
}

const sourceFiles = collectSourceFiles(SRC);
const relative = (file) => path.relative(SRC, file);

describe('backend source tree', () => {
  it('contains no source Node cannot require', () => {
    // Not a style preference. `package.json` has no build step and no `dist/`
    // is produced, so anything here that is not plain CommonJS is a module the
    // running server cannot load — and, because Babel is configured with
    // `@babel/preset-env` and no TypeScript preset, one this suite cannot even
    // parse. If the project ever does adopt TypeScript, the thing that makes
    // this test wrong is a real build pipeline, and whoever adds it should be
    // the one to delete it.
    expect(collectNonJsSourceFiles(SRC).map(relative)).toEqual([]);
  });

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
      const source = stripComments(fs.readFileSync(file, 'utf8'));
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
