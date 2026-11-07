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

The hosted page is built from the source on `main` and published by the
[Test and deploy](.github/workflows/pages.yml) workflow. See the
[README](README.md) for how to build it yourself, check the live page against
your build, or run it offline.
