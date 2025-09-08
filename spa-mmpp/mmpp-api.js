// /spa-mmpp/mmpp-api.js (compat)
(function(global){
  var API_BASE = (global.API_URL) ? global.API_URL : 'https://backend-appmitylus.vercel.app/api';

  function get(path, params){
    params = params || {};
    var entries = Object.entries(params).filter(function(pair){ return pair[1] !== '' && pair[1] != null; });
    var qs = new URLSearchParams(Object.fromEntries(entries)).toString();
    var url = API_BASE + path + (qs ? ('?' + qs) : '');
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error('GET ' + path + ' → ' + r.status);
      return r.json();
    });
  }

  function send(method, path, body){
    return fetch(API_BASE + path, {
      method: method,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body || {})
    }).then(function(r){
      if(!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status);
      return r.json();
    });
  }

  global.MMppApi = {
    getDisponibilidades: function(opts){ opts = opts || {}; return get('/planificacion/disponibilidades', {mesKey: opts.mesKey, proveedorKey: opts.proveedorKey}); },
    crearDisponibilidad: function(payload){ return send('POST', '/planificacion/disponibilidades', payload); },
    editarDisponibilidad: function(id, payload){ return send('PATCH', '/planificacion/disponibilidades/' + id, payload); },
    borrarDisponibilidad: function(id){ return send('DELETE', '/planificacion/disponibilidades/' + id); },
    getResumenMensual: function(opts){ opts = opts || {}; return get('/planificacion/resumen', {mesKey: opts.mesKey}); }
  };
})(window);
