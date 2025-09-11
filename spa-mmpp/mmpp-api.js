/* MMppApi – adaptador para disponibilidades y asignaciones (backend AppMitylus)
   Backend base: https://backend-appmitylus.vercel.app
   Rutas usadas:
     - /api/disponibilidades  (GET, POST, PATCH, DELETE)
     - /api/asignaciones      (GET, POST, PATCH, DELETE)  ← si aún no existe, devolvemos vacío
   Notas:
     - Sin optional chaining (Babel Standalone 6).
     - Normaliza:
         Disponibilidad: {id, proveedorNombre, proveedorKey, comuna, centroCodigo, areaCodigo, tons, fecha, mesKey, anio, mes, estado}
         Asignación:     {id, disponibilidadId, cantidad, destMes, destAnio, proveedorNombre, originalTons, originalFecha, createdAt}
*/

(function (global) {
  // === CONFIG: base del backend (puedes sobrescribir con window.__MMPP_API_BASE__) ===
  var API_BASE = (typeof global.__MMPP_API_BASE__ === "string" && global.__MMPP_API_BASE__) ||
                 "https://backend-appmitylus.vercel.app";

  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? "0" : "") + n;
  }
  function slug(val) {
    val = (val || "").toString().toLowerCase();
    val = val.replace(/[^a-z0-9]+/g, "-");
    val = val.replace(/(^-|-$)/g, "");
    return val || "sin-proveedor";
  }
  function toMesKey(d) {
    if (!d) return null;
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1);
    } catch (e) { return null; }
  }
  function fromMesKey(mk) {
    if (!mk || mk.indexOf("-") < 0) return null;
    var p = mk.split("-");
    var y = Number(p[0]) || 0;
    var m = Number(p[1]) || 1;
    return new Date(y, m - 1, 1).toISOString();
  }
  function qs(params) {
    var parts = [];
    for (var k in params) if (params.hasOwnProperty(k)) {
      var v = params[k];
      if (v !== null && v !== undefined && v !== "") {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
      }
    }
    return parts.length ? ("?" + parts.join("&")) : "";
  }
  function jfetch(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Accept"] = "application/json";
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    opts.headers = headers;

    return fetch(url, opts).then(function (res) {
      if (res.status === 204) return null;
      // si un endpoint no existe aún (p. ej. asignaciones), devolvemos null
      if (res.status === 404) {
        var e = new Error("404");
        e.status = 404;
        throw e;
      }
      return res.json();
    });
  }

  // --- Normalizadores ---
  function normalizeDispon(payload) {
  var list = [];
  if (Array.isArray(payload)) list = payload;
  else if (payload && Array.isArray(payload.items)) list = payload.items;

  return list.map(function (r) {
    var id = r.id || r._id || r._docId || r.uuid || null;
    var tons = (r.tonsDisponible != null ? Number(r.tonsDisponible) : Number(r.tons || 0));

    var mk = r.mesKey ||
      (r.anio && r.mes ? (r.anio + "-" + pad2(r.mes)) : null) ||
      (r.fecha ? toMesKey(r.fecha) : null);

    var fecha = r.fecha || (mk ? fromMesKey(mk) : null);

    // snapshot de contacto
    var tel = (r.contactoSnapshot && (r.contactoSnapshot.telefono || r.contactoSnapshot.phone)) || r.contactoTelefono || "";
    var email = (r.contactoSnapshot && r.contactoSnapshot.email) || r.contactoEmail || "";

    return {
      id: id,

      // nombres/keys
      contactoNombre: r.contactoNombre || r.contacto || "",
      empresaNombre : r.empresaNombre  || r.empresa  || "",
      proveedorNombre: r.proveedorNombre || r.proveedor || "",
      proveedorKey   : r.proveedorKey || slug(r.proveedorNombre || r.proveedor || ""),

      // contacto visible
      telefono: tel,
      email: email,

      // ubicación/base
      comuna: r.comuna || "",
      centroCodigo: r.centroCodigo || "",
      areaCodigo: r.areaCodigo || "",

      // cantidades/fechas
      tons: Number(tons || 0),
      fecha: fecha,
      mesKey: mk,
      anio: r.anio || (mk ? Number(mk.split("-")[0]) : null),
      mes : r.mes  || (mk ? Number(mk.split("-")[1]) : null),

      estado: r.estado || "disponible"
    };
  });
}

  function normalizeAsign(payload) {
    var list = [];
    if (Array.isArray(payload)) list = payload;
    else if (payload && Array.isArray(payload.items)) list = payload.items;

    return list.map(function (a) {
      return {
        id: a.id || a._id || a.uuid || null,
        disponibilidadId: a.disponibilidadId || a.disponibilidad || a.dispoId || null,
        cantidad: Number(a.cantidad || 0),
        destMes: Number(a.destMes || a.mes || 0) || null,
        destAnio: Number(a.destAnio || a.anio || 0) || null,
        proveedorNombre: a.proveedorNombre || a.proveedor || "",
        originalTons: Number(a.originalTons || a.original || 0) || null,
        originalFecha: a.originalFecha || a.fechaOriginal || null,
        createdAt: a.createdAt || a.fecha || null
      };
    });
  }

  // --- API pública ---
  var API = {
    // ------- Disponibilidades -------
    // params: { anio, from, to, mesKey, proveedorKey, centroId }
   // mmpp-api.js
getDisponibilidades: function (params) {
  params = params || {};

  // ❌ antes: sólo el año actual
  // if (!params.anio && !params.from && !params.to && !params.mesKey) {
  //   params.anio = new Date().getFullYear();
  // }

  // ✅ ahora: desde (año-1)-01 hasta (año+1)-12
  if (!params.anio && !params.from && !params.to && !params.mesKey) {
    var y = new Date().getFullYear();
    params.from = (y - 1) + "-01";
    params.to   = (y + 1) + "-12";
  }

  var url = API_BASE.replace(/\/+$/, "") + "/api/disponibilidades" + qs(params);
  return jfetch(url)
    .then(function (json) { return normalizeDispon(json); })
    .catch(function () { return []; });
},

    crearDisponibilidades: function (form) {
      // form: { proveedor, proveedorKey, comuna, centroCodigo, areaCodigo, disponibilidades:[{tons,fecha}] }
      var rows = Array.isArray(form.disponibilidades) ? form.disponibilidades : [];
      var payloads = rows
        .filter(function (d) { return d && d.tons && d.fecha; })
        .map(function (d) {
          var dt = new Date(d.fecha);
          var anio = dt.getFullYear();
          var mes  = dt.getMonth() + 1;
          return {
            mesKey: anio + "-" + pad2(mes),
            anio: anio,
            mes: mes,
            proveedorKey: form.proveedorKey || slug(form.proveedor),
            proveedorNombre: form.proveedor || "",
            centroCodigo: form.centroCodigo || "",
            comuna: form.comuna || "",
            areaCodigo: form.areaCodigo || "",
            tonsDisponible: Number(d.tons || 0),
            fecha: dt.toISOString(),
            estado: "disponible"
          };
        });

      if (!payloads.length) return Promise.resolve(null);

      var base = API_BASE.replace(/\/+$/, "") + "/api/disponibilidades";
      // tu backend crea de a 1 documento → un POST por item
      var jobs = payloads.map(function (body) {
        return jfetch(base, { method: "POST", body: JSON.stringify(body) })
          .catch(function () { return null; });
      });
      return Promise.all(jobs);
    },

    editarDisponibilidad: function (id, patch) {
      var url = API_BASE.replace(/\/+$/, "") + "/api/disponibilidades/" + encodeURIComponent(id);
      return jfetch(url, { method: "PATCH", body: JSON.stringify(patch || {}) })
        .catch(function () { return null; });
    },

    borrarDisponibilidad: function (id) {
      var url = API_BASE.replace(/\/+$/, "") + "/api/disponibilidades/" + encodeURIComponent(id);
      return jfetch(url, { method: "DELETE" }).catch(function () { return null; });
    },

    // ------- Asignaciones -------
getAsignaciones: function (params) {
  params = params || {};
  var url = API_BASE.replace(/\/+$/, "") + "/api/asignaciones" + qs(params);

  return jfetch(url)
    .then(function (json) {
      // Soporta array directo o {items}/{data}/{results}
      var list = Array.isArray(json)
        ? json
        : (json && (json.items || json.data || json.results)) || [];

      var norm = normalizeAsign(list);

      // Filtra asignaciones “reales”: cantidad > 0
      var clean = norm.filter(function (a) {
        return a && Number(a.cantidad) > 0 && (a.id || a.disponibilidadId);
      });

      // Ordena por fecha (desc) si existe
      clean.sort(function (a, b) {
        var ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        var tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });

      return clean;
    })
    .catch(function () {
      // si no existe la ruta aún o falla, devolvemos vacío
      return [];
    });
},

    crearAsignacion: function (payload) {
      var url = API_BASE.replace(/\/+$/, "") + "/api/asignaciones";
      var body = {
        disponibilidadId: payload.disponibilidadId,
        cantidad: Number(payload.cantidad || 0),
        destMes: Number(payload.destMes || 0) || null,
        destAnio: Number(payload.destAnio || 0) || null,
        proveedorNombre: payload.proveedorNombre || "",
        originalTons: Number(payload.originalTons || 0) || null,
        originalFecha: payload.originalFecha || null,
        createdAt: new Date().toISOString()
      };
      return jfetch(url, { method: "POST", body: JSON.stringify(body) })
        .catch(function () { return null; });
    },

    editarAsignacion: function (id, patch) {
      var url = API_BASE.replace(/\/+$/, "") + "/api/asignaciones/" + encodeURIComponent(id);
      return jfetch(url, { method: "PATCH", body: JSON.stringify(patch || {}) })
        .catch(function () { return null; });
    },

    borrarAsignacion: function (id) {
      var url = API_BASE.replace(/\/+$/, "") + "/api/asignaciones/" + encodeURIComponent(id);
      return jfetch(url, { method: "DELETE" })
        .catch(function () { return null; });
    }
  };

  global.MMppApi = API;
})(window);
