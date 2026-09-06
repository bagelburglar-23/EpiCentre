#!/usr/bin/env python3
"""
build_ics.py -- Ledger (markdown) -> iCalendar (.ics)

Zero dependencies. Python 3.8+. Standard library only.
Deterministic: same ledger.md always produces byte-identical output
(except DTSTAMP, which is pinned to a fixed value for exactly this reason).

Usage:
    python3 bin/build_ics.py
    python3 bin/build_ics.py --ledger state/ledger.md --out epicentre.ics

Exit codes:
    0  clean build
    1  build succeeded, but entries were skipped (see GAPS report)
    2  fatal (ledger missing/unreadable)
"""

import argparse
import hashlib
import re
import sys
from datetime import date, datetime
from pathlib import Path

# --------------------------------------------------------------------------
# CONFIGURATION
# Hong Kong and Singapore are both UTC+8 with no DST, so this single block
# is correct for either desk. If you ever move to a DST zone, this needs a
# proper VTIMEZONE with DAYLIGHT components.
# --------------------------------------------------------------------------
TZID = "Asia/Hong_Kong"
UTC_OFFSET = "+0800"
ALERT_HOUR = 16  # 16:00 local -- after Tokyo close, before the evening block
CALENDAR_NAME = "EpiCentre Ledger"

# Alert tiers. Values are (lead_days, ...) -- one VALARM per entry.
# Google Calendar rejects reminders beyond 4 weeks, so nothing exceeds 28.
TIERS = {
    "gift": (14, 1),      # needs buying/booking time
    "message": (1,),      # just needs a message on the day-before evening
    "admin": (28, 7, 1),  # renewals, expiries -- needs real runway
}
DEFAULT_TIER = "message"

# Fixed DTSTAMP. Using datetime.now() here would make every build produce a
# different file, which defeats diffing the .ics in git.
DTSTAMP = "20260101T000000Z"

LINE_RE = re.compile(r"^\s*-\s+(.*\S)\s*$")

# Only bullets under this heading are treated as entries. Without this, every
# prose bullet elsewhere in ledger.md is parsed and reported as a gap, which
# buries the real gaps in noise.
ENTRIES_HEADING = "## entries"
HEADING_RE = re.compile(r"^\s*#{1,6}\s")


class Entry:
    __slots__ = ("month", "day", "year", "label", "kind", "tier", "raw")

    def __init__(self, month, day, year, label, kind, tier, raw):
        self.month = month
        self.day = day
        self.year = year  # None when unknown
        self.label = label
        self.kind = kind
        self.tier = tier
        self.raw = raw

    def uid(self):
        """Stable across rebuilds. Re-importing updates rather than duplicates."""
        seed = f"{self.label}|{self.kind}|{self.month:02d}-{self.day:02d}"
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]
        return f"{digest}@epicentre.local"

    def next_occurrence(self, today):
        """First occurrence on or after today, so the calendar opens on the future."""
        year = today.year
        try:
            candidate = date(year, self.month, self.day)
        except ValueError:
            # 29 Feb in a non-leap year -- roll to 28 Feb.
            candidate = date(year, self.month, 28)
        if candidate < today:
            try:
                candidate = date(year + 1, self.month, self.day)
            except ValueError:
                candidate = date(year + 1, self.month, 28)
        return candidate

    def summary(self):
        return f"{self.label} \u2014 {self.kind}"

    def description(self):
        parts = [f"Tier: {self.tier}"]
        if self.year:
            parts.append(f"Since {self.year}")
        parts.append("Source: state/ledger.md (EpiCentre)")
        return " | ".join(parts)


def parse_date_token(token):
    """
    Accepts:
        1990-07-14   -> (7, 14, 1990)
        ????-03-02   -> (3, 2, None)
    Rejects anything else, including unknown day/month.
    """
    token = token.strip()
    m = re.fullmatch(r"(\d{4}|\?{4})-(\d{2})-(\d{2})", token)
    if not m:
        return None, "date must be YYYY-MM-DD or ????-MM-DD"
    y_raw, mo_raw, d_raw = m.groups()
    month, day = int(mo_raw), int(d_raw)
    if not (1 <= month <= 12):
        return None, f"month {month} out of range"
    if not (1 <= day <= 31):
        return None, f"day {day} out of range"
    try:
        date(2024, month, day)  # 2024 is a leap year -- validates 29 Feb
    except ValueError:
        return None, f"{month:02d}-{day:02d} is not a real date"
    year = None if y_raw.startswith("?") else int(y_raw)
    return (month, day, year), None


def parse_ledger(text):
    """Returns (entries, gaps). Never raises on bad input -- collects it."""
    entries, gaps = [], []
    in_entries = False
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if HEADING_RE.match(line):
            # Any heading closes the Entries section; only the Entries
            # heading opens it.
            in_entries = stripped.lower() == ENTRIES_HEADING
            continue
        if not in_entries:
            continue
        if not stripped or stripped.startswith("<!--") or stripped.startswith(">"):
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        body = m.group(1)
        fields = [f.strip() for f in body.split("|")]
        if len(fields) < 3:
            gaps.append((lineno, body, "need at least: date | label | kind"))
            continue
        parsed, err = parse_date_token(fields[0])
        if err:
            gaps.append((lineno, body, err))
            continue
        month, day, year = parsed
        label, kind = fields[1], fields[2]
        if not label:
            gaps.append((lineno, body, "empty label"))
            continue
        tier = fields[3].lower() if len(fields) > 3 and fields[3] else DEFAULT_TIER
        if tier not in TIERS:
            gaps.append((lineno, body, f"unknown tier '{tier}' (use: {', '.join(TIERS)})"))
            continue
        entries.append(Entry(month, day, year, label, kind, tier, body))
    return entries, gaps


def esc(text):
    """RFC 5545 text escaping."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def fold(line):
    """RFC 5545 requires lines <= 75 octets, continued with a leading space."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return [line]
    out, buf, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        limit = 75 if not out else 74
        if size + n > limit:
            out.append(buf)
            buf, size = "", 0
        buf += ch
        size += n
    if buf:
        out.append(buf)
    return [out[0]] + [" " + seg for seg in out[1:]]


def build_calendar(entries, today):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EpiCentre//Ledger//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{esc(CALENDAR_NAME)}",
        f"X-WR-TIMEZONE:{TZID}",
        "BEGIN:VTIMEZONE",
        f"TZID:{TZID}",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        f"TZOFFSETFROM:{UTC_OFFSET}",
        f"TZOFFSETTO:{UTC_OFFSET}",
        "TZNAME:HKT",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]

    # Sort for deterministic output.
    for e in sorted(entries, key=lambda x: (x.month, x.day, x.label)):
        occ = e.next_occurrence(today)
        start = f"{occ.year}{occ.month:02d}{occ.day:02d}T{ALERT_HOUR:02d}0000"
        end = f"{occ.year}{occ.month:02d}{occ.day:02d}T{ALERT_HOUR + 1:02d}0000"
        lines += [
            "BEGIN:VEVENT",
            f"UID:{e.uid()}",
            f"DTSTAMP:{DTSTAMP}",
            f"DTSTART;TZID={TZID}:{start}",
            f"DTEND;TZID={TZID}:{end}",
            "RRULE:FREQ=YEARLY",
            f"SUMMARY:{esc(e.summary())}",
            f"DESCRIPTION:{esc(e.description())}",
            "TRANSP:TRANSPARENT",
        ]
        for lead in TIERS[e.tier]:
            lines += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                f"TRIGGER:-P{lead}D",
                f"DESCRIPTION:{esc(e.summary())} in {lead} day(s)",
                "END:VALARM",
            ]
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    folded = []
    for line in lines:
        folded.extend(fold(line))
    return "\r\n".join(folded) + "\r\n"


def main():
    ap = argparse.ArgumentParser(description="Build the EpiCentre Ledger .ics")
    ap.add_argument("--ledger", default="state/ledger.md")
    ap.add_argument("--out", default="epicentre.ics")
    args = ap.parse_args()

    path = Path(args.ledger)
    if not path.exists():
        print(f"FATAL: no ledger at {path}", file=sys.stderr)
        return 2
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"FATAL: cannot read {path}: {exc}", file=sys.stderr)
        return 2

    entries, gaps = parse_ledger(text)
    today = datetime.now().date()

    if not entries and not gaps:
        print("Ledger is empty. Add entries to state/ledger.md, then rerun.")
        return 0

    ics = build_calendar(entries, today)
    Path(args.out).write_text(ics, encoding="utf-8", newline="")

    print(f"Wrote {args.out}")
    print(f"  {len(entries)} entries")
    by_tier = {}
    for e in entries:
        by_tier[e.tier] = by_tier.get(e.tier, 0) + 1
    for tier in sorted(by_tier):
        print(f"    {tier:<8} {by_tier[tier]}")
    undated = [e for e in entries if e.year is None]
    if undated:
        print(f"  {len(undated)} with unknown year (harmless -- recurrence still works)")

    if gaps:
        print(f"\nGAPS -- {len(gaps)} line(s) skipped:")
        for lineno, body, reason in gaps:
            print(f"  L{lineno}: {reason}")
            print(f"        {body}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
