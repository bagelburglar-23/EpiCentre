// Pure, client-safe bill model + split calculator. No server imports, so the
// client panel can import the calculator directly (lib/bills.ts holds the
// server/DB side and imports the types from here).
//
// cost and taxPercent are stored as raw strings (what the user typed, e.g.
// "115.50", "10"), so decimal entry works without a controlled-number-input
// fighting the cursor. They're Number()'d only at compute time. Shares are
// integer share units.

export type BillParticipant = { id: string; name: string };

export type BillItem = {
  id: string;
  name: string;
  cost: string; // pre-tax amount for the whole item, e.g. "115.50"
  taxPercent: string; // e.g. "10" for 10%
  shares: Record<string, number>; // participantId -> relative share units
};

export type BillData = {
  participants: BillParticipant[];
  items: BillItem[];
};

export function emptyBill(): BillData {
  return { participants: [], items: [] };
}

export type BillTotals = {
  perParticipant: Record<string, number>; // participantId -> amount owed
  grand: number; // tax-inclusive total of all allocated items
  unallocated: number; // tax-inclusive total of items nobody is sharing
};

// Each item's tax-inclusive cost is split across participants in proportion
// to their share units: amount = cost * (1 + taxPercent/100) * share / sumShares.
// An item with no shares assigned is left unallocated (nobody charged).
//
// Verified against Lucas's Excel: Beer 115.50 @10% over shares {1,3,2,4,1}
// (sum 11) -> 11.55 per share; Don totals 227.15, Lucas 256.30, Kyra 192.28.
export function computeTotals(data: BillData): BillTotals {
  const perParticipant: Record<string, number> = {};
  for (const p of data.participants) perParticipant[p.id] = 0;
  let grand = 0;
  let unallocated = 0;

  for (const item of data.items) {
    const cost = Number(item.cost) || 0;
    const taxFrac = (Number(item.taxPercent) || 0) / 100;
    const withTax = cost * (1 + taxFrac);
    const totalShares = data.participants.reduce(
      (s, p) => s + (Number(item.shares[p.id]) || 0),
      0
    );
    if (totalShares <= 0) {
      unallocated += withTax;
      continue;
    }
    const perShare = withTax / totalShares;
    for (const p of data.participants) {
      const share = Number(item.shares[p.id]) || 0;
      if (share) perParticipant[p.id] += share * perShare;
    }
    grand += withTax;
  }
  return { perParticipant, grand, unallocated };
}

// Round to cents for display.
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
