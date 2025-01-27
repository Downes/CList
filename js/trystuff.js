            try {
                const { accessToken, did, pds } = await createBlueskySession(); // Get session information

                const response = await fetch('https://bsky.social/xrpc/app.bsky.feed.getTimeline', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Error fetching timeline: ${response.statusText}`);
                }

                const data = await response.json();

              
                // Extract the cursor from the data
                cursor = data.cursor;


                // console.log('Timeline Data:', data);
                await displayBlueskyPosts(data.feed, 'Timeline', cursor); // Display with title "Your BlueSky Timeline"
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('feed-container').innerText = 'Failed to load timeline. Please check console for details.';
            }





            try {
                const { accessToken, did } = await createBlueskySession(); // Get session information
        
                const response = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getActorLikes?actor=${did}`, { // Hypothetical endpoint
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
        
                if (!response.ok) {
                    throw new Error(`Error fetching favorites: ${response.statusText}`);
                }
        
                const data = await response.json();
                // console.log('Favorites Data:', data);
                await displayBlueskyPosts(data.feed, 'Favorites', null); // Display with title "Your BlueSky Favorites"
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('feed-container').innerText = 'Failed to load favorites. Please check console for details.';
            }

            if (event) { event.preventDefault();  }
            alert("I'm in submitBlueskyPost ");
                            let { accessToken, did } = await createBlueskySession(); // Get session information
                        alert("SUBMIT  "+accessToken+" --- "+did);
                        console.log("SUBMIT  "+accessToken+" --- "+did);
                            var responseElement = document.getElementById(responseDiv);
                            
                            if (!postContent.trim()) {
                                alert('Please enter some content before posting.');
                                return;
                            }
            
                            // Remove HTML
                            postContent = removeHtml(postContent);
            
                            // Adhere to content length limits
                            postContent = truncateToGraphemeLimit(postContent,300);
                        
                            // Construct the record object
                            const record = {
                                "$type": "app.bsky.feed.post",
                                text: postContent,
                                createdAt: new Date().toISOString(),
                            };
                            console.log("Record being sent to Bluesky:", record);
                            
                            // Set reply structure if needed
                            if (parentUri && parentCid && rootUri && rootCid) {
                                responseElement = document.getElementById(`replyResponse-${replyContentId.split('-')[1]}`);
                                record.reply = {
                                    root: { uri: rootUri, cid: rootCid },
                                    parent: { uri: parentUri, cid: parentCid },
                                };
                            }
                        
                           
                            if (!accessToken || !did) {
                                console.error("Missing accessToken or did. Check your session.");
                                alert("Error");
                                return;
                            }
            
                            console.log("Request body:", JSON.stringify({
                                collection: 'app.bsky.feed.post',
                                repo: did,
                                record: record,
                            }));
            
                            console.log({
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        collection: 'app.bsky.feed.post',
                                        repo: did,
                                        record: record,
                                    })});
                                    
                            console.log( {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            });
                                const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        collection: 'app.bsky.feed.post',
                                        repo: did,
                                        record: record,
                                    }),
                                });
                        
                                // Log the raw response object
                                console.log("Raw response:", response);
                        
                                // Ensure the response is valid
                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    console.error("Error response data:", errorData);
                                    alert("EEEEE "+$JSON.stringify(errorData)+"   "+response.statusText);
                                    throw new Error(`Error posting Bluesky content: ${JSON.stringify(errorData) || response.statusText}`);
            
            
                                }
                        
                                // Parse and log the JSON response
                                const responseData = await response.json();
                                console.log("Response JSON:", responseData);
                        
                                // Update the UI
                                responseElement.innerHTML += '<p>Bluesky Post submitted successfully!</p>';
                        
                        
            