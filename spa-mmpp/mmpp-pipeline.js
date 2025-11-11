/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Disponible - Asignado - Semi-cerrado
   ENFOQUE SEMANAL REAL (lunes→lunes) usando FECHA DE REGISTRO.
   - Clave de fusión: SOLO proveedor (normalización fuerte).
   - Semi-cerrado SIEMPRE en KPI, gráfico y tabla.
   - “Disponible” = max(0, Contactado - Asignado).
   - Vista semanal basada en fecha de registro (no en destino).
   - KPIs y deltas: Semana actual vs semana anterior (por registro).
   - Filtros: Año, Empresa, Búsqueda, Semana ISO (y “Semana actual”).
   - Gráfico: apilado por semana (Asignado + Semi + Disponible).
   - Exportar CSV semanal (con Δ vs semana anterior).
*/
(function (global) {
  var MMESES = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];
  var MMESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('mmpp-pipeline-css')) return;
    var css = ''
      + '.pl-wrap{max-width:1200px;margin:0 auto;padding:20px}'
      + '.pl-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
      + '.pl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'
      + '.pl-title{margin:0;font-weight:800;color:#2b3440}'
      + '.pl-filters{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:10px;align-items:center;margin-top:8px}'
      + '.pl-select,.pl-input{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
      + '.pl-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
      + '.pl-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
      + '.pl-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:10px}'
      + '.kpi{background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:14px}'
      + '.kpi .lab{font-size:12px;color:#64748b}'
      + '.kpi .val{font-size:22px;font-weight:900;color:#111827}'
      + '.kpi .sub{font-size:11px;color:#6b7280;margin-top:4px}'
      + '.pl-chart-wrap{margin-top:14px}'
      + '.pl-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}'
      + '.pl-chart-container{position:relative;width:100%;height:380px}'
      + '.pl-chart-canvas{display:block;width:100% !important;height:100% !important}'
      + '.pl-note{color:#64748b;font-size:12px;margin-top:6px}'
      + '.pl-table{width:100%;border-collapse:separate;border-spacing:0 8px;margin-top:14px}'
      + '.pl-table th,.pl-table td{padding:10px 8px}'
      + '.pl-table tr{background:#fff;border:1px solid #e5e7eb}'
      + '.pl-right{text-align:right}'
      + '.acc-btn{display:inline-flex;gap:6px;align-items:center;border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;height:30px;padding:0 10px;cursor:pointer;font-weight:700}'
      + '.acc-body{padding:10px 6px 4px 6px;background:#fbfdff;border-top:1px dashed #e5e7eb}'
      + '.acc-grid{display:grid;grid-template-columns:1.4fr .6fr .6fr .6fr;gap:8px}'
      + '@media (max-width:1100px){.pl-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}'
      + '@media (max-width:720px){.pl-filters{grid-template-columns:1fr}}'
      + '.pill{display:inline-block;padding:2px 10px;border-radius:9999px;font-weight:800;font-size:12px;line-height:1;border:1px solid transparent}'
      + '.pill-asign{color:#0EA5E9;background:rgba(14,165,233,.12);border-color:rgba(14,165,233,.35)}'
      + '.pill-semi{color:#22C55E;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35)}'
      + '.pill-contact{color:#475569;background:rgba(203,213,225,.35);border-color:rgba(148,163,184,.45)}'
      + '.pill-neutral{color:#111827;background:rgba(17,24,39,.06);border-color:rgba(17,24,39,.15)}'
      + '.mute{opacity:.55;pointer-events:none}'
      + '.row-actions{display:flex;gap:8px;flex-wrap:wrap}'
      + '.subtle{color:#6b7280;font-size:12px}';
    var s=document.createElement('style'); s.id='mmpp-pipeline-css'; s.textContent=css; document.head.appendChild(s);
  }

  /* ---------- utils ---------- */
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function uniqSorted(arr){ var set={}, out=[]; (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v);} }); out.sort(); return out; }
  function clamp0(x){ x=Number(x)||0; return x<0?0:x; }
  function pillNum(n, kind){ return '<span class="pill pill-'+kind+'">'+numeroCL(n)+'</span>'; }

  function normalizeTxt(s){
    return String(s||'')
      .replace(/[–—]/g,'-')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }
  // Clave SOLO por proveedor
  function makeKey(prov){ return normalizeTxt(prov); }
  // Mostrar SOLO proveedor (sin comuna)
  function displayLabel(prov){ return String(prov||'—').trim(); }

  // Detectar fecha de REGISTRO en objeto
  function pickDate(o){
    var f = o && (o.fecha || o.fechaRegistro || o.createdAt || o.updatedAt);
    if (!f) return null;
    var d = new Date(f);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  // ISO Week helpers (lunes→domingo)
  function getISOWeekYear(d){
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    return date.getUTCFullYear();
  }
  function getISOWeek(d){
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  }
  function isoKey(d){
    var y = getISOWeekYear(d), w = getISOWeek(d);
    return y + '-W' + String(w).padStart(2,'0');
  }
  function currentISOKey(){ return isoKey(new Date()); }

  function prevISO(iso){ // "YYYY-Www" → semana anterior
    var m = /^(\d{4})-W(\d{2})$/.exec(String(iso||''));
    if (!m) return '';
    var y = Number(m[1]), w = Number(m[2]);
    function isoToDate(iy, iw){
      var simple = new Date(Date.UTC(iy,0,1 + (iw-1)*7));
      var dow = simple.getUTCDay();
      var start = simple;
      if (dow<=4 && dow>0) start.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
      else start.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
      return start;
    }
    var d = isoToDate(y, w);
    d.setUTCDate(d.getUTCDate()-7);
    return isoKey(new Date(d));
  }

  function numeroPct(delta, base){
    base = Number(base)||0;
    if (base<=0) return '—';
    return (delta>=0?'+':'') + Math.round(delta*100/base) + '%';
  }

  /* ---------- UI skeleton ---------- */
  function buildUI(root){
    root.innerHTML = ''
    +'<div class="pl-wrap"><div class="pl-card">'
      +'<div class="pl-head" style="margin-bottom:10px">'
        +'<h2 class="pl-title">Disponible - Asignado - Semi-cerrado</h2>'
        +'<div class="pl-actions row-actions">'
          +'<button id="plBtnWeekNow" class="pl-btn">Semana actual</button>'
          +'<button id="plBtnExport" class="pl-btn">Exportar CSV</button>'
        +'</div>'
      +'</div>'

      +'<div class="pl-filters">'
        +'<select id="plYear" class="pl-select"></select>'
        +'<select id="plEmpresa" class="pl-select"><option value="">Todas las empresas</option></select>'
        +'<div class="row-actions" style="align-items:center">'
          +'<input id="plSearch" class="pl-input" placeholder="Buscar proveedor..."/>'
          +'<select id="plWeek" class="pl-select" title="Semana ISO (YYYY-Www)"></select>'
        +'</div>'
      +'</div>'

      +'<div class="pl-kpis" id="plKpis"></div>'

      +'<div class="pl-chart-wrap"><div class="pl-chart-frame"><div class="pl-chart-container">'
        +'<canvas id="plChart" class="pl-chart-canvas"></canvas>'
      +'</div></div><div id="plChartNote" class="pl-note"></div></div>'

      +'<div id="plTableWrap"></div>'
    +'</div></div>';
  }

  /* ---------- helper: empresa ---------- */
  function cleanEmpresa(d, a){
    var s = (d && (d.empresaNombre||'')) || (a && (a.empresaNombre||'')) || (d && (d.proveedorNombre||d.contactoNombre||'')) || (a && (a.proveedorNombre||a.contactoNombre||'')) || '—';
    s = String(s||'').trim();
    return s || '—';
  }

  /* ---------- DERIVACIÓN SEMANAL (registro real) ---------- */
  function buildDerivWeekly(dispon, asig, semi){
    var map = {};
    function key(emp, iso){ return emp + '|' + iso; }
    function ensure(emp, iso){
      var k = key(emp, iso);
      if (!map[k]){
        map[k] = {
          empresa: emp || '—',
          iso: iso,                // "YYYY-Www"
          contactado: 0,
          asignado: 0,
          semiTotal: 0,
          detAsign: new Map(),
          detSemi: new Map(),
          detContactado: new Map(),
          labelByKey: new Map(),
          search: ''
        };
      }
      return map[k];
    }

    // Contactado (disponible registrado esa semana)
    (dispon||[]).forEach(function(d){
      var dt  = pickDate(d); if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(d, null);
      var tons= Number((d.tons ?? d.tonsDisponible ?? d.cantidad) || 0) || 0;
      var row = ensure(emp, iso);
      row.contactado += tons;

      var proveedor = d.proveedorNombre || d.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.detContactado.set(kNorm, (row.detContactado.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Asignado (registrado esa semana, no por destino)
    (asig||[]).forEach(function(a){
      var dt  = pickDate(a); if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(null, a);
      var tons= Number(a.cantidad||a.tons||0)||0;
      var row = ensure(emp, iso);

      var proveedor = a.proveedorNombre || a.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.asignado += tons;
      row.detAsign.set(kNorm, (row.detAsign.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Semi-cerrado (registrado esa semana)
    (semi||[]).forEach(function(s){
      var dt  = pickDate(s); if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(s, null);
      var tons= Number(s.tons||0)||0;
      var row = ensure(emp, iso);

      var proveedor = s.proveedorNombre || s.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.semiTotal += tons;
      row.detSemi.set(kNorm, (row.detSemi.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Salida ordenada por ISO
    return Object.keys(map).map(function(k){
      var o = map[k];
      return {
        empresa: o.empresa,
        iso: o.iso,
        contactado: o.contactado,
        asignado: o.asignado,
        semiTotal: o.semiTotal,
        saldo: clamp0(o.contactado - o.asignado),
        detAsign: o.detAsign,
        detSemi: o.detSemi,
        detContactado: o.detContactado,
        labelByKey: o.labelByKey,
        search: (o.search||'').toLowerCase()
      };
    }).sort(function(a,b){ return a.iso.localeCompare(b.iso); });
  }

  /* ---------- filtros ---------- */
  function weeksWithData(derivW, filters){
    var set = new Set();
    (derivW||[]).forEach(function(r){
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return;
      if (filters.empresa && r.empresa!==filters.empresa) return;
      if (filters.q && r.search.indexOf(filters.q)<0) return;
      set.add(r.iso);
    });
    return Array.from(set).sort();
  }

  function filterWeekly(derivW, filters){
    return (derivW||[]).filter(function(r){
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return false;
      if (filters.empresa && r.empresa!==filters.empresa) return false;
      if (filters.q && r.search.indexOf(filters.q)<0) return false;
      if (filters.weekIso && r.iso!==filters.weekIso) return false;
      return true;
    });
  }

  function groupByISO(rows){
    var map = new Map(); // iso -> agregado total de todas las empresas (respetando filtros)
    rows.forEach(function(r){
      var k = r.iso;
      if (!map.has(k)){
        map.set(k, {iso:k, contactado:0, asignado:0, semiTotal:0, detAsign:new Map(), detSemi:new Map(), detContactado:new Map(), labelByKey:new Map()});
      }
      var o = map.get(k);
      o.contactado += r.contactado; o.asignado += r.asignado; o.semiTotal += r.semiTotal;
      r.detAsign.forEach((v,kk)=>o.detAsign.set(kk,(o.detAsign.get(kk)||0)+v));
      r.detSemi.forEach((v,kk)=>o.detSemi.set(kk,(o.detSemi.get(kk)||0)+v));
      r.detContactado.forEach((v,kk)=>o.detContactado.set(kk,(o.detContactado.get(kk)||0)+v));
      r.labelByKey.forEach((lbl,kk)=>{ if (!o.labelByKey.has(kk)) o.labelByKey.set(kk,lbl); });
    });
    return Array.from(map.values()).sort((a,b)=> a.iso.localeCompare(b.iso));
  }

  function lastN(arr, n){
    if (!Array.isArray(arr)) return [];
    return arr.slice(Math.max(0, arr.length - n));
  }

  /* ---------- KPIs (semana actual vs anterior) ---------- */
  function renderKPIs(rowsW, filters){
    var isoNow = filters.weekIso || currentISOKey();
    var isoPrev = prevISO(isoNow);

    var gb = groupByISO(rowsW);
    var byIso = {}; gb.forEach(x=>{ byIso[x.iso]=x; });

    var cur = byIso[isoNow] || {contactado:0, asignado:0, semiTotal:0};
    var prv = byIso[isoPrev] || {contactado:0, asignado:0, semiTotal:0};

    var dispNow = clamp0(cur.contactado - cur.asignado);
    var dispPrev= clamp0(prv.contactado - prv.asignado);

    var dDisp = dispNow - dispPrev;
    var dAsig = cur.asignado - prv.asignado;
    var dSemi = cur.semiTotal - prv.semiTotal;
    var dCont = cur.contactado - prv.contactado;

    function sub(label, d, base){ return '<div class="sub">'+label+': '+(d>=0?'+':'')+numeroCL(d)+' ('+numeroPct(d, base)+')</div>'; }
    function kpi(lab, val, delta, base){
      return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+val+'</div>'+sub('vs semana anterior', delta, base)+'</div>';
    }

    var html = ''
      + kpi('Disponible',   pillNum(dispNow,'neutral'), dDisp, dispPrev)
      + kpi('Semi-cerrado', pillNum(cur.semiTotal,'semi'), dSemi, prv.semiTotal)
      + kpi('Asignado',     pillNum(cur.asignado,'asign'), dAsig, prv.asignado)
      + kpi('Contactado',   pillNum(cur.contactado,'contact'), dCont, prv.contactado)
      + kpi('# Empresas','<span class="pill pill-neutral">'+numeroCL(new Set(rowsW.map(r=>r.empresa)).size)+'</span>', 0, 0)
      + kpi('Semana actual','<span class="pill pill-neutral">'+isoNow+'</span>', 0, 0);

    document.getElementById('plKpis').innerHTML = html;
  }

  /* ---------- Chart (semanal real) ---------- */
  var chartRef = null;
  var stackTotalPlugin = {
    id: 'stackTotals',
    afterDatasetsDraw: function(chart){
      var ctx = chart.ctx, meta0 = chart.getDatasetMeta(0), n = (meta0 && meta0.data)?meta0.data.length:0;
      ctx.save(); ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#111827';
      for (var i=0;i<n;i++){
        var tot=0, ds=chart.data.datasets;
        for (var d=0; d<ds.length; d++){
          if (chart.isDatasetVisible(d)) tot += Number(ds[d].data[i]||0);
        }
        if (tot<=0) continue;
        var x=(meta0.data[i] && meta0.data[i].x)||0;
        var y=chart.scales.y.getPixelForValue(tot); var yClamped=Math.max(y, chart.chartArea.top+12);
        ctx.fillText(numeroCL(tot), x, yClamped-6);
      }
      ctx.restore();
    }
  };

  function mapToSortedPairs(mp){
    var arr=[]; mp.forEach(function(v,k){ arr.push({k:k,v:v}); });
    arr.sort(function(a,b){ return b.v-a.v; });
    return arr;
  }

  function renderChart(rowsW, filters){
    var canvas = document.getElementById('plChart');
    if (!canvas) return;

    if (!global.Chart){
      var ctx0 = canvas.getContext('2d');
      ctx0.clearRect(0,0,canvas.width||300,canvas.height||150);
      document.getElementById('plChartNote').textContent = 'Chart.js no está cargado; se muestra solo la tabla.';
      return;
    }
    document.getElementById('plChartNote').textContent = '';

    // Agregamos por ISO y tomamos últimas 8 semanas por defecto (si no hay selección)
    var gb = groupByISO(rowsW);
    var isoList = gb.map(x=>x.iso);
    var showIso = filters.weekIso ? isoList.filter(x=>x===filters.weekIso || x===prevISO(filters.weekIso) || x===prevISO(prevISO(filters.weekIso)))
                                  : lastN(isoList, 8);

    var base = gb.filter(x => showIso.includes(x.iso));
    var labels = base.map(x=>x.iso);
    var dataAsign = base.map(x=>x.asignado);
    var dataSemi  = base.map(x=>x.semiTotal);
    var dataDisp  = base.map(x=>clamp0(x.contactado - x.asignado));

    var toolDetail = {}; var accDetail = {};
    base.forEach(function(x){
      toolDetail[x.iso] = {
        asign : mapToSortedPairs(x.detAsign),
        semi  : mapToSortedPairs(x.detSemi),
        contact: mapToSortedPairs(x.detContactado)
      };
      accDetail[x.iso] = {
        detAsign:x.detAsign, detSemi:x.detSemi, detContactado:x.detContactado,
        labelByKey:x.labelByKey,
        contactado:x.contactado, asignado:x.asignado, semiTotal:x.semiTotal,
        saldo: clamp0(x.contactado - x.asignado)
      };
    });

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Asignado',     data: dataAsign, borderWidth: 1, stack: 'pipeline', backgroundColor: '#0EA5E9' },
          { label: 'Semi-cerrado', data: dataSemi,  borderWidth: 1, stack: 'pipeline', backgroundColor: '#22C55E' },
          { label: 'Disponible',   data: dataDisp,  borderWidth: 1, stack: 'pipeline', backgroundColor: '#CBD5E1' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: true },
        layout: { padding: { top: 12 } },
        plugins: {
          legend: { position: 'right' },
          stackTotals: { enabled:true, fontSize:12 },
          tooltip: {
            callbacks: {
              title: function(items){ return (items && items[0] && items[0].label) ? items[0].label : ''; },
              label: function(ctx){
                var lbl = ctx.label, ds = ctx.dataset.label;
                var det = toolDetail[lbl] || {};
                var arr = (ds==='Asignado' ? det.asign
                         : ds==='Semi-cerrado' ? det.semi
                         : ds==='Disponible' ? det.contact
                         : []);
                var lines = arr.slice(0,8).map(function(p){
                  var prov = (renderTable._accDetail && renderTable._accDetail[lbl] && renderTable._accDetail[lbl].labelByKey && renderTable._accDetail[lbl].labelByKey.get(p.k)) || String(p.k||'—');
                  return '• '+prov+': '+numeroCL(p.v)+' t';
                });
                if (arr.length>8) lines.push('• +'+(arr.length-8)+' más…');
                // delta simple vs semana anterior (totales por dataset)
                var gb = groupByISO(filterWeekly(STATE.derivW, Object.assign({}, STATE.filters, {weekIso:''})));
                var idx = gb.findIndex(x=>x.iso===lbl);
                if (idx>0){
                  var cur = gb[idx], prv = gb[idx-1];
                  var now = (ds==='Asignado'?cur.asignado: ds==='Semi-cerrado'?cur.semiTotal: clamp0(cur.contactado-cur.asignado));
                  var bef = (ds==='Asignado'?prv.asignado: ds==='Semi-cerrado'?prv.semiTotal: clamp0(prv.contactado-prv.asignado));
                  lines.push('Δ vs semana anterior: '+(now-bef>=0?'+':'')+numeroCL(now-bef)+' ('+numeroPct(now-bef, bef)+')');
                }
                return lines.length?lines:['(sin detalle)'];
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { autoSkip:false, maxRotation:0, minRotation:0 } },
          y: { stacked: true, beginAtZero: true, grace: '15%', ticks: { padding: 6 } }
        }
      },
      plugins: [stackTotalPlugin]
    });

    renderTable._accDetail = accDetail;
  }

  /* ---------- Tabla semanal (agregada por ISO) ---------- */
  function renderTable(rowsW, filters){
    var gb = groupByISO(rowsW);
    var isoNow = filters.weekIso || (gb.length? gb[gb.length-1].iso : '');
    var isoPrev = prevISO(isoNow);

    var thead='<thead><tr>'
      +'<th>SEMANA</th>'
      +'<th class="pl-right">CONTACTADO</th>'
      +'<th class="pl-right">SEMI-CERRADO</th>'
      +'<th class="pl-right">ASIGNADO</th>'
      +'<th class="pl-right">DISPONIBLE</th>'
      +'<th></th>'
      +'</tr></thead>';

    var body='<tbody>';
    gb.forEach(function(r){
      var lbl = r.iso;
      var accId = 'acc_'+lbl;

      body+='<tr>'
        +'<td>'+lbl+'</td>'
        +'<td class="pl-right">'+pillNum(r.contactado,'contact')+'</td>'
        +'<td class="pl-right">'+pillNum(r.semiTotal,'semi')+'</td>'
        +'<td class="pl-right">'+pillNum(r.asignado,'asign')+'</td>'
        +'<td class="pl-right"><span class="pill pill-neutral">'+numeroCL(clamp0(r.contactado-r.asignado))+'</span></td>'
        +'<td class="pl-right"><button class="acc-btn" data-acc="'+accId+'">Ver detalle</button></td>'
        +'</tr>'
        +'<tr id="'+accId+'" style="display:none"><td colspan="6">'
          +'<div class="acc-body">'
            +'<div style="font-weight:700;margin-bottom:6px">Detalle por proveedor</div>'
            +'<div class="acc-grid">'
              +'<div class="subtle">Proveedor</div>'
              +'<div class="pl-right subtle">Contactado (t)</div>'
              +'<div class="pl-right subtle">Semi-cerrado (t)</div>'
              +'<div class="pl-right subtle">Asignado (t)</div>'
            +'</div>';

      var idx = new Map();
      r.detContactado.forEach(function(v,k){ idx.set(k, {c:v,s:0,a:0}); });
      r.detSemi.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.s+=v; idx.set(k,o); });
      r.detAsign.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.a+=v; idx.set(k,o); });

      Array.from(idx.entries())
        .sort(function(A,B){
          var va=A[1].c+A[1].s+A[1].a, vb=B[1].c+B[1].s+B[1].a;
          return vb-va;
        })
        .forEach(function(e){
          var k=e[0], vals=e[1];
          var label = r.labelByKey.get(k) || k || '—';
          body+='<div class="acc-grid"><div>'+label+'</div>'
              +'<div class="pl-right">'+(vals.c?pillNum(vals.c,'contact'):'—')+'</div>'
              +'<div class="pl-right">'+(vals.s?pillNum(vals.s,'semi'):'—')+'</div>'
              +'<div class="pl-right">'+(vals.a?pillNum(vals.a,'asign'):'—')+'</div></div>';
        });

      body+='</div></td></tr>';
    });

    if (body==='<tbody>') body+='<tr><td colspan="6" style="color:#6b7280">Sin datos semanales para los filtros.</td></tr>';
    body+='</tbody>';

    var tot = gb.reduce((acc,x)=>{ acc.c+=x.contactado; acc.a+=x.asignado; acc.s+=x.semiTotal; return acc; }, {c:0,a:0,s:0});
    var foot='<tfoot><tr>'
      +'<td><strong>Totales</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(tot.c,'contact')+'</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(tot.s,'semi')+'</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(tot.a,'asign')+'</strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-neutral">'+numeroCL(clamp0(tot.c - tot.a))+'</span></strong></td>'
      +'<td></td>'
      +'</tr></tfoot>';

    var wrap = document.getElementById('plTableWrap');
    wrap.innerHTML = '<table class="pl-table">'+thead+body+foot+'</table>';

    // toggle acordeón
    wrap.querySelectorAll('.acc-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-acc');
        var row = document.getElementById(id);
        if (!row) return;
        var on = row.style.display!=='none';
        row.style.display = on ? 'none' : '';
        btn.textContent = on ? 'Ver detalle' : 'Ocultar detalle';
        btn.classList.toggle('is-open', !on);
      });
    });
  }

  /* ---------- Export CSV (semanal con Δ) ---------- */
  function exportCSV(){
    var rowsW = filterWeekly(STATE.derivW, STATE.filters);
    var gb = groupByISO(rowsW);
    var byIso = {}; gb.forEach(x=>byIso[x.iso]=x);
    var lines = [];
    lines.push(['SemanaISO','Empresa','Proveedor','Contactado_t','SemiCerrado_t','Asignado_t','Disponible_t','DeltaDisp_vsPrev'].join(','));

    gb.forEach(function(r){
      // fusionar por proveedor en esta semana
      var idx = new Map();
      r.detContactado.forEach(function(v,k){ idx.set(k, {c:v,s:0,a:0}); });
      r.detSemi.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.s+=v; idx.set(k,o); });
      r.detAsign.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.a+=v; idx.set(k,o); });

      var prev = byIso[prevISO(r.iso)];
      var dispPrev = prev ? clamp0(prev.contactado - prev.asignado) : 0;
      var dispNow  = clamp0(r.contactado - r.asignado);
      var dDisp    = dispNow - dispPrev;

      Array.from(idx.entries()).forEach(function(pair){
        var k = pair[0], vals = pair[1];
        var prov = r.labelByKey.get(k) || k || '—';
        var contact=Number(vals.c)||0, semi=Number(vals.s)||0, asig=Number(vals.a)||0, disp=clamp0(contact - asig);
        lines.push([
          r.iso, csvEscape(STATE.filters.empresa||'—'), csvEscape(prov),
          contact, semi, asig, disp, dDisp
        ].join(','));
      });
    });

    function csvEscape(s){
      s = String(s==null?'':s);
      if (s.indexOf(',')>=0 || s.indexOf('"')>=0 || s.indexOf('\n')>=0){
        return '"'+s.replace(/"/g,'""')+'"';
      }
      return s;
    }

    var blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pipeline-mmpp-semanal.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- estado / montaje ---------- */
  var STATE = {
    derivW: [],      // semanal REAL (registro)
    filters: { year:null, empresa:'', q:'', weekIso:'' }
  };

  function renderAll(){
    var rowsW = filterWeekly(STATE.derivW, STATE.filters);
    renderKPIs(rowsW, STATE.filters);
    renderChart(rowsW, STATE.filters);
    renderTable(rowsW, STATE.filters);
  }

  function fillFilters(){
    var selY = document.getElementById('plYear');
    var selE = document.getElementById('plEmpresa');
    var selW = document.getElementById('plWeek');

    var years = uniqSorted(STATE.derivW.map(r=>r.iso.slice(0,4)));
    var yNow = (new Date()).getFullYear();
    var yDefault = years.indexOf(String(yNow))>=0 ? yNow : (years.length? years[years.length-1] : yNow);

    selY.innerHTML = years.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');

    var emp  = uniqSorted(STATE.derivW.map(r=>r.empresa).filter(Boolean));
    selE.innerHTML = '<option value="">Todas las empresas</option>' + emp.map(function(e){return '<option value="'+e+'">'+e+'</option>'}).join('');

    // Semanas disponibles según año/empresa/búsqueda
    var weeks = weeksWithData(STATE.derivW, {year:String(yDefault), empresa:'', q:''});
    selW.innerHTML = '<option value="">Semana (opcional)</option>' + weeks.map(w=>'<option value="'+w+'">'+w+'</option>').join('');
  }

  function refreshWeeksSelect(){
    var selW = document.getElementById('plWeek');
    var weeks = weeksWithData(STATE.derivW, STATE.filters);
    selW.innerHTML = '<option value="">Semana (opcional)</option>' + weeks.map(w=>'<option value="'+w+'" '+(STATE.filters.weekIso===w?'selected':'')+'>'+w+'</option>').join('');
    var hasWeeks = weeks.length>0;
    selW.classList.toggle('mute', !hasWeeks);
    document.getElementById('plBtnWeekNow').classList.toggle('mute', !hasWeeks);
    if (!hasWeeks){ STATE.filters.weekIso=''; }
  }

  function attachEvents(){
    function updateFromUI(){
      var y   = document.getElementById('plYear').value;
      var e   = document.getElementById('plEmpresa').value;
      var q   = (document.getElementById('plSearch').value||'').trim().toLowerCase();
      var wIso= (document.getElementById('plWeek').value||'').trim();

      STATE.filters.year = y;
      STATE.filters.empresa = e;
      STATE.filters.q = q;
      STATE.filters.weekIso = wIso;

      refreshWeeksSelect();
      renderAll();
    }

    ['plYear','plEmpresa','plSearch','plWeek'].forEach(function(id){
      var el=document.getElementById(id); if (el) el.addEventListener('input', updateFromUI);
      var elc=document.getElementById(id); if (elc) elc.addEventListener('change', updateFromUI);
    });

    var weekNowBtn = document.getElementById('plBtnWeekNow');
    if (weekNowBtn){
      weekNowBtn.addEventListener('click', function(){
        var now = currentISOKey();
        STATE.filters.weekIso = now;
        var selW = document.getElementById('plWeek');
        if (selW) selW.value = now;
        renderAll();
      });
    }

    var expBtn = document.getElementById('plBtnExport');
    if (expBtn){
      expBtn.addEventListener('click', function(){
        exportCSV();
      });
    }
  }

  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppPipeline');
    if (!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon, asig, semi){
      STATE.derivW = buildDerivWeekly(dispon, asig, semi);

      STATE.filters.year    = (new Date()).getFullYear().toString();
      STATE.filters.empresa = '';
      STATE.filters.q       = '';
      STATE.filters.weekIso = '';

      fillFilters();
      refreshWeeksSelect();
      attachEvents();
      renderAll();
    }

    if (opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig) && Array.isArray(opts.semi)){
      return go(opts.dispon, opts.asig, opts.semi);
    }

    if (global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      Promise.all([
        global.MMppApi.getDisponibilidades(),
        (global.MMppApi.getAsignaciones ? global.MMppApi.getAsignaciones() : Promise.resolve([])).catch(function(){return[];}),
        (global.MM
