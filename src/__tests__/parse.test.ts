import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('parse', () => {
  describe('basic parsing', () => {
    it('parses a simple element with text content', () => {
      const result = parse('<root>hello</root>');
      expect(result).toEqual({ root: 'hello' });
    });

    it('parses nested elements', () => {
      const result = parse('<root><child>value</child></root>');
      expect(result).toEqual({ root: { child: 'value' } });
    });

    it('parses deeply nested elements', () => {
      const result = parse('<a><b><c>deep</c></b></a>');
      expect(result).toEqual({ a: { b: { c: 'deep' } } });
    });

    it('parses multiple children into an array', () => {
      const result = parse('<root><item>a</item><item>b</item><item>c</item></root>');
      expect(result).toEqual({ root: { item: ['a', 'b', 'c'] } });
    });

    it('parses self-closing tags', () => {
      const result = parse('<root><empty/></root>');
      expect(result).toEqual({ root: { empty: '' } });
    });

    it('parses empty elements', () => {
      const result = parse('<root><empty></empty></root>');
      expect(result).toEqual({ root: { empty: '' } });
    });

    it('handles XML declaration', () => {
      const result = parse('<?xml version="1.0" encoding="UTF-8"?><root>hello</root>');
      expect(result).toEqual({ root: 'hello' });
    });

    it('handles comments', () => {
      const result = parse('<root><!-- a comment --><child>val</child></root>');
      expect(result).toEqual({ root: { child: 'val' } });
    });

    it('handles CDATA sections', () => {
      const result = parse('<root><![CDATA[some <raw> content]]></root>');
      expect(result).toEqual({ root: 'some <raw> content' });
    });
  });

  describe('attributes', () => {
    it('parses attributes with default prefix', () => {
      const result = parse('<root id="1" name="test">value</root>');
      expect(result).toEqual({ root: { '#text': 'value', '@_id': '1', '@_name': 'test' } });
    });

    it('parses attributes on nested elements', () => {
      const result = parse('<root><child type="a">text</child></root>');
      expect(result).toEqual({ root: { child: { '#text': 'text', '@_type': 'a' } } });
    });

    it('parses self-closing tag with attributes', () => {
      const result = parse('<root><item id="1"/></root>');
      expect(result).toEqual({ root: { item: { '@_id': '1' } } });
    });

    it('ignores attributes when ignoreAttributes is true', () => {
      const result = parse('<root id="1"><child type="a">text</child></root>', {
        ignoreAttributes: true,
      });
      expect(result).toEqual({ root: { child: 'text' } });
    });

    it('uses custom attribute prefix', () => {
      const result = parse('<root id="1">text</root>', {
        attributeNamePrefix: '@',
      });
      expect(result).toEqual({ root: { '#text': 'text', '@id': '1' } });
    });

    it('handles attributes with single quotes', () => {
      const result = parse("<root id='42'>text</root>");
      expect(result).toEqual({ root: { '#text': 'text', '@_id': '42' } });
    });
  });

  describe('namespace handling', () => {
    it('removes namespace prefixes when enabled', () => {
      const result = parse('<soap:Envelope><soap:Body><sf:result>ok</sf:result></soap:Body></soap:Envelope>', { removeNSPrefix: true });
      expect(result).toEqual({ Envelope: { Body: { result: 'ok' } } });
    });

    it('preserves namespace prefixes by default', () => {
      const result = parse('<soap:Envelope><soap:Body>ok</soap:Body></soap:Envelope>');
      expect(result).toEqual({ 'soap:Envelope': { 'soap:Body': 'ok' } });
    });

    it('removes namespace prefix from attributes', () => {
      const result = parse('<root xmlns:sf="http://example.com" sf:id="1">text</root>', {
        removeNSPrefix: true,
      });
      // xmlns:sf is stripped entirely, sf:id -> removeNS -> id
      expect(result).toEqual({ root: { '#text': 'text', '@_id': '1' } });
    });
  });

  describe('trimValues', () => {
    it('trims whitespace by default', () => {
      const result = parse('<root>  hello  </root>');
      expect(result).toEqual({ root: 'hello' });
    });

    it('preserves whitespace when trimValues is false', () => {
      const result = parse('<root>  hello  </root>', { trimValues: false });
      expect(result).toEqual({ root: '  hello  ' });
    });
  });

  describe('parseTagValue', () => {
    it('coerces numbers by default', () => {
      const result = parse('<root><num>42</num><float>3.14</float></root>');
      expect(result).toEqual({ root: { num: 42, float: 3.14 } });
    });

    it('coerces booleans by default', () => {
      const result = parse('<root><a>true</a><b>false</b></root>');
      expect(result).toEqual({ root: { a: true, b: false } });
    });

    it('keeps values as strings when parseTagValue is false', () => {
      const result = parse('<root><num>42</num><bool>true</bool></root>', {
        parseTagValue: false,
      });
      expect(result).toEqual({ root: { num: '42', bool: 'true' } });
    });
  });

  describe('entity handling', () => {
    it('decodes entities by default', () => {
      const result = parse('<root>&amp; &lt; &gt; &quot; &apos;</root>');
      expect(result).toEqual({ root: '& < > " \'' });
    });

    it('leaves entities as-is when processEntities is false', () => {
      const result = parse('<root>&amp; &lt;</root>', { processEntities: false });
      expect(result).toEqual({ root: '&amp; &lt;' });
    });
  });

  describe('SOAP response parsing (real-world use case)', () => {
    it('parses a typical Salesforce SOAP response', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sf="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <sf:loginResponse>
      <sf:result>
        <sf:metadataServerUrl>https://example.salesforce.com/services/Soap/m/50.0/00D000000000000</sf:metadataServerUrl>
        <sf:passwordExpired>false</sf:passwordExpired>
        <sf:sandbox>true</sf:sandbox>
        <sf:serverUrl>https://example.salesforce.com/services/Soap/u/50.0/00D000000000000</sf:serverUrl>
        <sf:sessionId>ABC123!session.id.here</sf:sessionId>
        <sf:userId>005000000000000</sf:userId>
      </sf:result>
    </sf:loginResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

      const result = parse(xml, {
        trimValues: true,
        ignoreAttributes: false,
        removeNSPrefix: true,
        attributeNamePrefix: '@_',
        processEntities: false,
      });

      const loginResult = (result as any).Envelope.Body.loginResponse.result;
      expect(loginResult.sessionId).toBe('ABC123!session.id.here');
      expect(loginResult.sandbox).toBe(true);
      expect(loginResult.passwordExpired).toBe(false);
    });
  });

  describe('package manifest parsing (real-world use case)', () => {
    it('parses a Salesforce package.xml manifest', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>MyClass</members>
    <members>OtherClass</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>MyTrigger</members>
    <name>ApexTrigger</name>
  </types>
  <version>50.0</version>
</Package>`;

      const result = parse(xml, {
        trimValues: true,
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
        processEntities: false,
      });

      const pkg = result.Package as any;
      expect(pkg.version).toBe('50.0');
      expect(pkg.types).toEqual([
        { members: ['MyClass', 'OtherClass'], name: 'ApexClass' },
        { members: 'MyTrigger', name: 'ApexTrigger' },
      ]);
    });

    it('parses manifest with a single type (no array coalescing)', () => {
      const xml = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>MyClass</members>
    <name>ApexClass</name>
  </types>
  <version>50.0</version>
</Package>`;

      const result = parse(xml, {
        trimValues: true,
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false,
        processEntities: false,
      });

      const pkg = result.Package as any;
      // Single type is NOT wrapped in an array (matches fast-xml-parser behavior)
      expect(pkg.types).toEqual({ members: 'MyClass', name: 'ApexClass' });
    });
  });

  describe('mixed content', () => {
    it('handles mixed text and child elements', () => {
      const result = parse('<root>text<child>val</child></root>');
      expect(result).toEqual({ root: { '#text': 'text', child: 'val' } });
    });
  });

  describe('maxDepth', () => {
    it('allows nesting up to the default maxDepth (256)', () => {
      const depth = 256;
      const open = Array.from({ length: depth }, (_, i) => `<d${i}>`).join('');
      const close = Array.from({ length: depth }, (_, i) => `</d${depth - 1 - i}>`).join('');
      expect(() => parse(open + 'val' + close)).not.toThrow();
    });

    it('throws when nesting exceeds default maxDepth', () => {
      const depth = 257;
      const open = Array.from({ length: depth }, (_, i) => `<d${i}>`).join('');
      const close = Array.from({ length: depth }, (_, i) => `</d${depth - 1 - i}>`).join('');
      expect(() => parse(open + 'val' + close)).toThrow('Maximum nesting depth of 256 exceeded');
    });

    it('respects custom maxDepth', () => {
      const xml = '<a><b><c><d>deep</d></c></b></a>';
      expect(() => parse(xml, { maxDepth: 3 })).toThrow('Maximum nesting depth of 3 exceeded');
      expect(() => parse(xml, { maxDepth: 4 })).not.toThrow();
    });

    it('does not count self-closing tags toward depth', () => {
      const xml = '<a><b/></a>';
      expect(() => parse(xml, { maxDepth: 2 })).not.toThrow();
    });
  });

  describe('strict mode', () => {
    it('throws on unclosed tags', () => {
      expect(() => parse('<a><b>text</b>', { strict: true })).toThrow('Unclosed tag(s): a');
    });

    it('throws on multiple unclosed tags', () => {
      expect(() => parse('<a><b><c>text</c>', { strict: true })).toThrow('Unclosed tag(s): b, a');
    });

    it('throws on mismatched closing tags', () => {
      expect(() => parse('<a><b>text</c></a>', { strict: true })).toThrow(
        'Mismatched closing tag: expected </b> but found </c>',
      );
    });

    it('does not throw for well-formed XML in strict mode', () => {
      expect(() => parse('<a><b>text</b></a>', { strict: true })).not.toThrow();
    });

    it('throws on extra closing tags in strict mode', () => {
      expect(() => parse('<root>text</root></extra>', { strict: true })).toThrow(
        'Unexpected closing tag </extra>',
      );
    });

    it('silently ignores unclosed tags when strict is false (default)', () => {
      const result = parse('<a><b>text</b>');
      expect(result).toEqual({});
    });
  });

  describe('DOCTYPE handling', () => {
    it('skips a simple DOCTYPE declaration', () => {
      const xml = '<!DOCTYPE html><root>hello</root>';
      expect(parse(xml)).toEqual({ root: 'hello' });
    });

    it('skips DOCTYPE with internal subset', () => {
      const xml = `<!DOCTYPE root [
        <!ENTITY greeting "hello">
        <!ELEMENT root (#PCDATA)>
      ]><root>value</root>`;
      expect(parse(xml)).toEqual({ root: 'value' });
    });

    it('skips DOCTYPE with SYSTEM identifier', () => {
      const xml = '<!DOCTYPE root SYSTEM "root.dtd"><root>hello</root>';
      expect(parse(xml)).toEqual({ root: 'hello' });
    });
  });

  describe('Anonymous Apex', () => {
    it('parses an Anonymous Apex SOAP response', () => {
      const xml = readFileSync(join(__dirname, 'anonymous-apex-soap-response.xml'), 'utf-8');
      const expectedLog = readFileSync(join(__dirname, 'anonymous-apex-response-body.log'), 'utf-8');

      const result = parse(xml, {
        trimValues: true,
        ignoreAttributes: false,
        removeNSPrefix: true,
        attributeNamePrefix: '@_',
        processEntities: true,
      });

      const envelope = result.Envelope as any;

      // Verify debug log in header
      const debugLog = envelope.Header.DebuggingInfo.debugLog;
      expect(debugLog).toBe(expectedLog);

      // Verify execution result in body
      const execResult = envelope.Body.executeAnonymousResponse.result;
      expect(execResult.column).toBe(-1);
      expect(execResult.compiled).toBe(true);
      expect(execResult.success).toBe(true);
      expect(execResult.line).toBe(-1);
      // xsi:nil="true" self-closing tags have the nil attribute (ns-prefix stripped)
      expect(execResult.compileProblem).toEqual({ '@_nil': 'true' });
      expect(execResult.exceptionMessage).toEqual({ '@_nil': 'true' });
      expect(execResult.exceptionStackTrace).toEqual({ '@_nil': 'true' });
    });
  });

  describe('numeric entity handling', () => {
    it('decodes decimal numeric entities', () => {
      expect(parse('<root>&#72;&#101;&#108;&#108;&#111;</root>')).toEqual({ root: 'Hello' });
    });

    it('decodes hex numeric entities', () => {
      expect(parse('<root>&#x48;&#x65;&#x6C;&#x6C;&#x6F;</root>')).toEqual({ root: 'Hello' });
    });

    it('decodes mixed named and numeric entities', () => {
      expect(parse('<root>&lt;div class=&#34;test&#34;&gt;</root>')).toEqual({ root: '<div class="test">' });
    });

    it('leaves numeric entities as-is when processEntities is false', () => {
      expect(parse('<root>&#72;ello</root>', { processEntities: false })).toEqual({ root: '&#72;ello' });
    });

    it('handles numeric entities in attribute values', () => {
      const result = parse('<root title="&#72;ello">text</root>');
      expect(result).toEqual({ root: { '#text': 'text', '@_title': 'Hello' } });
    });

    it('leaves invalid numeric entities as-is instead of crashing', () => {
      expect(parse('<root>&#99999999999;</root>')).toEqual({ root: '&#99999999999;' });
      expect(parse('<root>&#xFFFFFFFF;</root>')).toEqual({ root: '&#xFFFFFFFF;' });
    });
  });

  describe('malformed XML handling', () => {
    it('handles unclosed tags gracefully in non-strict mode', () => {
      expect(() => parse('<root><unclosed>text')).not.toThrow();
    });

    it('handles extra closing tags gracefully in non-strict mode', () => {
      const result = parse('<root>text</root></extra>');
      expect(result).toEqual({ root: 'text' });
    });

    it('handles completely empty input', () => {
      expect(parse('')).toEqual({});
    });

    it('handles whitespace-only input', () => {
      expect(parse('   \n\t  ')).toEqual({});
    });

    it('handles XML with only a declaration', () => {
      expect(parse('<?xml version="1.0"?>')).toEqual({});
    });

    it('handles XML with only comments', () => {
      expect(parse('<!-- just a comment -->')).toEqual({});
    });

    it('handles unescaped ampersand in text content without crashing', () => {
      expect(() => parse('<root>AT&T</root>')).not.toThrow();
    });
  });

  describe('whitespace edge cases', () => {
    it('handles whitespace-only text nodes between elements', () => {
      const result = parse('<root>\n  <a>1</a>\n  <b>2</b>\n</root>');
      expect(result).toEqual({ root: { a: 1, b: 2 } });
    });

    it('preserves significant whitespace in text content with trimValues false', () => {
      const result = parse('<root>  line1\n  line2  </root>', { trimValues: false });
      expect(result).toEqual({ root: '  line1\n  line2  ' });
    });

    it('does not crash on malformed tags with whitespace in names', () => {
      // < root > is not valid XML — just verify no crash
      const result = parse('< root >value</ root >');
      expect(result).toEqual({ '': 'value' });
    });
  });

  describe('CDATA edge cases', () => {
    it('handles multiple adjacent CDATA sections', () => {
      const result = parse('<root><![CDATA[part1]]><![CDATA[part2]]></root>');
      expect(result).toEqual({ root: 'part1part2' });
    });

    it('handles CDATA mixed with regular text', () => {
      const result = parse('<root>before<![CDATA[<middle>]]>after</root>');
      expect(result).toEqual({ root: 'before<middle>after' });
    });

    it('handles empty CDATA', () => {
      const result = parse('<root><![CDATA[]]></root>');
      expect(result).toEqual({ root: '' });
    });

    it('handles CDATA with newlines and special characters', () => {
      const result = parse('<root><![CDATA[line1\nline2\t& <special>]]></root>');
      expect(result).toEqual({ root: 'line1\nline2\t& <special>' });
    });
  });

  describe('attribute edge cases', () => {
    it('handles attributes with empty values', () => {
      const result = parse('<root attr="">text</root>');
      expect(result).toEqual({ root: { '#text': 'text', '@_attr': '' } });
    });

    it('handles attributes with encoded entities in values', () => {
      const result = parse('<root title="a &amp; b">text</root>');
      expect(result).toEqual({ root: { '#text': 'text', '@_title': 'a & b' } });
    });

    it('handles attributes with encoded entities when processEntities is false', () => {
      const result = parse('<root title="a &amp; b">text</root>', { processEntities: false });
      expect(result).toEqual({ root: { '#text': 'text', '@_title': 'a &amp; b' } });
    });

    it('handles many attributes on one element', () => {
      const result = parse('<root a="1" b="2" c="3" d="4" e="5">text</root>');
      expect(result).toEqual({
        root: { '#text': 'text', '@_a': '1', '@_b': '2', '@_c': '3', '@_d': '4', '@_e': '5' },
      });
    });

    it('handles duplicate attributes (last wins)', () => {
      const result = parse('<root attr="first" attr="second">text</root>');
      expect(result).toEqual({ root: { '#text': 'text', '@_attr': 'second' } });
    });
  });

  describe('large payloads', () => {
    it('handles XML with many sibling elements', () => {
      const items = Array.from({ length: 1000 }, (_, i) => `<item>${i}</item>`).join('');
      const xml = `<root>${items}</root>`;
      const result = parse(xml);
      const arr = (result.root as any).item as number[];
      expect(arr).toHaveLength(1000);
      expect(arr[0]).toBe(0);
      expect(arr[999]).toBe(999);
    });

    it('handles XML with very long text content', () => {
      const longText = 'x'.repeat(100_000);
      const xml = `<root>${longText}</root>`;
      const result = parse(xml);
      expect(result.root).toBe(longText);
    });
  });
});
