// NerdUI v3.3 — Pivot Año/Mes/Proveedor (compatible Babel 6)
const { useEffect, useMemo, useState } = React;

/* ------------------------------ ESTILOS ------------------------------ */
function cssInject(){
  var css = ''
  + 'body{margin:0;background:#f6f8ff}'
  + '.mmpp-wrap{max-width:1200px;margin:0 auto;padding:20px}'
  + '.mmpp-hero{background:linear-gradient(180deg,#f3f6ff,transparent);border:1px solid #e5e7eb;border-radius:20px;padding:28px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
  + '.mmpp-hero h1{margin:0;font-weight:800;color:#2b3440}'
  + '.mmpp-badge{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 16px;border-radius:14px;font-weight:700;display:inline-flex;align-items:center;gap:10px}'
  + '.mmpp-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
  + '.mmpp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}'
  + '.mmpp-input{height:48px;border:1px solid #e5e7eb;border-radius:14px;padding:0 14px;background:#fafafa;width:100%}'
  + '.mmpp-ghostbtn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer}'
  + '.mmpp-danger{background:#fee2e2;border:1px solid #fecaca;color:#b91c1c}'
  + 'table.mmpp{width:100%;border-collapse:separate;border-spacing:0 8px}'
  + 'table.mmpp th,table.mmpp td{padding:12px 10px}'
  + 'table.mmpp tr{background:#fff;border:1px solid #e5e7eb}'
  + '.hist-toggle{cursor:pointer;user-select:none;font-weight:800}'
  + '.hist-sub{background:#f9fafb;border:1px dashed #e5e7eb}'
  + '.mmpp-actions{display:flex;gap:10px;align-items:center}'
  + '.modalBG{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:999}'
  + '.modal{width:min(860px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.2);padding:20px}'
  ;
  var s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

/* ------------------------------ HELPERS ------------------------------ */
function numeroCL(n){ return (Number(n)||0).toLocaleString('es-CL'); }
var mesesEs = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function uniqSorted(arr){
  var set={}, out=[];
  for (var i=0;i<(arr||[]).length;i++){
    var v = arr[i];
    if (v!=null && v!=='' && !set[v]){ set[v]=1; out.push(v); }
  }
  out.sort();
  return out;
}

/* ------------------------------ DATA ------------------------------ */
function useAsignaciones(){
  var _a = React.useState([]), asig=_a[0], setAsig=_a[1];
  var _b = React.useState(false), loading=_b[0], setLoading=_b[1];

  function load(){
    setLoading(true);
    var p = (typeof MMppApi!=='undefined' && MMppApi && MMppApi.getAsignaciones)
              ? MMppApi.getAsignaciones()
              : Promise.resolve([]);
    return p.then(function(res){ setAsig(res||[]); })
            .finally(function(){ setLoading(false); });
  }

  React.useEffect(function(){ cssInject(); }, []);
  React.useEffect(function(){ load(); }, []);
  return { asig:asig, loading:loading, reload:load };
}

/* ------------------------------ APP ------------------------------ */
function InventarioHistorial(){
  var data = useAsignaciones();
  var asig = data.asig, reload = data.reload;

  // Filtros (según tu UI actual)
  var _p=React.useState(''), fProv=_p[0], setFProv=_p[1];
  var _m=React.useState(''), fMes=_m[0], setFMes=_m[1];
  var _y=React.useState(''), fAnio=_y[0], setFAnio=_y[1];

  // Estado de colapsado (tres niveles)
  var _open=React.useState({}), openMap=_open[0], setOpenMap=_open[1];
  function toggle(key){
    setOpenMap(function(prev){
      var nx = {};
      for (var k in prev) nx[k] = prev[k];
      nx[key] = !nx[key];
      return nx;
    });
  }
  function expandAllYear(y, val){
    // Expande/colapsa año y todos sus hijos (meses y proveedores)
    setOpenMap(function(prev){
      var nx = {};
      for (var k in prev) nx[k] = prev[k];
      nx[String(y)] = val;
      for (var m=1;m<=12;m++){
        nx[String(y)+'|'+String(m)] = val;
      }
      // No forzamos proveedores; se abren al click del mes/proveedor
      return nx;
    });
  }

  // Opciones de filtros
  var provOptions = useMemo(function(){
    return uniqSorted((asig||[]).map(function(a){return a.proveedorNombre;}).filter(Boolean));
  }, [asig]);
  var yearOptions = useMemo(function(){
    return uniqSorted((asig||[]).map(function(a){return a.destAnio;}).filter(Boolean));
  }, [asig]);

  // Aplicar filtros básicos
  var asigFiltradas = useMemo(function(){
    return (asig||[])
      .filter(function(a){ return Number(a.cantidad)>0; })
      .filter(function(a){
        return (!fProv || a.proveedorNombre===fProv) &&
               (!fMes  || String(a.destMes)===String(fMes)) &&
               (!fAnio || String(a.destAnio)===String(fAnio));
      });
  }, [asig, fProv, fMes, fAnio]);

  // Pivot: Año → Mes → Proveedor
  var pivot = useMemo(function(){
    // Estructura:
    // years = [{anio, total, months:[{mes, total, provs:[{prov, total, count, lastDate, items:[] }]}]}]
    var byYear = {};
    for (var i=0;i<asigFiltradas.length;i++){
      var a = asigFiltradas[i];
      var y = Number(a.destAnio)||0;
      var m = Number(a.destMes)||0;
      var p = a.proveedorNombre||'—';
      if (!byYear[y]) byYear[y] = {};
      if (!byYear[y][m]) byYear[y][m] = {};
      if (!byYear[y][m][p]) byYear[y][m][p] = { total:0, count:0, lastDate:null, items:[] };

      byYear[y][m][p].total += Number(a.cantidad)||0;
      byYear[y][m][p].count += 1;
      byYear[y][m][p].items.push(a);
      if (a.createdAt){
        var d = new Date(a.createdAt);
        var ld = byYear[y][m][p].lastDate ? new Date(byYear[y][m][p].lastDate) : null;
        if (!ld || d>ld) byYear[y][m][p].lastDate = a.createdAt;
      }
    }

    var years = [];
    var yearsKeys = Object.keys(byYear).map(function(k){return Number(k);});
    yearsKeys.sort(function(a,b){return a-b;});
    for (var yi=0; yi<yearsKeys.length; yi++){
      var Y = yearsKeys[yi];
      var monthsMap = byYear[Y];
      var monthsKeys = Object.keys(monthsMap).map(function(k){return Number(k);});
      monthsKeys.sort(function(a,b){return a-b;});

      var months = [];
      var yearTotal = 0;

      for (var mi=0; mi<monthsKeys.length; mi++){
        var M = monthsKeys[mi];
        var provsMap = monthsMap[M];
        var provKeys = Object.keys(provsMap).sort(function(a,b){ return String(a).localeCompare(String(b)); });

        var provs = [];
        var monthTotal = 0;

        for (var pi=0; pi<provKeys.length; pi++){
          var P = provKeys[pi];
          var info = provsMap[P];
          monthTotal += info.total;

          provs.push({
            key: String(Y)+'|'+String(M)+'|'+String(P),
            proveedor: P,
            total: info.total,
            count: info.count,
            lastDate: info.lastDate,
            items: info.items
          });
        }

        yearTotal += monthTotal;
        months.push({
          key: String(Y)+'|'+String(M),
          mes: M,
          total: monthTotal,
          provs: provs
        });
      }

      years.push({
        key: String(Y),
        anio: Y,
        total: yearTotal,
        months: months
      });
    }
    return years;
  }, [asigFiltradas]);

  // Modales de edición
  var _editA=React.useState(null), editAsig=_editA[0], setEditAsig=_editA[1];
  function onEditAsign(a){
    setEditAsig({
      id: a.id,
      cantidad: String(a.cantidad||''),
      destMes: String(a.destMes||''),
      destAnio: String(a.destAnio||''),
      proveedorNombre: a.proveedorNombre,
      originalFecha: a.originalFecha
    });
  }
  function guardarEditAsig(){
    var p = {
      cantidad: Number(editAsig.cantidad)||0,
      destMes: Number(editAsig.destMes)||null,
      destAnio: Number(editAsig.destAnio)||null
    };
    MMppApi.editarAsignacion(editAsig.id, p)
      .then(function(){ return reload(); })
      .finally(function(){ setEditAsig(null); });
  }
  function borrarAsig(a){
    if (!confirm('¿Eliminar asignación?')) return;
    MMppApi.borrarAsignacion(a.id).then(function(){ return reload(); });
  }

  function limpiarFiltros(){ setFProv(''); setFMes(''); setFAnio(''); }

  /* ------------------------------ UI ------------------------------ */
  return React.createElement('div', {className:'mmpp-wrap'},
    React.createElement('div', {className:'mmpp-hero'},
      React.createElement('div', null, React.createElement('h1', {style:{margin:0,fontWeight:800}}, 'Abastecimiento MMPP')),
      React.createElement('div', {className:'mmpp-badge'}, '▦ Historial de Asignaciones')
    ),

    React.createElement('div', {style:{height:18}}),

    React.createElement('div', {className:'mmpp-card'},
      React.createElement('h2', {style:{margin:'0 0 14px',fontWeight:800}}, 'Historial agrupado (Año ▸ Mes ▸ Proveedor)'),

      // Filtros
      React.createElement('div', {className:'mmpp-grid', style:{marginBottom:12}},
        React.createElement('div', null,
          React.createElement('select', {className:'mmpp-input', value:fProv, onChange:function(e){setFProv(e.target.value);}},
            React.createElement('option', {value:''}, 'Todos los Contactos'),
            provOptions.map(function(p){ return React.createElement('option', {key:p, value:p}, p); })
          )
        ),
        React.createElement('div', {style:{display:'flex',gap:10}},
          React.createElement('select', {className:'mmpp-input', value:fMes, onChange:function(e){setFMes(e.target.value);}},
            React.createElement('option', {value:''}, 'Todos los Meses'),
            mesesEs.map(function(m,i){ return React.createElement('option', {key:i+1, value:String(i+1)}, m); })
          ),
          React.createElement('select', {className:'mmpp-input', value:fAnio, onChange:function(e){setFAnio(e.target.value);}},
            React.createElement('option', {value:''}, 'Todos los Años'),
            yearOptions.map(function(y){ return React.createElement('option', {key:y, value:String(y)}, y); })
          )
        )
      ),

      React.createElement('div', {style:{display:'flex',gap:10,marginBottom:10}},
        React.createElement('button', {type:'button',className:'mmpp-ghostbtn',onClick:function(){limpiarFiltros();}}, 'Limpiar filtros')
      ),

      // Tabla principal
      React.createElement('table', {className:'mmpp'},
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', {style:{width:40}}),
            React.createElement('th', null, 'NIVEL'),
            React.createElement('th', null, 'CONTACTO / ETIQUETA'),
            React.createElement('th', null, 'CANTIDAD'),
            React.createElement('th', null, '# ASIG.'),
            React.createElement('th', null, 'ÚLTIMA FECHA')
          )
        ),
        React.createElement('tbody', null,
          // AÑOS
          pivot.map(function(Y){
            var openY = !!openMap[Y.key];
            return React.createElement(React.Fragment, {key:Y.key},
              React.createElement('tr', null,
                React.createElement('td', null,
                  React.createElement('span', {className:'hist-toggle', onClick:function(){toggle(Y.key);}}, openY?'▾':'▸')
                ),
                React.createElement('td', {style:{fontWeight:800}}, 'Año'),
                React.createElement('td', {style:{fontWeight:800}}, String(Y.anio)),
                React.createElement('td', {style:{fontWeight:800}}, numeroCL(Y.total)+' tons'),
                React.createElement('td', null, ''),
                React.createElement('td', null,
                  React.createElement('div',{className:'mmpp-actions'},
                    React.createElement('button',{className:'mmpp-ghostbtn',onClick:function(){expandAllYear(Y.anio,true);}}, 'Expandir'),
                    React.createElement('button',{className:'mmpp-ghostbtn',onClick:function(){expandAllYear(Y.anio,false);}}, 'Colapsar')
                  )
                )
              ),
              // MESES
              openY && Y.months.map(function(M){
                var openM = !!openMap[M.key];
                return React.createElement(React.Fragment, {key:M.key},
                  React.createElement('tr', null,
                    React.createElement('td', null,
                      React.createElement('span', {style:{paddingLeft:20}}),
                      React.createElement('span', {className:'hist-toggle', onClick:function(){toggle(M.key);}}, openM?'▾':'▸')
                    ),
                    React.createElement('td', {style:{fontWeight:700}}, 'Mes'),
                    React.createElement('td', null, mesesEs[(M.mes-1)||0]),
                    React.createElement('td', {style:{fontWeight:700}}, numeroCL(M.total)+' tons'),
                    React.createElement('td', null, ''),
                    React.createElement('td', null, '')
                  ),
                  // PROVEEDORES
                  openM && M.provs.map(function(P){
                    var openP = !!openMap[P.key];
                    var lastTxt = P.lastDate ? new Date(P.lastDate).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'}) : '—';
                    return React.createElement(React.Fragment, {key:P.key},
                      React.createElement('tr', null,
                        React.createElement('td', null,
                          React.createElement('span', {style:{paddingLeft:40}}),
                          React.createElement('span', {className:'hist-toggle', onClick:function(){toggle(P.key);}}, openP?'▾':'▸')
                        ),
                        React.createElement('td', null, 'Proveedor'),
                        React.createElement('td', null, P.proveedor||'—'),
                        React.createElement('td', null, React.createElement('strong', null, numeroCL(P.total)+' tons')),
                        React.createElement('td', null, P.count),
                        React.createElement('td', null, lastTxt)
                      ),
                      // DETALLE
                      openP && React.createElement('tr', {className:'hist-sub'},
                        React.createElement('td', {colSpan:6},
                          React.createElement('div', {style:{padding:'8px 10px'}},
                            React.createElement('div', {style:{fontWeight:800,marginBottom:6}}, 'Asignaciones'),
                            React.createElement('table', {className:'mmpp', style:{margin:'6px 0'}},
                              React.createElement('thead', null,
                                React.createElement('tr', null,
                                  React.createElement('th', null, 'Fecha'),
                                  React.createElement('th', null, 'Cantidad'),
                                  React.createElement('th', null, 'Destino'),
                                  React.createElement('th', null, 'Disponibilidad original'),
                                  React.createElement('th', null, 'Acciones')
                                )
                              ),
                              React.createElement('tbody', null,
                                P.items.map(function(a,ii){
                                  var f = a.createdAt ? new Date(a.createdAt) : null;
                                  var fTxt = f ? f.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'}) : '—';
                                  var dest = (a.destMes && a.destAnio) ? (mesesEs[(a.destMes-1)||0]+' '+a.destAnio) : '—';
                                  var orig = (a.originalTons?(numeroCL(a.originalTons)+' tons'):'') + (a.originalFecha?(' (desde '+new Date(a.originalFecha).toLocaleDateString('es-CL')+')'):'');
                                  return React.createElement('tr', {key:a.id||ii},
                                    React.createElement('td', null, fTxt),
                                    React.createElement('td', null, React.createElement('strong', null, numeroCL(a.cantidad)+' t')),
                                    React.createElement('td', null, dest),
                                    React.createElement('td', null, orig||'—'),
                                    React.createElement('td', null,
                                      React.createElement('div', {className:'mmpp-actions'},
                                        React.createElement('button', {className:'mmpp-ghostbtn', onClick:function(){onEditAsign(a);}}, '✏️ Editar'),
                                        React.createElement('button', {className:'mmpp-ghostbtn mmpp-danger', onClick:function(){borrarAsig(a);}}, '🗑️ Eliminar')
                                      )
                                    )
                                  );
                                })
                              )
                            )
                          )
                        )
                      )
                    );
                  })
                );
              })
            );
          })
        )
      )
    ),

    // MODAL EDITAR
    editAsig && React.createElement('div', {className:'modalBG', onClick:function(){setEditAsig(null);}},
      React.createElement('div', {className:'modal', onClick:function(e){e.stopPropagation();}},
        React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('h2', {style:{margin:0,fontWeight:800}}, 'Editar Asignación'),
          React.createElement('button', {className:'mmpp-ghostbtn', onClick:function(){setEditAsig(null);}}, '✕')
        ),
        React.createElement('div', {style:{marginTop:8,color:'#374151'}},
          React.createElement('div', null, React.createElement('strong', null, 'Contacto: '), editAsig.proveedorNombre||'—'),
          React.createElement('div', null, React.createElement('strong', null, 'Fecha de Disponibilidad Original: '), editAsig.originalFecha?new Date(editAsig.originalFecha).toLocaleDateString('es-CL'):'—')
        ),
        React.createElement('div', {className:'mmpp-card', style:{marginTop:12}},
          React.createElement('div', {style:{fontWeight:800,marginBottom:10}}, 'Nuevos Detalles:'),
          React.createElement('div', {className:'mmpp-grid'},
            React.createElement('input', {className:'mmpp-input', type:'number', value:editAsig.cantidad, onChange:function(e){setEditAsig(function(s){var nx={}; for(var k in s) nx[k]=s[k]; nx.cantidad=e.target.value; return nx;});}}),
            React.createElement('div', {style:{display:'flex',gap:10}},
              React.createElement('select', {className:'mmpp-input', value:editAsig.destMes, onChange:function(e){setEditAsig(function(s){var nx={}; for(var k in s) nx[k]=s[k]; nx.destMes=e.target.value; return nx;});}},
                mesesEs.map(function(m,i){ return React.createElement('option', {key:i+1, value:String(i+1)}, m); })
              ),
              React.createElement('select', {className:'mmpp-input', value:editAsig.destAnio, onChange:function(e){setEditAsig(function(s){var nx={}; for(var k in s) nx[k]=s[k]; nx.destAnio=e.target.value; return nx;});}},
                Array.apply(null,{length:6}).map(function(_,k){var y=new Date().getFullYear()-1+k; return React.createElement('option', {key:y, value:String(y)}, y);})
              )
            )
          ),
          React.createElement('div', {style:{marginTop:12}},
            React.createElement('button', {className:'mmpp-ghostbtn', onClick:guardarEditAsig}, '💾 Guardar Cambios')
          )
        )
      )
    )
  );
}

/* ------------------------------ MOUNT ------------------------------ */
var mountNode = document.getElementById('root');
ReactDOM.createRoot(mountNode).render(React.createElement(InventarioHistorial));
