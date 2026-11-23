// Current LaTeX chrome; no provider/global reference operations.
function createLatexResourceView(target) {
    const status = document.getElementById('latex-status'), who = document.getElementById('latex-who');
    const visible = () => currentEditor === 'latex' && currentLatexResourceTarget(target);
    return {
        status(value) { if (visible() && status && status === document.getElementById('latex-status')) status.textContent = value; },
        presence(states) {
            if (!visible() || !who || who !== document.getElementById('latex-who')) return;
            who.textContent = '';
            states.filter(state => state?.user).forEach(state => {
                const user = document.createElement('span'); user.className = 'latex-user';
                user.style.color = /^#[0-9a-f]{3,6}$/i.test(state.user.color || '') ? state.user.color : '#888';
                user.textContent = '● ' + (typeof state.user.name === 'string' ? state.user.name : 'Anonymous'); who.appendChild(user);
            });
        },
        error(stage, error) {
            console.error('[LaTeX ' + stage + ']', error);
            if (!currentLatexResourceTarget(target)) return;
            let feedback = target.root.querySelector('.latex-resource-error');
            if (!feedback) { feedback = document.createElement('div'); feedback.className = 'error-message latex-resource-error'; feedback.setAttribute('role', 'alert'); target.root.appendChild(feedback); }
            feedback.textContent = 'LaTeX ' + stage + ': ' + (error.message || String(error));
        },
    };
}
