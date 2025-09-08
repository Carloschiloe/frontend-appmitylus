
// /spa-mmpp/mmpp-api.js  (NerdUI v3 – disponibilidades + asignaciones)
(function(global){
  var API_BASE = (global.API_URL) ? global.API_URL : 'https://backend-appmitylus.vercel.app/api';

  function check(r){
    if(!r.ok){
      return r.text().then(function(t){ throw new Error(r.status+' '+t); });
    }
    return r.json().catch(function(){return null;});
  }

  function tryGet(paths, params){
    var i = 0;
    function _next(){
      if(i >= paths.length) return Promise.reject(new Error('Todos los GET fallaron: '+paths.join(', ')));
      var p = paths[i++];
      var url = API_BASE + p + (params ? ('?' + new URLSearchParams(params).toString()) : '');
      return fetch(url, { headers:{'Accept':'application/json'} }).then(function(r){
        if(!r.ok) throw new Error('GET ' + p + ' -> ' + r.status);
        return r.json();
      }).catch(function(){ return _next(); });
    }
    return _next();
  }

  function trySend(method, paths, body){
    var i = 0;
    function _next(){
      if(i >= paths.length) return Promise.reject(new Error('Todos los '+method+' fallaron: '+paths.join(', ')));
      var p = paths[i++];
      return fetch(API_BASE + p, {
        method: method,
        headers: { 'Content-Type':'application/json','Accept':'application/json' },
        body: JSON.stringify(body || {})
      }).then(function(r){
        if(!r.ok) throw new Error(method + ' ' + p + ' -> ' + r.status);
        return r.json().catch(function(){return {ok:true}});
      }).catch(function(){ return _next(); });
    }
    return _next();
  }

  // ---------- Disponibilidades ----------
  function normalizeDisponibilidad(it){
    var tons = Number(it.tonsDisponible || it.tons || it.cantidad || 0) || 0;
    var mesKey = (typeof it.mesKey === 'string' ? it.mesKey : null);
    if(!mesKey){
      var d = it.fecha || it.createdAt || null;
      if(d){ try{ var dd = new Date(d); mesKey = dd.getFullYear() + '-' + String(dd.getMonth()+1).padStart(2,'0'); }catch(e){} }
    }
    return {
      id: it.id || it._id || it.disponibilidadId || null,
      proveedorKey: it.proveedorKey || '',
      proveedorNombre: it.proveedorNombre || it.proveedor || '',
      comuna: it.comuna || '',
      centroCodigo: it.centroCodigo || '',
      areaCodigo: it.areaCodigo || '',
      tipo: (it.tipo || 'NORMAL').toUpperCase(),
      mesKey: mesKey || '',
      fecha: it.fecha || it.createdAt || null,
      tons: tons,
      estado: it.estado || 'disponible',
    };
  }

  function buildCreateDisponPayload(form){
    return form.disponibilidades.map(function(x){
      var d = new Date(x.fecha);
      var mk = isNaN(d) ? (String(x.fecha).slice(0,7)) : (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
      return {
        mesKey: mk,
        anio: Number(mk.split('-')[0])||null,
        mes: Number(mk.split('-')[1])||null,
        proveedorKey: form.proveedorKey || '',
        proveedorNombre: form.proveedor || form.proveedorNombre || '',
        centroId: form.centroId || null,
        centroCodigo: form.centroCodigo || '',
        comuna: form.comuna || '',
        areaCodigo: form.areaCodigo || '',
        tonsDisponible: Number(x.tons)||0,
        estado: 'disponible'
      };
    });
  }

  // ---------- Asignaciones ----------
  function normalizeAsignacion(a){
    // campos tolerantes
    var id = a.id || a._id || null;
    var dispoId = a.disponibilidadId || a.dispoId || a.origenId || a.disponibilidad || null;
    var cantidad = Number(a.cantidad || a.tons || a.toneladas || 0) || 0;
    var destMes = a.destMes || a.mesDestino || a.mes || null;
    var destAnio = a.destAnio || a.anioDestino || a.anio || null;
    var proveedor = a.proveedorNombre || a.proveedor || '';
    var proveedorKey = a.proveedorKey || '';
    return {
      id: id,
      disponibilidadId: dispoId,
      cantidad: cantidad,
      destMes: destMes,
      destAnio: destAnio,
      proveedorNombre: proveedor,
      proveedorKey: proveedorKey,
      createdAt: a.createdAt || null,
      updatedAt: a.updatedAt || null,
      // extras que ayudan a UI
      originalTons: Number(a.originalTons || 0) || null,
      originalFecha: a.originalFecha || null,
    };
  }

  function buildCreateAsignPayload(input){
    return {
      disponibilidadId: input.disponibilidadId,
      cantidad: Number(input.cantidad)||0,
      destMes: Number(input.destMes)||null,
      destAnio: Number(input.destAnio)||null,
      proveedorNombre: input.proveedorNombre || '',
      proveedorKey: input.proveedorKey || '',
      originalTons: Number(input.originalTons)||null,
      originalFecha: input.originalFecha || null,
    };
  }

  var pathsDispon = ['/disponibilidades','/planificacion/disponibilidades','/planificacion/ofertas'];
  var pathsAsig = ['/asignaciones','/planificacion/asignaciones','/asignacion'];

  global.MMppApi = {
    // Disponibilidades
    getDisponibilidades: function(params){
      return tryGet(pathsDispon, params).then(function(raw){
        var arr = Array.isArray(raw && raw.items) ? raw.items : (Array.isArray(raw) ? raw : []);
        return arr.map(normalizeDisponibilidad);
      });
    },
    crearDisponibilidades: function(form){
      var payloads = buildCreateDisponPayload(form);
      return payloads.reduce(function(p,pay){ return p.then(function(){ return trySend('POST', pathsDispon, pay); }); }, Promise.resolve());
    },
    editarDisponibilidad: function(id, patch){
      var ps = pathsDispon.map(function(p){return p+'/'+encodeURIComponent(id);});
      return trySend('PATCH', ps, patch);
    },
    borrarDisponibilidad: function(id){
      var ps = pathsDispon.map(function(p){return p+'/'+encodeURIComponent(id);});
      return trySend('DELETE', ps, {});
    },

    // Asignaciones
    getAsignaciones: function(params){
      return tryGet(pathsAsig, params).then(function(raw){
        var arr = Array.isArray(raw && raw.items) ? raw.items : (Array.isArray(raw) ? raw : []);
        return arr.map(normalizeAsignacion);
      });
    },
    crearAsignacion: function(input){
      var body = buildCreateAsignPayload(input);
      return trySend('POST', pathsAsig, body);
    },
    editarAsignacion: function(id, patch){
      var ps = pathsAsig.map(function(p){return p+'/'+encodeURIComponent(id);});
      return trySend('PATCH', ps, patch);
    },
    borrarAsignacion: function(id){
      var ps = pathsAsig.map(function(p){return p+'/'+encodeURIComponent(id);});
      return trySend('DELETE', ps, {});
    }
  };
})(window);
