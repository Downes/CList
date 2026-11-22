// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
// Publishing your own calendar as a public ICS feed -- the CList-side half
// of a contract mirrored on kvstore's existing did.json pattern (see
// updateDid()/generateAndRegisterDid() in kvstore.js):
//   PUT    {flaskSiteUrl}/auth/calendar               Bearer auth, body { ics }
//   GET    {flaskSiteUrl}/users/{username}/calendar.ics   public, unauthenticated
//   DELETE {flaskSiteUrl}/auth/calendar               Bearer auth, unpublish
//
// The kvstore backend for these routes is a separate follow-up task in that
// app; until it ships, these calls fail with a 404, surfaced the same way
// any other failure here is.

function ownCalendarUrl() {
    return `${window.CList.config.flaskSiteUrl}/users/${window.CList.state.username}/calendar.ics`;
}

// Builds ICS from the caller's own stored events and PUTs it to kvstore.
async function publishOwnCalendar(session) {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) throw new Error('Not logged in');
    const events = await listCalendarEvents({ session });
    const ics = buildIcsCalendar(events, { calName: `${window.CList.state.username}'s Calendar` });
    const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ ics }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

async function unpublishOwnCalendar() {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    if (!token) throw new Error('Not logged in');
    const res = await fetch(`${window.CList.config.flaskSiteUrl}/auth/calendar`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
}

// Unauthenticated -- true if a calendar.ics document currently exists for
// the logged-in user, false on a 404 or any network failure.
async function ownCalendarPublishStatus() {
    try {
        const res = await fetch(ownCalendarUrl());
        return { published: res.ok, url: ownCalendarUrl() };
    } catch {
        return { published: false, url: ownCalendarUrl() };
    }
}
