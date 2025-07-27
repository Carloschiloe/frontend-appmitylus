// app_lineas.js
import { Estado } from '../../core/estado.js';
import { getCentrosAll } from '../../core/centros_repo.js';
import { initConteoRapido, abrirConteoLinea } from './conteo_rapido.js';

let dtHist = null;
let dtUltimos = null;
let ultimosData = [];

// filtros actuales
const F = { estadoLinea: 'all', kpi: null };

// helper para formatear fecha ISO → DD-MM-YYYY
const fechaSolo = iso => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  });
};

console.log('✅ app_lineas.js cargado');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🟢 DOMContentLoaded iniciado');

  // Inicializa sólo los componentes Materialize que necesitas
  M.Tabs.init(document.querySelectorAll('#tabsLB'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));
  M.Modal.init(document.querySelectorAll('.modal'));
  M.Collapsible.init(document.querySelectorAll('.collapsible'));
  const selEstado = document.getElementById('fEstadoLinea');
  if (selEstado) M.FormSelect.init(selEstado);
  console.log('✅ Materialize inicializado');

  // Cargo centros + líneas
  Estado.centros = await getCentrosAll();
  Estado.centros.forEach(c => { if (!Array.isArray(c.lines)) c.lines = []; });
  console.log('📦 Centros cargados:', Estado.centros.map(c => c.name));

  // Inicializo selects con datalist
  initDatalistSelects();

  // Inicializo conteo rápido y su botón
  initConteoRapido();
  initBotonConteo();

  // Inicializo tablas
  initTablaHistorial();
  initTablaUltimos();

  // Datos iniciales
  await refreshHistorial();
  await refreshUltimosYResumen();
  mostrarResumen();

  // Hash en tabs
  const tabsInst = M.Tabs.getInstance(document.getElementById('tabsLB'));
  if (window.location.hash === '#tab-historial') tabsInst.select('tab-historial');
  if (window.location.hash === '#tab-ultimos')   tabsInst.select('tab-ultimos');

  // Ajustar columnas al cambiar tab
  document.querySelectorAll('#tabsLB a').forEach(a => {
    a.addEventListener('click', e => {
      const href = e.currentTarget.getAttribute('href');
      setTimeout(() => {
        console.log('🔄 Tab cambiado a', href);
        if (href === '#tab-historial') dtHist?.columns.adjust().draw(false);
        if (href === '#tab-ultimos')   dtUltimos?.columns.adjust().draw(false);
      }, 200);
    });
  });

  // Filtro estado de línea
  document.getElementById('fEstadoLinea')
    .addEventListener('change', e => {
      console.log('🎚 Filtro estadoLinea:', e.target.value);
      F.estadoLinea = e.target.value;
      F.kpi = null;
      marcarActivos();
      aplicarFiltrosUltimos();
    });

  // Filtro por KPI
  document.getElementById('kpiGroups')
    .addEventListener('click', e => {
      const filtro = e.target.dataset.kpi;
      if (!filtro) return;
      console.log('📊 KPI clickeado:', filtro);
      F.kpi = (F.kpi === filtro ? null : filtro);
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

  // Al guardar inventario, refresco todo
  window.addEventListener('inventario-guardado', async () => {
    console.log('💾 inventario-guardado recibido');
    await refreshHistorial();
    await refreshUltimosYResumen();
    mostrarResumen();
  });
});


/**
 * Inicializa <input list> + <datalist> para Centro y Línea
 */
function initDatalistSelects() {
  console.log('🚀 initDatalistSelects');
  const inputC = document.getElementById('inputCentro');
  const listC  = document.getElementById('centrosList');
  const inputL = document.getElementById('inputLinea');
  const listL  = document.getElementById('lineasList');

  // Poblar centros
  Estado.centros.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    listC.appendChild(opt);
  });
  console.log('📝 datalist centros poblado');

  // Al escribir/seleccionar centro
  inputC.addEventListener('input', () => {
    const nombre = inputC.value;
    const idx = Estado.centros.findIndex(c => c.name === nombre);
    window.selectedCentroIdx = idx >= 0 ? idx : null;
    console.log('🎯 Centro seleccionado:', nombre, 'idx=', idx);

    // Resetear y poblar líneas
    listL.innerHTML = '';
    inputL.value    = '';
    inputL.disabled = true;
    if (idx >= 0) {
      Estado.centros[idx].lines.forEach(l => {
        const o = document.createElement('option');
        o.value = l.number;
        listL.appendChild(o);
      });
      inputL.disabled = false;
      console.log('📝 datalist líneas poblado con', Estado.centros[idx].lines.length);
    }

    // Reposicionar etiqueta flotante
    M.updateTextFields();
    mostrarResumen();
  });

  // Al escribir/seleccionar línea
  inputL.addEventListener('input', () => {
    const numero = inputL.value;
    const cIdx   = window.selectedCentroIdx;
    const idx    = (cIdx != null)
      ? (Estado.centros[cIdx].lines || []).findIndex(l => l.number === numero)
      : -1;
    window.selectedLineaIdx = idx >= 0 ? idx : null;
    console.log('🎯 Línea seleccionada:', numero, 'idx=', idx);

    // Reposicionar etiqueta flotante
    M.updateTextFields();
    mostrarResumen();
  });
}


/**
 * Muestra resumen del último inventario
 */
function mostrarResumen() {
  const c = window.selectedCentroIdx;
  const l = window.selectedLineaIdx;
  console.log('🔎 mostrarResumen con centro', c, 'línea', l);
  const cont = document.getElementById('resumenInventorio') || document.getElementById('resumenInventario');
  if (!cont) return;
  if (c == null || l == null) {
    cont.style.display = 'none';
    return;
  }
  const invs = Estado.centros[c].lines[l].inventarios || [];
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
 * Configura botón Conteo Rápido
 */
function initBotonConteo() {
  const btn = document.getElementById('btnAbrirConteo');
  console.log('🔴 initBotonConteo, btn=', btn);
  btn.addEventListener('click', () => {
    const c = window.selectedCentroIdx;
    const l = window.selectedLineaIdx;
    console.log('➕ btnAbrirConteo pulsado con', c, l);
    if (c == null || l == null) {
      M.toast({ html: 'Selecciona centro y línea', classes: 'red' });
      return;
    }
    // restaurada apertura de modal de conteo rápido
    abrirConteoLinea(c, l);
  });
}


// — Tablas Historial / Últimos —

function initTablaHistorial() {
  dtHist = $('#tablaInventariosLB').DataTable({
    data: [], autoWidth:false, scrollX:true, scrollCollapse:true,
    columns:[
      {title:'Fecha'},{title:'Centro'},{title:'Línea'},{title:'Tot'},
      {title:'NB Buenas'},{title:'NB Malas'},{title:'NA Buenas'},{title:'NA Malas'},
      {title:'Sueltas'},{title:'Colchas'},{title:'Estado Línea'},{title:'Obs'},
      {title:'Lat'},{title:'Lng'}
    ],
    dom:'Bfrtip',
    buttons:[
      {extend:'excelHtml5', title:'Historial_Lineas_Boyas'},
      {extend:'pdfHtml5', orientation:'landscape', pageSize:'A4'},
      'copy','print'
    ],
    language:{url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'}
  });
  console.log('📊 Tabla Historial inicializada');
}

async function refreshHistorial() {
  if (!dtHist) return;
  const centros = await getCentrosAll();
  const cIdx = window.selectedCentroIdx;
  const lIdx = window.selectedLineaIdx;
  const rows = [];
  centros.forEach((c,iC) => {
    (c.lines||[]).forEach((l,iL) => {
      if (cIdx!=null && iC!==cIdx) return;
      if (lIdx!=null && iL!==lIdx) return;
      (l.inventarios||[]).forEach(reg => {
        rows.push([
          fechaSolo(reg.fecha),
          c.name,
          l.number,
          reg.boyas.total,
          reg.boyas.negras.buenas,
          reg.boyas.negras.malas,
          reg.boyas.naranjas.buenas,
          reg.boyas.naranjas.malas,
          reg.sueltas,
          reg.colchas,
          reg.estadoLinea,
          reg.observaciones,
          reg.gps?.lat||'',
          reg.gps?.lng||''
        ]);
      });
    });
  });
  dtHist.clear().rows.add(rows).draw(false);
  console.log('🔄 Historial refrescado con', rows.length, 'filas');
}

function initTablaUltimos() {
  dtUltimos = $('#tablaUltimos').DataTable({
    data: [], autoWidth:false, scrollX:true, scrollCollapse:true,
    columns:[
      {title:'Centro'},{title:'Línea'},{title:'Fecha'},{title:'Tot'},
      {title:'NB Buenas'},{title:'NB Malas'},{title:'NA Buenas'},{title:'NA Malas'},
      {title:'Sueltas'},{title:'Colchas'},{title:'Estado Línea'},{title:'Obs'}
    ],
    dom:'Bfrtip',
    buttons:[
      {extend:'excelHtml5', title:'Últimos_Lineas_Boyas'},
      {extend:'pdfHtml5', orientation:'landscape', pageSize:'A4'},
      'copy','print'
    ],
    language:{url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'}
  });
  console.log('📊 Tabla Últimos inicializada');
}

async function refreshUltimosYResumen() {
  const centros = await getCentrosAll();
  ultimosData = [];
  const R = {
    totalBoyas:0, buenas:0, malas:0,
    negras:0, naranjas:0, sueltas:0, colchas:0,
    sinInv:0, lineasTotal:0, lineas_buenas:0, lineas_regulares:0, lineas_malas:0
  };
  centros.forEach(c => {
    (c.lines||[]).forEach(l => {
      R.lineasTotal++;
      const invs = l.inventarios||[];
      if (!invs.length) {
        ultimosData.push({ centro:c.name, linea:l.number, sinInv:true });
        R.sinInv++;
        return;
      }
      const u = invs[invs.length-1];
      const nb_b = u.boyas.negras.buenas, nb_m = u.boyas.negras.malas;
      const na_b = u.boyas.naranjas.buenas, na_m = u.boyas.naranjas.malas;
      const tot  = u.boyas.total;
      R.totalBoyas += tot;
      R.buenas     += nb_b + na_b;
      R.malas      += nb_m + na_m;
      R.negras     += nb_b + nb_m;
      R.naranjas   += na_b + na_m;
      R.sueltas    += u.sueltas;
      R.colchas    += u.colchas;
      const est = (u.estadoLinea||'').toLowerCase();
      if (est==='buena')    R.lineas_buenas++;
      if (est==='regular')  R.lineas_regulares++;
      if (est==='mala')     R.lineas_malas++;

      ultimosData.push({
        centro:c.name, linea:l.number,
        fecha:u.fecha, tot, nb_b, nb_m, na_b, na_m,
        sueltas:u.sueltas, colchas:u.colchas,
        estadoLinea:u.estadoLinea, obs:u.observaciones,
        sinInv:false
      });
    });
  });
  console.log('🔄 Datos Últimos calculados:', ultimosData.length, 'líneas');
  aplicarFiltrosUltimos();
  renderKPIs(R);
}

function aplicarFiltrosUltimos() {
  if (!dtUltimos) return;
  const rows = ultimosData
    .filter(r => {
      if (F.estadoLinea==='sinInv') return r.sinInv;
      if (F.estadoLinea!=='all' && !r.sinInv && (r.estadoLinea||'').toLowerCase()!==F.estadoLinea)
        return false;
      if (F.kpi && !r.sinInv) {
        switch(F.kpi) {
          case 'buenas':  return r.nb_b + r.na_b > 0;
          case 'malas':   return r.nb_m + r.na_m > 0;
          case 'negra':   return r.nb_b + r.nb_m > 0;
          case 'naranja': return r.na_b + r.na_m > 0;
          case 'suletas': return r.sueltas > 0;
          case 'colchas': return r.colchas > 0;
          case 'linea_buena':    return (r.estadoLinea||'').toLowerCase()==='buena';
          case 'linea_regular': return (r.estadoLinea||'').toLowerCase()==='regular';
          case 'linea_mala':    return (r.estadoLinea||'').toLowerCase()==='mala';
          default: return true;
        }
      }
      return true;
    })
    .map(r => [
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
  console.log('🔄 Tabla Últimos actualizada con', rows.length, 'filas');
}

function renderKPIs(r) {
  const wrap = document.getElementById('kpiGroups');
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
    <div class="kpi-mini" data-kpi="sueltas"><span class="valor">${r.sueltas}</span><span>Boyas sueltas</span></div>
    <div class="kpi-mini" data-kpi="colchas"><span class="valor">${r.colchas}</span><span>Colchas</span></div>
    <div class="kpi-mini" data-kpi="sinInv"><span class="valor">${r.sinInv}</span><span>Sin inventario</span></div>
  `;
  marcarActivos();
}

function marcarActivos() {
  document.querySelectorAll('#kpiGroups .subs span')
    .forEach(s => s.classList.toggle('active', s.dataset.kpi === F.kpi));
  document.querySelectorAll('#kpiGroups .kpi-mini')
    .forEach(c => c.classList.toggle('active', c.dataset.kpi === F.kpi));
}
