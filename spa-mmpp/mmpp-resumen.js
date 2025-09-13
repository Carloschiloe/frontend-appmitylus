/* /spa-mmpp/mmpp-resumen.js
   Resumen Proveedor × Mes con:
   - “Limpiar meses”, “Meses con datos”
   - Ocultar meses vacíos (sin datos)
   - No mostrar “0” en celdas
   - El gráfico respeta los meses visibles
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('mmpp-resumen-css')) return;
    var css = `
    .res-wrap{max-width:1200px;margin:0 auto}
    .res-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}
    .res-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .res-title{margin:0;font-weight:800;color:#2b3440}
    .res-filters{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:10px}
    .res-select,.res-multi{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}
    .res-multi{height:auto;min-height:44px;padding:8px}
    .res-actions{display:flex;gap:8px;align-items:center}
    .res-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}
    .res-check{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:#334155}
    .res-table{width:100%;border-collapse:separate;border-spacing:0 8px}
    .res-table th,.res-table td{padding:10px 8px}
    .res-table tr{background:#fff;border:1px solid #e5e7eb}
    .res-table th{font-weight:800;color:#475569;white-space:nowrap}
    .res-right{text-align:right}
    .res-sticky-head thead th{position:sticky;top:0;background:#f8fafc;z-index:1}
    .res-muted{opacity:.45}
    /* Gráfico fijo */
    .res-chart-wrap{margin-top:14px}
    .res-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
    .res-chart-canvas{display:block;width:980px !important;height:360px !important}
    .res-chart-scroll{overflow-x:auto}
    `;
    var s = document.createElement('style');
    s.id = 'mmpp-resumen-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }
  function uniqSorted(arr){
    var set = {}, out=[];
    (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort();
    return out;
  }

  /* ---------- Agrupador proveedor × mes ---------- */
  function groupProvMes(rows, filters){
    filters = filters||{};
    var y = filters.year||null;
    var provSel = (filters.proveedor||'').trim();
    var comunaSel = (filters.comuna||'').trim();

    var mapProv = {}; // { prov: { m[1..12], comunas:Set } }
    (rows||[]).forEach(function(r){
      if (y && String(r.anio)!==String(y)) return;
      if (provSel && (r.contactoNombre||r.proveedorNombre)!==provSel) return;
      if (comunaSel && (r.comuna||'')!==comunaSel) return;

      var prov = r.contactoNombre || r.proveedorNombre || '—';
      var m = Number(r.mes)||0;
      var tons = Number(r.tons||0)||0;

      if (!mapProv[prov]) mapProv[prov] = {prov:prov, m: Array(13).fill(0), comunaSet:new Set()};
      mapProv[prov].m[m] += tons;
      if (r.comuna) mapProv[prov].comunaSet.add(r.comuna);
    });

    var out = Object.keys(mapProv).map(function(k){
      var obj = mapProv[k];
      var total = 0;
      for (var mi=1; mi<=12; mi++){
        total += obj.m[mi];
      }
      return { proveedor: obj.prov, meses: obj.m, total: total, comunas: Array.from(obj.comunaSet).join(', ') };
    }).sort(function(a,b){ return (b.total||0)-(a.total||0); });

    return out;
  }

  /* ---------- UI ---------- */
  function buildUI(root){
    root.innerHTML = `
      <div class="res-wrap">
        <div class="res-card">
          <div class="res-head" style="margin-bottom:10px">
            <h2 class="res-title">Resumen por mes (Proveedor × Mes)</h2>
            <div class="res-actions">
              <label class="res-check">
                <input type="checkbox" id="resHideEmpty" checked>
                Ocultar meses sin datos
              </label>
              <button id="resMonthsAuto" class="res-btn" title="Selecciona sólo los meses que tienen datos">Meses con datos</button>
              <button id="resMonthsClear" class="res-btn" title="Quita la selección de meses">Limpiar meses</button>
              <button id="resToggle" class="res-btn">Ocultar</button>
            </div>
          </div>

          <div class="res-filters" style="margin-bottom:10px">
            <select id="resYear" class="res-select"></select>
            <select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>
            <select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>
            <select id="resMeses" class="res-multi" multiple size="4"></select>
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

  function fillFilters(data){
    var byYears = uniqSorted((data||[]).map(function(d){return d.anio;}).filter(Boolean));
    var byProv  = uniqSorted((data||[]).map(function(d){return d.contactoNombre||d.proveedorNombre;}).filter(Boolean));
    var byCom   = uniqSorted((data||[]).map(function(d){return d.comuna;}).filter(Boolean));

    var yearSel = document.getElementById('resYear');
    var provSel = document.getElementById('resProv');
    var comSel  = document.getElementById('resComuna');
    var mesesSel= document.getElementById('resMeses');

    var yNow = (new Date()).getFullYear();
    yearSel.innerHTML = byYears.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yNow)?'selected':'')+'>'+y+'</option>';}).join('');

    provSel.innerHTML = '<option value="">Todos los contactos</option>' +
      byProv.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    comSel.innerHTML = '<option value="">Todas las comunas</option>' +
      byCom.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');

    mesesSel.innerHTML = MMESES.map(function(nom, i){
      var m = i+1;
      return '<option value="'+m+'">'+pad2(m)+' · '+nom+'</option>';
    }).join('');
  }

  /* ---------- helper selección múltiple ---------- */
  function setMultiSelectValues(selectEl, values){
    var i, opts = selectEl && selectEl.options ? selectEl.options : [];
    var set = {};
    (values||[]).forEach(function(v){ set[String(v)] = 1; });
    for (i=0; i<opts.length; i++){
      opts[i].selected = !!set[String(opts[i].value)];
    }
  }

  /* ---------- Tabla ---------- */
  function renderTable(rows, filters, monthsToShow){
    var html = '<table class="res-table"><thead><tr>' +
               '<th>PROVEEDOR / CONTACTO</th>';

    monthsToShow.forEach(function(mi){
      html += '<th class="res-right">'+MMESES[mi-1].toUpperCase()+'</th>';
    });
    html += '<th class="res-right">TOTAL '+(filters.year||'')+'</th></tr></thead><tbody>';

    rows.forEach(function(r){
      html += '<tr><td><strong>'+r.proveedor+'</strong></td>';
      monthsToShow.forEach(function(mi){
        var v = r.meses[mi]||0;
        html += '<td class="res-right">'+(v?numeroCL(v):'')+'</td>'; // no mostrar 0
      });
      html += '<td class="res-right"><strong>'+numeroCL(r.total)+'</strong></td></tr>';
    });

    if (!rows.length){
      html += '<tr><td colspan="'+(2+monthsToShow.length)+'" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }

    html += '</tbody></table>';
    document.getElementById('resTableWrap').innerHTML = html;
  }

  /* ---------- Gráfico ---------- */
  var chartRef = null;
  function renderChart(rows, filters, monthsToShow){
    var canvas = document.getElementById('resChart');
    if (!canvas) return;

    if (!global.Chart){
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      return;
    }

    var top = rows.slice(0, 8);
    var labels = top.map(function(r){ return r.proveedor; });
    var datasets = [];
    monthsToShow.forEach(function(mi){
      datasets.push({
        label: pad2(mi)+' '+MMESES[mi-1],
        data: top.map(function(r){ return r.meses[mi]||0; }),
        borderWidth: 1
      });
    });

    if (chartRef && chartRef.destroy) chartRef.destroy();

    var ctx2 = canvas.getContext('2d');
    chartRef = new Chart(ctx2, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
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
  }

  /* ---------- Estado + montaje ---------- */
  var STATE = { dispon: [], filters:{year:null, months:[], proveedor:"", comuna:""}, hideEmpty:true };

  function getFiltersFromUI(){
    var year   = document.getElementById('resYear').value;
    var prov   = document.getElementById('resProv').value;
    var comuna = document.getElementById('resComuna').value;
    var msEl   = document.getElementById('resMeses');
    var months = Array.prototype.slice.call(msEl.selectedOptions||[]).map(function(o){return Number(o.value)||0;});
    return { year: year, months: months, proveedor: prov, comuna: comuna };
  }

  function monthsWithData(rows, filters){
    // calcula meses con algún valor > 0 (con year/proveedor/comuna aplicados)
    var used = {};
    var r = groupProvMes(rows, filters);
    r.forEach(function(item){
      for (var mi=1; mi<=12; mi++){
        if ((item.meses[mi]||0) > 0) used[mi] = 1;
      }
    });
    var out = [];
    for (var i=1;i<=12;i++) if (used[i]) out.push(i);
    return out;
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

    var chk = document.getElementById('resHideEmpty');
    if (chk){
      chk.checked = !!STATE.hideEmpty;
      chk.addEventListener('change', function(){
        STATE.hideEmpty = !!chk.checked;
        refresh();
      });
    }

    var btnAuto = document.getElementById('resMonthsAuto');
    if (btnAuto){
      btnAuto.addEventListener('click', function(){
        var msEl = document.getElementById('resMeses');
        var m = monthsWithData(STATE.dispon, {year:STATE.filters.year, proveedor:STATE.filters.proveedor, comuna:STATE.filters.comuna});
        setMultiSelectValues(msEl, m);
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    }

    var btnClear = document.getElementById('resMonthsClear');
    if (btnClear){
      btnClear.addEventListener('click', function(){
        var msEl = document.getElementById('resMeses');
        setMultiSelectValues(msEl, []); // ninguna seleccionada => “todos”
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    }

    var toggle = document.getElementById('resToggle');
    if (toggle){
      toggle.addEventListener('click', function(){
        var wrap = document.getElementById('resTableWrap').parentNode;
        var hidden = wrap.style.display==='none';
        wrap.style.display = hidden ? '' : 'none';
        toggle.textContent = hidden ? 'Ocultar' : 'Mostrar';
      });
    }
  }

  function refresh(){
    // Agrupar por proveedor×mes con los filtros actuales (sin meses)
    var rows = groupProvMes(STATE.dispon, {year:STATE.filters.year, proveedor:STATE.filters.proveedor, comuna:STATE.filters.comuna});

    // Determinar meses a mostrar
    var monthsSel = (STATE.filters.months && STATE.filters.months.length) ? STATE.filters.months.slice() : (function(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; })();
    if (STATE.hideEmpty){
      var used = monthsWithData(STATE.dispon, {year:STATE.filters.year, proveedor:STATE.filters.proveedor, comuna:STATE.filters.comuna});
      monthsSel = monthsSel.filter(function(mi){ return used.indexOf(mi)>=0; });
    }
    if (!monthsSel.length){ monthsSel = [new Date().getMonth()+1]; } // al menos 1 para no vaciar la UI

    renderTable(rows, STATE.filters, monthsSel);
    renderChart(rows, STATE.filters, monthsSel);
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
