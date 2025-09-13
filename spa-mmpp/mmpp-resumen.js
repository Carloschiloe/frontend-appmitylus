/* /spa-mmpp/mmpp-resumen.js
   - Meses en una sola fila (grid de 12 columnas, sin scroll)
   - Tooltip por tramo: "Proveedor (comunas) · X t"
   - Etiqueta del TOTAL arriba de cada pila (plugin custom)
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('mmpp-resumen-css-h1')) return;
    var css = `
    .res-wrap{max-width:1200px;margin:0 auto}
    .res-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}
    .res-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .res-title{margin:0;font-weight:800;color:#2b3440}
    .res-filters{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:10px}
    .res-select{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}
    .res-actions{display:flex;gap:8px;flex-wrap:wrap}
    .res-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}
    .res-table{width:100%;border-collapse:separate;border-spacing:0 8px}
    .res-table th,.res-table td{padding:10px 8px}
    .res-table tr{background:#fff;border:1px solid #e5e7eb}
    .res-table th{font-weight:800;color:#475569}
    .res-right{text-align:right}
    .res-sticky-head thead th{position:sticky;top:0;background:#f8fafc;z-index:1}
    .res-muted{opacity:.45}

    /* Meses: UNA sola fila (12 columnas), sin scroll */
    .res-months-row{grid-column:1 / -1; margin:8px 0 6px;}
    .res-months-bar{
      display:grid;
      grid-template-columns:repeat(12, minmax(0, 1fr));
      gap:8px;
      padding:6px 0;
      border-top:1px dashed #e5e7eb; border-bottom:1px dashed #e5e7eb;
      overflow:hidden; /* sin scroll */
    }
    .res-chip{
      width:100%; height:34px;
      display:inline-flex; align-items:center; justify-content:center;
      border:1px solid #e5e7eb; background:#fafafa;
      border-radius:999px; font-weight:700; cursor:pointer; user-select:none;
      font-size:13px; padding:0 6px;
    }
    .res-chip.sel{ background:#1e40af; color:#fff; border-color:#1e40af }
    .res-chip:hover{ filter:brightness(.97) }

    /* Gráfico fijo */
    .res-chart-wrap{margin-top:14px}
    .res-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
    .res-chart-canvas{display:block;width:980px !important;height:360px !important}
    .res-chart-scroll{overflow-x:auto}
    `;
    var s = document.createElement('style'); s.id = 'mmpp-resumen-css-h1'; s.textContent = css;
    document.head.appendChild(s);
  }

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }

  /* ---------- Agrupar proveedor×mes ---------- */
  function groupProvMes(rows, filters){
    filters = filters||{};
    var y = filters.year||null;
    var mesesSel = (filters.months && filters.months.length) ? filters.months.slice() : null;
    var provSel = (filters.proveedor||'').trim();
    var comunaSel = (filters.comuna||'').trim();

    var mapProv = {}; // { provName: { m: [..12], comunas:Set } }
    (rows||[]).forEach(function(r){
      if (y && String(r.anio)!==String(y)) return;
      if (provSel && (r.contactoNombre||r.proveedorNombre)!==provSel) return;
      if (comunaSel && (r.comuna||'')!==comunaSel) return;

      var prov = r.contactoNombre || r.proveedorNombre || '—';
      var m = Number(r.mes)||0;
      var tons = Number(r.tons||0)||0;

      if (!mapProv[prov]) mapProv[prov] = {prov:prov, m: Array(13).fill(0), comunas:new Set()};
      mapProv[prov].m[m] += tons;
      if (r.comuna) mapProv[prov].comunas.add(r.comuna);
    });

    var out = Object.keys(mapProv).map(function(k){
      var obj = mapProv[k], total=0;
      for (var mi=1; mi<=12; mi++){
        if (!mesesSel || mesesSel.indexOf(mi)>=0) total += obj.m[mi];
      }
      return {
        proveedor: obj.prov,
        meses: obj.m,
        comunas: Array.from(obj.comunas).join(', '),
        total: total
      };
    }).filter(function(r){ return r.total>0; })
      .sort(function(a,b){ return (b.total||0)-(a.total||0); });

    return out;
  }

  function uniqSorted(arr){
    var set={}, out=[]; (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort(); return out;
  }

  /* ---------- UI ---------- */
  function buildUI(root){
    root.innerHTML = `
      <div class="res-wrap">
        <div class="res-card">
          <div class="res-head" style="margin-bottom:10px">
            <h2 class="res-title">Resumen por mes (Proveedor × Mes)</h2>
            <div class="res-actions">
              <button id="btnMonthsHasData" class="res-btn">Meses con datos</button>
              <button id="btnMonthsClear" class="res-btn">Limpiar meses</button>
              <button id="resToggle" class="res-btn">Ocultar</button>
            </div>
          </div>

          <div class="res-filters" style="margin-bottom:6px">
            <select id="resYear" class="res-select"></select>
            <select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>
            <select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>

            <!-- Meses: UNA sola fila -->
            <div class="res-months-row">
              <div id="resMonthsBar" class="res-months-bar" aria-label="Meses (timeline)"></div>
            </div>
          </div>

          <div id="resTableWrap" class="res-sticky-head"></div>

          <div class="res-chart-wrap">
            <div class="res-chart-scroll">
              <div class="res-chart-frame">
                <canvas id="resChart" class="res-chart-canvas" width="980" height="360"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function fillFilters(data, selected){
    selected = selected||{};
    var byYears = uniqSorted((data||[]).map(function(d){return d.anio;}).filter(Boolean));
    var byProv  = uniqSorted((data||[]).map(function(d){return d.contactoNombre||d.proveedorNombre;}).filter(Boolean));
    var byCom   = uniqSorted((data||[]).map(function(d){return d.comuna;}).filter(Boolean));

    var yearSel = document.getElementById('resYear');
    var provSel = document.getElementById('resProv');
    var comSel  = document.getElementById('resComuna');

    var yNow = (new Date()).getFullYear();
    yearSel.innerHTML = byYears.map(function(y){return '<option value="'+y+'" '+(String(y)===String(selected.year||yNow)?'selected':'')+'>'+y+'</option>';}).join('');
    provSel.innerHTML = '<option value="">Todos los contactos</option>' +
      byProv.map(function(p){ return '<option value="'+p+'" '+(p===(selected.proveedor||'')?'selected':'')+'>'+p+'</option>'; }).join('');
    comSel.innerHTML = '<option value="">Todas las comunas</option>' +
      byCom.map(function(c){ return '<option value="'+c+'" '+(c===(selected.comuna||'')?'selected':'')+'>'+c+'</option>'; }).join('');

    buildMonthsTimeline(selected.months||[]);
  }

  /* Meses en una sola fila */
  function buildMonthsTimeline(selectedMonths){
    selectedMonths = Array.isArray(selectedMonths) ? selectedMonths.slice() : [];
    var bar = document.getElementById('resMonthsBar');
    var html = '';
    for (var i=1;i<=12;i++){
      var sel = selectedMonths.indexOf(i)>=0 ? ' sel' : '';
      html += '<span class="res-chip'+sel+'" data-m="'+i+'">'+pad2(i)+' · '+MMESES[i-1]+'</span>';
    }
    bar.innerHTML = html;

    // listeners
    bar.querySelectorAll('.res-chip[data-m]').forEach(function(el){
      el.addEventListener('click', function(){
        var m = Number(this.getAttribute('data-m'));
        var idx = STATE.filters.months.indexOf(m);
        if (idx>=0) STATE.filters.months.splice(idx,1);
        else STATE.filters.months.push(m);
        refresh();
      });
    });
  }

  /* ---------- Tabla ---------- */
  function renderTable(rows, filters){
    var mesesSel = (filters.months && filters.months.length) ? filters.months.slice() : null;
    var mutedCol = function(mi){ return mesesSel && mesesSel.indexOf(mi)<0 ? ' res-muted' : ''; };

    var yearTxt = filters.year ? ' ' + filters.year : '';
    var html = '<table class="res-table"><thead><tr>' +
               '<th>PROVEEDOR / CONTACTO</th>' +
               MMESES.map(function(n, i){ return '<th class="res-right'+mutedCol(i+1)+'">'+n.toUpperCase()+'</th>'; }).join('') +
               '<th class="res-right">TOTAL'+yearTxt+'</th></tr></thead><tbody>';

    rows.forEach(function(r){
      html += '<tr><td><strong>'+r.proveedor+'</strong><div style="color:#6b7280;font-size:12px">'+(r.comunas||'')+'</div></td>';
      for (var mi=1; mi<=12; mi++){
        var v = r.meses[mi]||0;
        var show = (!mesesSel || mesesSel.indexOf(mi)>=0) ? v : 0;
        html += '<td class="res-right'+mutedCol(mi)+'">'+(show?numeroCL(show):'0')+'</td>';
      }
      html += '<td class="res-right"><strong>'+numeroCL(r.total)+'</strong></td></tr>';
    });

    if (!rows.length){
      html += '<tr><td colspan="14" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }

    html += '</tbody></table>';
    document.getElementById('resTableWrap').innerHTML = html;
  }

  /* ---------- Gráfico ---------- */
  var chartRef = null;

  // Plugin liviano para escribir el TOTAL arriba de cada pila
  var StackTotalsPlugin = {
    id: 'stackTotals',
    afterDatasetsDraw(chart, args, opts){
      var ctx = chart.ctx;
      var xScale = chart.scales.x;
      var yScale = chart.scales.y;
      var labels = chart.data.labels||[];
      if (!labels.length) return;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillStyle = '#111827';

      for (var i=0;i<labels.length;i++){
        var total = 0;
        chart.data.datasets.forEach(function(ds){
          var v = Number(ds.data[i]||0);
          if (!isNaN(v)) total += v;
        });
        if (total>0){
          var x = xScale.getPixelForValue(i);
          var y = yScale.getPixelForValue(total);
          ctx.fillText(numeroCL(total), x, y - 6);
        }
      }
      ctx.restore();
    }
  };

  function prepareChartData(rows, filters){
    var months = (filters.months && filters.months.length) ? filters.months.slice() : Array.from({length:12}, (_,i)=>i+1);
    var labels = rows.map(function(r){ return r.proveedor; });

    var providerMeta = {};
    rows.forEach(function(r){ providerMeta[r.proveedor] = { comunas:r.comunas||'', total:r.total||0 }; });

    var datasets = months.map(function(mi){
      return {
        label: pad2(mi)+' '+MMESES[mi-1],
        data: rows.map(function(r){ return r.meses[mi]||0; }),
        borderWidth: 1,
        stack: 'tons'
      };
    });

    return { labels: labels, datasets: datasets, providerMeta: providerMeta };
  }

  function renderChart(rows, filters){
    var canvas = document.getElementById('resChart');
    if (!canvas) return;

    if (!global.Chart){
      var ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); return;
    }

    var cfg = prepareChartData(rows, filters);
    if (chartRef && chartRef.destroy) chartRef.destroy();

    var ctx2 = canvas.getContext('2d');
    chartRef = new Chart(ctx2, {
      type: 'bar',
      data: { labels: cfg.labels, datasets: cfg.datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              title: function(items){ return items && items[0] ? items[0].label : ''; }, // proveedor
              label: function(item){
                var prov = item.label || '';
                var comunas = (cfg.providerMeta[prov] && cfg.providerMeta[prov].comunas) ? (' ('+cfg.providerMeta[prov].comunas+')') : '';
                var v = item.parsed.y != null ? item.parsed.y : item.parsed;
                return prov + comunas + ' · ' + numeroCL(v) + ' t';
              },
              afterLabel: function(){ return ''; }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } },
          y: { stacked: true, beginAtZero: true }
        }
      },
      plugins: [StackTotalsPlugin] // ← etiqueta de total arriba de la pila
    });
  }

  /* ---------- Estado + eventos ---------- */
  var STATE = { dispon: [], filters:{year:null, months:[], proveedor:"", comuna:""} };

  function getFiltersFromUI(){
    var year   = document.getElementById('resYear').value;
    var prov   = document.getElementById('resProv').value;
    var comuna = document.getElementById('resComuna').value;
    return { year: year, months: STATE.filters.months.slice(), proveedor: prov, comuna: comuna };
  }

  function attachEvents(){
    ['resYear','resProv','resComuna'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function(){
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    });

    // Atajos de meses (ahora en la barra de acciones)
    var btnHas = document.getElementById('btnMonthsHasData');
    if (btnHas) btnHas.addEventListener('click', function(){
      var rows = groupProvMes(STATE.dispon, STATE.filters);
      var has = new Array(13).fill(0);
      rows.forEach(function(r){ for (var i=1;i<=12;i++){ has[i]+= (r.meses[i]||0); } });
      STATE.filters.months = [];
      for (var i=1;i<=12;i++) if (has[i]>0) STATE.filters.months.push(i);
      refresh();
    });
    var btnClr = document.getElementById('btnMonthsClear');
    if (btnClr) btnClr.addEventListener('click', function(){ STATE.filters.months = []; refresh(); });

    var toggle = document.getElementById('resToggle');
    if (toggle){
      toggle.addEventListener('click', function(){
        var chartWrap = document.querySelector('.res-chart-wrap');
        if (chartWrap.style.display==='none'){
          chartWrap.style.display = '';
          toggle.textContent = 'Ocultar';
        } else {
          chartWrap.style.display = 'none';
          toggle.textContent = 'Mostrar gráfico';
        }
      });
    }
  }

  function refresh(){
    buildMonthsTimeline(STATE.filters.months);
    var rows = groupProvMes(STATE.dispon, STATE.filters);
    renderTable(rows, STATE.filters);
    renderChart(rows, STATE.filters);
  }

  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppResumen');
    if (!root){ console.warn('[mmpp-resumen] No existe #mmppResumen'); return; }
    buildUI(root);

    function go(data){
      STATE.dispon = Array.isArray(data) ? data : [];
      var yNow = (new Date()).getFullYear();
      STATE.filters.year = String(yNow);
      STATE.filters.months = [];
      fillFilters(STATE.dispon, STATE.filters);
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

