async function requestTranslationStep(text, language, key, deps) {
    const detect = language == null;
    const url = 'https://translation.googleapis.com/language/translate/v2' + (detect ? '/detect' : '') + '?key=' + encodeURIComponent(key);
    const response = await deps.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detect ? { q: text } : { q: text, source: language, target: 'en', format: 'html' }) });
    if (!response.ok) throw Error('Translation service returned HTTP ' + response.status + '.');
    const data = await response.json();
    const value = detect ? data?.data?.detections?.[0]?.[0]?.language : data?.data?.translations?.[0]?.translatedText;
    if (value != null && typeof value !== 'string') throw Error('Translation service returned an invalid response.');
    return value || (detect ? 'unknown' : '');
}
async function runTranslationWorkflow(text, key, deps) {
    deps.assertCurrent(); const language = await requestTranslationStep(text, null, key, deps); deps.assertCurrent();
    if (language === 'en' || language === 'und') return text;
    const result = await requestTranslationStep(text, language, key, deps); deps.assertCurrent(); return result;
}
