//  translate.js  -  Translates text using Google Translate API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
// 


async function handleTranslation() {
    const inputText = document.getElementById('inputText').value;
    const translatedText = await processTranslation(inputText);
    document.getElementById('translated-text').innerText = translatedText;
}

function getTranslationAccount() {

    // Find the account with permission 't'
    // Assumes accounts array loaded with getAccounts()
    const targetAccount = accounts.find(account => {
        const parsedValue = JSON.parse(account.value);
        return parsedValue.permissions.includes('t');
    });
    
    // Extract the key and id
    let TranslationProjectId = null;
    let TranslationApiKey = null; 
    if (targetAccount) {
        const parsedValue = JSON.parse(targetAccount.value);
        TranslationProjectId = targetAccount.key;
        TranslationApiKey = parsedValue.id;  // Unfortunate mixing of variable names, oh well
    }
    return TranslationApiKey;
}

// Function to detect the language of input text
async function detectLanguage(inputText) {
    TranslationApiKey = getTranslationAccount();
    if (!TranslationApiKey) {
        console.log("No translation account");
        return 'en';
    }
    const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2/detect?key=${TranslationApiKey}`, 
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: inputText })
        }
    );

    const data = await response.json();
    const detectedLang = data?.data?.detections[0][0]?.language || 'unknown';
    //console.log(`Detected Language: ${detectedLang}`);
    return detectedLang;
}

// Function to translate text into English
async function translateToEnglish(inputText, sourceLang) {
    TranslationApiKey = getTranslationAccount();
    if (!TranslationApiKey) {
        console.log("No translation account");
        return inputText;
    }
    const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${TranslationApiKey}`, 
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: inputText,
                source: sourceLang,
                target: 'en',
                format: 'text'
            })
        }
    );

    const data = await response.json();
    const translatedText = data?.data?.translations[0]?.translatedText || '';
    //console.log('Translated Text:', translatedText);
    return translatedText;
}

// Updated processTranslation function with a timeout
async function processTranslationWithTimeout(inputText) {

    // Make sure we have a translation account defined
    // and just return original text if we haven't
    TranslationApiKey = getTranslationAccount();
    if (!TranslationApiKey) {
        console.log("No translation account");
        return inputText;
    }

    try {
        const translatedText = await withTimeout(processTranslation(inputText), 5000); // 5 seconds timeout
        return translatedText;
    } catch (error) {
        console.error('Translation failed or timed out:', error);
        throw error;  // Re-throw the error to handle it in the calling code
    }
}

// Main function to detect and translate text
async function processTranslation(inputText) {
    try {
        const detectedLang = await detectLanguage(inputText);
        
        if (detectedLang === 'en') {
            //console.log('The text is already in English.', inputText);
            return inputText;
        } else if  (detectedLang === 'und') {
            //console.log('The language is undefined:', inputText);
            return inputText;
        }
        //console.log('Translating text from '+detectedLang);
        const translatedText = await translateToEnglish(inputText, detectedLang);
        return translatedText;
    } catch (error) {
        console.error('Error during translation:', error);
    }
}

// Example usage:
// const inputText = 'キャンピングカ';  // Replace with any text
// const inputText = '\u30AD\u30E3\u30F3\u30D4\u30F3\u30B0\u30AB';  // Japanese: "Camping Car"

//processTranslation(inputText);

