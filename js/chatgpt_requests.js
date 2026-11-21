// Explicit request dependencies; no DOM, account lookup, editor effects or feedback.
async function requestChatGptTemplate(templateType, outputFormat, account, deps) {
    const messages = [
        { role: 'system', content: 'You are a helpful assistant that generates templates for various documents. The templates are detailed and expressive, providing help and suggestions for the user.' },
        { role: 'user', content: `Create a detailed and expressive template in ${outputFormat}, for a ${templateType} type template, containing help and suggestions for the user. If it is a text type template, do not use HTML; still completely in markdown. Otherwise, it it's a HTML type template, style the template properly for the appropriate format. Use a string or 'lorem ipsum' to indicate a body of text. Use heading text only where headings would be appropriate in the document. It needs to be more than a very basic structure. The objective is to provide as much guidance as possible. Make sure instructions for the user can be read in the browser as italics text, and are not comments that are not displayed in browsers.` }
    ];
    let result = '';
    while (true) {
        deps.assertCurrent();
        const response = await deps.fetch(account.apiUrl, { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.apiKey },
            body: JSON.stringify({ model: 'gpt-4', messages, max_tokens: 2000 }) });
        deps.assertCurrent();
        if (!response.ok) throw Error('HTTP error! Status: ' + response.status);
        const data = await response.json(); deps.assertCurrent();
        const choice = data?.choices?.[0];
        if (!choice || typeof choice.message?.content !== 'string') throw Error('AI service returned an invalid template response.');
        const content = choice.message.content;
        if (!['stop', 'length'].includes(choice.finish_reason)) throw Error('Unexpected finish reason: ' + choice.finish_reason);
        result += content;
        if (choice.finish_reason === 'stop') return result;
        if (!content) throw Error('AI template continuation returned no content.');
        messages.push({ role: 'assistant', content });
    }
}
