//  summarize.js  -  Summarizes text using OpenAI's GPT-4 model
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



async function summarizeText(textToSummarize, type) {

    // Get summarizer from accounts
    // Assumes 'accounts' array has been preloaded
    
    let apiKey = null;
    let url = null;

     accounts.forEach(account => {                           // Check the accounts
        const parsedValue = parseAccountValue(account);
        if (!parsedValue) return;
        console.log("checking account: ", parsedValue);
        if (parsedValue.permissions.includes('z')) {  // Check if 'permissions' contains 'z'
            console.log("FOUND account: ", parsedValue);
            console.log("parsedValue.id: ", parsedValue.id);
            console.log("parsedValue.key: ", parsedValue.key);
            apiKey = parsedValue.id;
            url = parsedValue.instance;
        }
    });


    if (!apiKey || !url) {
        throw new Error("No AI account found. Add an account with permission 'z' to use summarization.");
    }


    let prompt;
    if (type === 'thread') {
        prompt = `Please summarize the following discussion thread in a concise and clear manner, making it clear what the person who started the thread had to say, as well as any relevant responses. Please be factual and focus specifically on what the writes say, and avoid embelishing with phrases like 'started a discussion thread' or flowery adverbs like 'humorously':\n\n"${textToSummarize}"`;
    } else {
         prompt = `Please summarize the following text:\n\n"${textToSummarize}"`;
    }

    // Approximate tokens: ~4 characters per token
    const inputTokenCount = Math.ceil(textToSummarize.length / 4);
    const maxTokens = Math.floor(Math.max(inputTokenCount * 0.2, 100));

    const requestBody = {
        model: "gpt-4", // Use "gpt-3.5-turbo" if GPT-4 isn't available
        messages: [
            { role: "system", content: "You are a helpful assistant that summarizes content helpfully and efficiently. Feel frees to use less than the maxmimum tokens if you can summarize effectively with less." },
            { role: "user", content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`AI service returned ${response.status} ${response.statusText}.`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No summary available.";
}

async function handleSummarize(input,output,type) {

    const summaryText = document.getElementById(output);
    // const summarizeBtn = document.getElementById("summarizeBtn");

    inputText = getInputText(input);

    summaryText.textContent = "Summarizing... Please wait.";
    summaryText.className = "";

    let summary;
    try {
        summary = await summarizeText(inputText, type);
    } catch (error) {
        console.error("Failed to summarize:", error.message);
        summaryText.className = "error-message";
        summaryText.textContent = `Could not summarize: ${error.message} (Note: direct browser calls to OpenAI are blocked by CORS — a server-side proxy is required.)`;
        return;
    }

    summaryText.textContent = "";
    summaryText.className = "status-box";

    const statusContent = document.createElement("div");
    statusContent.className = "status-content";
    statusContent.textContent = summary;
    statusContent.id = "summary";

    const clistActions = document.createElement("div");
    clistActions.className = "clist-actions";
    clistActions.innerHTML = `<button class="material-icons md-18 md-light" onClick="handleMastodonAction('summary', 'load',this.parentElement.parentElement)">arrow_right</button>`;

    summaryText.appendChild(statusContent);
    summaryText.appendChild(clistActions);




}

function getInputText(input) {
    let item_content;
    const inputContainer = document.getElementById(input);
    const tempContainer = inputContainer.cloneNode(true);
    const feedHeader = tempContainer.querySelector(".feed-header");
    if (feedHeader) {  feedHeader.remove(); } // Remove the feedHeader div and all the action buttons
    tempContainer.querySelectorAll(".status-actions").forEach(element => element.remove());
    tempContainer.querySelectorAll(".clist-actions").forEach(element => element.remove());
    item_content = tempContainer.innerHTML;
    return item_content;
}