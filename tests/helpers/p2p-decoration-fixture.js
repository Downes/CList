const p2pDecorationCases = [
    ['legacy quoted HTTPS detection and detached public presentation', check => {
        const model = prepareP2pEtherpadLink('<a href="https://etherpad.invalid/p/test">Pad</a>', '<b>Sender</b>');
        check(model.link === 'https://etherpad.invalid/p/test' && model.sender === '<b>Sender</b>', 'recognition captures literal sender/link');
        check(Object.keys(model).join() === 'link,sender', 'no session/credentials in presentation model');
        check(prepareP2pEtherpadLink("'https://host.invalid/etherpad/test'", 'A').link === 'https://host.invalid/etherpad/test', 'legacy substring recognition retained');
    }],
    ['ordinary text and legacy nonmatching formats remain unchanged', check => {
        for (const text of ['plain text', 'https://etherpad.invalid/p/test', '"http://etherpad.invalid/p/test"', '"https://Etherpad.invalid/p/test"', '"javascript:etherpad"'])
            check(prepareP2pEtherpadLink(text, 'Sender') === null, 'unchanged input: ' + text);
    }],
    ['only the first eligible URL controls legacy decoration', check => {
        check(prepareP2pEtherpadLink('"https://other.invalid/a" "https://etherpad.invalid/p/test"', 'Sender') === null, 'first non-pad URL preserves original content');
        check(prepareP2pEtherpadLink('<https://etherpad.invalid/p/first> "https://etherpad.invalid/p/second"', 'Sender').link.endsWith('/first'), 'first pad URL selected');
    }],
    ['compatibility wrappers delegate recognized models and preserve original input', check => {
        const render = renderP2pEtherpadLink, calls = [];
        globalThis.renderP2pEtherpadLink = model => { calls.push(model); return 'rendered pad'; };
        try {
            check(chatOptions('"https://etherpad.invalid/p/test"', 'Captured') === 'rendered pad', 'chatOptions uses workflow/view through wrapper');
            check(findEtherpadLink('ordinary', 'Sender') === 'ordinary' && calls.length === 1, 'nonmatching text bypasses renderer');
            check(calls[0].sender === 'Captured', 'literal captured metadata passed to view');
        } finally { globalThis.renderP2pEtherpadLink = render; }
    }]
];
