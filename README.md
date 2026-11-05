# pw

Generate secure, memorable passphrases from English phoneme syllables joined
in CamelCase and ending in a special character and two digits, like
`BrasTooFlimpShayn#47`.

**Web:** https://adamburr.github.io/pw/ — runs entirely in your browser using
`crypto.getRandomValues`; nothing is sent over the network. The page's
Content-Security-Policy blocks every fetch, image, font and connection and
allows only the page's own inline script and style, pinned by hash, so the
browser enforces this. It can't stop a tampered copy of the page that drops the
policy, so if you'd rather not trust the hosted page, check it against the
source or run it yourself:

```sh
# The two hashes match when the live page is exactly the source on main
curl -s https://adamburr.github.io/pw/ | shasum -a 256
curl -s https://raw.githubusercontent.com/adamburr/pw/main/index.html | shasum -a 256
```

`index.html` is a single self-contained file, so you can also download it and
open it from disk; it works offline.

Copied passphrases stay on the clipboard, and in clipboard history or sync if
your system keeps them, until you copy something else.

## Command line

```sh
./pw.py                    # 20 passphrases at medium security
./pw.py -s paranoid -n 5   # 5 passphrases at paranoid security
```

| Level      | Syllables + symbol and digits | Strength   |
|------------|-------------------------------|------------|
| `low`¹     | 3 + 1                         | ~50 bits   |
| `medium`   | 4 + 1                         | ~64 bits   |
| `high`     | 5 + 1                         | ~77 bits   |
| `paranoid` | 6 + 1                         | ~91 bits   |

¹ Use `low` only for online accounts, where the site limits guessing. If a
site's password database leaks, ~50 bits can be cracked offline.

Each syllable is an onset consonant, a vowel, and an optional coda consonant,
chosen uniformly with a cryptographically secure RNG (`secrets` in Python,
`crypto.getRandomValues` in the browser). The syllables are capitalized and
joined in CamelCase, and the last one is replaced by one of `!@#$%^&*` and two
digits, so every passphrase has the uppercase letter, digit and special
character many sites require.

Each syllable carries about 13.7 bits and the closing symbol and digits about
9.6 bits, assuming an attacker knows exactly how passphrases are generated.
Picking a favorite from the list instead of the first one can cost up to about
4 bits.

The web page (`index.html`) and the script (`pw.py`) share the same phoneme
lists; keep them in sync when changing either.

The page's Content-Security-Policy pins its inline `<script>` and `<style>` by
SHA-256, so after editing either one, print the new hashes and paste them into
the policy (the browser console also reports the expected hash when one is
blocked):

```sh
python3 -c 'import re,hashlib,base64;h=open("index.html").read();[print(t,base64.b64encode(hashlib.sha256(b.encode()).digest()).decode()) for t in ("script","style") for b in re.findall(f"<{t}>(.*?)</{t}>",h,re.S)]'
```

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

Public domain — see [LICENSE](LICENSE).
