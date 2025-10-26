function addSaveButton(videoElement) {
  const button = document.createElement('button');
  button.innerText = '💾 Save';
  button.style.position = 'absolute';
button.style.top = '50%';
button.style.right = '10px';
button.style.transform = 'translateY(-50%)';
  button.style.zIndex = '9999';
  button.style.background = 'red';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '5px';
  button.style.cursor = 'pointer';
  
  button.onclick = () => {
    let thumbnail = "";
    const url = window.location.href;

    // YouTube special case
    if (url.includes("youtube.com/watch")) {
      const videoId = new URL(url).searchParams.get("v");
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } else {
      thumbnail = videoElement.poster || videoElement.src || '';
    }

    // Fallback: try meta tag thumbnail
    if (!thumbnail) {
      const metaImg = document.querySelector('meta[property="og:image"]');
      if (metaImg) {
        thumbnail = metaImg.content;
      }
    }

    const videoInfo = {
      url,
      thumbnail,
      title: document.title
    };

    chrome.runtime.sendMessage({ action: 'saveVideo', data: videoInfo });
  };

  videoElement.parentElement.style.position = 'relative';
  videoElement.parentElement.appendChild(button);
}

// Run when page loads
document.querySelectorAll('video').forEach(addSaveButton);
