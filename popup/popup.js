chrome.storage.local.get('videos', (data) => {
  const videos = data.videos || [];
  const container = document.getElementById('videos');

  videos.forEach(video => {
    const div = document.createElement('div');
    div.className = 'video';
    div.innerHTML = `
      <img src="${video.thumbnail}" alt="${video.title}" width="200">
      <p>${video.title}</p>
    `;
    div.onclick = () => window.open(video.url, '_blank');
    container.appendChild(div);
  });
});
