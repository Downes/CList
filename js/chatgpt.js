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

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['AI'] = {
    type: 'AI',
    instanceFromKey: false,
    kvKey: { label: 'Project', placeholder: 'project ID or name' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text',     placeholder: 'My AI Service',            default: '' },
        { key: 'instance',    label: 'API URL',     editable: true, inputType: 'text',     placeholder: 'https://api.openai.com/v1', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text',     placeholder: 'g',                        default: '' },
        { key: 'id',          label: 'API Key',     editable: true, inputType: 'password', placeholder: '',                         default: '' },
    ]
};


async function generateNewTemplateFromChatGPT(templateType, outputFormat) {

    // Get generater from accounts
    // Assumes 'accounts' array has been preloaded
    // If necessary, fetch the accounts from the KVstore
    if (accounts.length === 0) {
        try {
            // Fetch the accounts from the KVstore
            accounts = await getAccounts(flaskSiteUrl); 

        } catch (error) {
            showStatusMessage('Error getting Editor accounts: ' + error.message);
        }
    }
    
    let API_KEY = null;
    let API_URL = null;

     accounts.forEach(account => {                           // Check the accounts
        const parsedValue = parseAccountValue(account);
        if (!parsedValue) return;
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
        throw new Error('No ChatGPT account found. Open Accounts and add an account with permission "g".');
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


// Generate a template using ChatGPT. Shows a form in #load-options and resolves
// with the generated content once the user submits.
async function generateTemplateContent() {
    const formDiv = document.createElement('div');
    formDiv.id = 'generate-template-form';
    formDiv.innerHTML = `
        <div style="padding: 10px;">
            <label for="templateType">Choose a template type:</label><br>
            <select id="templateType">
                <option value="business letter">Business Letter</option>
                <option value="case study">Case Study</option>
                <option value="lab report">Lab Report</option>
                <option value="resume">Resume</option>
                <option value="newsletter">Newsletter</option>
            </select><br><br>
            <label for="customTemplateType">Or enter your own template type:</label><br>
            <input type="text" id="customTemplateType" placeholder="e.g., marketing proposal"><br><br>
            <label for="outputFormat">Choose output format:</label><br>
            <select id="outputFormat">
                <option value="text">Text</option>
                <option value="html">HTML</option>
            </select><br><br>
            <button id="generateTemplateButton" class="final-save-button">Generate Template</button>
        </div>
    `;

    const optionsDiv = document.getElementById('load-options');
    if (optionsDiv) {
        optionsDiv.innerHTML = '';
        optionsDiv.appendChild(formDiv);
    }

    return new Promise(resolve => {
        const button = document.getElementById('generateTemplateButton');
        button.addEventListener('click', async event => {
            event.preventDefault();
            button.disabled = true;

            const templateType = document.getElementById('templateType').value;
            const customTemplateType = document.getElementById('customTemplateType').value.trim();
            const outputFormat = document.getElementById('outputFormat').value;
            const finalTemplateType = customTemplateType || templateType;

            // Clear any previous error
            formDiv.querySelectorAll('.template-error').forEach(el => el.remove());

            showLoader();
            try {
                const template = await generateNewTemplateFromChatGPT(finalTemplateType, outputFormat);
                const extractedContent = extractCodeContent(template);
                document.getElementById('loading-indicator').style.display = 'none';
                if (formDiv.parentNode) formDiv.parentNode.removeChild(formDiv);
                resolve({
                    type: outputFormat === 'html' ? 'text/html' : 'text/plain',
                    value: extractedContent
                });
            } catch (error) {
                document.getElementById('loading-indicator').style.display = 'none';
                const msg = document.createElement('p');
                msg.className = 'template-error feed-status-message';
                msg.textContent = `Could not generate template: ${error.message}`;
                formDiv.appendChild(msg);
                button.disabled = false;
            }
        });
    });
}

function extractCodeContent(template) {
    const regex = /```(?:\w*\n)?([\s\S]*?)```/;
    const match = template.match(regex);
    return match && match[1] ? match[1].trim() : template;
}

(function () {
    window.loadHandlers = window.loadHandlers || [];
    window.loadHandlers.push({
        label: 'Generate template',
        icon:  'auto_awesome',
        load:  async () => await generateTemplateContent()
    });
})();