/* MMppApi – adaptador para disponibilidades y asignaciones (backend AppMitylus)
   Backend base: https://backend-appmitylus.vercel.app
   Rutas usadas:
     - /api/disponibilidades  (GET, POST, PATCH, DELETE)
     - /api/asignaciones      (GET, POST, PATCH, DELETE)
   Normaliza:
     Disponibilidad: {id, proveedorNombre, proveedorKey, contactoNombre, empresaNombre, telefono, email,
                      comuna, centroCodigo, areaCodigo, tons, fecha, mesKey, anio, mes, estado}
     Asignación:     {id, disponibilidadId, cantidad/tons, camiones, capacidadCamion,
                      destDia?, destMes, destAnio, destFecha, anio, mes, mesKey,
                      proveedorNombre, proveedorKey, contactoNombre, comuna, centroCodigo, areaCodigo,
                      originalTons, originalFecha, fuente, estado, createdAt}
*/
(function (global) {
  var API_BASE = (typeof global.__MMPP_API_BASE__ === "string" && global.__MMPP_API_BASE__) ||
                 "https://backend-appmitylus.vercel.app";

  // --- utils ---
  function pad2(n){ n=Number(n)||0; return (n<10?"0":"")+n; }
  function slug(val){
    val=(val||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
    return val || "sin-proveedor";
  }
  function toMesKey(d){
    if(!d) return null; try{ var dt=new Date(d);
      if(isNaN(dt.getTime())) return null;
      return dt.getFullYear()+"-"+pad2(dt.getMonth()+1);
    }catch(e){ return null; }
  }
  function fromMesKey(mk){
    if(!mk || mk.indexOf("-")<0) return null;
    var p=mk.split("-"), y=Number(p[0])||0, m=Number(p[1])||1;
    return new Date(y, m-1, 1).toISOString();
  }
  function qs(params){
    var parts=[]; for(var k in params) if(params.hasOwnProperty(k)){
      var v=params[k]; if(v!==null && v!==undefined && v!==""){
        parts.push(encodeURIComponent(k)+"="+encodeURIComponent(String(v)));
      }
    } return parts.length?("?"+parts.join("&")):"";
  }
  function jfetch(url, opts){
    opts=opts||{}; var headers=opts.headers||{};
    headers["Accept"]="application/json";
    if(opts.body && !headers["Content-Type"]) headers["Content-Type"]="application/json";
    opts.headers=headers;
    return fetch(url, opts).then(function(res){
      if(res.status===204) return null;
      if(res.status===404){ var e=new Error("404"); e.status=404; throw e; }
      // Devolvemos JSON incluso si es 4xx, para que el caller pueda mostrar mensaje del backend
      return res.json().then(function(j){ j.__status=res.status; return j; });
    });
  }

  // --- cache simple de disponibilidades para enriquecer asignaciones ---
  var _cacheDispon = [];

  // --- normalizadores ---
  function normalizeDispon(payload){
    var list = Array.isArray(payload) ? payload
              : (payload && (payload.items||payload.data||payload.results)) || [];
    var out = list.map(function(r){
      var id = r.id || r._id || r._docId || r.uuid || null;
      var tons = (r.tonsDisponible!=null ? Number(r.tonsDisponible) : Number(r.tons||0));
      var mk = r.mesKey || (r.anio&&r.mes ? (r.anio+"-"+pad2(r.mes)) : (r.fecha?toMesKey(r.fecha):null));
      var fecha = r.fecha || (mk?fromMesKey(mk):null);
      var tel = (r.contactoSnapshot && (r.contactoSnapshot.telefono || r.contactoSnapshot.phone)) || r.contactoTelefono || "";
      var email = (r.contactoSnapshot && r.contactoSnapshot.email) || r.contactoEmail || "";

      var proveedorNombre = r.proveedorNombre || r.proveedor || r.contactoNombre || r.contacto || "";
      return {
        id: id,
        contactoNombre: r.contactoNombre || r.contacto || "",
        empresaNombre : r.empresaNombre  || r.empresa  || "",
        proveedorNombre: proveedorNombre,
        proveedorKey   : r.proveedorKey || slug(proveedorNombre),
        telefono: tel, email: email,
        comuna: r.comuna || "",
        centroCodigo: r.centroCodigo || "",
        areaCodigo: r.areaCodigo || "",
        tons: Number(tons||0),
        fecha: fecha,
        mesKey: mk,
        anio: r.anio || (mk?Number(mk.split("-")[0]):null),
        mes : r.mes  || (mk?Number(mk.split("-")[1]):null),
        estado: r.estado || "disponible"
      };
    });
    return out;
  }

  function normalizeAsign(payload){
    var list = Array.isArray(payload) ? payload
              : (payload && (payload.items||payload.data||payload.results)) || [];
    return list.map(function(a){
      var tons = (a.tons!=null ? Number(a.tons) : Number(a.cantidad||0));
      return {
        id: a.id || a._id || a.uuid || null,
        disponibilidadId: a.disponibilidadId || a.disponibilidad || a.dispoId || null,
        cantidad: tons,
        tons: tons,
        camiones: a.camiones!=null ? Number(a.camiones) : null,
        capacidadCamion: a.capacidadCamion!=null ? Number(a.capacidadCamion) : null,

        destDia: (a.destDia!=null ? Number(a.destDia) : null),
        destMes: Number(a.destMes || a.mes || 0) || null,
        destAnio: Number(a.destAnio || a.anio || 0) || null,
        destFecha: a.destFecha || null,

        anio: a.anio!=null ? Number(a.anio) : (a.destAnio!=null?Number(a.destAnio):null),
        mes : a.mes !=null ? Number(a.mes ) : (a.destMes !=null?Number(a.destMes ):null),
        mesKey: a.mesKey || (a.anio && a.mes ? (a.anio+"-"+pad2(a.mes)) : null),

        proveedorNombre: a.proveedorNombre || a.proveedor || "",
        proveedorKey: a.proveedorKey || (a.proveedorNombre?slug(a.proveedorNombre):""),
        contactoNombre: a.contactoNombre || "",
        comuna: a.comuna || "",
        centroCodigo: a.centroCodigo || "",
        areaCodigo: a.areaCodigo || "",

        originalTons: a.originalTons!=null ? Number(a.originalTons) : null,
        originalFecha: a.originalFecha || null,

        fuente: a.fuente || "",
        estado: a.estado || "",
        createdAt: a.createdAt || a.fecha || null
      };
    });
  }

  // --- API pública ---
  var API = {
    // ------- Disponibilidades -------
    getDisponibilidades: function(params){
      params=params||{};
      if(!params.anio && !params.from && !params.to && !params.mesKey){
        var y=new Date().getFullYear();
        params.from=(y-1)+"-01"; params.to=(y+1)+"-12";
      }
      var url = API_BASE.replace(/\/+$/,"")+"/api/disponibilidades"+qs(params);
      return jfetch(url).then(function(json){
        var norm = normalizeDispon(json);
        _cacheDispon = norm; // cache
        return norm;
      }).catch(function(){ return []; });
    },

    crearDisponibilidades: function(form){
      var rows = Array.isArray(form.disponibilidades) ? form.disponibilidades : [];
      var payloads = rows.filter(function(d){return d&&d.tons&&d.fecha;}).map(function(d){
        var dt=new Date(d.fecha), anio=dt.getFullYear(), mes=dt.getMonth()+1;
        return {
          mesKey: anio+"-"+pad2(mes), anio: anio, mes: mes,
          proveedorKey: form.proveedorKey || slug(form.proveedor),
          proveedorNombre: form.proveedor || "",
          centroCodigo: form.centroCodigo || "",
          comuna: form.comuna || "",
          areaCodigo: form.areaCodigo || "",
          tonsDisponible: Number(d.tons||0),
          fecha: dt.toISOString(),
          estado: "disponible"
        };
      });
      if(!payloads.length) return Promise.resolve(null);
      var base = API_BASE.replace(/\/+$/,"")+"/api/disponibilidades";
      return Promise.all(payloads.map(function(body){
        return jfetch(base,{method:"POST",body:JSON.stringify(body)}).catch(function(){return null;});
      }));
    },

    editarDisponibilidad: function(id,patch){
      var url = API_BASE.replace(/\/+$/,"")+"/api/disponibilidades/"+encodeURIComponent(id);
      return jfetch(url,{method:"PATCH",body:JSON.stringify(patch||{})}).catch(function(){return null;});
    },

    borrarDisponibilidad: function(id){
      var url = API_BASE.replace(/\/+$/,"")+"/api/disponibilidades/"+encodeURIComponent(id);
      return jfetch(url,{method:"DELETE"}).catch(function(){return null;});
    },

    // ------- Asignaciones -------
    getAsignaciones: function(params){
      params=params||{};
      var url = API_BASE.replace(/\/+$/,"")+"/api/asignaciones"+qs(params);
      return jfetch(url).then(function(json){
        var list = Array.isArray(json) ? json : (json && (json.items||json.data||json.results)) || [];
        var norm = normalizeAsign(list);
        // filtro básico
        var clean = norm.filter(function(a){ return a && Number(a.cantidad)>0 && (a.id || a.disponibilidadId); });
        clean.sort(function(a,b){
          var ta=a.createdAt?Date.parse(a.createdAt):0, tb=b.createdAt?Date.parse(b.createdAt):0; return tb-ta;
        });
        return clean;
      }).catch(function(){ return []; });
    },

    // >>> CREA ASIGNACIÓN ENRIQUECIDA <<<
    crearAsignacion: function(payload){
      var url = API_BASE.replace(/\/+$/,"")+"/api/asignaciones";

      var y = Number(payload.destAnio||payload.anio||0);
      var m = Number(payload.destMes ||payload.mes ||0);
      var d = Number(payload.destDia ||0);
      var mk = (y && m) ? (y+"-"+pad2(m)) : null;

      // capacidadCamion: del payload o default 10
      var cap = Number(payload.capacidadCamion||10);
      var tons = Number(payload.cantidad||payload.tons||0);
      var cam = cap>0 ? Math.ceil(tons/cap) : null;

      // buscamos la disponibilidad para snapshot de proveedor/ubicación
      function pickDispo(list){
        for(var i=0;i<list.length;i++){
          if(String(list[i].id)===String(payload.disponibilidadId)) return list[i];
        }
        return null;
      }

      var ensureDispo = (_cacheDispon && _cacheDispon.length)
        ? Promise.resolve(pickDispo(_cacheDispon))
        : API.getDisponibilidades().then(function(ds){ return pickDispo(ds); });

      return ensureDispo.then(function(dispo){
        var proveedorNombre = payload.proveedorNombre || (dispo?dispo.proveedorNombre:"") || (dispo?dispo.contactoNombre:"") || "";
        var proveedorKey    = (dispo && dispo.proveedorKey) || slug(proveedorNombre);

        var body = {
          // claves de referencia
          disponibilidadId: payload.disponibilidadId,

          // cantidades
          tons: tons,                 // <- nombre habitual en tu colección
          cantidad: tons,             // <- alias por compatibilidad
          camiones: cam,
          capacidadCamion: cap,

          // tiempo
          anio: y, mes: m, mesKey: mk,
          destAnio: y, destMes: m,
          destDia: d || null,
          destFecha: payload.destFecha || (y&&m&&(new Date(y,m-1,d||1)).toISOString()),

          // snapshot proveedor/ubicación/contacto
          proveedorNombre: proveedorNombre,
          proveedorKey: proveedorKey,
          contactoNombre: (dispo && dispo.contactoNombre) || "",
          empresaNombre:  (dispo && dispo.empresaNombre)  || "",
          comuna:         (dispo && dispo.comuna)         || "",
          centroCodigo:   (dispo && dispo.centroCodigo)   || "",
          areaCodigo:     (dispo && dispo.areaCodigo)     || "",
          contactoTelefono: (dispo && dispo.telefono)     || "",
          contactoEmail:    (dispo && dispo.email)        || "",

          // snapshot origen
          originalTons:  (payload.originalTons!=null ? Number(payload.originalTons) : (dispo?Number(dispo.tons||0):null)),
          originalFecha: payload.originalFecha || (dispo?dispo.fecha:null),

          // control
          fuente: "ui-calendario",
          estado: "confirmado",

          createdAt: new Date().toISOString()
        };

        return jfetch(url,{ method:"POST", body: JSON.stringify(body) });
      });
    },

    editarAsignacion: function(id, patch){
      var url = API_BASE.replace(/\/+$/,"")+"/api/asignaciones/"+encodeURIComponent(id);
      return jfetch(url,{ method:"PATCH", body: JSON.stringify(patch||{}) }).catch(function(){ return null; });
    },

    borrarAsignacion: function(id){
      var url = API_BASE.replace(/\/+$/,"")+"/api/asignaciones/"+encodeURIComponent(id);
      return jfetch(url,{ method:"DELETE" }).catch(function(){ return null; });
    }
  };

  global.MMppApi = API;
})(window);
