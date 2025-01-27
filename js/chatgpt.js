//  chatgpt.js  -  helper and utility functions for ChatGPT API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

async function generateTemplateFromChatGPT() {
  
  // Get user input
  let templateType = document.getElementById("customTemplateType").value.trim();
  let outputFormat = document.getElementById("outputFormat").value;
  if (!templateType) { templateType = document.getElementById("templateType").value; }
  if (!templateType || !outputFormat) { 
    alert("Error generating template; see console.");
    console.error("template type or output format not defined.");
    return;
  }

  // Set up template div
  // Check if templateDiv exists; create it if it doesn't
  let templateDiv = document.getElementById("templateDiv");

  if (!templateDiv) {
    // Create the div element
    templateDiv = document.createElement("div");
    templateDiv.id = "templateDiv"; // Set the ID

    // Optionally, you can add it to a specific parent element
    document.body.appendChild(templateDiv); // Append to the body or a specific container
  }

  //const templateDiv = document.getElementById("templateDiv");
  templateDiv.innerHTML = "";

  try {
    // Make a single API call to generate the template
    const template = await generateNewTemplateFromChatGPT(templateType, outputFormat);

    // Display the generated template
    if (outputFormat === "text") {
      templateDiv.innerHTML = `<pre>${template}</pre>`;
    } else {
      templateDiv.innerHTML = template; // Render HTML
    }
  } catch (error) {
    // Handle errors
    templateDiv.innerHTML = "<p style='color:red;'>Error generating template. Please try again.</p>";
    console.error("Error generating template:", error);
  } 
}

async function generateNewTemplateFromChatGPT(templateType, outputFormat) {

    // Get generater from accounts
    // Assumes 'accounts' array has been preloaded
    // If necessary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            alert('Error getting Editor accounts: ' + error.message);
        }
    }
    
    let API_KEY = null;
    let API_URL = null;

     accounts.forEach(account => {                           // Check the accounts
        const parsedValue = JSON.parse(account.value);
        console.log("checking account: ", parsedValue);
        if (parsedValue.permissions.includes('g')) {  // Check if 'permissions' contains 'g'
            console.log("FOUND account: ", parsedValue);
            console.log("parsedValue.id: ", parsedValue.id);
            console.log("parsedValue.key: ", parsedValue.key);
            API_KEY = parsedValue.id;
            API_URL = parsedValue.instance;
        }
    });


    // Check for required values and handle errors
    if (!API_KEY || !API_URL) {
        alert("ApiKey and url are both required to continue.");
        throw new Error("Missing required values: apiKey or url.");
    }


  const maxTokens = 2000; // Adjust based on your needs

  let isComplete = false;
  let fullTemplate = "";
  let messages = [
    { role: 'system', content: 'You are a helpful assistant that generates templates for various documents. The templates are detailed and expressive, providing help and suggestions for the user.' },
    { role: 'user', content: `Create a detailed and expressive template in ${outputFormat}, for a ${templateType} type template, containing help and suggestions for the user. If it is a text type template, do not use HTML; still completely in markdown. Otherwise, it it's a HTML type template, style the template properly for the appropriate format. Use a string or 'lorem ipsum' to indicate a body of text. Use heading text only where headings would be appropriate in the document. It needs to be more than a very basic structure. The objective is to provide as much guidance as possible. Make sure instructions for the user can be read in the browser as italics text, and are not comments that are not displayed in browsers.` }
  ];

  while (!isComplete) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    fullTemplate += choice.message.content;

    if (choice.finish_reason === "stop") {
      isComplete = true;
    } else if (choice.finish_reason === "length") {
      // Add the assistant's current response to the conversation and continue
      messages.push({ role: "assistant", content: choice.message.content });
    } else {
      throw new Error("Unexpected finish reason: " + choice.finish_reason);
    }
  }

  return fullTemplate;
}