// Google Calendar access for the standalone sync script - the plain-JS mirror
// of the app's lib/google-calendar.ts (the scripts can't import the TS app).
// Refresh an access token, and pull events across every calendar in a window.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_LIST = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const eventsUrl = (calId) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;

export async function getAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

// Returns raw Google event objects, each tagged with calendarName/calendarId.
export async function fetchCalendarEvents(accessToken, rangeStart, rangeEnd) {
  const listRes = await fetch(CAL_LIST, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`calendar list failed: ${await listRes.text()}`);
  const { items: calendars } = await listRes.json();

  const params = new URLSearchParams({
    timeMin: rangeStart,
    timeMax: rangeEnd,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const out = [];
  for (const cal of calendars ?? []) {
    const res = await fetch(`${eventsUrl(cal.id)}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error(`events failed for "${cal.summary}":`, await res.text());
      continue;
    }
    const { items } = await res.json();
    for (const e of items ?? [])
      out.push({ ...e, calendarName: cal.summary ?? cal.id, calendarId: cal.id });
  }
  return out;
}
