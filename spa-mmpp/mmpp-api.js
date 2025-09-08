/* MMppApi – adaptador robusto para disponibilidades y asignaciones
   - Sin optional chaining para que funcione con Babel Standalone 6.
   - Normaliza campos a:
     Disponibilidad: {id, proveedorNombre, proveedorKey, comuna, centroCodigo, areaCodigo, tons, fecha, mesKey, anio, mes, estado}
     Asignación:     {id, disponibilidadId, cantidad, destMes, destAnio, proveedorNombre, originalTons, originalFecha, createdAt}
*/
const API_BASE = 'https://backend-appmitylus.vercel.app';

(function (global) {
  var BASE_CANDIDATES = [];
  // 1) Si el backend está mapeado a /api en el mismo dominio
  BASE_CANDIDATES.push(location.origin + "/api");
  BASE_CANDIDATES.push("/api");
  // 2) Fallback conocido (cámbialo si usas otro)
  BASE_CANDIDATES.push("https://backend-appmitylus.vercel.app/api");
  // 3) Permite override con window.__MMPP_API_BASE__
  if (typeof global.__MMPP_API_BASE__ === "string") {
    BASE_CANDIDATES.unshift(global.__MMPP_API_BASE__.replace(/\/+$/, ""));
  }

  var _resolved = {
    dispo: null,
    asig: null,
  };

  function slug(val) {
    val = (val || "").toString().toLowerCase();
    val = val.replace(/[^a-z0-9]+/g, "-");
    val = val.replace(/(^-|-$)/g, "");
    return val || "sin-proveedor";
  }

  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? "0" : "") + n;
  }

  function toMesKey(d) {
    if (!d) return null;
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1);
    } catch (e) {
      return null;
    }
  }

  function fromMesKey(mk) {
    if (!mk || mk.indexOf("-") < 0) return null;
    var p = mk.split("-");
    var y = Number(p[0]) || 0;
    var m = Number(p[1]) || 1;
    return new Date(y, m - 1, 1).toISOString();
  }

  function jfetch(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Accept"] = "application/json";
    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    opts.headers = headers;
    return fetch(url, opts).then(function (res) {
      if (res.status === 404) {
        var e = new Error("404");
        e.status = 404;
        throw e;
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  // Probar una lista de rutas para encontrar la primera válida
  function resolveEndpoint(candidates, memoKey) {
    if (memoKey && _resolved[memoKey]) return Promise.resolve(_resolved[memoKey]);

    var bases = BASE_CANDIDATES.slice(0);
    function tryNextBase() {
      if (!bases.length) throw new Error("No endpoints available");
      var base = bases.shift();

      var idx = 0;
      function tryNextPath() {
        if (idx >= candidates.length) return tryNextBase();
        var path = candidates[idx++];
        var url = base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
        // Hacemos un GET "ligero" y si no es 404 nos sirve
        return jfetch(url)
          .then(function () {
            if (memoKey) _resolved[memoKey] = url;
            return url;
          })
          .catch(function (err) {
            if (err && err.status === 404) return tryNextPath();
            // Si falla por CORS u otro, probamos siguiente base
            return tryNextBase();
          });
      }
      return tryNextPath();
    }

    return tryNextBase();
  }

  function normalizeDispon(list) {
    list = Array.isArray(list) ? list : [];
    return list.map(function (r) {
      var id = r.id || r._id || r._docId || r.uuid || null;
      var tons =
        (r.tonsDisponible != null ? r.tonsDisponible : null) != null
          ? Number(r.tonsDisponible)
          : Number(r.tons || 0);

      var mk =
        r.mesKey ||
        (r.anio && r.mes ? (r.anio + "-" + pad2(r.mes)) : null) ||
        (r.fecha ? toMesKey(r.fecha) : null);

      var fecha = r.fecha || (mk ? fromMesKey(mk) : null);

      return {
        id: id,
        proveedorNombre: r.proveedorNombre || r.proveedor || "",
        proveedorKey: r.proveedorKey || slug(r.proveedorNombre || r.proveedor),
        comuna: r.comuna || "",
        centroCodigo: r.centroCodigo || "",
        areaCodigo: r.areaCodigo || "",
        tons: Number(tons || 0),
        fecha: fecha,
        mesKey: mk,
        anio: r.anio || (mk ? Number(mk.split("-")[0]) : null),
        mes: r.mes || (mk ? Number(mk.split("-")[1]) : null),
        estado: r.estado || "disponible",
      };
    });
  }

  function normalizeAsign(list) {
    list = Array.isArray(list) ? list : [];
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
        createdAt: a.createdAt || a.fecha || null,
      };
    });
  }

  var API = {
    // ------- Disponibilidades -------
    getDisponibilidades: function () {
      var candidates = [
        "/planificacion/disponibilidades",
        "/disponibilidades",
        "/planificacion/ofertas",
      ];
      return resolveEndpoint(candidates, "dispo")
        .then(function (url) {
          return jfetch(url);
        })
        .then(function (json) {
          return normalizeDispon(json);
        })
        .catch(function () {
          // 404 u otra falla ⇒ devolvemos lista vacía
          return [];
        });
    },

    crearDisponibilidades: function (form) {
      // form: { proveedor, proveedorKey, comuna, centroCodigo, areaCodigo, contacto, disponibilidades:[{tons,fecha}] }
      var rows = Array.isArray(form.disponibilidades) ? form.disponibilidades : [];
      var body = rows
        .filter(function (d) {
          return d && d.tons && d.fecha;
        })
        .map(function (d) {
          var dt = new Date(d.fecha);
          var anio = dt.getFullYear();
          var mes = dt.getMonth() + 1;
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
            estado: "disponible",
          };
        });

      if (!body.length) return Promise.resolve();

      var candidates = [
        "/planificacion/disponibilidades",
        "/disponibilidades",
        "/planificacion/ofertas",
      ];

      return resolveEndpoint(candidates, "dispo").then(function (url) {
        return jfetch(url, {
          method: "POST",
          body: JSON.stringify(body),
        }).catch(function () {
          // si falla, al menos no romper el flujo del front
          return null;
        });
      });
    },

    // ------- Asignaciones -------
    getAsignaciones: function () {
      var candidates = [
        "/planificacion/asignaciones",
        "/asignaciones",
        "/asignacion",
      ];
      return resolveEndpoint(candidates, "asig")
        .then(function (url) {
          return jfetch(url);
        })
        .then(function (json) {
          return normalizeAsign(json);
        })
        .catch(function () {
          return [];
        });
    },

    crearAsignacion: function (payload) {
      var candidates = [
        "/planificacion/asignaciones",
        "/asignaciones",
        "/asignacion",
      ];
      return resolveEndpoint(candidates, "asig").then(function (url) {
        var body = {
          disponibilidadId: payload.disponibilidadId,
          cantidad: Number(payload.cantidad || 0),
          destMes: Number(payload.destMes || 0) || null,
          destAnio: Number(payload.destAnio || 0) || null,
          proveedorNombre: payload.proveedorNombre || "",
          originalTons: Number(payload.originalTons || 0) || null,
          originalFecha: payload.originalFecha || null,
          createdAt: new Date().toISOString(),
        };
        return jfetch(url, {
          method: "POST",
          body: JSON.stringify(body),
        }).catch(function () {
          return null;
        });
      });
    },

    editarAsignacion: function (id, patch) {
      var candidates = [
        "/planificacion/asignaciones",
        "/asignaciones",
        "/asignacion",
      ];
      return resolveEndpoint(candidates, "asig").then(function (base) {
        var url = base.replace(/\/+$/, "") + "/" + encodeURIComponent(id);
        return jfetch(url, {
          method: "PATCH",
          body: JSON.stringify(patch || {}),
        }).catch(function () {
          return null;
        });
      });
    },

    borrarAsignacion: function (id) {
      var candidates = [
        "/planificacion/asignaciones",
        "/asignaciones",
        "/asignacion",
      ];
      return resolveEndpoint(candidates, "asig").then(function (base) {
        var url = base.replace(/\/+$/, "") + "/" + encodeURIComponent(id);
        return jfetch(url, { method: "DELETE" }).catch(function () {
          return null;
        });
      });
    },
  };

  global.MMppApi = API;
})(window);
