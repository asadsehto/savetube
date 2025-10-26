const appRoot = document.getElementById('app');

const VIEWS = {
  VIDEOS: 'videos',
  PLAYLISTS: 'playlists'
};

let appState = {
  videos: [],
  playlists: [],
  activeView: VIEWS.VIDEOS,
  activePlaylistId: null
};

async function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

async function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadData() {
  const data = await storageGet(['videos', 'playlists']);
  return {
    videos: data.videos || [],
    playlists: data.playlists || []
  };
}

async function refresh(options = {}) {
  const { maintainView = false } = options;
  const data = await loadData();

  appState = {
    ...appState,
    videos: data.videos,
    playlists: data.playlists
  };

  if (!maintainView) {
    appState.activeView = VIEWS.VIDEOS;
    appState.activePlaylistId = null;
  } else if (appState.activePlaylistId) {
    const stillExists = appState.playlists.some((playlist) => playlist.id === appState.activePlaylistId);
    if (!stillExists) {
      appState.activePlaylistId = null;
    }
  }

  render();
}

function setView(view, { playlistId = null } = {}) {
  appState = {
    ...appState,
    activeView: view,
    activePlaylistId: view === VIEWS.PLAYLISTS ? playlistId : null
  };
  render();
}

async function removeVideo(url) {
  const data = await loadData();
  const updatedVideos = data.videos.filter((video) => video.url !== url);
  const updatedPlaylists = (data.playlists || []).map((playlist) => ({
    ...playlist,
    videos: (playlist.videos || []).filter((item) => item.url !== url)
  }));

  await storageSet({ videos: updatedVideos, playlists: updatedPlaylists });
}

async function removeVideoFromPlaylist(playlistId, url) {
  const data = await loadData();
  const playlists = data.playlists || [];
  const target = playlists.find((playlist) => playlist.id === playlistId);

  if (!target) {
    return;
  }

  target.videos = (target.videos || []).filter((item) => item.url !== url);
  await storageSet({ playlists });
}

async function deletePlaylist(playlistId) {
  const data = await loadData();
  const updated = (data.playlists || []).filter((playlist) => playlist.id !== playlistId);
  await storageSet({ playlists: updated });
}

async function createPlaylist(name) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { error: 'empty' };
  }

  const data = await loadData();
  const playlists = data.playlists || [];
  const duplicate = playlists.find((playlist) => (playlist.name || '').toLowerCase() === cleanName.toLowerCase());

  if (duplicate) {
    return { error: 'exists' };
  }

  const newPlaylist = {
    id: generateId(),
    name: cleanName,
    createdAt: Date.now(),
    videos: []
  };

  playlists.push(newPlaylist);
  await storageSet({ playlists });
  return { playlist: newPlaylist };
}

async function addVideoToPlaylist(video, playlistId, newPlaylistName) {
  const data = await loadData();
  const playlists = data.playlists || [];
  const savedVideo = data.videos.find((item) => item.url === video.url) || video;
  let targetPlaylist;

  if (playlistId === '__new__') {
    const cleanName = (newPlaylistName || '').trim();
    if (!cleanName) {
      return { error: 'empty-name' };
    }

    const existingMatch = playlists.find((playlist) => (playlist.name || '').toLowerCase() === cleanName.toLowerCase());

    if (existingMatch) {
      targetPlaylist = existingMatch;
    } else {
      targetPlaylist = {
        id: generateId(),
        name: cleanName,
        createdAt: Date.now(),
        videos: []
      };
      playlists.push(targetPlaylist);
    }
  } else {
    targetPlaylist = playlists.find((playlist) => playlist.id === playlistId);
  }

  if (!targetPlaylist) {
    return { error: 'missing-playlist' };
  }

  if (!Array.isArray(targetPlaylist.videos)) {
    targetPlaylist.videos = [];
  }

  const alreadyInPlaylist = targetPlaylist.videos.some((item) => item.url === savedVideo.url);

  if (!alreadyInPlaylist) {
    targetPlaylist.videos.push(savedVideo);
    await storageSet({ playlists });
    return { ok: true };
  }

  return { error: 'duplicate' };
}

function closeAllPlaylistForms() {
  if (!appRoot) {
    return;
  }
  const openForms = appRoot.querySelectorAll('.playlist-form.visible');
  openForms.forEach((form) => form.classList.remove('visible'));
}

function render() {
  if (!appRoot) {
    return;
  }

  appRoot.innerHTML = '';

  const nav = renderNav();
  appRoot.appendChild(nav);

  const section = document.createElement('div');
  section.className = 'section';

  if (appState.activeView === VIEWS.VIDEOS) {
    renderVideosSection(section);
  } else {
    renderPlaylistsSection(section);
  }

  appRoot.appendChild(section);
}

function renderNav() {
  const nav = document.createElement('div');
  nav.className = 'app-nav';

  const views = [
    { id: VIEWS.VIDEOS, label: 'All videos' },
    { id: VIEWS.PLAYLISTS, label: 'Playlists' }
  ];

  views.forEach((view) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-nav-button';
    if (appState.activeView === view.id) {
      button.classList.add('active');
    }

    button.textContent = view.label;
    button.addEventListener('click', () => {
      if (appState.activeView !== view.id) {
        setView(view.id);
      }
    });

    nav.appendChild(button);
  });

  return nav;
}

function renderVideosSection(section) {
  const header = document.createElement('div');
  header.className = 'section-header';

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = 'Saved videos';

  const count = document.createElement('span');
  count.className = 'count-pill';
  count.textContent = `${appState.videos.length}`;

  header.appendChild(title);
  header.appendChild(count);

  section.appendChild(header);

  if (!appState.videos.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No saved videos yet. Click the red save button on any video to store it here.';
    section.appendChild(emptyState);
    return;
  }

  const list = document.createElement('div');
  list.className = 'video-list';

  appState.videos
    .slice()
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .forEach((video) => {
      const card = createVideoCard(video, { allowDeleteSaved: true });
      list.appendChild(card);
    });

  section.appendChild(list);
}

function renderPlaylistsSection(section) {
  if (appState.activePlaylistId) {
    const playlist = appState.playlists.find((item) => item.id === appState.activePlaylistId);
    if (!playlist) {
      appState.activePlaylistId = null;
    } else {
      renderPlaylistDetail(section, playlist);
      return;
    }
  }

  const header = document.createElement('div');
  header.className = 'section-header';

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = 'Your playlists';

  const count = document.createElement('span');
  count.className = 'count-pill';
  count.textContent = `${appState.playlists.length}`;

  header.appendChild(title);
  header.appendChild(count);

  section.appendChild(header);

  const createRow = document.createElement('div');
  createRow.className = 'playlist-create';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'New playlist name';

  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.textContent = 'Create';

  const submit = async () => {
    input.classList.remove('input-error');
    const name = input.value.trim();
    const result = await createPlaylist(name);
    if (result && result.error) {
      input.classList.add('input-error');
      if (result.error === 'exists') {
        input.placeholder = 'Playlist already exists';
      }
      input.focus();
      return;
    }
    input.value = '';
    await refresh({ maintainView: true });
    if (result && result.playlist) {
      setView(VIEWS.PLAYLISTS, { playlistId: result.playlist.id });
    }
  };

  createButton.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submit();
    }
  });

  createRow.appendChild(input);
  createRow.appendChild(createButton);

  section.appendChild(createRow);

  if (!appState.playlists.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Create a playlist and start organizing your saved videos.';
    section.appendChild(emptyState);
    return;
  }

  const list = document.createElement('div');
  list.className = 'playlist-list';

  appState.playlists
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((playlist) => {
      const card = document.createElement('div');
      card.className = 'playlist-card';

      const headerRow = document.createElement('div');
      headerRow.className = 'playlist-card-header';

      const titleEl = document.createElement('h4');
      titleEl.className = 'playlist-card-title';
      titleEl.textContent = playlist.name || 'Untitled playlist';

      const count = document.createElement('span');
      count.className = 'badge';
      const videoCount = (playlist.videos || []).length;
      count.textContent = `${videoCount} video${videoCount === 1 ? '' : 's'}`;

      headerRow.appendChild(titleEl);
      headerRow.appendChild(count);

      const actions = document.createElement('div');
      actions.className = 'playlist-card-actions';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'action-button';
      openButton.textContent = 'View';
      openButton.addEventListener('click', () => {
        setView(VIEWS.PLAYLISTS, { playlistId: playlist.id });
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'action-button secondary';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async () => {
        await deletePlaylist(playlist.id);
        await refresh({ maintainView: true });
      });

      actions.appendChild(openButton);
      actions.appendChild(deleteButton);

      card.appendChild(headerRow);
      card.appendChild(actions);

      list.appendChild(card);
    });

  section.appendChild(list);
}

function renderPlaylistDetail(section, playlist) {
  const header = document.createElement('div');
  header.className = 'section-header';

  const detailHeader = document.createElement('div');
  detailHeader.className = 'playlist-detail-header';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'back-button';
  backButton.textContent = 'Back';
  backButton.addEventListener('click', () => {
    setView(VIEWS.PLAYLISTS);
  });

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = playlist.name || 'Untitled playlist';

  detailHeader.appendChild(backButton);
  detailHeader.appendChild(title);

  const count = document.createElement('span');
  count.className = 'count-pill';
  const videoCount = (playlist.videos || []).length;
  count.textContent = `${videoCount}`;

  header.appendChild(detailHeader);
  header.appendChild(count);

  section.appendChild(header);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'action-button secondary';
  deleteButton.textContent = 'Delete playlist';
  deleteButton.addEventListener('click', async () => {
    await deletePlaylist(playlist.id);
    await refresh({ maintainView: true });
    setView(VIEWS.PLAYLISTS);
  });

  section.appendChild(deleteButton);

  if (!playlist.videos || !playlist.videos.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'This playlist is empty. Add videos from your saved list to get started.';
    section.appendChild(emptyState);
    return;
  }

  const list = document.createElement('div');
  list.className = 'video-list';

  playlist.videos
    .slice()
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .forEach((video) => {
      const savedVersion = appState.videos.find((item) => item.url === video.url);
      const mergedVideo = savedVersion ? { ...video, ...savedVersion } : video;
      const card = createVideoCard(mergedVideo, {
        allowDeleteSaved: true,
        playlistContext: { id: playlist.id, name: playlist.name }
      });
      list.appendChild(card);
    });

  section.appendChild(list);
}

function createVideoCard(video, { allowDeleteSaved = false, playlistContext = null } = {}) {
  const card = document.createElement('article');
  card.className = 'video-card';

  card.addEventListener('click', () => {
    if (video.url) {
      window.open(video.url, '_blank');
    }
  });

  if (allowDeleteSaved) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'video-delete-button';
    deleteButton.textContent = '✕';
    deleteButton.title = 'Remove from saved videos';
    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeVideo(video.url);
      await refresh({ maintainView: true });
    });
    card.appendChild(deleteButton);
  }

  const thumbnail = document.createElement('img');
  thumbnail.src = video.thumbnail || '../icons/icon128.png';
  thumbnail.alt = video.title || 'Saved video';
  thumbnail.addEventListener('click', (event) => event.stopPropagation());

  card.appendChild(thumbnail);

  const content = document.createElement('div');
  content.className = 'video-content';

  const title = document.createElement('p');
  title.className = 'video-title';
  title.textContent = video.title || 'Saved video';

  const subtitle = document.createElement('span');
  subtitle.className = 'video-subtitle';
  subtitle.textContent = buildSubtitle(video);

  const actions = document.createElement('div');
  actions.className = 'video-actions';

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'action-button secondary';
  openButton.textContent = 'Open video';
  openButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (video.url) {
      window.open(video.url, '_blank');
    }
  });

  actions.appendChild(openButton);

  const playlists = appState.playlists || [];

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'action-button add-to-playlist-trigger';
  addButton.textContent = 'Add to playlist';

  const playlistForm = document.createElement('div');
  playlistForm.className = 'playlist-form';
  playlistForm.addEventListener('click', (event) => event.stopPropagation());

  const playlistSelect = document.createElement('select');
  playlistSelect.className = 'playlist-select';

  const selectablePlaylists = playlistContext
    ? playlists.filter((playlist) => playlist.id !== playlistContext.id)
    : playlists.slice();

  if (selectablePlaylists.length) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select playlist';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    playlistSelect.appendChild(placeholderOption);
  }

  selectablePlaylists.forEach((playlist) => {
    const option = document.createElement('option');
    option.value = playlist.id;
    option.textContent = playlist.name;
    playlistSelect.appendChild(option);
  });

  const createOption = document.createElement('option');
  createOption.value = '__new__';
  createOption.textContent = selectablePlaylists.length ? 'Create new playlist' : 'Create playlist';
  playlistSelect.appendChild(createOption);

  const playlistNameInput = document.createElement('input');
  playlistNameInput.type = 'text';
  playlistNameInput.placeholder = 'Playlist name';
  playlistNameInput.className = 'playlist-name-input';
  playlistNameInput.style.display = selectablePlaylists.length ? 'none' : 'block';

  if (!selectablePlaylists.length) {
    playlistSelect.value = '__new__';
  }

  playlistSelect.addEventListener('change', () => {
    playlistSelect.classList.remove('input-error');
    playlistNameInput.classList.remove('input-error');
    if (playlistSelect.value === '__new__') {
      playlistNameInput.style.display = 'block';
      playlistNameInput.focus();
    } else {
      playlistNameInput.style.display = 'none';
    }
  });

  const formActions = document.createElement('div');
  formActions.className = 'playlist-form-actions';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'action-button primary';
  confirmButton.textContent = 'Add';
  confirmButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    playlistSelect.classList.remove('input-error');
    playlistNameInput.classList.remove('input-error');

    const selectedValue = playlistSelect.value;
    const typedName = playlistNameInput.value.trim();

    if (!selectedValue) {
      playlistSelect.classList.add('input-error');
      playlistSelect.focus();
      return;
    }

    if (selectedValue === '__new__' && !typedName) {
      playlistNameInput.classList.add('input-error');
      playlistNameInput.focus();
      return;
    }

    const result = await addVideoToPlaylist(video, selectedValue, typedName);
    if (result && result.error === 'duplicate') {
      playlistSelect.classList.add('input-error');
      playlistSelect.focus();
      return;
    }
    playlistForm.classList.remove('visible');
    playlistNameInput.value = '';
    playlistNameInput.style.display = selectablePlaylists.length ? 'none' : 'block';
    if (selectablePlaylists.length) {
      playlistSelect.value = '';
    }
    await refresh({ maintainView: true });
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'action-button secondary';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', (event) => {
    event.stopPropagation();
    playlistSelect.classList.remove('input-error');
    playlistNameInput.classList.remove('input-error');
    playlistForm.classList.remove('visible');
    playlistNameInput.value = '';
    if (selectablePlaylists.length) {
      playlistSelect.value = '';
      playlistNameInput.style.display = 'none';
    } else {
      playlistSelect.value = '__new__';
      playlistNameInput.style.display = 'block';
    }
  });

  formActions.appendChild(confirmButton);
  formActions.appendChild(cancelButton);

  playlistForm.appendChild(playlistSelect);
  playlistForm.appendChild(playlistNameInput);
  playlistForm.appendChild(formActions);

  addButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const willShow = !playlistForm.classList.contains('visible');
    closeAllPlaylistForms();
    if (willShow) {
      playlistForm.classList.add('visible');
      if (!selectablePlaylists.length || playlistSelect.value === '__new__') {
        playlistNameInput.style.display = 'block';
        playlistNameInput.focus();
      } else {
        playlistSelect.focus();
      }
    }
  });

  actions.appendChild(addButton);
  content.appendChild(title);
  content.appendChild(subtitle);
  content.appendChild(actions);
  content.appendChild(playlistForm);

  if (playlistContext) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'action-button secondary';
    removeButton.textContent = 'Remove from playlist';
    removeButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeVideoFromPlaylist(playlistContext.id, video.url);
      await refresh({ maintainView: true });
    });
    actions.appendChild(removeButton);
  }

  card.appendChild(content);

  return card;
}

function buildSubtitle(video) {
  const parts = [];
  const host = getHostname(video.url);
  if (host) {
    parts.push(host);
  }
  if (video.savedAt) {
    parts.push(formatTimeAgo(video.savedAt));
  }
  return parts.join(' • ');
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) {
    return '';
  }

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) {
    return 'Just now';
  }
  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const weeks = Math.floor(diff / week);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.playlist-form') && !event.target.closest('.add-to-playlist-trigger')) {
    closeAllPlaylistForms();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.videos || changes.playlists)) {
    refresh({ maintainView: true });
  }
});

refresh();
