# pw

Generate secure, memorable passphrases from dictionary words, or from phonetic
words made of English syllables, joined with dashes or in CamelCase, and
optionally ending in special characters, digits, or both:

| Words      | Dashes (default)                   | CamelCase with symbol and digits |
|------------|------------------------------------|----------------------------------|
| Dictionary | `bitter-linear-fix-secondly-orbit` | `BitterLinearFixSecondly&395`    |
| Phonetic   | `brastoo-flimp-shayn-wex`          | `BrastooFlimpShayn#478`          |

The defaults are dictionary words, lowercase with dashes, and no ending.

**Web:** https://adamburr.github.io/pw/ — runs entirely in your browser using
`crypto.getRandomValues`; nothing is sent over the network. The page's
Content-Security-Policy blocks every fetch, image, font and connection and
allows only the page's own inline script and style, pinned by hash, so the
browser enforces this. It can't stop a tampered copy of the page that drops the
policy, so if you'd rather not trust the hosted page, build it from the source
yourself and compare, or run your own build. You need
[Node.js](https://nodejs.org/) 18 or later:

```sh
git clone https://github.com/adamburr/pw && cd pw && node build.js
```

```sh
# The two hashes match when the live page is exactly the source on main
shasum -a 256 index.html
curl -s https://adamburr.github.io/pw/ | shasum -a 256
```

The page is published from `main` by the
[Test and deploy](.github/workflows/pages.yml) workflow, so allow a minute or
two after a push, and the log of each run prints the hash it published.
`index.html` is a single self-contained file, so you can also open your build
from disk; it works offline.

Copied passphrases stay on the clipboard, and in clipboard history or sync if
your system keeps them, until you copy something else.

## Command line

The command line runs the same code as the page, with
[Node.js](https://nodejs.org/) 18 or later and no dependencies:

```sh
./pw.js                          # 20 passphrases at medium security
./pw.js -s paranoid -n 5         # 5 passphrases at paranoid security
./pw.js -m phonetic              # phonetic words instead of dictionary words
./pw.js -t camel                 # CamelCase instead of dashes
./pw.js --symbol                 # end with special characters
./pw.js --digits                 # end with digits
./pw.js -t camel --suffix        # end with both, same as --symbol --digits
./pw.js -m phonetic -v           # also print the strength to stderr
```

Dictionary mode reads `words.txt` from the same directory as `pw.js`. On Windows, run
`node pw.js` instead of `./pw.js`.

Each security level sets a minimum strength, and pw uses as many dictionary
words or syllables (for phonetic words) as it takes to reach it:

| Level      | Minimum | Dictionary   | Dictionary + ending | Phonetic     | Phonetic + ending |
|------------|---------|--------------|---------------------|--------------|-------------------|
| `low`¹     | 50 bits | 4 (~55 bits) | 3 (~54–57 bits)     | 4 (~54 bits) | 3 (~54–56 bits)   |
| `medium`   | 63 bits | 5 (~69 bits) | 4 (~68–70 bits)     | 5 (~68 bits) | 4 (~67–69 bits)   |
| `high`     | 77 bits | 6 (~83 bits) | 5 (~82–84 bits)     | 6 (~81 bits) | 5 (~81–83 bits)   |
| `paranoid` | 90 bits | 7 (~97 bits) | 6 (~96–98 bits)     | 7 (~95 bits) | 6 (~94–96 bits)   |

An ending carries about as much as one word or syllable, so it takes the place
of one:

| Ending              | Example | Strength   |
|---------------------|---------|------------|
| Symbols only        | `#&!*^` | 15 bits    |
| Digits only         | `4071`  | ~13.3 bits |
| Symbols and digits  | `&395`  | ~13 bits   |

¹ Use `low` only for online accounts, where the site limits guessing. If a
site's password database leaks, ~50 bits can be cracked offline.

Phonetic words are built from syllables, each an onset consonant, a vowel, and
an optional coda consonant. Each dictionary word comes from the `3esl` list in Alan Beale's
[12dicts](http://wordlist.aspell.net/12dicts/) (words found in at least three
of five learner's dictionaries), limited to the 14,631 lowercase words of 3 to 9
letters. Every choice is uniform from a cryptographically secure RNG
(`crypto.getRandomValues`). With dashes the parts stay lowercase; in CamelCase
each part is capitalized. The optional ending is some of `!@#$%^&*`, some
digits, or both, in that order; pw picks how many of each so the ending is as
close as it can get to the strength of one word or syllable. Some sites require an uppercase letter, a digit
and a special character; for those, use CamelCase with both.

Neighboring syllables are joined into two-syllable phonetic words where they're
easy to say together: an open syllable is followed by anything but `w` or `y`, and a
closed one meets the next with at most two consonants (three after `l`, `m`,
`n`, `r` or `s`) and no `h`, `w` or `y`. A pair is also joined only if a reader
splitting the word naturally, giving the second syllable as many consonants as
it can take, gets back the same two syllables (`ba`+`stoo` becomes `bastoo`,
but `bas`+`too` stays apart). So every passphrase has exactly one reading, and
joining syllables never weakens it. About 40% of neighboring pairs join; the
rest stay one-syllable words.

Each syllable carries about 13.5 bits, each dictionary word about 13.8 bits,
each closing symbol 3 bits and each digit about 3.3 bits, assuming an attacker
knows exactly how passphrases are generated. The three empty codas produce the same text, so
they count as one more likely choice rather than three. Picking a favorite from
a list of N instead of the first one can cost up to log₂ N bits, about 4.3 bits
for the default 20; the page shows what's left for the count you choose.

## Development

All of the generator lives in `pw.js`, which is both the command line and the
heart of the web page. `index.html` is built rather than committed:

| File            | Contents                                                  |
|-----------------|-----------------------------------------------------------|
| `pw.js`         | Phoneme lists, security levels, merge rules, generation, and the command line |
| `words.txt`     | The word list, one word per line                          |
| `web/page.html` | The page's HTML and CSS                                   |
| `web/page.js`   | The page's controls                                       |
| `build.js`      | Builds `index.html` from the four files above             |
| `test.js`       | Tests                                                     |

To try a change, rebuild the page and open `index.html`, and run the tests:

```sh
node build.js
```

```sh
node --test
```

The page's Content-Security-Policy blocks loading files and pins its inline
`<script>` and `<style>` by SHA-256, so `build.js` copies `pw.js`, `words.txt`
and `web/page.js` into one inline script and fills in both hashes.

On every push and pull request, the [Test and deploy](.github/workflows/pages.yml)
workflow runs the tests and builds the page; on `main` it then publishes the
page to GitHub Pages, so nothing needs rebuilding by hand. This needs the
repository's Pages source set to GitHub Actions (Settings → Pages → Build and
deployment → Source).

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

Public domain — see [LICENSE](LICENSE). The word list comes from Alan Beale's
12dicts, which he released to the public domain, asking only for
acknowledgment.
