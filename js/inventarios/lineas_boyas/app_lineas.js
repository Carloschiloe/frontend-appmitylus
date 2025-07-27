import { Estado } from '../../core/estado.js';
import { getCentrosAll } from '../../core/centros_repo.js';
import { initConteoRapido, abrirConteoLinea } from './conteo_rapido.js';
import Choices from 'choices.js';

let dtHist = null;
let dtUltimos = null;
let ultimosData = [];

// Filtros actuales
const F = { estadoLinea: 'all', kpi: null };

// Helper para formatear fecha
const fechaSolo = iso => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  M.AutoInit();

  // Cargar centros y líneas en memoria
  Estado.centros = await getCentrosAll();
  Estado.centros.forEach(c => { if (!Array.isArray(c.lines)) c.lines = []; });

  // Inicializar selects con Choices.js
  initChoicesSelects();

  // Inicializar conteo rápido y botón conteo
  initConteoRapido();
  initBotonConteo();

  // Inicializar tablas
  initTablaHistorial();
  initTablaUltimos();

  // Cargar datos
  await refreshHistorial();
  await refreshUltimosYResumen();
  mostrarResumen();

  // Tabs con hash
  const instTabs = M.Tabs.getInstance(document.getElementById('tabsLB'));
  if (window.location.hash === '#tab-historial') instTabs?.select('tab-historial');
  if (window.location.hash === '#tab-ultimos')   instTabs?.select('tab-ultimos');

  // Ajustar columnas al cambiar tab
  document.querySelectorAll('#tabsLB a').forEach(a => {
    a.addEventListener('click', e => {
      const href = e.currentTarget.getAttribute('href');
      setTimeout(() => {
        if (href === '#tab-historial') dtHist?.columns.adjust().draw(false);
        if (href === '#tab-ultimos')   dtUltimos?.columns.adjust().draw(false);
      }, 200);
    });
  });

  // Filtro estado línea
  const selEstado = document.getElementById('fEstadoLinea');
  selEstado?.addEventListener('change', () => {
    F.estadoLinea = selEstado.value;
    F.kpi = null;
    marcarActivos();
    aplicarFiltrosUltimos();
  });

  // Evento para KPIs agrupados
  document.getElementById('kpiGroups')?.addEventListener('click', e => {
    const filter = e.target.dataset.kpi;
    if (!filter) return;

    F.kpi = (F.kpi === filter) ? null : filter;

    // Sincronizar select de estado si es KPI de línea
    const s = document.getElementById('fEstadoLinea');
    if (['linea_buena','linea_regular','linea_mala','sinInv'].includes(filter)) {
      F.estadoLinea = (filter === 'sinInv') ? 'sinInv' : 'all';
      s.value = F.estadoLinea;
      M.FormSelect.getInstance(s)?.destroy();
      M.FormSelect.init(s);
    }

    marcarActivos();
    aplicarFiltrosUltimos();
  });

  // Actualizar datos al guardar inventario
  window.addEventListener('inventario-guardado', async () => {
    await refreshHistorial();
    await refreshUltimosYResumen();
    mostrarResumen();
  });
});

/**
 * Inicializa los selects de Centro y Línea usando Choices.js
 */
function initChoicesSelects() {
  const selectCentro = document.getElementById('inputCentro');
  const selectLinea = document.getElementById('inputLinea');

  // Poblar opciones de centro
  Estado.centros.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = c.name;
    selectCentro.appendChild(opt);
  });
  
  // Inicializar Choices para Centro
  const choicesCentro = new Choices(selectCentro, {
    placeholder: true,
    placeholderValue: 'Selecciona un centro',
    searchPlaceholderValue: 'Buscar centro…',
    itemSelectText: '',
    shouldSort: false
  });

  // Inicializar Choices para Línea (vacío al inicio)
  const choicesLinea = new Choices(selectLinea, {
    placeholder: true,
    placeholderValue: 'Selecciona una línea',
    searchPlaceholderValue: 'Buscar línea…',
    itemSelectText: '',
    shouldSort: false
  });

  // Al cambiar Centro, cargar Líneas
  selectCentro.addEventListener('change', event => {
    const idx = parseInt(event.detail.value, 10);
    window.selectedCentroIdx = idx;
    const lines = Estado.centros[idx].lines || [];

    // Limpiar y cargar opciones de Línea
    choicesLinea.clearChoices();
    choicesLinea.setChoices(
      lines.map((l, i) => ({ value: i, label: l.number })),
      'value', 'label', true
    );
    selectLinea.removeAttribute('disabled');
    choicesLinea.showDropdown(true);
  });

  // Guardar selección de Línea
  selectLinea.addEventListener('change', event => {
    window.selectedLineaIdx = parseInt(event.detail.value, 10);
  });
}

/** Mostrar resumen del último inventario */
function mostrarResumen() {
  const centroIdx = window.selectedCentroIdx;
  const lineaIdx = window.selectedLineaIdx;
  const cont = document.getElementById('resumenInventario');
  if (centroIdx == null || lineaIdx == null) {
    cont.style.display = 'none';
    return;
  }
  const l = Estado.centros[centroIdx].lines[lineaIdx];
  const invs = l.inventarios || [];
  if (!invs.length) {
    cont.style.display = 'block';
    cont.innerHTML = '<em>Sin inventarios aún</em>';
    return;
  }
  const ult = invs[invs.length - 1];
  cont.style.display = 'block';
  cont.innerHTML = `
    <b>Último:</b> ${fechaSolo(ult.fecha)}<br>
    Tot: ${ult.boyas.total} |
    NB ${ult.boyas.negras.buenas}/${ult.boyas.negras.malas} |
    NA ${ult.boyas.naranjas.buenas}/${ult.boyas.naranjas.malas} |
    S:${ult.sueltas} | Col:${ult.colchas}<br>
    Estado: ${ult.estadoLinea} | Obs: ${ult.observaciones || '-'}
  `;
}

/** Botón abrir conteo rápido */
function initBotonConteo() {
  const btn = document.getElementById('btnAbrirConteo');
  btn.addEventListener('click', () => {
    const centroIdx = window.selectedCentroIdx;
    const lineaIdx = window.selectedLineaIdx;
    if (centroIdx == null || lineaIdx == null) {
      M.toast({ html: 'Selecciona centro y línea', classes: 'red' });
      return;
    }
    abrirConteoLinea(centroIdx, lineaIdx);
  });
}

/* ======================= HISTORIAL COMPLETO ======================= */
function initTablaHistorial() {
  dtHist = $('#tablaInventariosLB').DataTable({
    data: [], autoWidth: false, scrollX: true, scrollCollapse: true,
    columns: [
      { title: 'Fecha' }, { title: 'Centro' }, { title: 'Línea' }, { title: 'Tot' },
      { title: 'NB Buenas' }, { title: 'NB Malas' }, { title: 'NA Buenas' }, { title: 'NA Malas' },
      { title: 'Sueltas' }, { title: 'Colchas' }, { title: 'Estado Línea' }, { title: 'Obs' },
      { title: 'Lat' }, { title: 'Lng' }
    ],
    dom: 'Bfrtip',
    buttons: [
      { extend: 'excelHtml5', title: 'Inventarios_Lineas_Boyas_Historial' },
      { extend: 'pdfHtml5',   title: 'Inventarios_Lineas_Boyas_Historial', orientation: 'landscape', pageSize: 'A4' },
      'copy','print'
    ],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json' }
  });
}

async function refreshHistorial() {
  if (!dtHist) return;
  const centros = await getCentrosAll();
  const centroIdx = window.selectedCentroIdx;
  const lineaIdx = window.selectedLineaIdx;
  const rows = [];
  centros.forEach((c,iC) => {
    (c.lines||[]).forEach((l,iL) => {
      if (centroIdx != null && iC !== centroIdx) return;
      if (lineaIdx != null && iL !== lineaIdx) return;
      (l.inventarios||[]).forEach(reg => {
        rows.push([
          fechaSolo(reg.fecha),
          c.name || '-', l.number || (iL+1),
          reg.boyas?.total ?? 0,
          reg.boyas?.negras?.buenas ?? 0,
          reg.boyas?.negras?.malas  ?? 0,
          reg.boyas?.naranjas?.buenas??0,
          reg.boyas?.naranjas?.malas ??0,
          reg.sueltas ?? 0, reg.colchas ?? 0,
          reg.estadoLinea || '-', reg.observaciones || '-'
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
      { extend:'excelHtml5', title:'Ultimos_Inventarios_Lineas' },
      { extend:'pdfHtml5',   title:'Ultimos_Inventarios_Lineas', orientation:'landscape', pageSize:'A4' },
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
      const invs = l.inventarios||[];
      if (!invs.length) {
        ultimosData.push({
          centro:c.name||'-', linea:l.number||(iL+1), sinInv:true,
          fecha:null, tot:null, nb_b:0, nb_m:0, na_b:0, na_m:0, sueltas:0, colchas:0, estadoLinea:null, obs:'-'
        });
        resumen.sinInv++;
        return;
      }
      const u = invs[invs.length-1];
      const { total:tot, negras:{buenas:nb_b, malas:nb_m}, naranjas:{buenas:na_b, malas:na_m} } = u.boyas||{};
      ultimosData.push({ centro:c.name, linea:l.number, fecha:u.fecha, tot, nb_b, nb_m, na_b, na_m, sueltas:u.sueltas, colchas:u.colchas, estadoLinea:u.estadoLinea, obs:u.observaciones, sinInv:false });
      resumen.totalBoyas += tot;
      resumen.buenas     += nb_b + na_b;
      resumen.malas      += nb_m + na_m;
      resumen.negras     += nb_b + nb_m;
      resumen.naranjas   += na_b + na_m;
      resumen.sueltas    += u.sueltas;
      resumen.colchas    += u.colchas;
      const est = (u.estadoLinea||'').toLowerCase();
      if (est==='buena')   resumen.lineas_buenas++;
      else if (est==='regular') resumen.lineas_regulares++;
      else if (est==='mala')    resumen.lineas_malas++;
    });
  });
  aplicarFiltrosUltimos(); renderKPIs(resumen);
}

function aplicarFiltrosUltimos(){
  if (!dtUltimos) return;
  const arr = ultimosData.filter(r => {
    if (F.estadoLinea==='sinInv') return r.sinInv;
    if (F.estadoLinea!=='all' && !r.sinInv && (r.estadoLinea||'').toLowerCase() !== F.estadoLinea) return false;
    if (F.kpi && !r.sinInv) {
      switch(F.kpi) {
        case 'buenas': if ((r.nb_b+r.na_b)<=0) return false; break;
        case 'malas': if ((r.nb_m+r.na_m)<=0) return false; break;
        case 'negra': if ((r.nb_b+r.nb_m)<=0) return false; break;
        case 'naranja': if ((r.na_b+r.na_m)<=0) return false; break;
        case 'sueltas': if (!r.sueltas) return false; break;
        case 'colchas': if (!r.colchas) return false; break;
        case 'linea_buena':    return (r.estadoLinea||'').toLowerCase()==='buena';
        case 'linea_regular': return (r.estadoLinea||'').toLowerCase()==='regular';
        case 'linea_mala':    return (r.estadoLinea||'').toLowerCase()==='mala';
        case 'sinInv':        return r.sinInv;
      }
    }
    return true;
  });
  const rows = arr.map(r=>[ r.centro, r.linea, r.sinInv?'Sin inventario':fechaSolo(r.fecha), r.sinInv?'-':r.tot, r.sinInv?'-':r.nb_b, r.sinInv?'-':r.nb_m, r.sinInv?'-':r.na_b, r.sinInv?'-':r.na_m, r.sinInv?'-':r.sueltas, r.sinInv?'-':r.colchas, r.sinInv?'-':r.estadoLinea, r.sinInv?'-':r.obs]);
  dtUltimos.clear().rows.add(rows).draw(false);
  dtUltimos.columns.adjust().draw(false);
}

function renderKPIs(r) {
  const wrap = document.getElementById('kpiGroups'); if (!wrap) return;
  wrap.innerHTML = `
    <div class="kpi-card"> <div class="title">Total boyas</div> <div class="big">${r.totalBoyas}</div> <div class="subs"><span data-kpi="buenas">Buenas: ${r.buenas}</span><span data-kpi="malas">Malas: ${r.malas}</span></div> </div>
    <div class="kpi-card"> <div class="title">Total líneas</div> <div class="big">${r.lineasTotal}</div> <div class="subs"><span data-kpi="linea_buena">Buenas: ${r.lineas_buenas}</span><span data-kpi="linea_regular">Regulares: ${r.lineas_regulares}</span><span data-kpi="linea_mala">Malas: ${r.lineas_malas}</span></div> </div>
    <div class="kpi-card"> <div class="title">Boyas por color</div> <div class="big">${r.negras + r.naranjas}</div> <div class="subs"><span data-kpi="negra">Negras: ${r.negras}</span><span data-kpi="naranja">Naranjas: ${r.naranjas}</span></div> </div>
    <div class="kpi-mini" data-kpi="sueltas"> <span class="valor">${r.sueltas}</span> <span>Boyas sueltas</span> </div>
    <div class="kpi-mini" data-kpi="colchas"> <span class="valor">${r.colchas}</span> <span>Colchas</span> </div>
    <div class="kpi-mini" data-kpi="sinInv"> <span class="valor">${r.sinInv}</span> <span>Sin inventario</span> </div>
  `;
  marcarActivos();
}

function marcarActivos() {
  document.querySelectorAll('#kpiGroups .subs span').forEach(s => s.classList.toggle('active', s.dataset.kpi === F.kpi));
  document.querySelectorAll('#kpiGroups .kpi-mini').forEach(c => c.classList.toggle('active', c.dataset.kpi === F.kpi));
}
