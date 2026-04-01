import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';

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
});
