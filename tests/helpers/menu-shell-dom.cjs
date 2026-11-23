const { NavigationElement } = require('./navigation-dom.cjs');
function menuShellDocument() {
    const doc = { activeElement: null, addEventListener() {} };
    doc.createElement = tag => {
        const node = new NavigationElement(tag);
        node.tabIndex = ['button', 'input', 'select', 'textarea'].includes(tag) ? 0 : -1;
        Object.defineProperty(node, 'isConnected', { get() {
            let current = node; while (current) { if (current === doc.body) return true; current = current.parentNode; } return false;
        } });
        node.focus = () => { doc.activeElement = node; };
        node.getClientRects = () => node.isConnected ? [{}] : [];
        return node;
    };
    doc.body = doc.createElement('body'); doc.activeElement = doc.body;
    doc.getElementById = id => doc.body.querySelector('#' + id);
    return doc;
}
module.exports = { menuShellDocument };
