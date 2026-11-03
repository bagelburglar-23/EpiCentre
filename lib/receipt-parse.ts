// Pure, client-safe heuristic parser: turn noisy OCR text from a receipt into
// candidate line items. Best-effort - the user reviews/edits the result in the
// scan modal before anything is added. No AI, no tokens.

export type ParsedItem = { name: string; cost: string };

// Lines that are clearly not individual items.
const SKIP =
  /\b(sub\s*-?\s*total|total|tax|gst|vat|svc|service\s*charge|change|cash|card|balance|tip|gratuity|amount|visa|master|amex|rounding|discount|qty|table|receipt|invoice|order|thank)\b/i;

// name ... price, where price is the last token: 1-4 digits, a . or , then 2
// decimals, optional leading $. The name must contain a letter.
const LINE = /^(.*?[A-Za-z].*?)[\s.·\-–—]+\$?\s*(\d{1,4}[.,]\d{2})$/;

export function parseReceipt(text: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 3 || SKIP.test(line)) continue;
    const m = line.match(LINE);
    if (!m) continue;
    const name = m[1].replace(/[\s.·\-–—]+$/, "").trim();
    if (name.length < 2) continue;
    out.push({ name, cost: m[2].replace(",", ".") });
  }
  return out;
}
