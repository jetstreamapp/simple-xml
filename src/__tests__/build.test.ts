import { describe, it, expect } from 'vitest';
import { build } from '../build.js';
import { parse } from '../parse.js';

describe('build', () => {
  describe('basic building', () => {
    it('builds a simple element', () => {
      expect(build({ root: 'hello' })).toBe('<root>hello</root>');
    });

    it('builds nested elements', () => {
      expect(build({ root: { child: 'value' } })).toBe('<root><child>value</child></root>');
    });

    it('builds deeply nested elements', () => {
      expect(build({ a: { b: { c: 'deep' } } })).toBe('<a><b><c>deep</c></b></a>');
    });

    it('builds arrays as repeated elements', () => {
      expect(build({ root: { item: ['a', 'b', 'c'] } })).toBe('<root><item>a</item><item>b</item><item>c</item></root>');
    });

    it('builds empty string as open/close tags', () => {
      expect(build({ root: { empty: '' } })).toBe('<root><empty></empty></root>');
    });

    it('builds null as self-closing tag', () => {
      expect(build({ root: { nullField: null, version: '1.0' } })).toBe('<root><nullField/><version>1.0</version></root>');
    });

    it('skips undefined values', () => {
      expect(build({ root: { undef: undefined, kept: 'val' } })).toBe('<root><kept>val</kept></root>');
    });

    it('builds numeric values', () => {
      expect(build({ root: { num: 42 } })).toBe('<root><num>42</num></root>');
    });

    it('builds boolean values', () => {
      expect(build({ root: { flag: true } })).toBe('<root><flag>true</flag></root>');
    });
  });

  describe('attributes', () => {
    it('builds attributes with default prefix', () => {
      expect(build({ root: { '@_id': '1', child: 'val' } })).toBe('<root id="1"><child>val</child></root>');
    });

    it('builds attributes with custom prefix', () => {
      expect(build({ root: { '@id': '1', child: 'val' } }, { attributeNamePrefix: '@' })).toBe('<root id="1"><child>val</child></root>');
    });

    it('ignores attributes when ignoreAttributes is true', () => {
      expect(build({ root: { '@_id': '1', child: 'val' } }, { ignoreAttributes: true })).toBe('<root><child>val</child></root>');
    });

    it('builds #text content alongside attributes', () => {
      expect(build({ root: { '@_id': '1', '#text': 'hello' } })).toBe('<root id="1">hello</root>');
    });
  });

  describe('pretty printing', () => {
    it('formats with indentation', () => {
      const result = build({ root: { child: 'value' } }, { format: true });
      expect(result).toBe('<root>\n  <child>value</child>\n</root>\n');
    });

    it('formats nested elements', () => {
      const result = build({ root: { a: { b: 'val' } } }, { format: true });
      expect(result).toBe('<root>\n  <a>\n    <b>val</b>\n  </a>\n</root>\n');
    });

    it('formats arrays', () => {
      const result = build({ root: { item: ['a', 'b'] } }, { format: true });
      expect(result).toBe('<root>\n  <item>a</item>\n  <item>b</item>\n</root>\n');
    });

    it('uses custom indent string', () => {
      const result = build({ root: { child: 'val' } }, { format: true, indentBy: '\t' });
      expect(result).toBe('<root>\n\t<child>val</child>\n</root>\n');
    });
  });

  describe('XML escaping', () => {
    it('escapes special characters in text content', () => {
      expect(build({ root: 'a & b < c > d' })).toBe('<root>a &amp; b &lt; c &gt; d</root>');
    });

    it('escapes special characters in attribute values', () => {
      expect(build({ root: { '@_title': 'a & "b"' } })).toBe('<root title="a &amp; &quot;b&quot;"/>');
    });
  });

  describe('Salesforce package manifest (real-world use case)', () => {
    it('builds a package.xml manifest', () => {
      const result = build(
        {
          Package: {
            '@xmlns': 'http://soap.sforce.com/2006/04/metadata',
            types: [
              {
                members: ['MyClass', 'OtherClass'],
                name: 'ApexClass',
              },
              {
                members: 'MyTrigger',
                name: 'ApexTrigger',
              },
            ],
            version: '50.0',
          },
        },
        { format: true, ignoreAttributes: false, attributeNamePrefix: '@' },
      );

      expect(result).toContain('<Package xmlns="http://soap.sforce.com/2006/04/metadata">');
      expect(result).toContain('<name>ApexClass</name>');
      expect(result).toContain('<members>MyClass</members>');
      expect(result).toContain('<members>OtherClass</members>');
      expect(result).toContain('<members>MyTrigger</members>');
      expect(result).toContain('<name>ApexTrigger</name>');
      expect(result).toContain('<version>50.0</version>');
    });
  });

  describe('round-trip', () => {
    it('parse -> build -> parse produces equivalent structure', () => {
      const xml = '<root><items><item id="1">first</item><item id="2">second</item></items></root>';
      const parsed1 = parse(xml);
      const built = build(parsed1);
      const parsed2 = parse(built);
      expect(parsed2).toEqual(parsed1);
    });
  });
});
