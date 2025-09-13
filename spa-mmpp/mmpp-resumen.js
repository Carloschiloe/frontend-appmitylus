/* /spa-mmpp/mmpp-resumen.js
   Resumen Proveedor × Mes con filtros y gráfico fijo.
   - No muestra proveedores con total 0 (sobre meses visibles)
   - Fila de "Total por mes"
   - Ocultar meses sin datos / selección rápida
   - Si window.Chart existe, pinta barras apiladas; si no, sólo tabla.
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  /* ---------- CSS: fija tamaño del gráfico y estilos del resumen ---------- */
  function injectCSS(){
    if (document.getElementById('mmpp-resumen-css')) return;
    var css = '\
    .res-wrap{max-width:1200px;margin:0 auto}\
    .res-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}\
    .res-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\
    .res-title{margin:0;font-weight:800;color:#2b3440}\
    .res-filters{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:10px;align-items:center}\
    .res-select,.res-multi{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}\
    .res-multi{height:160px;padding:8px}\
    .res-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\
    .res-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}\
    .res-table{width:100%;border-collapse:separate;border-spacing:0 8px}\
    .res-table th,.res-table td{padding:10px 8px}\
    .res-table tr{background:#fff;border:1px solid #e5e7eb}\
    .res-table th{font-weight:800;color:#475569}\
    .res-right{text-align:right}\
    .res-sticky-head thead th{position:sticky;top:0;background:#f8fafc;z-index:1}\
    .res-muted{opacity:.45}\
    .res-chart-wrap{margin-top:14px}\
    .res-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}\
    .res-chart-canvas{display:block;width:980px !important;height:360px !important}\
    .res-chart-scroll{overflow-x:auto}\
    .res-note{color:#64748b;font-size:12px;margin-top:6px}\
    ';
    var s = document.createElement('style');
    s.id = 'mmpp-resumen-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }
  function range12(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; }
  function uniqSorted(arr){
    var set = {}, out=[];
    (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort();
    return out;
  }

  /* ---------- util: meses con datos según filtros ---------- */
  function mesesConDatos(rows, filters){
    var sumByM = {};
    for (var i=1;i<=12;i++) sumByM[i]=0;

    (rows||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.proveedor && (r.contactoNombre||r.proveedorNombre)!==filters.proveedor) return;
      if (filters.comuna && (r.comuna||"")!==filters.comuna) return;
      var m = Number(r.mes)||0;
      sumByM[m] += Number(r.tons||0)||0;
    });

    var out=[];
    for (var mi=1; mi<=12; mi++) if (sumByM[mi]>0) out.push(mi);
    return out;
  }

  /* ---------- util: agrupar proveedor×mes ---------- */
  function groupProvMes(rows, filters, monthsToShow){
    var mapProv = {}; // { provName: { m[1..12], totalVisible } }
    (rows||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.proveedor && (r.contactoNombre||r.proveedorNombre)!==filters.proveedor) return;
      if (filters.comuna && (r.comuna||"")!==filters.comuna) return;

      var prov = r.contactoNombre || r.proveedorNombre || '—';
      var m = Number(r.mes)||0;
      var tons = Number(r.tons||0)||0;

      if (!mapProv[prov]) mapProv[prov] = {prov:prov, meses:Array(13).fill(0)};
      mapProv[prov].meses[m] += tons;
    });

    // salida ordenada por total visible desc y SIN filas con total 0
    var out = [];
    var keys = Object.keys(mapProv);
    for (var k=0; k<keys.length; k++){
      var obj = mapProv[keys[k]];
      var total=0;
      for (var i=0;i<monthsToShow.length;i++){
        var mi = monthsToShow[i];
        total += Number(obj.meses[mi]||0);
      }
      if (total>0) out.push({ proveedor: obj.prov, meses: obj.meses, total: total });
    }
    out.sort(function(a,b){ return (b.total||0)-(a.total||0); });

    return out;
  }

  /* ---------- UI: build ---------- */
  function buildUI(root){
    root.innerHTML = '\
      <div class="res-wrap">\
        <div class="res-card">\
          <div class="res-head" style="margin-bottom:10px">\
            <h2 class="res-title">Resumen por mes (Proveedor × Mes)</h2>\
            <div class="res-actions">\
              <label style="display:flex;gap:8px;align-items:center">\
                <input id="resHideEmptyMonths" type="checkbox" checked />\
                <span>Ocultar meses sin datos</span>\
              </label>\
              <button id="resBtnMesesConDatos" class="res-btn">Meses con datos</button>\
              <button id="resBtnLimpiarMeses" class="res-btn">Limpiar meses</button>\
              <button id="resToggle" class="res-btn">Ocultar</button>\
            </div>\
          </div>\
          <div class="res-filters" style="margin-bottom:10px">\
            <select id="resYear" class="res-select"></select>\
            <select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>\
            <select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>\
            <select id="resMeses" class="res-multi" multiple size="6"></select>\
          </div>\
          <div id="resTableWrap" class="res-sticky-head"></div>\
          <div class="res-chart-wrap">\
            <div class="res-chart-scroll">\
              <div class="res-chart-frame">\
                <canvas id="resChart" class="res-chart-canvas" width="980" height="360"></canvas>\
              </div>\
            </div>\
            <div id="resChartNote" class="res-note"></div>\
          </div>\
        </div>\
      </div>';
  }

  function fillFilters(data){
    var byYears = uniqSorted((data||[]).map(function(d){return d.anio;}).filter(Boolean));
    var byProv  = uniqSorted((data||[]).map(function(d){return d.contactoNombre||d.proveedorNombre;}).filter(Boolean));
    var byCom   = uniqSorted((data||[]).map(function(d){return d.comuna;}).filter(Boolean));

    var yearSel = document.getElementById('resYear');
    var provSel = document.getElementById('resProv');
    var comSel  = document.getElementById('resComuna');
    var mesesSel= document.getElementById('resMeses');

    // Año (elige actual si existe; si no, el último)
    var yNow = (new Date()).getFullYear();
    if (byYears.length===0) byYears = [yNow];
    var yDefault = byYears.indexOf(yNow)>=0 ? yNow : byYears[byYears.length-1];
    yearSel.innerHTML = byYears.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');

    // Proveedor
    provSel.innerHTML = '<option value="">Todos los contactos</option>' +
      byProv.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    // Comuna
    comSel.innerHTML = '<option value="">Todas las comunas</option>' +
      byCom.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');

    // Meses (multi)
    mesesSel.innerHTML = range12().map(function(m){
      return '<option value="'+m+'">'+pad2(m)+' · '+MMESES[m-1]+'</option>';
    }).join('');
  }

  function getFiltersFromUI(){
    var year   = document.getElementById('resYear').value;
    var prov   = document.getElementById('resProv').value;
    var comuna = document.getElementById('resComuna').value;
    var msEl   = document.getElementById('resMeses');
    var months = Array.prototype.slice.call(msEl.selectedOptions||[]).map(function(o){return Number(o.value)||0;});
    return { year: year, months: months, proveedor: prov, comuna: comuna };
  }

  function setMonthsSelection(months){
    var msEl   = document.getElementById('resMeses');
    var opts = msEl ? msEl.options : [];
    for (var i=0;i<opts.length;i++){
      var v = Number(opts[i].value)||0;
      opts[i].selected = months.indexOf(v)>=0;
    }
  }

  /* ---------- Tabla (con fila de totales) ---------- */
  function renderTable(rows, filters, monthsToShow){
    var totalMes = {};
    for (var i=0;i<monthsToShow.length;i++) totalMes[monthsToShow[i]]=0;

    rows.forEach(function(r){
      for (var i=0;i<monthsToShow.length;i++){
        var mi = monthsToShow[i];
        totalMes[mi] += Number(r.meses[mi]||0);
      }
    });

    var totalVisible = rows.reduce(function(acc, r){ return acc + (Number(r.total)||0); }, 0);

    var html = '<table class="res-table"><thead><tr>' +
               '<th>PROVEEDOR / CONTACTO</th>';

    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i];
      html += '<th class="res-right">'+MMESES[mi-1].toUpperCase()+'</th>';
    }
    html += '<th class="res-right">TOTAL '+(filters.year||'')+'</th></tr></thead><tbody>';

    rows.forEach(function(r){
      html += '<tr><td><strong>'+r.proveedor+'</strong></td>';
      for (var i=0;i<monthsToShow.length;i++){
        var mi = monthsToShow[i];
        var v = r.meses[mi]||0;
        html += '<td class="res-right">'+(v ? numeroCL(v) : '')+'</td>';
      }
      html += '<td class="res-right"><strong>'+numeroCL(r.total)+'</strong></td></tr>';
    });

    // totales
    html += '<tr style="background:#f8fafc;border-top:2px solid #e5e7eb">' +
            '<td><strong>💠 TOTAL POR MES</strong></td>';
    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i];
      var v = totalMes[mi]||0;
      html += '<td class="res-right"><strong>'+(v ? numeroCL(v) : '')+'</strong></td>';
    }
    html += '<td class="res-right"><strong>'+numeroCL(totalVisible)+'</strong></td></tr>';

    if (!rows.length){
      html += '<tr><td colspan="'+(2+monthsToShow.length)+'" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }

    html += '</tbody></table>';
    document.getElementById('resTableWrap').innerHTML = html;
  }

  /* ---------- Gráfico (fijo). Usa Chart.js si está; si no, limpia canvas ---------- */
  var chartRef = null;
  function renderChart(rows, filters, monthsToShow){
    var canvas = document.getElementById('resChart');
    var noteEl = document.getElementById('resChartNote');
    if (!canvas) return;

    // si no hay Chart.js, sólo limpiamos
    if (!global.Chart){
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (noteEl) noteEl.textContent = 'Cargando gráfico deshabilitado (Chart.js no presente).';
      return;
    }

    // Top N proveedores (por total visible)
    var top = rows.slice(0, 12);
    // ¿hay datos?
    var totalAll = top.reduce(function(a,r){ return a + (r.total||0); }, 0);

    if (chartRef && chartRef.destroy) chartRef.destroy();

    if (!top.length || totalAll<=0){
      var ctx2 = canvas.getContext('2d');
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      if (noteEl) noteEl.textContent = 'No hay datos para graficar con los filtros/meses actuales.';
      return;
    }

    var labels = top.map(function(r){ return r.proveedor; });
    var datasets = [];
    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i];
      datasets.push({
        label: pad2(mi)+' '+MMESES[mi-1],
        data: top.map(function(r){ return r.meses[mi]||0; }),
        borderWidth: 1,
        // sin colores fijos: Chart.js asigna por defecto
      });
    }

    var ctx = canvas.getContext('2d');
    chartRef = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: false,          // fijo
        maintainAspectRatio: false, // fijo
        animation: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true }
        }
      }
    });
    if (noteEl) noteEl.textContent = '';
  }

  /* ---------- Estado + montaje ---------- */
  var STATE = {
    dispon: [],
    filters:{year:null, months:[], proveedor:"", comuna:""},
    hideZeroMonths: true
  };

  function getMonthsToShow(){
    // 1) si el usuario seleccionó meses → esos
    if (STATE.filters.months && STATE.filters.months.length) {
      return STATE.filters.months.slice();
    }
    // 2) si "ocultar meses sin datos" → sólo los que tienen datos
    if (STATE.hideZeroMonths){
      var withData = mesesConDatos(STATE.dispon, STATE.filters);
      if (withData.length) return withData;
    }
    // 3) todos
    return range12();
  }

  function refresh(){
    var monthsToShow = getMonthsToShow();

    var rows = groupProvMes(STATE.dispon, STATE.filters, monthsToShow);
    renderTable(rows, STATE.filters, monthsToShow);
    renderChart(rows, STATE.filters, monthsToShow);
  }

  function attachEvents(){
    var ids = ['resYear','resProv','resComuna','resMeses'];
    for (var i=0;i<ids.length;i++){
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.addEventListener('change', function(){
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    }

    var chk = document.getElementById('resHideEmptyMonths');
    if (chk){
      chk.addEventListener('change', function(){
        STATE.hideZeroMonths = !!chk.checked;
        // si no hay meses seleccionados manualmente, se recalcula meses visibles
        refresh();
      });
    }

    var btnDatos = document.getElementById('resBtnMesesConDatos');
    if (btnDatos){
      btnDatos.addEventListener('click', function(){
        STATE.filters = getFiltersFromUI();
        var md = mesesConDatos(STATE.dispon, STATE.filters);
        setMonthsSelection(md);
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    }

    var btnClear = document.getElementById('resBtnLimpiarMeses');
    if (btnClear){
      btnClear.addEventListener('click', function(){
        setMonthsSelection([]);
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    }

    var toggle = document.getElementById('resToggle');
    if (toggle){
      toggle.addEventListener('click', function(){
        var chartWrap = document.querySelector('.res-chart-wrap');
        var tableWrap = document.getElementById('resTableWrap').parentNode; // card intern
        var hidden = tableWrap.style.display==='none';
        tableWrap.style.display = hidden ? '' : 'none';
        if (chartWrap) chartWrap.style.display = hidden ? '' : 'none';
        toggle.textContent = hidden ? 'Ocultar' : 'Mostrar';
      });
    }
  }

  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppResumen');
    if (!root){ console.warn('[mmpp-resumen] No existe #mmppResumen'); return; }
    buildUI(root);

    function go(data){
      STATE.dispon = Array.isArray(data) ? data : [];
      fillFilters(STATE.dispon);
      STATE.filters = getFiltersFromUI();         // con año por defecto
      attachEvents();
      refresh();
    }

    // fuente de datos
    if (opts && Array.isArray(opts.dispon)) return go(opts.dispon);
    if (global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      global.MMppApi.getDisponibilidades().then(go).catch(function(){ go([]); });
    } else {
      go([]);
    }
  }

  // API pública
  global.MMppResumen = { mount: mount, refresh: refresh };
})(window);
