# Google Calendar sync — what's needed from you

Cal+ works standalone without any of this (events just live in EpiCentre).
This is only for the later one-way sync to Google Calendar
(`lib/google-calendar.ts` — not implemented yet, scaffold only).

## Steps

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create
   a project (or use an existing personal one).
2. **APIs & Services → Library** → search "Google Calendar API" → Enable.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (fine for personal use with no org Workspace)
   - Publishing status: leave as **Testing** — add your own Google account
     under **Test users**. Testing mode caps at 100 users and is all a
     single-user app needs; no Google review process required.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI:
     `https://srv1648855.tail523e0b.ts.net/api/auth/google/callback`
     (the prod URL — this works because it's real HTTPS via Tailscale, even
     though it's not publicly resolvable; your browser only needs to reach
     it at the moment you authorize, same as any OAuth flow)
5. Copy the **Client ID** and **Client Secret** it gives you.

## What to send me

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

I'll add those to `/home/claude/epicentre.env` on the VPS and build the
actual OAuth connect flow + one-way push sync at that point — holding off on
writing untestable sync logic blind.
