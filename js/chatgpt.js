//  chatgpt.js  -  helper and utility functions for ChatGPT API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['AI'] = {
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


async function generateNewTemplateFromChatGPT(templateType, outputFormat, current = () => true) {
    return getChatGptTemplateRequests().generate(templateType, outputFormat, current);
}

// Generate a template using ChatGPT. Shows a form in #load-options and resolves
// with the generated content once the user submits.
async function generateTemplateContent() { return openTemplateForm(); }

function extractCodeContent(template) {
    const regex = /```(?:\w*\n)?([\s\S]*?)```/;
    const match = template.match(regex);
    return match && match[1] ? match[1].trim() : template;
}

(function () {
    window.CList.loaders = window.CList.loaders || [];
    window.CList.loaders.push({
        label:   'Generate template',
        icon:    'auto_awesome',
        // Declared for documentation; visible() below is the actual gate since it must
        // also match the account TYPE (AI specifically), which the flags alone can't express.
        requiresLogin:   true,
        requiresAccount: true,
        visible: () => typeof hasAIAccount === 'function' && hasAIAccount(),
        load:    async () => await generateTemplateContent()
    });
})();