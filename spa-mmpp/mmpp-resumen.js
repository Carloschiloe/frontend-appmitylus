/* /spa-mmpp/mmpp-resumen.js
   Resumen Proveedor × Mes con filtros (Año, Mes, Proveedor, Comuna) y gráfico fijo
   - Usa MMppApi.getDisponibilidades() si no se le pasan datos
   - Si window.Chart existe, pinta barras apiladas; si no, sólo tabla
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];

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
    .res-actions{display:flex;gap:8px}
    .res-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}
    .res-table{width:100%;border-collapse:separate;border-spacing:0 8px}
    .res-table th,.res-table td{padding:10px 8px}
    .res-table tr{background:#fff;border:1px solid #e5e7eb}
    .res-table th{font-weight:800;color:#475569}
    .res-right{text-align:right}
    .res-sticky-head thead th{position:sticky;top:0;background:#f8fafc;z-index:1}
    .res-muted{opacity:.45}
    .res-chart-wrap{margin-top:14px}
    .res-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}
    .res-chart-canvas{display:block;width:980px !important;height:360px !important} /* tamaño fijo */
    .res-chart-scroll{overflow-x:auto}
    `;
    var s = document.createElement('style');
    s.id = 'mmpp-resumen-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }

  function groupProvMes(rows, filters){
    filters = filters||{};
    var y = filters.year||null;
    var mesesSel = (filters.months && filters.months.length) ? filters.months.slice() : null; // [1..12] ó null= todos
    var provSel = (filters.proveedor||'').trim();
    var comunaSel = (filters.comuna||'').trim();

    var mapProv = {}; // { provName: { m[1..12], comunaSet } }
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
        var v = obj.m[mi];
        if (!mesesSel || mesesSel.indexOf(mi)>=0) total += v;
      }
      return { proveedor: obj.prov, meses: obj.m, total: total, comunas: Array.from(obj.comunaSet).join(', ') };
    }).sort(function(a,b){ return (b.total||0)-(a.total||0); });

    return out;
  }

  function buildUI(root){
    root.innerHTML = '\
      <div class="res-wrap">\
        <div class="res-card">\
          <div class="res-head" style="margin-bottom:10px">\
            <h2 class="res-title">Resumen por mes (Proveedor × Mes)</h2>\
            <div class="res-actions">\
              <button id="resToggle" class="res-btn">Ocultar</button>\
            </div>\
          </div>\
          <div class="res-filters" style="margin-bottom:10px">\
            <select id="resYear" class="res-select"></select>\
            <select id="resProv" class="res-select"><option value="">Todos los contactos</option></select>\
            <select id="resComuna" class="res-select"><option value="">Todas las comunas</option></select>\
            <select id="resMeses" class="res-multi" multiple size="4"></select>\
          </div>\
          <div id="resTableWrap" class="res-sticky-head"></div>\
          <div class="res-chart-wrap">\
            <div class="res-chart-scroll">\
              <div class="res-chart-frame">\
                <canvas id="resChart" class="res-chart-canvas" width="980" height="360"></canvas>\
              </div>\
            </div>\
          </div>\
        </div>\
      </div>';
  }

  function uniqSorted(arr){
    var set = {}, out=[];
    (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort();
    return out;
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

  function renderTable(rows, filters){
    var mesesSel = (filters.months && filters.months.length) ? filters.months.slice() : null;
    var mutedCol = function(mi){ return mesesSel && mesesSel.indexOf(mi)<0 ? ' res-muted' : ''; };

    var html = '<table class="res-table"><thead><tr>' +
               '<th>PROVEEDOR / CONTACTO</th>' +
               MMESES.map(function(n, i){ return '<th class="res-right'+mutedCol(i+1)+'">'+n.toUpperCase()+'</th>'; }).join('') +
               '<th class="res-right">TOTAL '+filters.year+'</th></tr></thead><tbody>';

    rows.forEach(function(r){
      html += '<tr><td><strong>'+r.proveedor+'</strong></td>';
      for (var mi=1; mi<=12; mi++){
        var v = r.meses[mi]||0;
        var show = (!mesesSel || mesesSel.indexOf(mi)>=0) ? v : 0;
        html += '<td class="res-right'+mutedCol(mi)+'">'+numeroCL(show)+'</td>';
      }
      html += '<td class="res-right"><strong>'+numeroCL(r.total)+'</strong></td></tr>';
    });

    if (!rows.length){
      html += '<tr><td colspan="14" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }

    html += '</tbody></table>';
    document.getElementById('resTableWrap').innerHTML = html;
  }

  var chartRef = null;
  function renderChart(rows, filters){
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
    for (var mi=1; mi<=12; mi++){
      if (filters.months && filters.months.length && filters.months.indexOf(mi)<0) continue;
      datasets.push({
        label: pad2(mi)+' '+MMESES[mi-1],
        data: top.map(function(r){ return r.meses[mi]||0; }),
        borderWidth: 1
      });
    }

    if (chartRef && chartRef.destroy) chartRef.destroy();

    var ctx2 = canvas.getContext('2d');
    chartRef = new Chart(ctx2, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: false,                // fijo
        maintainAspectRatio: false,       // fijo
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

  var STATE = { dispon: [], filters:{year:null, months:[], proveedor:"", comuna:""} };

  function getFiltersFromUI(){
    var year   = document.getElementById('resYear').value;
    var prov   = document.getElementById('resProv').value;
    var comuna = document.getElementById('resComuna').value;
    var msEl   = document.getElementById('resMeses');
    var months = Array.prototype.slice.call(msEl.selectedOptions||[]).map(function(o){return Number(o.value)||0;});
    return { year: year, months: months, proveedor: prov, comuna: comuna };
  }

  function attachEvents(){
    var els = ['resYear','resProv','resComuna','resMeses'].map(function(id){return document.getElementById(id);});
    els.forEach(function(el){
      if (!el) return;
      el.addEventListener('change', function(){
        STATE.filters = getFiltersFromUI();
        refresh();
      });
    });
    var toggle = document.getElementById('resToggle');
    if (toggle){
      toggle.addEventListener('click', function(){
        var wrap = document.getElementById('resTableWrap'); // oculta SOLO la tabla
        var hidden = wrap.style.display==='none';
        wrap.style.display = hidden ? '' : 'none';
        toggle.textContent = hidden ? 'Ocultar' : 'Mostrar';
      });
    }
  }

  function refresh(){
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
