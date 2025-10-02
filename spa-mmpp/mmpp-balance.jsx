/* /spa-mmpp/mmpp-balance.jsx */
/* eslint-disable no-undef */
const { useEffect, useMemo, useState } = React;

(function (global) {
  var UI = { brand1:"#4f46e5", brand2:"#9333ea" };
  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var API_BASE = (typeof window!=="undefined" && window.API_URL) ? window.API_URL : "/api";

  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function fmtTons(v){ return num(v,0).toLocaleString("es-CL", { maximumFractionDigits: 1 }); }
  function monthLabelFromKey(mesKey){
    if(!mesKey) return "—";
    var parts = String(mesKey).split("-");
    var y = parseInt(parts[0],10);
    var m = clamp(parseInt(parts[1]||"1",10)||1,1,12);
    return (MESES[m-1] || "—") + " " + (isFinite(y) ? y : "");
  }
  function monthIdx(mesKey){
    var m = parseInt(String(mesKey).split("-")[1]||"1",10); return clamp(isFinite(m)?m:1,1,12);
  }

  /* ===================== normalización de nombres ===================== */
  function canonicalize(s){
    s = (s==null?"":String(s));
    // quita tildes
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g,""); } catch(e){}
    // minusculas, sin puntuación, espacios únicos
    s = s.toLowerCase()
         .replace(/[.,;:()'"`´]/g," ")
         .replace(/\s+/g," ")
         .trim();
    return s;
  }
  function looksLikeName(s){
    if (!s) return false;
    s = String(s).trim();
    if (s.length < 4) return false;
    // al menos dos palabras con letras
    if (!(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(s))) return false;
    if (s.indexOf(" ") < 0) return false;
    return true;
  }

  // Busca candidato de contacto en cualquier campo "obvio"
  function guessContactFromRecord(r){
    if (!r || typeof r!=="object") return "";
    var keys = Object.keys(r || {});
    // claves “obvias”
    var prefer = ["contactoNombre","nombreContacto","contact_name","contactName","contacto",
                  "responsableNombre","solicitanteNombre","vendedor","encargado","persona","nombre"];
    for (var i=0;i<prefer.length;i++){
      var k = prefer[i];
      if (r[k] && looksLikeName(r[k])) return String(r[k]).trim();
    }
    // barrido general: cualquier string que “parezca” nombre
    for (var j=0;j<keys.length;j++){
      var v = r[keys[j]];
      if (typeof v === "string" && looksLikeName(v)) return String(v).trim();
      if (v && typeof v === "object"){
        if (v.nombre && looksLikeName(v.nombre)) return String(v.nombre).trim();
        if (v.name && looksLikeName(v.name)) return String(v.name).trim();
        if (v.fullname && looksLikeName(v.fullname)) return String(v.fullname).trim();
      }
    }
    return "";
  }

  // nombre mostrado + clave canónica para agrupar
  function providerDisplayAndKey(r){
    var raw = (r && r.proveedorNombre) ? String(r.proveedorNombre).trim() : "";
    var disp = raw;
    if (!disp || disp === "-" || disp === "—" || disp.toLowerCase()==="n/a"){
      var c = guessContactFromRecord(r);
      disp = c || "Sin proveedor";
    }
    // normalizar varias variantes al mismo grupo
    var key = canonicalize(disp);
    return { display: disp, key: key };
  }

  /* ====================== CSV ====================== */
  function CSVButton(props){
    function toCSV(rows){
      var head = ["Mes","Proveedor","Disponible(t)","Asignado(t)","Saldo(t)","%Asignado"];
      var lines = (rows||[]).map(function(r){
        var d=num(r.disponible,0), a=num(r.asignado,0), s=d-a, p=d>0?(a/d*100):0;
        var prov = String(r.proveedorNombre||"").replace(/,/g," ");
        return [r.mesKey, prov, d, a, s, p.toFixed(1)];
      });
      return [head.join(",")].concat(lines.map(function(a){return a.join(",");})).join("\n");
    }
    function onClick(){
      var blob = new Blob([toCSV(props.rows||[])], { type:"text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = "balance_mmpp.csv"; a.click();
      URL.revokeObjectURL(url);
    }
    return <button className="mmpp-ghostbtn" onClick={onClick}>⬇️ Exportar CSV</button>;
  }

  /* ====================== Chart simple ====================== */
  function MiniBars(props){
    var data = props.data || [];
    var height = props.height || 190;
    var maxV = 1;
    data.forEach(function(d){
      var m = Math.max(num(d.disponible), num(d.asignado));
      if (m > maxV) maxV = m;
    });
    var barW = 22, gap = 12;
    var groupW = barW*2 + 6;
    var width = Math.max(320, data.length * (groupW + gap) + gap);
    var h = height, padTop = 28, padBottom = 26;

    return (
      <div className="mmpp-chart">
        <svg width={width} height={h + padTop + padBottom}>
          <g transform={"translate(" + gap + ",8)"}>
            <rect x="0"   y="0" width="14" height="14" rx="3" fill={UI.brand1}/><text x="20"  y="12" fontSize="13">Disponible</text>
            <rect x="130" y="0" width="14" height="14" rx="3" fill={UI.brand2}/><text x="150" y="12" fontSize="13">Asignado</text>
          </g>
          {data.map(function(d, i){
            var baseX = gap + i*(groupW + gap);
            var disp = num(d.disponible), asig = num(d.asignado);
            var hD = (disp/maxV)*h, yD = h-hD;
            var hA = (asig/maxV)*h, yA = h-hA;
            var labelY = h + padTop + 14;
            return (
              <g key={i} transform={"translate(" + baseX + "," + padTop + ")"}>
                <rect x="0" y={yD} width={barW} height={hD} rx="5" fill={UI.brand1}><title>{d.label+" · D: "+fmtTons(disp)+" t"}</title></rect>
                <rect x={barW+6} y={yA} width={barW} height={hA} rx="5" fill={UI.brand2}><title>{d.label+" · A: "+fmtTons(asig)+" t"}</title></rect>
                <text x={groupW/2 - 3} y={labelY - padTop} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  /* ====================== App ====================== */
  function BalanceApp(props){
    var y0 = new Date().getFullYear();
    const [anio, setAnio] = useState(props && props.anio ? props.anio : y0);
    const [proveedorSel, setProveedorSel] = useState("Todos");

    // modo de agrupación de la TABLA: 'prov' (una fila por proveedor en el año) o 'mesprov'
    const [tableGroupMode, setTableGroupMode] = useState("prov"); // <- por defecto: NO se repite proveedor

    const [mesFrom, setMesFrom] = useState(1);
    const [mesTo, setMesTo] = useState(12);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(function(){
      var off = false;
      setLoading(true); setError("");
      fetch(API_BASE + "/planificacion/saldos?anio=" + encodeURIComponent(anio))
        .then(function(r){ if(!r.ok) throw new Error("Error " + r.status); return r.json(); })
        .then(function(data){
          if (off) return;
          var items = (data && Array.isArray(data.items)) ? data.items : [];
          setRows(items);
        })
        .catch(function(e){ if (off) return; setError((e && e.message) ? e.message : "Error cargando saldos"); })
        .then(function(){ if (off) return; setLoading(false); });
      return function(){ off = true; };
    }, [anio]);

    /* ---- construir base normalizada: nombre mostrado + key canónica ---- */
    const normRows = useMemo(function(){
      var list = [];
      rows.forEach(function(r){
        var mk = String((r && r.mesKey) || "");
        if (mk.indexOf(String(anio)) !== 0) return;
        var mn = monthIdx(mk);
        if (mn < mesFrom || mn > mesTo) return;

        var prov = providerDisplayAndKey(r); // {display, key}
        if (proveedorSel !== "Todos" && prov.display !== proveedorSel) return;

        var d = num(r && r.disponible), a = num(r && r.asignado);
        list.push({
          mesKey: mk,
          mesNum: mn,
          proveedorDisplay: prov.display,
          proveedorKey: prov.key,
          disponible: d,
          asignado: a
        });
      });
      return list;
    }, [rows, anio, mesFrom, mesTo, proveedorSel]);

    /* ---- opciones de proveedores (sin duplicar, por clave canónica) ---- */
    const proveedores = useMemo(function(){
      var seen = {};
      var mapDisplayByKey = {};
      normRows.forEach(function(r){
        if (!seen[r.proveedorKey]){
          seen[r.proveedorKey] = 1;
          mapDisplayByKey[r.proveedorKey] = r.proveedorDisplay;
        }
      });
      var list = Object.keys(seen).map(function(k){ return mapDisplayByKey[k]; }).sort();
      list.unshift("Todos");
      return list;
    }, [normRows]);

    /* ---- gráfico: agregamos por mes (coincide con rango actual) ---- */
    const chartData = useMemo(function(){
      var map = {};
      normRows.forEach(function(r){
        var key = r.mesNum;
        if (!map[key]) map[key] = { label: (key<10?"0"+key:key), disponible:0, asignado:0 };
        map[key].disponible += r.disponible;
        map[key].asignado   += r.asignado;
      });
      return Object.keys(map).sort(function(a,b){ return parseInt(a,10)-parseInt(b,10); }).map(function(k){ return map[k]; });
    }, [normRows]);

    /* ---- TABLA agregada: por proveedor (año) o por mes+proveedor ---- */
    const tableRows = useMemo(function(){
      var acc = {}; // clave depende del modo
      normRows.forEach(function(r){
        var key = (tableGroupMode==="prov")
          ? ("prov|" + r.proveedorKey)           // una fila por proveedor en el rango/año
          : (r.mesKey + "|" + r.proveedorKey);   // una fila por mes + proveedor

        if (!acc[key]){
          acc[key] = {
            mesKey: r.mesKey, // para 'prov' mostraremos el primer mes del rango o se puede dejar vacío
            proveedorNombre: r.proveedorDisplay,
            disponible: 0,
            asignado: 0
          };
        }
        acc[key].disponible += r.disponible;
        acc[key].asignado   += r.asignado;
      });

      var list = Object.keys(acc).map(function(k){
        var o = acc[k];
        var saldo = o.disponible - o.asignado;
        var pct = o.disponible>0 ? (o.asignado/o.disponible*100) : 0;
        return {
          mesKey: o.mesKey,
          proveedorNombre: o.proveedorNombre,
          disponible: o.disponible,
          asignado: o.asignado,
          saldo: saldo,
          pct: pct
        };
      });

      list.sort(function(a,b){
        // si agrupamos sólo por proveedor, ordenar por nombre; si no, por mes y nombre
        if (tableGroupMode === "prov"){
          return String(a.proveedorNombre||"").localeCompare(String(b.proveedorNombre||""));
        } else {
          var t = String(a.mesKey).localeCompare(String(b.mesKey));
          if (t!==0) return t;
          return String(a.proveedorNombre||"").localeCompare(String(b.proveedorNombre||""));
        }
      });
      return list;
    }, [normRows, tableGroupMode]);

    /* ---- totales ---- */
    const totals = useMemo(function(){
      var d=0,a=0; normRows.forEach(function(r){ d+=r.disponible; a+=r.asignado; });
      var s=d-a, p=d>0?(a/d*100):0; return { d:d, a:a, s:s, p:p };
    }, [normRows]);

    return (
      <div className="mmpp-wrap">
        <div className="mmpp-hero mmpp-stack">
          <div>
            <h1>Balance MMPP</h1>
            <p>Agregado sin duplicados (normaliza nombres; fallback a contacto)</p>
          </div>
          <div className="mmpp-badge"><span>🟣</span>Reporte dinámico</div>
        </div>

        <div className="mmpp-card mmpp-stack">
          <div className="mmpp-grid">
            <div>
              <label className="muted">Año</label>
              <select className="mmpp-input" value={anio}
                onChange={function(e){ var v=parseInt(e.target.value,10); if(isFinite(v)) setAnio(v); }}>
                {Array.from({length:5}).map(function(_,i){
                  var y = new Date().getFullYear()-2+i; return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="muted">Proveedor</label>
              <select className="mmpp-input" value={proveedorSel}
                onChange={function(e){ setProveedorSel(e.target.value); }}>
                {proveedores.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>

            <div>
              <label className="muted">Agrupar tabla por</label>
              <select className="mmpp-input" value={tableGroupMode}
                onChange={function(e){ setTableGroupMode(e.target.value); }}>
                <option value="prov">Proveedor (año/rango)</option>
                <option value="mesprov">Mes + Proveedor</option>
              </select>
            </div>

            <div>
              <label className="muted">Desde mes</label>
              <select className="mmpp-input" value={mesFrom}
                onChange={function(e){ var v=parseInt(e.target.value,10); if(isFinite(v)) setMesFrom(v); }}>
                {Array.from({length:12}).map(function(_,i){ var m=i+1; return <option key={m} value={m}>{m} - {MESES[i]}</option>; })}
              </select>
            </div>

            <div>
              <label className="muted">Hasta mes</label>
              <select className="mmpp-input" value={mesTo}
                onChange={function(e){ var v=parseInt(e.target.value,10); if(isFinite(v)) setMesTo(v); }}>
                {Array.from({length:12}).map(function(_,i){ var m=i+1; return <option key={m} value={m}>{m} - {MESES[i]}</option>; })}
              </select>
            </div>

            <div style={{display:"flex",alignItems:"flex-end",gap:"8px"}}>
              <CSVButton rows={tableRows}/>
            </div>
          </div>

          <div className="mmpp-kpis" style={{ marginTop: 6 }}>
            <div className="mmpp-kpi">Disponible: <strong>{fmtTons(totals.d)} t</strong></div>
            <div className="mmpp-kpi">Asignado: <strong>{fmtTons(totals.a)} t</strong></div>
            <div className="mmpp-kpi">Saldo: <strong>{fmtTons(totals.s)} t</strong></div>
            <div className="mmpp-kpi">% Asignado: <strong>{totals.p.toFixed(1)}%</strong></div>
          </div>

          {error && <div className="mmpp-alert error mmpp-stack">⚠️ {String(error)}</div>}
          {loading && <div className="skeleton mmpp-stack" />}

          {!loading && !error && (
            <div className="mmpp-stack">
              <MiniBars data={chartData} />
              <div className="mmpp-table-wrap" style={{ marginTop: 12 }}>
                <table className="mmpp">
                  <thead>
                    <tr>
                      <th>{tableGroupMode==="prov"?"—": "Mes"}</th>
                      <th>Proveedor</th>
                      <th className="tright">Disponible (t)</th>
                      <th className="tright">Asignado (t)</th>
                      <th className="tright">Saldo (t)</th>
                      <th className="tright">% Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(function(r,idx){
                      return (
                        <tr key={(r.mesKey||"-") + "|" + (r.proveedorNombre||"") + "|" + idx}>
                          <td>{tableGroupMode==="prov" ? "" : monthLabelFromKey(r.mesKey)}</td>
                          <td>{r.proveedorNombre}</td>
                          <td className="tright">{fmtTons(r.disponible)}</td>
                          <td className="tright">{fmtTons(r.asignado)}</td>
                          <td className="tright">{fmtTons(r.saldo)}</td>
                          <td className="tright">{r.pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    {tableRows.length === 0 && (
                      <tr><td colSpan="6" style={{ color:"#6b7280", padding:"20px" }}>Sin datos para el filtro seleccionado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- API + auto-mount ---------- */
  var API = {
    _root: null,
    mount: function(opts){
      var el = document.getElementById("mmppBalance");
      if (!el) { console.warn("No existe #mmppBalance"); return; }
      this._root = ReactDOM.createRoot(el);
      this._root.render(React.createElement(BalanceApp, opts || {}));
    },
    unmount: function(){ if (this._root){ this._root.unmount(); this._root = null; } }
  };
  global.MMppBalance = API;

  (function autoMount(){
    function go(){
      var host = document.getElementById("mmppBalance");
      if (!host) { setTimeout(go, 60); return; }
      if (!API._root && window.ReactDOM) { API.mount({ anio: new Date().getFullYear() }); }
      else { setTimeout(go, 60); }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  })();

})(window);
