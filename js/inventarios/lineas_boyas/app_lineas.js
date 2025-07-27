import { Estado } from '../../core/estado.js';
import { getCentrosAll } from '../../core/centros_repo.js';
import { initConteoRapido, abrirConteoLinea } from './conteo_rapido.js';

let dtHist = null;
let dtUltimos = null;
let ultimosData = [];

// Filtros actuales
const F = { estadoLinea: 'all', kpi: null };

// Formatea ISO a DD-MM-YYYY
const fechaSolo = iso => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa Materialize (modales, selects, etc.)
  M.AutoInit();

  // Cargo los centros con sus líneas
  Estado.centros = await getCentrosAll();
  Estado.centros.forEach(c => { if (!Array.isArray(c.lines)) c.lines = []; });

  // Inicializo los selects personalizados
  initChoicesSelects();

  // Inicializo conteo rápido y su botón
  initConteoRapido();
  initBotonConteo();

  // Inicializo tablas
  initTablaHistorial();
  initTablaUltimos();

  // Cargo datos iniciales
  await refreshHistorial();
  await refreshUltimosYResumen();
  mostrarResumen();

  // Manejo de hash en tabs
  const tabsInst = M.Tabs.getInstance(document.getElementById('tabsLB'));
  if (window.location.hash === '#tab-historial') tabsInst?.select('tab-historial');
  if (window.location.hash === '#tab-ultimos')   tabsInst?.select('tab-ultimos');

  // Ajusto columnas al cambiar de tab
  document.querySelectorAll('#tabsLB a').forEach(a => {
    a.addEventListener('click', e => {
      const href = e.currentTarget.getAttribute('href');
      setTimeout(() => {
        if (href === '#tab-historial') dtHist?.columns.adjust().draw(false);
        if (href === '#tab-ultimos')   dtUltimos?.columns.adjust().draw(false);
      }, 200);
    });
  });

  // Filtro de estado de línea
  document.getElementById('fEstadoLinea')
    ?.addEventListener('change', e => {
      F.estadoLinea = e.target.value;
      F.kpi = null;
      marcarActivos();
      aplicarFiltrosUltimos();
    });

  // Filtro por KPI al hacer click en tarjetas
  document.getElementById('kpiGroups')
    ?.addEventListener('click', e => {
      const filtro = e.target.dataset.kpi;
      if (!filtro) return;
      F.kpi = (F.kpi === filtro ? null : filtro);

      // Si es filtro de estado de línea, sincronizo el select
      if (['linea_buena','linea_regular','linea_mala','sinInv'].includes(filtro)) {
        const sel = document.getElementById('fEstadoLinea');
        F.estadoLinea = (filtro === 'sinInv') ? 'sinInv' : 'all';
        sel.value = F.estadoLinea;
        M.FormSelect.getInstance(sel)?.destroy();
        M.FormSelect.init(sel);
      }

      marcarActivos();
      aplicarFiltrosUltimos();
    });

  // Cuando guardo un inventario, refresco todo
  window.addEventListener('inventario-guardado', async () => {
    await refreshHistorial();
    await refreshUltimosYResumen();
    mostrarResumen();
  });
});

/**
 * Inicializa los selects de Centro y Línea usando Choices.js (global)
 */
function initChoicesSelects() {
  const selectCentro = document.getElementById('inputCentro');
  const selectLinea  = document.getElementById('inputLinea');

  // Poblamos Centro
  Estado.centros.forEach((c,i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text  = c.name;
    selectCentro.appendChild(opt);
  });

  // Creamos instancias de Choices
  const choicesCentro = new window.Choices(selectCentro, {
    placeholder: true,
    placeholderValue: 'Selecciona un centro',
    searchPlaceholderValue: 'Buscar centro…',
    itemSelectText: '',
    shouldSort: false
  });
  const choicesLinea = new window.Choices(selectLinea, {
    placeholder: true,
    placeholderValue: 'Selecciona una línea',
    searchPlaceholderValue: 'Buscar línea…',
    itemSelectText: '',
    shouldSort: false
  });

  // Al cambiar Centro cargamos líneas correspondientes
  selectCentro.addEventListener('change', event => {
    const idx = parseInt(event.detail.value, 10);
    window.selectedCentroIdx = idx;
    const lines = Estado.centros[idx].lines || [];

    // Llenamos y habilitamos select de Línea
    choicesLinea.clearChoices();
    choicesLinea.setChoices(
      lines.map((l,i) => ({ value: i, label: l.number || `Línea ${i+1}` })),
      'value','label', true
    );
    selectLinea.removeAttribute('disabled');
    choicesLinea.showDropdown(true);
  });

  // Al cambiar Línea guardamos el índice
  selectLinea.addEventListener('change', event => {
    window.selectedLineaIdx = parseInt(event.detail.value, 10);
  });
}

/**
 * Muestra resumen del último inventario seleccionado
 */
function mostrarResumen() {
  const cIdx = window.selectedCentroIdx;
  const lIdx = window.selectedLineaIdx;
  const cont = document.getElementById('resumenInventario');
  if (cIdx == null || lIdx == null) {
    cont.style.display = 'none';
    return;
  }
  const invs = Estado.centros[cIdx].lines[lIdx].inventarios || [];
  if (!invs.length) {
    cont.style.display = 'block';
    cont.innerHTML = '<em>Sin inventarios aún</em>';
    return;
  }
  const u = invs[invs.length - 1];
  cont.style.display = 'block';
  cont.innerHTML = `
    <b>Último:</b> ${fechaSolo(u.fecha)}<br>
    Tot: ${u.boyas.total} |
    NB ${u.boyas.negras.buenas}/${u.boyas.negras.malas} |
    NA ${u.boyas.naranjas.buenas}/${u.boyas.naranjas.malas} |
    S:${u.sueltas} | Col:${u.colchas}<br>
    Estado: ${u.estadoLinea} | Obs: ${u.observaciones || '-'}
  `;
}

/**
 * Configura el botón de Conteo Rápido
 */
function initBotonConteo() {
  document.getElementById('btnAbrirConteo')
    .addEventListener('click', () => {
      const c = window.selectedCentroIdx;
      const l = window.selectedLineaIdx;
      if (c == null || l == null) {
        M.toast({ html: 'Selecciona centro y línea', classes: 'red' });
        return;
      }
      abrirConteoLinea(c, l);
    });
}

// ================== Tablas ==================

function initTablaHistorial() {
  dtHist = $('#tablaInventariosLB').DataTable({
    data: [], autoWidth:false, scrollX:true, scrollCollapse:true,
    columns: [
      { title:'Fecha' },{ title:'Centro' },{ title:'Línea' },{ title:'Tot' },
      { title:'NB Buenas' },{ title:'NB Malas' },{ title:'NA Buenas' },{ title:'NA Malas' },
      { title:'Sueltas' },{ title:'Colchas' },{ title:'Estado Línea' },{ title:'Obs' },
      { title:'Lat' },{ title:'Lng' }
    ],
    dom:'Bfrtip',
    buttons:[
      { extend:'excelHtml5', title:'Historial_Lineas_Boyas' },
      { extend:'pdfHtml5', orientation:'landscape', pageSize:'A4' },
      'copy','print'
    ],
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' }
  });
}

async function refreshHistorial() {
  if (!dtHist) return;
  const centros = await getCentrosAll();
  const cIdx = window.selectedCentroIdx;
  const lIdx = window.selectedLineaIdx;
  const rows = [];
  centros.forEach((c,iC) => {
    (c.lines||[]).forEach((l,iL) => {
      if (cIdx != null && iC !== cIdx) return;
      if (lIdx != null && iL !== lIdx) return;
      (l.inventarios||[]).forEach(reg => {
        rows.push([
          fechaSolo(reg.fecha),
          c.name, l.number,
          reg.boyas.total,
          reg.boyas.negras.buenas, reg.boyas.negras.malas,
          reg.boyas.naranjas.buenas, reg.boyas.naranjas.malas,
          reg.sueltas, reg.colchas,
          reg.estadoLinea, reg.observaciones,
          reg.gps?.lat || '', reg.gps?.lng || ''
        ]);
      });
    });
  });
  dtHist.clear().rows.add(rows).draw(false);
}

function initTablaUltimos() {
  dtUltimos = $('#tablaUltimos').DataTable({
    data: [], autoWidth:false, scrollX:true, scrollCollapse:true,
    columns: [
      { title:'Centro' },{ title:'Línea' },{ title:'Fecha' },{ title:'Tot' },
      { title:'NB Buenas' },{ title:'NB Malas' },{ title:'NA Buenas' },{ title:'NA Malas' },
      { title:'Sueltas' },{ title:'Colchas' },{ title:'Estado Línea' },{ title:'Obs' }
    ],
    dom:'Bfrtip',
    buttons:[
      { extend:'excelHtml5', title:'Últimos_Lineas_Boyas' },
      { extend:'pdfHtml5', orientation:'landscape', pageSize:'A4' },
      'copy','print'
    ],
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' }
  });
}

async function refreshUltimosYResumen() {
  const centros = await getCentrosAll();
  ultimosData = [];
  const resumen = {
    totalBoyas:0, buenas:0, malas:0,
    negras:0, naranjas:0, sueltas:0, colchas:0,
    sinInv:0, lineasTotal:0, lineas_buenas:0, lineas_regulares:0, lineas_malas:0
  };

  centros.forEach((c,iC) => {
    (c.lines||[]).forEach((l,iL) => {
      resumen.lineasTotal++;
      const invs = l.inventarios || [];
      if (!invs.length) {
        ultimosData.push({ centro:c.name, linea:l.number, sinInv:true });
        resumen.sinInv++;
        return;
      }
      const u = invs[invs.length-1];
      const tot = u.boyas.total;
      resumen.totalBoyas += tot;
      resumen.buenas     += u.boyas.negras.buenas + u.boyas.naranjas.buenas;
      resumen.malas      += u.boyas.negras.malas  + u.boyas.naranjas.malas;
      resumen.negras     += u.boyas.negras.buenas + u.boyas.negras.malas;
      resumen.naranjas   += u.boyas.naranjas.buenas + u.boyas.naranjas.malas;
      resumen.sueltas    += u.sueltas;
      resumen.colchas    += u.colchas;
      const estado = (u.estadoLinea||'').toLowerCase();
      if (estado==='buena')   resumen.lineas_buenas++;
      if (estado==='regular') resumen.lineas_regulares++;
      if (estado==='mala')    resumen.lineas_malas++;

      ultimosData.push({
        centro:c.name, linea:l.number,
        fecha:u.fecha, tot,
        nb_b:u.boyas.negras.buenas,   nb_m:u.boyas.negras.malas,
        na_b:u.boyas.naranjas.buenas, na_m:u.boyas.naranjas.malas,
        sueltas:u.sueltas, colchas:u.colchas,
        estadoLinea:u.estadoLinea, obs:u.observaciones,
        sinInv:false
      });
    });
  });

  aplicarFiltrosUltimos();
  renderKPIs(resumen);
}

function aplicarFiltrosUltimos() {
  if (!dtUltimos) return;
  const filtrado = ultimosData.filter(r => {
    if (F.estadoLinea==='sinInv') return r.sinInv;
    if (F.estadoLinea!=='all' && !r.sinInv && (r.estadoLinea||'').toLowerCase() !== F.estadoLinea) return false;
    if (F.kpi && !r.sinInv) {
      switch (F.kpi) {
        case 'buenas':    if (r.nb_b + r.na_b <= 0) return false; break;
        case 'malas':     if (r.nb_m + r.na_m <= 0) return false; break;
        case 'negra':     if (r.nb_b + r.nb_m <= 0) return false; break;
        case 'naranja':   if (r.na_b + r.na_m <= 0) return false; break;
        case 'sueltas':   if (r.sueltas <= 0) return false; break;
        case 'colchas':   if (r.colchas <= 0) return false; break;
        case 'linea_buena':    return (r.estadoLinea||'').toLowerCase()==='buena';
        case 'linea_regular': return (r.estadoLinea||'').toLowerCase()==='regular';
        case 'linea_mala':    return (r.estadoLinea||'').toLowerCase()==='mala';
        case 'sinInv':        return r.sinInv;
      }
    }
    return true;
  });

  const rows = filtrado.map(r => [
    r.centro,
    r.linea,
    r.sinInv ? 'Sin inventario' : fechaSolo(r.fecha),
    r.sinInv ? '-' : r.tot,
    r.sinInv ? '-' : r.nb_b,
    r.sinInv ? '-' : r.nb_m,
    r.sinInv ? '-' : r.na_b,
    r.sinInv ? '-' : r.na_m,
    r.sinInv ? '-' : r.sueltas,
    r.sinInv ? '-' : r.colchas,
    r.sinInv ? '-' : r.estadoLinea,
    r.sinInv ? '-' : r.obs
  ]);

  dtUltimos.clear().rows.add(rows).draw(false);
  dtUltimos.columns.adjust().draw(false);
}

function renderKPIs(r) {
  const wrap = document.getElementById('kpiGroups');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="kpi-card">
      <div class="title">Total boyas</div>
      <div class="big">${r.totalBoyas}</div>
      <div class="subs">
        <span data-kpi="buenas">Buenas: ${r.buenas}</span>
        <span data-kpi="malas">Malas: ${r.malas}</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="title">Total líneas</div>
      <div class="big">${r.lineasTotal}</div>
      <div class="subs">
        <span data-kpi="linea_buena">Buenas: ${r.lineas_buenas}</span>
        <span data-kpi="linea_regular">Regulares: ${r.lineas_regulares}</span>
        <span data-kpi="linea_mala">Malas: ${r.lineas_malas}</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="title">Boyas por color</div>
      <div class="big">${r.negras + r.naranjas}</div>
      <div class="subs">
        <span data-kpi="negra">Negras: ${r.negras}</span>
        <span data-kpi="naranja">Naranjas: ${r.naranjas}</span>
      </div>
    </div>
    <div class="kpi-mini" data-kpi="sueltas">
      <span class="valor">${r.sueltas}</span><span>Boyas sueltas</span>
    </div>
    <div class="kpi-mini" data-kpi="colchas">
      <span class="valor">${r.colchas}</span><span>Colchas</span>
    </div>
    <div class="kpi-mini" data-kpi="sinInv">
      <span class="valor">${r.sinInv}</span><span>Sin inventario</span>
    </div>
  `;
  marcarActivos();
}

function marcarActivos() {
  document.querySelectorAll('#kpiGroups .subs span')
    .forEach(s => s.classList.toggle('active', s.dataset.kpi === F.kpi));
  document.querySelectorAll('#kpiGroups .kpi-mini')
    .forEach(c => c.classList.toggle('active', c.dataset.kpi === F.kpi));
}
