// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
// Minimal RFC 5545 (iCalendar) parser/generator. Pure, DOM-free, no fetch —
// VEVENT only, no RRULE expansion (a recurring event yields its base
// occurrence only, matching calendar.js's own no-recurrence V1 decision),
// no VTIMEZONE/TZID (UTC only; a bare local time is treated as UTC). Hand
// written, no CDN/library import — consistent with the project's existing
// zero-runtime-dependency convention.

// Joins RFC 5545 folded continuation lines (a line starting with a single
// space or tab continues the previous line) back into one logical line per
// property.
function _unfoldIcsLines(text) {
    const raw = text.split(/\r\n|\r|\n/);
    const lines = [];
    for (const line of raw) {
        if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
            lines[lines.length - 1] += line.slice(1);
        } else {
            lines.push(line);
        }
    }
    return lines;
}

// Soft-wraps a single logical property line at 75 characters, per RFC 5545's
// line-folding rule (continuation lines are prefixed with one space). Counts
// JS string characters, not UTF-8 octets — a documented simplification, fine
// for the ASCII-heavy property lines this module generates.
function _foldIcsLine(line) {
    if (line.length <= 75) return line;
    const parts = [line.slice(0, 75)];
    let rest = line.slice(75);
    while (rest.length) {
        parts.push(' ' + rest.slice(0, 74));
        rest = rest.slice(74);
    }
    return parts.join('\r\n');
}

function _icsEscapeText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function _icsUnescapeText(value) {
    return String(value ?? '')
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

// Splits "NAME;PARAM=VALUE;...:value" into { name, params, value }. Params
// are matched case-insensitively by key (VALUE=DATE is the only one this
// module reads) but kept verbatim otherwise.
function _parseIcsPropertyLine(line) {
    const colon = line.indexOf(':');
    if (colon === -1) return null;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...paramParts] = head.split(';');
    const params = {};
    for (const part of paramParts) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    return { name: name.toUpperCase(), params, value };
}

// YYYYMMDD or YYYYMMDDTHHMMSS[Z] -> { iso, allDay }. Returns null if the
// value doesn't match either recognized form.
function _parseIcsDateValue(value, params) {
    const dateOnly = /^(\d{4})(\d{2})(\d{2})$/;
    const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;
    if (params.VALUE === 'DATE' || dateOnly.test(value)) {
        const m = value.match(dateOnly);
        if (!m) return null;
        return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
    }
    const m = value.match(dateTime);
    if (!m) return null;
    // No VTIMEZONE/TZID support: a bare (non-Z) local time is treated as UTC.
    return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`, allDay: false };
}

/**
 * Parses ICS text into an array of event-like objects. VEVENT blocks only; a
 * malformed VEVENT (missing UID or an unparseable DTSTART) is skipped rather
 * than aborting the whole feed.
 * @param {string} icsText
 * @returns {Array<{uid: string, title: string, start: string, end?: string, allDay?: boolean, location?: string, description?: string}>}
 */
function parseIcsCalendar(icsText) {
    const lines = _unfoldIcsLines(icsText || '');
    const events = [];
    let current = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') { current = {}; continue; }
        if (line === 'END:VEVENT') {
            if (current && current.uid && current.start) events.push(current);
            current = null;
            continue;
        }
        if (!current) continue;
        const prop = _parseIcsPropertyLine(line);
        if (!prop) continue;
        switch (prop.name) {
            case 'UID': current.uid = prop.value; break;
            case 'SUMMARY': current.title = _icsUnescapeText(prop.value); break;
            case 'LOCATION': current.location = _icsUnescapeText(prop.value); break;
            case 'DESCRIPTION': current.description = _icsUnescapeText(prop.value); break;
            case 'DTSTART': {
                const parsed = _parseIcsDateValue(prop.value, prop.params);
                if (parsed) { current.start = parsed.iso; current.allDay = parsed.allDay; }
                break;
            }
            case 'DTEND': {
                const parsed = _parseIcsDateValue(prop.value, prop.params);
                if (parsed) current.end = parsed.iso;
                break;
            }
            // RRULE, VTIMEZONE/TZID, and any other property are intentionally
            // ignored -- base occurrence only, UTC/floating-as-UTC only.
        }
    }
    return events.map(event => ({
        uid: event.uid,
        title: event.title || '',
        start: event.start,
        ...(event.end ? { end: event.end } : {}),
        ...(event.allDay ? { allDay: true } : {}),
        ...(event.location ? { location: event.location } : {}),
        ...(event.description ? { description: event.description } : {}),
    }));
}

function _icsDateStamp(iso, allDay) {
    if (allDay) return iso.replace(/-/g, '');
    const date = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
        + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/**
 * Builds ICS text from an array of CListCalendarEvent-shaped objects. Inverse
 * of parseIcsCalendar for the fields both sides support (no RRULE, no
 * VTIMEZONE/TZID).
 * @param {Array<{id?: string, uid?: string, title: string, start: string, end?: string, allDay?: boolean, location?: string, description?: string}>} events
 * @param {{calName?: string}} [opts]
 * @returns {string}
 */
function buildIcsCalendar(events, opts = {}) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CList//Calendar//EN', 'CALSCALE:GREGORIAN'];
    if (opts.calName) lines.push(_foldIcsLine('X-WR-CALNAME:' + _icsEscapeText(opts.calName)));
    const now = _icsDateStamp(new Date().toISOString(), false);
    for (const event of (events || [])) {
        lines.push('BEGIN:VEVENT');
        lines.push(_foldIcsLine('UID:' + (event.uid || event.id)));
        lines.push('DTSTAMP:' + now);
        lines.push(_foldIcsLine('SUMMARY:' + _icsEscapeText(event.title)));
        lines.push((event.allDay ? 'DTSTART;VALUE=DATE:' : 'DTSTART:') + _icsDateStamp(event.start, event.allDay));
        if (event.end) lines.push((event.allDay ? 'DTEND;VALUE=DATE:' : 'DTEND:') + _icsDateStamp(event.end, event.allDay));
        if (event.location) lines.push(_foldIcsLine('LOCATION:' + _icsEscapeText(event.location)));
        if (event.description) lines.push(_foldIcsLine('DESCRIPTION:' + _icsEscapeText(event.description)));
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
}
