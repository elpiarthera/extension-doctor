/**
 * Small brace/paren-matching helpers used by the rules that need lightweight
 * scope resolution without pulling in a full TypeScript AST parser.
 */

/**
 * Given the index of an opening bracket character (e.g. "{" or "(") in
 * `text`, return the index of its matching closing bracket, or -1 if the
 * source is unbalanced.
 */
export function matchBracket(text: string, openIndex: number): number {
  const open = text[openIndex];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : null;
  if (close === null) return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Blank out // and /* *\/ comment bodies with spaces (string/template
 * literal bodies are left INTACT — rules like i18n-key-coverage-gap need to
 * read string content), preserving byte offsets and newlines so that line
 * numbers computed via lineAt() stay accurate on the ORIGINAL text.
 *
 * This exists because a naive regex scan over raw source matches inside
 * comments (e.g. a fix-commit's own doc comment quoting the buggy pattern
 * it replaced) and produces false positives. Never scan raw source text for
 * a code pattern without stripping comments first.
 */
export function stripComments(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const two = text.slice(i, i + 2);
    if (two === "//") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (two === "/*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let j = i; j < stop; j++) out += text[j] === "\n" ? "\n" : " ";
      i = stop;
      continue;
    }
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      // Skip over string/template literal bodies WITHOUT blanking them —
      // callers that need string content (e.g. t('key')) still see it,
      // while we correctly avoid treating quote chars inside as comment
      // delimiters.
      const quote = ch;
      let j = i + 1;
      out += text[i];
      while (j < n) {
        if (text[j] === "\\") {
          out += text[j] + (text[j + 1] ?? "");
          j += 2;
          continue;
        }
        out += text[j];
        if (text[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

export function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Find the enclosing function body [start, end) for a given index inside it.
 * Walks outward looking for the nearest unmatched "{" before `index`, then
 * matches it forward. Best-effort — sufficient for well-formatted TS source,
 * not a full parser. Returns null if no enclosing block is found.
 */
export function enclosingBlock(text: string, index: number): { start: number; end: number } | null {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) {
        const end = matchBracket(text, i);
        if (end === -1) return null;
        return { start: i, end };
      }
      depth--;
    }
  }
  return null;
}
