// Blogger setup stores client configuration. Google authorization remains publication-time.
/** @returns {CListAccountSaveRequest} */
function bloggerSetupRequest(values) {
    const key = values.blogId.trim(), clientId = values.clientId.trim();
    if (!key) throw new Error('Please enter your Blog ID.');
    if (!clientId) throw new Error('Please enter your Client ID.');
    return { key, data: { type: 'Blogger', id: clientId, title: values.title.trim() || key, permissions: 'w' } };
}
function createBloggerSetupController(deps) {
    return createServiceAccountSetupController({ label: 'Blogger', request: bloggerSetupRequest }, deps);
}
