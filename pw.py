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
import secrets

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
    "", "", "",  # Empty options to allow open syllables (~30% probability)
    "b", "d", "f", "g", "k", "l", "m", "n", "p", "r", "s", "t", "x", "z",
    "nd", "nt", "mp", "st", "nk", "ft", "lt", "lp"
]

# Special characters widely accepted by password rules.
SPECIAL_CHARACTERS = ["!", "@", "#", "$", "%", "^", "&", "*"]

DIGITS = "0123456789"


def generate_syllable() -> str:
  """Generates a single lowercase phonetic syllable using uniform selection."""
  rng = secrets.SystemRandom()
  onset = rng.choice(ONSET_CONSONANTS)
  nucleus = rng.choice(NUCLEUS_VOWELS)
  coda = rng.choice(CODA_CONSONANTS)
  return onset + nucleus + coda


def generate_symbols() -> str:
  """Generates a special character followed by two digits (~9.6 bits)."""
  rng = secrets.SystemRandom()
  return rng.choice(SPECIAL_CHARACTERS) + rng.choice(DIGITS) + rng.choice(DIGITS)


def generate_passphrase(total_syllables: int = 4) -> str:
  """Generates a secure passphrase of syllables joined in CamelCase.

  The last syllable is replaced by a special character and two digits.
  """
  syllables = [generate_syllable().capitalize() for _ in range(total_syllables - 1)]
  return "".join(syllables) + generate_symbols()


def main():
  parser = argparse.ArgumentParser(
      description=(
          "Generate secure, memorable passphrases from English phoneme"
          " syllables joined in CamelCase, ending in a special character and"
          " two digits."
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
      type=str,
      choices=["low", "medium", "high", "paranoid"],
      default="high",
      help=(
          "Security level: low (~33 bits), medium (~44 bits), high (~55"
          " bits, default), paranoid (~66 bits)"
      ),
  )
  args = parser.parse_args()

  security_mapping = {
      "low": (3, "~33 bits"),
      "medium": (4, "~44 bits"),
      "high": (5, "~55 bits"),
      "paranoid": (6, "~66 bits"),
  }

  num_syllables, _ = security_mapping[args.security]

  for _ in range(args.count):
    print(generate_passphrase(num_syllables))


if __name__ == "__main__":
  main()
