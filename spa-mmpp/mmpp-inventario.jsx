// Abastecimiento MMPP (standalone React 18 + Babel)
// Usa estilos desde /spa-mmpp/inventario.css

const { useEffect, useMemo, useState } = React;

function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }

var mesesEs = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];
var mesesShort = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

function chipLabelFromMesKey(mk){
  if(!mk || mk.indexOf("-")<0) return mk || "—";
  var p = mk.split("-");
  var y = String(p[0]).slice(-2);
  var m = Math.max(1, Math.min(12, Number(p[1])||1));
  return mesesShort[m-1] + y; // p.ej. "Sept.25"
}

function GroupBy(arr, keyFn){
  var m={}; (arr||[]).forEach(function(r){
    var k=keyFn(r); m[k]=(m[k]||[]).concat([r]);
  }); return m;
}

function useData(){
  var _a = React.useState([]), dispon=_a[0], setDispon=_a[1];
  var _b = React.useState([]), asig=_b[0], setAsig=_b[1];
  var _c = React.useState(false), loading=_c[0], setLoading=_c[1];

  function load(){
    setLoading(true);
    return Promise.all([
      MMppApi.getDisponibilidades(),
      MMppApi.getAsignaciones().catch(function(){return[]}),
    ]).then(function(res){
      setDispon(res[0]); setAsig(res[1]);
    }).finally(function(){ setLoading(false); });
  }
  React.useEffect(function(){ load(); }, []);
  return { dispon, asig, loading, reload: load };
}

function AbastecimientoMMPP(){
  var data = useData();
  var dispon = data.dispon, asig=data.asig, reload=data.reload;

  var _f = React.useState({
    proveedor:"", proveedorKey:"", comuna:"", centroCodigo:"",
    areaCodigo:"", contacto:"", disponibilidades:[{tons:"",fecha:""}],
  }), form=_f[0], setForm=_f[1];

  var _g = React.useState(""), filterProv=_g[0], setFilterProv=_g[1];
  var _h = React.useState(""), filterComuna=_h[0], setFilterComuna=_h[1];
  var _i = React.useState(null), assignModal=_i[0], setAssignModal=_i[1];
  var _j = React.useState(null), editAsig=_j[0], setEditAsig=_j[1];

  function addDisp(){
    setForm(function(f){ return Object.assign({}, f, {disponibilidades:f.disponibilidades.concat([{tons:"",fecha:""}])}); });
  }
  function delDisp(i){
    setForm(function(f){ return Object.assign({}, f, {disponibilidades:f.disponibilidades.filter(function(_ ,idx){return idx!==i})}); });
  }
  function updDisp(i,key,val){
    setForm(function(f){
      var next=f.disponibilidades.slice();
      var row=Object.assign({}, next[i]); row[key]=val; next[i]=row;
      return Object.assign({}, f, {disponibilidades:next});
    });
  }
  function upd(key,val){
    setForm(function(f){ var o={}; o[key]=val; return Object.assign({}, f, o); });
  }

  function submit(e){
    e.preventDefault();
    var has = form.disponibilidades.some(function(x){return x.tons && x.fecha;});
    if(!(form.proveedor || form.proveedorKey) || !has){
      alert("Proveedor o proveedorKey y al menos una disponibilidad"); return;
    }
    MMppApi.crearDisponibilidades(form).then(function(){
      setForm({
        proveedor:"", proveedorKey:"", comuna:"", centroCodigo:"",
        areaCodigo:"", contacto:"", disponibilidades:[{tons:"",fecha:""}],
      });
      return reload();
    });
  }

  var asigByDispo = React.useMemo(function(){
    return GroupBy(asig, function(a){ return (a.disponibilidadId || "__none__"); });
  }, [asig]);

  function saldoDe(r){
    var usadas=(asigByDispo[r.id]||[]).reduce(function(a,x){return a+(Number(x.cantidad)||0)},0);
    return Math.max(0, (Number(r.tons)||0) - usadas);
  }

  // ----- Inventario agrupado por proveedor + comuna
  var invRows = React.useMemo(function(){
    var rows = dispon.map(function(d){ return Object.assign({}, d, {saldo:saldoDe(d)}); });
    var g = GroupBy(rows, function(r){ return (r.proveedorNombre||"Sin Proveedor")+"|"+(r.comuna||""); });
    return Object.keys(g).map(function(k){
      var arr=g[k]; var parts=k.split("|"); var prov=parts[0], com=parts[1];
      var total = arr.reduce(function(a,r){return a+r.saldo;},0);
      var porMes = GroupBy(arr, function(r){ return r.mesKey||"—"; });
      var chips = Object.keys(porMes).map(function(m){
        var xx=porMes[m];
        return { mesKey:m, tons:xx.reduce(function(a,t){return a+t.saldo;},0) };
      }).sort(function(a,b){ return a.mesKey.localeCompare(b.mesKey); });
      return { proveedor:prov, comuna:com, items:arr, total:total, chips:chips };
    }).filter(function(r){
      return (!filterProv || r.proveedor===filterProv) && (!filterComuna || r.comuna===filterComuna);
    });
  }, [dispon, filterProv, filterComuna, asig]);

  var proveedores = React.useMemo(function(){
    return Array.from(new Set(dispon.map(function(x){return x.proveedorNombre;}).filter(Boolean))).sort();
  }, [dispon]);
  var comunas = React.useMemo(function(){
    return Array.from(new Set(dispon.map(function(x){return x.comuna;}).filter(Boolean))).sort();
  }, [dispon]);

  function abrirAsignacion(row){
    var lots = row.items.map(function(r){
      return { id:r.id, saldo:saldoDe(r), original:r.tons, fecha:r.fecha, mesKey:r.mesKey };
    });
    var selected = row.items[0]? row.items[0].id : null;
    setAssignModal({
      proveedor: row.proveedor, comuna: row.comuna, contacto: form.contacto || "",
      lots: lots, selectedId: selected, cantidad:"", destMes:null, destAnio:null,
    });
  }

  function confirmarAsignacion(){
    var m=assignModal;
    if(!m.selectedId || !m.cantidad || !m.destMes || !m.destAnio){
      alert("Completa cantidad, mes y año"); return;
    }
    var lot=(m.lots.filter(function(l){return l.id===m.selectedId;})[0]);
    if(!lot){ alert("Selecciona disponibilidad"); return; }
    var payload={
      disponibilidadId: lot.id,
      cantidad: Number(m.cantidad),
      destMes: Number(m.destMes),
      destAnio: Number(m.destAnio),
      proveedorNombre: assignModal.proveedor,
      originalTons: lot.original,
      originalFecha: lot.fecha,
    };
    MMppApi.crearAsignacion(payload).then(function(){return reload();}).finally(function(){ setAssignModal(null); });
  }

  // ----- Historial
  var _hp = React.useState(""), histProv=_hp[0], setHistProv=_hp[1];
  var _hm = React.useState(""), histMes=_hm[0], setHistMes=_hm[1];
  var _hy = React.useState(""), histAnio=_hy[0], setHistAnio=_hy[1];

  var hist = React.useMemo(function(){
    return (asig||[])
      .filter(function(a){ return Number(a.cantidad)>0; }) // evita filas "0 tons"
      .filter(function(a){
        return (!histProv || a.proveedorNombre===histProv) &&
               (!histMes || String(a.destMes)===String(histMes)) &&
               (!histAnio || String(a.destAnio)===String(histAnio));
      });
  }, [asig, histProv, histMes, histAnio]);

  function onEditAsign(a){
    setEditAsig({
      id:a.id, cantidad:String(a.cantidad||""), destMes:String(a.destMes||""),
      destAnio:String(a.destAnio||""), proveedorNombre:a.proveedorNombre,
      originalFecha:a.originalFecha,
    });
  }
  function guardarEditAsig(){
    var p={ cantidad:Number(editAsig.cantidad)||0,
            destMes:Number(editAsig.destMes)||null,
            destAnio:Number(editAsig.destAnio)||null };
    MMppApi.editarAsignacion(editAsig.id, p)
      .then(function(){return reload();})
      .finally(function(){ setEditAsig(null); });
  }
  function borrarAsig(a){
    if(!confirm("¿Eliminar asignación?")) return;
    MMppApi.borrarAsignacion(a.id).then(function(){ return reload(); });
  }

  return (
    <div className="mmpp-scope">
      {/* Hero */}
      <div className="mmpp-panel">
        <div className="mmpp-h1">Abastecimiento MMPP</div>
        <div className="mmpp-badge">▦ Panel de Control</div>
      </div>

      <div style={{height:18}}/>

      {/* Formulario */}
      <form onSubmit={submit} className="mmpp-panel">
        <div className="mmpp-h2">Registrar Nueva Materia Prima</div>

        <div className="mmpp-form-grid">
          <input className="mmpp-input" placeholder="Proveedor (Obligatorio)"
                 value={form.proveedor} onChange={function(e){upd("proveedor", e.target.value)}}/>
          <input className="mmpp-input" placeholder="Comuna (Obligatorio)"
                 value={form.comuna} onChange={function(e){upd("comuna", e.target.value)}}/>
          <input className="mmpp-input" placeholder="Código Centro (Opcional)"
                 value={form.centroCodigo} onChange={function(e){upd("centroCodigo", e.target.value)}}/>
          <input className="mmpp-input" placeholder="Código Área (Opcional)"
                 value={form.areaCodigo} onChange={function(e){upd("areaCodigo", e.target.value)}}/>
          <input className="mmpp-input" placeholder="Contacto (Opcional)"
                 value={form.contacto} onChange={function(e){upd("contacto", e.target.value)}}/>
          <input className="mmpp-input" placeholder="Proveedor Key (Opcional)"
                 value={form.proveedorKey} onChange={function(e){upd("proveedorKey", e.target.value)}}/>
        </div>

        <div className="mmpp-h2" style={{marginTop:12}}>Disponibilidad (Cantidad y Fecha)</div>

        <div className="mmpp-availability-list">
          {form.disponibilidades.map(function(d,i){
            return (
              <div key={i} className="mmpp-availability-item">
                <input className="mmpp-input" type="number" placeholder="Cantidad (tons) (Obligatorio)"
                       value={d.tons} onChange={function(e){updDisp(i,"tons",e.target.value)}}/>
                <input className="mmpp-input" type="date" placeholder="dd-mm-aaaa"
                       value={d.fecha} onChange={function(e){updDisp(i,"fecha",e.target.value)}}/>
                <button type="button" className="mmpp-remove" onClick={function(){delDisp(i)}}>Eliminar</button>
              </div>
            );
          })}
        </div>

        <div className="mt-12">
          <button type="button" className="mmpp-btn" onClick={addDisp}>+ Agregar Otra Disponibilidad</button>
        </div>

        <div className="mt-12">
          <button className="mmpp-btn mmpp-btn--primary" type="submit">+ Registrar Materia Prima</button>
        </div>
      </form>

      <div style={{height:18}}/>

      {/* Inventario Actual */}
      <div className="mmpp-panel">
        <div className="mmpp-h2">Inventario Actual</div>

        <div className="mmpp-form-grid" style={{marginBottom:12}}>
          <select className="mmpp-input" value={filterProv} onChange={function(e){setFilterProv(e.target.value)}}>
            <option value="">Todos los Proveedores</option>
            {proveedores.map(function(p){return <option key={p} value={p}>{p}</option>})}
          </select>
          <select className="mmpp-input" value={filterComuna} onChange={function(e){setFilterComuna(e.target.value)}}>
            <option value="">Todas las Comunas</option>
            {comunas.map(function(c){return <option key={c} value={c}>{c}</option>})}
          </select>
        </div>

        {/* Cabecera */}
        <div className="mmpp-row mmpp-head">
          <div>PROVEEDOR</div>
          <div>COMUNA</div>
          <div>DISPONIBILIDAD TOTAL</div>
          <div>DISPONIBILIDAD POR MES</div>
          <div className="justify-end">ACCIONES</div>
        </div>

        {invRows.map(function(r,idx){
          return (
            <div key={idx} className="mmpp-row">
              <div className="mmpp-col mmpp-col--supplier">{r.proveedor}</div>
              <div className="mmpp-col">{r.comuna || "—"}</div>
              <div className="mmpp-col mmpp-col--tons">
                <span style={{marginRight:8}}>📦</span>
                <b>{numeroCL(r.total)} tons</b>
                <span className="mmpp-badge" style={{marginLeft:8}}>({r.items.length} lotes)</span>
              </div>
              <div className="mmpp-chips">
                {r.chips.map(function(c){
                  return <span key={c.mesKey} className="mmpp-chip">{chipLabelFromMesKey(c.mesKey)} {numeroCL(c.tons)}t</span>;
                })}
              </div>
              <div className="mmpp-actions">
                <button className="mmpp-btn mmpp-btn--ghost" onClick={function(){abrirAsignacion(r)}}>Asignar</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{height:18}}/>

      {/* Historial */}
      <div className="mmpp-panel">
        <div className="mmpp-h2">Historial de Asignaciones</div>

        <div className="mmpp-form-grid" style={{marginBottom:12}}>
          <select className="mmpp-input" value={histProv} onChange={function(e){setHistProv(e.target.value)}}>
            <option value="">Todos los Proveedores</option>
            {proveedores.map(function(p){return <option key={p} value={p}>{p}</option>})}
          </select>
          <div className="mmpp-form-row">
            <select className="mmpp-input" value={histMes} onChange={function(e){setHistMes(e.target.value)}}>
              <option value="">Todos los Meses</option>
              {mesesEs.map(function(m,i){return <option key={i+1} value={i+1}>{m}</option>})}
            </select>
            <select className="mmpp-input" value={histAnio} onChange={function(e){setHistAnio(e.target.value)}}>
              <option value="">Todos los Años</option>
              {Array.from(new Set(asig.map(function(a){return a.destAnio;}).filter(Boolean))).sort().map(function(y){return <option key={y} value={y}>{y}</option>})}
            </select>
          </div>
        </div>

        {/* Cabecera historial */}
        <div className="mmpp-hist-row mmpp-hist-head">
          <div>FECHA ASIGNACIÓN</div>
          <div>PROVEEDOR</div>
          <div>CANTIDAD ASIGNADA</div>
          <div>DESTINO (MES/AÑO)</div>
          <div>DISPONIBILIDAD ORIGINAL</div>
          <div className="justify-end">ACCIONES</div>
        </div>

        {hist.map(function(a,idx){
          var fecha = a.createdAt ? new Date(a.createdAt) : null;
          var fechaTxt = fecha ? fecha.toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"}) : "—";
          var dest = (a.destMes && a.destAnio) ? (mesesEs[(a.destMes-1)||0] + " " + a.destAnio) : "—";
          var orig = (a.originalTons ? (numeroCL(a.originalTons) + " tons") : "") +
                     (a.originalFecha ? (" (desde " + new Date(a.originalFecha).toLocaleDateString("es-CL") + ")") : "");
          return (
            <div key={a.id||idx} className="mmpp-hist-row">
              <div className="mmpp-hist-col">{fechaTxt}</div>
              <div className="mmpp-hist-col">{a.proveedorNombre || "—"}</div>
              <div className="mmpp-hist-col mmpp-hist-col--tons"><b>{numeroCL(a.cantidad)} tons</b></div>
              <div className="mmpp-hist-col">{dest}</div>
              <div className="mmpp-hist-col">{orig || "—"}</div>
              <div className="mmpp-hist-actions">
                <button className="mmpp-btn mmpp-btn--ghost" onClick={function(){onEditAsign(a)}}>✏️ Editar</button>
                <button className="mmpp-remove" onClick={function(){borrarAsig(a)}}>🗑️ Eliminar</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Asignar */}
      {assignModal && (
        <div className="mmpp-modal-bg" onClick={function(){setAssignModal(null)}}>
          <div className="mmpp-modal" onClick={function(e){e.stopPropagation()}}>
            <div className="mmpp-h2">Asignar Materia Prima</div>
            <div className="mmpp-muted">
              <div><b>Proveedor:</b> {assignModal.proveedor}</div>
              <div><b>Comuna:</b> {assignModal.comuna || "—"}</div>
            </div>

            <div className="mt-12">
              <div className="mmpp-h2">Disponibilidades:</div>
              {assignModal.lots.map(function(l){
                var sel = assignModal.selectedId === l.id;
                return (
                  <div key={l.id} className={"mmpp-panel"} style={{padding:"12px", borderColor: sel?"#c7d2fe":""}}
                       onClick={function(){ setAssignModal(function(m){return Object.assign({}, m, {selectedId:l.id});}); }}>
                    <div className="mmpp-form-row">
                      <div>Saldo: <b>{numeroCL(l.saldo)}</b> tons<br/><small>Original: {numeroCL(l.original)} tons</small></div>
                      <div><small>desde {l.fecha ? new Date(l.fecha).toLocaleDateString("es-CL") : "—"}</small></div>
                      <div style={{textAlign:"right"}}>{l.mesKey ? chipLabelFromMesKey(l.mesKey) : "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mmpp-panel mt-12">
              <div className="mmpp-h2">Detalles de Asignación:</div>
              <div className="mmpp-form-grid">
                <input className="mmpp-input" type="number" placeholder="Ej: 150"
                       value={assignModal.cantidad}
                       onChange={function(e){ setAssignModal(function(m){return Object.assign({}, m, {cantidad:e.target.value});}); }}/>
                <div className="mmpp-form-row">
                  <select className="mmpp-input" value={assignModal.destMes||""}
                          onChange={function(e){ setAssignModal(function(m){return Object.assign({}, m, {destMes:e.target.value});}); }}>
                    <option value="">Mes de Destino</option>
                    {mesesEs.map(function(m,i){return <option key={i+1} value={i+1}>{m}</option>})}
                  </select>
                  <select className="mmpp-input" value={assignModal.destAnio||""}
                          onChange={function(e){ setAssignModal(function(m){return Object.assign({}, m, {destAnio:e.target.value});}); }}>
                    <option value="">Año de Destino</option>
                    {Array.apply(null,{length:6}).map(function(_,k){
                      var y = new Date().getFullYear()-1+k;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="mt-12">
                <button className="mmpp-btn mmpp-btn--primary" onClick={confirmarAsignacion}>✔ Confirmar Asignación</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editAsig && (
        <div className="mmpp-modal-bg" onClick={function(){setEditAsig(null)}}>
          <div className="mmpp-modal" onClick={function(e){e.stopPropagation()}}>
            <div className="mmpp-h2">Editar Asignación</div>
            <div className="mmpp-muted">
              <div><b>Proveedor:</b> {editAsig.proveedorNombre || "—"}</div>
              <div><b>Fecha de Disponibilidad Original:</b> {editAsig.originalFecha ? new Date(editAsig.originalFecha).toLocaleDateString("es-CL") : "—"}</div>
            </div>

            <div className="mmpp-panel mt-12">
              <div className="mmpp-h2">Nuevos Detalles:</div>
              <div className="mmpp-form-grid">
                <input className="mmpp-input" type="number" value={editAsig.cantidad}
                       onChange={function(e){ setEditAsig(function(s){return Object.assign({}, s, {cantidad:e.target.value});}); }}/>
                <div className="mmpp-form-row">
                  <select className="mmpp-input" value={editAsig.destMes}
                          onChange={function(e){ setEditAsig(function(s){return Object.assign({}, s, {destMes:e.target.value});}); }}>
                    {mesesEs.map(function(m,i){return <option key={i+1} value={String(i+1)}>{m}</option>})}
                  </select>
                  <select className="mmpp-input" value={editAsig.destAnio}
                          onChange={function(e){ setEditAsig(function(s){return Object.assign({}, s, {destAnio:e.target.value});}); }}>
                    {Array.apply(null,{length:6}).map(function(_,k){
                      var y=new Date().getFullYear()-1+k; return <option key={y} value={String(y)}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="mt-12">
                <button className="mmpp-btn mmpp-btn--primary" onClick={guardarEditAsig}>💾 Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

var mountNode = document.getElementById("root");
ReactDOM.createRoot(mountNode).render(<AbastecimientoMMPP />);
