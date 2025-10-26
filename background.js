chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveVideo') {
    chrome.storage.local.get('videos', (data) => {
      const videos = data.videos || [];
      videos.push(message.data);
      chrome.storage.local.set({ videos }, () => {
        console.log('✅ Video saved:', message.data.title);
        sendResponse({ status: 'ok' });
      });
    });
    return true; // Keep service worker alive for async call
  }
});
