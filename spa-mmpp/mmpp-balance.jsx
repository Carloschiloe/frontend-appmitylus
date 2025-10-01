/* /spa-mmpp/mmpp-balance.jsx */
/* eslint-disable no-undef */
const { useEffect, useMemo, useState } = React;

(function (global) {
  var UI = { brand1:"#4f46e5", brand2:"#9333ea" };
  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var API_BASE = (typeof window!=="undefined" && window.API_URL) ? window.API_URL : "/api";

  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function fmtTons(v){ return num(v,0).toLocaleString("es-CL", { maximumFractionDigits: 1 }); }
  function monthLabel(mesKey){
    if(!mesKey) return "—";
    var parts = String(mesKey).split("-");
    var y = parseInt(parts[0],10);
    var m = Math.min(Math.max(parseInt(parts[1]||"1",10),1),12);
    return (MESES[m-1] || "—") + " " + (isFinite(y) ? y : "");
  }

  /* ---------- CSV ---------- */
  function CSVButton(props){
    function toCSV(rows){
      var head = ["Mes","Proveedor","Disponible(t)","Asignado(t)","Saldo(t)","%Asignado"];
      var lines = (rows||[]).map(function(r){
        var disponible = num(r.disponible,0);
        var asignado   = num(r.asignado,0);
        var saldo      = disponible - asignado;
        var pct        = disponible>0 ? (asignado/disponible*100) : 0;
        var prov       = String(r.proveedorNombre||"").replace(/,/g," ");
        return [r.mesKey, prov, disponible, asignado, saldo, pct.toFixed(1)];
      });
      return [head.join(",")].concat(lines.map(function(a){return a.join(",");})).join("\n");
    }
    function onClick(){
      var blob = new Blob([toCSV(props.rows||[])], { type:"text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "balance_mmpp.csv"; a.click();
      URL.revokeObjectURL(url);
    }
    return <button className="mmpp-ghostbtn" onClick={onClick}>⬇️ Exportar CSV</button>;
  }

  /* ---------- Chart ---------- */
  function MiniBars(props){
    var data = props.data || [];
    var height = props.height || 180;
    var maxV = 1;
    data.forEach(function(d){
      var m = Math.max(num(d.disponible), num(d.asignado));
      if (m > maxV) maxV = m;
    });
    var barW = 22, gap = 12;
    var groupW = barW*2 + gap;
    var width = Math.max(260, data.length*(groupW+gap) + gap);
    var h = height, pad = 28;

    return (
      <div className="mmpp-chart">
        <svg width={width} height={h+pad*2}>
          {/* Leyenda */}
          <g transform={"translate(" + gap + ",8)"}>
            <rect x="0"   y="0" width="14" height="14" rx="3" fill={UI.brand1}/><text x="20"  y="12" fontSize="13">Disponible</text>
            <rect x="130" y="0" width="14" height="14" rx="3" fill={UI.brand2}/><text x="150" y="12" fontSize="13">Asignado</text>
          </g>
          {data.map(function(d, i){
            var x0 = gap + i*(groupW+gap);
            var disp = num(d.disponible);
            var asig = num(d.asignado);
            var hDisp = disp/maxV * h;
            var hAsig = asig/maxV * h;
            return (
              <g key={i} transform={"translate(" + x0 + "," + pad + ")"}>
                <rect x="0" y={h-hDisp} width={barW} height={hDisp} rx="5" fill={UI.brand1}>
                  <title>{d.label + " · Disponible: " + fmtTons(disp) + " t"}</title>
                </rect>
                <rect x={barW+6} y={h-hAsig} width={barW} height={hAsig} rx="5" fill={UI.brand2}>
                  <title>{d.label + " · Asignado: " + fmtTons(asig) + " t"}</title>
                </rect>
                <text x={groupW/2 - 6} y={h+16} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  /* ---------- App ---------- */
  function BalanceApp(props){
    var y0 = new Date().getFullYear();

    // 1) estado inicial desde query o storage
    var qs = (typeof location!=="undefined") ? new URLSearchParams(location.search||"") : null;
    var anioQS = qs ? parseInt(qs.get("anio"),10) : NaN;
    var provQS = qs ? qs.get("prov") : null;

    var anioStored = (typeof localStorage!=="undefined") ? parseInt(localStorage.getItem("mmpp.balance.anio")||"",10) : NaN;
    var provStored = (typeof localStorage!=="undefined") ? localStorage.getItem("mmpp.balance.prov") : null;

    const [anio, setAnio] = useState(isFinite(anioQS)?anioQS:(isFinite(anioStored)?anioStored:(props && props.anio ? props.anio : y0)));
    const [proveedor, setProveedor] = useState(provQS || (provStored || "Todos"));
    const [umbral, setUmbral] = useState(90);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sortBy, setSortBy] = useState("mes");  // mes | proveedor | disponible | asignado | saldo | pct
    const [sortDir, setSortDir] = useState(1);    // 1 asc, -1 desc

    // 2) persistencia y URL compartible
    useEffect(function(){
      if (typeof localStorage!=="undefined"){
        try{
          localStorage.setItem("mmpp.balance.anio", String(anio));
          localStorage.setItem("mmpp.balance.prov", String(proveedor));
        }catch(_){}
      }
      if (typeof history!=="undefined" && typeof location!=="undefined"){
        var p = new URLSearchParams();
        p.set("anio", String(anio));
        if (proveedor && proveedor!=="Todos") p.set("prov", proveedor);
        history.replaceState(null, "", location.pathname + "?" + p.toString());
      }
    }, [anio, proveedor]);

    // 3) fetch
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
        .catch(function(e){
          if (off) return;
          setError((e && e.message) ? e.message : "Error cargando saldos");
        })
        .then(function(){ if (off) return; setLoading(false); });
      return function(){ off = true; };
    }, [anio]);

    // 4) opciones proveedores
    const proveedores = useMemo(function(){
      var dict = {}; rows.forEach(function(r){ var n=(r&&r.proveedorNombre)||""; if(n) dict[n]=1; });
      var list = Object.keys(dict).sort(); list.unshift("Todos"); return list;
    }, [rows]);

    // 5) filas visibles + ordenamiento
    const tableRows = useMemo(function(){
      var arr = [];
      rows.forEach(function(r){
        var mesKey = String((r && r.mesKey) || "");
        if (mesKey.indexOf(String(anio)) !== 0) return;
        if (proveedor !== "Todos" && ((r && r.proveedorNombre) || "") !== proveedor) return;

        var disp = num(r && r.disponible);
        var asig = num(r && r.asignado);
        var saldo = disp - asig;
        var pct = disp > 0 ? (asig / disp * 100) : 0;

        arr.push({
          mesKey: mesKey,
          proveedorNombre: (r && r.proveedorNombre) || "",
          disponible: disp, asignado: asig, saldo: saldo, pct: pct
        });
      });

      arr.sort(function(a,b){
        function cmp(x,y){ return (x<y?-1:(x>y?1:0)) * sortDir; }
        if (sortBy === "mes")         return cmp(String(a.mesKey), String(b.mesKey));
        if (sortBy === "proveedor")   return cmp(String(a.proveedorNombre||""), String(b.proveedorNombre||""));
        if (sortBy === "disponible")  return cmp(a.disponible, b.disponible);
        if (sortBy === "asignado")    return cmp(a.asignado, b.asignado);
        if (sortBy === "saldo")       return cmp(a.saldo, b.saldo);
        if (sortBy === "pct")         return cmp(a.pct, b.pct);
        return 0;
      });
      return arr;
    }, [rows, anio, proveedor, sortBy, sortDir]);

    // 6) totales + chart
    const totals = useMemo(function(){
      var d=0,a=0; tableRows.forEach(function(r){ d+=r.disponible; a+=r.asignado; });
      var s = d-a; var p = d>0 ? (a/d*100) : 0; return { d:d, a:a, s:s, p:p };
    }, [tableRows]);

    const chartData = useMemo(function(){
      var byMonth = {};
      tableRows.forEach(function(r){
        var m = String(r.mesKey);
        if (!byMonth[m]) byMonth[m] = { label: m.slice(5), disponible:0, asignado:0 };
        byMonth[m].disponible += r.disponible;
        byMonth[m].asignado   += r.asignado;
      });
      return Object.keys(byMonth).sort().map(function(k){ return byMonth[k]; });
    }, [tableRows]);

    function clickSort(col){
      if (sortBy === col){ setSortDir(sortDir * -1); }
      else { setSortBy(col); setSortDir(1); }
    }
    function Arrow(col){
      var m = "";
      if (sortBy === col) m = (sortDir===1?"▲":"▼");
      return <span className="arrow">{m}</span>;
    }

    return (
      <div className="mmpp-wrap">
        {/* Hero */}
        <div className="mmpp-hero mmpp-stack">
          <div>
            <h1>Balance MMPP</h1>
            <p>Disponible vs Asignado por mes y proveedor</p>
          </div>
          <div className="mmpp-badge"><span>🟣</span>Reporte dinámico</div>
        </div>

        {/* Filtros + KPIs */}
        <div className="mmpp-card mmpp-stack">
          <div className="mmpp-grid">
            <div>
              <label className="muted">Año</label>
              <select className="mmpp-input" value={anio}
                onChange={function(e){ var v=parseInt(e.target.value,10); if(isFinite(v)) setAnio(v); }}>
                {Array.from({length:5}).map(function(_,i){
                  var y = new Date().getFullYear()-2+i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="muted">Proveedor</label>
              <select className="mmpp-input" value={proveedor}
                onChange={function(e){ setProveedor(e.target.value); }}>
                {proveedores.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>
            <div>
              <label className="muted">Umbral % asignado</label>
              <select className="mmpp-input" value={umbral}
                onChange={function(e){ var v=parseInt(e.target.value,10); if(isFinite(v)) setUmbral(v); }}>
                {[80,85,90,95,100].map(function(v){ return <option key={v} value={v}>{v}%</option>; })}
              </select>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <CSVButton rows={tableRows}/>
            </div>
          </div>

          {/* KPIs */}
          <div className="mmpp-kpis" style={{ marginTop: 10 }}>
            <div className="mmpp-kpi">Disponible: <strong> {fmtTons(totals.d)} t</strong></div>
            <div className="mmpp-kpi">Asignado: <strong> {fmtTons(totals.a)} t</strong></div>
            <div className="mmpp-kpi">Saldo: <strong> {fmtTons(totals.s)} t</strong></div>
            <div className="mmpp-kpi">% Asignado: <strong>{totals.p.toFixed(1)}%</strong></div>
          </div>

          {error && <div className="mmpp-alert error mmpp-stack">⚠️ {String(error)}</div>}
          {loading && <div className="skeleton mmpp-stack" />}

          {!loading && !error && (
            <div>
              <MiniBars data={chartData} />

              <div className="mmpp-table-wrap">
                <table className="mmpp">
                  <thead>
                    <tr>
                      <th className="sort" onClick={function(){clickSort("mes");}}>Mes <Arrow col="mes"/></th>
                      <th className="sort" onClick={function(){clickSort("proveedor");}}>Proveedor <Arrow col="proveedor"/></th>
                      <th className="tright sort" onClick={function(){clickSort("disponible");}}>Disponible (t) <Arrow col="disponible"/></th>
                      <th className="tright sort" onClick={function(){clickSort("asignado");}}>Asignado (t) <Arrow col="asignado"/></th>
                      <th className="tright sort" onClick={function(){clickSort("saldo");}}>Saldo (t) <Arrow col="saldo"/></th>
                      <th className="tright sort" onClick={function(){clickSort("pct");}}>% Asignado <Arrow col="pct"/></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(function(r,idx){
                      var cls = "";
                      if (r.pct > umbral) cls = "row-over";
                      else if (r.pct > (umbral-10)) cls = "row-warn";
                      return (
                        <tr key={r.mesKey + "|" + (r.proveedorNombre||"") + "|" + idx} className={cls}>
                          <td>{monthLabel(r.mesKey)}</td>
                          <td>{r.proveedorNombre || "—"}</td>
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

  /* ---------- API + Auto-mount ---------- */
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
