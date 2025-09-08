// /spa-mmpp/mmpp-inventario.jsx
const { useEffect, useMemo, useState } = React;

const UI = {
  border:"#e5e7eb", panel:"#ffffff", soft:"#6b7280",
  shadow:"0 10px 30px rgba(17,24,39,.06)"
};
const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const fmt = (n)=> (Number(n)||0).toLocaleString('es-CL');

function useMesCursor(base = new Date()){
  const [c,setC] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const mesKey = `${c.y}-${String(c.m+1).padStart(2,'0')}`;
  const prev = ()=> setC(v => v.m===0? {y:v.y-1,m:11}:{y:v.y,m:v.m-1});
  const next = ()=> setC(v => v.m===11?{y:v.y+1,m:0}:{y:v.y,m:v.m+1});
  return { c, mesKey, prev, next };
}

function InventoryMMPPStandalone(){
  const { c, mesKey, prev, next } = useMesCursor();
  const [loading,setLoading]=useState(false);
  const [rows,setRows]=useState([]);
  const [kpi,setKpi]=useState(null);
  const [qProv,setQProv]=useState('');
  const [tipo,setTipo]=useState('');
  const empty = { _id:null, proveedorKey:'', proveedorNombre:'', mesKey, tons:'', tipo:'normal', notas:'' };
  const [form,setForm]=useState(empty);
  const [show,setShow]=useState(false);

  async function load(){
    try{
      setLoading(true);
      const [disp,res]=await Promise.all([
        MMppApi.getDisponibilidades({mesKey}),
        MMppApi.getResumenMensual({mesKey})
      ]);
      setRows(Array.isArray(disp)?disp:[]);
      setKpi(res||null);
    }catch(e){
      console.error(e); setRows([]); setKpi(null);
    }finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); },[mesKey]);

  const filtered = useMemo(()=> rows.filter(r =>
    (!qProv || (r.proveedorNombre||r.proveedorKey||'').toLowerCase().includes(qProv.toLowerCase())) &&
    (!tipo || (r.tipo||'').toLowerCase()===tipo.toLowerCase())
  ),[rows,qProv,tipo]);

  const totalDisp = useMemo(()=> kpi?.totalDisponible ?? filtered.reduce((a,r)=>a+(Number(r.tons)||0),0),[filtered,kpi]);
  const totalAsig = kpi?.totalAsignado ?? 0;
  const totalSaldo= kpi?.saldo ?? filtered.reduce((a,r)=>a+(Number(r.saldo ?? r.tons)||0),0);

  const openNew = ()=>{ setForm({...empty, mesKey}); setShow(true); };
  const openEdit= (r)=>{ setForm({...r}); setShow(true); };
  const close   = ()=>{ setShow(false); setForm({...empty, mesKey}); };

  async function save(){
    const payload = {
      proveedorKey: form.proveedorKey?.trim(),
      proveedorNombre: form.proveedorNombre?.trim(),
      mesKey: form.mesKey || mesKey,
      tons: Number(form.tons)||0,
      tipo: form.tipo || 'normal',
      notas: form.notas || ''
    };
    if(!payload.proveedorKey || !payload.mesKey || !payload.tons){
      alert('Completa proveedorKey, mes y tons'); return;
    }
    try{
      setLoading(true);
      if(form._id) await MMppApi.editarDisponibilidad(form._id, payload);
      else         await MMppApi.crearDisponibilidad(payload);
      close(); await load();
    }catch(e){ console.error(e); alert('No se pudo guardar'); }
    finally{ setLoading(false); }
  }

  async function remove(id){
    if(!confirm('¿Eliminar este lote?')) return;
    try{
      setLoading(true);
      await MMppApi.borrarDisponibilidad(id);
      await load();
    }catch(e){ console.error(e); alert('No se pudo eliminar'); }
    finally{ setLoading(false); }
  }

  return (
    <div className="card" style={{background:UI.panel, border:`1px solid ${UI.border}`, borderRadius:14, boxShadow:UI.shadow}}>
      <div className="pad" style={{display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:12}}>
        <div>
          <button className="btn" onClick={prev}>←</button>
          <button className="btn" onClick={next} style={{marginLeft:8}}>→</button>
        </div>
        <div style={{justifySelf:'center', fontWeight:800}}>{meses[c.m]} de {c.y}</div>
        <div style={{justifySelf:'end'}}>
          <button className="btn alt" onClick={openNew}>+ Nueva disponibilidad</button>
        </div>
      </div>

      <div className="pad">
        <div style={{display:'flex', gap:10, flexWrap:'wrap', marginBottom:12}}>
          <div className="kpi"><small>Disponible</small>{fmt(totalDisp)} t</div>
          <div className="kpi"><small>Asignado</small>{fmt(totalAsig)} t</div>
          <div className="kpi"><small>Saldo</small>{fmt(totalSaldo)} t</div>
          {loading && <div className="kpi"><small>Estado</small>Cargando…</div>}
        </div>

        <div style={{display:'flex', gap:8, flexWrap:'wrap', margin:'8px 0 12px'}}>
          <input className="input" placeholder="Filtrar por proveedor…" value={qProv} onChange={e=>setQProv(e.target.value)}/>
          <select className="select" value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="normal">Normal</option>
            <option value="bap">BAP</option>
          </select>
        </div>

        <table style={{width:'100%', borderCollapse:'separate', borderSpacing:'0 8px'}}>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Mes</th>
              <th style={{textAlign:'right'}}>Tons</th>
              <th style={{textAlign:'right'}}>Saldo</th>
              <th>Tipo</th>
              <th>Notas</th>
              <th style={{textAlign:'right'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r._id} style={{background:UI.panel, border:`1px solid ${UI.border}`}}>
                <td style={{padding:'12px 10px'}}><strong>{r.proveedorNombre || r.proveedorKey}</strong></td>
                <td style={{padding:'12px 10px'}}>{r.mesKey}</td>
                <td style={{padding:'12px 10px', textAlign:'right'}}>{fmt(r.tons)} t</td>
                <td style={{padding:'12px 10px', textAlign:'right'}}>{fmt(r.saldo ?? r.tons)} t</td>
                <td style={{padding:'12px 10px'}}>{r.tipo || 'normal'}</td>
                <td style={{padding:'12px 10px'}}>{r.notas || '—'}</td>
                <td style={{padding:'12px 10px', textAlign:'right'}}>
                  <button className="btn" onClick={()=>openEdit(r)}>Editar</button>
                  <button className="btn" onClick={()=>remove(r._id)} style={{marginLeft:6,background:'#fee2e2',borderColor:'#fecaca',color:'#991b1b'}}>Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan="7" style={{color:UI.soft, padding:'12px 10px'}}>Sin registros en {mesKey}…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modalBG">
          <div className="modal">
            <div style={{fontWeight:800, marginBottom:10}}>{form._id? 'Editar disponibilidad':'Nueva disponibilidad'}</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <input className="input" placeholder="Proveedor (key)" value={form.proveedorKey} onChange={e=>setForm({...form, proveedorKey:e.target.value})}/>
              <input className="input" placeholder="Proveedor (nombre)" value={form.proveedorNombre||''} onChange={e=>setForm({...form, proveedorNombre:e.target.value})}/>
              <input className="input" placeholder="Mes (YYYY-MM)" value={form.mesKey} onChange={e=>setForm({...form, mesKey:e.target.value})}/>
              <input className="input" type="number" placeholder="Toneladas" value={form.tons} onChange={e=>setForm({...form, tons:e.target.value})}/>
              <select className="select" value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})}>
                <option value="normal">Normal</option>
                <option value="bap">BAP</option>
              </select>
              <input className="input" placeholder="Notas" value={form.notas||''} onChange={e=>setForm({...form, notas:e.target.value})}/>
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:10}}>
              <button className="btn" onClick={()=>setShow(false)}>Cancelar</button>
              <button className="btn" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Montaje
const mountNode = document.getElementById('root');
ReactDOM.createRoot(mountNode).render(<InventoryMMPPStandalone/>);
