# pw

Generate secure, memorable passphrases from made-up English syllables or
dictionary words, joined in CamelCase or with dashes, and optionally ending in a
special character and two digits:

| Built from | CamelCase                               | Dashes                                      |
|------------|-----------------------------------------|---------------------------------------------|
| Syllables  | `BrasTooFlimpShayn#47`                  | `bras-too-flimp-shayn#47`                   |
| Words      | `CoastlineHappilyRoverClobberRemote#37` | `coastline-happily-rover-clobber-remote#37` |

The defaults are syllables, CamelCase, and the closing symbol and digits.

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
./pw.py                          # 20 passphrases at medium security
./pw.py -s paranoid -n 5         # 5 passphrases at paranoid security
./pw.py -m words                 # dictionary words instead of syllables
./pw.py -m words -t dashes       # lowercase words joined with dashes
./pw.py --no-suffix              # leave off the symbol and digits
./pw.py -m words -v              # also print the strength to stderr
```

Word mode reads `words.txt` from the same directory as `pw.py`.

Each security level sets a minimum strength, and pw uses as many syllables or
words as it takes to reach it:

| Level      | Minimum   | Syllables + suffix | Syllables     | Words + suffix | Words          |
|------------|-----------|--------------------|---------------|----------------|----------------|
| `low`¹     | 50 bits   | 3 (~51 bits)       | 4 (~55 bits)  | 4 (~61 bits)   | 4 (~52 bits)   |
| `medium`   | 64 bits   | 4 (~65 bits)       | 5 (~69 bits)  | 5 (~74 bits)   | 5 (~65 bits)   |
| `high`     | 77 bits   | 5 (~78 bits)       | 6 (~82 bits)  | 6 (~87 bits)   | 6 (~78 bits)   |
| `paranoid` | 91 bits   | 6 (~92 bits)       | 7 (~96 bits)  | 7 (~100 bits)  | 8 (~103 bits)  |

¹ Use `low` only for online accounts, where the site limits guessing. If a
site's password database leaks, ~50 bits can be cracked offline.

Each syllable is an onset consonant, a vowel, and an optional coda consonant.
Each word comes from [EFF's long wordlist](https://www.eff.org/dice), less its
four hyphenated words, leaving 7,772. Every choice is uniform from a
cryptographically secure RNG (`secrets` in Python, `crypto.getRandomValues` in
the browser). In CamelCase each part is capitalized; with dashes the parts stay
lowercase. The optional suffix is one of `!@#$%^&*` and two digits, so the
passphrase has the uppercase letter, digit and special character many sites
require. Without it, some sites will reject the passphrase.

Each syllable carries about 13.7 bits, each word about 12.9 bits, and the
closing symbol and digits about 9.6 bits, assuming an attacker knows exactly
how passphrases are generated. Picking a favorite from the list instead of the
first one can cost up to about 4 bits.

The web page (`index.html`) and the script (`pw.py`) share the same phoneme
lists, security levels and word list; keep them in sync when changing either.
The page carries its own copy of `words.txt`, because its
Content-Security-Policy blocks loading files. This prints `True` when the copies
match:

```sh
python3 -c 'import re;h=open("index.html").read();print(re.search(r"const WORDS = `(.*?)`",h,re.S)[1].split()==open("words.txt").read().split())'
```

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

Public domain — see [LICENSE](LICENSE) — except the word list. `words.txt`, and
the copy of it in `index.html`, is EFF's long wordlist, © Electronic Frontier
Foundation, used under
[CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/) with its four
hyphenated words removed.
