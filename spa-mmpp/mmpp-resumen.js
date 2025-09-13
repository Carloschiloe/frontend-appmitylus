/* /spa-mmpp/mmpp-resumen.js
   Resumen Proveedor × Mes con:
   - Meses en chips horizontales (segmentación)
   - Ocultar meses sin datos / Meses con datos / Limpiar meses
   - Alternar eje del gráfico (Proveedor ↔ Mes)
   - Tooltip por tramo (solo proveedor/mes hovered)
   - Etiquetas de total sobre barras apiladas
   - Leyenda con volúmenes por dataset
   - Tabla con fila de "Total por mes" y ocultando filas en cero
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('mmpp-resumen-css')) return;
    var css = ''
    +'.res-wrap{max-width:1200px;margin:0 auto}'
    +'.res-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
    +'.res-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'
    +'.res-title{margin:0;font-weight:800;color:#2b3440}'
    +'.res-filters{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr)) 1fr;gap:10px;align-items:center}'
    +'.res-select{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
    +'.res-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
    +'.res-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
    +'.res-table{width:100%;border-collapse:separate;border-spacing:0 8px}'
    +'.res-table th,.res-table td{padding:10px 8px}'
    +'.res-table tr{background:#fff;border:1px solid #e5e7eb}'
    +'.res-table th{font-weight:800;color:#475569}'
    +'.res-right{text-align:right}'
    +'.res-sticky-head thead th{position:sticky;top:0;background:#f8fafc;z-index:1}'
    +'.res-chart-wrap{margin-top:14px}'
    +'.res-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}'
    +'.res-chart-canvas{display:block;width:980px !important;height:360px !important}'
    +'.res-chart-scroll{overflow-x:auto}'
    +'.res-note{color:#64748b;font-size:12px;margin-top:6px}'
    /* chips meses */
    +'.res-months{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
    +'.res-chip{border:1px solid #c7d2fe;background:#eef2ff;color:#1e40af;border-radius:999px;padding:6px 10px;font-weight:700;cursor:pointer;user-select:none}'
    +'.res-chip.is-on{background:#1e40af;color:#fff;border-color:#1e40af}'
    ;
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

  /* ---------- meses con datos según filtros ---------- */
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
  function groupProvMes(rows, filters){
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
      out.push({ proveedor: obj.prov, meses: obj.meses });
    }
    return out;
  }

  /* ---------- UI ---------- */
  function buildUI(root){
    root.innerHTML = ''
    +'<div class="res-wrap">'
      +'<div class="res-card">'
        +'<div class="res-head" style="margin-bottom:10px">'
          +'<h2 class="res-title">Resumen por mes (Proveedor × Mes)</h2>'
          +'<div class="res-actions">'
            +'<label style="display:flex;gap:8px;align-items:center">'
              +'<input id="resHideEmptyMonths" type="checkbox" checked />'
              +'<span>Ocultar meses sin datos</span>'
            +'</label>'
            +'<button id="resBtnMesesConDatos" class="res-btn">Meses con datos</button>'
            +'<button id="resBtnLimpiarMeses" class="res-btn">Limpiar meses</button>'
            +'<button id="resAxisBtn" class="res-btn">Eje: Proveedor</button>'
            +'<button id="resToggle" class="res-btn">Ocultar</button>'
          +'</div>'
        +'</div>'

        +'<div class="res-filters" style="margin-bottom:10px">'
          +'<select id="resYear" class="res-select"></select>'
          +'<select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>'
          +'<select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>'
          +'<div id="resMonths" class="res-months"></div>'
        +'</div>'

        +'<div id="resContent">'
          +'<div id="resTableWrap" class="res-sticky-head"></div>'
          +'<div class="res-chart-wrap">'
            +'<div class="res-chart-scroll">'
              +'<div class="res-chart-frame">'
                +'<canvas id="resChart" class="res-chart-canvas" width="980" height="360"></canvas>'
              +'</div>'
            +'</div>'
            +'<div id="resChartNote" class="res-note"></div>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }

  function fillFilters(data){
    var byYears = uniqSorted((data||[]).map(function(d){return d.anio;}).filter(Boolean));
    var byProv  = uniqSorted((data||[]).map(function(d){return d.contactoNombre||d.proveedorNombre;}).filter(Boolean));
    var byCom   = uniqSorted((data||[]).map(function(d){return d.comuna;}).filter(Boolean));

    var yearSel = document.getElementById('resYear');
    var provSel = document.getElementById('resProv');
    var comSel  = document.getElementById('resComuna');
    var monthsDiv = document.getElementById('resMonths');

    var yNow = (new Date()).getFullYear();
    if (byYears.length===0) byYears = [yNow];
    var yDefault = byYears.indexOf(yNow)>=0 ? yNow : byYears[byYears.length-1];
    yearSel.innerHTML = byYears.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');

    provSel.innerHTML = '<option value="">Todos los contactos</option>' +
      byProv.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    comSel.innerHTML = '<option value="">Todas las comunas</option>' +
      byCom.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');

    monthsDiv.innerHTML = range12().map(function(m){
      return '<span class="res-chip" data-m="'+m+'">'+pad2(m)+' · '+MMESES[m-1]+'</span>';
    }).join('');
  }

  function getSelectedMonths(){
    var monthsDiv = document.getElementById('resMonths');
    var nodes = monthsDiv ? monthsDiv.querySelectorAll('.res-chip.is-on') : [];
    var out=[]; for (var i=0;i<nodes.length;i++){ out.push(Number(nodes[i].getAttribute('data-m'))||0); }
    return out;
  }
  function setSelectedMonths(arr){
    var monthsDiv = document.getElementById('resMonths');
    var nodes = monthsDiv ? monthsDiv.querySelectorAll('.res-chip') : [];
    for (var i=0;i<nodes.length;i++){
      var m = Number(nodes[i].getAttribute('data-m'))||0;
      var on = arr && arr.indexOf(m)>=0;
      if (on) nodes[i].classList.add('is-on'); else nodes[i].classList.remove('is-on');
    }
  }

  /* ---------- Tabla ---------- */
  function renderTable(rows, monthsToShow, year){
    var thead = '<thead><tr><th>PROVEEDOR / CONTACTO</th>';
    for (var i=0;i<monthsToShow.length;i++){
      var mi = monthsToShow[i];
      thead += '<th class="res-right">'+MMESES[mi-1].toUpperCase()+'</th>';
    }
    thead += '<th class="res-right">TOTAL '+year+'</th></tr></thead>';

    // Totales por mes (fila superior)
    var sumByM = {}; for (var i2=0;i2<monthsToShow.length;i2++) sumByM[monthsToShow[i2]]=0;
    for (var r=0;r<rows.length;r++){
      for (var j=0;j<monthsToShow.length;j++){
        var m = monthsToShow[j];
        sumByM[m] += Number(rows[r].meses[m]||0);
      }
    }

    var body = '<tbody>';
    for (var r2=0;r2<rows.length;r2++){
      var rr = rows[r2];
      var total=0;
      for (var j2=0;j2<monthsToShow.length;j2++){
        var mm = monthsToShow[j2];
        total += Number(rr.meses[mm]||0);
      }
      if (total<=0) continue; // oculta filas 0
      body += '<tr><td><strong>'+rr.proveedor+'</strong></td>';
      for (var j3=0;j3<monthsToShow.length;j3++){
        var m3 = monthsToShow[j3];
        body += '<td class="res-right">'+numeroCL(rr.meses[m3]||0)+'</td>';
      }
      body += '<td class="res-right"><strong>'+numeroCL(total)+'</strong></td></tr>';
    }
    if (body==='<tbody>'){
      body += '<tr><td colspan="'+(monthsToShow.length+2)+'" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }
    body += '</tbody>';

    // Fila total por mes
    var foot = '<tfoot><tr><td><strong>Total por mes</strong></td>';
    var grand=0;
    for (var j4=0;j4<monthsToShow.length;j4++){
      var m4 = monthsToShow[j4]; grand += sumByM[m4];
      foot += '<td class="res-right"><strong>'+numeroCL(sumByM[m4])+'</strong></td>';
    }
    foot += '<td class="res-right"><strong>'+numeroCL(grand)+'</strong></td></tr></tfoot>';

    document.getElementById('resTableWrap').innerHTML =
      '<table class="res-table">'+thead+body+foot+'</table>';
  }

  /* ---------- GRÁFICO ---------- */
  var chartRef = null;

  // Plugin para escribir el total encima de cada barra apilada
  var stackTotalPlugin = {
    id: 'stackTotals',
    afterDatasetsDraw: function(chart, args, opts){
      if (!opts || opts.enabled===false) return;
      var ctx = chart.ctx;
      var xScale = chart.scales.x;
      var yScale = chart.scales.y;
      if (!xScale || !yScale) return;

      // número de categorías
      var n = (chart.getDatasetMeta(0) && chart.getDatasetMeta(0).data)
              ? chart.getDatasetMeta(0).data.length : 0;

      ctx.save();
      ctx.font = (opts.fontSize||12)+'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = opts.color || '#111827';

      for (var i=0;i<n;i++){
        var x = (chart.getDatasetMeta(0).data[i] && chart.getDatasetMeta(0).data[i].x) || 0;
        var total = 0;
        for (var d=0; d<chart.data.datasets.length; d++){
          total += Number(chart.data.datasets[d].data[i]||0);
        }
        var y = yScale.getPixelForValue(total);
        if (isFinite(x) && isFinite(y)){
          ctx.fillText(numeroCL(total), x, y - 6);
        }
      }
      ctx.restore();
    }
  };

  function renderChart(rows, monthsToShow, axisMode){
    var canvas = document.getElementById('resChart');
    if (!canvas) return;

    // Si no hay Chart.js, limpiar canvas y salir
    if (!global.Chart){
      var ctx0 = canvas.getContext('2d');
      ctx0.clearRect(0,0,canvas.width,canvas.height);
      document.getElementById('resChartNote').textContent = 'Chart.js no está cargado; se muestra solo la tabla.';
      return;
    }
    document.getElementById('resChartNote').textContent = '';

    // Construir datasets según eje
    var labels=[], datasets=[];
    var maxProvidersLegend = 12;

    if (axisMode==='proveedor'){
      // x = proveedores, datasets = meses seleccionados
      // labels (proveedores con total>0)
      var provs = [];
      for (var r=0;r<rows.length;r++){
        var sum=0; for (var j=0;j<monthsToShow.length;j++){ sum += Number(rows[r].meses[monthsToShow[j]]||0); }
        if (sum>0) provs.push({name:rows[r].proveedor, total:sum, meses:rows[r].meses});
      }
      provs.sort(function(a,b){ return (b.total||0)-(a.total||0); });
      labels = provs.map(function(p){ return p.name; });

      // datasets por mes
      for (var j2=0;j2<monthsToShow.length;j2++){
        var m = monthsToShow[j2];
        var data = [];
        var totalM=0;
        for (var p=0;p<provs.length;p++){
          var v = Number(provs[p].meses[m]||0); data.push(v); totalM+=v;
        }
        datasets.push({
          label: pad2(m)+' '+MMESES[m-1]+' · '+numeroCL(totalM)+'t',
          data: data,
          borderWidth: 1
        });
      }
    } else {
      // axisMode === 'mes'  → x = meses, datasets = top proveedores
      labels = monthsToShow.map(function(m){return pad2(m)+' '+MMESES[m-1];});

      // totales por proveedor para ranking
      var rank = [];
      for (var r2=0;r2<rows.length;r2++){
        var sum2=0;
        for (var j3=0;j3<monthsToShow.length;j3++){ var mm=monthsToShow[j3]; sum2 += Number(rows[r2].meses[mm]||0); }
        if (sum2>0) rank.push({name:rows[r2].proveedor, total:sum2, meses:rows[r2].meses});
      }
      rank.sort(function(a,b){ return (b.total||0)-(a.total||0); });
      var top = rank.slice(0, maxProvidersLegend);

      for (var t=0;t<top.length;t++){
        var data2=[];
        for (var j4=0;j4<monthsToShow.length;j4++){
          var m2 = monthsToShow[j4];
          data2.push(Number(top[t].meses[m2]||0));
        }
        datasets.push({
          label: top[t].name+' · '+numeroCL(top[t].total)+'t',
          data: data2,
          borderWidth: 1
        });
      }
    }

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: true }, // ← tooltip por tramo
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              // muestra solo dataset + valor formateado
              label: function(ctx){
                var lbl = ctx.dataset.label || '';
                // extraer el nombre (antes del " · ")
                var p = lbl.split(' · ')[0];
                var v = numeroCL(ctx.parsed.y || ctx.raw || 0) + 't';
                return p + ' · ' + v;
              },
              title: function(ctx){
                // título: etiqueta X directamente
                return ctx[0] && ctx[0].label ? ctx[0].label : '';
              }
            }
          }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      },
      plugins: [stackTotalPlugin]
    });

    // activar plugin totales
    chartRef.options.plugins.stackTotals = { enabled:true, color:'#111827', fontSize:12 };
    chartRef.update();
  }

  /* ---------- Estado + montaje ---------- */
  var STATE = {
    dispon: [],
    filters: { year:null, proveedor:'', comuna:'', months:[] },
    hideEmpty: true,
    axisMode: 'proveedor' // 'proveedor' | 'mes'
  };

  function getFiltersFromUI(){
    var year   = document.getElementById('resYear').value;
    var prov   = document.getElementById('resProv').value;
    var comuna = document.getElementById('resComuna').value;
    var months = getSelectedMonths();
    var hideEmpty = document.getElementById('resHideEmptyMonths').checked;
    return { year: year, proveedor: prov, comuna: comuna, months: months, hideEmpty: hideEmpty };
  }

  function monthsToUse(){
    // Si no hay selección, usamos todos o los que tienen datos (según hideEmpty)
    var sel = STATE.filters.months || [];
    if (sel.length) return sel.slice().sort(function(a,b){return a-b;});
    var base = STATE.hideEmpty ? mesesConDatos(STATE.dispon, STATE.filters) : range12();
    if (base.length===0) base = range12();
    return base;
  }

  function refresh(){
    var months = monthsToUse();
    var grouped = groupProvMes(STATE.dispon, STATE.filters);
    renderTable(grouped, months, STATE.filters.year || '');
    renderChart(grouped, months, STATE.axisMode);
  }

  function attachEvents(){
    function updateFromUI(){
      var f = getFiltersFromUI();
      STATE.filters.year = f.year;
      STATE.filters.proveedor = f.proveedor;
      STATE.filters.comuna = f.comuna;
      STATE.filters.months = f.months;
      STATE.hideEmpty = f.hideEmpty;
      refresh();
    }

    var ids = ['resYear','resProv','resComuna','resHideEmptyMonths'];
    for (var i=0;i<ids.length;i++){
      var el = document.getElementById(ids[i]);
      if (el) el.addEventListener('change', updateFromUI);
    }

    // chips meses: toggle
    var monthsDiv = document.getElementById('resMonths');
    if (monthsDiv){
      monthsDiv.addEventListener('click', function(ev){
        var t = ev.target;
        while (t && t!==monthsDiv && !t.classList.contains('res-chip')) t = t.parentNode;
        if (t && t.classList.contains('res-chip')){
          t.classList.toggle('is-on');
          updateFromUI();
        }
      });
    }

    // botones
    var btnDatos = document.getElementById('resBtnMesesConDatos');
    if (btnDatos){
      btnDatos.addEventListener('click', function(){
        var m = mesesConDatos(STATE.dispon, STATE.filters);
        setSelectedMonths(m);
        STATE.filters.months = m;
        refresh();
      });
    }
    var btnLimpiar = document.getElementById('resBtnLimpiarMeses');
    if (btnLimpiar){
      btnLimpiar.addEventListener('click', function(){
        setSelectedMonths([]);
        STATE.filters.months = [];
        refresh();
      });
    }
    var axisBtn = document.getElementById('resAxisBtn');
    if (axisBtn){
      axisBtn.addEventListener('click', function(){
        STATE.axisMode = (STATE.axisMode==='proveedor' ? 'mes' : 'proveedor');
        axisBtn.textContent = 'Eje: ' + (STATE.axisMode==='proveedor' ? 'Proveedor' : 'Mes');
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

      // valores iniciales
      var ui = getFiltersFromUI();
      STATE.filters.year = ui.year;
      STATE.filters.proveedor = ui.proveedor;
      STATE.filters.comuna = ui.comuna;
      STATE.filters.months = []; // sin selección → usa hideEmpty
      STATE.hideEmpty = true;
      setSelectedMonths([]); // limpio

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
