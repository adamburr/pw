#!/usr/bin/env python3
"""
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

For more information, please refer to <http://unlicense.org/>
"""

import argparse
import math
import secrets
import sys
from collections import Counter
from pathlib import Path

# Curated lists of English phonemes / syllables
ONSET_CONSONANTS = [
    "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t",
    "v", "w", "y", "z", "ch", "sh", "th", "ph", "br", "bl", "cl", "cr", "dr",
    "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp",
    "st", "sw", "tr", "wh", "wr"
]

NUCLEUS_VOWELS = [
    "a", "e", "i", "o", "u", "ai", "ay", "ea", "ee", "oo", "ou", "oa"
]

# Including empty strings directly in the list allows uniform random selection
# while maintaining a balanced mix of open and closed syllables.
CODA_CONSONANTS = [
    "", "", "",  # Empty options to allow open syllables (3 of 25, 12% probability)
    "b", "d", "f", "g", "k", "l", "m", "n", "p", "r", "s", "t", "x", "z",
    "nd", "nt", "mp", "st", "nk", "ft", "lt", "lp"
]

# Special characters widely accepted by password rules.
SPECIAL_CHARACTERS = ["!", "@", "#", "$", "%", "^", "&", "*"]

DIGITS = "0123456789"

# Alan Beale's public-domain 12dicts 3esl list, limited to lowercase words of 3
# to 9 letters, one per line.
WORDS_FILE = Path(__file__).resolve().with_name("words.txt")

CODA_SET = set(CODA_CONSONANTS)


def entropy(items) -> float:
  """Shannon entropy in bits of a uniform choice from items.

  Repeated items (like the empty codas) count once, weighted by how often they
  appear, since they produce the same text.
  """
  counts = Counter(items).values()
  return -sum(c / len(items) * math.log2(c / len(items)) for c in counts)


# A syllable's text determines its onset, nucleus and coda, so their entropies add.
SYLLABLE_BITS = (
    entropy(ONSET_CONSONANTS) + entropy(NUCLEUS_VOWELS) + entropy(CODA_CONSONANTS)
)
SUFFIX_BITS = entropy(SPECIAL_CHARACTERS) + 2 * entropy(DIGITS)

# Minimum strength in bits for each security level.
SECURITY_BITS = {"low": 50, "medium": 63, "high": 77, "paranoid": 90}

_rng = secrets.SystemRandom()


def load_words() -> list[str]:
  """Loads the word list, checking it is distinct lowercase words."""
  try:
    words = WORDS_FILE.read_text(encoding="utf-8").split()
  except FileNotFoundError:
    sys.exit(f"pw: words.txt not found next to pw.py ({WORDS_FILE})")
  if len(set(words)) != len(words) or not all(
      w.isascii() and w.isalpha() and w.islower() for w in words
  ):
    sys.exit(f"pw: {WORDS_FILE} must hold distinct lowercase words")
  return words


def generate_syllable() -> tuple[str, str, str]:
  """Generates a lowercase phonetic syllable as (onset, nucleus, coda)."""
  onset = _rng.choice(ONSET_CONSONANTS)
  nucleus = _rng.choice(NUCLEUS_VOWELS)
  coda = _rng.choice(CODA_CONSONANTS)
  return onset, nucleus, coda


def is_syllable(text: str) -> bool:
  """Returns whether text is exactly one onset, nucleus and coda."""
  for onset in ONSET_CONSONANTS:
    if text.startswith(onset):
      rest = text[len(onset):]
      for nucleus in NUCLEUS_VOWELS:
        if rest.startswith(nucleus) and rest[len(nucleus):] in CODA_SET:
          return True
  return False


def can_merge(first: tuple[str, str, str], second: tuple[str, str, str]) -> bool:
  """Returns whether two syllables read well, and unambiguously, as one word.

  The consonants where they meet must be easy to say: after an open syllable
  the next must not start with w or y, which would blend into the vowel. After
  a closed one the next must not start with h, which would read as ch, sh, th
  or ph, or with w or y, and at most two consonants can meet, or three after a
  single l, m, n, r or s, which flow into the next (al-bree, ban-stoo). The word must also split back into the same
  two syllables when its second syllable takes as many consonants as it can,
  the way readers naturally break it up (ba-stoo, not bas-too). Every merged
  word then has exactly one reading, so merging never weakens a passphrase.
  """
  coda, onset = first[2], second[0]
  if coda:
    flowing = coda in ("l", "m", "n", "r", "s")
    if len(coda) + len(onset) > (3 if flowing else 2) or onset[0] in "hwy":
      return False
  elif onset[0] in "wy":
    return False
  word = "".join(first + second)
  return not any(
      is_syllable(word[:i]) and is_syllable(word[i:])
      for i in range(1, len("".join(first)))
  )


def merge_syllables(syllables: list[tuple[str, str, str]]) -> list[str]:
  """Joins neighboring syllables into two-syllable words where can_merge allows."""
  words, i = [], 0
  while i < len(syllables):
    if i + 1 < len(syllables) and can_merge(syllables[i], syllables[i + 1]):
      words.append("".join(syllables[i] + syllables[i + 1]))
      i += 2
    else:
      words.append("".join(syllables[i]))
      i += 1
  return words


def generate_symbols() -> str:
  """Generates a special character followed by two digits (~9.6 bits)."""
  return (
      _rng.choice(SPECIAL_CHARACTERS) + _rng.choice(DIGITS) + _rng.choice(DIGITS)
  )


def parts_needed(min_bits: float, part_bits: float, suffix: bool) -> int:
  """Returns how many syllables or words reach min_bits."""
  remaining = min_bits - (SUFFIX_BITS if suffix else 0)
  return max(1, math.ceil(remaining / part_bits))


def generate_passphrase(
    parts: list[str], style: str = "camel", suffix: bool = True
) -> str:
  """Joins lowercase syllables or words into a passphrase.

  style is "camel" (capitalized and joined, like BrasTooFlimp) or "dashes"
  (lowercase joined with hyphens, like bras-too-flimp). With suffix, a special
  character and two digits are appended, after a dash in the dashes style.
  """
  if suffix:
    parts = parts + [generate_symbols()]
  if style == "camel":
    return "".join(p.capitalize() for p in parts)
  return "-".join(parts)


def main():
  parser = argparse.ArgumentParser(
      description=(
          "Generate secure, memorable passphrases from English phoneme"
          " syllables, made-up two-syllable words or dictionary words, joined"
          " in CamelCase or with"
          " dashes, optionally ending in a special character and two digits."
      )
  )
  parser.add_argument(
      "-n",
      "--count",
      type=int,
      default=20,
      help="Number of passphrases to generate (default: 20)",
  )
  parser.add_argument(
      "-s",
      "--security",
      choices=list(SECURITY_BITS),
      default="medium",
      help=(
          "Minimum strength: low (50 bits, online accounts only), medium (63"
          " bits, default), high (77 bits), paranoid (90 bits)"
      ),
  )
  parser.add_argument(
      "-m",
      "--method",
      choices=["syllables", "merged", "words"],
      default="syllables",
      help=(
          "Build from phoneme syllables (default), syllables merged into"
          " two-syllable words where they're easy to say, or common English"
          " words"
      ),
  )
  parser.add_argument(
      "-t",
      "--style",
      choices=["camel", "dashes"],
      default="camel",
      help="CamelCase (default) or lowercase joined with dashes",
  )
  parser.add_argument(
      "--no-suffix",
      dest="suffix",
      action="store_false",
      help="Leave off the closing special character and two digits",
  )
  parser.add_argument(
      "-v",
      "--verbose",
      action="store_true",
      help="Print the passphrase strength to standard error",
  )
  args = parser.parse_args()

  if args.method == "words":
    words = load_words()
    part_bits = math.log2(len(words))
  else:
    part_bits = SYLLABLE_BITS

  num_parts = parts_needed(SECURITY_BITS[args.security], part_bits, args.suffix)

  if args.verbose:
    bits = num_parts * part_bits + (SUFFIX_BITS if args.suffix else 0)
    unit = "word" if args.method == "words" else "syllable"
    unit += "s" if num_parts > 1 else ""
    ending = " + symbol and digits" if args.suffix else ""
    print(f"{num_parts} {unit}{ending}: ~{bits:.0f} bits", file=sys.stderr)

  for _ in range(args.count):
    if args.method == "words":
      parts = [_rng.choice(words) for _ in range(num_parts)]
    else:
      syllables = [generate_syllable() for _ in range(num_parts)]
      if args.method == "merged":
        parts = merge_syllables(syllables)
      else:
        parts = ["".join(s) for s in syllables]
    print(generate_passphrase(parts, args.style, args.suffix))


if __name__ == "__main__":
  main()
