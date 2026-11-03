import { z } from 'zod';

const manifestSchema = z.object({
  sprites: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
  sounds: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
});

export type LoadedAssets = {
  readonly sprites: Readonly<Record<string, CanvasImageSource>>;
  readonly sounds: Readonly<Record<string, AudioBuffer>>;
};

type LoadOptions = {
  readonly audioCtx: AudioContext | null;
  readonly onProgress?: (progress: number) => void;
  readonly signal: AbortSignal;
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP error - ${status}`);
    this.status = status;
  }
}

async function withRetry<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
  attempts = 3
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await load();
    } catch (error: unknown) {
      if (
        (error instanceof HttpError &&
          error.status >= 400 &&
          error.status < 500) ||
        attempt === attempts - 1
      ) {
        throw error;
      }

      const delay = 300 * 2 ** attempt + Math.random() * 100;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, delay);
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', abort, { once: true });
      });
    }
  }
  throw new Error('Asset loading attempts exhausted');
}

function loadImage(
  url: string,
  signal: AbortSignal
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const image = new Image();
    const abort = () => {
      image.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error(`Failed to load image ${url}`));
    };
    image.src = url;
  });
}

async function loadAudio(
  audioContext: AudioContext,
  url: string,
  signal: AbortSignal
): Promise<AudioBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new HttpError(response.status);
  return audioContext.decodeAudioData(await response.arrayBuffer());
}

async function loadFallbackSprite(
  signal: AbortSignal
): Promise<CanvasImageSource> {
  try {
    return await loadImage('./assets/sprites/baseSprite.png', signal);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return document.createElement('canvas');
  }
}

export async function loadAll(
  manifest: unknown,
  { audioCtx, onProgress, signal }: LoadOptions
): Promise<LoadedAssets> {
  const parsedManifest = manifestSchema.parse(manifest);
  const spriteEntries = parsedManifest.sprites ?? [];
  const soundEntries = audioCtx ? (parsedManifest.sounds ?? []) : [];
  const totalTasks = spriteEntries.length + soundEntries.length;
  let loadedCount = 0;
  const updateProgress = () => {
    loadedCount++;
    onProgress?.(totalTasks === 0 ? 1 : loadedCount / totalTasks);
  };
  const sprites: Record<string, CanvasImageSource> = {};
  const sounds: Record<string, AudioBuffer> = {};

  await Promise.all([
    ...spriteEntries.map(async ({ id, url }) => {
      try {
        sprites[id] = await withRetry(() => loadImage(url, signal), signal);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        console.warn(`Failed to load sprite ${url}`, error);
        sprites[id] = await loadFallbackSprite(signal);
      } finally {
        updateProgress();
      }
    }),
    ...soundEntries.map(async ({ id, url }) => {
      if (!audioCtx) return;
      try {
        sounds[id] = await withRetry(
          () => loadAudio(audioCtx, url, signal),
          signal
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        console.warn(`Failed to load sound ${url}`, error);
      } finally {
        updateProgress();
      }
    }),
  ]);

  return { sprites, sounds };
}
