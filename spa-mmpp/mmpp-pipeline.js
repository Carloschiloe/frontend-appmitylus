/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Contactado vs Asignado (corregido por mes de destino + fallbacks)
   - Contactado: suma por mes de la disponibilidad (d.mes/d.anio)
   - Asignado:   suma por mes de destino de la asignación (a.destMes/a.destAnio)
   - Eje alternable: Empresa ↔ Mes
   - Tooltip: Contacto — Comuna + Asignado / Saldo
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
      + '.pl-filters{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:10px;align-items:center;margin-top:8px}'
      + '.pl-select{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
      + '.pl-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
      + '.pl-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
      + '.pl-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:10px}'
      + '.kpi{background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:14px}'
      + '.kpi .lab{font-size:12px;color:#64748b}'
      + '.kpi .val{font-size:22px;font-weight:900;color:#111827}'
      + '.pl-monthsbar{width:100%;margin:10px 0 6px 0;overflow-x:auto}'
      + '.pl-months-line{width:100%;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px}'
      + '.pl-chip{width:100%;height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #c7d2fe;background:#eef2ff;color:#1e40af;border-radius:999px;font-weight:700;cursor:pointer;user-select:none;font-size:13px;white-space:nowrap;padding:0 10px}'
      + '.pl-chip.is-on{background:#1e40af;color:#fff;border-color:#1e40af}'
      + '.pl-chart-wrap{margin-top:14px}'
      + '.pl-chart-frame{display:block;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}'
      + '.pl-chart-container{position:relative;width:100%;height:360px}'
      + '.pl-chart-canvas{display:block;width:100% !important;height:100% !important}'
      + '.pl-note{color:#64748b;font-size:12px;margin-top:6px}'
      + '.pl-table{width:100%;border-collapse:separate;border-spacing:0 8px;margin-top:14px}'
      + '.pl-table th,.pl-table td{padding:10px 8px}'
      + '.pl-table tr{background:#fff;border:1px solid #e5e7eb}'
      + '.pl-right{text-align:right}'
      + '@media (max-width: 1100px){ .pl-kpis{grid-template-columns:repeat(2,minmax(0,1fr))} }'
      + '@media (max-width: 720px){ .pl-filters{grid-template-columns:1fr} }';
    var s = document.createElement('style');
    s.id = 'mmpp-pipeline-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- utils ---------- */
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pct(a,b){ a=Number(a)||0; b=Number(b)||0; if(b<=0) return '—'; return Math.round((a*100)/b)+'%'; }
  function range12(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; }
  function uniqSorted(arr){
    var set = {}, out=[];
    (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort(); return out;
  }
  function cleanStr(s){ return String(s||'').trim(); }

  /* ---------- UI skeleton ---------- */
  function buildUI(root){
    root.innerHTML = ''
    +'<div class="pl-wrap">'
      +'<div class="pl-card">'
        +'<div class="pl-head" style="margin-bottom:10px">'
          +'<h2 class="pl-title">Pipeline MMPP — Contactado vs Asignado</h2>'
          +'<div class="pl-actions">'
            +'<label style="display:flex;gap:8px;align-items:center">'
              +'<input id="plHideEmptyMonths" type="checkbox" checked />'
              +'<span>Ocultar meses sin datos</span>'
            +'</label>'
            +'<button id="plBtnMesesConDatos" class="pl-btn">Meses con datos</button>'
            +'<button id="plBtnLimpiarMeses" class="pl-btn">Limpiar meses</button>'
            +'<button id="plBtnLimpiarFiltros" class="pl-btn">Limpiar filtros</button>'
            +'<button id="plAxisBtn" class="pl-btn">Eje: Empresa</button>'
          +'</div>'
        +'</div>'

        +'<div class="pl-filters">'
          +'<select id="plYear" class="pl-select"></select>'
          +'<select id="plProv" class="pl-select"><option value="">Todos los contactos</option></select>'
          +'<select id="plComuna" class="pl-select"><option value="">Todas las comunas</option></select>'
          +'<select id="plEmpresa" class="pl-select"><option value="">Todas las empresas</option></select>'
        +'</div>'

        +'<div class="pl-monthsbar"><div id="plMonths" class="pl-months-line"></div></div>'

        +'<div class="pl-kpis" id="plKpis"></div>'

        +'<div class="pl-chart-wrap">'
          +'<div class="pl-chart-frame">'
            +'<div class="pl-chart-container">'
              +'<canvas id="plChart" class="pl-chart-canvas"></canvas>'
            +'</div>'
          +'</div>'
          +'<div id="plChartNote" class="pl-note"></div>'
        +'</div>'

        +'<div id="plTableWrap"></div>'
      +'</div>'
    +'</div>';
  }

  /* ---------- Estado (incluye caches para fallbacks) ---------- */
  var STATE = {
    deriv: [],
    filters: { year:null, proveedor:'', comuna:'', empresa:'', months:[] },
    hideEmpty: true,
    axisMode: 'empresa',  // 'empresa' | 'mes'
    contactosById: {},
    proveedoresById: {},
    contactosByNombre: {},
    proveedoresByNombre: {}
  };

  /* ---------- Fallback helpers ---------- */
  function indexAuxiliares(contactos, proveedores){
    STATE.contactosById = {};
    STATE.proveedoresById = {};
    STATE.contactosByNombre = {};
    STATE.proveedoresByNombre = {};
    (contactos||[]).forEach(function(c){
      if (!c) return;
      if (c.id!=null) STATE.contactosById[String(c.id)] = c;
      if (c.nombre) STATE.contactosByNombre[cleanStr(c.nombre).toLowerCase()] = c;
    });
    (proveedores||[]).forEach(function(p){
      if (!p) return;
      if (p.id!=null) STATE.proveedoresById[String(p.id)] = p;
      if (p.nombre) STATE.proveedoresByNombre[cleanStr(p.nombre).toLowerCase()] = p;
    });
  }

  function nombreContactoOProveedor(d){
    var n = cleanStr(d.contactoNombre)||cleanStr(d.proveedorNombre)||'';
    if (n) return n;
    // por id
    if (d.contactoId && STATE.contactosById[d.contactoId]) return STATE.contactosById[d.contactoId].nombre||'';
    if (d.proveedorId && STATE.proveedoresById[d.proveedorId]) return STATE.proveedoresById[d.proveedorId].nombre||'';
    // por nombre crudo en índices
    var tryN = cleanStr(d.proveedor)||cleanStr(d.contacto)||'';
    if (tryN){
      var k = tryN.toLowerCase();
      if (STATE.contactosByNombre[k]) return STATE.contactosByNombre[k].nombre||tryN;
      if (STATE.proveedoresByNombre[k]) return STATE.proveedoresByNombre[k].nombre||tryN;
      return tryN;
    }
    return '—';
  }

  function empresaDe(d){
    var e = cleanStr(d.empresaNombre)||cleanStr(d.empresa)||'';
    if (e) return e;
    // por id desde contactos/proveedores
    if (d.contactoId && STATE.contactosById[d.contactoId] && STATE.contactosById[d.contactoId].empresaNombre){
      return cleanStr(STATE.contactosById[d.contactoId].empresaNombre);
    }
    if (d.proveedorId && STATE.proveedoresById[d.proveedorId] && STATE.proveedoresById[d.proveedorId].empresaNombre){
      return cleanStr(STATE.proveedoresById[d.proveedorId].empresaNombre);
    }
    return ''; // si queda vacío, se mostrará "Sin empresa"
  }

  /* ---------- DERIVACIÓN DE DATOS CORREGIDA ---------- */

  // Registros mensuales por empresa y mes.
  // out: { empresa, prov (contacto), comuna, anio, mes, contactado, asignado, saldo, lotes }
  function buildDerivMonthly(dispon, asig){
    var dispById = {};
    (dispon||[]).forEach(function(d){
      if (d && d.id!=null) dispById[String(d.id)] = d;
    });

    var map = {}; // key: empresa|anio|mes
    function key(empresa, anio, mes){ return (empresa||'') + '|' + (anio||'') + '|' + (mes||0); }
    function ensure(empresa, anio, mes){
      var k = key(empresa, anio, mes);
      if (!map[k]){
        map[k] = {
          empresa: empresa||'',
          anio: Number(anio)||null,
          mes: Number(mes)||0,
          contactado: 0,
          asignado: 0,
          _ids: new Set(),
          _detalle: [] // para tooltip (contacto/comuna/asignado/saldo)
        };
      }
      return map[k];
    }

    // 1) Contactado por mes de disponibilidad (agrupa por empresa)
    (dispon||[]).forEach(function(d){
      var empresa = empresaDe(d);
      var anio = Number(d.anio)||null;
      var mes  = Number(d.mes)||0;
      var tons = Number(d.tons||0)||0;
      var row = ensure(empresa, anio, mes);
      row.contactado += tons;
      row._ids.add(String(d.id));
      // guarda detalle base por cada disponibilidad
      var prov = nombreContactoOProveedor(d);
      var comuna = cleanStr(d.comuna)||'';
      row._detalle.push({
        contacto: prov,
        comuna: comuna,
        contactado: tons,
        asignado: 0, // se completará con asignaciones
        _dispId: d.id
      });
    });

    // 2) Asignado por mes de destino (usando empresa desde disponibilidad)
    (asig||[]).forEach(function(a){
      var destY = Number(a.destAnio||a.anio||0)||0;
      var destM = Number(a.destMes ||a.mes ||0)||0;
      if (!destY || !destM) return;

      var dpo = dispById[String(a.disponibilidadId||'')];
      // empresa base por disponibilidad, con fallbacks
      var empresa = '';
      if (dpo){
        empresa = empresaDe(dpo);
      }
      // último recurso: si la asignación trae empresaNombre
      if (!empresa && a.empresaNombre) empresa = cleanStr(a.empresaNombre);

      var row = ensure(empresa, destY, destM);
      var qty = Number(a.cantidad||a.tons||0)||0;
      row.asignado += qty;
      if (dpo && dpo.id!=null) row._ids.add(String(dpo.id));

      // agrega/actualiza detalle por contacto de esta asignación
      var contacto = nombreContactoOProveedor(dpo||a);
      var comuna = cleanStr((dpo && dpo.comuna)||a.comuna)||'';
      // intenta encontrar entrada previa del mismo contacto en el detalle del mes/empresa
      var found = null;
      for (var i=0;i<row._detalle.length;i++){
        var it = row._detalle[i];
        if (it.contacto===contacto && it.comuna===comuna){
          found = it; break;
        }
      }
      if (!found){
        row._detalle.push({
          contacto: contacto,
          comuna: comuna,
          contactado: 0,
          asignado: qty
        });
      } else {
        found.asignado = (Number(found.asignado)||0) + qty;
      }
    });

    // salida como array (calcula saldo y lotes)
    var out = Object.keys(map).map(function(k){
      var o = map[k];
      var saldo = Math.max(0, (o.contactado||0) - (o.asignado||0));
      // calcula saldo por item para tooltip
      (o._detalle||[]).forEach(function(it){
        it.saldo = Math.max(0, (Number(it.contactado)||0) - (Number(it.asignado)||0));
      });
      return {
        empresa: o.empresa || '',
        anio: o.anio,
        mes: o.mes,
        contactado: o.contactado,
        asignado: o.asignado,
        saldo: saldo,
        lotes: o._ids.size,
        _detalle: o._detalle
      };
    });

    return out;
  }

  // meses con datos (contactado o asignado > 0)
  function mesesConDatosDispon(deriv, filters){
    var sumByM = {}; for (var i=1;i<=12;i++) sumByM[i]=0;
    (deriv||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.proveedor && r._detalle && !r._detalle.some(d=>d.contacto===filters.proveedor)) return;
      if (filters.comuna && !(r._detalle||[]).some(d=> (d.comuna||"")===filters.comuna)) return;
      if (filters.empresa && (r.empresa||"")!==filters.empresa) return;
      sumByM[r.mes] += (Number(r.contactado)||0) + (Number(r.asignado)||0);
    });
    var out=[]; for (var mi=1; mi<=12; mi++) if (sumByM[mi]>0) out.push(mi);
    return out;
  }

  function filterDeriv(deriv, filters){
    var monthsSel = filters.months || [];
    return (deriv||[]).filter(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return false;
      if (filters.empresa && (r.empresa||"")!==filters.empresa) return false;
      if (filters.proveedor && !(r._detalle||[]).some(function(d){ return d.contacto===filters.proveedor; })) return false;
      if (filters.comuna && !(r._detalle||[]).some(function(d){ return (d.comuna||"")===filters.comuna; })) return false;
      if (monthsSel.length && monthsSel.indexOf(Number(r.mes))<0) return false;
      return true;
    });
  }

  /* ---------- Agrupadores para gráfico/tabla ---------- */
  function groupByEmpresa(rows){
    var map={}, setRows={};
    rows.forEach(function(r){
      var k = r.empresa || 'Sin empresa';
      if (!map[k]){ map[k] = {empresa:k, contactado:0, asignado:0, lotes:0, detalle:[]}; setRows[k]=new Set(); }
      map[k].contactado += r.contactado||0;
      map[k].asignado   += r.asignado||0;
      (r._detalle||[]).forEach(function(it){ map[k].detalle.push(it); });
      setRows[k].add(r.anio+'-'+r.mes);
    });
    var arr = Object.keys(map).map(function(k){
      return {
        empresa: k || 'Sin empresa',
        contactado: map[k].contactado,
        asignado: map[k].asignado,
        saldo: Math.max(0, map[k].contactado - map[k].asignado),
        lotes: setRows[k].size,
        detalle: map[k].detalle
      };
    });
    arr.sort(function(a,b){ return (b.contactado||0)-(a.contactado||0); });
    return arr;
  }

  function groupByMes(rows){
    var map={}; for (var m=1;m<=12;m++) map[m]={mes:m,contactado:0,asignado:0,_ids:new Set()};
    rows.forEach(function(r){
      var k=r.mes||0; if(!map[k]) map[k]={mes:k,contactado:0,asignado:0,_ids:new Set()};
      map[k].contactado += r.contactado;
      map[k].asignado   += r.asignado;
      map[k]._ids.add((r.empresa||'')+'|'+r.anio+'|'+r.mes);
    });
    var arr = range12().map(function(m){
      var o = map[m];
      return {
        mes: m,
        contactado: o.contactado,
        asignado: o.asignado,
        saldo: Math.max(0, o.contactado - o.asignado),
        lotes: o._ids.size
      };
    });
    return arr;
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(rows){
    var contact=0, asign=0, empSet=new Set();
    rows.forEach(function(r){ contact+=r.contactado; asign+=r.asignado; empSet.add(r.empresa||'Sin empresa'); });
    var saldo = Math.max(0, contact - asign);
    var html = ''
      +kpi('Contactado', numeroCL(contact)+' tons')
      +kpi('Asignado', numeroCL(asign)+' tons')
      +kpi('% Asignación', (contact>0?Math.round(asign*100/contact)+'%':'—'))
      +kpi('Saldo', numeroCL(saldo)+' tons')
      +kpi('# Proveedores', numeroCL(empSet.size));
    document.getElementById('plKpis').innerHTML = html;

    function kpi(lab,val){ return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+val+'</div></div>'; }
  }

  /* ---------- Chart ---------- */
  var chartRef = null;

  function renderChart(rows, axisMode){
    var canvas = document.getElementById('plChart');
    if (!canvas) return;

    if (!global.Chart){
      var ctx0 = canvas.getContext('2d');
      ctx0.clearRect(0,0,canvas.width||300,canvas.height||150);
      document.getElementById('plChartNote').textContent = 'Chart.js no está cargado; se muestra solo la tabla.';
      return;
    }
    document.getElementById('plChartNote').textContent = '';

    var labels=[], dataAsign=[], dataNoAsig=[], tipMap = {};
    if (axisMode==='empresa'){
      var g = groupByEmpresa(rows);
      labels = g.map(function(x){return x.empresa || 'Sin empresa';});
      dataAsign = g.map(function(x){return x.asignado;});
      dataNoAsig= g.map(function(x){return Math.max(0, x.contactado-x.asignado);});
      // tooltip map: por empresa una lista de {texto}
      for (var i=0;i<g.length;i++){
        var emp = g[i];
        var items = [];
        // ordena por asignado desc
        var det = (emp.detalle||[]).slice().sort(function(a,b){ return (b.asignado||0)-(a.asignado||0); });
        det.forEach(function(it){
          // Contacto — Comuna + asignado/saldo
          var linea = (it.contacto||'—')+' — '+(it.comuna||'—');
          var meta = [];
          if ((it.asignado||0)>0) meta.push('Asignado: '+numeroCL(it.asignado)+' t');
          if ((it.saldo||0)>0)    meta.push('Saldo: '+numeroCL(it.saldo)+' t');
          if (meta.length) linea += ' · ' + meta.join(' · ');
          items.push(linea);
        });
        tipMap[emp.empresa||'Sin empresa'] = items;
      }
    } else {
      var gm = groupByMes(rows);
      labels = gm.map(function(x){return MMESES[x.mes-1];});
      dataAsign = gm.map(function(x){return x.asignado;});
      dataNoAsig= gm.map(function(x){return Math.max(0, x.contactado-x.asignado);});
      // tooltip simple por mes
      for (var j=0;j<gm.length;j++){
        tipMap[MMESES[gm[j].mes-1]] = [
          'Asignado: '+numeroCL(gm[j].asignado)+' t',
          'Saldo: '+numeroCL(Math.max(0, gm[j].contactado-gm[j].asignado))+' t'
        ];
      }
    }

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Asignado', data: dataAsign, borderWidth: 1, stack: 'pipeline' },
          { label: 'No asignado', data: dataNoAsig, borderWidth: 1, stack: 'pipeline' }
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
          tooltip: {
            callbacks: {
              title: function(ctx){ return ctx[0]?.label || ''; },
              label: function(){ return ''; }, // ocultamos label por dataset
              afterBody: function(ctx){
                var label = ctx[0]?.label || '';
                var lines = tipMap[label] || [];
                return lines;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { autoSkip:false, maxRotation:45, minRotation:45 } },
          y: { stacked: true, beginAtZero: true, grace: '15%', ticks: { padding: 6 } }
        }
      }
    });
  }

  /* ---------- Tabla ---------- */
  function renderTable(rows, axisMode, year){
    var html='';
    if (axisMode==='empresa'){
      var g = groupByEmpresa(rows);
      var thead='<thead><tr>'
        +'<th>EMPRESA</th>'
        +'<th class="pl-right">CONTACTADO '+(year||'')+'</th>'
        +'<th class="pl-right">ASIGNADO</th>'
        +'<th class="pl-right">% ASIG</th>'
        +'<th class="pl-right">SALDO</th>'
        +'<th class="pl-right"># LOTES</th>'
        +'</tr></thead>';
      var body='<tbody>';
      var totC=0, totA=0, totL=0;
      for (var i=0;i<g.length;i++){
        var r=g[i]; if (r.contactado<=0 && r.asignado<=0) continue;
        totC+=r.contactado; totA+=r.asignado; totL+=r.lotes;
        body+='<tr>'
           +'<td><strong>'+ (r.empresa||'Sin empresa') +'</strong></td>'
           +'<td class="pl-right">'+numeroCL(r.contactado)+'</td>'
           +'<td class="pl-right">'+numeroCL(r.asignado)+'</td>'
           +'<td class="pl-right">'+pct(r.asignado,r.contactado)+'</td>'
           +'<td class="pl-right">'+numeroCL(Math.max(0,r.saldo))+'</td>'
           +'<td class="pl-right">'+numeroCL(r.lotes)+'</td>'
           +'</tr>';
      }
      if (body==='<tbody>') body+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body+='</tbody>';
      var foot='<tfoot><tr>'
        +'<td><strong>Totales</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(totC)+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(totA)+'</strong></td>'
        +'<td class="pl-right"><strong>'+(totC>0?Math.round(totA*100/totC)+'%':'—')+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(Math.max(0,totC-totA))+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(totL)+'</strong></td>'
        +'</tr></tfoot>';
      html = '<table class="pl-table">'+thead+body+foot+'</table>';
    } else {
      var gm = groupByMes(rows);
      var thead2='<thead><tr>'
        +'<th>MES</th>'
        +'<th class="pl-right">CONTACTADO '+(year||'')+'</th>'
        +'<th class="pl-right">ASIGNADO</th>'
        +'<th class="pl-right">% ASIG</th>'
        +'<th class="pl-right">SALDO</th>'
        +'<th class="pl-right"># LOTES</th>'
        +'</tr></thead>';
      var body2='<tbody>', tc=0,ta=0,tl=0;
      for (var j=0;j<gm.length;j++){
        var r2=gm[j]; if (r2.contactado<=0 && r2.asignado<=0) continue;
        tc+=r2.contactado; ta+=r2.asignado; tl+=r2.lotes;
        body2+='<tr>'
          +'<td>'+MMESES[r2.mes-1]+'</td>'
          +'<td class="pl-right">'+numeroCL(r2.contactado)+'</td>'
          +'<td class="pl-right">'+numeroCL(r2.asignado)+'</td>'
          +'<td class="pl-right">'+pct(r2.asignado,r2.contactado)+'</td>'
          +'<td class="pl-right">'+numeroCL(Math.max(0,r2.saldo))+'</td>'
          +'<td class="pl-right">'+numeroCL(r2.lotes)+'</td>'
          +'</tr>';
      }
      if (body2==='<tbody>') body2+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body2+='</tbody>';
      var foot2='<tfoot><tr>'
        +'<td><strong>Totales</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(tc)+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(ta)+'</strong></td>'
        +'<td class="pl-right"><strong>'+(tc>0?Math.round(ta*100/tc)+'%':'—')+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(Math.max(0,tc-ta))+'</strong></td>'
        +'<td class="pl-right"><strong>'+numeroCL(tl)+'</strong></td>'
        +'</tr></tfoot>';
      html = '<table class="pl-table">'+thead2+body2+foot2+'</table>';
    }
    document.getElementById('plTableWrap').innerHTML = html;
  }

  /* ---------- Render principal ---------- */
  function filterRowsForRefresh(){ return filterDeriv(STATE.deriv, STATE.filters); }

  function renderAll(){
    var rows = filterRowsForRefresh();
    renderKPIs(rows);
    renderChart(rows, STATE.axisMode);
    renderTable(rows, STATE.axisMode, STATE.filters.year || '');
  }

  /* ---------- Eventos ---------- */
  function attachEvents(){
    function updateFromUI(){
      var y   = document.getElementById('plYear').value;
      var p   = document.getElementById('plProv').value;
      var c   = document.getElementById('plComuna').value;
      var e   = document.getElementById('plEmpresa').value;
      var ms  = getSelectedMonths();
      var hide= document.getElementById('plHideEmptyMonths').checked;

      STATE.filters.year = y;
      STATE.filters.proveedor = p;
      STATE.filters.comuna = c;
      STATE.filters.empresa = e;
      STATE.filters.months = ms;
      STATE.hideEmpty = hide;
      renderAll();
    }

    ['plYear','plProv','plComuna','plEmpresa','plHideEmptyMonths'].forEach(function(id){
      var el=document.getElementById(id); if (el) el.addEventListener('change', updateFromUI);
    });

    var monthsDiv = document.getElementById('plMonths');
    if (monthsDiv){
      monthsDiv.addEventListener('click', function(ev){
        var t = ev.target;
        while (t && t!==monthsDiv && !t.classList.contains('pl-chip')) t = t.parentNode;
        if (t && t.classList.contains('pl-chip')){
          t.classList.toggle('is-on');
          updateFromUI();
        }
      });
    }

    var btnDatos = document.getElementById('plBtnMesesConDatos');
    if (btnDatos){
      btnDatos.addEventListener('click', function(){
        var m = mesesConDatosDispon(STATE.deriv, STATE.filters);
        setSelectedMonths(m); STATE.filters.months = m; renderAll();
      });
    }
    var btnLimpiar = document.getElementById('plBtnLimpiarMeses');
    if (btnLimpiar){
      btnLimpiar.addEventListener('click', function(){
        setSelectedMonths([]); STATE.filters.months=[]; renderAll();
      });
    }
    var btnLimpiarFiltros = document.getElementById('plBtnLimpiarFiltros');
    if (btnLimpiarFiltros){
      btnLimpiarFiltros.addEventListener('click', function(){
        var p=document.getElementById('plProv'), c=document.getElementById('plComuna'), e=document.getElementById('plEmpresa');
        if (p) p.value=''; if (c) c.value=''; if (e) e.value='';
        setSelectedMonths([]); STATE.filters.months=[]; renderAll();
      });
    }

    var axisBtn = document.getElementById('plAxisBtn');
    if (axisBtn){
      axisBtn.addEventListener('click', function(){
        STATE.axisMode = (STATE.axisMode==='empresa' ? 'mes' : 'empresa');
        axisBtn.textContent = 'Eje: ' + (STATE.axisMode==='empresa' ? 'Empresa' : 'Mes');
        renderAll();
      });
    }
  }

  function getSelectedMonths(){
    var monthsDiv = document.getElementById('plMonths');
    var nodes = monthsDiv ? monthsDiv.querySelectorAll('.pl-chip.is-on') : [];
    var out=[]; for (var i=0;i<nodes.length;i++){ out.push(Number(nodes[i].getAttribute('data-m'))||0); }
    return out;
  }
  function setSelectedMonths(arr){
    var monthsDiv = document.getElementById('plMonths');
    var nodes = monthsDiv ? monthsDiv.querySelectorAll('.pl-chip') : [];
    for (var i=0;i<nodes.length;i++){
      var m = Number(nodes[i].getAttribute('data-m'))||0;
      var on = arr && arr.indexOf(m)>=0;
      if (on) nodes[i].classList.add('is-on'); else nodes[i].classList.remove('is-on');
    }
  }

  function optionsFromDeriv(deriv){
    var emp  = uniqSorted((deriv||[]).map(function(r){return r.empresa || 'Sin empresa';}).filter(Boolean));
    // proveedores/contactos y comunas se sacan de detalle
    var detAll = []; (deriv||[]).forEach(function(r){ (r._detalle||[]).forEach(function(d){ detAll.push(d); }); });
    var prov = uniqSorted(detAll.map(function(d){return d.contacto;}).filter(Boolean));
    var com  = uniqSorted(detAll.map(function(d){return d.comuna;}).filter(Boolean));
    var years= uniqSorted((deriv||[]).map(function(r){return r.anio;}).filter(Boolean));
    return {prov:prov, com:com, emp:emp, years:years};
  }

  function fillFilters(deriv){
    var selY = document.getElementById('plYear');
    var selP = document.getElementById('plProv');
    var selC = document.getElementById('plComuna');
    var selE = document.getElementById('plEmpresa');
    var monthsDiv = document.getElementById('plMonths');

    var opts = optionsFromDeriv(deriv);
    var yNow = (new Date()).getFullYear();
    var years = opts.years.length ? opts.years : [yNow];
    var yDefault = years.indexOf(yNow)>=0 ? yNow : years[years.length-1];

    selY.innerHTML = years.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');
    selP.innerHTML = '<option value="">Todos los contactos</option>' + opts.prov.map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('');
    selC.innerHTML = '<option value="">Todas las comunas</option>' + opts.com.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
    selE.innerHTML = '<option value="">Todas las empresas</option>' + opts.emp.map(function(e){return '<option value="'+e+'">'+e+'</option>';}).join('');

    monthsDiv.innerHTML = range12().map(function(m){
      return '<button type="button" class="pl-chip" data-m="'+m+'">'+MMESES_LARGO[m-1]+'</button>';
    }).join('');
  }

  /* ---------- Montaje ---------- */
  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppPipeline');
    if (!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon, asig, contactos, proveedores){
      indexAuxiliares(contactos||[], proveedores||[]);
      STATE.deriv = buildDerivMonthly(dispon, asig);
      fillFilters(STATE.deriv);

      var ySel = document.getElementById('plYear');
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

    // Caso: colecciones pasadas por parámetro
    if (opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig)){
      return go(opts.dispon, opts.asig, opts.contactos||[], opts.proveedores||[]);
    }

    // Carga desde API si existe
    var api = global.MMppApi || {};
    var pDispon = api.getDisponibilidades ? api.getDisponibilidades() : Promise.resolve([]);
    var pAsig   = api.getAsignaciones   ? api.getAsignaciones()   : Promise.resolve([]);
    var pCont   = api.getContactos      ? api.getContactos()      : Promise.resolve([]);
    var pProv   = api.getProveedores    ? api.getProveedores()    : Promise.resolve([]);

    Promise.all([pDispon.catch(()=>[]), pAsig.catch(()=>[]), pCont.catch(()=>[]), pProv.catch(()=>[])])
      .then(function(res){ go(res[0]||[], res[1]||[], res[2]||[], res[3]||[]); })
      .catch(function(){ go([],[],[],[]); });
  }

  /* Exponer */
  global.MMppPipeline = { mount: mount, refresh: renderAll };
})(window);
