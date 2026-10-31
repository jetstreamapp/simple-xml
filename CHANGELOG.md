# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.2.1] - 2026-10-31

### Fixed

- **`parse()` no longer takes quadratic time on a tag with a long run of name characters and no
  `=`.** The attribute regex retried from every offset in the run, so a ~100 KB tag could block the
  event loop for tens of seconds. Attributes are now read with a single linear scan that accepts
  exactly the same `name = "value"` / `name = 'value'` pairs
- **`parse()` no longer re-decodes accumulated text at every `<`.** Text interrupted by many
  comments, processing instructions, CDATA sections or child tags was re-trimmed and re-decoded
  each time, quadratic in the text length. Only the new text is processed now. This also fixes
  double decoding: `<a>&amp;lt;<!---->x</a>` now yields `&lt;x`, as it already did without the
  comment, rather than `<x`
- **Element and attribute names such as `__proto__`, `constructor` and `toString` are stored as
  ordinary own properties.** Previously `parse()` swapped the result's prototype for `__proto__`,
  dropped its value, or wrapped the inherited `constructor` or `toString` in an array, which could
  make consumers throw or misbehave. Duplicate detection now checks own properties only

### Changed

- **Replaced Prettier with [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) and added
  [oxlint](https://oxc.rs/docs/guide/usage/linter) as the project linter**, matching
  sf-formula-parser, soql-parser-js and simple-excel. Settings live in `.oxfmtrc.json` and
  `.oxlintrc.json`, with `npm run format`, `format:check`, `lint` and `lint:fix`. oxlint runs the
  `correctness`, `suspicious` and `perf` categories as errors
- **The `pre-commit` hook blocks a commit unless the whole codebase, as staged, is formatted and
  passes lint.** `npm install` wires it up by pointing `core.hooksPath` at `.githooks/`. Emergency
  bypass: `git commit --no-verify`
- **CI now gates on `format:check` and `lint`**, since the pre-commit hook can be bypassed
- Internal cleanups surfaced by oxlint, with no behaviour change: `addChild` moved to module scope
  so it is no longer recreated on every `parse()` call, and `parseAttributes` dropped a `coerce`
  parameter left unused since attribute values stopped being coerced in 1.1.0

## [1.2.0] - 2026-09-30

### Added

- `declaration` build option to prepend the `<?xml version="1.0" encoding="UTF-8"?>` declaration

## [1.1.1] - 2026-04-02

### Added

- Numeric XML entity support (`&#123;`, `&#x7B;`) in parser and attribute values
- Edge case resilience: extra closing tags no longer crash in non-strict mode
- Strict mode now throws on unexpected extra closing tags

### Fixed

- `String.fromCodePoint` crash on invalid numeric entities (e.g. `&#99999999999;`) — now falls back to raw text

## [1.1.0] - 2026-04-02

### Added

- `maxDepth` option to prevent OOM from deeply nested XML (default: 256)
- `strict` mode that throws on unclosed or mismatched tags
- Explicit `<!DOCTYPE>` skipping, including internal subsets

### Changed

- Attribute values are no longer coerced to numbers/booleans (always strings, matching XML spec and fast-xml-parser)
- `removeNSPrefix` now strips `xmlns` and `xmlns:*` declarations from output
- Builder: empty string produces open/close tags, `null` produces self-closing tags

### Fixed

- Text accumulation performance: scan ahead to next `<` instead of char-by-char append

## [1.0.0] - 2026-04-02

### Added

- XML parser with configurable options (trimValues, ignoreAttributes, removeNSPrefix, attributeNamePrefix, parseTagValue, processEntities)
- XML builder with configurable options (format, ignoreAttributes, attributeNamePrefix, indentBy)
- Full support for CDATA sections, comments, processing instructions, and self-closing tags
- Zero runtime dependencies
- 100% browser compatible

[Unreleased]: https://github.com/jetstreamapp/simple-xml/compare/1.2.1...HEAD
[1.2.1]: https://github.com/jetstreamapp/simple-xml/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/jetstreamapp/simple-xml/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/jetstreamapp/simple-xml/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/jetstreamapp/simple-xml/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/jetstreamapp/simple-xml/releases/tag/1.0.0
