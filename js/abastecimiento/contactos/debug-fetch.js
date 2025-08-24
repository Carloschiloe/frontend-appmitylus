// Log de cada fetch a /api/contactos (opcional en prod)
(() => {
  if (window.__fetchLogged__) return;
  window.__fetchLogged__ = true;
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input?.url;
    const method = init?.method || 'GET';
    if (url?.includes('/api/contactos')) {
      try {
        let previewBody = init?.body;
        if (previewBody && typeof previewBody === 'string' && previewBody.length > 300) {
          previewBody = previewBody.slice(0, 300) + '…';
        }
        console.log('%c[fetch→contactos]', 'color:#0a7', method, url, init?.headers || {}, previewBody || null);
      } catch (_) {}
    }
    const resp = await _fetch(...args);
    if (url?.includes('/api/contactos')) {
      console.log('%c[fetch←contactos]', 'color:#a50', resp.status, resp.statusText, url);
    }
    return resp;
  };
})();
