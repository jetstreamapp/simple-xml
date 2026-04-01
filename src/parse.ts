import type { ParseOptions } from './types.js';

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

const ENTITY_RE = /&(?:amp|lt|gt|quot|apos);/g;

function decodeEntities(str: string): string {
  return str.replace(ENTITY_RE, match => ENTITY_MAP[match] || match);
}

function removeNS(name: string): string {
  const idx = name.indexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function parseValue(val: string, coerce: boolean): string | number | boolean {
  if (!coerce) return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  // Only coerce if it looks like a number and isn't empty
  if (val !== '' && val !== ' ') {
    const n = Number(val);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return val;
}

interface StackEntry {
  tagName: string;
  children: Record<string, unknown>;
  textContent: string;
}

export function parse(xml: string, options?: ParseOptions): Record<string, unknown> {
  const trimValues = options?.trimValues ?? true;
  const ignoreAttributes = options?.ignoreAttributes ?? false;
  const rmNSPrefix = options?.removeNSPrefix ?? false;
  const attrPrefix = options?.attributeNamePrefix ?? '@_';
  const parseTagVal = options?.parseTagValue ?? true;
  const processEnt = options?.processEntities ?? true;
  const maxDepth = options?.maxDepth ?? 256;
  const strict = options?.strict ?? false;

  const len = xml.length;
  let i = 0;

  const root: Record<string, unknown> = {};
  const stack: StackEntry[] = [{ tagName: '', children: root, textContent: '' }];

  function current(): StackEntry {
    return stack[stack.length - 1]!;
  }

  function addChild(parent: Record<string, unknown>, key: string, value: unknown): void {
    if (key in parent) {
      const existing = parent[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        parent[key] = [existing, value];
      }
    } else {
      parent[key] = value;
    }
  }

  while (i < len) {
    if (xml[i] === '<') {
      // Flush any pending text content
      const cur = current();
      if (cur.textContent) {
        let text = cur.textContent;
        if (trimValues) text = text.trim();
        if (processEnt) text = decodeEntities(text);
        if (text) {
          // Text will be set as the value when the tag closes,
          // unless there are also child elements
          cur.textContent = text;
        } else {
          cur.textContent = '';
        }
      }

      // Check what kind of tag
      if (xml.startsWith('<!--', i)) {
        // Comment — skip to -->
        const end = xml.indexOf('-->', i + 4);
        if (end === -1) break;
        i = end + 3;
        continue;
      }

      if (xml.startsWith('<?', i)) {
        // Processing instruction — skip to ?>
        const end = xml.indexOf('?>', i + 2);
        if (end === -1) break;
        i = end + 2;
        continue;
      }

      if (xml.startsWith('<!DOCTYPE', i)) {
        // DOCTYPE — skip entirely, handling internal subset brackets
        let j = i + 9;
        let bracketDepth = 0;
        while (j < len) {
          if (xml[j] === '[') {
            bracketDepth++;
          } else if (xml[j] === ']') {
            bracketDepth--;
          } else if (xml[j] === '>' && bracketDepth === 0) {
            break;
          }
          j++;
        }
        i = j + 1;
        continue;
      }

      if (xml.startsWith('<![CDATA[', i)) {
        // CDATA section
        const end = xml.indexOf(']]>', i + 9);
        if (end === -1) break;
        const cdataText = xml.slice(i + 9, end);
        current().textContent += cdataText;
        i = end + 3;
        continue;
      }

      if (xml.startsWith('</', i)) {
        // Closing tag
        const end = xml.indexOf('>', i + 2);
        if (end === -1) break;

        if (strict) {
          let closingName = xml.slice(i + 2, end).trim();
          if (rmNSPrefix) closingName = removeNS(closingName);
          const expectedName = stack[stack.length - 1]!.tagName;
          if (closingName !== expectedName) {
            throw new Error(`Mismatched closing tag: expected </${expectedName}> but found </${closingName}>`);
          }
        }

        const entry = stack.pop()!;
        const parent = current();
        const childKeys = Object.keys(entry.children);

        let value: unknown;
        if (childKeys.length === 0) {
          // Leaf node — text content or empty string
          value = entry.textContent !== '' ? parseValue(entry.textContent, parseTagVal) : '';
        } else {
          // Node with children
          value = entry.children;
          if (entry.textContent !== '') {
            // Mixed content: add text as #text
            (value as Record<string, unknown>)['#text'] = parseValue(entry.textContent, parseTagVal);
          }
        }

        addChild(parent.children, entry.tagName, value);
        i = end + 1;
        continue;
      }

      // Opening tag
      const tagEnd = findTagEnd(xml, i + 1);
      if (tagEnd === -1) break;

      const selfClosing = xml[tagEnd - 1] === '/';
      const tagContent = xml.slice(i + 1, selfClosing ? tagEnd - 1 : tagEnd);

      // Extract tag name and attributes
      const spaceIdx = tagContent.search(/[\s/]/);
      let rawTagName: string;
      let attrString: string;
      if (spaceIdx === -1) {
        rawTagName = tagContent;
        attrString = '';
      } else {
        rawTagName = tagContent.slice(0, spaceIdx);
        attrString = tagContent.slice(spaceIdx);
      }

      const tagName = rmNSPrefix ? removeNS(rawTagName) : rawTagName;

      // Parse attributes
      const attrs: Record<string, unknown> = {};
      if (!ignoreAttributes && attrString) {
        parseAttributes(attrString, attrs, attrPrefix, rmNSPrefix, processEnt, parseTagVal);
      }

      if (selfClosing) {
        // Self-closing: add immediately
        const value = Object.keys(attrs).length > 0 ? attrs : '';
        addChild(current().children, tagName, value);
      } else {
        // Push onto stack
        if (stack.length > maxDepth) {
          throw new Error(`Maximum nesting depth of ${maxDepth} exceeded`);
        }
        stack.push({ tagName, children: attrs, textContent: '' });
      }

      i = tagEnd + 1;
      continue;
    }

    // Text content — scan ahead to next '<' instead of char-by-char
    const nextTag = xml.indexOf('<', i);
    if (nextTag === -1) {
      current().textContent += xml.slice(i);
      i = len;
    } else {
      current().textContent += xml.slice(i, nextTag);
      i = nextTag;
    }
  }

  if (strict && stack.length > 1) {
    const unclosed = stack
      .slice(1)
      .map(e => e.tagName)
      .reverse()
      .join(', ');
    throw new Error(`Unclosed tag(s): ${unclosed}`);
  }

  return root;
}

function findTagEnd(xml: string, start: number): number {
  let inQuote: string | null = null;
  for (let i = start; i < xml.length; i++) {
    const ch = xml[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function parseAttributes(
  str: string,
  attrs: Record<string, unknown>,
  prefix: string,
  rmNS: boolean,
  processEnt: boolean,
  coerce: boolean,
): void {
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(str)) !== null) {
    let name = match[1]!;
    let value: string = (match[2] ?? match[3])!;
    if (rmNS) name = removeNS(name);
    if (processEnt) value = decodeEntities(value);
    attrs[prefix + name] = parseValue(value, coerce);
  }
}
