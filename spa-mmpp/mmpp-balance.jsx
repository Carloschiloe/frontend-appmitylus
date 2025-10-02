/* /spa-mmpp/mmpp-balance.jsx */
/* eslint-disable no-undef */
const { useEffect, useMemo, useState } = React;

(function (global) {
  var UI = { brand1:"#4f46e5", brand2:"#9333ea", border:"#e5e7eb" };
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

  /* ---------- CSV ---------- */
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

  /* ---------- Chart (SVG) ---------- */
  function MiniBars(props){
    var data = props.data || [];          // [{label, disponible, asignado, pct, saldo}]
    var mode = props.mode || "grouped";   // grouped | stacked (aplica sólo en 'ambos')
    var metric = props.metric || "ambos"; // ambos | pct | saldo
    var showD = props.showD !== false;
    var showA = props.showA !== false;
    var showLabels = !!props.showLabels;

    // escala
    var maxV = 1;
    if (metric === "pct"){
      maxV = 100;
    } else if (metric === "saldo"){
      data.forEach(function(d){ var m = Math.abs(num(d.saldo)); if (m > maxV) maxV = m; });
    } else { // ambos
      data.forEach(function(d){
        if (mode==="stacked"){
          var m = num(d.disponible)+num(d.asignado);
          if (m > maxV) maxV = m;
        } else {
          var m = Math.max(num(d.disponible), num(d.asignado));
          if (m > maxV) maxV = m;
        }
      });
    }

    var height = props.height || 190;
    var barW = 22, gap = 12;
    var groupBars = (metric==="ambos" && mode==="grouped" ? (showD?1:0) + (showA?1:0) : 1);
    var groupW = (metric==="ambos" && mode==="grouped") ? (barW*groupBars + (groupBars>1?6:0)) : barW;
    var width = Math.max(320, data.length * (groupW + gap) + gap);
    var h = height, padTop = 30, padBottom = 28;

    function barLabel(x, y, text){
      return <text className="chart-label" x={x} y={y} textAnchor="middle">{text}</text>;
    }

    return (
      <div className="mmpp-chart">
        <svg width={width} height={h + padTop + padBottom}>
          {/* Leyenda (sólo si 'ambos') */}
          {metric==="ambos" && (
            <g transform={"translate(" + gap + ",10)"}>
              {/* Disponible */}
              <g onClick={props.onToggleD} style={{cursor:"pointer"}}>
                <rect x="0" y="0" width="14" height="14" rx="3" fill={UI.brand1} opacity={showD?1:.35} />
                <text x="20" y="12" fontSize="13" fill="#111827" opacity={showD?1:.5}>Disponible</text>
              </g>
              {/* Asignado */}
              <g transform="translate(130,0)" onClick={props.onToggleA} style={{cursor:"pointer"}}>
                <rect x="0" y="0" width="14" height="14" rx="3" fill={UI.brand2} opacity={showA?1:.35}/>
                <text x="20" y="12" fontSize="13" fill="#111827" opacity={showA?1:.5}>Asignado</text>
              </g>
            </g>
          )}

          {data.map(function(d, i){
            var baseX = gap + i*(groupW + gap);
            var labelY = h + padTop + 16;

            // valores
            var disp = num(d.disponible), asig = num(d.asignado), saldo = num(d.saldo), pct = num(d.pct);
            var gX = baseX;

            if (metric === "pct"){
              var val = clamp(pct, 0, 100);
              var barH = (val / maxV) * h;
              return (
                <g key={i} transform={"translate(" + baseX + "," + padTop + ")"}>
                  <rect x="0" y={h-barH} width={barW} height={barH} rx="5" fill={UI.brand2}>
                    <title>{d.label + " · %Asignado: " + val.toFixed(1) + "%"}</title>
                  </rect>
                  {showLabels && barLabel(barW/2, h-barH-6, val.toFixed(0)+"%")}
                  <text x={barW/2} y={labelY - padTop} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
                </g>
              );
            }

            if (metric === "saldo"){
              var v = Math.abs(saldo);
              var barH2 = (v / maxV) * h;
              var isNeg = (saldo < 0);
              var y0 = isNeg ? (h/2) : (h - barH2);
              var heightDraw = barH2;
              // eje cero en mitad (simple)
              return (
                <g key={i} transform={"translate(" + baseX + "," + padTop + ")"}>
                  {/* eje cero */}
                  <line x1="-4" y1={h/2} x2={barW+4} y2={h/2} stroke="#e5e7eb" />
                  <rect x="0" y={y0} width={barW} height={heightDraw} rx="5" fill={isNeg ? "#ef4444" : "#10b981"}>
                    <title>{d.label + " · Saldo: " + (isNeg? "-":"") + fmtTons(v) + " t"}</title>
                  </rect>
                  {showLabels && barLabel(barW/2, y0-6, (isNeg?"-":"")+fmtTons(v))}
                  <text x={barW/2} y={labelY - padTop} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
                </g>
              );
            }

            // metric === "ambos"
            if (mode === "stacked"){
              var total = disp + asig;
              var hTotal = (total/maxV)*h;
              var hDisp = (disp/maxV)*h;
              var yDisp = h - hDisp;
              var yAsig = h - hTotal;
              return (
                <g key={i} transform={"translate(" + baseX + "," + padTop + ")"}>
                  <rect x="0" y={yDisp} width={barW} height={hDisp} rx="5" fill={UI.brand1} opacity={showD?1:.2}>
                    <title>{d.label + " · Disponible: " + fmtTons(disp) + " t"}</title>
                  </rect>
                  <rect x="0" y={yAsig} width={barW} height={hTotal-hDisp} rx="5" fill={UI.brand2} opacity={showA?1:.2}>
                    <title>{d.label + " · Asignado: " + fmtTons(asig) + " t"}</title>
                  </rect>
                  {showLabels && barLabel(barW/2, yAsig-6, fmtTons(total))}
                  <text x={barW/2} y={labelY - padTop} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
                </g>
              );
            } else {
              // grouped
              var hadD = showD ? 1 : 0, hadA = showA ? 1 : 0;
              var curr = 0;
              var nodes = [];

              if (showD){
                var hD = (disp/maxV)*h, yD = h-hD, xD = gX + (hadA?0: (showA?0:0)); // primer bar
                nodes.push(
                  <g key={"d"+i} transform={"translate(" + gX + "," + padTop + ")"}>
                    <rect x="0" y={yD} width={barW} height={hD} rx="5" fill={UI.brand1}>
                      <title>{d.label + " · Disponible: " + fmtTons(disp) + " t"}</title>
                    </rect>
                    {showLabels && barLabel(barW/2, yD-6, fmtTons(disp))}
                  </g>
                );
                curr++;
              }
              if (showA){
                var xA = gX + (showD? (barW+6) : 0);
                var hA = (asig/maxV)*h, yA = h-hA;
                nodes.push(
                  <g key={"a"+i} transform={"translate(" + xA + "," + padTop + ")"}>
                    <rect x="0" y={yA} width={barW} height={hA} rx="5" fill={UI.brand2}>
                      <title>{d.label + " · Asignado: " + fmtTons(asig) + " t"}</title>
                    </rect>
                    {showLabels && barLabel(barW/2, yA-6, fmtTons(asig))}
                  </g>
                );
              }

              // etiqueta del grupo
              nodes.push(
                <text key={"lbl"+i} x={gX + (showD && showA ? (barW+6)/2 : barW/2)} y={labelY} textAnchor="middle" fontSize="11" fill="#6b7280">{d.label}</text>
              );
              return <g key={i}>{nodes}</g>;
            }
          })}
        </svg>
      </div>
    );
  }

  /* ---------- App ---------- */
  function BalanceApp(props){
    var y0 = new Date().getFullYear();
    const [anio, setAnio] = useState(props && props.anio ? props.anio : y0);
    const [proveedor, setProveedor] = useState("Todos");

    // controles gráfico
    const [groupBy, setGroupBy] = useState("mes");       // mes | proveedor
    const [metric, setMetric] = useState("ambos");       // ambos | pct | saldo
    const [mode, setMode] = useState("grouped");         // grouped | stacked (sólo ambos)
    const [mesFrom, setMesFrom] = useState(1);
    const [mesTo, setMesTo] = useState(12);
    const [showLabels, setShowLabels] = useState(true);
    const [showD, setShowD] = useState(true);
    const [showA, setShowA] = useState(true);

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

    // filtros base
    const proveedores = useMemo(function(){
      var dict = {}; rows.forEach(function(r){ var n=(r&&r.proveedorNombre)||""; if(n) dict[n]=1; });
      var list = Object.keys(dict).sort(); list.unshift("Todos"); return list;
    }, [rows]);

    const baseRows = useMemo(function(){
      var arr = [];
      rows.forEach(function(r){
        var mk = String((r && r.mesKey) || "");
        if (mk.indexOf(String(anio)) !== 0) return;
        if (proveedor !== "Todos" && ((r && r.proveedorNombre) || "") !== proveedor) return;

        var disp = num(r && r.disponible), asig = num(r && r.asignado);
        arr.push({
          mesKey: mk,
          mesNum: monthIdx(mk),
          proveedorNombre: (r && r.proveedorNombre) || "",
          disponible: disp, asignado: asig, saldo: disp - asig, pct: disp>0?(asig/disp*100):0
        });
      });
      // rango meses aplicado acá (también útil para agrupar por proveedor)
      return arr.filter(function(x){ return x.mesNum >= mesFrom && x.mesNum <= mesTo; });
    }, [rows, anio, proveedor, mesFrom, mesTo]);

    // dataset para el chart
    const chartData = useMemo(function(){
      var map = {};
      if (groupBy === "mes"){
        // sumas por mes (label = '01','Feb', etc.)
        baseRows.forEach(function(r){
          var key = r.mesNum; // 1..12
          if (!map[key]) map[key] = { label: (key<10?"0"+key:key), disponible:0, asignado:0, saldo:0, pct:0, _d:0,_a:0 };
          map[key].disponible += r.disponible;
          map[key].asignado   += r.asignado;
          map[key].saldo      += r.saldo;
          map[key]._d += r.disponible; map[key]._a += r.asignado;
        });
        Object.keys(map).forEach(function(k){
          var o = map[k]; o.pct = o._d>0 ? (o._a/o._d*100) : 0;
        });
        return Object.keys(map).sort(function(a,b){ return parseInt(a,10)-parseInt(b,10); }).map(function(k){ return map[k]; });
      } else {
        // sumas por proveedor en el rango
        baseRows.forEach(function(r){
          var key = r.proveedorNombre || "—";
          if (!map[key]) map[key] = { label: key, disponible:0, asignado:0, saldo:0, pct:0, _d:0,_a:0 };
          map[key].disponible += r.disponible;
          map[key].asignado   += r.asignado;
          map[key].saldo      += r.saldo;
          map[key]._d += r.disponible; map[key]._a += r.asignado;
        });
        Object.keys(map).forEach(function(k){
          var o = map[k]; o.pct = o._d>0 ? (o._a/o._d*100) : 0;
        });
        return Object.keys(map).sort(function(a,b){ return a.localeCompare(b); }).map(function(k){ return map[k]; });
      }
    }, [baseRows, groupBy]);

    // totales (para KPIs)
    const totals = useMemo(function(){
      var d=0,a=0; baseRows.forEach(function(r){ d+=r.disponible; a+=r.asignado; });
      var s=d-a, p=d>0?(a/d*100):0; return { d:d, a:a, s:s, p:p };
    }, [baseRows]);

    // tabla (la dejamos simple: por mes y proveedor originales)
    const tableRows = useMemo(function(){
      var list = rows.filter(function(r){
        var mk = String((r && r.mesKey) || "");
        if (mk.indexOf(String(anio)) !== 0) return false;
        var mn = monthIdx(mk);
        if (mn < mesFrom || mn > mesTo) return false;
        if (proveedor !== "Todos" && ((r && r.proveedorNombre) || "") !== proveedor) return false;
        return true;
      }).map(function(r){
        var d=num(r && r.disponible), a=num(r && r.asignado);
        return {
          mesKey: String(r.mesKey),
          proveedorNombre: (r && r.proveedorNombre)||"",
          disponible:d, asignado:a, saldo:d-a, pct: d>0?(a/d*100):0
        };
      });
      list.sort(function(a,b){
        var t = String(a.mesKey).localeCompare(String(b.mesKey));
        if (t!==0) return t;
        return String(a.proveedorNombre||"").localeCompare(String(b.proveedorNombre||""));
      });
      return list;
    }, [rows, anio, proveedor, mesFrom, mesTo]);

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

        {/* Controles */}
        <div className="mmpp-card mmpp-stack">
          <div className="mmpp-grid mmpp-controls">
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
              <select className="mmpp-input" value={proveedor}
                onChange={function(e){ setProveedor(e.target.value); }}>
                {["Todos"].concat((function(){
                  var dict={}; rows.forEach(function(r){ var n=(r&&r.proveedorNombre)||""; if(n) dict[n]=1; });
                  return Object.keys(dict).sort();
                })()).map(function(p){ return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>

            <div>
              <label className="muted">Agrupar por</label>
              <select className="mmpp-input" value={groupBy}
                onChange={function(e){ setGroupBy(e.target.value); }}>
                <option value="mes">Mes (rango abajo)</option>
                <option value="proveedor">Proveedor (en rango)</option>
              </select>
            </div>

            <div>
              <label className="muted">Métrica</label>
              <select className="mmpp-input" value={metric}
                onChange={function(e){ setMetric(e.target.value); }}>
                <option value="ambos">Disponible vs Asignado</option>
                <option value="pct">% Asignado</option>
                <option value="saldo">Saldo (D − A)</option>
              </select>
            </div>

            <div>
              <label className="muted">Modo barras</label>
              <select className="mmpp-input" value={mode} disabled={metric!=="ambos"}
                onChange={function(e){ setMode(e.target.value); }}>
                <option value="grouped">Agrupadas</option>
                <option value="stacked">Apiladas</option>
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
              <label className="muted" style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <input type="checkbox" checked={showLabels}
                  onChange={function(e){ setShowLabels(e.target.checked); }} />
                Mostrar etiquetas
              </label>
              <CSVButton rows={tableRows}/>
            </div>
          </div>

          {/* KPIs */}
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
              {/* Leyenda clickeable (sólo para 'ambos') */}
              {metric==="ambos" && (
                <div className="mmpp-legend">
                  <div className={"item"+(showD?"":" off")} onClick={function(){ setShowD(!showD); }}>
                    <span className="swatch" style={{background:UI.brand1}}></span> Disponible
                  </div>
                  <div className={"item"+(showA?"":" off")} onClick={function(){ setShowA(!showA); }}>
                    <span className="swatch" style={{background:UI.brand2}}></span> Asignado
                  </div>
                </div>
              )}

              {/* Gráfico */}
              <MiniBars
                data={chartData}
                metric={metric}
                mode={mode}
                showLabels={showLabels}
                showD={showD}
                showA={showA}
                onToggleD={function(){ setShowD(!showD); }}
                onToggleA={function(){ setShowA(!showA); }}
              />

              {/* Tabla resumida (original) */}
              <div className="mmpp-table-wrap" style={{ marginTop: 12 }}>
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
                      return (
                        <tr key={r.mesKey + "|" + (r.proveedorNombre||"") + "|" + idx}>
                          <td>{monthLabelFromKey(r.mesKey)}</td>
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
