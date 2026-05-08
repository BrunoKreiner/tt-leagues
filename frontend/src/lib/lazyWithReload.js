import { lazy } from 'react';

// Wraps React.lazy so that a failed dynamic import — typically a stale chunk
// hash from a previous deploy — triggers a single full page reload to pick up
// the new index.html and asset hashes. A sessionStorage flag prevents an
// infinite reload loop if the import is genuinely broken.
const RELOAD_FLAG = 'tt-chunk-reload-attempted';

const isChunkLoadError = (err) => {
  if (!err) return false;
  const msg = String(err.message || err);
  return (
    err.name === 'ChunkLoadError' ||
    /Loading chunk \d+ failed/.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /disallowed MIME type/i.test(msg)
  );
};

export default function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (isChunkLoadError(err) && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
