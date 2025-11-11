/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Contactado vs Asignado (+ Semi-cerrado)
   Ajustes:
   - Semi-cerrado SIEMPRE como TOTAL (no “restante”) en KPIs, gráfico y tabla.
   - Tooltips incluyen Contactado.
   - Detalle mensual: UNA SOLA FILA por proveedor+comuna (se fusionan Contactado/Semi/Asignado).
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
      + '.acc-btn{display:inline-flex;gap:6px;align-items:center;border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;height:30px;padding:0 10px;cursor:pointer;font-weight:700}'
      + '.acc-body{padding:10px 6px 4px 6px;background:#fbfdff;border-top:1px dashed #e5e7eb}'
      + '.acc-grid{display:grid;grid-template-columns:1.3fr .6fr .6fr .6fr;gap:8px}'
      + '@media (max-width: 1100px){ .pl-kpis{grid-template-columns:repeat(3,minmax(0,1fr))} }'
      + '@media (max-width: 720px){ .pl-filters{grid-template-columns:1fr} }'
      + '.pill{display:inline-block;padding:2px 10px;border-radius:9999px;font-weight:800;font-size:12px;line-height:1;border:1px solid transparent}'
      + '.pill-asign{color:#0EA5E9;background:rgba(14,165,233,.12);border-color:rgba(14,165,233,.35)}'
      + '.pill-semi{color:#22C55E;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35)}'
      + '.pill-contact{color:#475569;background:rgba(203,213,225,.35);border-color:rgba(148,163,184,.45)}'
      + '.pill-neutral{color:#111827;background:rgba(17,24,39,.06);border-color:rgba(17,24,39,.15)}';
    var s = document.createElement('style');
    s.id = 'mmpp-pipeline-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- utils ---------- */
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function range12(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; }
  function uniqSorted(arr){ var set={},out=[];(arr||[]).forEach(function(v){if(v!=null&&v!==""&&!set[v]){set[v]=1;out.push(v)}});out.sort();return out; }
  function pillNum(n, kind){ return '<span class="pill pill-'+kind+'">'+numeroCL(n)+'</span>'; }
  function parsePeriodo(p){ if(!p) return {anio:null,mes:0}; var pr=String(p).trim().split('-'); return {anio:Number(pr[0])||null, mes:Number(pr[1])||0}; }
  function cleanEmpresa(d,a){
    var s=(d&&(d.empresaNombre||''))||(a&&(a.empresaNombre||''))||(d&&(d.proveedorNombre||d.contactoNombre||''))||(a&&(a.proveedorNombre||a.contactoNombre||''))||'—';
    s=String(s||'').trim(); return s||'—';
  }

  /* ---------- derivación mensual ---------- */
  function buildDerivMonthly(dispon, asig, semi){
    var byId={}; (dispon||[]).forEach(function(d){ if(d&&d.id!=null) byId[String(d.id)]=d; });

    var map={};
    function key(emp,anio,mes){ return emp+'|'+(anio||'')+'|'+(mes||0); }
    function ensure(emp,anio,mes){
      var k=key(emp,anio,mes);
      if(!map[k]){
        map[k]={empresa:emp||'—',anio:Number(anio)||null,mes:Number(mes)||0,
                contactado:0,asignado:0,semi:0,semiRestante:0,noSemiRestante:0,
                lotes:0,contactos:new Set(),
                detAsign:new Map(),detSemi:new Map(),detContactado:new Map(),
                search:''};
      }
      return map[k];
    }

    // Contactado
    (dispon||[]).forEach(function(d){
      var emp=cleanEmpresa(d,null), anio=Number(d.anio)||null, mes=Number(d.mes)||0, tons=Number(d.tons||0)||0;
      var row=ensure(emp,anio,mes); row.contactado+=tons; row.lotes+=1;
      var prov=d.proveedorNombre||d.contactoNombre||'—', com=d.comuna||'', k=(prov+'|'+(com||'')).trim();
      row.contactos.add((prov+' – '+com).trim()); row.detContactado.set(k,(row.detContactado.get(k)||0)+tons);
      row.search+=' '+emp+' '+prov+' '+(d.centroCodigo||'')+' '+(d.areaCodigo||'')+' '+(d.comuna||'');
    });

    // Asignado (mes destino)
    (asig||[]).forEach(function(a){
      var y=Number(a.destAnio||a.anio||0)||0, m=Number(a.destMes||a.mes||0)||0; if(!y||!m) return;
      var dpo=byId[String(a.disponibilidadId||'')], emp=cleanEmpresa(dpo,a), tons=Number(a.cantidad||a.tons||0)||0;
      var row=ensure(emp,y,m); row.asignado+=tons;
      var prov=a.proveedorNombre||a.contactoNombre||(dpo&&(dpo.proveedorNombre||dpo.contactoNombre))||'—', com=a.comuna||(dpo&&dpo.comuna)||'', k=(prov+'|'+(com||'')).trim();
      row.contactos.add((prov+' – '+com).trim()); row.detAsign.set(k,(row.detAsign.get(k)||0)+tons);
      row.search+=' '+emp+' '+prov+' '+(a.centroCodigo||'')+' '+(a.areaCodigo||'')+' '+(a.comuna||'');
    });

    // Semi-cerrado
    (semi||[]).forEach(function(s){
      var anio=Number(s.anio)||null, mes=Number(s.mes)||0;
      if((!anio||!mes)&&s.periodo){ var pm=parsePeriodo(s.periodo); if(!anio) anio=pm.anio; if(!mes) mes=pm.mes; }
      if(!anio||!mes) return;
      var emp=cleanEmpresa(s,null), tons=Number(s.tons||0)||0, row=ensure(emp,anio,mes); row.semi+=tons;
      var prov=s.proveedorNombre||s.contactoNombre||'—', com=s.comuna||'', k=(prov+'|'+(com||'')).trim();
      row.detSemi.set(k,(row.detSemi.get(k)||0)+tons); row.contactos.add((prov+' – '+com).trim());
      row.search+=' '+emp+' '+prov+' '+(s.centroCodigo||'')+' '+(s.areaCodigo||'')+' '+(s.comuna||'');
    });

    // Restantes (saldo dividido en semiRestante + noSemiRestante)
    Object.keys(map).forEach(function(k){
      var o=map[k], restante=Math.max(0,o.contactado-o.asignado), semiRest=Math.min(o.semi,restante), noSemi=Math.max(0,restante-semiRest);
      o.semiRestante=semiRest; o.noSemiRestante=noSemi;
    });

    return Object.keys(map).map(function(k){
      var o=map[k];
      return {
        empresa:o.empresa, anio:o.anio, mes:o.mes,
        contactado:o.contactado, asignado:o.asignado,
        semi:o.semi, semiRestante:o.semiRestante, noSemiRestante:o.noSemiRestante,
        saldo:Math.max(0,o.contactado-o.asignado), lotes:o.lotes,
        contactos:Array.from(o.contactos),
        detAsign:o.detAsign, detSemi:o.detSemi, detContactado:o.detContactado,
        search:(o.search||'').toLowerCase()
      };
    });
  }

  function mesesConDatosDispon(deriv, filters){
    var sumByM={}; for(var i=1;i<=12;i++) sumByM[i]=0;
    (deriv||[]).forEach(function(r){
      if(filters.year && String(r.anio)!==String(filters.year)) return;
      if(filters.empresa && r.empresa!==filters.empresa) return;
      if(filters.q && r.search.indexOf(filters.q)<0) return;
      sumByM[r.mes]+= (r.contactado||0) + (r.asignado||0) + (r.semi||0);
    });
    var out=[]; for(var mi=1;mi<=12;mi++) if(sumByM[mi]>0) out.push(mi); return out;
  }

  function filterDeriv(deriv, filters){
    var monthsSel=filters.months||[];
    return (deriv||[]).filter(function(r){
      if(filters.year && String(r.anio)!==String(filters.year)) return false;
      if(filters.empresa && r.empresa!==filters.empresa) return false;
      if(filters.q && r.search.indexOf(filters.q)<0) return false;
      if(monthsSel.length && monthsSel.indexOf(Number(r.mes))<0) return false;
      return true;
    });
  }

  function groupByEmpresa(rows){
    var map={}, detAsign={}, detSemi={}, detContact={};
    rows.forEach(function(r){
      if(!map[r.empresa]){
        map[r.empresa]={empresa:r.empresa,contactado:0,asignado:0,semi:0,semiRestante:0,noSemiRestante:0,lotes:0};
        detAsign[r.empresa]=new Map(); detSemi[r.empresa]=new Map(); detContact[r.empresa]=new Map();
      }
      map[r.empresa].contactado+=r.contactado; map[r.empresa].asignado+=r.asignado;
      map[r.empresa].semi+=r.semi; map[r.empresa].semiRestante+=r.semiRestante;
      map[r.empresa].noSemiRestante+=r.noSemiRestante; map[r.empresa].lotes+=r.lotes;
      r.detAsign.forEach(function(v,k){ detAsign[r.empresa].set(k,(detAsign[r.empresa].get(k)||0)+v); });
      r.detSemi.forEach(function(v,k){ detSemi[r.empresa].set(k,(detSemi[r.empresa].get(k)||0)+v); });
      r.detContactado.forEach(function(v,k){ detContact[r.empresa].set(k,(detContact[r.empresa].get(k)||0)+v); });
    });
    var arr=Object.keys(map).map(function(k){
      var o=map[k];
      return {empresa:o.empresa,contactado:o.contactado,asignado:o.asignado,semi:o.semi,
              semiRestante:o.semiRestante,noSemiRestante:o.noSemiRestante,
              saldo:Math.max(0,o.contactado-o.asignado),lotes:o.lotes,
              detAsign:detAsign[k],detSemi:detSemi[k],detContactado:detContact[k]};
    });
    arr.sort(function(a,b){ return (b.contactado||0)-(a.contactado||0); });
    return arr;
  }

  function groupByMes(rows){
    var map={}; for(var m=1;m<=12;m++) map[m]={mes:m,contactado:0,asignado:0,semi:0,semiRestante:0,noSemiRestante:0,lotes:0,detAsign:new Map(),detSemi:new Map(),detContactado:new Map()};
    rows.forEach(function(r){
      var k=r.mes||0; if(!map[k]) map[k]={mes:k,contactado:0,asignado:0,semi:0,semiRestante:0,noSemiRestante:0,lotes:0,detAsign:new Map(),detSemi:new Map(),detContactado:new Map()};
      map[k].contactado+=r.contactado; map[k].asignado+=r.asignado; map[k].semi+=r.semi;
      map[k].semiRestante+=r.semiRestante; map[k].noSemiRestante+=r.noSemiRestante; map[k].lotes+=r.lotes;
      r.detAsign.forEach(function(v,kk){ map[k].detAsign.set(kk,(map[k].detAsign.get(kk)||0)+v); });
      r.detSemi.forEach(function(v,kk){ map[k].detSemi.set(kk,(map[k].detSemi.get(kk)||0)+v); });
      r.detContactado.forEach(function(v,kk){ map[k].detContactado.set(kk,(map[k].detContactado.get(kk)||0)+v); });
    });
    return range12().map(function(m){
      var o=map[m];
      return {mes:m,contactado:o.contactado,asignado:o.asignado,semi:o.semi,
              semiRestante:o.semiRestante,noSemiRestante:o.noSemiRestante,
              saldo:Math.max(0,o.contactado-o.asignado),lotes:o.lotes,
              detAsign:o.detAsign,detSemi:o.detSemi,detContactado:o.detContactado};
    });
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(rows){
    var c=0,a=0,s=0, empSet=new Set();
    rows.forEach(function(r){ c+=r.contactado; a+=r.asignado; s+=r.semi; empSet.add(r.empresa); });
    var saldo=Math.max(0,c-a);
    function kpi(lab,chip){ return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+chip+'</div></div>'; }
    document.getElementById('plKpis').innerHTML =
      kpi('Contactado',pillNum(c,'contact'))
      +kpi('Semi-cerrado',pillNum(s,'semi'))
      +kpi('Asignado',pillNum(a,'asign'))
      +kpi('% Asignación',(c>0?Math.round(a*100/c)+'%':'—'))
      +kpi('Saldo','<span class="pill pill-neutral">'+numeroCL(saldo)+'</span>')
      +kpi('# Proveedores','<span class="pill pill-neutral">'+numeroCL(empSet.size)+'</span>');
  }

  /* ---------- Chart ---------- */
  var chartRef=null;
  var stackTotalPlugin={id:'stackTotals',afterDatasetsDraw:function(chart){
    var opts=chart.options.plugins.stackTotals||{}; if(opts.enabled===false) return;
    var ctx=chart.ctx, meta0=chart.getDatasetMeta(0), n=(meta0&&meta0.data)?meta0.data.length:0;
    ctx.save(); ctx.font=(opts.fontSize||12)+'px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#111827';
    for(var i=0;i<n;i++){
      var tot=0, ds=chart.data.datasets;
      for(var d=0; d<ds.length; d++){ if(chart.isDatasetVisible(d)) tot += Number(ds[d].data[i]||0); }
      if(tot<=0) continue;
      var x=(meta0.data[i]&&meta0.data[i].x)||0, y=chart.scales.y.getPixelForValue(tot), yC=Math.max(y, chart.chartArea.top+12);
      ctx.fillText(numeroCL(tot), x, yC-6);
    }
    ctx.restore();
  }};
  function mapToSortedPairs(mp){ var arr=[]; mp.forEach(function(v,k){ arr.push({k:k,v:v}); }); arr.sort(function(a,b){return b.v-a.v}); return arr; }

  function renderChart(rows, axisMode){
    var canvas=document.getElementById('plChart'); if(!canvas) return;
    if(!global.Chart){ var ctx0=canvas.getContext('2d'); ctx0.clearRect(0,0,canvas.width||300,canvas.height||150); document.getElementById('plChartNote').textContent='Chart.js no está cargado; se muestra solo la tabla.'; return; }
    document.getElementById('plChartNote').textContent='';

    var labels=[], dataAsign=[], dataSemi=[], dataNoAsig=[], toolDetail={}, accDetail={};

    if(axisMode==='empresa'){
      var g=groupByEmpresa(rows);
      labels=g.map(x=>x.empresa);
      dataAsign=g.map(x=>x.asignado);
      dataSemi=g.map(x=>x.semi);
      dataNoAsig=g.map(x=>Math.max(0,x.saldo));
      g.forEach(function(x){
        toolDetail[x.empresa]={asign:mapToSortedPairs(x.detAsign), semi:mapToSortedPairs(x.detSemi), contact:mapToSortedPairs(x.detContactado)};
      });
    }else{
      var gm=groupByMes(rows);
      labels=gm.map(x=>MMESES[x.mes-1]);
      dataAsign=gm.map(x=>x.asignado);
      dataSemi=gm.map(x=>x.semi);
      dataNoAsig=gm.map(x=>Math.max(0,x.saldo));
      gm.forEach(function(x){
        var lbl=MMESES[x.mes-1];
        toolDetail[lbl]={asign:mapToSortedPairs(x.detAsign), semi:mapToSortedPairs(x.detSemi), contact:mapToSortedPairs(x.detContactado)};
        accDetail[lbl]={asign:x.detAsign, semi:x.detSemi, contact:x.detContactado,
                        contactado:x.contactado, asignado:x.asignado, semiTot:x.semi, saldo:x.saldo, lotes:x.lotes};
      });
    }

    if(chartRef&&chartRef.destroy) chartRef.destroy();

    chartRef=new Chart(canvas.getContext('2d'),{
      type:'bar',
      data:{labels:labels,datasets:[
        {label:'Asignado',data:dataAsign,borderWidth:1,stack:'pipeline',backgroundColor:'#0EA5E9'},
        {label:'Semi-cerrado',data:dataSemi,borderWidth:1,stack:'pipeline',backgroundColor:'#22C55E'},
        {label:'No asignado',data:dataNoAsig,borderWidth:1,stack:'pipeline',backgroundColor:'#CBD5E1'}
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,animation:false,
        interaction:{mode:'nearest',intersect:true},
        layout:{padding:{top:12}},
        plugins:{
          legend:{position:'right'},
          stackTotals:{enabled:true,fontSize:12},
          tooltip:{callbacks:{
            title:function(items){ return (items&&items[0]&&items[0].label)?items[0].label:''; },
            label:function(ctx){
              var lbl=ctx.label, ds=ctx.dataset.label, det=toolDetail[lbl]||{};
              var arr = ds==='Asignado' ? (det.asign||[]) : ds==='Semi-cerrado' ? (det.semi||[]) : (det.contact||[]);
              var lines=arr.slice(0,8).map(function(p){
                var nk=String(p.k||'').split('|'); var prov=nk[0]||'—', comuna=nk[1]||'';
                return '• '+prov+(comuna?(' – '+comuna):'')+': '+numeroCL(p.v)+' t';
              });
              if(arr.length>8) lines.push('• +'+(arr.length-8)+' más…');
              return lines.length?lines:['(sin detalle)'];
            },
            footer:function(ctx){ var v=ctx&&ctx[0]&&ctx[0].parsed&&ctx[0].parsed.y; return 'Subtotal '+ctx[0].dataset.label+': '+numeroCL(v)+' t'; }
          }}
        },
        scales:{ x:{stacked:true,ticks:{autoSkip:false,maxRotation:45,minRotation:45}}, y:{stacked:true,beginAtZero:true,grace:'15%',ticks:{padding:6}} }
      },
      plugins:[stackTotalPlugin]
    });

    renderTable._accDetail=accDetail;
  }

  /* ---------- Tabla con acordeón ---------- */
  function renderTable(rows, axisMode, year){
    var html='';
    if(axisMode==='empresa'){
      var g=groupByEmpresa(rows);
      var thead='<thead><tr>'
        +'<th>EMPRESA</th>'
        +'<th class="pl-right">CONTACTADO '+(year||'')+'</th>'
        +'<th class="pl-right">SEMI-CERRADO</th>'
        +'<th class="pl-right">ASIGNADO</th>'
        +'<th class="pl-right">SALDO</th>'
        +'</tr></thead>';
      var body='<tbody>', tc=0,ta=0,ts=0;
      for(var i=0;i<g.length;i++){
        var r=g[i]; if(r.contactado<=0 && r.asignado<=0 && r.semi<=0) continue;
        tc+=r.contactado; ta+=r.asignado; ts+=r.semi;
        body+='<tr>'
            +'<td><strong>'+r.empresa+'</strong></td>'
            +'<td class="pl-right">'+pillNum(r.contactado,'contact')+'</td>'
            +'<td class="pl-right">'+pillNum(r.semi,'semi')+'</td>'
            +'<td class="pl-right">'+pillNum(r.asignado,'asign')+'</td>'
            +'<td class="pl-right"><span class="pill pill-neutral">'+numeroCL(Math.max(0,r.saldo))+'</span></td>'
          +'</tr>';
      }
      if(body==='<tbody>') body+='<tr><td colspan="5" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body+='</tbody>';
      var foot='<tfoot><tr>'
        +'<td><strong>Totales</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(tc,'contact')+'</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(ts,'semi')+'</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(ta,'asign')+'</strong></td>'
        +'<td class="pl-right"><strong><span class="pill pill-neutral">'+numeroCL(Math.max(0,tc-ta))+'</span></strong></td>'
        +'</tr></tfoot>';
      html='<table class="pl-table">'+thead+body+foot+'</table>';
    } else {
      var gm=groupByMes(rows);
      var thead2='<thead><tr>'
        +'<th>MES</th>'
        +'<th class="pl-right">CONTACTADO '+(year||'')+'</th>'
        +'<th class="pl-right">SEMI-CERRADO</th>'
        +'<th class="pl-right">ASIGNADO</th>'
        +'<th class="pl-right">SALDO</th>'
        +'<th></th>'
        +'</tr></thead>';
      var body2='<tbody>', tc=0,ta=0,ts=0;

      for(var j=0;j<gm.length;j++){
        var r2=gm[j]; if(r2.contactado<=0 && r2.asignado<=0 && r2.semi<=0) continue;
        tc+=r2.contactado; ta+=r2.asignado; ts+=r2.semi;
        var lbl=MMESES[r2.mes-1], accId='acc_'+String(r2.mes);

        body2+='<tr>'
          +'<td>'+lbl+'</td>'
          +'<td class="pl-right">'+pillNum(r2.contactado,'contact')+'</td>'
          +'<td class="pl-right">'+pillNum(r2.semi,'semi')+'</td>'
          +'<td class="pl-right">'+pillNum(r2.asignado,'asign')+'</td>'
          +'<td class="pl-right"><span class="pill pill-neutral">'+numeroCL(Math.max(0,r2.saldo))+'</span></td>'
          +'<td class="pl-right"><button class="acc-btn" data-acc="'+accId+'">Ver detalle</button></td>'
        +'</tr>'
        +'<tr id="'+accId+'" style="display:none"><td colspan="6">'
          +'<div class="acc-body">'
            +'<div style="font-weight:700;margin-bottom:6px">Detalle por proveedor</div>'
            +'<div class="acc-grid">'
              +'<div style="font-size:12px;color:#64748b">Proveedor – Comuna</div>'
              +'<div class="pl-right" style="font-size:12px;color:#64748b">Contactado (t)</div>'
              +'<div class="pl-right" style="font-size:12px;color:#64748b">Semi-cerrado (t)</div>'
              +'<div class="pl-right" style="font-size:12px;color:#64748b">Asignado (t)</div>'
            +'</div>';

        // -------- FUSIÓN: UNA SOLA FILA POR PROVEEDOR+COMUNA --------
        function norm(s){ return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase(); }
        function splitKey(k){ var p=String(k||'').split('|'); return {prov:(p[0]||'').trim(), com:(p[1]||'').trim()}; }
        function keyNorm(k){ var o=splitKey(k); return norm(o.prov)+'|'+norm(o.com); }
        function flatten(mp){
          var out=[]; (mp||new Map()).forEach(function(v,k){
            var sp=splitKey(k); out.push({kn:keyNorm(k), prov:sp.prov, com:sp.com, v:Number(v)||0});
          }); return out;
        }

        var arrC=flatten(r2.detContactado), arrS=flatten(r2.detSemi), arrA=flatten(r2.detAsign);
        var idx=new Map(); // kn -> {prov, com, c,s,a}

        function upsert(arr, fld){
          arr.forEach(function(e){
            var o=idx.get(e.kn)||{prov:e.prov, com:e.com, c:0, s:0, a:0};
            // completar comuna/nombre "bonito" si falta
            if(!o.com && e.com) o.com=e.com;
            if(fld==='c' && e.prov) o.prov=e.prov; // privilegiar el de Contactado
            o[fld]+=e.v; idx.set(e.kn,o);
          });
        }
        upsert(arrC,'c'); upsert(arrS,'s'); upsert(arrA,'a');

        Array.from(idx.values())
          .sort(function(A,B){ return (B.c+B.s+B.a)-(A.c+A.s+A.a); })
          .forEach(function(v){
            var alias=v.prov + (v.com?(' – '+v.com):'');
            body2+='<div class="acc-grid"><div>'+alias+'</div>'
                 +'<div class="pl-right">'+(v.c?pillNum(v.c,'contact'):'—')+'</div>'
                 +'<div class="pl-right">'+(v.s?pillNum(v.s,'semi'):'—')+'</div>'
                 +'<div class="pl-right">'+(v.a?pillNum(v.a,'asign'):'—')+'</div>'
                 +'</div>';
          });

        body2+='</div></td></tr>';
      }

      if(body2==='<tbody>') body2+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
      body2+='</tbody>';

      var foot2='<tfoot><tr>'
        +'<td><strong>Totales</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(tc,'contact')+'</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(ts,'semi')+'</strong></td>'
        +'<td class="pl-right"><strong>'+pillNum(ta,'asign')+'</strong></td>'
        +'<td class="pl-right"><strong><span class="pill pill-neutral">'+numeroCL(Math.max(0,tc-ta))+'</span></strong></td>'
        +'<td></td>'
      +'</tr></tfoot>';

      html='<table class="pl-table">'+thead2+body2+foot2+'</table>';
    }

    var wrap=document.getElementById('plTableWrap'); wrap.innerHTML=html;

    // toggle acordeón
    wrap.querySelectorAll('.acc-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id=btn.getAttribute('data-acc'), row=document.getElementById(id);
        if(!row) return; var open=row.style.display!=='none';
        row.style.display = open ? 'none' : ''; btn.textContent = open ? 'Ver detalle' : 'Ocultar detalle';
        btn.classList.toggle('is-open', !open);
      });
    });
  }

  /* ---------- Estado / montaje ---------- */
  var STATE={ deriv:[], filters:{year:null,empresa:'',months:[],q:''}, hideEmpty:true, axisMode:'mes' };
  function getSelectedMonths(){ var cont=document.getElementById('plMonths'); var nodes=cont?cont.querySelectorAll('.pl-chip.is-on'):[]; var out=[]; for(var i=0;i<nodes.length;i++){ out.push(Number(nodes[i].getAttribute('data-m'))||0); } return out; }
  function setSelectedMonths(arr){ var cont=document.getElementById('plMonths'); var nodes=cont?cont.querySelectorAll('.pl-chip'):[]; for(var i=0;i<nodes.length;i++){ var m=Number(nodes[i].getAttribute('data-m'))||0; var on=arr&&arr.indexOf(m)>=0; nodes[i].classList.toggle('is-on',on);} }
  function filterRowsForRefresh(){ return filterDeriv(STATE.deriv,STATE.filters); }
  function renderAll(){ var rows=filterRowsForRefresh(); renderKPIs(rows); renderChart(rows,STATE.axisMode); renderTable(rows,STATE.axisMode,STATE.filters.year||''); }

  function attachEvents(){
    function update(){ STATE.filters.year=document.getElementById('plYear').value;
      STATE.filters.empresa=document.getElementById('plEmpresa').value;
      STATE.filters.months=getSelectedMonths();
      STATE.hideEmpty=document.getElementById('plHideEmptyMonths').checked;
      STATE.filters.q=(document.getElementById('plSearch').value||'').trim().toLowerCase();
      renderAll();
    }
    ['plYear','plEmpresa','plHideEmptyMonths','plSearch'].forEach(function(id){
      var el=document.getElementById(id); if(el){ el.addEventListener('input',update); el.addEventListener('change',update); }
    });
    var monthsDiv=document.getElementById('plMonths');
    if(monthsDiv){ monthsDiv.addEventListener('click',function(ev){ var t=ev.target; while(t&&t!==monthsDiv&&!t.classList.contains('pl-chip')) t=t.parentNode; if(t&&t.classList.contains('pl-chip')){ t.classList.toggle('is-on'); update(); } }); }
    var btnDatos=document.getElementById('plBtnMesesConDatos'); if(btnDatos){ btnDatos.addEventListener('click',function(){ var m=mesesConDatosDispon(STATE.deriv,STATE.filters); setSelectedMonths(m); STATE.filters.months=m; renderAll(); }); }
    var btnLimpiar=document.getElementById('plBtnLimpiarMeses'); if(btnLimpiar){ btnLimpiar.addEventListener('click',function(){ setSelectedMonths([]); STATE.filters.months=[]; renderAll(); }); }
    var btnLimpiarFiltros=document.getElementById('plBtnLimpiarFiltros'); if(btnLimpiarFiltros){ btnLimpiarFiltros.addEventListener('click',function(){ var e=document.getElementById('plEmpresa'), s=document.getElementById('plSearch'); if(e) e.value=''; if(s) s.value=''; setSelectedMonths([]); STATE.filters.months=[]; renderAll(); }); }
    var axisBtn=document.getElementById('plAxisBtn'); if(axisBtn){ axisBtn.addEventListener('click',function(){ STATE.axisMode=(STATE.axisMode==='empresa'?'mes':'empresa'); axisBtn.textContent='Eje: '+(STATE.axisMode==='empresa'?'Empresa':'Mes'); renderAll(); }); }
  }

  function optionsFromDeriv(deriv){
    var emp=uniqSorted((deriv||[]).map(r=>r.empresa).filter(Boolean));
    var years=uniqSorted((deriv||[]).map(r=>r.anio).filter(Boolean));
    return {emp,years};
  }

  function fillFilters(deriv){
    var selY=document.getElementById('plYear'), selE=document.getElementById('plEmpresa'), monthsDiv=document.getElementById('plMonths');
    var opts=optionsFromDeriv(deriv), yNow=(new Date()).getFullYear(), years=opts.years.length?opts.years:[yNow], yDefault=years.indexOf(yNow)>=0?yNow:years[years.length-1];
    selY.innerHTML=years.map(y=>'<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>').join('');
    selE.innerHTML='<option value="">Todas las empresas</option>'+opts.emp.map(e=>'<option value="'+e+'">'+e+'</option>').join('');
    monthsDiv.innerHTML=range12().map(function(m){ return '<button type="button" class="pl-chip" data-m="'+m+'">'+MMESES_LARGO[m-1]+'</button>'; }).join('');
  }

  function mount(opts){
    injectCSS();
    var root=document.getElementById('mmppPipeline'); if(!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon,asig,semi){
      STATE.deriv=buildDerivMonthly(dispon,asig,semi); fillFilters(STATE.deriv);
      var ySel=document.getElementById('plYear'); STATE.filters.year=ySel?ySel.value:''; STATE.filters.empresa=''; STATE.filters.months=[]; STATE.filters.q=''; STATE.hideEmpty=true; setSelectedMonths([]);
      attachEvents(); renderAll();
    }

    if(opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig) && Array.isArray(opts.semi)) return go(opts.dispon,opts.asig,opts.semi);

    if(global.MMppApi && typeof global.MMppApi.getDisponibilidades==='function'){
      Promise.all([
        global.MMppApi.getDisponibilidades(),
        (global.MMppApi.getAsignaciones?global.MMppApi.getAsignaciones():Promise.resolve([])).catch(function(){return[];}),
        (global.MMppApi.getSemiCerrados?global.MMppApi.getSemiCerrados():Promise.resolve([])).catch(function(){return[];})
      ]).then(function(res){ go(res[0]||[],res[1]||[],res[2]||[]); })
       .catch(function(){ go([],[],[]); });
    }else{
      go([],[],[]);
    }
  }

  global.MMppPipeline={ mount:mount, refresh:renderAll };
})(window);
