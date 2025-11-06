/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Contactado vs Asignado (+ Semi-cerrado)
   - Contactado: suma por mes de la disponibilidad
   - Asignado:   suma por mes de destino de la asignación
   - Semi-cerrado: parte del “restante” pintada en verde (min(semi, restante))
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];
  var MMESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  /* ---------- utils ---------- */
  var $ = function(id){ return document.getElementById(id); };
  var numberCL = function(n){ return (Number(n)||0).toLocaleString("es-CL"); };
  var pct      = function(a,b){ a=+a||0; b=+b||0; return b>0 ? Math.round(a*100/b)+'%' : '—'; };
  var range12  = function(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; };
  var uniqSorted = function(arr){ return Array.from(new Set((arr||[]).filter(Boolean))).sort(); };

  function buildUI(root){
    root.innerHTML =
    '<div class="pl-wrap">'+
      '<div class="pl-card">'+
        '<div class="pl-head" style="margin-bottom:10px">'+
          '<h2 class="pl-title">Pipeline MMPP — Contactado vs Asignado</h2>'+
          '<div class="pl-actions">'+
            '<label style="display:flex;gap:8px;align-items:center">'+
              '<input id="plHideEmptyMonths" type="checkbox" checked />'+
              '<span>Ocultar meses sin datos</span>'+
            '</label>'+
            '<button id="plBtnMesesConDatos" class="pl-btn">Meses con datos</button>'+
            '<button id="plBtnLimpiarMeses" class="pl-btn">Limpiar meses</button>'+
            '<button id="plBtnLimpiarFiltros" class="pl-btn">Limpiar filtros</button>'+
            '<button id="plAxisBtn" class="pl-btn">Eje: Empresa</button>'+
          '</div>'+
        '</div>'+

        '<div class="pl-filters">'+
          '<select id="plYear" class="pl-select"></select>'+
          '<select id="plProv" class="pl-select"><option value="">Todos los contactos</option></select>'+
          '<select id="plComuna" class="pl-select"><option value="">Todas las comunas</option></select>'+
          '<select id="plEmpresa" class="pl-select"><option value="">Todas las empresas</option></select>'+
        '</div>'+

        '<div class="pl-monthsbar"><div id="plMonths" class="pl-months-line"></div></div>'+

        '<div class="pl-kpis" id="plKpis"></div>'+

        '<div class="pl-chart-wrap">'+
          '<div class="pl-chart-frame">'+
            '<div class="pl-chart-container">'+
              '<canvas id="plChart" class="pl-chart-canvas"></canvas>'+
            '</div>'+
          '</div>'+
          '<div id="plChartNote" class="pl-note"></div>'+
        '</div>'+

        '<div id="plTableWrap"></div>'+
      '</div>'+
    '</div>';
  }

  /* ---------- helpers ---------- */
  function cleanEmpresa(d, a){
    var s = (d && (d.empresaNombre||'')) || (a && (a.empresaNombre||'')) ||
            (d && (d.proveedorNombre||d.contactoNombre||'')) ||
            (a && (a.proveedorNombre||a.contactoNombre||'')) || '—';
    s = String(s||'').trim();
    return s || '—';
  }

  // Derivación por (empresa, año, mes) con split de “semi” vs “no-semi”
  function buildDerivMonthly(dispon, asig, semi){
    var byId = {}; (dispon||[]).forEach(function(d){ if (d && (d.id!=null)) byId[String(d.id)] = d; });

    var map = {};
    function key(emp, anio, mes){ return emp + '|' + (anio||'') + '|' + (mes||0); }
    function ensure(emp, anio, mes){
      var k = key(emp, anio, mes);
      if (!map[k]){
        map[k] = {
          empresa: emp || '—', anio: +anio||null, mes: +mes||0,
          contactado:0, asignado:0, semi:0, semiRestante:0, noSemiRestante:0,
          contactos: new Set(), _ids: new Set()
        };
      }
      return map[k];
    }

    (dispon||[]).forEach(function(d){
      var row = ensure(cleanEmpresa(d,null), +d.anio, +d.mes);
      row.contactado += +d.tons||0;
      row._ids.add(String(d.id));
      row.contactos.add(((d.contactoNombre || d.proveedorNombre || '—')+' – '+(d.comuna||'')).trim());
    });

    (asig||[]).forEach(function(a){
      var y = +(a.destAnio||a.anio||0), m = +(a.destMes||a.mes||0); if(!y||!m) return;
      var dpo = byId[String(a.disponibilidadId||'')];
      var row = ensure(cleanEmpresa(dpo,a), y, m);
      row.asignado += +(a.cantidad||a.tons||0)||0;
      if (dpo && dpo.id!=null) row._ids.add(String(dpo.id));
      var contacto = a.proveedorNombre || a.contactoNombre || (dpo && (dpo.proveedorNombre||dpo.contactoNombre)) || '—';
      var comuna   = a.comuna || (dpo && dpo.comuna) || '';
      row.contactos.add((contacto+' – '+comuna).trim());
    });

    (semi||[]).forEach(function(s){
      var row = ensure(cleanEmpresa(s,null), +s.anio, +s.mes);
      row.semi += +s.tons||0;
      row.contactos.add(s.contactoNombre || s.proveedorNombre || '—');
    });

    Object.keys(map).forEach(function(k){
      var o = map[k];
      var restante = Math.max(0, o.contactado - o.asignado);
      var semiRest = Math.min(o.semi, restante);
      o.semiRestante = semiRest;
      o.noSemiRestante = Math.max(0, restante - semiRest);
    });

    return Object.keys(map).map(function(k){
      var o = map[k];
      return {
        empresa:o.empresa, anio:o.anio, mes:o.mes,
        contactado:o.contactado, asignado:o.asignado,
        semiRestante:o.semiRestante, noSemiRestante:o.noSemiRestante,
        saldo:Math.max(0,o.contactado-o.asignado), lotes:o._ids.size,
        contactos:Array.from(o.contactos)
      };
    });
  }

  function mesesConDatosDispon(deriv, filters){
    var sumByM = {}; for (var i=1;i<=12;i++) sumByM[i]=0;
    (deriv||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.empresa && r.empresa!==filters.empresa) return;
      sumByM[r.mes] += (+r.contactado||0) + (+r.asignado||0);
    });
    var out=[]; for (var mi=1; mi<=12; mi++) if (sumByM[mi]>0) out.push(mi);
    return out;
  }

  function filterDeriv(deriv, filters){
    var monthsSel = filters.months || [];
    return (deriv||[]).filter(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return false;
      if (filters.empresa && r.empresa!==filters.empresa) return false;
      if (monthsSel.length && monthsSel.indexOf(+r.mes)<0) return false;
      return true;
    });
  }

  function groupByEmpresa(rows){
    var map={}, det={};
    rows.forEach(function(r){
      if (!map[r.empresa]){
        map[r.empresa] = {empresa:r.empresa, c:0,a:0,sr:0,ns:0,l:0};
        det[r.empresa]=new Set();
      }
      map[r.empresa].c  += r.contactado;
      map[r.empresa].a  += r.asignado;
      map[r.empresa].sr += r.semiRestante;
      map[r.empresa].ns += r.noSemiRestante;
      map[r.empresa].l  += r.lotes;
      (r.contactos||[]).forEach(function(s){ if(s) det[r.empresa].add(s); });
    });
    return Object.keys(map).map(function(k){
      var o=map[k];
      return {
        empresa:k,
        contactado:o.c, asignado:o.a,
        semiRestante:o.sr, noSemiRestante:o.ns,
        saldo:Math.max(0,o.c-o.a), lotes:o.l,
        contactos:Array.from(det[k]||[])
      };
    }).sort(function(a,b){ return (b.contactado||0)-(a.contactado||0); });
  }

  function groupByMes(rows){
    var map={}; for (var m=1;m<=12;m++) map[m]={c:0,a:0,sr:0,ns:0,l:0, con:new Set()};
    rows.forEach(function(r){
      var k=+r.mes||0; if(!map[k]) map[k]={c:0,a:0,sr:0,ns:0,l:0, con:new Set()};
      map[k].c  += r.contactado;
      map[k].a  += r.asignado;
      map[k].sr += r.semiRestante;
      map[k].ns += r.noSemiRestante;
      map[k].l  += r.lotes;
      (r.contactos||[]).forEach(function(s){ if(s) map[k].con.add(s); });
    });
    return range12().map(function(m){
      var o = map[m];
      return {
        mes:m, contactado:o.c, asignado:o.a,
        semiRestante:o.sr, noSemiRestante:o.ns,
        saldo:Math.max(0,o.c-o.a), lotes:o.l,
        contactos:Array.from(o.con)
      };
    });
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(rows){
    var contact=0, asign=0, empSet=new Set();
    rows.forEach(function(r){ contact+=r.contactado; asign+=r.asignado; empSet.add(r.empresa); });
    var saldo = Math.max(0, contact - asign);
    $('plKpis').innerHTML =
      kpi('Contactado', numberCL(contact)+' tons') +
      kpi('Asignado', numberCL(asign)+' tons') +
      kpi('% Asignación', (contact>0?Math.round(asign*100/contact)+'%':'—')) +
      kpi('Saldo', numberCL(saldo)+' tons') +
      kpi('# Proveedores', numberCL(empSet.size));
    function kpi(lab,val){ return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+val+'</div></div>'; }
  }

  /* ---------- Chart ---------- */
  var chartRef = null, toolDetail = {};
  var stackTotalPlugin = {
    id: 'stackTotals',
    afterDatasetsDraw: function(chart){
      var opts = chart.options.plugins.stackTotals || {};
      if (opts.enabled===false) return;
      var ctx = chart.ctx, meta0 = chart.getDatasetMeta(0), n = (meta0 && meta0.data)?meta0.data.length:0;
      ctx.save(); ctx.font=(opts.fontSize||12)+'px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=getCssVar('--pl-text')||'#111827';
      for (var i=0;i<n;i++){
        var tot=0, ds=chart.data.datasets;
        for (var d=0; d<ds.length; d++) tot += Number(ds[d].data[i]||0);
        if (tot<=0) continue;
        var x=(meta0.data[i] && meta0.data[i].x)||0;
        var y=chart.scales.y.getPixelForValue(tot); var yC=Math.max(y, chart.chartArea.top+12);
        ctx.fillText(numberCL(tot), x, yC-6);
      }
      ctx.restore();
    }
  };

  function getCssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function buildDatasets(dataAsign, dataSemi, dataNoAsig){
    return [
      { label:'Asignado',     data:dataAsign,  borderWidth:1, stack:'pipeline', backgroundColor:getCssVar('--pl-asignado') },
      { label:'Semi-cerrado', data:dataSemi,   borderWidth:1, stack:'pipeline', backgroundColor:getCssVar('--pl-semicerrado') },
      { label:'No asignado',  data:dataNoAsig, borderWidth:1, stack:'pipeline', backgroundColor:getCssVar('--pl-noasignado') }
    ];
  }

  function renderChart(rows, axisMode){
    var canvas = $('plChart'); if (!canvas) return;

    if (!global.Chart){
      var ctx0 = canvas.getContext('2d');
      ctx0.clearRect(0,0,canvas.width||300,canvas.height||150);
      $('plChartNote').textContent = 'Chart.js no está cargado; se muestra solo la tabla.';
      return;
    }
    $('plChartNote').textContent = '';

    var labels=[], dataAsign=[], dataSemi=[], dataNoAsig=[];
    toolDetail = {};

    if (axisMode==='empresa'){
      var g = groupByEmpresa(rows);
      labels   = g.map(x => x.empresa);
      dataAsign= g.map(x => x.asignado);
      dataSemi = g.map(x => x.semiRestante);
      dataNoAsig = g.map(x => Math.max(0,x.noSemiRestante));
      g.forEach(function(x){
        toolDetail[x.empresa] = { contactos:x.contactos, asignado:x.asignado, semi:x.semiRestante, saldo:Math.max(0,x.semiRestante+x.noSemiRestante) };
      });
    } else {
      var gm = groupByMes(rows);
      labels   = gm.map(x => MMESES[x.mes-1]);
      dataAsign= gm.map(x => x.asignado);
      dataSemi = gm.map(x => x.semiRestante);
      dataNoAsig = gm.map(x => Math.max(0,x.noSemiRestante));
      gm.forEach(function(x){
        toolDetail[MMESES[x.mes-1]] = { contactos:x.contactos, asignado:x.asignado, semi:x.semiRestante, saldo:Math.max(0,x.semiRestante+x.noSemiRestante) };
      });
    }

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels:labels, datasets: buildDatasets(dataAsign, dataSemi, dataNoAsig) },
      options: {
        responsive:true, maintainAspectRatio:false, animation:false,
        interaction:{ mode:'nearest', intersect:true },
        layout:{ padding:{ top:12 } },
        plugins:{
          legend:{ position:'right' },
          stackTotals:{ enabled:true, fontSize:12 },
          tooltip:{
            callbacks:{
              title: items => (items && items[0] && items[0].label) ? items[0].label : '',
              beforeBody: items => {
                var lbl = items && items[0] && items[0].label;
                var det = toolDetail[lbl] || {contactos:[]};
                var lines = (det.contactos||[]).slice(0,8).map(s => '• '+s);
                if ((det.contactos||[]).length>8) lines.push('• +'+((det.contactos||[]).length-8)+' más…');
                return lines.length?lines:['(sin contactos)'];
              },
              footer: items => {
                var lbl = items && items[0] && items[0].label;
                var det = toolDetail[lbl] || {asignado:0, semi:0, saldo:0};
                return 'Asignado: '+numberCL(det.asignado)+' t   |   Semi-cerrado: '+numberCL(det.semi)+' t   |   Restante: '+numberCL(det.saldo)+' t';
              }
            }
          }
        },
        scales:{
          x:{ stacked:true, ticks:{ autoSkip:false, maxRotation:45, minRotation:45 } },
          y:{ stacked:true, beginAtZero:true, grace:'15%', ticks:{ padding:6 } }
        }
      },
      plugins:[stackTotalPlugin]
    });
  }

  /* ---------- Tabla ---------- */
  function renderTable(rows, axisMode, year){
    var html='';
    if (axisMode==='empresa'){
      var g = groupByEmpresa(rows);
      var head='<thead><tr><th>EMPRESA</th><th class="pl-right">CONTACTADO '+(year||'')+
               '</th><th class="pl-right">ASIGNADO</th><th class="pl-right">% ASIG</th>'+
               '<th class="pl-right">SALDO</th><th class="pl-right"># LOTES</th></tr></thead>';
      var body='<tbody>', tc=0,ta=0,tl=0;
      for (var i=0;i<g.length;i++){
        var r=g[i]; if (r.contactado<=0 && r.asignado<=0) continue;
        tc+=r.contactado; ta+=r.asignado; tl+=r.lotes;
        body+='<tr><td><strong>'+r.empresa+'</strong></td>'+
              '<td class="pl-right">'+numberCL(r.contactado)+'</td>'+
              '<td class="pl-right">'+numberCL(r.asignado)+'</td>'+
              '<td class="pl-right">'+pct(r.asignado,r.contactado)+'</td>'+
              '<td class="pl-right">'+numberCL(Math.max(0,r.saldo))+'</td>'+
              '<td class="pl-right">'+numberCL(r.lotes)+'</td></tr>';
      }
      if (body==='<tbody>') body+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body+='</tbody>';
      var foot='<tfoot><tr><td><strong>Totales</strong></td>'+
               '<td class="pl-right"><strong>'+numberCL(tc)+'</strong></td>'+
               '<td class="pl-right"><strong>'+numberCL(ta)+'</strong></td>'+
               '<td class="pl-right"><strong>'+(tc>0?Math.round(ta*100/tc)+'%':'—')+'</strong></td>'+
               '<td class="pl-right"><strong>'+numberCL(Math.max(0,tc-ta))+'</strong></td>'+
               '<td class="pl-right"><strong>'+numberCL(tl)+'</strong></td></tr></tfoot>';
      html = '<table class="pl-table">'+head+body+foot+'</table>';
    } else {
      var gm = groupByMes(rows);
      var head2='<thead><tr><th>MES</th><th class="pl-right">CONTACTADO '+(year||'')+
                '</th><th class="pl-right">ASIGNADO</th><th class="pl-right">% ASIG</th>'+
                '<th class="pl-right">SALDO</th><th class="pl-right"># LOTES</th></tr></thead>';
      var body2='<tbody>', tc2=0,ta2=0,tl2=0;
      for (var j=0;j<gm.length;j++){
        var r2=gm[j]; if (r2.contactado<=0 && r2.asignado<=0) continue;
        tc2+=r2.contactado; ta2+=r2.asignado; tl2+=r2.lotes;
        body2+='<tr><td>'+MMESES[r2.mes-1]+'</td>'+
               '<td class="pl-right">'+numberCL(r2.contactado)+'</td>'+
               '<td class="pl-right">'+numberCL(r2.asignado)+'</td>'+
               '<td class="pl-right">'+pct(r2.asignado,r2.contactado)+'</td>'+
               '<td class="pl-right">'+numberCL(Math.max(0,r2.saldo))+'</td>'+
               '<td class="pl-right">'+numberCL(r2.lotes)+'</td></tr>';
      }
      if (body2==='<tbody>') body2+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body2+='</tbody>';
      var foot2='<tfoot><tr><td><strong>Totales</strong></td>'+
                '<td class="pl-right"><strong>'+numberCL(tc2)+'</strong></td>'+
                '<td class="pl-right"><strong>'+numberCL(ta2)+'</strong></td>'+
                '<td class="pl-right"><strong>'+(tc2>0?Math.round(ta2*100/tc2)+'%':'—')+'</strong></td>'+
                '<td class="pl-right"><strong>'+numberCL(Math.max(0,tc2-ta2))+'</strong></td>'+
                '<td class="pl-right"><strong>'+numberCL(tl2)+'</strong></td></tr></tfoot>';
      html = '<table class="pl-table">'+head2+body2+foot2+'</table>';
    }
    $('plTableWrap').innerHTML = html;
  }

  /* ---------- estado / montaje ---------- */
  var STATE = {
    deriv: [],
    filters: { year:null, proveedor:'', comuna:'', empresa:'', months:[] },
    hideEmpty: true,
    axisMode: 'empresa'
  };

  function getSelectedMonths(){
    var nodes = ($('plMonths')||document).querySelectorAll('.pl-chip.is-on');
    var out=[]; for (var i=0;i<nodes.length;i++){ out.push(+nodes[i].getAttribute('data-m')||0); }
    return out;
  }
  function setSelectedMonths(arr){
    var nodes = ($('plMonths')||document).querySelectorAll('.pl-chip');
    for (var i=0;i<nodes.length;i++){
      var m = +nodes[i].getAttribute('data-m')||0;
      nodes[i].classList.toggle('is-on', !!(arr && arr.indexOf(m)>=0));
    }
  }

  // Render con requestAnimationFrame para no saturar
  var _rafId = null;
  function renderAll(){
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(function(){
      var rows = filterDeriv(STATE.deriv, STATE.filters);
      renderKPIs(rows);
      renderChart(rows, STATE.axisMode);
      renderTable(rows, STATE.axisMode, STATE.filters.year || '');
    });
  }

  function attachEvents(){
    function updateFromUI(){
      STATE.filters.year      = $('plYear').value;
      STATE.filters.proveedor = $('plProv').value;
      STATE.filters.comuna    = $('plComuna').value;
      STATE.filters.empresa   = $('plEmpresa').value;
      STATE.filters.months    = getSelectedMonths();
      STATE.hideEmpty         = $('plHideEmptyMonths').checked;
      renderAll();
    }

    ['plYear','plProv','plComuna','plEmpresa','plHideEmptyMonths']
      .forEach(id => { var el=$(id); if (el) el.addEventListener('change', updateFromUI); });

    var monthsDiv = $('plMonths');
    if (monthsDiv){
      monthsDiv.addEventListener('click', function(ev){
        var t = ev.target;
        while (t && t!==monthsDiv && !t.classList.contains('pl-chip')) t = t.parentNode;
        if (t && t.classList.contains('pl-chip')){ t.classList.toggle('is-on'); updateFromUI(); }
      });
    }

    var btn = $('plBtnMesesConDatos'); if (btn) btn.addEventListener('click', function(){
      var m = mesesConDatosDispon(STATE.deriv, STATE.filters);
      setSelectedMonths(m); STATE.filters.months = m; renderAll();
    });

    var btnL = $('plBtnLimpiarMeses'); if (btnL) btnL.addEventListener('click', function(){
      setSelectedMonths([]); STATE.filters.months=[]; renderAll();
    });

    var btnF = $('plBtnLimpiarFiltros'); if (btnF) btnF.addEventListener('click', function(){
      $('plProv').value=''; $('plComuna').value=''; $('plEmpresa').value='';
      setSelectedMonths([]); STATE.filters.months=[]; renderAll();
    });

    var axisBtn = $('plAxisBtn'); if (axisBtn) axisBtn.addEventListener('click', function(){
      STATE.axisMode = (STATE.axisMode==='empresa' ? 'mes' : 'empresa');
      axisBtn.textContent = 'Eje: ' + (STATE.axisMode==='empresa' ? 'Empresa' : 'Mes');
      renderAll();
    });
  }

  function optionsFromDeriv(deriv){
    return {
      emp  : uniqSorted((deriv||[]).map(r => r.empresa).filter(Boolean)),
      years: uniqSorted((deriv||[]).map(r => r.anio).filter(Boolean))
    };
  }

  function fillFilters(deriv){
    var selY = $('plYear'), selE = $('plEmpresa'), monthsDiv = $('plMonths');

    var opts = optionsFromDeriv(deriv);
    var yNow = (new Date()).getFullYear();
    var years = opts.years.length ? opts.years : [yNow];
    var yDefault = years.indexOf(yNow)>=0 ? yNow : years[years.length-1];

    selY.innerHTML = years.map(y => `<option value="${y}" ${String(y)===String(yDefault)?'selected':''}>${y}</option>`).join('');
    selE.innerHTML = '<option value="">Todas las empresas</option>' + opts.emp.map(e => `<option value="${e}">${e}</option>`).join('');

    monthsDiv.innerHTML = range12().map(m => `<button type="button" class="pl-chip" data-m="${m}">${MMESES_LARGO[m-1]}</button>`).join('');
  }

  function mount(opts){
    var root = document.getElementById('mmppPipeline');
    if (!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon, asig, semi){
      STATE.deriv = buildDerivMonthly(dispon, asig, semi);
      fillFilters(STATE.deriv);

      var ySel = $('plYear');
      STATE.filters.year = ySel ? ySel.value : '';
      STATE.filters.proveedor = '';
      STATE.filters.comuna = '';
      STATE.filters.empresa = '';
      STATE.filters.months = [];
      STATE.hideEmpty = true;
      setSelectedMonths([]);

      attachEvents();
      renderAll();
    }

    if (opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig) && Array.isArray(opts.semi)){
      return go(opts.dispon, opts.asig, opts.semi);
    }

    if (global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      Promise.all([
        global.MMppApi.getDisponibilidades(),
        (global.MMppApi.getAsignaciones ? global.MMppApi.getAsignaciones() : Promise.resolve([])).catch(() => []),
        (global.MMppApi.getSemiCerrados ? global.MMppApi.getSemiCerrados() : Promise.resolve([])).catch(() => [])
      ]).then(res => go(res[0]||[], res[1]||[], res[2]||[]))
        .catch(() => go([],[],[]));
    } else {
      go([],[],[]);
    }
  }

  global.MMppPipeline = { mount: mount, refresh: renderAll };
})(window);
