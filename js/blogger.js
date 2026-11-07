//  blogger.js  -  helper and utility functions for Blogger API
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
window.CList.schemas['Blogger'] = {
    type: 'Blogger',
    instanceFromKey: true,
    kvKey: { label: 'Blog ID', placeholder: '1234567890' },
    fields: [
        { key: 'title',       label: 'Blog Title', editable: true, inputType: 'text',     placeholder: 'My Blog', default: '' },
        { key: 'permissions', label: 'Permissions',editable: true, inputType: 'text',     placeholder: 'w',       default: 'w' },
        { key: 'id',          label: 'Client ID',  editable: true, inputType: 'text',     placeholder: '123456.apps.googleusercontent.com', default: '' },
    ]
};

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Blogger'] = {
        acceptedFormats: ['html', 'md', 'text'],
        publish: async (accountData, title, content) => {
            const plainTitle = derivePlainTitle(title, content);
            return await publishBloggerPost(
                accountData.instance,
                accountData.id,
                plainTitle,
                content
            );
        }
    };
})();

// Publish a post to a Blogger account
// publishBloggerPost(accountData.instance, accountData.id, writeColumnTitle, writeColumnContent);
// Resolves with the published post's URL, or null on failure (caller in
// publish.js treats a falsy return as "nothing to report" — see wordpress.js's
// publishPost for the same contract).

async function publishBloggerPost(blogid, clientid, bloggerTitle, bloggerContent) {

  // Get content and title
  if (!bloggerContent) { throw new Error('bloggerContent does not exist'); }

    const Blogger_SCOPES = 'https://www.googleapis.com/auth/blogger';
    let Blogger_tokenClient;
    let Blogger_accessToken;

    // Initialize the GIS token client
    return new Promise((resolve) => {
      Blogger_tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientid,
        scope: Blogger_SCOPES,
        callback: (response) => {
          if (response.access_token) {
            Blogger_accessToken = response.access_token;
            Blogger_postBlog();
          } else {
            showErrorModal('Failed to authorize with Blogger.', { title: 'Blogger Publish Failed' });
            resolve(null);
          }
        },
      });

      // Request an access token
      Blogger_tokenClient.requestAccessToken();

      // Function to submit the blog post
      async function Blogger_postBlog() {
        const Blogger_postData = {
          kind: 'blogger#post',
          title: bloggerTitle,
          content: bloggerContent,
        };

        try {
          const Blogger_response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogid}/posts/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Blogger_accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(Blogger_postData),
          });

          const Blogger_data = await Blogger_response.json();

          if (Blogger_response.ok) {
            resolve(Blogger_data.url); // Return the URL
          } else {
            const Blogger_error = `Failed to publish post: ${Blogger_data.error?.message || 'Unknown error'}`;
            showErrorModal(Blogger_error, { title: 'Blogger Publish Failed' });
            resolve(null);
          }
        } catch (Blogger_err) {
          showErrorModal(`Error: ${Blogger_err.message}`, { title: 'Blogger Publish Failed' });
          resolve(null);
        }
      }
    });
  }
