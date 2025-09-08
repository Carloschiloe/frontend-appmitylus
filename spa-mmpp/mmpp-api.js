// /spa-mmpp/mmpp-api.js
(function(global){
  const API_BASE = (global.API_URL) ? global.API_URL : 'https://backend-appmitylus.vercel.app/api';

  async function get(path, params={}){
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== '' && v != null))).toString();
    const url = API_BASE + path + (qs ? `?${qs}` : '');
    const r = await fetch(url);
    if(!r.ok) throw new Error(`GET ${path} → ${r.status}`);
    return r.json();
  }
  async function send(method, path, body){
    const r = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body||{})
    });
    if(!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
    return r.json();
  }

  global.MMppApi = {
    getDisponibilidades: ({mesKey, proveedorKey}={}) => get('/planificacion/disponibilidades', {mesKey, proveedorKey}),
    crearDisponibilidad: (payload) => send('POST', '/planificacion/disponibilidades', payload),
    editarDisponibilidad: (id, payload) => send('PATCH', `/planificacion/disponibilidades/${id}`, payload),
    borrarDisponibilidad: (id) => send('DELETE', `/planificacion/disponibilidades/${id}`),
    getResumenMensual: ({mesKey}) => get('/planificacion/resumen', {mesKey})
  };
})(window);
