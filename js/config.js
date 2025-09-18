/* js/config.js — versión para <script> normal */
(function () {
  // Si defines window.API_URL en el HTML, se usa; si no, cae a /api
  window.API_BASE = window.API_URL || window.API_BASE || '/api';

  // Logger controlado por flag
  window.log = (...a) => (window.DEBUG === true) && console.log('[Mitylus]', ...a);
})();
