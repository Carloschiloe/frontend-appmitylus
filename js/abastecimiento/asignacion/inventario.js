// js/abastecimiento/asignacion/inventario.js
import { fmt, altoDisponible } from './utilidades.js'; // <- sin etiquetaMes
import * as estado from './estado.js';

let tabla = null;

// === DEBUG helpers (deja true para ver todo) ===
const DEBUG = true;
const DBG  = (...a) => { if (DEBUG) console.log(...a); };
const DBGw = (...a) => { if (DEBUG) console.warn(...a); };
const DBGg = (t)     => { if (DEBUG) console.groupCollapsed(t); };
const DBGend = ()    => { if (DEBUG) console.groupEnd(); };

/* === Etiqueta de mes SIN usar Date (evita desfases por TZ) === */
const MES_TXT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function etiquetaMesKey(k){
  if (!k || typeof k !== 'string') return '(vacío)';
  const parts = k.split('-');
  if (parts.length < 2) return k;
  const y = parts[0];
  const m = Math.max(1, Math.min(12, parseInt(parts[1],10) || 0));
  return `${MES_TXT[m-1]} ${y}`;
}

function construirToolbar({ onAplicar }) {
  const wrap = document.getElementById('invToolbar');

  wrap.innerHTML = `
    <div class="input-field">
      <select id="inv_row">
        <option value="Mes" selected>Mes</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
        <option value="Fuente">Fuente</option>
      </select>
      <label>Fila (nivel 1)</label>
    </div>

    <div class="input-field">
      <select id="inv_sub1">
        <option value="">— Ninguna —</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor" selected>Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
      </select>
      <label>Subfila 1</label>
    </div>

    <div class="input-field">
      <select id="inv_sub2">
        <option value="">— Ninguna —</option>
        <option value="Semana">Semana</option>
        <option value="Proveedor">Proveedor</option>
        <option value="Comuna">Comuna</option>
        <option value="Centro">Centro</option>
        <option value="Área">Área</option>
      </select>
      <label>Subfila 2</label>
    </div>

    <div class="input-field">
      <select id="inv_unidad">
        <option value="tons" selected>Toneladas</option>
        <option value="trucks">Camiones (10 t)</option>
      </select>
      <label>Unidad</label>
    </div>

    <div class="right-actions"
         style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-left:auto">
      <a id="inv_apply"
         class="btn teal waves-effect"
         style="display:inline-flex;align-items:center;gap:6px">
        <i class="material-icons" style="margin:0">refresh</i>
        <span>Actualizar</span>
      </a>
      <span class="pill" id="inv_badge">0 registros</span>
    </div>
  `;

  const selectOpts = {
    dropdownOptions: {
      container: document.body,
      coverTrigger: false,
      constrainWidth: false,
      alignment: 'left',
    },
  };
  M.FormSelect.init(wrap.querySelectorAll('select'), selectOpts);

  const btn = document.getElementById('inv_apply');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAplicar();
  });
}

function ordenarClaves(dim, keys) {
  if (dim === 'Mes') return keys.sort((a, b) => String(a).localeCompare(String(b))); // YYYY-MM OK
  if (dim === 'Semana') {
    const toN = (v) => { const [y, w] = String(v).split('-'); return (+y) * 100 + (+w); };
    return keys.sort((a, b) => toN(a) - toN(b));
  }
  return keys.sort((a, b) => String(a).localeCompare(String(b)));
}

function etiquetaPara(dim, key) {
  if (dim === 'Mes')   return etiquetaMesKey(key); // <- ya NO usamos Date
  if (dim === 'Semana') return `Sem ${key}`;
  return key ?? '(vacío)';
}

function construirArbol(rows, dims, unidad = 'tons') {
  const factor = unidad === 'trucks' ? 1 / 10 : 1;

  const group = (arr, dim) => {
    const m = new Map();
    for (const r of arr) {
      const k = r[dim] ?? '(vacío)'; // Mes debe venir como "YYYY-MM"
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };

  const tot = (arr) => ({
    disp: arr.reduce((s, x) => s + (+x.Tons || 0), 0),
    asig: arr.reduce((s, x) => s + (+x.Asignado || 0), 0),
    saldo: arr.reduce((s, x) => s + (+x.Saldo || 0), 0),
  });

  const make = (arr, idx) => {
    if (DEBUG && idx === 0) {
      // Log de primer nivel de agrupación (dim 0)
      const dim0 = dims[0];
      const m0 = new Map();
      for (const r of arr) {
        const k = r[dim0] ?? '(vacío)';
        m0.set(k, (m0.get(k) || 0) + (Number(r.Tons) || 0));
      }
      DBGg('[INV] Primer nivel de agrupación');
      DBG('Dim0:', dim0);
      console.table([...m0.entries()].map(([k, v]) => ({ key: k, tons: v, etiqueta: etiquetaPara(dim0, k) })));
      DBGend();
    }

    if (idx >= dims.length || !dims[idx]) {
      const t = tot(arr);
      return [{ label: '(total)', Disp: t.disp * factor, Asig: t.asig * factor, Saldo: t.saldo * factor }];
    }

    const dim = dims[idx];
    const map = group(arr, dim);
    const ordered = ordenarClaves(dim, [...map.keys()]);
    const out = [];

    for (const k of ordered) {
      const sub = map.get(k);
      const t = tot(sub);
      const node = {
        label: etiquetaPara(dim, k),
        Disp: t.disp * factor,
        Asig: t.asig * factor,
        Saldo: t.saldo * factor,
      };

      const children = make(sub, idx + 1);
      if (dims.slice(idx + 1).filter(Boolean).length) {
        node.children = children.filter((c) => c.label !== '(total)');
      }
      out.push(node);
    }
    return out;
  };

  const tree = make(rows, 0);
  const tg = tot(rows);
  tree.push({ label: 'Total', Disp: tg.disp * factor, Asig: tg.asig * factor, Saldo: tg.saldo * factor });

  if (DEBUG) {
    DBGg('[INV] Top-level labels que verá Tabulator');
    console.table(tree.filter(n => n.label !== '(total)').map(n => ({
      label: n.label, Disp: n.Disp, Asig: n.Asig, Saldo: n.Saldo
    })));
    DBGend();
  }

  return tree;
}

function aplicar() {
  const unidad = document.getElementById('inv_unidad').value;
  const rowDim = document.getElementById('inv_row').value;
  const sub1 = document.getElementById('inv_sub1').value || '';
  const sub2 = document.getElementById('inv_sub2').value || '';

  const filas = estado.filasEnriquecidas({ tipo: 'ALL' });

  // ===== DEBUG fuerte para confirmar de dónde sale el Mes =====
  DBGg('[INV] Chequeo de filas antes de construir árbol');
  DBG('Dims:', { rowDim, sub1, sub2, unidad });

  // Muestra 15 filas incluyendo posibles campos de origen
  console.table(filas.slice(0, 15).map(f => ({
    Mes: f.Mes,
    Semana: f.Semana,
    mesKey: f.mesKey || '',
    anio: f.anio || '',
    mes: f.mes || '',
    FechaBase: f.FechaBase || '',
    __mesSource: f.__mesSource || '',
    Proveedor: (f.Proveedor || '').slice(0, 40),
    Tons: f.Tons
  })));

  // Distribución por Mes
  const distMes = filas.reduce((acc, x) => (acc[x.Mes] = (acc[x.Mes] || 0) + 1, acc), {});
  DBG('Distribución por Mes (conteo de filas):', distMes);

  // Sospechosos comunes: vienen como SEP por metadata, pero Mes terminó en AGO
  const sospechosos = filas.filter(f => (
    (f.mesKey === '2025-09' || (f.anio === 2025 && (f.mes === 9 || f.mes === '9' || f.mes === '09')))
    && f.Mes === '2025-08'
  ));
  if (sospechosos.length) {
    DBGw('⚠️ Sospechosos: metadata dice SEP (2025-09) pero Mes quedó 2025-08');
    console.table(sospechosos.map(f => ({
      Mes: f.Mes, mesKey: f.mesKey, anio: f.anio, mes: f.mes, FechaBase: f.FechaBase, __mesSource: f.__mesSource,
      Proveedor: (f.Proveedor || '').slice(0, 40), Tons: f.Tons
    })));
  } else {
    DBG('No se detectaron filas con mesKey=2025-09 pero Mes=2025-08.');
  }
  DBGend();

  const dims = [rowDim, sub1, sub2].filter(Boolean);
  const data = construirArbol(filas, dims, unidad);

  const cols = [
    { title: 'Elemento', field: 'label', width: 280, headerSort: true },
    { title: 'Disponibles', field: 'Disp', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 130 },
    { title: 'Asignado',   field: 'Asig', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 120 },
    { title: 'Saldo',      field: 'Saldo', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 110 },
  ];

  const h = altoDisponible(document.getElementById('invTableWrap'));

  if (tabla) {
    tabla.setColumns(cols);
    tabla.setData(data);
    tabla.setHeight(h + 'px');
  } else {
    tabla = new Tabulator('#invTable', {
      data,
      columns: cols,
      height: h + 'px',
      layout: 'fitColumns',
      dataTree: true,
      dataTreeChildField: 'children',
      dataTreeStartExpanded: false,
      columnMinWidth: 110,
      movableColumns: true,
    });
    window.getTablaInventario = () => tabla;
  }

  document.getElementById('inv_badge').textContent = `${estado.datos.ofertas.length} registros`;
  document.getElementById('invNote').textContent =
    `Unidad actual: ${unidad === 'trucks' ? 'Camiones (10 t)' : 'Toneladas'}.`;
}

export function montar() {
  construirToolbar({ onAplicar: aplicar });
  aplicar();

  window.addEventListener('resize', () => {
    const h = altoDisponible(document.getElementById('invTableWrap'));
    if (tabla) tabla.setHeight(h + 'px');
  });

  estado.on('actualizado', aplicar);
}
