import React, { useEffect, useMemo, useState } from "react";
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  X
} from "lucide-react";
import {
  getDisponibilidades,
  crearDisponibilidad,
  editarDisponibilidad,
  borrarDisponibilidad,
  getResumenMensual,
} from "../../api/api-mmpp";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function InventoryMMPP() {
  const [cursor, setCursor] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const mesKey = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [qProv, setQProv] = useState("");
  const [tipo, setTipo] = useState("");

  const emptyForm = { _id:null, proveedorKey:"", proveedorNombre:"", mesKey, tons:"", tipo:"normal", notas:"" };
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [mesKey]);

  async function fetchData() {
    try {
      setLoading(true);
      const [disp, kpi] = await Promise.all([ 
        getDisponibilidades({ mesKey }), 
        getResumenMensual({ mesKey }) 
      ]);
      setRows(Array.isArray(disp) ? disp : []);
      setResumen(kpi || null);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r =>
      (!qProv || (r.proveedorNombre || r.proveedorKey || "").toLowerCase().includes(qProv.toLowerCase())) &&
      (!tipo || (r.tipo || "").toLowerCase() === tipo.toLowerCase())
    );
  }, [rows, qProv, tipo]);

  const goPrev = () => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const goNext = () => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 });

  const handleSave = async () => {
    if (!form.proveedorKey || !form.tons) return alert("Faltan datos obligatorios");
    try {
      setLoading(true);
      if (form._id) {
        await editarDisponibilidad(form._id, form);
      } else {
        await crearDisponibilidad(form);
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este lote?")) return;
    try {
      setLoading(true);
      await borrarDisponibilidad(id);
      fetchData();
    } catch (e) {
      alert("Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Seccion</p>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-2">
          <div>
            <h3 className="text-2xl font-black text-slate-900">Inventario MMPP</h3>
            <p className="text-sm text-slate-500">Disponibilidades por proveedor y tipo para el periodo seleccionado.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Actualizado
          </div>
        </div>
      </div>
      {/* KPI Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Disponible" value={`${resumen?.totalDisponible || 0} t`} icon={Package} color="indigo" />
        <StatCard label="Asignado" value={`${resumen?.totalAsignado || 0} t`} icon={CheckCircle2} color="emerald" />
        <StatCard label="Saldo" value={`${resumen?.saldo || 0} t`} icon={Info} color="amber" />
        <StatCard label="Lotes Activos" value={rows.length} icon={Filter} color="slate" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="p-2 hover:bg-slate-100 rounded-xl bg-slate-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-lg font-black text-slate-900 min-w-[160px] text-center">
            {MESES[cursor.m]} {cursor.y}
          </div>
          {loading && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Actualizando</span>
          )}
          <button onClick={goNext} className="p-2 hover:bg-slate-100 rounded-xl bg-slate-50 transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar proveedor..." 
              value={qProv}
              onChange={e => setQProv(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 transition-all font-medium"
            />
          </div>
          <button 
            onClick={() => { setForm({ ...emptyForm, mesKey }); setShowModal(true); }}
            className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nuevo Lote
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Toneladas</th>
                <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-slate-400">
                    <p className="text-sm font-semibold">Cargando inventario...</p>
                  </td>
                </tr>
              )}
              {filtered.map(r => (
                <tr key={r._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{r.proveedorNombre || "Sin nombre"}</p>
                    <p className="text-xs text-slate-400 font-mono tracking-tighter uppercase">{r.proveedorKey}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      r.tipo === 'premium' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {r.tipo || 'normal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-lg">
                    {r.tons} t
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setForm(r); setShowModal(true); }} className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(r._id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No hay registros para este período</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            <div className="p-7 border-b border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Inventario</p>
                <h3 className="text-2xl font-black text-slate-900">{form._id ? "Editar" : "Nuevo"} Lote</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-7 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-tighter text-slate-400 ml-1">Key Proveedor</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-4 focus:ring-slate-200 transition-all font-bold"
                  value={form.proveedorKey}
                  onChange={e => setForm({ ...form, proveedorKey: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-tighter text-slate-400 ml-1">Toneladas</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-4 focus:ring-slate-200 transition-all font-bold text-slate-900"
                    value={form.tons}
                    onChange={e => setForm({ ...form, tons: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-tighter text-slate-400 ml-1">Tipo</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:ring-4 focus:ring-slate-200 transition-all font-bold"
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="normal">NORMAL</option>
                    <option value="premium">PREMIUM</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-7 bg-slate-50/50 flex gap-4">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-[1.5] py-4 bg-slate-900 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    indigo: "border-slate-200",
    emerald: "border-slate-200",
    amber: "border-slate-200",
    slate: "border-slate-200"
  };
  return (
    <div className={`p-6 rounded-[1.75rem] bg-white border shadow-sm transition-all ${colors[color]}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-100 rounded-xl">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      </div>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
