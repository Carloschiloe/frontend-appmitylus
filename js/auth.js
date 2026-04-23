/**
 * auth.js — guardia de autenticación global
 * Cargarlo como <script src="/js/auth.js"></script> (NO module)
 * en el <head> de cada página ANTES de cualquier otro script.
 */
(function () {
  var TOKEN_KEY = 'ammpp_token';
  var USER_KEY  = 'ammpp_user';
  var LOGIN_URL = '/html/login.html';

  /* ── Helpers de token ── */
  function getToken()  { return localStorage.getItem(TOKEN_KEY) || ''; }
  function saveToken(t, user) {
    localStorage.setItem(TOKEN_KEY, t);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }

  /* ── Detectar página de login ── */
  function isLoginPage() {
    var p = window.location.pathname;
    return p.endsWith('/login.html') || p.endsWith('/login');
  }

  /* ── Guardia: redirige a login si no hay token ── */
  if (!isLoginPage() && !getToken()) {
    window.location.replace(LOGIN_URL);
  }

  /* ── Patch de fetch: inyecta Authorization en todas las llamadas /api ── */
  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    opts = opts || {};
    var token = getToken();
    var urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url));

    if (token && (urlStr.startsWith('/api') || urlStr.indexOf('/api/') !== -1)) {
      var headers = Object.assign({}, opts.headers || {});
      if (!headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      opts = Object.assign({}, opts, { headers: headers });
    }

    return _fetch.call(window, url, opts).then(function (response) {
      if (response.status === 401 && !isLoginPage()) {
        clearSession();
        window.location.replace(LOGIN_URL);
      }
      return response;
    });
  };

  /* ── API pública en window.__AUTH__ ── */
  window.__AUTH__ = {
    getToken:     getToken,
    saveToken:    saveToken,
    clearSession: clearSession,
    getUser:      getUser,
    logout: function () {
      clearSession();
      window.location.replace(LOGIN_URL);
    }
  };
})();
