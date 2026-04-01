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
      expect(result).toEqual({ root: { '#text': 'value', '@_id': 1, '@_name': 'test' } });
    });

    it('parses attributes on nested elements', () => {
      const result = parse('<root><child type="a">text</child></root>');
      expect(result).toEqual({ root: { child: { '#text': 'text', '@_type': 'a' } } });
    });

    it('parses self-closing tag with attributes', () => {
      const result = parse('<root><item id="1"/></root>');
      expect(result).toEqual({ root: { item: { '@_id': 1 } } });
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
      expect(result).toEqual({ root: { '#text': 'text', '@id': 1 } });
    });

    it('handles attributes with single quotes', () => {
      const result = parse("<root id='42'>text</root>");
      expect(result).toEqual({ root: { '#text': 'text', '@_id': 42 } });
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
      // xmlns:sf -> removeNS -> sf, sf:id -> removeNS -> id
      expect(result).toEqual({ root: { '#text': 'text', '@_sf': 'http://example.com', '@_id': 1 } });
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
      expect(execResult.compileProblem).toEqual({ '@_nil': true });
      expect(execResult.exceptionMessage).toEqual({ '@_nil': true });
      expect(execResult.exceptionStackTrace).toEqual({ '@_nil': true });
    });
  });
});
