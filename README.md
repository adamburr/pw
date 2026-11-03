# pw

Generate secure, memorable passphrases from English phoneme syllables joined
in CamelCase, like `BrasTooFlimpShaynKor`.

**Web:** https://adamburr.github.io/pw/ — runs entirely in your browser using
`crypto.getRandomValues`; nothing is sent over the network.

## Command line

```sh
./pw.py                    # 20 passphrases at high security
./pw.py -s paranoid -n 5   # 5 passphrases at paranoid security
```

| Level      | Syllables | Strength   |
|------------|-----------|------------|
| `low`      | 3         | ~33 bits   |
| `medium`   | 4         | ~44 bits   |
| `high`     | 5         | ~55 bits   |
| `paranoid` | 6         | ~66 bits   |

Each syllable is an onset consonant, a vowel, and an optional coda consonant,
chosen uniformly with a cryptographically secure RNG (`secrets` in Python,
`crypto.getRandomValues` in the browser). Each syllable is capitalized and
the syllables are joined in CamelCase.

The web page (`index.html`) and the script (`pw.py`) share the same phoneme
lists; keep them in sync when changing either.

## License

Public domain — see [LICENSE](LICENSE).
