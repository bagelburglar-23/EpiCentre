// NOT YET IMPLEMENTED - scaffold only. The actual sync logic (push/pull,
// conflict handling between Cal+ edits and Google Calendar edits) needs a
// real account to test against, and getting that wrong risks silently
// duplicating or losing events - worth doing carefully once credentials
// exist, not rushed now. See GCAL_SETUP.md for what's needed from you.
//
// Shape this will take, once built:
//   - exchangeCodeForTokens(code): OAuth callback handler, stores refresh
//     token (env or a small table - TBD, leaning table since a single env
//     var can't be rotated without a redeploy)
//   - pushEventToGoogle(event): CalEvent -> Google Calendar API insert/update,
//     stores the returned event id in events.gcal_event_id
//   - pullGoogleEvents(): one-way import for events created directly in
//     Google Calendar, matched/deduped by gcal_event_id
//
// Direction of travel for v1: EpiC -> Google only (push). Google -> EpiC
// (pull) is a deliberate v2 - two-way sync needs a conflict-resolution
// story (what happens when the same event is edited in both places between
// syncs) that isn't worth designing before the one-way path is proven.

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
