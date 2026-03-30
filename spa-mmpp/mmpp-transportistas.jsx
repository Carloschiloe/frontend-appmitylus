/* ========= MMPP · Transportistas (consistente con inventario/calendario) ========= */
const { useEffect, useMemo, useState } = React;

function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }

function TransportistasApp(){
  var _list = React.useState([]), list=_list[0], setList=_list[1];
  var _q    = React.useState(""), q=_q[0], setQ=_q[1];
  var _mdl  = React.useState(null), modal=_mdl[0], setModal=_mdl[1];
  var _loading = React.useState(false), loading=_loading[0], setLoading=_loading[1];

  function api(){
    return (typeof MMppApi!=="undefined" && MMppApi) ? MMppApi : null;
  }

  function load(){
    setLoading(true);
    var a = api();
    if(!a || !a.getTransportistas){
      setList([]);
      setLoading(false);
      return;
    }
    Promise.resolve(a.getTransportistas())
      .then(function(res){ setList(res||[]); })
      .catch(function(){ setList([]); })
      .finally(function(){ setLoading(false); });
  }

  React.useEffect(function(){ load(); }, []);

  var filtered = React.useMemo(function(){
    var arr = (list||[]);
    if(!q) return arr;
    var qq = String(q).toLowerCase();
    return arr.filter(function(t){
      var s = (t.nombre||"")+" "+(t.rut||"")+" "+(t.contactoNombre||"")+" "+(t.area||"");
      return s.toLowerCase().indexOf(qq)>=0;
    });
  }, [list, q]);

  function openNew(){
    setModal({ id:null, nombre:"", rut:"", contactoNombre:"", contactoTelefono:"", area:"", capacidades:"", tarifas:"" });
  }
  function openEdit(t){
    setModal({
      id:t.id,
      nombre:t.nombre||"",
      rut:t.rut||"",
      contactoNombre:t.contactoNombre||"",
      contactoTelefono:t.contactoTelefono||"",
      area:t.area||"",
      capacidades:t.capacidades||"",
      tarifas:t.tarifas||""
    });
  }
  function closeModal(){ setModal(null); }

  function saveModal(){
    var a = api(); if(!a){ alert("MMppApi no disponible"); return; }
    var p = {
      nombre: modal.nombre,
      rut: modal.rut,
      contactoNombre: modal.contactoNombre,
      contactoTelefono: modal.contactoTelefono,
      area: modal.area,
      capacidades: modal.capacidades,
      tarifas: modal.tarifas
    };
    var op = modal.id ? a.editarTransportista && a.editarTransportista(modal.id, p)
                      : a.crearTransportista && a.crearTransportista(p);
    if(!op){ alert("Falta implementar en MMppApi (crear/editar)"); return; }
    Promise.resolve(op).then(function(){ closeModal(); load(); })
      .catch(function(){ alert("No se pudo guardar"); });
  }

  function borrar(t){
    if(!confirm("¿Eliminar transportista?")) return;
    var a = api(); if(!a || !a.borrarTransportista){ alert("Falta MMppApi.borrarTransportista"); return; }
    Promise.resolve(a.borrarTransportista(t.id)).then(function(){ load(); })
      .catch(function(){ alert("No se pudo eliminar"); });
  }

  return (
    <div>
      {/* Hero */}
      <div className="mmpp-card" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0,fontWeight:800}}>🚚 Transportistas</h2>
        <div style={{display:"flex",gap:10}}>
          <button className="mmpp-ghostbtn" onClick={openNew}>+ Nuevo transportista</button>
        </div>
      </div>

      {/* Filtros / acciones */}
      <div className="mmpp-card">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12}}>
          <input className="mmpp-input" placeholder="Buscar por nombre / RUT / contacto / área..." value={q} onChange={function(e){ setQ(e.target.value); }} />
          <button className="mmpp-ghostbtn" onClick={load}>{loading?"Cargando...":"↻ Recargar"}</button>
        </div>
      </div>

      {/* Listado */}
      <div className="mmpp-card">
        <table className="mmpp">
          <thead>
            <tr>
              <th>Transportista</th>
              <th>RUT</th>
              <th>Contacto</th>
              <th>Área</th>
              <th>Capacidades</th>
              <th>Tarifas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 ? (
              <tr><td colSpan="7" style={{color:"#6b7280"}}>Sin transportistas</td></tr>
            ) : filtered.map(function(t,i){
              return (
                <tr key={t.id||i}>
                  <td><strong>{t.nombre||"—"}</strong></td>
                  <td>{t.rut||"—"}</td>
                  <td>{(t.contactoNombre||"—")+(t.contactoTelefono?(" · "+t.contactoTelefono):"")}</td>
                  <td>{t.area||"—"}</td>
                  <td>{t.capacidades||"—"}</td>
                  <td>{t.tarifas||"—"}</td>
                  <td>
                    <div className="mmpp-actions">
                      <button className="mmpp-ghostbtn" onClick={function(){ openEdit(t); }}>✏️ Editar</button>
                      <button className="mmpp-ghostbtn mmpp-danger" onClick={function(){ borrar(t); }}>🗑️ Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="modalBG" onClick={closeModal}>
          <div className="modal" onClick={function(e){ e.stopPropagation(); }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{margin:0,fontWeight:800}}>{modal.id?"Editar transportista":"Nuevo transportista"}</h3>
              <button className="mmpp-ghostbtn" onClick={closeModal}>✕</button>
            </div>

            <div className="mmpp-card" style={{marginTop:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <input className="mmpp-input" placeholder="Nombre" value={modal.nombre} onChange={function(e){ setModal(Object.assign({},modal,{nombre:e.target.value})); }} />
                <input className="mmpp-input" placeholder="RUT" value={modal.rut} onChange={function(e){ setModal(Object.assign({},modal,{rut:e.target.value})); }} />
                <input className="mmpp-input" placeholder="Contacto (nombre)" value={modal.contactoNombre} onChange={function(e){ setModal(Object.assign({},modal,{contactoNombre:e.target.value})); }} />
                <input className="mmpp-input" placeholder="Contacto (teléfono)" value={modal.contactoTelefono} onChange={function(e){ setModal(Object.assign({},modal,{contactoTelefono:e.target.value})); }} />
                <input className="mmpp-input" placeholder="Área de operación" value={modal.area} onChange={function(e){ setModal(Object.assign({},modal,{area:e.target.value})); }} />
                <input className="mmpp-input" placeholder="Capacidades (texto libre)" value={modal.capacidades} onChange={function(e){ setModal(Object.assign({},modal,{capacidades:e.target.value})); }} />
              </div>
              <div style={{marginTop:10}}>
                <textarea className="mmpp-input" style={{height:90,paddingTop:10}} placeholder="Tarifas / notas" value={modal.tarifas} onChange={function(e){ setModal(Object.assign({},modal,{tarifas:e.target.value})); }} />
              </div>
              <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="mmpp-ghostbtn" onClick={closeModal}>Cancelar</button>
                <button className="mmpp-ghostbtn" style={{background:'#4f46e5',color:'#fff',borderColor:'#4f46e5'}} onClick={saveModal}>💾 Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Montaje (sidebar ya lo monta nav.jsx en #mmppNavMount) */
var mountNode = document.getElementById("root");
ReactDOM.createRoot(mountNode).render(<TransportistasApp />);
