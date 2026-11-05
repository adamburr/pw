# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/adamburr/pw/security/advisories/new)
rather than in a public issue.

Useful reports include anything that could weaken generated passphrases (biased
or predictable randomness, entropy estimates that are wrong), let the web page
send data anywhere, or let someone change what https://adamburr.github.io/pw/
serves.

## Verifying the web page

The hosted page is built from `index.html` on `main`. See the
[README](README.md) for how to check the live page against the source or run it
offline.
