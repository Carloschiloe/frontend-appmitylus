/* /spa-mmpp/mmpp-pipeline.js
   Pipeline MMPP — Disponible - Asignado - Semi-cerrado
   - Clave de fusión: SOLO proveedor (normalización fuerte).
   - Semi-cerrado SIEMPRE total en KPI, gráfico y tabla.
   - “Disponible” = max(0, Contactado - Asignado).
   - Eje: Mes / Empresa.
   - Filtro de Semana ISO (opcional según disponibilidad de fechas).
   - Comparativos: Semana/Mes/Año (serie “Anterior”).
   - Exportar CSV (por proveedor y período).
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
      + '.pl-filters{display:grid;grid-template-columns:repeat(4,minmax(200px,1fr));gap:10px;align-items:center;margin-top:8px}'
      + '.pl-select,.pl-input{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
      + '.pl-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
      + '.pl-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
      + '.pl-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:10px}'
      + '.kpi{background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:14px}'
      + '.kpi .lab{font-size:12px;color:#64748b}'
      + '.kpi .val{font-size:22px;font-weight:900;color:#111827}'
      + '.kpi .sub{font-size:11px;color:#6b7280;margin-top:4px}'
      + '.pl-monthsbar{width:100%;margin:10px 0 6px 0;overflow-x:auto}'
      + '.pl-months-line{width:100%;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px}'
      + '.pl-chip{width:100%;height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #c7d2fe;background:#eef2ff;color:#1e40af;border-radius:999px;font-weight:700;cursor:pointer;user-select:none;font-size:13px;white-space:nowrap;padding:0 10px}'
      + '.pl-chip.is-on{background:#1e40af;color:#fff;border-color:#1e40af}'
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
      + '@media (max-width:900px){.pl-filters{grid-template-columns:1fr 1fr}}'
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
  function range12(){ var a=[]; for(var i=1;i<=12;i++) a.push(i); return a; }
  function uniqSorted(arr){ var set={}, out=[]; (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v);} }); out.sort(); return out; }
  function pillNum(n, kind){ return '<span class="pill pill-'+kind+'">'+numeroCL(n)+'</span>'; }
  function clamp0(x){ x=Number(x)||0; return x<0?0:x; }

  function normalizeTxt(s){
    return String(s||'')
      .replace(/[–—]/g,'-')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }
  // Clave SOLO por proveedor
  function makeKey(prov){
    return normalizeTxt(prov);
  }
  // Mostrar SOLO proveedor (sin comuna)
  function displayLabel(prov){ return String(prov||'—').trim(); }

  // Detectar fecha en objeto
  function pickDate(o){
    var f = o && (o.destFecha || o.fecha || o.fechaRegistro || o.createdAt || o.fechaCompromiso || o.fechaAsignacion || o.fechaSemi || o.updatedAt);
    if (!f) return null;
    var d = new Date(f);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  // Si no hay fecha, aproximar con anio/mes → 1er día del mes (para asig p.ej.)
  function approxDateFromYM(y,m){
    if (!y || !m) return null;
    var d = new Date(Number(y), Number(m)-1, 1);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO Week helpers
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
  function currentISOKey(){
    var d = new Date();
    return isoKey(d);
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
          +'<label style="display:flex;gap:8px;align-items:center"><input id="plHideEmptyMonths" type="checkbox" checked /><span>Ocultar meses sin datos</span></label>'
          +'<button id="plBtnMesesConDatos" class="pl-btn">Meses con datos</button>'
          +'<button id="plBtnLimpiarMeses" class="pl-btn">Limpiar meses</button>'
          +'<button id="plBtnLimpiarFiltros" class="pl-btn">Limpiar filtros</button>'
          +'<button id="plAxisBtn" class="pl-btn">Eje: Mes</button>'
          +'<select id="plCompare" class="pl-select" style="height:38px"><option value="none">Comparar: Ninguno</option><option value="semana">Comparar: Semana</option><option value="mes">Comparar: Mes</option><option value="anio">Comparar: Año</option></select>'
          +'<button id="plBtnExport" class="pl-btn">Exportar CSV</button>'
        +'</div>'
      +'</div>'

      +'<div class="pl-filters">'
        +'<select id="plYear" class="pl-select"></select>'
        +'<select id="plEmpresa" class="pl-select"><option value="">Todas las empresas</option></select>'
        +'<input id="plSearch" class="pl-input" placeholder="Buscar proveedor, contacto o código de centro..."/>'
        +'<div class="row-actions" style="align-items:center">'
          +'<select id="plWeek" class="pl-select" title="Semana ISO (YYYY-Www)"></select>'
          +'<button id="plBtnWeekNow" class="pl-btn">Semana actual</button>'
        +'</div>'
      +'</div>'

      +'<div class="pl-monthsbar"><div id="plMonths" class="pl-months-line"></div></div>'
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

  /* ---------- DERIVACIONES ---------- */
  function buildDerivMonthly(dispon, asig, semi){
    var byId = {};
    (dispon||[]).forEach(function(d){ if (d && (d.id!=null)) byId[String(d.id)] = d; });

    var map = {};
    function key(emp, anio, mes){ return emp + '|' + (anio||'') + '|' + (mes||0); }
    function ensure(emp, anio, mes){
      var k = key(emp, anio, mes);
      if (!map[k]){
        map[k] = {
          empresa: emp || '—',
          anio: Number(anio)||null,
          mes: Number(mes)||0,
          contactado: 0,
          asignado: 0,
          semiTotal: 0,
          lotes: 0,
          contactos: new Set(),
          detAsign: new Map(),
          detSemi: new Map(),
          detContactado: new Map(),
          labelByKey: new Map(),
          search: ''
        };
      }
      return map[k];
    }

    // Contactado
    (dispon||[]).forEach(function(d){
      var emp = cleanEmpresa(d, null);
      var anio = Number(d.anio)||null;
      var mes  = Number(d.mes)||0;
      var tons = Number((d.tons ?? d.tonsDisponible ?? d.cantidad) || 0) || 0;
      var row = ensure(emp, anio, mes);
      row.contactado += tons;
      row.lotes += 1;

      var proveedor = d.proveedorNombre || d.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.contactos.add(label);
      row.detContactado.set(kNorm, (row.detContactado.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);

      row.search += ' '+emp+' '+proveedor+' '+(d.centroCodigo||'')+' '+(d.areaCodigo||'')+' '+(d.comuna||'');
    });

    // Asignado (mes destino)
    (asig||[]).forEach(function(a){
      var destY = Number(a.destAnio||a.anio||0)||0;
      var destM = Number(a.destMes ||a.mes ||0)||0;
      if (!destY || !destM) return;
      var dpo = byId[String(a.disponibilidadId||'')];
      var emp = cleanEmpresa(dpo, a);
      var tons = Number(a.cantidad||a.tons||0)||0;
      var row = ensure(emp, destY, destM);
      row.asignado += tons;

      var proveedor = (a.proveedorNombre || a.contactoNombre || (dpo && (dpo.proveedorNombre||dpo.contactoNombre)) || '—');
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.contactos.add(label);
      row.detAsign.set(kNorm, (row.detAsign.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);

      row.search += ' '+emp+' '+proveedor+' '+(a.centroCodigo||'')+' '+(a.areaCodigo||'')+' '+(a.comuna||'');
    });

    // Semi-cerrado (TOTAL por periodo)
    (semi||[]).forEach(function(s){
      var anio = Number(s.anio)||null;
      var mes  = Number(s.mes)||0;
      if ((!anio || !mes) && s.periodo){
        var parts=String(s.periodo||'').split('-');
        anio = anio || (Number(parts[0])||null);
        mes  = mes  || (Number(parts[1])||0);
      }
      if (!anio || !mes) return;

      var emp = cleanEmpresa(s, null);
      var tons = Number(s.tons||0)||0;
      var row = ensure(emp, anio, mes);
      row.semiTotal += tons;

      var proveedor = s.proveedorNombre || s.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.contactos.add(label);
      row.detSemi.set(kNorm, (row.detSemi.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);

      row.search += ' '+emp+' '+proveedor+' '+(s.centroCodigo||'')+' '+(s.areaCodigo||'')+' '+(s.comuna||'');
    });

    return Object.keys(map).map(function(k){
      var o = map[k];
      return {
        empresa: o.empresa,
        anio: o.anio,
        mes: o.mes,
        contactado: o.contactado,
        asignado: o.asignado,
        semiTotal: o.semiTotal,
        saldo: clamp0(o.contactado - o.asignado),
        lotes: o.lotes,
        contactos: Array.from(o.contactos),
        detAsign: o.detAsign,
        detSemi: o.detSemi,
        detContactado: o.detContactado,
        labelByKey: o.labelByKey,
        search: (o.search||'').toLowerCase()
      };
    });
  }

  // Derivación semanal (opcional)
  function buildDerivWeekly(dispon, asig, semi){
    var byId = {};
    (dispon||[]).forEach(function(d){ if (d && (d.id!=null)) byId[String(d.id)] = d; });

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
          lotes: 0,
          detAsign: new Map(),
          detSemi: new Map(),
          detContactado: new Map(),
          labelByKey: new Map(),
          search: ''
        };
      }
      return map[k];
    }

    // Contactado
    (dispon||[]).forEach(function(d){
      var emp = cleanEmpresa(d, null);
      var dt  = pickDate(d);
      if (!dt) return; // sin fecha, no entra a semanal
      var iso = isoKey(dt);
      var tons = Number((d.tons ?? d.tonsDisponible ?? d.cantidad) || 0) || 0;
      var row = ensure(emp, iso);
      row.contactado += tons; row.lotes += 1;

      var proveedor = d.proveedorNombre || d.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.detContactado.set(kNorm, (row.detContactado.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Asignado
    (asig||[]).forEach(function(a){
      var dpo = byId[String(a.disponibilidadId||'')];
      var emp = cleanEmpresa(dpo, a);
      var dt  = pickDate(a) || approxDateFromYM(a.destAnio||a.anio, a.destMes||a.mes);
      if (!dt) return;
      var iso = isoKey(dt);
      var tons= Number(a.cantidad||a.tons||0)||0;
      var row = ensure(emp, iso);
      row.asignado += tons;

      var proveedor = (a.proveedorNombre || a.contactoNombre || (dpo && (dpo.proveedorNombre||dpo.contactoNombre)) || '—');
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.detAsign.set(kNorm, (row.detAsign.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    // Semi-cerrado
    (semi||[]).forEach(function(s){
      var emp = cleanEmpresa(s, null);
      var dt  = pickDate(s) || approxDateFromYM(s.anio, s.mes);
      if (!dt) return;
      var iso = isoKey(dt);
      var tons= Number(s.tons||0)||0;
      var row = ensure(emp, iso);
      row.semiTotal += tons;

      var proveedor = s.proveedorNombre || s.contactoNombre || '—';
      var kNorm     = makeKey(proveedor);
      var label     = displayLabel(proveedor);

      row.detSemi.set(kNorm, (row.detSemi.get(kNorm)||0)+tons);
      if (!row.labelByKey.has(kNorm)) row.labelByKey.set(kNorm, label);
      row.search += ' '+emp+' '+proveedor;
    });

    return Object.keys(map).map(function(k){
      var o = map[k];
      return {
        empresa: o.empresa,
        iso: o.iso,
        contactado: o.contactado,
        asignado: o.asignado,
        semiTotal: o.semiTotal,
        saldo: clamp0(o.contactado - o.asignado),
        lotes: o.lotes,
        detAsign: o.detAsign,
        detSemi: o.detSemi,
        detContactado: o.detContactado,
        labelByKey: o.labelByKey,
        search: (o.search||'').toLowerCase()
      };
    }).sort(function(a,b){ return a.iso.localeCompare(b.iso); });
  }

  /* ---------- filtros/agrupadores ---------- */
  function mesesConDatosDispon(deriv, filters){
    var sumByM = {}; for (var i=1;i<=12;i++) sumByM[i]=0;
    (deriv||[]).forEach(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return;
      if (filters.empresa && r.empresa!==filters.empresa) return;
      if (filters.q && r.search.indexOf(filters.q)<0) return;
      sumByM[r.mes] += (Number(r.contactado)||0) + (Number(r.asignado)||0) + (Number(r.semiTotal)||0);
    });
    var out=[]; for (var mi=1; mi<=12; mi++) if (sumByM[mi]>0) out.push(mi);
    return out;
  }

  function filterDeriv(deriv, filters){
    var monthsSel = filters.months || [];
    return (deriv||[]).filter(function(r){
      if (filters.year && String(r.anio)!==String(filters.year)) return false;
      if (filters.empresa && r.empresa!==filters.empresa) return false;
      if (filters.q && r.search.indexOf(filters.q)<0) return false;
      if (monthsSel.length && monthsSel.indexOf(Number(r.mes))<0) return false;
      return true;
    });
  }

  function groupByMes(rows){
    var map={};
    for (var m=1;m<=12;m++) map[m]={mes:m,contactado:0,asignado:0,semiTotal:0,lotes:0, detAsign:new Map(), detSemi:new Map(), detContactado:new Map(), labelByKey:new Map()};
    rows.forEach(function(r){
      var k=r.mes||0; if(!map[k]) map[k]={mes:k,contactado:0,asignado:0,semiTotal:0,lotes:0,detAsign:new Map(),detSemi:new Map(),detContactado:new Map(),labelByKey:new Map()};
      map[k].contactado += r.contactado;
      map[k].asignado   += r.asignado;
      map[k].semiTotal  += r.semiTotal;
      map[k].lotes      += r.lotes;
      r.detAsign.forEach(function(v,kk){ map[k].detAsign.set(kk,(map[k].detAsign.get(kk)||0)+v); });
      r.detSemi.forEach(function(v,kk){ map[k].detSemi.set(kk,(map[k].detSemi.get(kk)||0)+v); });
      r.detContactado.forEach(function(v,kk){ map[k].detContactado.set(kk,(map[k].detContactado.get(kk)||0)+v); });
      r.labelByKey.forEach(function(label, kk){
        if (!map[k].labelByKey.has(kk)) map[k].labelByKey.set(kk, label);
      });
    });
    return range12().map(function(m){
      var o = map[m];
      return {
        mes: m,
        contactado: o.contactado,
        asignado: o.asignado,
        semiTotal: o.semiTotal,
        saldo: clamp0(o.contactado - o.asignado),
        lotes: o.lotes,
        detAsign: o.detAsign,
        detSemi: o.detSemi,
        detContactado: o.detContactado,
        labelByKey: o.labelByKey
      };
    });
  }

  function groupByEmpresa(rows){
    var map = new Map(); // empresa -> agregado
    rows.forEach(function(r){
      var k = r.empresa || '—';
      if (!map.has(k)){
        map.set(k, {empresa:k, contactado:0, asignado:0, semiTotal:0, detAsign:new Map(), detSemi:new Map(), detContactado:new Map(), labelByKey:new Map()});
      }
      var o = map.get(k);
      o.contactado += r.contactado; o.asignado += r.asignado; o.semiTotal += r.semiTotal;
      r.detAsign.forEach((v,kk)=>o.detAsign.set(kk,(o.detAsign.get(kk)||0)+v));
      r.detSemi.forEach((v,kk)=>o.detSemi.set(kk,(o.detSemi.get(kk)||0)+v));
      r.detContactado.forEach((v,kk)=>o.detContactado.set(kk,(o.detContactado.get(kk)||0)+v));
      r.labelByKey.forEach((lbl,kk)=>{ if (!o.labelByKey.has(kk)) o.labelByKey.set(kk,lbl); });
    });
    return Array.from(map.values()).sort((a,b)=> (b.contactado+b.asignado+b.semiTotal)-(a.contactado+a.asignado+a.semiTotal));
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(rows, weeklyRows, filters){
    var contact=0, asign=0, semi=0, empSet=new Set(), provSet=new Set();
    rows.forEach(function(r){
      contact+=r.contactado; asign+=r.asignado; semi+=r.semiTotal; empSet.add(r.empresa);
      r.labelByKey && r.labelByKey.forEach(function(lbl){ provSet.add(lbl); });
    });
    var saldo = clamp0(contact - asign);

    // Semana actual (ISO)
    var weekNow = currentISOKey();

    // Comparativos (simple: totales filtrados vs “anterior”)
    var cmp = calcComparativos(rows, weeklyRows, filters);

    function subDelta(title, d, pct){
      if (d==null) return '';
      var sign = d>0?'+':''; var txt = sign+numeroCL(d)+' ('+pct+')';
      return '<div class="sub">'+title+': '+txt+'</div>';
      }

    function kpi(lab, chip, deltaTitle, dVal, dPct){
      var extra = (dVal!=null ? subDelta(deltaTitle, dVal, dPct) : '');
      return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+chip+'</div>'+extra+'</div>';
    }

    var html = ''
      + kpi('Disponible',   pillNum(saldo,'neutral'),
            cmp.label, cmp.dispDelta, cmp.dispPct)
      + kpi('Semi-cerrado', pillNum(semi,'semi'),
            cmp.label, cmp.semiDelta, cmp.semiPct)
      + kpi('Asignado',     pillNum(asign,'asign'),
            cmp.label, cmp.asigDelta, cmp.asigPct)
      + kpi('Contactado',   pillNum(contact,'contact'),
            cmp.label, cmp.contDelta, cmp.contPct)
      + kpi('# Empresas','<span class="pill pill-neutral">'+numeroCL(empSet.size)+'</span>', '', null, '')
      + kpi('Semana actual','<span class="pill pill-neutral">'+weekNow+'</span>', '', null, '');

    document.getElementById('plKpis').innerHTML = html;
  }

  // Comparativos: calcula Δ y % según modo seleccionado
  function calcComparativos(monthRows, weekRows, filters){
    var mode = STATE.compare || 'none';
    if (mode==='none') return {label:'', dispDelta:null, dispPct:'', semiDelta:null, semiPct:'', asigDelta:null, asigPct:'', contDelta:null, contPct:''};

    // Acumulados actuales en filtros vigentes (mes)
    function acc(rows){
      var c=0,a=0,s=0,ct=0;
      rows.forEach(function(r){ ct+=r.contactado; a+=r.asignado; s+=r.semiTotal; c+=clamp0(r.contactado-r.asignado); });
      return {disp:c, asig:a, semi:s, cont:ct};
    }

    var now, prev, label = '';
    if (mode==='mes'){
      // Mes actual = meses seleccionados (o todos del año si no hay selección)
      var rowsNow = filterDeriv(STATE.deriv, STATE.filters);
      if (STATE.hideEmpty){
        rowsNow = rowsNow.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
      }
      // Mes anterior: clonar filtros y retroceder meses seleccionados -1
      var prevFilters = JSON.parse(JSON.stringify(STATE.filters));
      if (prevFilters.months && prevFilters.months.length){
        prevFilters.months = prevFilters.months.map(m => (m-1<1?12:m-1));
        // si pasamos a diciembre, también retrocedemos año
        var crosses = STATE.filters.months.some(m => m===1);
        if (crosses) prevFilters.year = String(Number(STATE.filters.year||new Date().getFullYear())-1);
      } else {
        // sin selección: usar (mes actual -1)
        var y = Number(STATE.filters.year || (new Date()).getFullYear());
        var m = (new Date()).getMonth()+1;
        prevFilters.year = (m===1? String(y-1) : String(y));
        prevFilters.months = [m===1?12:m-1];
      }
      var rowsPrev = filterDeriv(STATE.deriv, prevFilters);
      now = acc(rowsNow); prev = acc(rowsPrev); label = 'vs mes anterior';
    } else if (mode==='anio'){
      var yNow = String(STATE.filters.year || (new Date()).getFullYear());
      var yPrev= String(Number(yNow)-1);
      var fNow = Object.assign({}, STATE.filters, {year:yNow, months:[]});
      var fPre = Object.assign({}, STATE.filters, {year:yPrev, months:[]});
      var rowsNow = filterDeriv(STATE.deriv, fNow);
      var rowsPrev= filterDeriv(STATE.deriv, fPre);
      if (STATE.hideEmpty){
        rowsNow = rowsNow.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
        rowsPrev= rowsPrev.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
      }
      now = acc(rowsNow); prev = acc(rowsPrev); label = 'vs año anterior';
    } else if (mode==='semana'){
      // Semana actual del filtro (o la actual si no se seleccionó)
      if (!STATE.weeksAvailable.length) return {label:'', dispDelta:null, dispPct:'', semiDelta:null, semiPct:'', asigDelta:null, asigPct:'', contDelta:null, contPct:''};
      var isoNow = STATE.filters.weekIso || currentISOKey();
      var isoPrev = prevISO(isoNow);
      var rowsNow = filterDerivWeekly(STATE.derivW, STATE.filters, isoNow);
      var rowsPrev= filterDerivWeekly(STATE.derivW, STATE.filters, isoPrev);
      now = acc(rowsNow); prev = acc(rowsPrev); label = 'vs semana anterior';
    }

    function deltaPct(nowVal, prevVal){
      var d = (Number(nowVal)||0) - (Number(prevVal)||0);
      return {d:d, p:numeroPct(d, prevVal)};
    }
    var dd = deltaPct(now.disp, prev.disp);
    var aa = deltaPct(now.asig, prev.asig);
    var ss = deltaPct(now.semi, prev.semi);
    var cc = deltaPct(now.cont, prev.cont);

    return {
      label: label,
      dispDelta: dd.d, dispPct: dd.p,
      asigDelta: aa.d, asigPct: aa.p,
      semiDelta: ss.d, semiPct: ss.p,
      contDelta: cc.d, contPct: cc.p
    };
  }

  function prevISO(iso){ // "YYYY-Www" → semana anterior
    var m = /^(\d{4})-W(\d{2})$/.exec(String(iso||''));
    if (!m) return '';
    var y = Number(m[1]), w = Number(m[2]);
    // calcular lunes de esa ISO week
    function isoToDate(iy, iw){
      var simple = new Date(Date.UTC(iy,0,1 + (iw-1)*7));
      var dow = simple.getUTCDay();
      var ISOweekStart = simple;
      if (dow<=4 && dow>0) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
      else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
      return ISOweekStart;
    }
    var d = isoToDate(y, w);
    d.setUTCDate(d.getUTCDate()-7);
    return isoKey(new Date(d));
  }

  /* ---------- Chart ---------- */
  var chartRef = null;
  var stackTotalPlugin = {
    id: 'stackTotals',
    afterDatasetsDraw: function(chart){
      var opts = chart.options.plugins.stackTotals || {};
      if (opts.enabled===false) return;
      var ctx = chart.ctx, meta0 = chart.getDatasetMeta(0), n = (meta0 && meta0.data)?meta0.data.length:0;
      ctx.save(); ctx.font=(opts.fontSize||12)+'px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#111827';
      for (var i=0;i<n;i++){
        var tot=0, ds=chart.data.datasets;
        for (var d=0; d<ds.length; d++){
          if (chart.isDatasetVisible(d) && (ds[d]._role!=='prev')) tot += Number(ds[d].data[i]||0);
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

    var labels=[], dataAsign=[], dataSemi=[], dataDisp=[], toolDetail={}, accDetail={};

    var base = (axisMode==='empresa') ? groupByEmpresa(rows) : groupByMes(rows);
    if (STATE.hideEmpty && axisMode!=='empresa'){
      base = base.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
    }

    var keyFor = (axisMode==='empresa') ? (x)=>x.empresa : (x)=>MMESES[x.mes-1];

    labels   = base.map(x => keyFor(x));
    dataAsign= base.map(x => x.asignado);
    dataSemi = base.map(x => x.semiTotal);
    dataDisp = base.map(x => clamp0(x.contactado - x.asignado));

    base.forEach(function(x){
      var lbl = keyFor(x);
      toolDetail[lbl] = {
        asign : mapToSortedPairs(x.detAsign),
        semi  : mapToSortedPairs(x.detSemi),
        contact: mapToSortedPairs(x.detContactado)
      };
      accDetail[lbl] = {
        detAsign: x.detAsign, detSemi: x.detSemi, detContactado: x.detContactado,
        labelByKey: x.labelByKey,
        contactado: x.contactado, asignado: x.asignado, semiTotal: x.semiTotal,
        saldo: clamp0(x.contactado - x.asignado), lotes: x.lotes
      };
    });

    // Serie “Anterior” si hay comparativo
    var dsPrev = [];
    if (STATE.compare && STATE.compare!=='none'){
      var prevBase = getPreviousSeries(axisMode);
      var prevMap = {}; prevBase.forEach(function(x){ prevMap[keyFor(x)] = x; });
      var pAsign = labels.map(lbl => (prevMap[lbl]?.asignado)||0);
      var pSemi  = labels.map(lbl => (prevMap[lbl]?.semiTotal)||0);
      var pDisp  = labels.map(lbl => clamp0((prevMap[lbl]?.contactado||0) - (prevMap[lbl]?.asignado||0)));

      dsPrev = [
        { label: 'Asignado (ant.)',     data: pAsign,  borderWidth: 1, stack: 'pipeline_prev', backgroundColor: 'rgba(14,165,233,.35)', _role:'prev' },
        { label: 'Semi-cerrado (ant.)', data: pSemi,   borderWidth: 1, stack: 'pipeline_prev', backgroundColor: 'rgba(34,197,94,.35)', _role:'prev' },
        { label: 'Disponible (ant.)',   data: pDisp,   borderWidth: 1, stack: 'pipeline_prev', backgroundColor: 'rgba(203,213,225,.6)', _role:'prev' }
      ];
    }

    if (chartRef && chartRef.destroy) chartRef.destroy();

    chartRef = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Asignado',     data: dataAsign, borderWidth: 1, stack: 'pipeline', backgroundColor: '#0EA5E9' },
          { label: 'Semi-cerrado', data: dataSemi,  borderWidth: 1, stack: 'pipeline', backgroundColor: '#22C55E' },
          { label: 'Disponible',   data: dataDisp,  borderWidth: 1, stack: 'pipeline', backgroundColor: '#CBD5E1' }
        ].concat(dsPrev)
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
                var base = (ds.indexOf('Asignado')===0 ? det.asign
                         : ds.indexOf('Semi-cerrado')===0 ? det.semi
                         : ds.indexOf('Disponible')===0 ? det.contact
                         : null) || [];
                var lines = base.slice(0,8).map(function(p){
                  var prov = (renderTable._accDetail && renderTable._accDetail[lbl] && renderTable._accDetail[lbl].labelByKey && renderTable._accDetail[lbl].labelByKey.get(p.k)) || String(p.k||'—');
                  return '• '+prov+': '+numeroCL(p.v)+' t';
                });
                if (base.length>8) lines.push('• +'+(base.length-8)+' más…');
                return lines.length?lines:['(sin detalle)'];
              },
              footer: function(ctx){
                var v = ctx && ctx[0] && ctx[0].parsed && ctx[0].parsed.y;
                return 'Subtotal '+ctx[0].dataset.label.replace(' (ant.)','')+': '+numeroCL(v)+' t';
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { autoSkip:false, maxRotation:45, minRotation:45 } },
          y: { stacked: true, beginAtZero: true, grace: '15%', ticks: { padding: 6 } }
        }
      },
      plugins: [stackTotalPlugin]
    });

    renderTable._accDetail = accDetail;
  }

  function getPreviousSeries(axisMode){
    // Devuelve serie agregada equivalente “anterior” según STATE.compare
    var cmp = STATE.compare;
    if (cmp==='mes'){
      var prevFilters = JSON.parse(JSON.stringify(STATE.filters));
      if (prevFilters.months && prevFilters.months.length){
        prevFilters.months = prevFilters.months.map(m => (m-1<1?12:m-1));
        var crosses = STATE.filters.months.some(m => m===1);
        if (crosses) prevFilters.year = String(Number(STATE.filters.year||new Date().getFullYear())-1);
      } else {
        var y = Number(STATE.filters.year || (new Date()).getFullYear());
        var m = (new Date()).getMonth()+1;
        prevFilters.year = (m===1? String(y-1) : String(y));
        prevFilters.months = [m===1?12:m-1];
      }
      var rowsPrev = filterDeriv(STATE.deriv, prevFilters);
      return (axisMode==='empresa') ? groupByEmpresa(rowsPrev) : groupByMes(rowsPrev);
    } else if (cmp==='anio'){
      var yNow = String(STATE.filters.year || (new Date()).getFullYear());
      var yPrev= String(Number(yNow)-1);
      var fPre = Object.assign({}, STATE.filters, {year:yPrev, months:[]});
      var rowsPrev= filterDeriv(STATE.deriv, fPre);
      return (axisMode==='empresa') ? groupByEmpresa(rowsPrev) : groupByMes(rowsPrev);
    } else if (cmp==='semana'){
      var isoPrev = prevISO(STATE.filters.weekIso || currentISOKey());
      var rowsPrev = filterDerivWeekly(STATE.derivW, STATE.filters, isoPrev);
      // Para “empresa”, agregamos por empresa; para “mes” mostramos por semana, así que usamos un pseudo-agrupador por semana
      if (axisMode==='empresa'){
        // agrupar por empresa
        var m = new Map();
        rowsPrev.forEach(function(r){
          var k=r.empresa||'—';
          if (!m.has(k)) m.set(k,{empresa:k,contactado:0,asignado:0,semiTotal:0,detAsign:new Map(),detSemi:new Map(),detContactado:new Map(),labelByKey:new Map()});
          var o=m.get(k);
          o.contactado+=r.contactado; o.asignado+=r.asignado; o.semiTotal+=r.semiTotal;
          r.detAsign.forEach((v,kk)=>o.detAsign.set(kk,(o.detAsign.get(kk)||0)+v));
          r.detSemi.forEach((v,kk)=>o.detSemi.set(kk,(o.detSemi.get(kk)||0)+v));
          r.detContactado.forEach((v,kk)=>o.detContactado.set(kk,(o.detContactado.get(kk)||0)+v));
          r.labelByKey.forEach((lbl,kk)=>{ if (!o.labelByKey.has(kk)) o.labelByKey.set(kk,lbl); });
        });
        return Array.from(m.values());
      } else {
        // eje mes → usamos una lista con un único “bucket” etiquetado con la semana, pero mapearemos por labels del eje actual
        // para que cuadre con labels actuales devolvemos estructura similar a groupByMes (mes de la semana actual-1)
        // como solo usamos para mapear por label, devolveremos vacío: el comparativo semanal se dibuja por “prevMap[lbl]” que aquí no existirá.
        // No hace falta devolver algo consistente en eje Mes; igual mostramos la serie actual y la previa solo suma si el label coincide.
        return [];
      }
    }
    return [];
  }

  function filterDerivWeekly(derivW, filters, iso){
    return (derivW||[]).filter(function(r){
      if (iso && r.iso!==iso) return false;
      if (filters.empresa && r.empresa!==filters.empresa) return false;
      if (filters.q && r.search.indexOf(filters.q)<0) return false;
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return false;
      return true;
    });
  }

  /* ---------- Tabla con acordeón (mensual) ---------- */
  function renderTable(rows, axisMode, year){
    var html='';
    var gm = groupByMes(rows);
    if (STATE.hideEmpty){
      gm = gm.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
    }

    var thead='<thead><tr>'
      +'<th>MES</th>'
      +'<th class="pl-right">CONTACTADO '+(year||'')+'</th>'
      +'<th class="pl-right">SEMI-CERRADO</th>'
      +'<th class="pl-right">ASIGNADO</th>'
      +'<th class="pl-right">DISPONIBLE</th>'
      +'<th></th>'
      +'</tr></thead>';

    var body='<tbody>', tc=0,ta=0,ts=0,td=0;

    for (var j=0;j<gm.length;j++){
      var r=gm[j]; if (r.contactado<=0 && r.asignado<=0 && r.semiTotal<=0) continue;
      tc+=r.contactado; ta+=r.asignado; ts+=r.semiTotal; td+=r.saldo;
      var lbl = MMESES[r.mes-1];
      var accId = 'acc_'+String(r.mes);

      body+='<tr>'
        +'<td>'+lbl+'</td>'
        +'<td class="pl-right">'+pillNum(r.contactado,'contact')+'</td>'
        +'<td class="pl-right">'+pillNum(r.semiTotal,'semi')+'</td>'
        +'<td class="pl-right">'+pillNum(r.asignado,'asign')+'</td>'
        +'<td class="pl-right"><span class="pill pill-neutral">'+numeroCL(clamp0(r.saldo))+'</span></td>'
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
    }

    if (body==='<tbody>') body+='<tr><td colspan="6" style="color:#6b7280">Sin datos para los filtros seleccionados.</td></tr>';
    body+='</tbody>';

    var foot='<tfoot><tr>'
      +'<td><strong>Totales</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(tc,'contact')+'</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(ts,'semi')+'</strong></td>'
      +'<td class="pl-right"><strong>'+pillNum(ta,'asign')+'</strong></td>'
      +'<td class="pl-right"><strong><span class="pill pill-neutral">'+numeroCL(clamp0(td))+'</span></strong></td>'
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

  /* ---------- estado / montaje ---------- */
  var STATE = {
    deriv: [],       // mensual base
    derivW: [],      // semanal
    filters: { year:null, empresa:'', months:[], q:'', weekIso:'' },
    hideEmpty: true,
    axisMode: 'mes',
    compare: 'none',
    weeksAvailable: []
  };

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

  function filterRowsForRefresh(){ return filterDeriv(STATE.deriv, STATE.filters); }

  function renderAll(){
    var rows = filterRowsForRefresh();

    // KPIs (pasan ambas vistas para comparativos)
    renderKPIs(rows, STATE.derivW, STATE.filters);

    // Chart según eje
    renderChart(rows, STATE.axisMode);

    // Tabla mensual
    renderTable(rows, STATE.axisMode, STATE.filters.year || '');
  }

  function optionsFromDeriv(deriv){
    var emp  = uniqSorted((deriv||[]).map(function(r){return r.empresa;}).filter(Boolean));
    var years= uniqSorted((deriv||[]).map(function(r){return r.anio;}).filter(Boolean));
    return {emp:emp, years:years};
  }

  function computeWeeksOptions(derivW, filters){
    // Filtra por empresa/año/búsqueda para poblar weeks
    var set = new Set();
    (derivW||[]).forEach(function(r){
      if (filters.year && r.iso.slice(0,4)!==String(filters.year)) return;
      if (filters.empresa && r.empresa!==filters.empresa) return;
      if (filters.q && r.search.indexOf(filters.q)<0) return;
      set.add(r.iso);
    });
    return Array.from(set).sort();
  }

  function fillFilters(deriv){
    var selY = document.getElementById('plYear');
    var selE = document.getElementById('plEmpresa');
    var monthsDiv = document.getElementById('plMonths');
    var selW = document.getElementById('plWeek');

    var opts = optionsFromDeriv(deriv);
    var yNow = (new Date()).getFullYear();
    var years = opts.years.length ? opts.years : [yNow];
    var yDefault = years.indexOf(yNow)>=0 ? yNow : years[years.length-1];

    selY.innerHTML = years.map(function(y){return '<option value="'+y+'" '+(String(y)===String(yDefault)?'selected':'')+'>'+y+'</option>';}).join('');
    selE.innerHTML = '<option value="">Todas las empresas</option>' + opts.emp.map(function(e){return '<option value="'+e+'">'+e+'</option>'}).join('');

    monthsDiv.innerHTML = range12().map(function(m){
      return '<button type="button" class="pl-chip" data-m="'+m+'">'+MMESES_LARGO[m-1]+'</button>';
    }).join('');

    // Semanas (se rellena luego con derivW real)
    selW.innerHTML = '<option value="">Semana (opcional)</option>';
  }

  function refreshWeeksSelect(){
    var selW = document.getElementById('plWeek');
    var weeks = computeWeeksOptions(STATE.derivW, STATE.filters);
    STATE.weeksAvailable = weeks;
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
      var ms  = getSelectedMonths();
      var hide= document.getElementById('plHideEmptyMonths').checked;
      var q   = (document.getElementById('plSearch').value||'').trim().toLowerCase();
      var wIso= (document.getElementById('plWeek').value||'').trim();

      STATE.filters.year = y;
      STATE.filters.empresa = e;
      STATE.filters.months = ms;
      STATE.filters.q = q;
      STATE.filters.weekIso = wIso;
      STATE.hideEmpty = hide;

      // Al cambiar filtros base, refrescamos semanas disponibles
      refreshWeeksSelect();

      renderAll();
    }

    ['plYear','plEmpresa','plHideEmptyMonths','plSearch','plWeek'].forEach(function(id){
      var el=document.getElementById(id); if (el) el.addEventListener('input', updateFromUI);
      var elc=document.getElementById(id); if (elc) elc.addEventListener('change', updateFromUI);
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
        var e=document.getElementById('plEmpresa'); var s=document.getElementById('plSearch'); var w=document.getElementById('plWeek');
        if (e) e.value=''; if (s) s.value=''; if (w) w.value='';
        STATE.filters.empresa=''; STATE.filters.q=''; STATE.filters.weekIso='';
        setSelectedMonths([]); STATE.filters.months=[];
        renderAll();
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

    var weekNowBtn = document.getElementById('plBtnWeekNow');
    if (weekNowBtn){
      weekNowBtn.addEventListener('click', function(){
        if (!STATE.weeksAvailable.length) return;
        var now = currentISOKey();
        // si no existe, toma la última
        var target = STATE.weeksAvailable.includes(now) ? now : STATE.weeksAvailable[STATE.weeksAvailable.length-1];
        STATE.filters.weekIso = target;
        var selW = document.getElementById('plWeek');
        if (selW) selW.value = target;
        renderAll();
      });
    }

    var cmpSel = document.getElementById('plCompare');
    if (cmpSel){
      cmpSel.addEventListener('change', function(){
        STATE.compare = cmpSel.value || 'none';
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

  function optionsFromWeeks(derivW, filters){
    return computeWeeksOptions(derivW, filters);
  }

  function fillWeeksAfterBuild(){
    // Llenar select de semanas según derivW
    refreshWeeksSelect();
  }

  /* ---------- Export CSV ---------- */
  function exportCSV(){
    // Exporta por proveedor y período (mes y/o semana si está en filtros)
    var rows = filterRowsForRefresh();
    if (STATE.hideEmpty){
      rows = rows.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
    }
    var useWeek = !!STATE.filters.weekIso && STATE.weeksAvailable.length>0;
    var weekly = useWeek ? filterDerivWeekly(STATE.derivW, STATE.filters, STATE.filters.weekIso) : [];

    var lines = [];
    lines.push(['Año','Mes','SemanaISO','Empresa','Proveedor','Contactado_t','SemiCerrado_t','Asignado_t','Disponible_t','Saldo_t'].join(','));

    function pushFromAgg(empresa, periodo, detCont, detSemi, detAsig, labelByKey, anio, mes, weekIso){
      // Fusiona por proveedor (clave)
      var idx = new Map();
      detCont.forEach(function(v,k){ idx.set(k, {c:v,s:0,a:0}); });
      detSemi.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.s+=v; idx.set(k,o); });
      detAsig.forEach(function(v,k){ var o=idx.get(k)||{c:0,s:0,a:0}; o.a+=v; idx.set(k,o); });

      Array.from(idx.entries()).forEach(function(pair){
        var k = pair[0], vals = pair[1];
        var prov = labelByKey.get(k) || k || '—';
        var contact=Number(vals.c)||0, semi=Number(vals.s)||0, asig=Number(vals.a)||0, disp=clamp0(contact - asig);
        var saldo = disp; // mismo concepto
        lines.push([
          (anio||''), (mes||''), (weekIso||''),
          csvEscape(empresa), csvEscape(prov),
          contact, semi, asig, disp, saldo
        ].join(','));
      });
    }

    function csvEscape(s){
      s = String(s==null?'':s);
      if (s.indexOf(',')>=0 || s.indexOf('"')>=0 || s.indexOf('\n')>=0){
        return '"'+s.replace(/"/g,'""')+'"';
      }
      return s;
    }

    // Mensual
    var gm = groupByMes(rows);
    if (STATE.hideEmpty){
      gm = gm.filter(x => (x.contactado+x.asignado+x.semiTotal)>0);
    }
    gm.forEach(function(r){
      if ((Number(r.contactado)||0)+(Number(r.asignado)||0)+(Number(r.semiTotal)||0)<=0) return;
      // anio desde filtros (export por periodo visible)
      var anio = STATE.filters.year || '';
      pushFromAgg(STATE.filters.empresa||'—', 'mes', r.detContactado, r.detSemi, r.detAsign, r.labelByKey, anio, r.mes, '');
    });

    // Semanal (si aplica)
    if (useWeek){
      weekly.forEach(function(wr){
        pushFromAgg(wr.empresa, 'semana', wr.detContactado, wr.detSemi, wr.detAsign, wr.labelByKey, wr.iso.slice(0,4), '', wr.iso);
      });
    }

    var blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pipeline-mmpp.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- montaje ---------- */
  function mount(opts){
    injectCSS();
    var root = document.getElementById('mmppPipeline');
    if (!root){ console.warn('[mmpp-pipeline] No existe #mmppPipeline'); return; }
    buildUI(root);

    function go(dispon, asig, semi){
      STATE.deriv  = buildDerivMonthly(dispon, asig, semi);
      STATE.derivW = buildDerivWeekly(dispon, asig, semi);

      fillFilters(STATE.deriv);

      var ySel = document.getElementById('plYear');
      STATE.filters.year = ySel ? ySel.value : '';
      STATE.filters.empresa = '';
      STATE.filters.months = [];
      STATE.filters.q = '';
      STATE.filters.weekIso = '';
      STATE.hideEmpty = true;
      STATE.axisMode = 'mes';
      STATE.compare = 'none';
      setSelectedMonths([]);

      attachEvents();
      fillWeeksAfterBuild();
      renderAll();
    }

    if (opts && Array.isArray(opts.dispon) && Array.isArray(opts.asig) && Array.isArray(opts.semi)){
      return go(opts.dispon, opts.asig, opts.semi);
    }

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

  global.MMppPipeline = { mount: mount, refresh: renderAll };
})(window);
