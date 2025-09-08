// /spa-mmpp/mmpp-inventario.jsx  (UI similar a Nerd.lat)
const { useEffect, useMemo, useState } = React;

function cssInject(){
  const css = `
  .mmpp-wrap{max-width:1200px;margin:0 auto}
  .mmpp-hero{background:linear-gradient(180deg,#f3f6ff,transparent); border:1px solid #e5e7eb; border-radius:20px; padding:28px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 10px 30px rgba(17,24,39,.06)}
  .mmpp-hero h1{margin:0;font-weight:800;color:#2b3440}
  .mmpp-hero p{margin:4px 0 0;color:#6b7280;font-weight:600}
  .mmpp-badge{background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:10px 16px; border-radius:14px; font-weight:700; display:inline-flex; align-items:center; gap:10px}
  .mmpp-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}
  .mmpp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .mmpp-input{height:48px;border:1px solid #e5e7eb;border-radius:14px;padding:0 14px;background:#fafafa}
  .mmpp-button{height:54px;border-radius:18px;border:0;background:linear-gradient(90deg,#4f46e5,#9333ea);color:#fff;font-weight:800;font-size:18px;box-shadow:0 8px 20px rgba(79,70,229,.25); cursor:pointer}
  .mmpp-add{background:#eef2ff;color:#1e40af;border:1px solid #c7d2fe;height:44px;border-radius:12px;font-weight:800}
  .mmpp-empty{background:#fff;border:1px dashed #e5e7eb; border-radius:20px; padding:40px; text-align:center; color:#6b7280}
  .mmpp-kpis{display:flex; gap:12px; flex-wrap:wrap}
  .mmpp-kpi{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font-weight:800}
  table.mmpp{width:100%; border-collapse:separate; border-spacing:0 8px}
  table.mmpp th, table.mmpp td{padding:12px 10px}
  table.mmpp tr{background:#fff; border:1px solid #e5e7eb}
  `;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

function numeroCL(n){ return (Number(n)||0).toLocaleString('es-CL'); }

function AbastecimientoMMPP(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const [form,setForm]=useState({
    proveedor:'', comuna:'', centroCodigo:'', areaCodigo:'', contacto:'',
    disponibilidades:[{tons:'', fecha:''}]
  });

  useEffect(function(){ cssInject(); },[]);

  async function load(){
    try{
      setLoading(true);
      const arr = await MMppApi.getDisponibilidades();
      setRows(arr);
    }catch(e){ console.error(e); setRows([]); }
    finally{ setLoading(false); }
  }
  useEffect(function(){ load(); },[]);

  function addDisp(){ setForm(function(f){ return Object.assign({}, f, {disponibilidades: f.disponibilidades.concat([{tons:'', fecha:''}])}); }); }
  function updDisp(i, key, val){
    setForm(function(f){
      var next = f.disponibilidades.slice();
      next[i] = Object.assign({}, next[i], (key==='tons'? {tons:val}:{fecha:val}));
      return Object.assign({}, f, {disponibilidades: next});
    });
  }
  function upd(key, val){ setForm(function(f){ var o={}; o[key]=val; return Object.assign({}, f, o); }); }

  async function submit(e){
    e.preventDefault();
    // payload tentativa (ajustar a tu backend si es distinto)
    var payload = {
      proveedor: form.proveedor,
      comuna: form.comuna,
      centroCodigo: form.centroCodigo,
      areaCodigo: form.areaCodigo,
      contacto: form.contacto,
      disponibilidades: form.disponibilidades
        .filter(function(x){return x.tons && x.fecha;})
        .map(function(x){ return { tons: Number(x.tons)||0, fecha: x.fecha }; }),
      fuente: 'Formulario'
    };
    if(!payload.proveedor || payload.disponibilidades.length===0){
      alert('Proveedor y al menos una disponibilidad son obligatorios'); return;
    }
    try{
      setLoading(true);
      await MMppApi.crearDisponibilidad(payload);
      setForm({ proveedor:'', comuna:'', centroCodigo:'', areaCodigo:'', contacto:'', disponibilidades:[{tons:'', fecha:''}] });
      await load();
      alert('Registro guardado ✔');
    }catch(err){
      console.error(err);
      alert('No se pudo guardar la disponibilidad. Revisa el backend (/planificacion/ofertas).');
    }finally{
      setLoading(false);
    }
  }

  const kpi = useMemo(function(){
    var total = rows.reduce(function(a,r){ return a + (Number(r.tons)||0); },0);
    var saldo = rows.reduce(function(a,r){ return a + (Number(r.saldo!=null ? r.saldo : r.tons)||0); },0);
    return { total: total, saldo: saldo, asignado: total - saldo };
  },[rows]);

  const porMes = useMemo(function(){
    var m = {};
    rows.forEach(function(r){ var k = r.mesKey || '—'; m[k] = (m[k]||0) + (Number(r.saldo!=null ? r.saldo : r.tons)||0); });
    return Object.entries(m).sort();
  },[rows]);

  return (
    <div className="mmpp-wrap">
      <div className="mmpp-hero">
        <div>
          <h1>Abastecimiento MMPP</h1>
          <p>Tu almacén virtual, siempre al día</p>
        </div>
        <div className="mmpp-badge">▦ Panel de Control</div>
      </div>

      <div style={{height:18}}/>

      <form onSubmit={submit} className="mmpp-card">
        <h2 style={{margin:'0 0 14px', fontWeight:800}}>Registrar Nueva Materia Prima</h2>
        <div className="mmpp-grid">
          <input className="mmpp-input" placeholder="Proveedor (Obligatorio)" value={form.proveedor} onChange={function(e){upd('proveedor', e.target.value);}}/>
          <input className="mmpp-input" placeholder="Comuna (Obligatorio)" value={form.comuna} onChange={function(e){upd('comuna', e.target.value);}}/>
          <input className="mmpp-input" placeholder="Código Centro (Opcional)" value={form.centroCodigo} onChange={function(e){upd('centroCodigo', e.target.value);}}/>
          <input className="mmpp-input" placeholder="Código Área (Opcional)" value={form.areaCodigo} onChange={function(e){upd('areaCodigo', e.target.value);}}/>
          <input className="mmpp-input" placeholder="Contacto (Opcional)" value={form.contacto} onChange={function(e){upd('contacto', e.target.value);}}/>
          <span></span>
        </div>

        <div style={{marginTop:16, fontWeight:800}}>Disponibilidad (Cantidad y Fecha)</div>
        <div className="mmpp-grid">
          {form.disponibilidades.map(function(d,i){
            return (
              <React.Fragment key={i}>
                <input className="mmpp-input" type="number" placeholder="Cantidad (tons) (Obligatorio)" value={d.tons} onChange={function(e){updDisp(i,'tons',e.target.value);}}/>
                <input className="mmpp-input" type="date" placeholder="dd-mm-aaaa" value={d.fecha} onChange={function(e){updDisp(i,'fecha',e.target.value);}}/>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{marginTop:10}}>
          <button type="button" className="mmpp-add" onClick={addDisp}>+ Agregar Otra Disponibilidad</button>
        </div>

        <div style={{marginTop:16}}>
          <button disabled={loading} className="mmpp-button" type="submit">{loading? 'Guardando…' : '+ Registrar Materia Prima'}</button>
        </div>
      </form>

      <div style={{height:18}}/>

      <div className="mmpp-card">
        <div className="mmpp-kpis">
          <div className="mmpp-kpi"><small>Total disponible</small> {numeroCL(kpi.total)} t</div>
          <div className="mmpp-kpi"><small>Asignado</small> {numeroCL(kpi.asignado)} t</div>
          <div className="mmpp-kpi"><small>Saldo</small> {numeroCL(kpi.saldo)} t</div>
        </div>

        <div style={{height:12}}/>

        {rows.length === 0 ? (
          <div className="mmpp-empty">
            <div style={{fontSize:26, fontWeight:800, color:'#111827'}}>¡Tu almacén está vacío!</div>
            <div>Agrega tu primera entrada de materia prima para empezar a gestionar.</div>
          </div>
        ) : (
          <table className="mmpp">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Mes</th>
                <th style={{textAlign:'right'}}>Tons</th>
                <th style={{textAlign:'right'}}>Saldo</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(function(r){
                return (
                  <tr key={r.id || (r.proveedorNombre+'-'+r.mesKey)}>
                    <td style={{padding:'12px 10px'}}><strong>{r.proveedorNombre}</strong></td>
                    <td style={{padding:'12px 10px'}}>{r.mesKey || '—'}</td>
                    <td style={{padding:'12px 10px', textAlign:'right'}}>{numeroCL(r.tons)} t</td>
                    <td style={{padding:'12px 10px', textAlign:'right'}}>{numeroCL(r.saldo!=null ? r.saldo : r.tons)} t</td>
                    <td style={{padding:'12px 10px'}}>{r.tipo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{height:18}}/>

      <div className="mmpp-card">
        <div className="mmpp-empty">
          <div style={{fontSize:26, fontWeight:800, color:'#111827'}}>¡Historial de asignaciones vacío!</div>
          <div>Realiza algunas asignaciones para verlas aquí.</div>
        </div>
      </div>
    </div>
  );
}

const mountNode = document.getElementById('root');
ReactDOM.createRoot(mountNode).render(<AbastecimientoMMPP/>);
