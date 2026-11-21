// Shared labelled action controls; definitions and command ownership live outside the DOM.
function createActionMenuView(container, buttonClass = 'btn btn-small') {
    const buttons = [];
    return {
        alive: () => container.isConnected,
        mount(items, activate, navigate) {
            items.forEach((item, index) => {
                const button = document.createElement('button');
                button.type = 'button'; button.className = buttonClass;
                button.textContent = item.label;
                button.setAttribute('aria-pressed', String(item.selected));
                if (item.selected) button.classList.add('is-active');
                button.onclick = () => activate(index);
                button.onkeydown = event => {
                    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
                        || event.shiftKey || event.isComposing) return;
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                    if (navigate(index, event.key)) event.preventDefault();
                };
                buttons.push(button); container.appendChild(button);
            });
        },
        current: index => buttons[index]?.parentNode === container,
        update(disabled, focused) {
            buttons.forEach((button, index) => {
                button.disabled = disabled[index]; button.tabIndex = index === focused ? 0 : -1;
            });
        },
        focus: index => buttons[index]?.focus(),
        dispose() { buttons.forEach(button => { button.onclick = null; button.onkeydown = null; }); }
    };
}
