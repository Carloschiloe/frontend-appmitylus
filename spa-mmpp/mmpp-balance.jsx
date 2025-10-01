// src/modules/mmpp/BalanceMMPP.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getSaldos } from "../../api/api-mmpp";

const UI = { border:"#e5e7eb", panel:"#ffffff", textSoft:"#6b7280", radius:14, shadow:"0 10px 30px rgba(17,24,39,.06)" };
const mesesNombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Evitamos 'ñ' en nombres de funciones para mayor compatibilidad
function useAnio() {
  const y0 = new Date().getFullYear();
  const [anio, setAnio] = useState(y0);
  return { anio, setAnio };
}

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function fmtTons(v) {
  return num(v, 0).toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

function toMonthLabel(mesKey) {
  if (!mesKey) return "—";
  const [yRaw, mRaw] = String(mesKey).split("-");
  const y = parseInt(yRaw, 10);
  const m = Math.min(Math.max(parseInt(mRaw, 10) || 1, 1), 12);
  const nombre = mesesNombres[m - 1] || "—";
  return `${nombre} ${Number.isFinite(y) ? y : ""}`.trim();
}

function CSVButton({ rows }) {
  function toCSV(rows) {
    const head = ["Mes","Proveedor","Disponible(t)","Asignado(t)","Saldo(t)","%Asignado"];
    const lines = (rows || []).map(r => {
      const disponible = num(r.disponible, 0);
      const asignado   = num(r.asignado, 0);
      const saldo      = disponible - asignado;
      const pct        = disponible > 0 ? (asignado / disponible * 100) : 0;

      // Sanitiza comas en proveedor para no romper CSV
      const prov = String(r.proveedorNombre || "").replace(/,/g, " ");
      return [r.mesKey, prov, disponible, asignado, saldo, pct.toFixed(1)];
    });
    return [head.join(","), ...lines.map(a => a.join(","))].join("\n");
  }
  const onClick = () => {
    const blob = new Blob([toCSV(rows || [])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "balance_mmpp.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return <button className="btn" onClick={onClick}>⬇️ Exportar CSV</button>;
}

function MiniBars({ data, height = 180 }) {
  // data: [{ label, disponible, asignado }]
  const maxV = Math.max(1, ...data.map(d => Math.max(num(d.disponible), num(d.asignado))));
  const barW = 24, gap = 12;
  const groupW = barW * 2 + gap;
  const width = Math.max(gap * 2, data.length * (groupW + gap) + gap);
  const h = height, pad = 20;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${h + pad * 2}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const x0 = gap + i * (groupW + gap);
        const disp = num(d.disponible);
        const asig = num(d.asignado);
        const hDisp = disp / maxV * h;
        const hAsig = asig / maxV * h;
        return (
          <g key={i} transform={`translate(${x0},${pad})`}>
            <rect x="0" y={h - hDisp} width={barW} height={hDisp} rx="5" />
            <rect x={barW + 6} y={h - hAsig} width={barW} height={hAsig} rx="5" />
            <text x={groupW / 2 - 6} y={h + 14} textAnchor="middle" fontSize="10" fill="#6b7280">{d.label}</text>
          </g>
        );
      })}
      {/* Leyenda */}
      <g transform={`translate(${gap},${pad / 2})`}>
        <rect x="0" y="0" width="10" height="10" rx="2"/><text x="16" y="9" fontSize="11">Disponible</text>
        <rect x="110" y="0" width="10" height="10" rx="2"/><text x="126" y="9" fontSize="11">Asignado</text>
      </g>
    </svg>
  );
}

export default function BalanceMMPP() {
  const { anio, setAnio } = useAnio();
  const [proveedor, setProveedor] = useState("Todos");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");
        const data = await getSaldos({ anio });
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!cancelled) setRows(items);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Error cargando saldos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anio]);

  const proveedores = useMemo(() => {
    const set = new Set(rows.map(r => r?.proveedorNombre || ""));
    return ["Todos", ...([...set].filter(Boolean).sort())];
  }, [rows]);

  const filtered = useMemo(() => {
    let arr = rows.filter(r => String(r?.mesKey || "").startsWith(String(anio)));
    if (proveedor !== "Todos") arr = arr.filter(r => (r?.proveedorNombre || "") === proveedor);
    return arr;
  }, [rows, anio, proveedor]);

  const tableRows = useMemo(() => {
    return filtered.map(r => {
      const disponible = num(r.disponible, 0);
      const asignado   = num(r.asignado, 0);
      const saldo      = disponible - asignado;
      const pct        = disponible > 0 ? (asignado / disponible * 100) : 0;
      return { ...r, disponible, asignado, saldo, pct };
    }).sort((a,b) =>
      String(a.mesKey).localeCompare(String(b.mesKey)) ||
      String(a.proveedorNombre || "").localeCompare(String(b.proveedorNombre || ""))
    );
  }, [filtered]);

  const chartData = useMemo(() => {
    // Totales por mes para el gráfico
    const byMonth = new Map();
    for (const r of tableRows) {
      const m = String(r.mesKey);
      const acc = byMonth.get(m) || { label: m.slice(5), disponible: 0, asignado: 0 };
      acc.disponible += r.disponible;
      acc.asignado   += r.asignado;
      byMonth.set(m, acc);
    }
    return [...byMonth.entries()]
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([,v]) => v);
  }, [tableRows]);

  return (
    <div className="card pad">
      <div className="header">
        📊 <div>Balance MMPP — Disponible vs Asignado</div>
      </div>

      <div className="toolbar">
        <div className="row">
          <div className="col">
            <label>Año</label>
            <select value={anio} onChange={e => setAnio(num(e.target.value, anio))}>
              {Array.from({ length: 5 }).map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div className="col">
            <label>Proveedor</label>
            <select value={proveedor} onChange={e => setProveedor(e.target.value)}>
              {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="col" style={{ alignSelf: "flex-end" }}>
            <CSVButton rows={tableRows}/>
          </div>
        </div>
      </div>

      {error && <div className="alert error">⚠️ {String(error)}</div>}
      {loading && <div className="skeleton" style={{ height: 140, marginTop: 8 }} />}

      {!loading && !error && (
        <>
          <MiniBars data={chartData} />

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Proveedor</th>
                  <th style={{ textAlign: "right" }}>Disponible (t)</th>
                  <th style={{ textAlign: "right" }}>Asignado (t)</th>
                  <th style={{ textAlign: "right" }}>Saldo (t)</th>
                  <th style={{ textAlign: "right" }}>% Asignado</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, idx) => {
                  const warn = r.pct > 100 ? "#fee2e2" : (r.pct > 90 ? "#fffbeb" : "transparent");
                  return (
                    <tr key={`${r.mesKey}|${r.proveedorNombre || ""}|${idx}`} style={{ background: warn }}>
                      <td>{toMonthLabel(r.mesKey)}</td>
                      <td>{r.proveedorNombre || "—"}</td>
                      <td style={{ textAlign: "right" }}>{fmtTons(r.disponible)}</td>
                      <td style={{ textAlign: "right" }}>{fmtTons(r.asignado)}</td>
                      <td style={{ textAlign: "right" }}>{fmtTons(r.saldo)}</td>
                      <td style={{ textAlign: "right" }}>{r.pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr><td colSpan="6" style={{ color: UI.textSoft, padding: "20px" }}>Sin datos para el filtro seleccionado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

