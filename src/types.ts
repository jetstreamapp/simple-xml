export interface ParseOptions {
  /** Trim whitespace from text content. Default: true */
  trimValues?: boolean;
  /** Skip attributes entirely. Default: false */
  ignoreAttributes?: boolean;
  /** Strip namespace prefixes from tag and attribute names (e.g. soap:Body -> Body). Default: false */
  removeNSPrefix?: boolean;
  /** Prefix prepended to attribute names in the output object. Default: '@_' */
  attributeNamePrefix?: string;
  /** Coerce numeric/boolean text values to their JS types. Default: true */
  parseTagValue?: boolean;
  /** Decode XML entities (&amp; &lt; etc.). Default: true */
  processEntities?: boolean;
  /** Maximum nesting depth allowed. Throws if exceeded. Default: 256 */
  maxDepth?: number;
  /** When true, throw on malformed XML (unclosed tags, mismatched tags). Default: false */
  strict?: boolean;
}

export interface BuildOptions {
  /** Pretty-print with indentation. Default: false */
  format?: boolean;
  /** Skip attributes when building XML. Default: false */
  ignoreAttributes?: boolean;
  /** Prefix used to identify attribute keys in the input object. Default: '@_' */
  attributeNamePrefix?: string;
  /** Indentation string used when format is true. Default: '  ' (two spaces) */
  indentBy?: string;
}
