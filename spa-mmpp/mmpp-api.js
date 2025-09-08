// /spa-mmpp/mmpp-api.js  (NerdUI version)
(function(global){
  var API_BASE = (global.API_URL) ? global.API_URL : 'https://backend-appmitylus.vercel.app/api';

  function check(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(r.status+' '+t); }); } return r.json().catch(function(){return null;}); }

  function get(path, params){
    params = params || {};
    var entries = Object.entries(params).filter(function(p){ return p[1] !== '' && p[1] != null; });
    var qs = new URLSearchParams(Object.fromEntries(entries)).toString();
    var url = API_BASE + path + (qs ? ('?' + qs) : '');
    return fetch(url, { headers:{'Accept':'application/json'} }).then(check);
  }

  function send(method, path, body){
    return fetch(API_BASE + path, {
      method: method,
      headers: { 'Content-Type':'application/json','Accept':'application/json' },
      body: JSON.stringify(body || {})
    }).then(check);
  }

  // Normaliza items de /planificacion/ofertas a un formato estable
  function normalizeOferta(it){
    var tons = Number(it.tons || it.cantidad || it.cant || 0) || 0;
    var mesKey = (typeof it.mesKey === 'string' ? it.mesKey : null);
    if(!mesKey){
      var d = it.fecha || it.fechaPlan || it.fch || it.createdAt || null;
      if(d){ try{ var dd = new Date(d); mesKey = dd.getFullYear() + '-' + String(dd.getMonth()+1).padStart(2,'0'); }catch(e){} }
    }
    return {
      id: it.id || it._id || null,
      proveedorNombre: it.proveedorNombre || it.proveedor || it.Proveedor || '',
      comuna: it.comuna || it.centroComuna || '',
      centroCodigo: it.centroCodigo || it.Centro || '',
      areaCodigo: it.areaCodigo || it.Area || '',
      tipo: (it.tipo || 'NORMAL').toUpperCase(),
      mesKey: mesKey || '',
      fecha: it.fecha || null,
      tons: tons,
      saldo: (typeof it.saldo !== 'undefined' ? Number(it.saldo) : tons)
    };
  }

  global.MMppApi = {
    // Lee disponibilidades desde /planificacion/ofertas
    getDisponibilidades: function(){ 
      return get('/planificacion/ofertas').then(function(raw){
        var arr = Array.isArray(raw && raw.items) ? raw.items : (Array.isArray(raw) ? raw : []);
        return arr.map(normalizeOferta);
      });
    },
    // Crea una "oferta" (disponibilidad) básica; payload flexible
    crearDisponibilidad: function(payload){ return send('POST', '/planificacion/ofertas', payload); },
    // (placeholders para futura edición / borrado)
    editarDisponibilidad: function(id, payload){ return send('PATCH', '/planificacion/ofertas/' + encodeURIComponent(id), payload); },
    borrarDisponibilidad: function(id){ return send('DELETE', '/planificacion/ofertas/' + encodeURIComponent(id)); }
  };
})(window);
