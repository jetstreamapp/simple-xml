# AGENTS.md

## Misc

Use conventional commit style messages.

## Releasing

Releases are cut from `main` by CI, kicked off from your terminal:

```sh
npm run release              # derive the version from CHANGELOG.md
npm run release -- --dry-run # show the plan, dispatch nothing
npm run release -- minor     # force a bump level (major | minor | patch)
npm run release -- 3.0.0     # force an explicit version
```

The bump is derived from the `[Unreleased]` section of `CHANGELOG.md` by
`scripts/derive-increment.mjs`, reading **section headings only** — never the entry text, so an
entry that merely mentions a breaking change cannot turn a patch into a major:

| `[Unreleased]` contains                                   | Bump  |
| --------------------------------------------------------- | ----- |
| `### Breaking Changes`                                    | major |
| `### Added` or `### Deprecated`                           | minor |
| `### Changed`, `### Removed`, `### Fixed`, `### Security` | patch |

**So keep `[Unreleased]` accurate — it decides the version.** Those seven headings are the whole
vocabulary; anything else is an error rather than a guess, because guessing risks publishing a
breaking change as a patch. Internal or tooling-only entries go under `### Changed`. An empty
`[Unreleased]` aborts the release. `npm run release:increment` shows the reasoning without
releasing.

The `Changelog` workflow enforces this on every pull request that touches published code: it fails
if `CHANGELOG.md` was not updated, and then fails again if `[Unreleased]` does not classify to a
bump — so a touched-but-empty section is caught too. Label a pull request `skip-changelog` to opt
out when a change genuinely needs no entry.

The script refuses to run unless you are on `main`, the working tree is clean, and your branch
matches `origin/main`. It then dispatches the `Release` workflow with the computed version and
tails the run. The bump, build and publish all happen on CI, so npm provenance (OIDC) is preserved
— running the release locally would lose it.

Release commits pass `--no-verify`: they are machine generated from already checked files, and a
hook failing mid-release would abort after the npm publish.

`scripts/derive-increment.mjs`, `scripts/release.mjs` and the `.github/workflows/release.yml` and
`changelog.yml` workflows are shared verbatim with
[sf-formula-parser](https://github.com/jetstreamapp/sf-formula-parser) and
[soql-parser-js](https://github.com/jetstreamapp/soql-parser-js) — keep the copies in sync when
changing them.
