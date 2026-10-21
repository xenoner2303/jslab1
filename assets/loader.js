async function fetchJson(url, options = {}) {
  const response = await fetch(url, options); // dowload data

  if (!response.ok) {
    const error = new Error(`HTTP error - ${response.status}`);
    error.status = response.status; // save to recognize error code
    throw error;
  }
  return response.json();
}

async function withRetry(fn, { attempts = 3, baseMs = 300, signal } = {}) { // signal is AbortSignal obj
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError'); // check signal is aborted or no
    }

    try {
      return await fn();
    } 
    catch (error) {
      if ((error.status >= 400 && error.status < 500) || i == attempts - 1) {
        throw error; // throw error further
      }

      const delay = baseMs * Math.pow(2, i) + Math.random() * 100; // increase delya of attempts

      await new Promise((resolve) => { // if attemps =0 - clear task list
        const timer = setTimeout(resolve, delay); // artificial delay by task queue

        signal?.addEventListener('abort', () => {
          clearTimeout(timer); // if player left - clear timer
          resolve();
        }, 
        { once: true }); // use listener one time and then delete
      });
    }
  }
}

async function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const img = new Image();
    
    const abortHandler = () => {
      img.src = ''; // to stop image dowloading
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    img.onload = () => { // if we on  - remove abort hadler for data leak prevent
      signal?.removeEventListener('abort', abortHandler);
      resolve(img);
    };

    img.onerror = () => {
      signal?.removeEventListener('abort', abortHandler);
      reject(new Error(`Failed to load image ${url}`));
    };

    img.src = url;
  });
}

async function loadAudio(audioCtx, url, signal) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    const error = new Error(`Failed to load audio ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer(); // to byte array
  return await audioCtx.decodeAudioData(arrayBuffer);
}

async function loadJson(url, signal) { // add for task
  return fetchJson(url, { signal });
}

async function loadAll(manifest, { audioCtx, onProgress, signal } = {}) {
  const tasks = [];
  let loadedCount = 0;
  const totalTasks = (manifest.sprites?.length || 0) // count of files to doaload
    + (manifest.sounds?.length || 0) 
    + (manifest.arena ? 1 : 0);

  const updateProgress = () => { // just for load progression
    loadedCount++;

    if (onProgress) {
      onProgress(loadedCount/totalTasks); // for progress bar
    }
  };

  if (manifest.sprites) {
    for (const item of manifest.sprites) {
      tasks.push(
        withRetry(() => loadImage(item.url, signal), { signal }).then((res) => {
          updateProgress();
          return { id: item.id, type: 'sprite', data: res };
        })
      );
    }
  }

  if (manifest.sounds && audioCtx) {
    for (const item of manifest.sounds) {
      tasks.push(
        withRetry(() => loadAudio(audioCtx, item.url, signal), { signal }).then((res) => {
          updateProgress();
          return { id: item.id, type: 'sound', data: res };
        })
      );
    }
  }

  if (manifest.arena) {
    tasks.push(
      withRetry(() => loadJson(manifest.arena, signal), { signal }).then((res) => {
        updateProgress();
        return { id: 'arena', type: 'json', data: res };
      })
    );
  }

  const results = await Promise.all(tasks); // perform all tasks in parallel
  
  const assets = {}; // dictionary for dwloaded files

  for (const result of results) {
    assets[result.id] = result.data;
  }

  return assets;
}

export { fetchJson, withRetry, loadImage, loadJson, loadAll };
