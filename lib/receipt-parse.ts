// Pure, client-safe heuristic parser: turn noisy OCR text from a receipt into
// candidate line items. Best-effort - the user reviews/edits the result in the
// scan modal before anything is added. No AI, no tokens.
//
// Handles two common shapes: a thermal receipt ("1 x Item  S$28.80") and a POS
// table ("No Code Description Qty Price Discount Total"). The item total is
// taken as the LAST price on a line (so a qty > 1 line gives the line total,
// not the unit price); the name is whatever precedes the first price, with a
// leading row number / item code / "N x" stripped.

export type ParsedItem = { name: string; cost: string };

// Lines that are clearly not individual items.
const SKIP =
  /\b(sub\s*-?\s*total|total|svc|service\s*charge|gst|vat|rounding|discount|change|cash|card|visa|master|amex|grand|balance|tip|gratuity|pax|table|bill\s*no|date|order|receipt|invoice|thank)\b/i;

// A price, with an optional currency prefix ($, S$, SGD, RM, £, €, …).
const PRICE = /(?:S\s*\$|SGD|RM|USD|\$|£|€)?\s*(\d{1,4}[.,]\d{2})\b/g;

const QTY = /^\s*\d{1,3}\s*[x×]\s*/i; // "1 x ", "11x "
const ROW_NO = /^\s*(?:no\.?\s*)?\d{1,3}\s+/i; // leading row number
const ITEM_CODE = /^\s*[A-Z]{1,4}\d{1,4}[A-Z]?\s+/; // "V01 ", "AD01A ", "C04 "

export function parseReceipt(text: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 3 || SKIP.test(line)) continue;

    const prices = [...line.matchAll(PRICE)];
    if (prices.length === 0) continue;
    const firstAt = prices[0].index ?? 0;
    const cost = prices[prices.length - 1][1].replace(",", ".");

    let name = line.slice(0, firstAt);
    // Strip a leading "N x", then a row number, then an item code (in that
    // order - the POS format has a row number then a code).
    name = name.replace(QTY, "").replace(ROW_NO, "").replace(ITEM_CODE, "");
    name = name.replace(/[\s.·\-–—:|]+$/, "").trim();

    if (!/[A-Za-z]/.test(name) || name.length < 2) continue;
    out.push({ name, cost });
  }
  return out;
}
