# pw

Generate secure, memorable passphrases from English phoneme syllables joined
in CamelCase and ending in a special character and two digits, like
`BrasTooFlimpShayn#47`.

**Web:** https://adamburr.github.io/pw/ — runs entirely in your browser using
`crypto.getRandomValues`; nothing is sent over the network. The page's
Content-Security-Policy blocks all network requests, so the browser enforces
this.

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
`crypto.getRandomValues` in the browser). The syllables are capitalized and
joined in CamelCase, and the last one is replaced by one of `!@#$%^&*` and two
digits, so every passphrase has the uppercase letter, digit and special
character many sites require.

The strengths above are conservative: each syllable carries about 13.5 bits
and the closing symbol and digits about 9.6 bits, giving roughly 37, 50, 64
and 77 bits for the four levels.

The web page (`index.html`) and the script (`pw.py`) share the same phoneme
lists; keep them in sync when changing either.

## License

Public domain — see [LICENSE](LICENSE).
