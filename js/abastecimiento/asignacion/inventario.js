// js/abastecimiento/asignacion/inventario.js
import { fmt, altoDisponible } from './utilidades.js'; // <- sin etiquetaMes
import * as estado from './estado.js';

let tabla = null;

// === DEBUG helpers ===
const DEBUG = false;
const DBG  = (...a) => { if (DEBUG) console.log(...a) };
const DBGw = (...a) => { if (DEBUG) console.warn(...a) };
const DBGg = (t)     => { if (DEBUG) console.groupCollapsed(t) };
const DBGend = ()    => { if (DEBUG) console.groupEnd() };

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
  if (!wrap) return;

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

  try {
    const selectOpts = {
      dropdownOptions: {
        container: document.body,
        coverTrigger: false,
        constrainWidth: false,
        alignment: 'left',
      },
    };
    M.FormSelect.init(wrap.querySelectorAll('select'), selectOpts);
  } catch(e) {
    DBGw('[INV] FormSelect init falló:', e);
  }

  const btn = document.getElementById('inv_apply');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAplicar();
    });
  }
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
  if (dim === 'Mes')   return etiquetaMesKey(key);
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
  const wrap = document.getElementById('invTableWrap');
  const tableEl = document.getElementById('invTable');
  if (!wrap || !tableEl) return;

  const unidad = document.getElementById('inv_unidad')?.value || 'tons';
  const rowDim = document.getElementById('inv_row')?.value || 'Mes';
  const sub1 = document.getElementById('inv_sub1')?.value || '';
  const sub2 = document.getElementById('inv_sub2')?.value || '';

  const filas = estado.filasEnriquecidas({ tipo: 'ALL' });

  if (DEBUG) {
    DBGg('[INV] Chequeo de filas antes de construir árbol');
    DBG('Dims:', { rowDim, sub1, sub2, unidad });
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
    const distMes = filas.reduce((acc, x) => (acc[x.Mes] = (acc[x.Mes] || 0) + 1, acc), {});
    DBG('Distribución por Mes (conteo de filas):', distMes);
    DBGend();
  }

  const dims = [rowDim, sub1, sub2].filter(Boolean);
  const data = construirArbol(filas, dims, unidad);

  const cols = [
    { title: 'Elemento', field: 'label', width: 280, headerSort: true },
    { title: 'Disponibles', field: 'Disp', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 130 },
    { title: 'Asignado',   field: 'Asig', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 120 },
    { title: 'Saldo',      field: 'Saldo', hozAlign: 'right', headerHozAlign: 'right', formatter: (c) => fmt(c.getValue()), width: 110 },
  ];

  // Altura robusta (si el tab está oculto, alto=0 -> usa fallback)
  let h = altoDisponible(wrap);
  if (!h || h < 160) h = Math.max(420, wrap.clientHeight || 420);

  // Primera construcción
  if (!tabla) {
    // Si el contenedor aún no se midió (p. ej. tab oculto), esperamos al frame
    requestAnimationFrame(() => {
      tabla = new Tabulator(tableEl, {
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

      // Si necesitas operaciones post-build, hazlas aquí
      tabla.on('tableBuilt', () => {
        try {
          // post-initial tweaks (si los agregas en el futuro)
        } catch(e) {
          DBGw('[INV] postBuild error', e);
        }
      });
    });
  } else {
    // Reemplazo de datos/columnas en tabla ya construida
    try{
      tabla.setColumns(cols);
      tabla.replaceData(data);
      tabla.setHeight(h + 'px');
    }catch(e){
      DBGw('[INV] update error, rehaciendo tabla:', e);
      try{
        tabla.destroy();
      }catch{}
      tabla = null;
      requestAnimationFrame(aplicar);
      return;
    }
  }

  const badge = document.getElementById('inv_badge');
  if (badge) badge.textContent = `${estado.datos.ofertas.length} registros`;

  const note = document.getElementById('invNote');
  if (note) note.textContent =
    `Unidad actual: ${unidad === 'trucks' ? 'Camiones (10 t)' : 'Toneladas'}.`;
}

export function montar() {
  construirToolbar({ onAplicar: aplicar });

  // Monta con un pequeño defer para asegurar layout listo
  requestAnimationFrame(() => aplicar());

  // Resize responsivo
  window.addEventListener('resize', () => {
    const wrap = document.getElementById('invTableWrap');
    if (!wrap || !tabla) return;
    let h = altoDisponible(wrap);
    if (!h || h < 160) h = Math.max(420, wrap.clientHeight || 420);
    tabla.setHeight(h + 'px');
  });

  // Cuando llegan nuevos datos
  estado.on('actualizado', () => {
    // reemplazar data/altura sin reconstruir completamente
    aplicar();
  });
}
