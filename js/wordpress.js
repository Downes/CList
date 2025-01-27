async function publishPost(instance,username,password,title,content) {
    //const contentWindow = document.getElementById('content-window').innerHTML; // Get the content of the editable div
   // const title = "New Post from Content Window"; // You can change this dynamically if needed

    const url = instance+'/wp-json/wp/v2/posts'; // WordPress REST API endpoint for posts
 //   const username = 'Downes'; // Replace with your WordPress username
//    const password = 'wYTR Ouie eVXr 7lGF DsDj esiH'; // Replace with the application password you generated

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

 // document.getElementById('publish-btn').addEventListener('click', publishPost);