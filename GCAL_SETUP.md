# Google Calendar sync — status

**Credentials obtained and set, v1 built** (see `feature/gcal-sync`
branch / `lib/google-calendar.ts`).

## What v1 does

- **Push:** new events you add in Cal+ (non-test only) get created on your
  Google Calendar's **primary** calendar automatically.
- **Pull:** events from **every calendar on the account** (primary,
  Birthdays, any other calendar you've added) show up in Cal+, read-only
  (marked `G`, hover for which calendar, no delete button) — refreshed
  every 30 minutes by a systemd timer (`sync-google-events.timer`).
- **Not built:** editing a Google-sourced event from Cal+, or syncing Cal+
  edits/deletes back to an already-pushed event. That's genuine two-way
  sync and needs a conflict-resolution design — deliberately deferred.

## To actually connect

Log into EpiCentre, open Cal+, click **"Connect Google Calendar"**. One-time
OAuth consent, then it's live. The connection (a refresh token) lives in
the shared database, so it only needs doing once — both prod and UAT read
the same connection.

**If you connected before the multi-calendar pull was added:** your
existing refresh token only has permission to push/read the primary
calendar — it predates the broader `calendar.readonly` scope. Cal+ now
shows a **"Reconnect"** link even once connected — click it, re-consent,
and the next sync picks up Birthdays etc. One-time, not needed again after
that.
