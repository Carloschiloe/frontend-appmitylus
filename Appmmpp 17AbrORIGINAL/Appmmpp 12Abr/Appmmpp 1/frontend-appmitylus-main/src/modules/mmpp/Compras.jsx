import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { listOportunidades, cambiarEstado, cerrarPerdido } from '../../api/api-oportunidades.js';
import { RefreshCw, Search, X, ChevronRight, AlertCircle } from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────

const COLS = [
  { key: 'disponible',   label: 'Disponible',    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { key: 'semi_acordado',label: 'Semi-acordado', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  { key: 'acordado',     label: 'Acordado',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { key: 'perdido',      label: 'No concretado', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { key: 'descartado',   label: 'Descartado',    color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
];

const TRANSITIONS = {
  disponible:    ['semi_acordado', 'perdido', 'descartado'],
  semi_acordado: ['acordado', 'perdido', 'descartado'],
  acordado:      [],
  perdido:      [],
  descartado:   [],
};

const MOTIVOS = [
  { value: 'precio_no_competitivo', label: 'Precio no competitivo' },
  { value: 'sin_biomasa',           label: 'Sin biomasa' },
  { value: 'competencia',           label: 'Competencia' },
  { value: 'calidad_insuficiente',  label: 'Calidad insuficiente' },
  { value: 'logistica',             label: 'Logistica' },
  { value: 'sin_respuesta',         label: 'Sin respuesta' },
  { value: 'otros',                 label: 'Otros' },
];

const COL_MAP = Object.fromEntries(COLS.map(c => [c.key, c]));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)  return `Hace ${days} dias`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return `Hace ${Math.floor(days / 30)} mes.`;
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START': return { ...state, loading: true, error: null };
    case 'LOAD_OK':    return { ...state, loading: false, items: action.items };
    case 'LOAD_ERR':   return { ...state, loading: false, error: action.error };
    case 'SET_QUERY':  return { ...state, query: action.query };
    case 'MOVE_ITEM':  return { ...state, items: state.items.map(it => it._id === action.id ? { ...it, estado: action.estado } : it) };
    default: return state;
  }
}

// ─── Modal motivo (no concretado / descartado) ────────────────────────────────

function MotivoModal({ open, onClose, onConfirm, targetEstado }) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  useEffect(() => { if (open) { setMotivo(''); setObs(''); setErr(''); } }, [open]);
  if (!open) return null;

  const col = COL_MAP[targetEstado] || {};

  async function handleSubmit(e) {
    e.preventDefault();
    if (!motivo) { setErr('Selecciona un motivo'); return; }
    setBusy(true);
    try { await onConfirm(motivo, obs, targetEstado); onClose(); }
    catch (ex) { setErr(ex.message || 'Error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">
            Marcar como <span style={{ color: col.color }}>{col.label}</span>
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo *</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm">
              <option value="">Seleccionar...</option>
              {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observacion (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm resize-none"
              placeholder="Notas adicionales..." />
          </div>
          {err && <div className="flex items-center gap-2 text-red-600 text-xs"><AlertCircle className="w-4 h-4" />{err}</div>}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: col.color }}>
              {busy ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de proveedor ─────────────────────────────────────────────────────

function TarjetaProveedor({ item, onMove }) {
  const col = COL_MAP[item.estado] || COLS[0];
  const transitions = TRANSITIONS[item.estado] || [];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e) { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: col.border }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">{item.proveedorNombre || item.proveedorKey}</p>
          {item.centroCodigo && <p className="text-xs text-slate-400 font-mono mt-0.5">{item.centroCodigo}</p>}
        </div>
        {item.biomasaEstimacion != null && (
          <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
            {Number(item.biomasaEstimacion).toLocaleString('es-CL')} {item.biomasaUnidad || 'ton'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span className="truncate">{item.responsableNombre || '—'}</span>
        <span className="flex-shrink-0 ml-2">{relativeDate(item.ultimaActividadAt)}</span>
      </div>

      {transitions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg w-full justify-center border transition-colors"
            style={{ background: menuOpen ? col.bg : '#f8fafc', borderColor: menuOpen ? col.border : '#e2e8f0', color: menuOpen ? col.text : '#64748b' }}>
            Cambiar estado <ChevronRight className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {transitions.map(t => {
                const tc = COL_MAP[t];
                return (
                  <button key={t} onClick={() => { setMenuOpen(false); onMove(item, t); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                    {tc.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Columna del tablero ──────────────────────────────────────────────────────

function Columna({ col, items, onMove }) {
  const totalTons = items.reduce((s, it) => s + (it.biomasaEstimacion || 0), 0);

  return (
    <div className="flex flex-col min-w-[210px] max-w-[250px] flex-1">
      <div className="rounded-xl px-4 py-3 mb-3 flex items-center justify-between"
        style={{ background: col.bg, border: `1px solid ${col.border}` }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
          <span className="font-bold text-sm" style={{ color: col.text }}>{col.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {totalTons > 0 && (
            <span className="text-xs font-semibold" style={{ color: col.text }}>
              {totalTons.toLocaleString('es-CL')} ton
            </span>
          )}
          <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: col.color, color: '#fff' }}>
            {items.length}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
            Sin proveedores
          </div>
        ) : items.map(item => (
          <TarjetaProveedor key={item._id} item={item} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Compras() {
  const [state, dispatch] = useReducer(reducer, { loading: true, error: null, items: [], query: '' });
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const items = await listOportunidades();
      dispatch({ type: 'LOAD_OK', items });
    } catch (err) {
      dispatch({ type: 'LOAD_ERR', error: err.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = state.query.trim();
  const visible = q.length < 2 ? state.items : state.items.filter(it =>
    norm(it.proveedorNombre).includes(norm(q)) ||
    norm(it.proveedorKey).includes(norm(q)) ||
    norm(it.centroCodigo).includes(norm(q)) ||
    norm(it.responsableNombre).includes(norm(q))
  );

  const byCol = Object.fromEntries(COLS.map(c => [c.key, []]));
  for (const item of visible) {
    if (byCol[item.estado]) byCol[item.estado].push(item);
  }

  const activos  = state.items.filter(i => ['disponible', 'semi_acordado'].includes(i.estado)).length;
  const acordados = state.items.filter(i => i.estado === 'acordado').length;
  const tonsAct  = state.items.filter(i => ['disponible', 'semi_acordado'].includes(i.estado))
    .reduce((s, i) => s + (i.biomasaEstimacion || 0), 0);

  function handleMove(item, targetEstado) {
    if (targetEstado === 'perdido' || targetEstado === 'descartado') {
      setModal({ item, targetEstado });
    } else {
      executeMove(item._id, targetEstado);
    }
  }

  async function executeMove(id, estado, obs = '') {
    try {
      await cambiarEstado(id, estado, obs);
      dispatch({ type: 'MOVE_ITEM', id, estado });
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    }
  }

  async function handleMotivoConfirm(motivo, obs, targetEstado) {
    await cerrarPerdido(modal.item._id, motivo, obs, targetEstado);
    dispatch({ type: 'MOVE_ITEM', id: modal.item._id, estado: targetEstado });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Compras de Biomasa</h2>
          <p className="text-sm text-slate-500 mt-0.5">Estado de negociacion con cada proveedor</p>
        </div>
        <button onClick={load} disabled={state.loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'En gestion',    value: activos,                              sub: 'disponible + semi-acordado' },
          { label: 'Acordados',     value: acordados,                            sub: 'acordados' },
          { label: 'Tons en juego', value: tonsAct.toLocaleString('es-CL'),      sub: 'estimadas activos' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">{k.label}</p>
            <p className="text-2xl font-black text-slate-900">{k.value}</p>
            <p className="text-xs text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={state.query} onChange={e => dispatch({ type: 'SET_QUERY', query: e.target.value })}
          placeholder="Buscar proveedor, centro o responsable..."
          className="w-full pl-10 pr-4 h-11 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        {state.query && (
          <button onClick={() => dispatch({ type: 'SET_QUERY', query: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {state.error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{state.error}</span>
          <button onClick={load} className="ml-auto font-semibold underline">Reintentar</button>
        </div>
      )}

      {/* Tablero */}
      {!state.error && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: `${COLS.length * 230}px` }}>
            {COLS.map(col => (
              <Columna key={col.key} col={col} items={byCol[col.key] || []} onMove={handleMove} />
            ))}
          </div>
        </div>
      )}

      {/* Skeleton carga inicial */}
      {state.loading && state.items.length === 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLS.map(col => (
            <div key={col.key} className="flex flex-col gap-2 min-w-[210px] flex-1">
              <div className="h-11 rounded-xl animate-pulse" style={{ background: col.bg }} />
              {[1, 2].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      )}

      <MotivoModal open={Boolean(modal)} targetEstado={modal?.targetEstado}
        onClose={() => setModal(null)} onConfirm={handleMotivoConfirm} />
    </div>
  );
}
