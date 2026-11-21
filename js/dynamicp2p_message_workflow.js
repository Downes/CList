// DOM-free message preparation; retain legacy extension fields and supplied message IDs.
function prepareP2pIncomingMessage(data, sender, id) {
    if (!data || data.type !== 'message' || typeof data.message !== 'string'
        || (data.msgId != null && typeof data.msgId !== 'string')) throw Error('Received an invalid chat message.');
    const packet = { ...structuredClone(data), type: 'message', msgId: data.msgId || id };
    return { packet, sender: typeof packet.username === 'string' && packet.username ? packet.username : String(sender) };
}
function prepareP2pOutgoingMessage(text, sender, id, signature) {
    return { type: 'message', message: text, username: sender.username, did: sender.did, signature, msgId: id };
}

// Preserve the legacy first quoted/bracketed HTTPS URL heuristic, including
// the case-sensitive substring check; this is presentation, not service discovery.
function prepareP2pEtherpadLink(content, sender) {
    const match = /['"<](https:\/\/[^\s'"><]+)[>\s'"]/.exec(content);
    return match?.[1].includes('etherpad') ? { link: match[1], sender: String(sender) } : null;
}
