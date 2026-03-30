import React, { useEffect, useMemo, useState } from "react";
import { getSaldos } from "../../api/api-mmpp";
import { BarChart3, TrendingUp, AlertCircle } from "lucide-react";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Custom Zero-Dependency Mini Chart
function SimpleBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.disponible, d.asignado)), 1);
  
  return (
    <div className="flex items-end gap-2 h-48 w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
      {data.map((d, i) => {
        const hD = (d.disponible / maxVal) * 100;
        const hA = (d.asignado / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="flex gap-1 items-end h-32 w-full justify-center">
              <div 
                className="w-2 md:w-4 bg-indigo-500 rounded-t-sm transition-all hover:brightness-110" 
                style={{ height: `${hD}%` }}
                title={`Disponible: ${d.disponible}`}
              />
              <div 
                className="w-2 md:w-4 bg-purple-500 rounded-t-sm transition-all hover:brightness-110" 
                style={{ height: `${hA}%` }}
                title={`Asignado: ${d.asignado}`}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-2">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BalanceMMPP() {
  const y0 = new Date().getFullYear();
  const [anio, setAnio] = useState(y0);
  const [proveedorKeySel, setProveedorKeySel] = useState("Todos");
  const [tableGroupMode, setTableGroupMode] = useState("prov");
  const [mesFrom, setMesFrom] = useState(1);
  const [mesTo, setMesTo] = useState(12);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const items = await getSaldos({ anio });
        if (!alive) return;
        setRows(Array.isArray(items) ? items : []);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Error cargando saldos");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [anio]);

  // Logic extracted and modernized from original mmpp-balance.jsx
  const num = (v) => { var n = Number(v); return isFinite(n) ? n : 0; };
  const fmtTons = (v) => num(v).toLocaleString("es-CL", { maximumFractionDigits: 1 });

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const mk = String(r.mesKey || "");
      if (!mk.startsWith(String(anio))) return false;
      const m = parseInt(mk.split("-")[1], 10);
      if (m < mesFrom || m > mesTo) return false;
      return true;
    });
  }, [rows, anio, mesFrom, mesTo]);

  const totals = useMemo(() => {
    let d = 0, a = 0;
    filteredRows.forEach(r => { d += num(r.disponible); a += num(r.asignado); });
    return { d, a, s: d - a, p: d > 0 ? (a / d * 100) : 0 };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    const monthly = {};
    filteredRows.forEach(r => {
      const m = parseInt(r.mesKey.split("-")[1], 10);
      if (!monthly[m]) monthly[m] = { label: MESES[m-1].substring(0,3), disponible: 0, asignado: 0 };
      monthly[m].disponible += num(r.disponible);
      monthly[m].asignado += num(r.asignado);
    });
    return Object.values(monthly);
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-500 ml-1">Año</label>
          <select 
            value={anio} 
            onChange={e => setAnio(parseInt(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            {[y0-1, y0, y0+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {/* Additional filters would go here */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Disponible" value={`${fmtTons(totals.d)} t`} icon={BarChart3} color="indigo" />
        <KPICard label="Asignado" value={`${fmtTons(totals.a)} t`} icon={TrendingUp} color="purple" />
        <KPICard label="Saldo" value={`${fmtTons(totals.s)} t`} icon={AlertCircle} color="emerald" />
        <KPICard label="Cumplimiento" value={`${totals.p.toFixed(1)}%`} icon={BarChart3} color="amber" />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Tendencia Mensual
          </h3>
          <SimpleBarChart data={chartData} />
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Detalle de Saldos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-500 px-2">Proveedor</th>
                <th className="pb-4 font-bold text-slate-500 px-2 text-right">Disponible (t)</th>
                <th className="pb-4 font-bold text-slate-500 px-2 text-right">Asignado (t)</th>
                <th className="pb-4 font-bold text-slate-500 px-2 text-right">Saldo (t)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-2 font-medium">{r.proveedorNombre || "—"}</td>
                  <td className="py-4 px-2 text-right">{fmtTons(r.disponible)}</td>
                  <td className="py-4 px-2 text-right text-indigo-600 font-semibold">{fmtTons(r.asignado)}</td>
                  <td className="py-4 px-2 text-right text-slate-500">{fmtTons(num(r.disponible) - num(r.asignado))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, color, icon: Icon }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex flex-col gap-3 ${colors[color] || colors.indigo}`}>
      <div className="flex justify-between items-start">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
        {Icon && <Icon className="w-5 h-5 opacity-60" />}
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
