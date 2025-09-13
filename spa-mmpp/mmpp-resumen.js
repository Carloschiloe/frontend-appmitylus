/* /spa-mmpp/mmpp-resumen.js
   Resumen Proveedor × Mes con filtros y gráfico fijo.
   - Botón para alternar eje del gráfico: Proveedor ↔ Mes
   - Leyenda con volúmenes (totales por dataset)
   - No muestra proveedores con total 0 (según meses visibles)
   - Fila de "Total por mes"
   - Ocultar meses sin datos / selección rápida
   - Si window.Chart no existe, sólo muestra la tabla.
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  /* ---------- CSS ---------- */
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
    var sumByM = {}; for (var i=1;i<=12;i++) sumByM[i]=0;
    (rows||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.proveedor && (r.contactoNombre||r.proveedorNombre)!==filters.proveedor) return;
      if (filters.comuna && (r.comuna||"")!==filters.comuna) return;
      var m = Number(r.mes)||0;
      sumByM[m] += Number(r.tons||0)||0;
    });
    var out=[]; for (var mi=1; mi<=12; mi++) if (sumByM[mi]>0) out.push(mi);
    return out;
  }

  /* ---------- agrupar proveedor×mes ---------- */
  function groupProvMes(rows, filters, monthsToShow){
    var mapProv = {}; // { provName: { meses[1..12] } }
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

  /* ---------- UI ---------- */
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
              <button id="resAxisBtn" class="res-btn">Eje: Proveedor</button>\
              <button id="resToggle" class="res-btn">Ocultar</button>\
            </div>\
          </div>\
          <div class="res-filters" style="margin-bottom:10px">\
            <select id="resYear" class="res-select"></select>\
            <select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>\
            <select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>\
            <select id="resMeses" class="res-multi" multiple size="6"></select>\
          </div>\
          <div id="resContent">\
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

    var yNow = (new Date()).getFullYear();
    if (byYears.length===0) byYears = [yNow];
    var yDefault = byYears.indexOf(yNow)>=0 ? yNow : byYears[byYears.length-1];
    yearSel.innerHTML = byYears.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');

    provSel.innerHTML = '<option value="">Todos los contactos</option>' +
      byProv.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    comSel.innerHTML = '<option value="">Todas las comunas</option>' +
      byCom.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');

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
    var totalMes = {}; for (var i=0;i<monthsToShow.length;i++) totalMes[monthsToShow[i]]=0;
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

    html += '<tr style="background:#f8fafc;border-top:2px solid #e5e7eb">' +
            '<td><strong>💠 TOTAL POR MES</strong></td>';
    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i], v = totalMes[mi]||0;
      html += '<td class="res-right"><strong>'+(v ? numeroCL(v) : '')+'</strong></td>';
    }
    html += '<td class="res-right"><strong>'+numeroCL(totalVisible)+'</strong></td></tr>';

    if (!rows.length){
      html += '<tr><td colspan="'+(2+monthsToShow.length)+'" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }

    html += '</tbody></table>';
    document.getElementById('resTableWrap').innerHTML = html;
  }

  /* ---------- Gráfico ---------- */
  var chartRef = null;

  function buildDatasets_ProvAxis(rows, monthsToShow){
    // datasets = meses; labels = proveedores
    var labels = rows.map(function(r){ return r.proveedor; });
    var datasets = [];
    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i];
      var data = rows.map(function(r){ return r.meses[mi]||0; });
      var sum = data.reduce(function(a,b){return a + (Number(b)||0);},0);
      datasets.push({
        label: pad2(mi)+' '+MMESES[mi-1]+' · '+numeroCL(sum)+'t',
        data: data,
        borderWidth: 1
      });
    }
    return { labels: labels, datasets: datasets };
  }

  function buildDatasets_MesAxis(rows, monthsToShow){
    // datasets = proveedores; labels = meses
    var labels = monthsToShow.map(function(mi){ return pad2(mi)+' '+MMESES[mi-1]; });

    // top 12 por total visible
    var top = rows.slice(0, 12);
    var datasets = top.map(function(r){
      var data = monthsToShow.map(function(mi){ return r.meses[mi]||0; });
      var sum = data.reduce(function(a,b){return a + (Number(b)||0);},0);
      return {
        label: r.proveedor+' · '+numeroCL(sum)+'t',
        data: data,
        borderWidth: 1
      };
    });
    return { labels: labels, datasets: datasets };
  }

  function renderChart(rows, filters, monthsToShow, mode){
    var canvas = document.getElementById('resChart');
    var noteEl = document.getElementById('resChartNote');
    if (!canvas) return;

    // sin Chart.js -> limpiar
    if (!global.Chart){
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (noteEl) noteEl.textContent = 'Gráfico deshabilitado (Chart.js no presente).';
      return;
    }

    var cfg = (mode==='mes')
      ? buildDatasets_MesAxis(rows, monthsToShow)
      : buildDatasets_ProvAxis(rows, monthsToShow);

    var totalAll = (cfg.datasets||[]).reduce(function(acc, ds){
      return acc + (ds.data||[]).reduce(function(a,b){return a+(+b||0);},0);
    }, 0);

    if (chartRef && chartRef.destroy) chartRef.destroy();

    if (!cfg.labels.length || totalAll<=0){
      var ctx2 = canvas.getContext('2d');
      ctx2.clearRect(0,0,canvas.width,canvas.height);
      if (noteEl) noteEl.textContent = 'No hay datos para graficar con los filtros/meses actuales.';
      return;
    }

    var ctx = canvas.getContext('2d');
    chartRef = new Chart(ctx, {
      type: 'bar',
      data: { labels: cfg.labels, datasets: cfg.datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
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
    hideZeroMonths: true,
    chartMode: 'prov' // 'prov' | 'mes'
  };

  function getMonthsToShow(){
    if (STATE.filters.months && STATE.filters.months.length) return STATE.filters.months.slice();
    if (STATE.hideZeroMonths){
      var withData = mesesConDatos(STATE.dispon, STATE.filters);
      if (withData.length) return withData;
    }
    return range12();
  }

  function refresh(){
    var monthsToShow = getMonthsToShow();
    var rows = groupProvMes(STATE.dispon, STATE.filters, monthsToShow);
    renderTable(rows, STATE.filters, monthsToShow);
    renderChart(rows, STATE.filters, monthsToShow, STATE.chartMode);
  }

  function updateAxisBtnLabel(){
    var btn = document.getElementById('resAxisBtn');
    if (!btn) return;
    btn.textContent = (STATE.chartMode==='prov') ? 'Eje: Proveedor' : 'Eje: Mes';
  }

  function attachEvents(){
    ['resYear','resProv','resComuna','resMeses'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function(){
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    });

    var chk = document.getElementById('resHideEmptyMonths');
    if (chk){
      chk.addEventListener('change', function(){
        STATE.hideZeroMonths = !!chk.checked;
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

    var axisBtn = document.getElementById('resAxisBtn');
    if (axisBtn){
      axisBtn.addEventListener('click', function(){
        STATE.chartMode = (STATE.chartMode==='prov') ? 'mes' : 'prov';
        updateAxisBtnLabel();
        refresh();
      });
    }

    var toggle = document.getElementById('resToggle');
    if (toggle){
      toggle.addEventListener('click', function(){
        var content = document.getElementById('resContent');
        var hidden = content.style.display==='none';
        content.style.display = hidden ? '' : 'none';
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
      STATE.filters = getFiltersFromUI();
      updateAxisBtnLabel();
      attachEvents();
      refresh();
    }

    if (opts && Array.isArray(opts.dispon)) return go(opts.dispon);
    if (global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      global.MMppApi.getDisponibilidades().then(go).catch(function(){ go([]); });
    } else {
      go([]);
    }
  }

  global.MMppResumen = { mount: mount, refresh: refresh };
})(window);
