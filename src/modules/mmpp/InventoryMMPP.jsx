// src/modules/mmpp/InventoryMMPP.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getDisponibilidades,
  crearDisponibilidad,
  editarDisponibilidad,
  borrarDisponibilidad,
  getResumenMensual,
} from "../../api/api-mmpp";

const UI = { border:"#e5e7eb", panel:"#ffffff", textSoft:"#6b7280", radius:14, shadow:"0 10px 30px rgba(17,24,39,.06)" };
const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function useMesCursor(baseDate = new Date()) {
  const [cursor, setCursor] = useState({ y: baseDate.getFullYear(), m: baseDate.getMonth() });
  const mesKey = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const goPrev = () => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const goNext = () => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 });
  return { cursor, mesKey, goPrev, goNext };
}

export default function InventoryMMPP() {
  const { cursor, mesKey, goPrev, goNext } = useMesCursor();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [qProv, setQProv] = useState("");
  const [tipo, setTipo] = useState("");

  const emptyForm = { _id:null, proveedorKey:"", proveedorNombre:"", mesKey, tons:"", tipo:"normal", notas:"" };
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const editMode = !!form._id;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [disp, kpi] = await Promise.all([ getDisponibilidades({ mesKey }), getResumenMensual({ mesKey }) ]);
        if (!alive) return;
        setRows(Array.isArray(disp) ? disp : []);
        setResumen(kpi || null);
      } catch (e) {
        console.error(e);
        setRows([]); setResumen(null);
      } finally { setLoading(false); }
    })();
    return () => { alive = false; };
  }, [mesKey]);

  const filtered = useMemo(() => {
    return rows.filter(r =>
      (!qProv || (r.proveedorNombre || r.proveedorKey || "").toLowerCase().includes(qProv.toLowerCase())) &&
      (!tipo || (r.tipo || "").toLowerCase() === tipo.toLowerCase())
    );
  }, [rows, qProv, tipo]);

  const totalDisponible = useMemo(() => (resumen?.totalDisponible ?? filtered.reduce((a, r) => a + (Number(r.tons) || 0), 0)), [filtered, resumen]);
  const totalAsignado = resumen?.totalAsignado ?? 0;
  const totalSaldo     = resumen?.saldo ?? filtered.reduce((a, r) => a + (Number(r.saldo ?? r.tons) || 0), 0);

  const openCreate = () => { setForm({ ...emptyForm, mesKey }); setShowModal(true); };
  const openEdit   = (lot) => { setForm({ ...lot }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setForm({ ...emptyForm, mesKey }); };

  const save = async () => {
    const payload = {
      proveedorKey: form.proveedorKey?.trim(),
      proveedorNombre: form.proveedorNombre?.trim(),
      mesKey: form.mesKey || mesKey,
      tons: Number(form.tons) || 0,
      tipo: form.tipo || "normal",
      notas: form.notas || "",
    };
    if (!payload.mesKey || !payload.tons || !payload.proveedorKey) {
      alert("Completa proveedorKey, mes y tons"); return;
    }
    try {
      setLoading(true);
      if (editMode) await editarDisponibilidad(form._id, payload);
      else          await crearDisponibilidad(payload);
      closeModal();
      const [disp, kpi] = await Promise.all([ getDisponibilidades({ mesKey }), getResumenMensual({ mesKey }) ]);
      setRows(Array.isArray(disp) ? disp : []); setResumen(kpi || null);
    } catch (e) {
      console.error(e); alert("No se pudo guardar la disponibilidad");
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este lote de disponibilidad?")) return;
    try {
      setLoading(true); await borrarDisponibilidad(id);
      const [disp, kpi] = await Promise.all([ getDisponibilidades({ mesKey }), getResumenMensual({ mesKey }) ]);
      setRows(Array.isArray(disp) ? disp : []); setResumen(kpi || null);
    } catch (e) { console.error(e); alert("No se pudo eliminar"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{display:'grid', gap:16}}>
      <div className="card" style={{background:UI.panel, border:`1px solid ${UI.border}`, borderRadius:UI.radius, boxShadow:UI.shadow}}>
        <div className="pad" style={{padding:16, display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:12}}>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={goPrev} style={btnStyle}>←</button>
            <button className="btn" onClick={goNext} style={btnStyle}>→</button>
          </div>
          <div style={{justifySelf:'center', fontWeight:800}}>{meses[cursor.m]} de {cursor.y}</div>
          <div style={{justifySelf:'end'}}>
            <button className="btn" onClick={openCreate} style={{...btnStyle, background:'#eef2ff', borderColor:'#c7d2fe', color:'#1e40af'}}>+ Nueva disponibilidad</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle   = { height:34, padding:'0 12px', border:'1px solid #e5e7eb', borderRadius:10, background:'#f3f4f6', cursor:'pointer' };
const inputStyle = { height:36, padding:'0 10px', border:'1px solid #e5e7eb', borderRadius:10, background:'#fff' };
const tdStyle    = { padding:'12px 10px', borderTop:'1px solid #e5e7eb', borderBottom:'1px solid #e5e7eb' };
const miniBtn    = { ...btnStyle, height:30, padding:'0 10px', borderRadius:8 };
const modalWrap  = { position:'fixed', inset:0, background:'rgba(0,0,0,.2)', display:'grid', placeItems:'center', zIndex:50 };
const modalCard  = { width:'min(720px, 96vw)', background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, boxShadow:UI.shadow, padding:16 };

function KPI({ label, value }) {
  return (
    <div style={{background:'#f3f4f6', border:`1px solid ${UI.border}`, borderRadius:10, padding:'8px 10px', fontWeight:700}}>
      <div style={{fontSize:12, color:UI.textSoft, fontWeight:600}}>{label}</div>
      {value}
    </div>
  );
}
function fmtNum(n){ const v=Number(n)||0; return v.toLocaleString('es-CL'); }
