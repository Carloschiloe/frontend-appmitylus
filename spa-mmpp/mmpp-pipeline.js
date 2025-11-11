/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Disponible - Asignado - Semi-cerrado (SEMANAL REAL)
   ► Foto real de lunes a domingo usando la FECHA DE REGISTRO de cada movimiento
   ► Eje semanal (ISO): W01..W53
   ► KPIs: totales de la semana seleccionada + Δ vs semana anterior
   ► Tooltip y acordeón por PROVEEDOR (clave normalizada SOLO proveedor)
   ► Exportar CSV por semana ISO / empresa / proveedor
*/
(function (global) {
  /* ======================= Utilidades base ======================= */
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function clamp0(x){ x=Number(x)||0; return x<0?0:x; }
  function uniqSorted(arr){ var set={}, out=[]; (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v);} }); out.sort(); return out; }
  function csvEscape(s){ s = String(s==null?'':s); return (/[",\n]/.test(s)) ? '"'+s.replace(/"/g,'""')+'"' : s; }

  // Normalización fuerte para agrupar por proveedor (sin comuna)
  function normalizeTxt(s){
    return String(s||'')
      .replace(/[–—]/g,'-')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }
  function makeProvKey(prov){ return normalizeTxt(prov); }
  function displayProv(prov){ return String(prov||'—').trim(); }

  // Extrae fecha de REGISTRO (no de destino). Intentamos varios campos.
  function pickRegistroFecha(o, preferidos){
    var keys = preferidos && preferidos.length ? preferidos : [
      'fechaRegistro','fecha','createdAt','updatedAt','fechaSemi','fechaAsignacion'
    ];
    for (var i=0;i<keys.length;i++){
      var v = o && o[keys[i]];
      if (!v) continue;
      var d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  // Semana ISO (lunes-domingo)
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
  function isoKey(d){ return getISOWeekYear(d) + '-W' + String(getISOWeek(d)).padStart(2,'0'); }
  function currentISO(){ return isoKey(new Date()); }
  function prevISO(iso){
    var m = /^(\d{4})-W(\d{2})$/.exec(String(iso||''));
    if (!m) return '';
    var y = Number(m[1]), w = Number(m[2]);
    // lunes de esa ISO-week
    var simple = new Date(Date.UTC(y,0,1 + (w-1)*7));
    var dow = simple.getUTCDay(); // 0..6 (domingo=0)
    var start = new Date(simple);
    if (dow===1) {/*lunes*/}
    else if (dow===0) start.setUTCDate(simple.getUTCDate()-6);
    else start.setUTCDate(simple.getUTCDate()-(dow-1));
    start.setUTCDate(start.getUTCDate()-7);
    return isoKey(start);
  }

  function cleanEmpresa(d, a){
    var s = (d && (d.empresaNombre||'')) || (a && (a.empresaNombre||'')) || (d && (d.proveedorNombre||d.contactoNombre||'')) || (a && (a.proveedorNombre||a.contactoNombre||'')) || '—';
    s = String(s||'').trim();
    return s || '—';
  }

  /* ======================= UI / estilos ======================= */
  function injectCSS(){
    if (document.getElementById('mmpp-pipeline-css')) return;
    var css = ''
      + '.pl-wrap{max-width:1200px;margin:0 auto;padding:20px}'
      + '.pl-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
      + '.pl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'
      + '.pl-title{margin:0;font-weight:800;color:#2b3440}'
      + '.pl-filters{display:grid;grid-template-columns:repeat(4,minmax(200px,1fr));gap:10px;align-items:center;margin-top:8px}'
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
      + '.pill{display:inline-block;padding:2px 10px;border-radius:9999px;font-weight:800;font-size:12px;line-height:1;border:1px solid transparent}'
      + '.pill-asign{color:#0EA5E9;background:rgba(14,165,233,.12);border-color:rgba(14,165,233,.35)}'
      + '.pill-semi{color:#22C55E;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35)}'
      + '.pill-contact{color:#475569;background:rgba(203,213,225,.35);border-color:rgba(148,163,184,.45)}'
      + '.pill-neutral{color:#111827;background:rgba(17,24,39,.06);border-color:rgba(17,24,39,.15)}'
      + '.row-actions{display:flex;gap:8px;flex-wrap:wrap}'
      + '.mute{opacity:.55;pointer-events:none}';
    var s=document.createElement('style'); s.id='mmpp-pipeline-css'; s.textContent=css; document.head.appendChild(s);
  }

  function buildUI(root){
    root.innerHTML = ''
    +'<div class="pl-wrap"><div class="pl-card">'
      +'<div class="pl-head" style="margin-bottom:10px">'
        +'<h2 class="pl-title">Disponible - Asignado - Semi-cerrado</h2>'
        +'<div class="pl-actions row-actions">'
          +'<button id="plBtnExport" class="pl-btn">Exportar CSV</button>'
        +'</div>'
      +'</div>'

      +'<div class="pl-filters">'
        +'<select id="plYear" class="pl-select"></select>'
        +'<select id="plEmpresa" class="pl-select"><option value="">Todas las empresas</option></select>'
        +'<input id="plSearch" class="pl-input" placeholder="Buscar proveedor..."/>'
        +'<div class="row-actions" style="align-items:center">'
          +'<select id="plWeek" class="pl-select" title="Semana ISO (YYYY-Www)"></select>'
          +'<button id="plBtnWeekNow" class="pl-btn">Semana actual</button>'
        +'</div>'
      +'</div>'

      +'<div class="pl-kpis" id="plKpis"></div>'

      +'<div class="pl-chart-wrap"><div class="pl-chart-frame"><div class="pl-chart-container">'
        +'<canvas id="plChart" class="pl-chart-canvas"></canvas>'
      +'</div></div><div id="plChartNote" class="pl-note"></div></div>'

      +'<div id="plTableWrap"></div>'
    +'</div></div>';
  }

  /* ======================= Derivación SEMANAL REAL ======================= */
  // Construye agregados semanales por EMPRESA y SEMANA ISO usando FECHA DE REGISTRO
  function buildWeekly(dispon, asig, semi){
    var map = new Map(); // key: empresa|iso -> obj

    function ensure(emp, iso){
      var k = emp+'|'+iso;
      if (!map.has(k)){
        map.set(k, {
          empresa: emp||'—',
          iso: iso,                         // "YYYY-Www"
          contactado: 0, asignado: 0, semiTotal: 0,
          detContactado:new Map(), detAsign:new Map(), detSemi:new Map(),
          labelByKey:new Map(), search:''
        });
      }
      return map.get(k);
    }

    // Contactado / disponible
    (dispon||[]).forEach(function(d){
      var dt = pickRegistroFecha(d, ['fechaRegistro','fecha','createdAt','updatedAt']);
      if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(d, null);
      var tons = Number((d.tons ?? d.tonsDisponible ?? d.cantidad) || 0) || 0;
      var row = ensure(emp, iso);

      var proveedor = d.proveedorNombre || d.contactoNombre || '—';
      var k = makeProvKey(proveedor), label = displayProv(proveedor);

      row.contactado += tons;
      row.detContactado.set(k, (row.detContactado.get(k)||0)+tons);
      if (!row.labelByKey.has(k)) row.labelByKey.set(k,label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Asignado
    (asig||[]).forEach(function(a){
      var dt = pickRegistroFecha(a, ['fechaRegistro','fecha','createdAt','updatedAt','fechaAsignacion']);
      if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(null, a);
      var tons= Number(a.cantidad || a.tons || 0) || 0;
      var row = ensure(emp, iso);

      var proveedor = a.proveedorNombre || a.contactoNombre || '—';
      var k = makeProvKey(proveedor), label = displayProv(proveedor);

      row.asignado += tons;
      row.detAsign.set(k, (row.detAsign.get(k)||0)+tons);
      if (!row.labelByKey.has(k)) row.labelByKey.set(k,label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Semi-cerrado
    (semi||[]).forEach(function(s){
      var dt = pickRegistroFecha(s, ['fechaRegistro','fecha','createdAt','updatedAt','fechaSemi']);
      if (!dt) return;
      var iso = isoKey(dt);
      var emp = cleanEmpresa(s, null);
      var tons= Number(s.tons || 0) || 0;
      var row = ensure(emp, iso);

      var proveedor = s.proveedorNombre || s.contactoNombre || '—';
      var k = makeProvKey(proveedor), label = displayProv(proveedor);

      row.semiTotal += tons;
      row.detSemi.set(k, (row.detSemi.get(k)||0)+tons);
      if (!row.labelByKey.has(k)) row.labelByKey.set(k,label);
      row.search += ' '+emp+' '+proveedor;
    });

    // salida ordenada por ISO asc
    return Array.from(map.values()).sort(function(a,b){ return a.iso.localeCompare(b.iso); });
  }

  /* ======================= Filtros y helpers ======================= */
  function filterWeekly(rows, filters){
    return (rows||[]).filter(function(r){
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return false;
      if (filters.empresa && r.empresa!==filters.empresa) return false;
      if (filters.q && r.search.indexOf(filters.q)<0) return false;
      if (filters.weekIso && r.iso!==filters.weekIso) return false;
      return true;
    });
  }

  function weeksAvailable(rows, filters){
    var set=new Set();
    (rows||[]).forEach(function(r){
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return;
      if (filters.empresa && r.empresa!==filters.empresa) return;
      if (filters.q && r.search.indexOf(filters.q)<0) return;
      set.add(r.iso);
    });
    return Array.from(set).sort();
  }

  function sumAcc(rows){
    var c=0,a=0,s=0;
    rows.forEach(function(r){ c+=r.contactado; a+=r.asignado; s+=r.semiTotal; });
    return {contact:c, asign:a, semi:s, disp:clamp0(c-a)};
  }

  function breakdownMerge(detC, detS, detA){
    var idx=new Map();
    detC.forEach(function(v,k){ idx.set(k, {c:v,s:0,a:0}); });
    detS.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.s+=v; idx.set(k,o); });
    detA.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.a+=v; idx.set(k,o); });
    return idx;
  }

  /* ======================= KPIs ======================= */
  function numeroPct(delta, base){
    base = Number(base)||0;
    if (base<=0) return '—';
    return (delta>=0?'+':'') + Math.round(delta*100/base) + '%';
  }

  function renderKPIs(weeklyAll, filters){
    // Semana elegida (o actual si no hay selección pero existe)
    var isoNow = filters.weekIso || currentISO();
    var nowRows  = filterWeekly(weeklyAll, Object.assign({}, filters, {weekIso: isoNow}));
    var prevIso  = prevISO(isoNow);
    var prevRows = filterWeekly(weeklyAll, Object.assign({}, filters, {weekIso: prevIso}));

    var now = sumAcc(nowRows), prev = sumAcc(prevRows);
    var dDisp = now.disp - prev.disp;
    var dAsig = now.asign - prev.asign;
    var dSemi = now.semi - prev.semi;
    var dCont = now.contact - prev.contact;

    var html = ''
      + card('Disponible',  pill('neutral', now.disp),  'vs semana anterior', dDisp, numeroPct(dDisp, prev.disp))
      + card('Semi-cerrado',pill('semi',    now.semi),  'vs semana anterior', dSemi, numeroPct(dSemi, prev.semi))
      + card('Asignado',    pill('asign',   now.asign), 'vs semana anterior', dAsig, numeroPct(dAsig, prev.asign))
      + card('Contactado',  pill('contact', now.contact),'vs semana anterior', dCont, numeroPct(dCont, prev.contact))
      + card('# Empresas',  '<span class="pill pill-neutral">'+numeroCL(uniqSorted(nowRows.map(r=>r.empresa)).length)+'</span>', '', null, '')
      + card('Semana actual','<span class="pill pill-neutral">'+isoNow+'</span>','',null,'');

    document.getElementById('plKpis').innerHTML = html;

    function pill(kind, n){ return '<span class="pill pill-'+kind+'">'+numeroCL(n)+'</span>'; }
    function card(lab, valHtml, subLab, dVal, dPct){
      var sub = (dVal==null)? '' : ('<div class="sub">'+subLab+': '+ (dVal>=0?'+':'')+numeroCL(dVal)+' ('+dPct+')</div>');
      return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+valHtml+'</div>'+sub+'</div>';
    }
  }

  /* ======================= Chart ======================= */
  var chartRef=null;
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

  function renderChart(weeklyAll, filters){
    var canvas = document.getElementById('plChart');
    if (!canvas) return;

    if (!global.Chart){
      var ctx0 = canvas.getContext('2d');
      ctx0.clearRect(0,0,canvas.width||300,canvas.height||150);
      document.getElementById('plChartNote').textContent = 'Chart.js no está cargado; se muestra solo la tabla.';
      return;
    }
    document.getElementById('plChartNote').textContent = '';

    // Serie de semanas del año/empresa/consulta
    var weeks = weeksAvailable(weeklyAll, filters);
    var rows = weeks.map(function(iso){
      var sub = filterWeekly(weeklyAll, Object.assign({}, filters, {weekIso: iso}));
      var acc = sumAcc(sub);
      // calcular breakdown agregando todos los registros de esa semana
      var detC=new Map(), detA=new Map(), detS=new Map(), labelByKey=new Map();
      sub.forEach(function(r){
        r.detContactado.forEach((v,k)=>detC.set(k,(detC.get(k)||0)+v));
        r.detAsign.forEach((v,k)=>detA.set(k,(detA.get(k)||0)+v));
        r.detSemi.forEach((v,k)=>detS.set(k,(detS.get(k)||0)+v));
        r.labelByKey.forEach((lbl,k)=>{ if (!labelByKey.has(k)) labelByKey.set(k,lbl); });
      });
      return {iso:iso, acc:acc, detC:detC, detA:detA, detS:detS, labelByKey:labelByKey};
    });

    var labels = rows.map(r=>r.iso);
    var dataAsign = rows.map(r=>r.acc.asign);
    var dataSemi  = rows.map(r=>r.acc.semi);
    var dataDisp  = rows.map(r=>r.acc.disp);

    var toolDetail = {}; var accDetail={};
    rows.forEach(function(r){
      // ordenamos top proveedores por dataset
      function toPairs(mp){ var a=[]; mp.forEach((v,k)=>a.push({k,v})); a.sort((A,B)=>B.v-A.v); return a; }
      toolDetail[r.iso] = {
        asign: toPairs(r.detA),
        semi : toPairs(r.detS),
        contact: toPairs(r.detC),
      };
      accDetail[r.iso] = {labelByKey:r.labelByKey};
    });

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Asignado',     data: dataAsign, borderWidth:1, stack:'pipeline', backgroundColor:'#0EA5E9' },
          { label: 'Semi-cerrado', data: dataSemi,  borderWidth:1, stack:'pipeline', backgroundColor:'#22C55E' },
          { label: 'Disponible',   data: dataDisp,  borderWidth:1, stack:'pipeline', backgroundColor:'#CBD5E1' }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:false,
        interaction:{ mode:'nearest', intersect:true },
        layout:{ padding:{ top:12 } },
        plugins:{
          legend:{ position:'right' },
          stackTotals:{ enabled:true, fontSize:12 },
          tooltip:{
            callbacks:{
              title: function(items){ return (items && items[0] && items[0].label) ? items[0].label : ''; },
              label: function(ctx){
                var iso = ctx.label, ds = ctx.dataset.label;
                var det = toolDetail[iso] || {};
                var arr = (ds==='Asignado' ? det.asign : ds==='Semi-cerrado' ? det.semi : det.contact) || [];
                var lblMap = (accDetail[iso] && accDetail[iso].labelByKey) || new Map();
                var lines = arr.slice(0,8).map(function(p){
                  var prov = lblMap.get(p.k) || p.k || '—';
                  return '• '+prov+': '+numeroCL(p.v)+' t';
                });
                if (arr.length>8) lines.push('• +'+(arr.length-8)+' más…');
                return lines.length?lines:['(sin detalle)'];
              },
              footer: function(ctx){
                var v = ctx && ctx[0] && ctx[0].parsed && ctx[0].parsed.y;
                return 'Subtotal '+ctx[0].dataset.label+': '+numeroCL(v)+' t';
              }
            }
          }
        },
        scales:{
          x:{ stacked:true, ticks:{ autoSkip:false, maxRotation:0, minRotation:0 } },
          y:{ stacked:true, beginAtZero:true, grace:'15%', ticks:{ padding:6 } }
        }
      },
      plugins:[stackTotalPlugin]
    });

    renderTable(rows); // acordeón semanal
  }

  /* ======================= Tabla (semanal) ======================= */
  function renderTable(rows){
    var wrap = document.getElementById('plTableWrap');
    var thead = '<thead><tr>'
      +'<th>SEMANA ISO</th>'
      +'<th class="pl-right">CONTACTADO</th>'
      +'<th class="pl-right">SEMI-CERRADO</th>'
      +'<th class="pl-right">ASIGNADO</th>'
      +'<th class="pl-right">DISPONIBLE</th>'
      +'<th></th>'
      +'</tr></thead>';

    var body = '<tbody>', tc=0, ta=0, ts=0, td=0;

    rows.forEach(function(r, idx){
      var acc = r.acc;
      tc+=acc.contact; ta+=acc.asign; ts+=acc.semi; td+=acc.disp;
      var accId = 'acc_'+idx;
      body += '<tr>'
        +'<td>'+r.iso+'</td>'
        +'<td class="pl-right"><span class="pill pill-contact">'+numeroCL(acc.contact)+'</span></td>'
        +'<td class="pl-right"><span class="pill pill-semi">'+numeroCL(acc.semi)+'</span></td>'
        +'<td class="pl-right"><span class="pill pill-asign">'+numeroCL(acc.asign)+'</span></td>'
        +'<td class="pl-right"><span class="pill pill-neutral">'+numeroCL(acc.disp)+'</span></td>'
        +'<td class="pl-right"><button class="acc-btn" data-acc="'+accId+'">Ver detalle</button></td>'
      +'</tr>'
      +'<tr id="'+accId+'" style="display:none"><td colspan="6">'
        +'<div class="acc-body">'
          +'<div style="font-weight:700;margin-bottom:6px">Detalle por proveedor</div>'
          +'<div class="acc-grid">'
            +'<div style="color:#64748b">Proveedor</div>'
            +'<div class="pl-right" style="color:#64748b">Contactado (t)</div>'
            +'<div class="pl-right" style="color:#64748b">Semi-cerrado (t)</div>'
            +'<div class="pl-right" style="color:#64748b">Asignado (t)</div>'
          +'</div>';

      var idxMap = breakdownMerge(r.detC, r.detS, r.detA);
      Array.from(idxMap.entries())
        .sort(function(A,B){
          var va=A[1].c+A[1].s+A[1].a, vb=B[1].c+B[1].s+B[1].a; return vb-va;
        })
        .forEach(function(pair){
          var k = pair[0], v = pair[1];
          var prov = r.labelByKey.get(k) || k || '—';
          body += '<div class="acc-grid"><div>'+prov+'</div>'
                +'<div class="pl-right">'+(v.c?'<span class="pill pill-contact">'+numeroCL(v.c)+'</span>':'—')+'</div>'
                +'<div class="pl-right">'+(v.s?'<span class="pill pill-semi">'+numeroCL(v.s)+'</span>':'—')+'</div>'
                +'<div class="pl-right">'+(v.a?'<span class="pill pill-asign">'+numeroCL(v.a)+'</span>':'—')+'</div></div>';
        });

      body += '</div></td></tr>';
    });

    if (rows.length===0){
      body += '<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    }
    body += '</tbody>';

    var foot = '<tfoot><tr>'
      +'<td><strong>Totales</strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-contact">'+numeroCL(tc)+'</span></strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-semi">'+numeroCL(ts)+'</span></strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-asign">'+numeroCL(ta)+'</span></strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-neutral">'+numeroCL(td)+'</span></strong></td>'
      +'<td></td>'
      +'</tr></tfoot>';

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

  /* ======================= Export CSV ======================= */
  function exportCSV(weeklyAll, filters){
    // Exporta filas por semana ISO / empresa / proveedor
    var weeks = weeksAvailable(weeklyAll, filters);
    var lines = [];
    lines.push(['SemanaISO','Año','Empresa','Proveedor','Contactado_t','SemiCerrado_t','Asignado_t','Disponible_t'].join(','));

    weeks.forEach(function(iso){
      var sub = filterWeekly(weeklyAll, Object.assign({}, filters, {weekIso: iso}));

      // mergear breakdown por proveedor
      var detC=new Map(), detA=new Map(), detS=new Map(), labelByKey=new Map();
      sub.forEach(function(r){
        r.detContactado.forEach((v,k)=>detC.set(k,(detC.get(k)||0)+v));
        r.detAsign.forEach((v,k)=>detA.set(k,(detA.get(k)||0)+v));
        r.detSemi.forEach((v,k)=>detS.set(k,(detS.get(k)||0)+v));
        r.labelByKey.forEach((lbl,k)=>{ if (!labelByKey.has(k)) labelByKey.set(k,lbl); });
      });
      var idx = breakdownMerge(detC, detS, detA);
      idx.forEach(function(v,k){
        var prov = labelByKey.get(k) || k || '—';
        var contact = Number(v.c)||0, semi=Number(v.s)||0, asign=Number(v.a)||0, disp=clamp0(contact - asign);
        lines.push([iso, iso.slice(0,4), csvEscape(filters.empresa||'—'), csvEscape(prov), contact, semi, asign, disp].join(','));
      });
    });

    var blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pipeline-mmpp-semanal.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ======================= Estado / montaje ======================= */
  var STATE = {
    weekly: [],
    filters: { year:'', empresa:'', q:'', weekIso:'' }
  };

  function optionsFromWeekly(weekly){
    var emp  = uniqSorted((weekly||[]).map(r=>r.empresa).filter(Boolean));
    var years= uniqSorted((weekly||[]).map(r=>r.iso.slice(0,4)).filter(Boolean));
    return {emp, years};
  }

  function fillFilters(weekly){
    var selY = document.getElementById('plYear');
    var selE = document.getElementById('plEmpresa');
    var selW = document.getElementById('plWeek');

    var opts = optionsFromWeekly(weekly);
    var yNow = (new Date()).getFullYear().toString();
    var years = opts.years.length ? opts.years : [yNow];
    var yDefault = years.includes(yNow) ? yNow : years[years.length-1];

    selY.innerHTML = years.map(y => '<option value="'+y+'" '+(y===yDefault?'selected':'')+'>'+y+'</option>').join('');
    selE.innerHTML = '<option value="">Todas las empresas</option>' + opts.emp.map(e=>'<option value="'+e+'">'+e+'</option>').join('');
    selW.innerHTML = '<option value="">Semana (opcional)</option>';
  }

  function refreshWeeks(){
    var selW = document.getElementById('plWeek');
    var weeks = weeksAvailable(STATE.weekly, STATE.filters);
    selW.innerHTML = '<option value="">Semana (opcional)</option>'+weeks.map(w=>'<option value="'+w+'" '+(STATE.filters.weekIso===w?'selected':'')+'>'+w+'</option>').join('');
    var hasWeeks = weeks.length>0;
    selW.classList.toggle('mute', !hasWeeks);
    document.getElementById('plBtnWeekNow').classList.toggle('mute', !hasWeeks);
    if (!hasWeeks) STATE.filters.weekIso='';
  }

  function attachEvents(){
    function update(){
      var y   = document.getElementById('plYear').value;
      var e   = document.getElementById('plEmpresa').value;
      var q   = (document.getElementById('plSearch').value||'').trim().toLowerCase();
      var wIso= (document.getElementById('plWeek').value||'').trim();

      STATE.filters.year = y;
      STATE.filters.empresa = e;
      STATE.filters.q = q;
      STATE.filters.weekIso = wIso;

      refreshWeeks();
      renderAll();
    }

    ['plYear','plEmpresa','plSearch','plWeek'].forEach(function(id){
      var el=document.getElementById(id); if (el) el.addEventListener('input', update);
      var elc=document.getElementById(id); if (elc) elc.addEventListener('change', update);
    });

    var weekNowBtn = document.getElementById('plBtnWeekNow');
    if (weekNowBtn){
      weekNowBtn.addEventListener('click', function(){
        var now = currentISO();
        var selW = document.getElementById('plWeek');
        if (selW){ selW.value = now; STATE.filters.weekIso = now; }
        renderAll();
      });
    }

    var expBtn = document.getElementById('plBtnExport');
    if (expBtn){
      expBtn.addEventListener('click', function(){
        exportCSV(STATE.weekly, STATE.filters);
      });
    }
  }

  function renderAll(){
    renderKPIs(STATE.weekly, STATE.filters);
    renderChart(STATE.weekly, STATE.filters);
  }

  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppPipeline');
    if (!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon, asig, semi){
      STATE.weekly = buildWeekly(dispon, asig, semi);
      fillFilters(STATE.weekly);

      var ySel = document.getElementById('plYear');
      STATE.filters.year = ySel ? ySel.value : '';
      STATE.filters.empresa = '';
      STATE.filters.q = '';
      STATE.filters.weekIso = '';

      attachEvents();
      refreshWeeks();
      renderAll();
    }

    if (opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig) && Array.isArray(opts.semi)){
      return go(opts.dispon, opts.asig, opts.semi);
    }

    // Carga por API si existe
    if (global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      Promise.all([
        global.MMppApi.getDisponibilidades(),
        (global.MMppApi.getAsignaciones ? global.MMppApi.getAsignaciones() : Promise.resolve([])).catch(function(){return[];}),
        (global.MMppApi.getSemiCerrados ? global.MMppApi.getSemiCerrados() : Promise.resolve([])).catch(function(){return[];})
      ]).then(function(res){ go(res[0]||[], res[1]||[], res[2]||[]); })
       .catch(function(){ go([],[],[]); });
    } else {
      go([],[],[]);
    }
  }

  // Exponer
  global.MMppPipeline = { mount, refresh: renderAll };
})(window);
