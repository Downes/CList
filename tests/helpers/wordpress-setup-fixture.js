function wordPressSetupFixture() {
    const auth = wordPressAuthFixture(), root = document.createElement('div'); document.body.appendChild(root); let back = 0;
    const panel = window.CList.accountFlows.WordPress({ container: root, back() { back++; root.innerHTML = ''; } }); panel.open();
    return { auth, root, panel, get back() { return back; },
        input(value) { root.querySelector('#wp-site-url').value = value; },
        start() { return root.querySelector('#wp-auth-btn').onclick(); }, close() { return root.querySelector('#wp-back-btn').onclick(); },
        dispose() { root.remove(); auth.dispose(); },
    };
}
const wordPressSetupCases = [
    ['real form validates and normalizes site input before bound authorization', async check => {
        const f = wordPressSetupFixture(); await f.start();
        check(!f.auth.redirects.length && f.root.textContent.includes('Please enter'), 'blank site feedback');
        f.input('https://name:password@blog.invalid'); await f.start();
        check(!f.auth.redirects.length && f.root.textContent.includes('without credentials'), 'unsafe site rejected');
        f.input('blog.invalid/subsite/'); await f.start();
        check(new URL(f.auth.redirects[0]).origin === 'https://blog.invalid', 'scheme normalized with existing bound workflow');
        check(f.root.querySelector('#wp-auth-btn').disabled && window.CList.state.wordPressSetup.phase === 'redirecting', 'redirect state owns disabled control'); f.dispose();
    }],
    ['duplicate and remounted controls retain one pending start and reject detached callbacks', async check => {
        const f = wordPressSetupFixture(), gate = wordPressAuthGate(); f.input('blog.invalid'); f.auth.behavior.hash = () => gate.promise;
        const old = f.root.querySelector('#wp-auth-btn'), pending = f.start(); check(pending === f.start(), 'duplicate starts share pending promise');
        await oauthAccountFlush(); f.panel.open();
        check(f.root.querySelector('#wp-auth-btn').disabled && f.start() === pending, 'pending lock survives rebuilt form');
        check(old.onclick() === false, 'detached control cannot dispatch'); gate.resolve(); await pending;
        check(!f.auth.redirects.length && !f.auth.flows.size && !window.CList.state.wordPressSetup.busy, 'replaced draft expires pending authorization and unlocks'); f.dispose();
    }],
    ['Back, raw input edits, hidden surfaces and changed sessions expire hashing work', async check => {
        for (const mode of ['back', 'input', 'hidden', 'session']) {
            const f = wordPressSetupFixture(), gate = wordPressAuthGate(); f.input('blog.invalid'); f.auth.behavior.hash = () => gate.promise;
            const pending = f.start(); await oauthAccountFlush();
            if (mode === 'back') f.close(); else if (mode === 'input') f.input('different.invalid'); else if (mode === 'hidden') f.root.style.display = 'none'; else f.auth.account.token('different-session');
            gate.resolve(); await pending;
            check(!f.auth.redirects.length && !f.auth.flows.size, 'expired ' + mode + ' cannot navigate or persist');
            if (mode === 'back') check(f.back === 1, 'Back returned to original panel'); f.dispose();
        }
    }],
    ['owned errors stay inline and explicit retry preserves the edited form', async check => {
        const f = wordPressSetupFixture(); f.input('blog.invalid'); f.auth.behavior.hash = async () => { throw new Error('Synthetic preparation failure'); };
        await f.start();
        check(f.root.textContent.includes('Synthetic preparation failure') && !f.root.querySelector('#wp-auth-btn').disabled, 'preparation failure rendered inline and unlocked');
        check(!f.auth.account.messages.includes('Synthetic preparation failure'), 'form owns its failure instead of global feedback');
        f.auth.behavior.hash = null; await f.start();
        check(f.auth.redirects.length === 1 && f.root.querySelector('#wp-site-url').value === 'blog.invalid', 'explicit retry retains form values');
        check(!JSON.stringify(window.CList.state.wordPressSetup).includes('blog.invalid'), 'state excludes site and credentials'); f.dispose();
    }],
];
