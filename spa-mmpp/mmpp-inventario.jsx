// NerdUI v3.2 — sin optional chaining ni nullish coalescing para Babel 6
const { useEffect, useMemo, useState } = React;

function cssInject() {
  const css = `
  body{margin:0;background:#f6f8ff}
  .mmpp-wrap{max-width:1200px;margin:0 auto;padding:20px}
  .mmpp-hero{background:linear-gradient(180deg,#f3f6ff,transparent); border:1px solid #e5e7eb; border-radius:20px; padding:28px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 10px 30px rgba(17,24,39,.06)}
  .mmpp-hero h1{margin:0;font-weight:800;color:#2b3440}
  .mmpp-badge{background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:10px 16px; border-radius:14px; font-weight:700; display:inline-flex; align-items:center; gap:10px}
  .mmpp-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}
  .mmpp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .mmpp-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start}
  .mmpp-grid4 > *{min-width:0}
  .mmpp-input{height:48px;border:1px solid #e5e7eb;border-radius:14px;padding:0 14px;background:#fafafa;width:100%}
  .mmpp-button{height:54px;border-radius:18px;border:0;background:linear-gradient(90deg,#4f46e5,#9333ea);color:#fff;font-weight:800;font-size:18px;box-shadow:0 8px 20px rgba(79,70,229,.25); cursor:pointer}
  .mmpp-add{background:#eef2ff;color:#1e40af;border:1px solid #c7d2fe;height:44px;border-radius:12px;font-weight:800}
  .mmpp-ghostbtn{background:#eef2ff; border:1px solid #c7d2fe; color:#1e40af; height:38px; border-radius:10px; padding:0 12px; cursor:pointer}
  .mmpp-danger{background:#fee2e2; border:1px solid #fecaca; color:#b91c1c}
  .mmpp-help{font-size:12px;color:#6b7280;margin-top:6px}
  table.mmpp{width:100%; border-collapse:separate; border-spacing:0 8px}
  table.mmpp th, table.mmpp td{padding:12px 10px}
  table.mmpp tr{background:#fff; border:1px solid #e5e7eb}
  .mmpp-chip{display:inline-block; padding:6px 10px; background:#ede9fe; color:#6d28d9; border-radius:999px; margin-right:8px; font-weight:700; font-size:12px}
  .mmpp-actions{display:flex; gap:10px; align-items:center}
  .modalBG{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:999}
  .modal{width:min(860px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.2);padding:20px}
  .row-hover{border:1px solid #e5e7eb; border-radius:14px; padding:14px; margin-bottom:10px; background:#f9fafb}
  .row-hover.sel{background:#e0e7ff; border-color:#c7d2fe}
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }

var mesesEs = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
var mesesShort = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];
function chipLabelFromMesKey(mk){
  if(!mk || mk.indexOf("-")<0) return mk || "—";
  var p = mk.split("-"); var y = String(p[0]).slice(-2); var m = Math.max(1, Math.min(12, Number(p[1])||1));
  return mesesShort[m-1]+y;
}

function GroupBy(arr, keyFn){
  var m={}; (arr||[]).forEach(function(r){ var k=keyFn(r); m[k]=(m[k]||[]).concat([r]); }); return m;
}

function useData(){
  var _a=React.useState([]), dispon=_a[0], setDispon=_a[1];
  var _b=React.useState([]), asig=_b[0], setAsig=_b[1];
  var _c=React.useState(false), loading=_c[0], setLoading=_c[1];

  function load(){
    setLoading(true);
    return Promise.all([
      MMppApi.getDisponibilidades(),
      MMppApi.getAsignaciones().catch(function(){return[];})
    ]).then(function(res){
      setDispon(res[0]); setAsig(res[1]);
    }).finally(function(){ setLoading(false); });
  }
  React.useEffect(function(){ load(); }, []);
  return {dispon, asig, loading, reload: load};
}

/* carga perezosa del módulo de resumen (si no está en el HTML) */
function ensureResumenModule(){
  if (window.MMPPResumen && window.MMPPResumen.ResumenProveedorMes) return;
  var already = document.querySelector('script[data-mmpp-resumen="1"]');
  if (already) return;
  var s = document.createElement("script");
  s.src = "/spa-mmpp/mmpp-resumen.js";
  s.async = true;
  s.setAttribute("data-mmpp-resumen","1");
  document.head.appendChild(s);
}

function AbastecimientoMMPP(){
  var data=useData();
  var dispon=data.dispon, asig=data.asig, reload=data.reload;

  var _f=React.useState({ proveedor:"", proveedorKey:"", comuna:"", centroCodigo:"", areaCodigo:"", contacto:"", disponibilidades:[{tons:"",fecha:""}] }),
      form=_f[0], setForm=_f[1];

  // Filtros
  var _y=React.useState(""), filterYear=_y[0], setFilterYear=_y[1];
  var _m=React.useState(""), filterMes=_m[0], setFilterMes=_m[1];                 // 👈 NUEVO (mes)
  var _c=React.useState(""), filterComuna=_c[0], setFilterComuna=_c[1];
  var _p=React.useState(""), filterProv=_p[0], setFilterProv=_p[1];               // contacto
  var _e=React.useState(""), filterEmpresa=_e[0], setFilterEmpresa=_e[1];
  var _s=React.useState(""), searchContacto=_s[0], setSearchContacto=_s[1];

  var _assign=React.useState(null), assignModal=_assign[0], setAssignModal=_assign[1];
  var _editA=React.useState(null), editAsig=_editA[0], setEditAsig=_editA[1];
  var _editL=React.useState(null), editLotes=_editL[0], setEditLotes=_editL[1];

  React.useEffect(function(){ cssInject(); }, []);
  React.useEffect(function(){ ensureResumenModule(); }, []); // intenta cargar el resumen externo

  /* ---------- helpers de filtrado dependiente ---------- */
  function filteredBaseExcluding(excludeKey){
    var base = (dispon||[]).slice();
    if(excludeKey!=="year"   && filterYear)   base = base.filter(function(d){ return String(d.anio)===String(filterYear); });
    if(excludeKey!=="mes"    && filterMes)    base = base.filter(function(d){ return String(d.mes)===String(filterMes); }); // 👈 NUEVO
    if(excludeKey!=="comuna" && filterComuna) base = base.filter(function(d){ return d.comuna===filterComuna; });
    if(excludeKey!=="prov"   && filterProv)   base = base.filter(function(d){ return (d.contactoNombre||d.proveedorNombre)===filterProv; });
    if(excludeKey!=="emp"    && filterEmpresa)base = base.filter(function(d){ return d.empresaNombre===filterEmpresa; });
    return base;
  }
  function uniqSorted(arr){
    var set={}, out=[]; for(var i=0;i<arr.length;i++){ var v=arr[i]; if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } }
    out.sort(); return out;
  }

  // opciones dependientes
  var yearOptions = React.useMemo(function(){
    return uniqSorted(filteredBaseExcluding("year").map(function(d){return d.anio;}).filter(Boolean));
  }, [dispon, filterMes, filterComuna, filterProv, filterEmpresa]); // 👈 incluye mes
  var comunaOptions = React.useMemo(function(){
    return uniqSorted(filteredBaseExcluding("comuna").map(function(d){return d.comuna;}).filter(Boolean));
  }, [dispon, filterYear, filterMes, filterProv, filterEmpresa]);   // 👈 incluye mes
  var provOptions = React.useMemo(function(){
    return uniqSorted(filteredBaseExcluding("prov").map(function(d){return (d.contactoNombre||d.proveedorNombre);}).filter(Boolean));
  }, [dispon, filterYear, filterMes, filterComuna, filterEmpresa]); // 👈 incluye mes
  var empresaOptions = React.useMemo(function(){
    return uniqSorted(filteredBaseExcluding("emp").map(function(d){return d.empresaNombre;}).filter(Boolean));
  }, [dispon, filterYear, filterMes, filterComuna, filterProv]);    // 👈 incluye mes

  // si una selección queda inválida, la limpiamos
  useEffect(function(){ if(filterYear && yearOptions.indexOf(Number(filterYear))<0 && yearOptions.indexOf(String(filterYear))<0) setFilterYear(""); }, [yearOptions]);
  useEffect(function(){ if(filterComuna && comunaOptions.indexOf(filterComuna)<0) setFilterComuna(""); }, [comunaOptions]);
  useEffect(function(){ if(filterProv && provOptions.indexOf(filterProv)<0) setFilterProv(""); }, [provOptions]);
  useEffect(function(){ if(filterEmpresa && empresaOptions.indexOf(filterEmpresa)<0) setFilterEmpresa(""); }, [empresaOptions]);

  /* -------------- alta --------------- */
  function addDisp(){ setForm(function(f){ return Object.assign({}, f, {disponibilidades: f.disponibilidades.concat([{tons:"",fecha:""}])}); }); }
  function delDisp(i){ setForm(function(f){ return Object.assign({}, f, {disponibilidades: f.disponibilidades.filter(function(_,idx){return idx!==i;})}); }); }
  function updDisp(i,key,val){ setForm(function(f){ var next=f.disponibilidades.slice(); var row=Object.assign({}, next[i]); row[key]=val; next[i]=row; return Object.assign({}, f, {disponibilidades: next}); }); }
  function upd(key,val){ setForm(function(f){ var o={}; o[key]=val; return Object.assign({}, f, o); }); }
  function submit(e){
    e.preventDefault();
    var has = form.disponibilidades.some(function(x){return x.tons && x.fecha;});
    if(!(form.proveedor || form.proveedorKey) || !has){ alert("Proveedor o proveedorKey y al menos una disponibilidad"); return; }
    MMppApi.crearDisponibilidades(form).then(function(){
      setForm({ proveedor:"", proveedorKey:"", comuna:"", centroCodigo:"", areaCodigo:"", contacto:"", disponibilidades:[{tons:"",fecha:""}] });
      return reload();
    });
  }

  /* -------------- saldo por dispo -------------- */
  var asigByDispo = React.useMemo(function(){ return GroupBy(asig, function(a){ return (a.disponibilidadId||"__none__"); }); }, [asig]);
  function saldoDe(r){ var usadas=(asigByDispo[r.id]||[]).reduce(function(a,x){return a+(Number(x.cantidad)||0);},0); return Math.max(0,(Number(r.tons)||0)-usadas); }

  /* -------------- inventario agrupado -------------- */
  var invRows = React.useMemo(function(){
    var base = (dispon||[]).slice();
    if(filterYear)   base = base.filter(function(d){ return String(d.anio)===String(filterYear); });
    if(filterMes)    base = base.filter(function(d){ return String(d.mes)===String(filterMes); });   // 👈 NUEVO
    if(filterComuna) base = base.filter(function(d){ return d.comuna===filterComuna; });
    if(filterProv)   base = base.filter(function(d){ return (d.contactoNombre||d.proveedorNombre)===filterProv; });
    if(filterEmpresa)base = base.filter(function(d){ return d.empresaNombre===filterEmpresa; });

    var withSaldo = base.map(function(d){ return Object.assign({}, d, {saldo: saldoDe(d)}); });
    var g = GroupBy(withSaldo, function(r){
      var c=(r.contactoNombre||r.proveedorNombre||"Sin contacto");
      var e=(r.empresaNombre||"");
      var co=(r.comuna||"");
      return c+"|"+e+"|"+co;
    });

    return Object.keys(g).map(function(k){
      var arr=g[k]; var parts=k.split("|"); var contacto=parts[0], empresa=parts[1], com=parts[2];
      var total = arr.reduce(function(a,r){return a+r.saldo;},0);

      var chips = arr.slice()
                     .sort(function(a,b){ return String(a.mesKey||"").localeCompare(String(b.mesKey||"")); })
                     .map(function(it){ return {id:it.id, mesKey:it.mesKey||"—", tons:(it.saldo!=null?it.saldo:it.tons)||0}; });

      var tel=""; for(var i=0;i<arr.length;i++){ var t=(arr[i].contactoSnapshot && arr[i].contactoSnapshot.telefono)||""; if(t){tel=t;break;} }

      return { proveedor:contacto, contactoNombre:contacto, empresaNombre:empresa, comuna:com, items:arr, total:total, chips:chips, telefono:tel };
    }).filter(function(r){
      var okSearch = (!searchContacto || (r.contactoNombre.toLowerCase().indexOf(searchContacto.toLowerCase())>=0));
      return okSearch;
    });
  }, [dispon, asig, filterYear, filterMes, filterComuna, filterProv, filterEmpresa, searchContacto]);

  // Total bajo Comuna: considera TODOS los filtros (incluye mes)
  var totalsFiltro = React.useMemo(function(){
    var base = (dispon||[]).slice();
    if(filterYear)   base = base.filter(function(d){ return String(d.anio)===String(filterYear); });
    if(filterMes)    base = base.filter(function(d){ return String(d.mes)===String(filterMes); });   // 👈 NUEVO
    if(filterComuna) base = base.filter(function(d){ return d.comuna===filterComuna; });
    if(filterProv)   base = base.filter(function(d){ return (d.contactoNombre||d.proveedorNombre)===filterProv; });
    if(filterEmpresa)base = base.filter(function(d){ return d.empresaNombre===filterEmpresa; });
    var tons=0; for(var i=0;i<base.length;i++){ tons += saldoDe(base[i]); }
    return {tons:tons, lotes:base.length};
  }, [dispon, asig, filterYear, filterMes, filterComuna, filterProv, filterEmpresa]);

  /* -------------- acciones -------------- */
  function abrirAsignacion(row){
    var lots=row.items.map(function(r){ return {id:r.id, saldo:saldoDe(r), original:r.tons, fecha:r.fecha, mesKey:r.mesKey}; });
    var selected=row.items[0]?row.items[0].id:null;
    setAssignModal({ proveedor:row.proveedor, comuna:row.comuna, contacto:form.contacto||"", lots:lots, selectedId:selected, cantidad:"", destMes:null, destAnio:null });
  }
  function confirmarAsignacion(){
    var m=assignModal; if(!m.selectedId || !m.cantidad || !m.destMes || !m.destAnio){ alert("Completa cantidad, mes y año"); return; }
    var lot=m.lots.filter(function(l){return l.id===m.selectedId;})[0]; if(!lot){ alert("Selecciona disponibilidad"); return; }
    var payload={ disponibilidadId:lot.id, cantidad:Number(m.cantidad), destMes:Number(m.destMes), destAnio:Number(m.destAnio), proveedorNombre:assignModal.proveedor, originalTons:lot.original, originalFecha:lot.fecha };
    MMppApi.crearAsignacion(payload).then(function(){return reload();}).finally(function(){ setAssignModal(null); });
  }

  var _hp=React.useState(""), histProv=_hp[0], setHistProv=_hp[1];
  var _hm=React.useState(""), histMes=_hm[0], setHistMes=_hm[1];
  var _hy=React.useState(""), histAnio=_hy[0], setHistAnio=_hy[1];

  var hist = React.useMemo(function(){
    return asig.filter(function(a){return Number(a.cantidad)>0;})
               .filter(function(a){
                  return (!histProv || a.proveedorNombre===histProv) &&
                         (!histMes || String(a.destMes)===String(histMes)) &&
                         (!histAnio || String(a.destAnio)===String(histAnio));
               });
  }, [asig, histProv, histMes, histAnio]);

  function onEditAsign(a){
    setEditAsig({ id:a.id, cantidad:String(a.cantidad||""), destMes:String(a.destMes||""), destAnio:String(a.destAnio||""), proveedorNombre:a.proveedorNombre, originalFecha:a.originalFecha });
  }
  function guardarEditAsig(){
    var p={ cantidad:Number(editAsig.cantidad)||0, destMes:Number(editAsig.destMes)||null, destAnio:Number(editAsig.destAnio)||null };
    MMppApi.editarAsignacion(editAsig.id, p).then(function(){return reload();}).finally(function(){ setEditAsig(null); });
  }
  function borrarAsig(a){ if(!confirm("¿Eliminar asignación?")) return; MMppApi.borrarAsignacion(a.id).then(function(){return reload();}); }

  function abrirEditarLotes(row){
    var lots=row.items.map(function(r){ return { id:r.id, tons:String((r.tons!=null?r.tons:(r.saldo!=null?r.saldo:0))||0), fecha:r.fecha||"", mesKey:r.mesKey||"" }; });
    setEditLotes({ proveedor:row.proveedor, comuna:row.comuna||"", lots:lots });
  }
  function borrarLote(idx,L){
    if(!confirm("¿Eliminar esta disponibilidad/lote?")) return;
    var api=(typeof MMppApi!=="undefined"&&MMppApi)?MMppApi:null; if(!api){ alert("MMppApi no está disponible."); return; }
    var id=(L&&(L.id!=null?L.id:L.disponibilidadId)); if(id==null){ alert("No se encontró el id del lote."); return; }
    if(!isNaN(Number(id))) id=Number(id);
    var eliminarFn=api.eliminarDisponibilidad||api.borrarDisponibilidad||api.deleteDisponibilidad||api.removeDisponibilidad||api.eliminar;
    if(typeof eliminarFn!=="function"){ alert("No existe MMppApi.eliminarDisponibilidad/borrarDisponibilidad."); return; }
    Promise.resolve(eliminarFn.call(api, id)).then(function(){
      setEditLotes(function(m){ if(!m) return m; var nx=Object.assign({}, m); var arr=(nx.lots||[]).slice(); arr.splice(idx,1); nx.lots=arr; return arr.length?nx:null; });
      return reload();
    }).catch(function(){ alert("No se pudo eliminar el lote."); });
  }
  function guardarEditarLotes(){
    var m=editLotes; if(!m) return;
    var prom=(m.lots||[]).map(function(L){ var payload={tons:Number(L.tons)||0, fecha:L.fecha||null}; return MMppApi.editarDisponibilidad(L.id, payload); });
    Promise.all(prom).then(function(){return reload();}).finally(function(){ setEditLotes(null); });
  }

  function limpiarFiltros(){ setFilterYear(""); setFilterMes(""); setFilterComuna(""); setFilterProv(""); setFilterEmpresa(""); setSearchContacto(""); } // 👈 incluye mes

  /* ----------------- UI ----------------- */
  // Referencia al componente global del resumen (si está cargado)
  var ResumenProveedorMes = (window.MMPPResumen && window.MMPPResumen.ResumenProveedorMes) || null;

  return (
    <div className="mmpp-wrap">
      <div className="mmpp-hero">
        <div><h1>Abastecimiento MMPP</h1></div>
        <div className="mmpp-badge">▦ Panel de Control</div>
      </div>

      <div style={{height:18}} />

      <form onSubmit={submit} className="mmpp-card">
        <h2 style={{margin:"0 0 14px", fontWeight:800}}>Registrar Nueva Materia Prima</h2>
        <div className="mmpp-grid">
          <input className="mmpp-input" placeholder="Proveedor (Obligatorio)" value={form.proveedor} onChange={function(e){upd("proveedor", e.target.value);}} />
          <input className="mmpp-input" placeholder="Comuna (Obligatorio)" value={form.comuna} onChange={function(e){upd("comuna", e.target.value);}} />
          <input className="mmpp-input" placeholder="Código Centro (Opcional)" value={form.centroCodigo} onChange={function(e){upd("centroCodigo", e.target.value);}} />
          <input className="mmpp-input" placeholder="Código Área (Opcional)" value={form.areaCodigo} onChange={function(e){upd("areaCodigo", e.target.value);}} />
          <input className="mmpp-input" placeholder="Contacto (Opcional)" value={form.contacto} onChange={function(e){upd("contacto", e.target.value);}} />
          <input className="mmpp-input" placeholder="Proveedor Key (Opcional)" value={form.proveedorKey} onChange={function(e){upd("proveedorKey", e.target.value);}} />
        </div>

        <div style={{marginTop:16, fontWeight:800}}>Disponibilidad (Cantidad y Fecha)</div>
        {form.disponibilidades.map(function(d,i){
          return (
            <div key={i} className="mmpp-grid" style={{alignItems:"center"}}>
              <input className="mmpp-input" type="number" placeholder="Cantidad (tons) (Obligatorio)" value={d.tons} onChange={function(e){updDisp(i,"tons",e.target.value);}} />
              <div style={{display:"flex", gap:10, alignItems:"center"}}>
                <input className="mmpp-input" type="date" value={d.fecha} onChange={function(e){updDisp(i,"fecha",e.target.value);}} style={{flex:1}} />
                <button type="button" className="mmpp-ghostbtn mmpp-danger" onClick={function(){delDisp(i);}}>Eliminar</button>
              </div>
            </div>
          );
        })}
        <div style={{marginTop:10}}>
          <button type="button" className="mmpp-add" onClick={addDisp}>+ Agregar Otra Disponibilidad</button>
        </div>

        <div style={{marginTop:16}}>
          <button className="mmpp-button" type="submit">+ Registrar Materia Prima</button>
        </div>
      </form>

      <div style={{height:18}} />

      <div className="mmpp-card">
        <h2 style={{margin:"0 0 14px", fontWeight:800}}>Inventario Actual</h2>

        {/* Fila 1: Año, Mes, Comuna, Contacto */}
        <div className="mmpp-grid4" style={{marginBottom:6}}>
          <div>
            <select className="mmpp-input" value={filterYear} onChange={function(e){ setFilterYear(e.target.value); }}>
              <option value="">Todos los Años</option>
              {yearOptions.map(function(y){ return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
          <div>
            <select className="mmpp-input" value={filterMes} onChange={function(e){ setFilterMes(e.target.value); }}>
              <option value="">Todos los Meses</option>
              {mesesEs.map(function(m,i){ return <option key={i+1} value={i+1}>{m}</option>; })}
            </select>
          </div>
          <div>
            <select className="mmpp-input" value={filterComuna} onChange={function(e){ setFilterComuna(e.target.value); }}>
              <option value="">Todas las Comunas</option>
              {comunaOptions.map(function(c){ return <option key={c} value={c}>{c}</option>; })}
            </select>
            <div className="mmpp-help">
              Total filtrado: <strong>{numeroCL(totalsFiltro.tons)} tons</strong> ({totalsFiltro.lotes} lotes)
            </div>
          </div>
          <div>
            <select className="mmpp-input" value={filterProv} onChange={function(e){ setFilterProv(e.target.value); }}>
              <option value="">Todos los Contactos</option>
              {provOptions.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
            </select>
          </div>
        </div>

        {/* Fila 2: Empresa, buscador, limpiar */}
        <div className="mmpp-grid4" style={{alignItems:"center", marginBottom:12}}>
          <div>
            <select className="mmpp-input" value={filterEmpresa} onChange={function(e){ setFilterEmpresa(e.target.value); }}>
              <option value="">Todas las Empresas</option>
              {empresaOptions.map(function(emp){ return <option key={emp} value={emp}>{emp}</option>; })}
            </select>
          </div>
          <div style={{gridColumn:"span 2"}}>
            <input className="mmpp-input" placeholder="Buscar contacto..." value={searchContacto} onChange={function(e){ setSearchContacto(e.target.value); }} />
          </div>
          <div style={{textAlign:"right"}}>
            <button type="button" className="mmpp-ghostbtn" onClick={limpiarFiltros}>Limpiar filtros</button>
          </div>
        </div>

        <table className="mmpp">
          <thead>
            <tr>
              <th>CONTACTO</th>
              <th>COMUNA</th>
              <th>DISPONIBILIDAD TOTAL</th>
              <th>DISPONIBILIDAD POR MES</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {invRows.map(function(r,idx){
              return (
                <tr key={idx}>
                  <td>
                    <div style={{fontWeight:800}}>{r.proveedor}</div>
                    <div style={{fontSize:12,color:"#6b7280"}}>{r.empresaNombre||"—"}{r.telefono?(" · "+r.telefono):""}</div>
                  </td>
                  <td>{r.comuna||"—"}</td>
                  <td>
                    <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                      <span>📦</span><strong>{numeroCL(r.total)} tons</strong> <small>({r.items.length} lotes)</small>
                    </span>
                  </td>
                  <td>
                    {r.chips.map(function(c){
                      return <span key={c.id||(c.mesKey+"-"+c.tons)} className="mmpp-chip">{chipLabelFromMesKey(c.mesKey)} {numeroCL(c.tons)}t</span>;
                    })}
                  </td>
                  <td>
                    <div className="mmpp-actions">
                      <button className="mmpp-ghostbtn" onClick={function(){abrirAsignacion(r);}}>Asignar</button>
                      <button className="mmpp-ghostbtn" title="Editar" onClick={function(){abrirEditarLotes(r);}}>✏️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumen Proveedor × Mes + gráfico (se carga sólo si existe el módulo externo) */}
      <div style={{height:18}} />
      {ResumenProveedorMes && (
        <ResumenProveedorMes
          dispon={dispon}
          asig={asig}
          defaultYear={filterYear}
          filterComuna={filterComuna}
          filterEmpresa={filterEmpresa}
        />
      )}

      <div style={{height:18}} />

      {/* HISTORIAL */}
      <div className="mmpp-card">
        <h2 style={{margin:"0 0 14px", fontWeight:800}}>Historial de Asignaciones</h2>
        <div className="mmpp-grid" style={{marginBottom:12}}>
          <select className="mmpp-input" value={histProv} onChange={function(e){ setHistProv(e.target.value); }}>
            <option value="">Todos los Contactos</option>
            {uniqSorted(asig.map(function(a){return a.proveedorNombre;}).filter(Boolean)).map(function(p){return <option key={p} value={p}>{p}</option>;})}
          </select>
          <div style={{display:"flex",gap:10}}>
            <select className="mmpp-input" value={histMes} onChange={function(e){ setHistMes(e.target.value); }}>
              <option value="">Todos los Meses</option>
              {mesesEs.map(function(m,i){ return <option key={i+1} value={i+1}>{m}</option>; })}
            </select>
            <select className="mmpp-input" value={histAnio} onChange={function(e){ setHistAnio(e.target.value); }}>
              <option value="">Todos los Años</option>
              {uniqSorted(asig.map(function(a){return a.destAnio;}).filter(Boolean)).map(function(y){ return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
        </div>

        <table className="mmpp">
          <thead>
            <tr>
              <th>FECHA ASIGNACIÓN</th>
              <th>CONTACTO</th>
              <th>CANTIDAD ASIGNADA</th>
              <th>DESTINO (MES/AÑO)</th>
              <th>DISPONIBILIDAD ORIGINAL</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {hist.map(function(a,idx){
              var fecha=a.createdAt?new Date(a.createdAt):null;
              var fechaTxt=fecha?fecha.toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"}):"—";
              var dest=(a.destMes && a.destAnio)?(mesesEs[(a.destMes-1)||0]+" "+a.destAnio):"—";
              var orig=(a.originalTons?(numeroCL(a.originalTons)+" tons"):"")+(a.originalFecha?(" (desde "+new Date(a.originalFecha).toLocaleDateString("es-CL")+")"):"");
              return (
                <tr key={a.id||idx}>
                  <td>{fechaTxt}</td>
                  <td>{a.proveedorNombre||"—"}</td>
                  <td><strong>{numeroCL(a.cantidad)} tons</strong></td>
                  <td>{dest}</td>
                  <td>{orig||"—"}</td>
                  <td className="mmpp-actions">
                    <button className="mmpp-ghostbtn" onClick={function(){onEditAsign(a);}}>✏️ Editar</button>
                    <button className="mmpp-ghostbtn mmpp-danger" onClick={function(){borrarAsig(a);}}>🗑️ Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALES (asignar / editar / lotes) */}
      {assignModal && (
        <div className="modalBG" onClick={function(){setAssignModal(null);}}>
          <div className="modal" onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h2 style={{margin:0,fontWeight:800}}>Asignar Materia Prima</h2>
              <button className="mmpp-ghostbtn" onClick={function(){setAssignModal(null);}}>✕</button>
            </div>
            <div style={{marginTop:8,color:"#374151"}}>
              <div><strong>Contacto:</strong> {assignModal.proveedor}</div>
              <div><strong>Comuna:</strong> {assignModal.comuna||"—"}</div>
            </div>
            <div style={{marginTop:12}}>
              <div style={{fontWeight:800,marginBottom:8}}>Disponibilidades:</div>
              {assignModal.lots.map(function(l){
                return (
                  <div key={l.id} className={"row-hover"+(assignModal.selectedId===l.id?" sel":"")} onClick={function(){setAssignModal(function(m){return Object.assign({},m,{selectedId:l.id});});}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      <div><div>Saldo: <strong>{numeroCL(l.saldo)}</strong> tons</div><small>Original: {numeroCL(l.original)} tons</small></div>
                      <div><small>desde {l.fecha?new Date(l.fecha).toLocaleDateString("es-CL"):"—"}</small></div>
                      <div style={{textAlign:"right"}}>{l.mesKey?chipLabelFromMesKey(l.mesKey):"—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mmpp-card" style={{marginTop:12}}>
              <div style={{fontWeight:800,marginBottom:10}}>Detalles de Asignación:</div>
              <div className="mmpp-grid">
                <input className="mmpp-input" type="number" placeholder="Ej: 150" value={assignModal.cantidad} onChange={function(e){setAssignModal(function(m){return Object.assign({},m,{cantidad:e.target.value});});}} />
                <div style={{display:"flex",gap:10}}>
                  <select className="mmpp-input" value={assignModal.destMes||""} onChange={function(e){setAssignModal(function(m){return Object.assign({},m,{destMes:e.target.value});});}}>
                    <option value="">Mes de Destino</option>
                    {mesesEs.map(function(m,i){return <option key={i+1} value={i+1}>{m}</option>;})}
                  </select>
                  <select className="mmpp-input" value={assignModal.destAnio||""} onChange={function(e){setAssignModal(function(m){return Object.assign({},m,{destAnio:e.target.value});});}}>
                    <option value="">Año de Destino</option>
                    {Array.apply(null,{length:6}).map(function(_,k){var y=new Date().getFullYear()-1+k; return <option key={y} value={y}>{y}</option>;})}
                  </select>
                </div>
              </div>
              <div style={{marginTop:12}}>
                <button className="mmpp-button" onClick={confirmarAsignacion}>✔ Confirmar Asignación</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editAsig && (
        <div className="modalBG" onClick={function(){setEditAsig(null);}}>
          <div className="modal" onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0,fontWeight:800}}>Editar Asignación</h2><button className="mmpp-ghostbtn" onClick={function(){setEditAsig(null);}}>✕</button></div>
            <div style={{marginTop:8,color:"#374151"}}><div><strong>Contacto:</strong> {editAsig.proveedorNombre||"—"}</div><div><strong>Fecha de Disponibilidad Original:</strong> {editAsig.originalFecha?new Date(editAsig.originalFecha).toLocaleDateString("es-CL"):"—"}</div></div>
            <div className="mmpp-card" style={{marginTop:12}}>
              <div style={{fontWeight:800,marginBottom:10}}>Nuevos Detalles:</div>
              <div className="mmpp-grid">
                <input className="mmpp-input" type="number" value={editAsig.cantidad} onChange={function(e){setEditAsig(function(s){return Object.assign({},s,{cantidad:e.target.value});});}} />
                <div style={{display:"flex",gap:10}}>
                  <select className="mmpp-input" value={editAsig.destMes} onChange={function(e){setEditAsig(function(s){return Object.assign({},s,{destMes:e.target.value});});}}>
                    {mesesEs.map(function(m,i){return <option key={i+1} value={String(i+1)}>{m}</option>;})}
                  </select>
                  <select className="mmpp-input" value={editAsig.destAnio} onChange={function(e){setEditAsig(function(s){return Object.assign({},s,{destAnio:e.target.value});});}}>
                    {Array.apply(null,{length:6}).map(function(_,k){var y=new Date().getFullYear()-1+k; return <option key={y} value={String(y)}>{y}</option>;})}
                  </select>
                </div>
              </div>
              <div style={{marginTop:12}}><button className="mmpp-button" onClick={guardarEditAsig}>💾 Guardar Cambios</button></div>
            </div>
          </div>
        </div>
      )}

      {editLotes && (
        <div className="modalBG" onClick={function(){setEditLotes(null);}}>
          <div className="modal" onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0,fontWeight:800}}>Editar Lotes</h2><button className="mmpp-ghostbtn" onClick={function(){setEditLotes(null);}}>✕</button></div>
            <div style={{marginTop:8,color:"#374151"}}><div><strong>Contacto:</strong> {editLotes.proveedor}</div><div><strong>Comuna:</strong> {editLotes.comuna||"—"}</div></div>
            <div className="mmpp-card" style={{marginTop:12}}>
              <div style={{fontWeight:800,marginBottom:10}}>Lotes:</div>
              <table className="mmpp" style={{width:"100%"}}>
                <thead><tr><th>Mes</th><th>Fecha</th><th>Tons</th><th>Acciones</th></tr></thead>
                <tbody>
                  {editLotes.lots.map(function(L,i){
                    return (
                      <tr key={L.id||i}>
                        <td>{chipLabelFromMesKey(L.mesKey)}</td>
                        <td><input className="mmpp-input" type="date" value={L.fecha?String(L.fecha).slice(0,10):""} onChange={function(e){var v=e.target.value; setEditLotes(function(m){var nx=Object.assign({},m); var arr=nx.lots.slice(); var row=Object.assign({},arr[i],{fecha:v}); arr[i]=row; nx.lots=arr; return nx;});}} /></td>
                        <td><input className="mmpp-input" type="number" inputMode="numeric" value={L.tons} onChange={function(e){var v=e.target.value; setEditLotes(function(m){var nx=Object.assign({},m); var arr=nx.lots.slice(); var row=Object.assign({},arr[i],{tons:v}); arr[i]=row; nx.lots=arr; return nx;});}} /></td>
                        <td><button className="mmpp-ghostbtn mmpp-danger" title="Eliminar lote" onClick={function(){borrarLote(i,L);}}>🗑️ Eliminar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="mmpp-ghostbtn" onClick={function(){setEditLotes(null);}}>Cancelar</button>
                <button className="mmpp-button" onClick={guardarEditarLotes}>💾 Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

var mountNode=document.getElementById("root");
ReactDOM.createRoot(mountNode).render(<AbastecimientoMMPP />);
