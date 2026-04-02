# @jetstreamapp/simple-xml

A minimal, zero-dependency XML parser and builder. Built as a lightweight replacement for `fast-xml-parser` when you only need simple XML parsing and building — no DTD, no schema validation, no streaming, no complex entity processing.

100% browser compatible. No Node.js APIs.

> Built with [Claude Code](https://claude.ai/claude-code)

## Why?

- **Zero dependencies** — nothing to audit, nothing to break
- **Tiny footprint** — ~300 lines of code total
- **Browser compatible** — works anywhere JavaScript runs
- **Fast-xml-parser compatible output** — same object shape, drop-in replacement for simple use cases

## Installation

```bash
npm install @jetstreamapp/simple-xml
```

## Quick Start

```typescript
import { parse, build } from '@jetstreamapp/simple-xml';

// Parse XML to a JavaScript object
const result = parse('<root><name>hello</name><count>42</count></root>');
// { root: { name: 'hello', count: 42 } }

// Build XML from a JavaScript object
const xml = build({ root: { name: 'hello', count: 42 } });
// '<root><name>hello</name><count>42</count></root>'
```

## API

### `parse(xml: string, options?: ParseOptions): Record<string, unknown>`

Parses an XML string into a JavaScript object.

```typescript
const result = parse(soapResponse, {
  trimValues: true,
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '@_',
  processEntities: false,
});
```

#### ParseOptions

| Option                | Type      | Default | Description                                              |
| --------------------- | --------- | ------- | -------------------------------------------------------- |
| `trimValues`          | `boolean` | `true`  | Trim whitespace from text content                        |
| `ignoreAttributes`    | `boolean` | `false` | Skip attributes entirely                                 |
| `removeNSPrefix`      | `boolean` | `false` | Strip namespace prefixes (`soap:Body` → `Body`)          |
| `attributeNamePrefix` | `string`  | `'@_'`  | Prefix prepended to attribute names in the output object |
| `parseTagValue`       | `boolean` | `true`  | Coerce numeric/boolean text values to their JS types     |
| `processEntities`     | `boolean` | `true`  | Decode XML entities (`&amp;` → `&`, `&lt;` → `<`, etc.)  |
| `maxDepth`            | `number`  | `256`   | Maximum nesting depth allowed. Throws if exceeded        |
| `strict`              | `boolean` | `false` | Throw on malformed XML (unclosed, mismatched, or extra closing tags) |

### `build(obj: Record<string, unknown>, options?: BuildOptions): string`

Builds an XML string from a JavaScript object.

```typescript
const xml = build(
  {
    Package: {
      '@xmlns': 'http://soap.sforce.com/2006/04/metadata',
      types: [{ members: ['MyClass', 'OtherClass'], name: 'ApexClass' }],
      version: '50.0',
    },
  },
  { format: true, ignoreAttributes: false, attributeNamePrefix: '@' },
);
```

#### BuildOptions

| Option                | Type      | Default | Description                                                |
| --------------------- | --------- | ------- | ---------------------------------------------------------- |
| `format`              | `boolean` | `false` | Pretty-print with indentation                              |
| `ignoreAttributes`    | `boolean` | `false` | Skip attributes when building XML                          |
| `attributeNamePrefix` | `string`  | `'@_'`  | Prefix used to identify attribute keys in the input object |
| `indentBy`            | `string`  | `'  '`  | Indentation string used when `format` is `true`            |

## Output Shape

The parser produces the same object shape as `fast-xml-parser`:

- **Single child element** → value directly on parent: `{ parent: { child: 'value' } }`
- **Multiple same-name children** → array: `{ parent: { item: ['a', 'b', 'c'] } }`
- **Attributes** → prefixed keys: `{ element: { '@_id': '1', '#text': 'content' } }`
- **Text-only leaf** → string/number/boolean value: `{ element: 'hello' }`
- **Empty/self-closing** → empty string: `{ element: '' }`

## Supported XML Features

- Elements, attributes, text content
- Namespace prefix stripping
- CDATA sections
- Comments (skipped)
- Processing instructions (skipped)
- Self-closing tags
- XML declaration (skipped)
- XML entities: named (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) and numeric (`&#123;`, `&#x7B;`)

## License

[MIT](LICENSE.txt)
