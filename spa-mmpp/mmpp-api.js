
// /spa-mmpp/mmpp-api.js (v4: mapea a /planificacion/ofertas)
(function(global){
  var API_BASE = (global.API_URL) ? global.API_URL : 'https://backend-appmitylus.vercel.app/api';

  function get(path){
    return fetch(API_BASE + path, { headers: { 'Accept':'application/json' } })
      .then(function(r){ if(!r.ok) throw new Error('GET '+path+' → '+r.status); return r.json(); });
  }

  function pad2(n){ return String(n).padStart(2,'0'); }
  function monthKey(d){
    if(!d) return '';
    try{
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.getFullYear() + '-' + pad2(dt.getMonth()+1);
    }catch(e){ return ''; }
  }

  function normalizeOferta(it, idx){
    var rawMes = (typeof it.mesKey === 'string' && /^\d{4}-\d{2}$/.test(it.mesKey)) ? it.mesKey : null;
    var ym     = (it.anio && it.mes) ? (it.anio + '-' + pad2(it.mes)) : null;
    var baseF  = rawMes || ym || it.fecha || it.fechaPlan || it.fch || it.createdAt || null;
    var mesVal = rawMes || ym || monthKey(baseF);
    var tons   = Number(it.tonsDisponible != null ? it.tonsDisponible
                   : it.tons != null ? it.tons
                   : it.total != null ? it.total
                   : it.valor != null ? it.valor : 0) || 0;
    var saldo  = Number(it.saldo != null ? it.saldo : tons) || 0;
    var pName  = it.proveedorNombre || it.proveedor || it.Proveedor || '';
    var pKey   = it.proveedorId || it.proveedorKey || pName;
    var tipo   = (it.tipo || 'normal').toString().toLowerCase();
    return {
      _id: it._id || it.id || (pKey + '-' + mesVal + '-' + (idx||0)),
      proveedorKey: pKey,
      proveedorNombre: pName,
      mesKey: mesVal,
      tons: tons,
      saldo: saldo,
      tipo: tipo,
      notas: it.notas || ''
    };
  }

  // Devuelve disponibilidades normalizadas desde /planificacion/ofertas
  function getDisponibilidades(opts){
    opts = opts || {};
    return get('/planificacion/ofertas').then(function(data){
      var arr = Array.isArray(data && data.items) ? data.items : (Array.isArray(data) ? data : []);
      var norm = arr.map(normalizeOferta);
      if (opts.mesKey) norm = norm.filter(function(r){ return r.mesKey === opts.mesKey; });
      if (opts.proveedorKey) {
        var q = String(opts.proveedorKey).toLowerCase();
        norm = norm.filter(function(r){
          return (r.proveedorKey||'').toLowerCase().includes(q) || (r.proveedorNombre||'').toLowerCase().includes(q);
        });
      }
      return norm;
    });
  }

  function getResumenMensual(opts){
    opts = opts || {};
    return getDisponibilidades({ mesKey: opts.mesKey }).then(function(rows){
      var totalDisp = rows.reduce(function(a,r){ return a + (Number(r.tons)||0); }, 0);
      var totalSaldo = rows.reduce(function(a,r){ return a + (Number(r.saldo!=null?r.saldo:r.tons)||0); }, 0);
      return { totalDisponible: totalDisp, totalAsignado: 0, saldo: totalSaldo };
    });
  }

  function notImpl(){ return Promise.reject(new Error('No implementado en esta versión')); }

  global.MMppApi = {
    getDisponibilidades: getDisponibilidades,
    getResumenMensual:   getResumenMensual,
    crearDisponibilidad: notImpl,
    editarDisponibilidad: notImpl,
    borrarDisponibilidad: notImpl
  };
})(window);
