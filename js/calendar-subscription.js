//  calendar-subscription.js  -  schema for a subscribed read-only ICS calendar feed
//  Part of CList, the next generation of learning and connecting with your community
//
//  Registers the Calendar account schema only -- deliberately no
//  window.CList.readers['Calendar'] entry, the same shape as
//  Annotate/Hypothesis. These accounts are never clicked-to-navigate through
//  the ordinary reader dispatch; js/calendar-browser.js reads them directly
//  to build the calendar's "sources" toggle list and fetch their events
//  (js/calendar-subscriptions.js).
//
//  The storage key has no external meaning for this type (unlike, say, a
//  username), so the form hides it and derives it from the Title field
//  instead of asking for both -- see accountHooks.Calendar.decorateForm.
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

(function () {
    window.CList.schemas = window.CList.schemas || {};
    window.CList.schemas.Calendar = {
        type: 'Calendar',
        instanceFromKey: true,
        kvKey: { label: 'Account Name', placeholder: 'Calendar subscription' },
        fields: [
            { key: 'title', label: 'Title', editable: true, inputType: 'text', default: '' },
            { key: 'url', label: 'ICS Feed URL', editable: true, inputType: 'url', default: '' },
            { key: 'permissions', label: 'Permissions', editable: false, inputType: 'text', default: 'r' },
        ],
    };

    window.CList.accountHooks = window.CList.accountHooks || {};
    window.CList.accountHooks.Calendar = {
        /** @param {CListAccountFormContext} context */
        decorateForm(context) {
            const keyInput = context.root.querySelector('#_keyInput');
            const titleInput = context.root.querySelector('#titleInput');
            if (!keyInput || !titleInput) return;
            if (keyInput.parentNode) keyInput.parentNode.style.display = 'none';
            if (context.mode !== 'create') return;
            const deriveKey = () => {
                const taken = new Set((window.CList.accounts || []).map(account => account.key));
                const base = slugify(titleInput.value, { fallback: 'calendar' });
                let candidate = base, suffix = 2;
                while (taken.has(candidate)) candidate = `${base}-${suffix++}`;
                keyInput.value = candidate;
            };
            titleInput.addEventListener('input', deriveKey);
            deriveKey();
        },
    };
})();
