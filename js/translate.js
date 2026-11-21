//  translate.js  -  Translates text using Google Translate API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 


let translationEnabled = false; // Compatibility alias; controller owns the preference.
function getTranslationAccount() {
    const found = findAccountByPermission('t'); return found ? found.parsedValue.id : null;
}
function translationSource() {
    return JSON.stringify([readerSession(), readerState().requestId, window.CList.state.authEpoch || 0]);
}
const _translationController = createTranslationController({
    read: () => localStorage.getItem(window.CList.keys.TRANSLATION_ENABLED),
    write: value => localStorage.setItem(window.CList.keys.TRANSLATION_ENABLED, value),
    key: getTranslationAccount, source: translationSource,
    run: (text, key, assertCurrent) => runTranslationWorkflow(text, key, { assertCurrent, fetch: (...args) => fetch(...args) }),
    timeout: (work, ms) => withTimeout(work, ms),
    state: value => { translationEnabled = value.enabled; window.CList.state.translation = value; }
}, createTranslationView());
function toggleTranslation() { return _translationController.toggle(); }
function handleTranslation() { return _translationController.handle(); }
async function detectLanguage(text) {
    const key = getTranslationAccount(); return key ? requestTranslationStep(text, null, key, { fetch: (...args) => fetch(...args) }) : 'en';
}
async function translateToEnglish(text, language) {
    const key = getTranslationAccount(); return key ? requestTranslationStep(text, language, key, { fetch: (...args) => fetch(...args) }) : text;
}
function processTranslationWithTimeout(text) { return _translationController.run(text, true); }
function processTranslation(text) { return _translationController.run(text); }
