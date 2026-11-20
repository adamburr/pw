// Tests for pw.js and the built page. Run with: node --test

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const pw = require("./pw.js");
const { build } = require("./build.js");

const words = fs.readFileSync(path.join(__dirname, "words.txt"), "utf8").split(/\s+/).filter(Boolean);

// Every way to split text into two syllables, as the index of the split.
function twoSyllableSplits(text) {
  const splits = [];
  for (let i = 1; i < text.length; i++) {
    if (pw.isSyllable(text.slice(0, i)) && pw.isSyllable(text.slice(i))) splits.push(i);
  }
  return splits;
}

test("strength per part", () => {
  assert.ok(Math.abs(pw.SYLLABLE_BITS - 13.5305) < 1e-4);
  assert.equal(pw.SYMBOL_BITS, 3);
  assert.ok(Math.abs(pw.DIGIT_BITS - 3.3219) < 1e-4);
  assert.ok(Math.abs(pw.endingBits({ digits: true }) - 13.2877) < 1e-4);
  assert.ok(Math.abs(pw.endingBits({ digits: true, symbol: true }) - 12.9658) < 1e-4);
  assert.equal(pw.endingBits({ symbol: true }), 3);
  assert.ok(pw.isValidWordList(words));
  assert.ok(Math.abs(pw.partInfo("dictionary", words).bits - Math.log2(words.length)) < 1e-9);
});

test("parts per security level match the README table", () => {
  // For each method: no ending, then symbol only, digits only, and both. The
  // digits replace one part; the symbol alone never does.
  const endings = [[false, false], [true, false], [false, true], [true, true]];
  const expected = { low: [4, 4, 3, 3], medium: [5, 5, 4, 4], high: [6, 6, 5, 5], paranoid: [7, 7, 6, 6] };
  for (const [security, counts] of Object.entries(expected)) {
    for (const method of ["phonetic", "dictionary"]) {
      const actual = endings.map(([symbol, digits]) => {
        const plan = pw.planPassphrase({ security, method, symbol, digits }, words);
        assert.ok(plan.bits >= pw.SECURITY_BITS[security]);
        return plan.n;
      });
      assert.deepEqual(actual, counts, `${security} ${method}`);
    }
  }
});

test("merged words always split back into the syllables they came from", () => {
  const codas = [...new Set(pw.CODA_CONSONANTS)];
  let merged = 0;
  const check = (a, b) => {
    if (!pw.canMerge(a, b)) return;
    merged++;
    assert.equal(twoSyllableSplits(a.join("") + b.join(""))[0], a.join("").length, `${a} + ${b}`);
  };
  // Every junction of a coda and an onset, with every pair of nuclei.
  for (const coda of codas) {
    for (const onset of pw.ONSET_CONSONANTS) {
      for (const n1 of pw.NUCLEUS_VOWELS) {
        for (const n2 of pw.NUCLEUS_VOWELS) check(["st", n1, coda], [onset, n2, "nt"]);
      }
    }
  }
  for (let i = 0; i < 20000; i++) check(pw.generateSyllable(), pw.generateSyllable());
  assert.ok(merged > 0);
});

test("merge rules", () => {
  assert.ok(pw.canMerge(["br", "a", ""], ["st", "oo", ""]));    // bra-stoo
  assert.ok(!pw.canMerge(["br", "a", "s"], ["t", "oo", ""]));   // would read as bra-stoo
  assert.ok(!pw.canMerge(["b", "a", "t"], ["h", "oo", ""]));    // would read as ba-thoo
  assert.ok(!pw.canMerge(["b", "a", ""], ["w", "oo", ""]));     // w blends into the vowel
  assert.ok(!pw.canMerge(["d", "i", "lp"], ["y", "oa", "k"]));  // y after a consonant
  assert.ok(!pw.canMerge(["dr", "ai", "nk"], ["z", "u", "st"])); // three consonants after nk
  assert.ok(pw.canMerge(["b", "a", "n"], ["st", "oo", ""]));    // three after n is fine
  assert.deepEqual(
    pw.mergeSyllables([["br", "a", ""], ["st", "oo", ""], ["fl", "i", "mp"], ["sh", "ay", "n"]]),
    ["brastoo", "flimp", "shayn"]);
});

test("passphrase formats", () => {
  const body = { camel: "([A-Z][a-z]+)+", dashes: "[a-z]+(-[a-z]+)*" };
  const endings = [[true, true], [true, false], [false, true], [false, false]];
  for (const method of ["phonetic", "dictionary"]) {
    for (const style of ["camel", "dashes"]) {
      for (const [symbol, digits] of endings) {
        const number = digits ? (style === "dashes" ? "-" : "") + (symbol ? "\\d{3}" : "\\d{4}") : "";
        const format = new RegExp(`^${body[style]}${number}${symbol ? "[!@#$%^&*]" : ""}$`);
        for (const security of Object.keys(pw.SECURITY_BITS)) {
          const phrase = pw.generatePassphrase({ security, method, style, symbol, digits }, words);
          assert.match(phrase, format, `${method} ${style} ${symbol} ${digits} ${security}`);
        }
      }
    }
  }
});

test("command line", () => {
  const { execFileSync } = require("node:child_process");
  const run = (...args) => execFileSync(process.execPath, [path.join(__dirname, "pw.js"), "-n", "5", ...args],
    { encoding: "utf8" }).trim().split("\n");
  const all = (lines, re) => lines.forEach((line) => assert.match(line, re));
  all(run(), /^[a-z]+(-[a-z]+){4}$/);                               // 5 dictionary words
  all(run("-m", "phonetic", "--symbol"), /^[a-z]+(-[a-z]+)*[!@#$%^&*]$/);
  all(run("--digits"), /^[a-z]+(-[a-z]+){3}-\d{4}$/);
  all(run("--digits", "-t", "camel"), /^([A-Z][a-z]+){4}\d{4}$/);
  all(run("--suffix", "-t", "camel"), /^([A-Z][a-z]+){4}\d{3}[!@#$%^&*]$/);
  all(run("-m", "fantasy"), /^[a-z]+(-[a-z]+)*$/);                  // old name still works
  for (const line of run("-m", "words")) assert.ok(line.split("-").every((w) => words.includes(w)));
});

test("the built page's script parses and its CSP pins the script and style", () => {
  const html = build();
  const crypto = require("node:crypto");
  const sha256 = (text) => crypto.createHash("sha256").update(text).digest("base64");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  new vm.Script(script);
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp, /^default-src 'none';/);
  assert.ok(csp.includes(`script-src 'sha256-${sha256(script)}';`));
  assert.ok(csp.includes(`style-src 'sha256-${sha256(style)}';`));
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.equal((html.match(/<style/g) || []).length, 1);
});
