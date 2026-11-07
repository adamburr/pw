#!/usr/bin/env node
/*
 * This is free and unencumbered software released into the public domain.
 *
 * Anyone is free to copy, modify, publish, use, compile, sell, or
 * distribute this software, either in source code form or as a compiled
 * binary, for any purpose, commercial or non-commercial, and by any
 * means.
 *
 * For more information, please refer to <http://unlicense.org/>
 */

// The passphrase generator, shared by the command line (run this file with Node)
// and the web page (build.js copies it into index.html).

"use strict";

// Curated lists of English phonemes / syllables
const ONSET_CONSONANTS = [
  "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t",
  "v", "w", "y", "z", "ch", "sh", "th", "ph", "br", "bl", "cl", "cr", "dr",
  "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp",
  "st", "sw", "tr", "wh", "wr"
];

const NUCLEUS_VOWELS = [
  "a", "e", "i", "o", "u", "ai", "ay", "ea", "ee", "oo", "ou", "oa"
];

// Including empty strings directly in the list allows uniform random selection
// while maintaining a balanced mix of open and closed syllables.
const CODA_CONSONANTS = [
  "", "", "",  // Empty options to allow open syllables (3 of 25, 12% probability)
  "b", "d", "f", "g", "k", "l", "m", "n", "p", "r", "s", "t", "x", "z",
  "nd", "nt", "mp", "st", "nk", "ft", "lt", "lp"
];

// Special characters widely accepted by password rules.
const SPECIAL_CHARACTERS = ["!", "@", "#", "$", "%", "^", "&", "*"];

const DIGITS = "0123456789";

// Minimum strength in bits for each security level.
const SECURITY_BITS = { low: 50, medium: 63, high: 77, paranoid: 90 };

const CODA_SET = new Set(CODA_CONSONANTS);

// Shannon entropy in bits of a uniform choice from items. Repeated items (like
// the empty codas) count once, weighted by how often they appear, since they
// produce the same text.
function entropy(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  let bits = 0;
  for (const c of counts.values()) bits -= (c / items.length) * Math.log2(c / items.length);
  return bits;
}

// A syllable's text determines its onset, nucleus and coda, so their entropies add.
const SYLLABLE_BITS = entropy(ONSET_CONSONANTS) + entropy(NUCLEUS_VOWELS) + entropy(CODA_CONSONANTS);
const SUFFIX_BITS = entropy(SPECIAL_CHARACTERS) + 2 * entropy([...DIGITS]);

// Uniform integer in [0, n) from the CSPRNG, using rejection sampling to avoid modulo bias.
function randomBelow(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % n;
}

function choice(list) {
  return list[randomBelow(list.length)];
}

// A lowercase phonetic syllable as [onset, nucleus, coda].
function generateSyllable() {
  return [choice(ONSET_CONSONANTS), choice(NUCLEUS_VOWELS), choice(CODA_CONSONANTS)];
}

// A special character followed by two digits (~9.6 bits).
function generateSymbols() {
  return choice(SPECIAL_CHARACTERS) + choice(DIGITS) + choice(DIGITS);
}

// Whether text is exactly one onset, nucleus and coda.
function isSyllable(text) {
  return ONSET_CONSONANTS.some((onset) => text.startsWith(onset) &&
    NUCLEUS_VOWELS.some((nucleus) => text.startsWith(nucleus, onset.length) &&
      CODA_SET.has(text.slice(onset.length + nucleus.length))));
}

// Whether two syllables read well, and unambiguously, as one word.
//
// The consonants where they meet must be easy to say: after an open syllable
// the next must not start with w or y, which would blend into the vowel. After a
// closed one the next must not start with h, which would read as ch, sh, th or
// ph, or with w or y, and at most two consonants can meet, or three after a
// single l, m, n, r or s, which flow into the next (al-bree, ban-stoo). The word
// must also split back into the same two syllables when its second syllable
// takes as many consonants as it can, the way readers naturally break it up
// (ba-stoo, not bas-too). Every merged word then has exactly one reading, so
// merging never weakens a passphrase.
function canMerge(first, second) {
  const coda = first[2], onset = second[0];
  if (coda) {
    const flowing = ["l", "m", "n", "r", "s"].includes(coda);
    if (coda.length + onset.length > (flowing ? 3 : 2) || "hwy".includes(onset[0])) return false;
  } else if ("wy".includes(onset[0])) {
    return false;
  }
  const firstText = first.join("");
  const word = firstText + second.join("");
  for (let i = 1; i < firstText.length; i++) {
    if (isSyllable(word.slice(0, i)) && isSyllable(word.slice(i))) return false;
  }
  return true;
}

// Joins neighboring syllables into two-syllable words where canMerge allows.
function mergeSyllables(syllables) {
  const words = [];
  for (let i = 0; i < syllables.length; i++) {
    if (i + 1 < syllables.length && canMerge(syllables[i], syllables[i + 1])) {
      words.push(syllables[i].join("") + syllables[i + 1].join(""));
      i++;
    } else {
      words.push(syllables[i].join(""));
    }
  }
  return words;
}

// Whether a word list is safe to join: distinct words of lowercase letters, so
// CamelCase and dashes always mark where each word starts.
function isValidWordList(words) {
  return words.length > 1 && new Set(words).size === words.length &&
    words.every((w) => /^[a-z]+$/.test(w));
}

// What a passphrase is built from, given the method ("fantasy" or "words") and
// the word list: the bits each part carries and the parts' name.
function partInfo(method, words) {
  return method === "words"
    ? { bits: entropy(words), unit: "word" }
    : { bits: SYLLABLE_BITS, unit: "syllable" };
}

// How many syllables or words reach minBits.
function partsNeeded(minBits, partBits, suffix) {
  return Math.max(1, Math.ceil((minBits - (suffix ? SUFFIX_BITS : 0)) / partBits));
}

// The strength in bits of n parts, and a description like
// "4 syllables + symbol and digits: ~64 bits".
function describeStrength(n, info, suffix) {
  const bits = n * info.bits + (suffix ? SUFFIX_BITS : 0);
  const text = `${n} ${info.unit}${n > 1 ? "s" : ""}${suffix ? " + symbol and digits" : ""}: ~${Math.round(bits)} bits`;
  return { bits, text };
}

// Generates lowercase parts from n syllables or words: fantasy words (syllables,
// merged into two-syllable words where they read well) or words from the list.
function generateParts(method, n, words) {
  if (method === "words") return Array.from({ length: n }, () => choice(words));
  return mergeSyllables(Array.from({ length: n }, generateSyllable));
}

// Joins lowercase parts in CamelCase ("camel", like BrastooFlimp) or with dashes
// ("dashes", like brastoo-flimp), optionally appending a special character and
// two digits (after a dash in the dashes style).
function joinPassphrase(parts, style, suffix) {
  if (suffix) parts = [...parts, generateSymbols()];
  return style === "camel"
    ? parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")
    : parts.join("-");
}

// Generates one passphrase. options: security, method, style and suffix, as on
// the command line; words is the word list, needed only for the words method.
function generatePassphrase(options, words) {
  const info = partInfo(options.method, words);
  const n = partsNeeded(SECURITY_BITS[options.security], info.bits, options.suffix);
  return joinPassphrase(generateParts(options.method, n, words), options.style, options.suffix);
}

// ---------------------------------------------------------------------------
// Command line. The web page includes this too but never runs it.

const USAGE = `Usage: pw.js [options]

Generate secure, memorable passphrases from fantasy words made of English
syllables, or from dictionary words, joined in CamelCase or with dashes,
optionally ending in a special character and two digits.

Options:
  -n, --count N        Number of passphrases to generate (default: 20)
  -s, --security LVL   Minimum strength: low (50 bits, online accounts only),
                       medium (63 bits, default), high (77 bits),
                       paranoid (90 bits)
  -m, --method M       fantasy (default), made-up words of one or two
                       syllables; or words, common English words from words.txt
  -t, --style S        dashes (default), lowercase joined with dashes; or camel
      --suffix         End with a special character and two digits
  -v, --verbose        Print the passphrase strength to standard error
  -h, --help           Show this help
`;

function main(argv) {
  const { parseArgs } = require("node:util");
  const fs = require("node:fs");
  const path = require("node:path");

  const fail = (message) => {
    process.stderr.write(`pw: ${message} (see --help)\n`);
    process.exit(2);
  };
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        count: { type: "string", short: "n", default: "20" },
        security: { type: "string", short: "s", default: "medium" },
        method: { type: "string", short: "m", default: "fantasy" },
        style: { type: "string", short: "t", default: "dashes" },
        suffix: { type: "boolean", default: false },
        verbose: { type: "boolean", short: "v", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }));
  } catch (e) {
    fail(e.message);
  }
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 0) fail(`--count must be a whole number, not ${values.count}`);
  const oneOf = (name, value, allowed) => {
    if (!allowed.includes(value)) fail(`--${name} must be one of ${allowed.join(", ")}, not ${value}`);
  };
  oneOf("security", values.security, Object.keys(SECURITY_BITS));
  oneOf("method", values.method, ["fantasy", "words"]);
  oneOf("style", values.style, ["camel", "dashes"]);

  let words = [];
  if (values.method === "words") {
    const file = path.join(__dirname, "words.txt");
    try {
      words = fs.readFileSync(file, "utf8").split(/\s+/).filter(Boolean);
    } catch {
      fail(`words.txt not found next to pw.js (${file})`);
    }
    if (!isValidWordList(words)) fail(`${file} must hold distinct lowercase words`);
  }

  const options = values;
  if (values.verbose) {
    const info = partInfo(options.method, words);
    const n = partsNeeded(SECURITY_BITS[options.security], info.bits, options.suffix);
    process.stderr.write(describeStrength(n, info, options.suffix).text + "\n");
  }
  for (let i = 0; i < count; i++) {
    process.stdout.write(generatePassphrase(options, words) + "\n");
  }
}

if (typeof module !== "undefined" && typeof require !== "undefined") {
  // Node 18 has no global crypto.
  if (!globalThis.crypto) globalThis.crypto = require("node:crypto").webcrypto;
  module.exports = {
    ONSET_CONSONANTS, NUCLEUS_VOWELS, CODA_CONSONANTS, SPECIAL_CHARACTERS, DIGITS,
    SECURITY_BITS, SYLLABLE_BITS, SUFFIX_BITS, entropy, isSyllable, canMerge,
    mergeSyllables, isValidWordList, partInfo, partsNeeded, describeStrength,
    generateSyllable, generateParts, joinPassphrase, generatePassphrase,
  };
  if (require.main === module) main(process.argv.slice(2));
}
