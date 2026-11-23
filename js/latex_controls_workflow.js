// Compile transport and plain source transformations; no DOM/global editor reads.
async function compileLatexSource(request, deps) {
    const response = await deps.fetch(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + request.token }, body: JSON.stringify({ source: request.source }) });
    if (response.ok) return response.blob();
    if (response.status === 422) {
        let result; try { result = await response.json(); } catch { throw new Error('LaTeX compile failed (unreadable error response).'); }
        throw new Error(result?.log || result?.error || 'LaTeX compile failed.');
    }
    throw new Error(response.status === 413 ? 'Document is too large to compile.' : response.status === 504 ? 'Compile timed out.' : 'Compile service returned an unexpected error (' + response.status + ').');
}
const LATEX_TEXT_ESCAPES = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '%': '\\%', '#': '\\#', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}' };
function escapeLatexText(value) { return String(value ?? '').replace(/[\\{}$&%#_^~]/g, char => LATEX_TEXT_ESCAPES[char]); }
function latexCitation(reference, displayName) {
    return reference ? '(' + escapeLatexText(displayName(reference)) + ', ' + (reference.created_at ? reference.created_at.slice(0, 4) : 'n.d.') + ')' : '';
}
/** @param {CListReference[]} references */
function latexBibliography(references) {
    if (!references?.length) return '';
    const lines = references.map((ref, index) => '\\bibitem{ref' + (index + 1) + '} ' + escapeLatexText(ref.author_name || '') + '. ' + escapeLatexText(ref.title || '') + '. \\textit{' + escapeLatexText(ref.feed || '') + '}. ' + (ref.created_at ? ref.created_at.slice(0, 10) : '') + '. ' + escapeLatexText(ref.url || ''));
    return '\\begin{thebibliography}{99}\n' + lines.join('\n') + '\n\\end{thebibliography}';
}
function latexBibliographyChange(text, selection, block) {
    const match = text.match(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/);
    return match ? { from: match.index, to: match.index + match[0].length, insert: block } : { from: selection.from, to: selection.to, insert: '\n' + block + '\n' };
}
