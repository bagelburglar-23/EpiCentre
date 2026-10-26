# Google Calendar sync — status

**Credentials obtained and set, v1 built** (see `feature/gcal-sync`
branch / `lib/google-calendar.ts`).

## What v1 does

- **Push:** new events you add in Cal+ (non-test only) get created on your
  Google Calendar automatically.
- **Pull:** your existing/upcoming Google Calendar events show up in Cal+,
  read-only (marked `G`, no delete button) — refreshed every 30 minutes by
  a systemd timer (`sync-google-events.timer`).
- **Not built:** editing a Google-sourced event from Cal+, or syncing Cal+
  edits/deletes back to an already-pushed event. That's genuine two-way
  sync and needs a conflict-resolution design — deliberately deferred.

## To actually connect

Log into EpiCentre, open Cal+, click **"Connect Google Calendar"**. One-time
OAuth consent, then it's live. The connection (a refresh token) lives in
the shared database, so it only needs doing once — both prod and UAT read
the same connection.
