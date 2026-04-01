import type { BuildOptions } from './types.js';

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const ESCAPE_RE = /[&<>"']/g;

function escapeXml(str: string): string {
  return str.replace(ESCAPE_RE, ch => ESCAPE_MAP[ch] || ch);
}

export function build(obj: Record<string, unknown>, options?: BuildOptions): string {
  const format = options?.format ?? false;
  const ignoreAttributes = options?.ignoreAttributes ?? false;
  const attrPrefix = options?.attributeNamePrefix ?? '@_';
  const indentBy = options?.indentBy ?? '  ';

  const parts: string[] = [];

  function serialize(key: string, value: unknown, depth: number): void {
    if (value === null || value === undefined) return;

    const indent = format ? indentBy.repeat(depth) : '';
    const nl = format ? '\n' : '';

    if (Array.isArray(value)) {
      for (const item of value) {
        serialize(key, item, depth);
      }
      return;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const attrParts: string[] = [];
      const childEntries: [string, unknown][] = [];
      let textContent: string | undefined;

      for (const [k, v] of Object.entries(record)) {
        if (k.startsWith(attrPrefix)) {
          if (!ignoreAttributes) {
            const attrName = k.slice(attrPrefix.length);
            attrParts.push(` ${attrName}="${escapeXml(String(v))}"`);
          }
        } else if (k === '#text') {
          textContent = String(v);
        } else {
          childEntries.push([k, v]);
        }
      }

      const attrStr = attrParts.join('');

      if (childEntries.length === 0 && textContent === undefined) {
        // Self-closing tag
        parts.push(`${indent}<${key}${attrStr}/>${nl}`);
      } else if (childEntries.length === 0 && textContent !== undefined) {
        // Tag with only text content
        parts.push(`${indent}<${key}${attrStr}>${escapeXml(textContent)}</${key}>${nl}`);
      } else {
        // Tag with children
        parts.push(`${indent}<${key}${attrStr}>${nl}`);
        if (textContent !== undefined) {
          parts.push(`${format ? indentBy.repeat(depth + 1) : ''}${escapeXml(textContent)}${nl}`);
        }
        for (const [childKey, childVal] of childEntries) {
          serialize(childKey, childVal, depth + 1);
        }
        parts.push(`${indent}</${key}>${nl}`);
      }
    } else {
      // Primitive value
      const str = String(value);
      if (str === '') {
        parts.push(`${indent}<${key}/>${nl}`);
      } else {
        parts.push(`${indent}<${key}>${escapeXml(str)}</${key}>${nl}`);
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    serialize(key, value, 0);
  }

  return parts.join('');
}
