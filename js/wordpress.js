//  wordpress.js  -  Publishes a post to a WordPress site using the REST API
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


async function publishPost(instance,username,password,title,content) {
    //const contentWindow = document.getElementById('content-window').innerHTML; // Get the content of the editable div
   // const title = "New Post from Content Window"; // You can change this dynamically if needed

    const url = instance+'/wp-json/wp/v2/posts'; // WordPress REST API endpoint for posts

    const postData = {
      title: title,
      content: content,
      status: 'publish' // This will publish the post immediately; use 'draft' if you want it saved as a draft
    };

    // Create the Basic Auth header
    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));
    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const post = await response.json();
        const postURL = post.link; // Retrieve the URL of the published post
        console.log('Post published successfully at URL:', postURL);
        return postURL; // Return the URL
      } else {
        throw new Error('Error publishing Wordpress post: ' + response.statusText);
      }
    } catch (error) {
      console.error('Failed to publish Wordpress post:', error);
      alert('Failed to publish the Wordpress post');
      return null; // Return null on failure
    }
  }
