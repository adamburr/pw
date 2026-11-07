#!/usr/bin/env python3
"""
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

For more information, please refer to <http://unlicense.org/>

The word list in words.txt is not covered by this dedication; see README.md.
"""

import argparse
import math
import secrets
import sys
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

# EFF's long wordlist without its four hyphenated words, one per line.
WORDS_FILE = Path(__file__).resolve().with_name("words.txt")

SYLLABLE_BITS = math.log2(
    len(ONSET_CONSONANTS) * len(NUCLEUS_VOWELS) * len(CODA_CONSONANTS)
)
SUFFIX_BITS = math.log2(len(SPECIAL_CHARACTERS) * len(DIGITS) ** 2)

# Minimum strength in bits for each security level.
SECURITY_BITS = {"low": 50, "medium": 64, "high": 77, "paranoid": 91}

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


def generate_syllable() -> str:
  """Generates a single lowercase phonetic syllable using uniform selection."""
  onset = _rng.choice(ONSET_CONSONANTS)
  nucleus = _rng.choice(NUCLEUS_VOWELS)
  coda = _rng.choice(CODA_CONSONANTS)
  return onset + nucleus + coda


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
  character and two digits are appended.
  """
  if style == "camel":
    phrase = "".join(p.capitalize() for p in parts)
  else:
    phrase = "-".join(parts)
  return phrase + (generate_symbols() if suffix else "")


def main():
  parser = argparse.ArgumentParser(
      description=(
          "Generate secure, memorable passphrases from English phoneme"
          " syllables or dictionary words, joined in CamelCase or with"
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
          "Minimum strength: low (50 bits, online accounts only), medium (64"
          " bits, default), high (77 bits), paranoid (91 bits)"
      ),
  )
  parser.add_argument(
      "-m",
      "--method",
      choices=["syllables", "words"],
      default="syllables",
      help=(
          "Build from made-up phoneme syllables (default) or words from the"
          " EFF long wordlist"
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
    make_part = lambda: _rng.choice(words)
  else:
    part_bits = SYLLABLE_BITS
    make_part = generate_syllable

  num_parts = parts_needed(SECURITY_BITS[args.security], part_bits, args.suffix)

  if args.verbose:
    bits = num_parts * part_bits + (SUFFIX_BITS if args.suffix else 0)
    unit = args.method if num_parts > 1 else args.method[:-1]
    ending = " + symbol and digits" if args.suffix else ""
    print(f"{num_parts} {unit}{ending}: ~{bits:.0f} bits", file=sys.stderr)

  for _ in range(args.count):
    parts = [make_part() for _ in range(num_parts)]
    print(generate_passphrase(parts, args.style, args.suffix))


if __name__ == "__main__":
  main()
