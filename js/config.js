// /js/config.js
(function (w) {
  // URL por defecto del backend (cámbiala si tu backend vive en otro dominio)
  var DEFAULT_API = "https://backend-appmitylus.vercel.app/api";

  // Toma la primera que exista y no esté vacía, o usa la DEFAULT_API
  var base =
    (typeof w.API_URL === 'string' && w.API_URL.trim()) ||
    (typeof w.API_BASE === 'string' && w.API_BASE.trim()) ||
    (typeof w.__MMPP_API_BASE__ === 'string' && w.__MMPP_API_BASE__.trim()) ||
    DEFAULT_API;

  // normaliza (sin slash final)
  base = String(base).replace(/\/+$/, '');

  // expone en todas las variables que usan tus scripts
  w.API_URL = base;
  w.API_BASE = base;
  w.__MMPP_API_BASE__ = base;

  // si ya tenías window.DEBUG definido, lo dejamos tal cual
})(window);
