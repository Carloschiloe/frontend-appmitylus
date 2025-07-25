import { Estado } from '../../core/estado.js';
// Este es el import correcto, ajusta el path si es necesario:
import { addInventarioLinea } from '../../core/centros_repo.js';

const initCounters = () => ({
  total: 0,                      // SOLO buenas + malas
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

  setTexto('#conteoTitulo', `Conteo - Línea ${linea.number ?? (lineaIdx + 1)}`);
  setTexto('#conteoDisplay', '#0');
  setValue('#conteoObs', '');
  setValue('#conteoLat',''); setValue('#conteoLng','');
  ocultar('#conteoGpsRow');

  const sel = document.getElementById('conteoEstadoLinea');
  if (sel) { sel.value = 'buena'; M.FormSelect.init(sel); }
  M.Collapsible.init(document.querySelectorAll('.collapsible'));
  M.updateTextFields?.();

  updateStats();

  const modal = document.getElementById('conteoLineaModal');
  (M.Modal.getInstance(modal) || M.Modal.init(modal)).open();
}

export function initConteoRapido() {
  const modal = document.getElementById('conteoLineaModal');
  if (!modal) return;

  // Botones sumar
  modal.querySelectorAll('.btn-count[data-action]').forEach(btn => {
    btn.onclick = () => add(btn.dataset.action);
  });

  // Deshacer / Guardar / GPS
  document.getElementById('btnUndoEvento').onclick = undo;
  document.getElementById('btnGuardarConteo').onclick = guardar;
  document.getElementById('btnConteoGPS')?.addEventListener('click', tomarGPS);
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
    case 'suelta':        c.sueltas++;         pushEvento('suelta', null);               break;
    case 'colcha':        c.colchas++;         pushEvento('colcha',  null);              break;
    default: return;
  }

  setTexto('#conteoDisplay', `#${c.total}`);
  updateStats();
}

function undo() {
  if (!conteo || !conteo.eventos.length) return;
  const last = conteo.eventos.pop();
  const c = conteo.counters;

  switch (last.tipo) {
    case 'colcha': c.colchas--; break;
    case 'suelta': c.sueltas--; break;
    case 'buena':
    case 'mala':
      if (last.color === 'negra') {
        if (last.tipo === 'buena') c.negras.buenas--; else c.negras.malas--;
      } else if (last.color === 'naranja') {
        if (last.tipo === 'buena') c.naranjas.buenas--; else c.naranjas.malas--;
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
    M.toast({ html: 'No se pudo guardar', classes: 'red' }); return;
  }

  const registro = {
    fecha: new Date().toISOString(),
    inspector: '',
    estadoLinea: getValue('#conteoEstadoLinea') || 'buena',
    boyas: {
      total:    conteo.counters.total,
      negras:   { ...conteo.counters.negras },
      naranjas: { ...conteo.counters.naranjas }
    },
    sueltas: conteo.counters.sueltas,
    colchas: conteo.counters.colchas,
    observaciones: getValue('#conteoObs').trim(),
    gps: (getValue('#conteoLat') && getValue('#conteoLng'))
      ? { lat: +getValue('#conteoLat'), lng: +getValue('#conteoLng') }
      : null,
    eventos: conteo.eventos
  };

  // Llama a la API (usa los _id reales)
  try {
    const centroId = centro._id;
    const lineaId  = linea._id;
    await addInventarioLinea(centroId, lineaId, registro);
    M.toast({ html: 'Inventario guardado', classes: 'green' });
    window.dispatchEvent(new CustomEvent('inventario-guardado')); // para refrescar tablas externas
    M.Modal.getInstance(document.getElementById('conteoLineaModal'))?.close();
  } catch (e) {
    M.toast({ html: 'Error al guardar en el servidor', classes: 'red' });
    console.error(e);
  }
}

function tomarGPS() {
  if (!navigator.geolocation) {
    M.toast({ html: 'GPS no disponible', classes: 'red' });
    return;
  }
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    setValue('#conteoLat', latitude.toFixed(6));
    setValue('#conteoLng', longitude.toFixed(6));
    mostrar('#conteoGpsRow');
    M.updateTextFields?.();
  }, () => {
    M.toast({ html: 'No se pudo obtener GPS', classes: 'red' });
  }, { enableHighAccuracy: true, timeout: 8000 });
}

function pushEvento(tipo, color=null) {
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
const mostrar  = sel          => { const el = $(sel); if (el) el.style.display = ''; };
const ocultar  = sel          => { const el = $(sel); if (el) el.style.display = 'none'; };
