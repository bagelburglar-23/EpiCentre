# Ledger

Date-bound obligations. This file is **data**, not code — it stays editable
forever, including during the freeze.

## Format

    - YYYY-MM-DD | Label | kind | tier

- **Year unknown?** Use `????-MM-DD`. Recurrence still works.
- **Day unknown?** Don't guess — put it under Gaps below.
- `tier` is optional; defaults to `message`.

## Tiers

| tier | alerts fire | use for |
|---|---|---|
| `gift` | 14 days + 1 day before | needs buying, booking, or leave |
| `message` | 1 day before | just needs a message on the day |
| `admin` | 28 + 7 + 1 days before | renewals, expiries, medicals |

All alerts fire at **16:00 local** — after Tokyo close, before the evening
derivatives block. Hong Kong and Singapore are both UTC+8 with no DST, so the
wall-clock time is identical either way. The desk-location question does not
block this build.

## Entries

<!-- Delete the examples. Add yours. Order doesn't matter — the build sorts. -->

- ????-01-15 | EXAMPLE — Mum | birthday | gift
- ????-06-03 | EXAMPLE — Dave | birthday | message
- 2019-11-05 | EXAMPLE — Anniversary | anniversary | gift
- ????-09-30 | EXAMPLE — Travel insurance renewal | renewal | admin

## Gaps

Things you know exist but can't date yet. Nothing here reaches the calendar.

- (nothing yet)

## Open questions

- Desk location: Hong Kong (per work export) vs Singapore. Affects the admin
  section only — HKID vs NRIC, HK vs SG public holidays, no COE/road tax in HK.
