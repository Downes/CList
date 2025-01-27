//  blogger.js  -  helper and utility functions for Blogger API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

// Publish a post to a Blogger account
// publishBloggerPost(accountData.instance, accountData.id, responseDiv, writeColumnTitle,writeColumnContent);

async function publishBloggerPost(blogid, clientid, responseDiv, bloggerTitle, bloggerContent) {

  // Get content and title 
  if (!bloggerTitle || !bloggerContent) { throw new Error(`${!bloggerTitle ? "bloggerTitle" : "bloggerContent"} does not exist`);  }

    const Blogger_SCOPES = 'https://www.googleapis.com/auth/blogger';
    let Blogger_tokenClient;
    let Blogger_accessToken;
  
    // Initialize the GIS token client
    return new Promise((resolve, reject) => {
      Blogger_tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientid,
        scope: Blogger_SCOPES,
        callback: (response) => {
          if (response.access_token) {
            Blogger_accessToken = response.access_token;
            Blogger_postBlog();
          } else {
            Blogger_displayMessage(responseDiv, 'Failed to authorize.');
            reject('Authorization failed');
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
            const Blogger_message = `Blogger post published successfully! Post ID: ${Blogger_data.id}`;
            Blogger_displayMessage(responseDiv, Blogger_message);
            resolve(Blogger_data.url); // Return the URL
          } else {
            const Blogger_error = `Failed to publish post: ${Blogger_data.error?.message || 'Unknown error'}`;
            Blogger_displayMessage(responseDiv, Blogger_error);
            reject(Blogger_error);
          }
        } catch (Blogger_err) {
          const Blogger_error = `Error: ${Blogger_err.message}`;
          Blogger_displayMessage(responseDiv, Blogger_error);
          reject(Blogger_error);
        }
      }
  
      // Helper function to display messages in the responseDiv
      function Blogger_displayMessage(responseDiv, Blogger_message) {
            // Update the UI
           // responseElement = document.getElementById(responseDiv);
            responseDiv.innerHTML += `<p>${Blogger_message}</p>`;
      }
    });
  }
  