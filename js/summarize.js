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
        const parsedValue = JSON.parse(account.value);
        console.log("checking account: ", parsedValue);
        if (parsedValue.permissions.includes('z')) {  // Check if 'permissions' contains 'z'
            console.log("FOUND account: ", parsedValue);
            console.log("parsedValue.id: ", parsedValue.id);
            console.log("parsedValue.key: ", parsedValue.key);
            apiKey = parsedValue.id;
            url = parsedValue.instance;
        }
    });


    // Check for required values and handle errors
    if (!apiKey || !url) {
        alert("Both apiKey and url are required to continue.");
        throw new Error("Missing required values: apiKey or url.");
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

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            alert(`Error: ${response.status} ${response.statusText}`);
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "No summary available.";
    } catch (error) {
        console.error("Failed to summarize text:", error.message);
        return "Error summarizing text. Please try again.";
    }
}

async function handleSummarize(input,output,type) {

    const summaryText = document.getElementById(output);
    // const summarizeBtn = document.getElementById("summarizeBtn");

    inputText = getInputText(input);

    // Disable button while processing
    //summarizeBtn.disabled = true;
    summaryText.textContent = "Summarizing... Please wait.";

    const summary = await summarizeText(inputText, type);

    // Clear previous content S
    summaryText.textContent = "";

    // Add class "status-box" to summaryText
    summaryText.className = "status-box";

    // Create the child div with class "status-content"
    const statusContent = document.createElement("div");
    statusContent.className = "status-content";
    statusContent.textContent = summary;
    statusContent.id = "summary";

    // Create the child div with class "clist-actions"
    const clistActions = document.createElement("div");
    clistActions.className = "clist-actions";

    // Add a button inside "clist-actions"
    clistActions.innerHTML = `<button class="material-icons md-18 md-light" onClick="handleMastodonAction('summary', 'load',this.parentElement.parentElement)">arrow_right</button>`;



    // Append the two child divs to summaryText
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