/* /spa-mmpp/mmpp-balance.jsx */
/* eslint-disable no-undef */
const { useEffect, useMemo, useState } = React;

(function (global) {
  var UI = { brand1:"#4f46e5", brand2:"#9333ea", border:"#e5e7eb" };
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
    var h = height, pad = 24;

    return (
      <div className="mmpp-chart">
        <svg width={width} height={h+pad*2}>
          {data.map(function(d, i){
            var x0 = gap + i*(groupW+gap);
            var disp = num(d.disponible);
            var asig = num(d.asignado);
            var hDisp = disp/maxV * h;
            var hAsig = asig/maxV * h;
            return (
              <g key={i} transform={"translate(" + x0 + "," + pad + ")"}>
                <rect x="0" y={h-hDisp} width={barW} height={hDisp} rx="5" fill={UI.brand1} />
                <rect x={barW+6} y={h-hAsig} width={barW} height={hAsig} rx="5" fill={UI.brand2} />
                <text x={groupW/2 - 6} y={h+16} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
              </g>
            );
          })}
          <g transform={"translate(" + gap + ",8)"}>
            <rect x="0"   y="0" width="14" height="14" rx="3" fill={UI.brand1}/><text x="20"  y="12" fontSize="13">Disponible</text>
            <rect x="130" y="0" width="14" height="14" rx="3" fill={UI.brand2}/><text x="150" y="12" fontSize="13">Asignado</text>
          </g>
        </svg>
      </div>
    );
  }

  function BalanceApp(props){
    var y0 = new Date().getFullYear();
    var anioDefault = (props && props.anio) ? props.anio : y0;

    const [anio, setAnio] = useState(anioDefault);
    const [proveedor, setProveedor] = useState("Todos");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(function(){
      var off = false;
      setLoading(true); setError("");
      fetch(API_BASE + "/planificacion/saldos?anio=" + encodeURIComponent(anio))
        .then(function(r){
          if(!r.ok) throw new Error("Error " + r.status);
          return r.json();
        })
        .then(function(data){
          if (off) return;
          var items = (data && Array.isArray(data.items)) ? data.items : [];
          setRows(items);
        })
        .catch(function(e){
          if (off) return;
          setError((e && e.message) ? e.message : "Error cargando saldos");
        })
        .then(function(){
          if (off) return;
          setLoading(false);
        });
      return function(){ off = true; };
    }, [anio]);

    const proveedores = useMemo(function(){
      var dict = {};
      rows.forEach(function(r){
        var name = (r && r.proveedorNombre) ? r.proveedorNombre : "";
        if (name) dict[name] = 1;
      });
      var list = Object.keys(dict).sort();
      list.unshift("Todos");
      return list;
    }, [rows]);

    const tableRows = useMemo(function(){
      var arr = [];
      rows.forEach(function(r){
        var mesKey = String((r && r.mesKey) || "");
        if (mesKey.indexOf(String(anio)) !== 0) return;
        if (proveedor !== "Todos" && ((r && r.proveedorNombre) || "") !== proveedor) return;

        var disponible = num(r && r.disponible);
        var asignado   = num(r && r.asignado);
        var saldo      = disponible - asignado;
        var pct        = disponible > 0 ? (asignado / disponible * 100) : 0;

        arr.push({
          mesKey: mesKey,
          proveedorNombre: (r && r.proveedorNombre) || "",
          disponible: disponible,
          asignado: asignado,
          saldo: saldo,
          pct: pct
        });
      });
      arr.sort(function(a,b){
        var t = String(a.mesKey).localeCompare(String(b.mesKey));
        if (t !== 0) return t;
        return String(a.proveedorNombre||"").localeCompare(String(b.proveedorNombre||""));
      });
      return arr;
    }, [rows, anio, proveedor]);

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

    return (
      <div className="mmpp-wrap">
        <div className="mmpp-hero mmpp-stack">
          <div>
            <h1>Balance MMPP</h1>
            <p>Disponible vs Asignado por mes y proveedor</p>
          </div>
          <div className="mmpp-badge"><span>🟣</span>Reporte dinámico</div>
        </div>

        <div className="mmpp-card mmpp-stack">
          <div className="mmpp-grid">
            <div>
              <label className="muted">Año</label>
              <select className="mmpp-input" value={anio}
                      onChange={function(e){ setAnio(num(e.target.value, anio)); }}>
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
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <CSVButton rows={tableRows}/>
            </div>
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
                      <th>Mes</th>
                      <th>Proveedor</th>
                      <th className="tright">Disponible (t)</th>
                      <th className="tright">Asignado (t)</th>
                      <th className="tright">Saldo (t)</th>
                      <th className="tright">% Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(function(r,idx){
                      var warn = r.pct > 100 ? "#fee2e2" : (r.pct > 90 ? "#fffbeb" : "transparent");
                      return (
                        <tr key={r.mesKey + "|" + (r.proveedorNombre||"") + "|" + idx} style={{ background: warn }}>
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

  // API pública y auto-montaje
  var API = {
    _root: null,
    mount: function(opts){
      var el = document.getElementById("mmppBalance");
      if (!el) { console.warn("No existe #mmppBalance"); return; }
      this._root = ReactDOM.createRoot(el);
      this._root.render(React.createElement(BalanceApp, opts || {}));
    },
    unmount: function(){
      if (this._root){ this._root.unmount(); this._root = null; }
    }
  };
  global.MMppBalance = API;

  (function autoMount(){
    function go(){
      var host = document.getElementById("mmppBalance");
      if (!host) { setTimeout(go, 60); return; }
      if (!API._root && window.ReactDOM) {
        API.mount({ anio: new Date().getFullYear() });
      } else {
        setTimeout(go, 60);
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  })();

})(window);
