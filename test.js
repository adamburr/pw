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
  assert.ok(Math.abs(pw.SUFFIX_BITS - 9.6439) < 1e-4);
  assert.ok(pw.isValidWordList(words));
  assert.ok(Math.abs(pw.partInfo("words", words).bits - Math.log2(words.length)) < 1e-9);
});

test("parts per security level match the README table", () => {
  const expected = {
    // syllables + suffix, syllables, words + suffix, words
    low: [3, 4, 3, 4],
    medium: [4, 5, 4, 5],
    high: [5, 6, 5, 6],
    paranoid: [6, 7, 6, 7],
  };
  for (const [level, counts] of Object.entries(expected)) {
    const actual = [];
    for (const method of ["syllables", "words"]) {
      for (const suffix of [true, false]) {
        const info = pw.partInfo(method, words);
        const n = pw.partsNeeded(pw.SECURITY_BITS[level], info.bits, suffix);
        actual.push(n);
        assert.ok(pw.describeStrength(n, info, suffix).bits >= pw.SECURITY_BITS[level]);
      }
    }
    assert.deepEqual(actual, counts, level);
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
  const formats = {
    camel: { true: /^([A-Z][a-z]+)+[!@#$%^&*]\d\d$/, false: /^([A-Z][a-z]+)+$/ },
    dashes: { true: /^[a-z]+(-[a-z]+)*-[!@#$%^&*]\d\d$/, false: /^[a-z]+(-[a-z]+)*$/ },
  };
  for (const method of ["syllables", "merged", "words"]) {
    for (const style of ["camel", "dashes"]) {
      for (const suffix of [true, false]) {
        for (const security of Object.keys(pw.SECURITY_BITS)) {
          const phrase = pw.generatePassphrase({ security, method, style, suffix }, words);
          assert.match(phrase, formats[style][suffix], `${method} ${style} ${suffix} ${security}`);
        }
      }
    }
  }
});

test("index.html is up to date and its script parses", () => {
  const html = build();
  assert.equal(fs.readFileSync(path.join(__dirname, "index.html"), "utf8"), html,
    "index.html is out of date: run node build.js");
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
