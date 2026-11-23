//  summarize.js  -  Summarizes text using OpenAI's GPT-4 model
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



function summaryAccount() {
    return requireAccountWithPermission('z', "No AI account found. Add an account with permission 'z' to use summarization.");
}
async function summarizeText(textToSummarize, type) {
    return requestSummary(textToSummarize, type, summaryAccount(), { fetch: (...args) => fetch(...args) });
}
async function handleSummarize(input, output, type) { return showSummary(input, output, type); }
function getInputText(input) { return summaryInputHtml(document.getElementById(input)); }
