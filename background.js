chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveVideo') {
    chrome.storage.local.get('videos', (data) => {
      const videos = data.videos || [];
      const exists = videos.some((video) => video.url === message.data.url);

      if (!exists) {
        videos.push({ ...message.data, savedAt: Date.now() });
        chrome.storage.local.set({ videos }, () => {
          console.log('✅ Video saved:', message.data.title);
          sendResponse({ status: 'ok' });
        });
      } else {
        sendResponse({ status: 'exists' });
      }
    });
    return true; // Keep service worker alive for async call
  }
});
