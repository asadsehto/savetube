const BUTTON_CLASS = 'video-saver-button';
const VIDEO_DATASET_KEY = 'videoSaverId';
let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `vs-${Date.now().toString(36)}-${idCounter}`;
}

function resolveContainer(element) {
  if (!element) {
    return null;
  }
  const taggedContainer = element.closest('[data-video-saver-container="true"]');
  if (taggedContainer) {
    return taggedContainer;
  }
  return element.parentElement || element.closest('div');
}

function ensureContainerReady(container) {
  if (!container) {
    return;
  }
  if (window.getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  if (!container.dataset.videoSaverContainer) {
    container.dataset.videoSaverContainer = 'true';
  }
}

function resolveThumbnail(videoElement) {
  let thumbnail = '';
  const pageUrl = window.location.href;

  if (pageUrl.includes('youtube.com/watch')) {
    try {
      const url = new URL(pageUrl);
      const videoId = url.searchParams.get('v');
      if (videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } catch (error) {
      // Ignore URL parsing errors and fall back.
    }
  }

  if (!thumbnail && videoElement) {
    thumbnail = videoElement.getAttribute('poster') || videoElement.poster || '';
  }

  if (!thumbnail && videoElement) {
    const currentSrc = videoElement.currentSrc || videoElement.src;
    if (currentSrc) {
      thumbnail = currentSrc;
    }
  }

  if (!thumbnail) {
    const candidateImg = videoElement?.closest('article, div, section')?.querySelector('img');
    if (candidateImg && candidateImg.src) {
      thumbnail = candidateImg.src;
    }
  }

  if (!thumbnail) {
    const metaImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[name="og:image"]');
    if (metaImg && metaImg.content) {
      thumbnail = metaImg.content;
    }
  }

  return thumbnail;
}

function buildVideoInfo(videoElement) {
  const url = window.location.href;
  return {
    url,
    thumbnail: resolveThumbnail(videoElement),
    title: document.title
  };
}

function isYouTubeDomain() {
  return window.location.hostname.includes('youtube.com');
}

function normalizeYouTubeUrl(href) {
  try {
    return new URL(href, window.location.origin).toString();
  } catch (error) {
    return href || window.location.href;
  }
}

function extractYouTubeThumbnail(anchor) {
  const img = anchor.querySelector('img');
  if (!img) {
    return '';
  }

  return (
    img.src ||
    img.dataset?.thumb ||
    img.dataset?.src ||
    img.dataset?.loaded ||
    ''
  );
}

function extractYouTubeTitle(anchor) {
  const media = anchor.closest('ytd-rich-grid-media, ytd-compact-video-renderer, ytd-video-renderer, ytd-grid-video-renderer');
  const titleElement = media?.querySelector('#video-title') || anchor.querySelector('img');
  const text = titleElement?.textContent?.trim() || titleElement?.getAttribute?.('alt') || '';
  return text || document.title;
}

function buildYouTubeThumbnailInfo(anchor) {
  const href = anchor.getAttribute('href') || '';
  const url = normalizeYouTubeUrl(href);
  let thumbnail = extractYouTubeThumbnail(anchor);

  if (!thumbnail) {
    try {
      const videoUrl = new URL(url);
      const videoId = videoUrl.searchParams.get('v') || videoUrl.pathname.replace('/shorts/', '');
      if (videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } catch (error) {
      // Ignore parsing issues and fall back to empty thumbnail.
    }
  }

  return {
    url,
    thumbnail,
    title: extractYouTubeTitle(anchor)
  };
}

function isYouTubeVideoLink(anchor) {
  const href = anchor.getAttribute('href') || '';
  return href.includes('/watch') || href.startsWith('/shorts');
}

function addSaveButtonToYouTubeThumbnail(anchor) {
  if (!anchor || anchor.dataset.videoSaverSkip === 'true' || !isYouTubeVideoLink(anchor)) {
    return;
  }

  const container = anchor.closest('ytd-thumbnail, ytd-player, yt-thumbnail-view-model') || anchor;
  ensureContainerReady(container);

  if (!anchor.dataset[VIDEO_DATASET_KEY]) {
    anchor.dataset[VIDEO_DATASET_KEY] = nextId();
  }

  const targetId = anchor.dataset[VIDEO_DATASET_KEY];
  const existingButton = container.querySelector(`.${BUTTON_CLASS}[data-target-video="${targetId}"]`);
  if (existingButton) {
    return;
  }

  const button = createSaveButton(anchor, () => buildYouTubeThumbnailInfo(anchor));
  button.dataset.targetVideo = targetId;
  container.appendChild(button);
}

function scanYouTubeThumbnails(scope) {
  if (!isYouTubeDomain()) {
    return;
  }
  const context = scope instanceof Element || scope instanceof Document || scope instanceof DocumentFragment ? scope : document;
  const anchors = context.querySelectorAll('a#thumbnail');
  anchors.forEach((anchor) => addSaveButtonToYouTubeThumbnail(anchor));
}

function styleButton(button) {
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.textContent = '💾 Save';
  button.style.position = 'absolute';
  button.style.top = '50%';
  button.style.right = '0';
  button.style.transform = 'translateY(-50%)';
  button.style.zIndex = '2147483646';
  button.style.background = '#e50914';
  button.style.color = '#ffffff';
  button.style.border = 'none';
  button.style.padding = '6px 12px';
  button.style.borderRadius = '999px 0 0 999px';
  button.style.fontSize = '13px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.gap = '6px';
  button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  button.style.opacity = '0.85';
  button.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  button.style.pointerEvents = 'auto';
}

function enhanceHoverInteractions(button, targetElement) {
  const setActive = () => {
    button.style.opacity = '1';
  };

  const setInactive = () => {
    button.style.opacity = '0.85';
  };

  button.addEventListener('mouseenter', setActive);
  button.addEventListener('mouseleave', setInactive);

  if (targetElement) {
    targetElement.addEventListener('mouseenter', setActive, { passive: true });
    targetElement.addEventListener('mouseleave', setInactive, { passive: true });
  }
}

function createSaveButton(targetElement, infoProvider) {
  const button = document.createElement('button');
  styleButton(button);
  enhanceHoverInteractions(button, targetElement);

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const videoInfo = typeof infoProvider === 'function' ? infoProvider() : null;
    if (videoInfo && videoInfo.url) {
      chrome.runtime.sendMessage({ action: 'saveVideo', data: videoInfo });
    }
  });

  button.addEventListener('mousedown', (event) => event.stopPropagation());

  button.setAttribute('aria-label', 'Save video');

  return button;
}

function addSaveButton(videoElement) {
  if (!videoElement || typeof videoElement !== 'object') {
    return;
  }

  const container = resolveContainer(videoElement);
  if (!container) {
    return;
  }

  ensureContainerReady(container);

  if (!videoElement.dataset[VIDEO_DATASET_KEY]) {
    videoElement.dataset[VIDEO_DATASET_KEY] = nextId();
  }

  const targetId = videoElement.dataset[VIDEO_DATASET_KEY];
  const existingButton = container.querySelector(`.${BUTTON_CLASS}[data-target-video="${targetId}"]`);
  if (existingButton) {
    return;
  }

  const button = createSaveButton(videoElement, () => buildVideoInfo(videoElement));
  button.dataset.targetVideo = targetId;
  container.appendChild(button);
}

function scanForVideos(root) {
  const scope = root instanceof Element || root instanceof Document || root instanceof DocumentFragment ? root : document;
  const videos = scope.querySelectorAll('video');
  videos.forEach((video) => addSaveButton(video));
  scanYouTubeThumbnails(scope);
}

function handleMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          addSaveButton(node);
        } else if (isYouTubeDomain() && node.nodeType === 1 && node.matches && node.matches('a#thumbnail')) {
          addSaveButtonToYouTubeThumbnail(node);
        } else if (node.querySelectorAll) {
          scanForVideos(node);
        }
      });
      mutation.removedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          detachButton(node);
        } else if (isYouTubeDomain() && node.nodeType === 1 && node.matches && node.matches('a#thumbnail')) {
          detachButton(node);
        } else if (node.querySelectorAll) {
          const videos = node.querySelectorAll('video');
          videos.forEach((video) => detachButton(video));
          if (isYouTubeDomain()) {
            const anchors = node.querySelectorAll('a#thumbnail');
            anchors.forEach((anchor) => detachButton(anchor));
          }
        }
      });
    }
  }
}

function detachButton(videoElement) {
  if (!videoElement) {
    return;
  }

  const targetId = videoElement.dataset[VIDEO_DATASET_KEY];
  if (!targetId) {
    return;
  }

  const container = resolveContainer(videoElement);
  if (container) {
    const button = container.querySelector(`.${BUTTON_CLASS}[data-target-video="${targetId}"]`);
    if (button) {
      button.remove();
    }
  }

  delete videoElement.dataset[VIDEO_DATASET_KEY];
}

function initObservers() {
  const target = document.body || document.documentElement;
  if (!target) {
    return;
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(target, {
    childList: true,
    subtree: true
  });
}

function init() {
  scanForVideos(document);
  initObservers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
