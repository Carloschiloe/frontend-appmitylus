/* spa-mmpp/mmpp-resumen.js
   Componente reutilizable: ResumenProveedorMes
   - Recibe: dispon (array), asig (array), defaultYear (número u string),
             filterComuna (string), filterEmpresa (string)
   - Muestra: Tabla pivote Proveedor × Mes (saldo) y Gráfico apilado (Top 5)
   - Sin bundler: expone en window.MMPPResumen.ResumenProveedorMes
*/
(function (global) {
  var React = global.React;

  if (!global.MMPPResumen) global.MMPPResumen = {};

  var mesesEs = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var mesesShort = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }

  function ensureChartJS(cb){
    if (global.Chart) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = cb;
    document.head.appendChild(s);
  }

  function GroupBy(arr, keyFn){
    var m={}; (arr||[]).forEach(function(r){ var k=keyFn(r); m[k]=(m[k]||[]).concat([r]); }); return m;
  }

  function ResumenProveedorMes(props){
    var dispon = props.dispon || [];
    var asig = props.asig || [];
    var defaultYear = props.defaultYear;
    var filterComuna = props.filterComuna || "";
    var filterEmpresa = props.filterEmpresa || "";

    var _ry = React.useState(defaultYear || (new Date()).getFullYear());
    var year = _ry[0], setYear = _ry[1];

    var _show = React.useState(false);
    var show = _show[0], setShow = _show[1];

    // Asignaciones por disponibilidadId
    var asigByDispo = React.useMemo(function(){
      var m = {};
      (asig||[]).forEach(function(a){
        var id = a.disponibilidadId || a.disponibilidad || a.dispoId || a.id || null;
        if(!id) return;
        var cant = Number(a.cantidad||0);
        if (cant>0) m[id] = (m[id]||0) + cant;
      });
      return m;
    }, [asig]);

    function saldoDe(r){
      var id = r.id || r._id || r.uuid || r._docId || null;
      var used = id ? (asigByDispo[id] || 0) : 0;
      var tons = (r.tonsDisponible != null ? Number(r.tonsDisponible) : Number(r.tons || 0));
      return Math.max(0, Number(tons||0) - Number(used||0));
    }

    // Pivote proveedor × mes (saldo)
    var resumen = React.useMemo(function(){
      var y = Number(year)||new Date().getFullYear();
      var base = (dispon||[]).filter(function(d){ return Number(d.anio)===y; });

      if(filterComuna) base = base.filter(function(d){ return (d.comuna||"")===filterComuna; });
      if(filterEmpresa) base = base.filter(function(d){ return (d.empresaNombre||"")===filterEmpresa; });

      function zeros(){ var a=[],i; for(i=0;i<12;i++) a.push(0); return a; }
      var map = {};
      base.forEach(function(d){
        var prov = (d.contactoNombre||d.proveedorNombre||"Sin contacto");
        var row = map[prov] || (map[prov] = { proveedor: prov, meses: zeros(), total:0 });
        var m = (Number(d.mes)||0)-1;
        var s = saldoDe(d);
        if(m>=0 && m<12){ row.meses[m]+=s; row.total+=s; }
      });

      var rows = Object.keys(map).map(function(k){ return map[k]; });
      rows.sort(function(a,b){ return b.total - a.total; });
      return { year:y, rows:rows };
    }, [dispon, asig, asigByDispo, year, filterComuna, filterEmpresa]);

    // Gráfico apilado Top 5
    React.useEffect(function(){
      if(!show) return;
      ensureChartJS(function(){
        try{
          var el = document.getElementById("chartResumen");
          if(!el) return;

          if (global.__mmppChart) { try{ global.__mmppChart.destroy(); }catch(e){} }

          var rows = (resumen.rows||[]).slice(0, 5);
          var labels = mesesShort.slice();
          var datasets = rows.map(function(r){
            return {
              label: r.proveedor,
              data: r.meses.map(function(v){ return Math.round(v); }),
              borderWidth: 1
            };
          });

          var ctx = el.getContext("2d");
          global.__mmppChart = new global.Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: {
              responsive: true,
              plugins: { legend: { position: 'top' }, title: { display: false } },
              scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
          });
        }catch(e){ console.error(e); }
      });
    }, [show, resumen]);

    return React.createElement(
      "div",
      { className: "mmpp-card" },
      React.createElement(
        "div",
        { style:{display:"flex",justifyContent:"space-between",alignItems:"center"} },
        React.createElement("h2",{style:{margin:"0 0 14px",fontWeight:800}}, "Resumen por mes (Proveedor × Mes)"),
        React.createElement("div",{style:{display:"flex",gap:10,alignItems:"center"}},
          React.createElement("select",{
            className:"mmpp-input",
            value:String(year),
            onChange:function(e){ setYear(e.target.value); },
            style:{width:160}
          },
            (function(){
              var ys = {}; (dispon||[]).forEach(function(d){ if(d.anio) ys[d.anio]=1; });
              var all = Object.keys(ys).map(Number);
              if (all.indexOf(new Date().getFullYear())<0) all.push(new Date().getFullYear());
              return all.sort().map(function(y){
                return React.createElement("option",{key:y,value:String(y)}, String(y));
              });
            })()
          ),
          React.createElement("button",
            { type:"button", className:"mmpp-ghostbtn", onClick:function(){ setShow(!show); } },
            show ? "Ocultar" : "Mostrar"
          )
        )
      ),
      show && React.createElement(React.Fragment, null,
        React.createElement("div",{style:{overflowX:"auto"}},
          React.createElement("table",{className:"mmpp", style:{minWidth:"900px"}},
            React.createElement("thead",null,
              React.createElement("tr",null,
                React.createElement("th",null,"PROVEEDOR / CONTACTO"),
                mesesShort.map(function(m,i){
                  return React.createElement("th",{key:i, className:"right-align"}, m);
                }),
                React.createElement("th",{className:"right-align"},"TOTAL ", resumen.year)
              )
            ),
            React.createElement("tbody",null,
              (resumen.rows||[]).length
                ? resumen.rows.map(function(r,idx){
                    return React.createElement("tr",{key:idx},
                      React.createElement("td",{style:{fontWeight:700}}, r.proveedor),
                      r.meses.map(function(v,mi){
                        return React.createElement("td",{key:mi,className:"right-align"}, numeroCL(v));
                      }),
                      React.createElement("td",{className:"right-align"},
                        React.createElement("strong",null, numeroCL(r.total))
                      )
                    );
                  })
                : React.createElement("tr",null,
                    React.createElement("td",{colSpan:14,style:{color:"#6b7280"}}, "No hay datos para el año seleccionado.")
                  )
            )
          )
        ),
        React.createElement("div",{style:{marginTop:14}},
          React.createElement("h3",{style:{margin:"8px 0",fontWeight:800}}, "Gráfico apilado (Top 5 proveedores del año)"),
          React.createElement("div",{id:"chartWrap",style:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:12}},
            React.createElement("canvas",{id:"chartResumen",height:"140"})
          )
        )
      )
    );
  }

  global.MMPPResumen.ResumenProveedorMes = ResumenProveedorMes;

})(window);
