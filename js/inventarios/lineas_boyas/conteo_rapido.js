import { Estado } from '../../core/estado.js';
import { addInventarioLinea } from '../../core/centros_repo.js';

const initCounters = () => ({
  total: 0,
  negras:   { buenas: 0, malas: 0 },
  naranjas: { buenas: 0, malas: 0 },
  sueltas:  0,
  colchas:  0
});

let conteo = null;

export function abrirConteoLinea(centroIdx, lineaIdx) {
  Estado.inventarioActual = { centroIdx, lineaIdx, registroIdx: null };
  conteo = { counters: initCounters(), eventos: [] };

  const centro = Estado.centros?.[centroIdx];
  const linea  = centro?.lines?.[lineaIdx];
  if (!centro) { M.toast({ html: 'Centro no encontrado', classes: 'red' }); return; }
  if (!linea)  { M.toast({ html: 'Línea no encontrada', classes: 'red' });  return; }

  // Resetea texto y campos
  setTexto('#conteoTitulo', `Conteo - Línea ${linea.number ?? (lineaIdx + 1)}`);
  setTexto('#conteoDisplay', '#0');
  setValue('#conteoObs', '');
  setValue('#conteoLat', ''); setValue('#conteoLng', '');
  ocultar('#conteoGpsRow');

  // Inicializa el select de estado (Materialize Select)
  const sel = document.getElementById('conteoEstadoLinea');
  if (sel) {
    // destruye instancia previa si existiera
    const instSel = M.FormSelect.getInstance(sel);
    if (instSel) instSel.destroy();
    M.FormSelect.init(sel);
  }

  // Actualiza labels flotantes
  if (M.updateTextFields) M.updateTextFields();

  // Actualiza stats
  updateStats();

  // **********************
  // ¡Aquí está la corrección!
  // **********************
  // Aseguramos que exista la instancia de Modal y la abrimos
  const modalEl = document.getElementById('conteoLineaModal');
  if (!modalEl) {
    console.error('No se encontró #conteoLineaModal en el DOM');
    return;
  }
  // Si no hay instancia, la inicializamos con opciones
  let modalInst = M.Modal.getInstance(modalEl);
  if (!modalInst) {
    modalInst = M.Modal.init(modalEl, {
      dismissible: true,
      // puedes agregar más opciones aquí si lo deseas
    });
  }
  modalInst.open();
}

export function initConteoRapido() {
  // Pre-inicializamos el modal para que M.Modal.getInstance no devuelva null
  const modalEl = document.getElementById('conteoLineaModal');
  if (modalEl) {
    M.Modal.init(modalEl, { dismissible: true });
  }

  // Botones sumar con data-action
  modalEl?.querySelectorAll('.btn-count[data-action]').forEach(btn => {
    btn.addEventListener('click', () => add(btn.dataset.action));
  });

  // Botón Deshacer último evento
  const undoBtn = document.getElementById('btnUndoEvento');
  undoBtn?.addEventListener('click', undo);

  // Botón Guardar conteo
  const guardarBtn = document.getElementById('btnGuardarConteo');
  guardarBtn?.addEventListener('click', guardar);

  // Inicializamos collapsibles (si los hay)
  const cols = document.querySelectorAll('.collapsible');
  if (cols.length) M.Collapsible.init(cols);
}

/* ------------ lógica ------------ */

function add(action) {
  if (!conteo) return;
  const c = conteo.counters;

  switch (action) {
    case 'negra_buena':   c.negras.buenas++;   c.total++; pushEvento('buena','negra');   break;
    case 'negra_mala':    c.negras.malas++;    c.total++; pushEvento('mala','negra');    break;
    case 'naranja_buena': c.naranjas.buenas++; c.total++; pushEvento('buena','naranja'); break;
    case 'naranja_mala':  c.naranjas.malas++;  c.total++; pushEvento('mala','naranja');  break;
    case 'suelta':        c.sueltas++;         pushEvento('suelta', null);             break;
    case 'colcha':        c.colchas++;         pushEvento('colcha',  null);            break;
    default: return;
  }

  setTexto('#conteoDisplay', `#${c.total}`);
  updateStats();
}

function undo() {
  if (!conteo?.eventos.length) return;
  const last = conteo.eventos.pop();
  const c = conteo.counters;

  switch (last.tipo) {
    case 'colcha': c.colchas--; break;
    case 'suelta': c.sueltas--; break;
    case 'buena':
    case 'mala':
      if (last.color === 'negra') {
        last.tipo === 'buena' ? c.negras.buenas-- : c.negras.malas--;
      } else {
        last.tipo === 'buena' ? c.naranjas.buenas-- : c.naranjas.malas--;
      }
      c.total--;
      break;
  }

  setTexto('#conteoDisplay', `#${c.total}`);
  updateStats();
}

async function guardar() {
  const { centroIdx, lineaIdx } = Estado.inventarioActual || {};
  const centro = Estado.centros?.[centroIdx];
  const linea  = centro?.lines?.[lineaIdx];
  if (!centro || !linea) {
    M.toast({ html: 'No se pudo guardar', classes: 'red' });
    return;
  }

  const registro = {
    fecha: new Date().toISOString(),
    estadoLinea: getValue('#conteoEstadoLinea') || 'buena',
    boyas: {
      total:    conteo.counters.total,
      negras:   { ...conteo.counters.negras },
      naranjas: { ...conteo.counters.naranjas }
    },
    sueltas: conteo.counters.sueltas,
    colchas: conteo.counters.colchas,
    observaciones: getValue('#conteoObs').trim(),
    eventos: conteo.eventos
  };

  try {
    await addInventarioLinea(centro._id, linea._id, registro);
    M.toast({ html: 'Inventario guardado', classes: 'green' });
    window.dispatchEvent(new CustomEvent('inventario-guardado'));
    const modalEl = document.getElementById('conteoLineaModal');
    M.Modal.getInstance(modalEl)?.close();
  } catch (e) {
    console.error('Error al guardar:', e);
    const msg = e instanceof Response ? await e.text() : e.message || e;
    M.toast({ html: `Error al guardar: ${msg}`, classes: 'red' });
  }
}

function pushEvento(tipo, color = null) {
  conteo.eventos.push({ n: conteo.counters.total, tipo, color, ts: Date.now() });
}

function updateStats() {
  const c = conteo.counters;
  setTexto(
    '#statsLine',
    `Tot: ${c.total} | NB:${c.negras.buenas}/${c.negras.malas} ` +
    `NA:${c.naranjas.buenas}/${c.naranjas.malas} | S:${c.sueltas} | Col:${c.colchas}`
  );
}

/* Helpers DOM */
const $ = sel => document.querySelector(sel);
const setTexto = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
const setValue = (sel, val)   => { const el = $(sel); if (el) el.value = val; };
const getValue = sel          => { const el = $(sel); return el ? el.value : ''; };
const ocultar  = sel          => { const el = $(sel); if (el) el.style.display = 'none'; };
