/* /spa-mmpp/mmpp-balance.jsx */
/* eslint-disable no-undef */
const { useEffect, useMemo, useState } = React;

(function (global) {
  var UI = { textSoft:"#6b7280" };
  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  // Usar proxy de Vercel: /api -> backend (no fuerces dominios)
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
      return [head.join(","),].concat(lines.map(function(a){return a.join(",");})).join("\n");
    }
    function onClick(){
      var blob = new Blob([toCSV(props.rows||[])], { type:"text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "balance_mmpp.csv"; a.click();
      URL.revokeObjectURL(url);
    }
    return <button className="btn" onClick={onClick}>⬇️ Exportar CSV</button>;
  }

  function MiniBars(props){
    var data = props.data || [];
    var height = props.height || 180;
    var maxV = 1;
    data.forEach(function(d){
      var m = Math.max(num(d.disponible), num(d.asignado));
      if (m > maxV) maxV = m;
    });
    var barW = 24, gap = 12;
    var groupW = barW*2 + gap;
    var width = Math.max(gap*2, data.length*(groupW+gap) + gap);
    var h = height, pad = 20;

    return (
      <svg width="100%" viewBox={"0 0 " + width + " " + (h+pad*2)} preserveAspectRatio="xMidYMid meet">
        {data.map(function(d, i){
          var x0 = gap + i*(groupW+gap);
          var disp = num(d.disponible);
          var asig = num(d.asignado);
          var hDisp = disp/maxV * h;
          var hAsig = asig/maxV * h;
          return (
            <g key={i} transform={"translate(" + x0 + "," + pad + ")"}>
              <rect x="0" y={h-hDisp} width={barW} height={hDisp} rx="5" />
              <rect x={barW+6} y={h-hAsig} width={barW} height={hAsig} rx="5" />
              <text x={groupW/2 - 6} y={h+14} textAnchor="middle" fontSize="10" fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
        <g transform={"translate(" + gap + "," + (pad/2) + ")"}>
          <rect x="0" y="0" width="10" height="10" rx="2"/><text x="16" y="9" fontSize="11">Disponible</text>
          <rect x="110" y="0" width="10" height="10" rx="2"/><text x="126" y="9" fontSize="11">Asignado</text>
        </g>
      </svg>
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
        .then(function(){ // siempre
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
      <div className="card pad">
        <div className="header">📊 <div>Balance MMPP — Disponible vs Asignado</div></div>

        <div className="toolbar">
          <div className="row">
            <div className="col">
              <label className="muted">Año</label>
              <select value={anio} onChange={function(e){ setAnio(num(e.target.value, anio)); }}>
                {Array.from({length:5}).map(function(_,i){
                  var y = new Date().getFullYear()-2+i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <div className="col">
              <label className="muted">Proveedor</label>
              <select value={proveedor} onChange={function(e){ setProveedor(e.target.value); }}>
                {proveedores.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>
            <div className="col" style={{ alignSelf:"flex-end" }}>
              <CSVButton rows={tableRows}/>
            </div>
          </div>
        </div>

        {error && <div className="alert error">⚠️ {String(error)}</div>}
        {loading && <div className="skeleton" style={{ height: 140, marginTop: 8 }} />}

        {!loading && !error && (
          <>
            <MiniBars data={chartData} />
            <div style={{ overflowX:"auto", marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Proveedor</th>
                    <th style={{ textAlign:"right" }}>Disponible (t)</th>
                    <th style={{ textAlign:"right" }}>Asignado (t)</th>
                    <th style={{ textAlign:"right" }}>Saldo (t)</th>
                    <th style={{ textAlign:"right" }}>% Asignado</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(function(r,idx){
                    var warn = r.pct > 100 ? "#fee2e2" : (r.pct > 90 ? "#fffbeb" : "transparent");
                    return (
                      <tr key={r.mesKey + "|" + (r.proveedorNombre||"") + "|" + idx} style={{ background: warn }}>
                        <td>{monthLabel(r.mesKey)}</td>
                        <td>{r.proveedorNombre || "—"}</td>
                        <td style={{ textAlign:"right" }}>{fmtTons(r.disponible)}</td>
                        <td style={{ textAlign:"right" }}>{fmtTons(r.asignado)}</td>
                        <td style={{ textAlign:"right" }}>{fmtTons(r.saldo)}</td>
                        <td style={{ textAlign:"right" }}>{r.pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr><td colSpan="6" style={{ color:UI.textSoft, padding:"20px" }}>Sin datos para el filtro seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // API pública (igual al resto de tus páginas)
  var API = {
    _root: null,
    mount: function(opts){
      var el = document.getElementById("mmppBalance");
      if (!el) { console.warn("No existe #mmppBalance"); return; }
      this._root = ReactDOM.createRoot(el);
      this._root.render(<BalanceApp {...(opts||{})} />);
    },
    unmount: function(){
      if (this._root){ this._root.unmount(); this._root = null; }
    }
  };

  global.MMppBalance = API;
})(window);
