/* MMppApi – adaptador tolerante para disponibilidades y asignaciones (backend AppMitylus)
   Usa window.API_BASE (definido en /js/config.js):
     - En dev:  '/api'  (proxy o mismo host)
     - En prod: 'https://TU-BACKEND/api' (si pones window.API_URL en el HTML)

   Intenta múltiples variantes de ruta:
     - /asignaciones/:id        /asignaciones?id=ID
     - /asignacion/:id          /asignacion?id=ID
     - POST /asignaciones/delete|update  (body {id,...})

   Normaliza:
     Disponibilidad: {id, proveedorNombre, proveedorKey, contactoNombre, empresaNombre, telefono, email,
                      comuna, centroCodigo, areaCodigo, tons, fecha, mesKey, anio, mes, estado}
     Asignación:     {id, disponibilidadId, cantidad/tons, camiones, capacidadCamion,
                      destDia?, destMes, destAnio, destFecha, anio, mes, mesKey,
                      proveedorNombre, proveedorKey, contactoNombre, empresaNombre,
                      comuna, centroCodigo, areaCodigo,
                      transportistaId, transportistaNombre,
                      originalTons, originalFecha, fuente, estado, createdAt}
*/
(function (global) {
  // ===== BASE =====
  // Prioriza window.API_BASE (de js/config.js). Permite override con __MMPP_API_BASE__ si lo quieres.
  var API_BASE =
    (typeof global.API_BASE === "string" && global.API_BASE) ||
    (typeof global.__MMPP_API_BASE__ === "string" && global.__MMPP_API_BASE__) ||
    "/api";

  // asegura "https://host/api" + "/path" (o "/api" + "/path")
  function join(base, path) {
    return String(base).replace(/\/+$/,"") + "/" + String(path).replace(/^\/+/, "");
  }

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
    var parts=[]; for(var k in params) if(Object.prototype.hasOwnProperty.call(params,k)){
      var v=params[k]; if(v!==null && v!==undefined && v!==""){
        parts.push(encodeURIComponent(k)+"="+encodeURIComponent(String(v)));
      }
    } return parts.length?("?"+parts.join("&")):"";
  }

  // --- fetch helpers (con fallback de rutas) ---
  function doFetch(url, opts){
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Accept"] = "application/json";
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"]="application/json";
    opts.headers = headers;

    return fetch(url, opts).then(function(res){
      var ct = (res.headers.get("content-type")||"").toLowerCase();
      var parse = ct.indexOf("application/json")>=0 ? res.json() : res.text().then(function(t){ return { message: t }; });
      return parse.then(function(body){
        return { ok: res.ok, status: res.status, body: body };
      });
    }).catch(function(err){
      return { ok:false, status:0, body:{ message: (err && err.message) || "network error" } };
    });
  }

  // intenta varias combinaciones hasta que alguna devuelva ok=true (2xx)
  function tryRoutes(method, routes, bodyObj){
    var i=0;
    function next(){
      if (i>=routes.length) return Promise.resolve({ ok:false, status:404, body:{ message:"No matching route" }});
      var path = routes[i++], url = join(API_BASE, path);
      var opts = { method: method };
      if (bodyObj && (method!=="GET" && method!=="DELETE")) opts.body = JSON.stringify(bodyObj);
      if (method==="DELETE" && bodyObj && /\/delete/i.test(path)){ opts.body = JSON.stringify(bodyObj); }
      return doFetch(url, opts).then(function(res){
        if (res.ok) return res;
        if (res.status===404 || res.status===405 || res.status===400) return next(); // probar siguiente variante
        return res; // otros errores (500, etc): devolver
      });
    }
    return next();
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
        empresaNombre: a.empresaNombre || "",
        comuna: a.comuna || "",
        centroCodigo: a.centroCodigo || "",
        areaCodigo: a.areaCodigo || "",

        transportistaId: a.transportistaId || null,
        transportistaNombre: a.transportistaNombre || "",

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
      // OJO: paths SIN '/api' (API_BASE ya lo trae)
      var url = "/disponibilidades"+qs(params);
      return tryRoutes("GET",[url]).then(function(res){
        var json = (res && res.body) || [];
        var norm = normalizeDispon(json);
        _cacheDispon = norm;
        return norm;
      }).catch(function(){ return []; });
    },

    // ------- Asignaciones -------
    getAsignaciones: function(params){
      params=params||{};
      var paths = [
        "/asignaciones"+qs(params),
        "/asignacion"+qs(params)
      ];
      return tryRoutes("GET", paths).then(function(res){
        var json = (res && res.body) || [];
        var list = Array.isArray(json) ? json : (json && (json.items||json.data||json.results)) || [];
        var norm = normalizeAsign(list);
        var clean = norm.filter(function(a){ return a && Number(a.cantidad)>0 && (a.id || a.disponibilidadId); });
        clean.sort(function(a,b){
          var ta=a.createdAt?Date.parse(a.createdAt):0, tb=b.createdAt?Date.parse(b.createdAt):0; return tb-ta;
        });
        return clean;
      }).catch(function(){ return []; });
    },

    crearAsignacion: function(payload){
      var y = Number(payload.destAnio||payload.anio||0);
      var m = Number(payload.destMes ||payload.mes ||0);
      var d = Number(payload.destDia ||0);
      var mk = (y && m) ? (y+"-"+pad2(m)) : null;

      var cap = Number(payload.capacidadCamion||10);
      var tons = Number(payload.cantidad||payload.tons||0);
      var cam = cap>0 ? Math.ceil(tons/cap) : null;

      function pickDispo(list){
        for (var i=0;i<list.length;i++){
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
          disponibilidadId: payload.disponibilidadId,

          tons: tons,
          cantidad: tons,
          camiones: cam,
          capacidadCamion: cap,

          anio: y, mes: m, mesKey: mk,
          destAnio: y, destMes: m,
          destDia: d || null,
          destFecha: payload.destFecha || (y&&m&&(new Date(y,m-1,d||1)).toISOString()),

          proveedorNombre: proveedorNombre,
          proveedorKey: proveedorKey,
          contactoNombre: (dispo && dispo.contactoNombre) || "",
          empresaNombre:  (dispo && dispo.empresaNombre)  || "",
          comuna:         (dispo && dispo.comuna)         || "",
          centroCodigo:   (dispo && dispo.centroCodigo)   || "",
          areaCodigo:     (dispo && dispo.areaCodigo)     || "",
          contactoTelefono: (dispo && dispo.telefono)     || "",
          contactoEmail:    (dispo && dispo.email)        || "",

          transportistaId: payload.transportistaId || null,
          transportistaNombre: payload.transportistaNombre || "",

          originalTons:  (payload.originalTons!=null ? Number(payload.originalTons) : (dispo?Number(dispo.tons||0):null)),
          originalFecha: payload.originalFecha || (dispo?dispo.fecha:null),

          fuente: "ui-calendario",
          estado: "confirmado",

          createdAt: new Date().toISOString()
        };

        var paths = ["/asignaciones"];
        return tryRoutes("POST", paths, body).then(function(res){
          var j = res && res.body; j = j && j.body ? j.body : j;
          if (!res || !res.ok) {
            var err = new Error((j && j.message) || "Error creando asignación");
            err.status = res && res.status; throw err;
          }
          return j;
        });
      });
    },

    editarAsignacion: function(id, patch){
      var cap = Number(patch.capacidadCamion || patch.cap_camion || 10);
      var qty = (patch.cantidad!=null ? Number(patch.cantidad) :
                (patch.tons!=null ? Number(patch.tons) : null));
      var body = Object.assign({}, patch);
      if (qty!=null){ body.tons = qty; body.cantidad = qty; body.camiones = Math.ceil(qty/(cap||10)); }

      var paths = [
        "/asignaciones/"+encodeURIComponent(id),
        "/asignaciones?id="+encodeURIComponent(id),
        "/asignacion/"+encodeURIComponent(id),
        "/asignacion?id="+encodeURIComponent(id),
        "/asignaciones/update"
      ];
      return tryRoutes("PATCH", paths, body).then(function(res){
        if (!res.ok) return tryRoutes("PUT", paths, body);   // fallback PUT
        return res;
      }).then(function(res){
        if (!res.ok) return tryRoutes("POST", ["/asignaciones/update","/asignacion/update"], Object.assign({ id:id }, body)); // último intento
        return res;
      }).then(function(res){
        var j = res && res.body; j = j && j.body ? j.body : j;
        if (!res || !res.ok) {
          var err = new Error((j && j.message) || "Error editando asignación"); err.status=res&&res.status; throw err;
        }
        return j;
      });
    },

    borrarAsignacion: function(id){
      var q = "?id="+encodeURIComponent(id);
      var paths = [
        "/asignaciones/"+encodeURIComponent(id),
        "/asignaciones"+q,
        "/asignacion/"+encodeURIComponent(id),
        "/asignacion"+q,
        "/asignaciones/delete",
        "/asignacion/delete"
      ];
      return tryRoutes("DELETE", paths).then(function(res){
        if (!res.ok) return tryRoutes("POST", ["/asignaciones/delete","/asignacion/delete"], { id:id });
        return res;
      }).then(function(res){
        var j = res && res.body; j = j && j.body ? j.body : j;
        if (!res || !res.ok) {
          var err = new Error((j && j.message) || "Error eliminando asignación"); err.status=res&&res.status; throw err;
        }
        return j || null;
      });
    }
  };

  global.MMppApi = API;
})(window);
