function prepareSummaryRequest(text, type) {
    const prompt = type === 'thread'
        ? `Please summarize the following discussion thread in a concise and clear manner, making it clear what the person who started the thread had to say, as well as any relevant responses. Please be factual and focus specifically on what the writes say, and avoid embelishing with phrases like 'started a discussion thread' or flowery adverbs like 'humorously':\n\n"${text}"`
        : `Please summarize the following text:\n\n"${text}"`;
    return { model: 'gpt-4', messages: [
        { role: 'system', content: 'You are a helpful assistant that summarizes content helpfully and efficiently. Feel frees to use less than the maxmimum tokens if you can summarize effectively with less.' },
        { role: 'user', content: prompt }
    ], max_tokens: Math.floor(Math.max(Math.ceil(text.length / 4) * 0.2, 100)), temperature: 0.3 };
}
async function requestSummary(text, type, account, deps) {
    const response = await deps.fetch(account.apiUrl, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.apiKey },
        body: JSON.stringify(prepareSummaryRequest(text, type)) });
    if (!response.ok) throw Error(`AI service returned ${response.status} ${response.statusText}.`);
    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content;
    if (result != null && typeof result !== 'string') throw Error('AI service returned an invalid summary.');
    return result || 'No summary available.';
}
