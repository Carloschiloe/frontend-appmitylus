// /js/config.js
(function (w) {
  // Si defines window.API_URL antes, la usamos; si no, por defecto '/api'
  var base = (typeof w.API_URL === 'string' && w.API_URL.trim()) || '/api';
  w.API_BASE = String(base).replace(/\/+$/,''); // sin slash final
  // deja DEBUG como esté (true/false); no tocamos nada más
})(window);
