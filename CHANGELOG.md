# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

[Unreleased]: https://github.com/jetstreamapp/simple-xml/compare/1.1.0...HEAD
[1.1.0]: https://github.com/jetstreamapp/simple-xml/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/jetstreamapp/simple-xml/releases/tag/1.0.0
