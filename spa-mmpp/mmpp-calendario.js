/* /spa-mmpp/mmpp-calendario.js
   Calendario de Cosechas y Entregas (asignaciones) para MMPP
   - 10 t = 1 camión (configurable en mount)
   - Navegación por mes
   - KPI: Requerido (Mes) editable + Asignado + Brecha (persiste por mes en localStorage)
   - Vista Toneladas/Camiones
   - Agrupar por: Proveedor / Comuna / Transportista
   - Filtros: Comuna / Transportista / Proveedor + Limpiar
   - Totales por día + chips por grupo + resumen semanal en domingos
   - Domingos y feriados (CL) en rojo
   - Doble-click en un día abre modal para asignar (usa MMppApi)
*/

(function (global) {
  // ===== Config =====
  var CAPACIDAD_CAMION_DEF = 10; // t por camión
  var CL_HOLIDAYS_2025 = { "2025-09-18":1, "2025-09-19":1 }; // ejemplo mínimo

  // ===== Utiles =====
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n = Number(n)||0; return (n<10?"0":"")+n; }
  function monthKeyFromDate(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1); }
  function mondayIndex(jsWeekday){ return (jsWeekday+6)%7; } // 0..6 (0 = Lunes)
  function colorFromString(str){
    if(!str) return "#9ca3af";
    var h=0; for(var i=0;i<str.length;i++){ h=(h*31 + str.charCodeAt(i))>>>0; }
    return "hsl("+(h%360)+",70%,45%)";
  }

  // --- Compactadores/abreviadores para las chips ---
  function cleanName(s){
    return String(s||'')
      .replace(/\b(Soc(?:iedad)?\.?|Comercial(?:izacion|ización)?|Transporte|Importaciones?|Exportaciones?|y|de|del|la|los)\b/gi,'')
      .replace(/\b(Ltda\.?|S\.A\.?|SpA|EIRL)\b/gi,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function initials2(s){
    s = cleanName(s);
    var p = s.split(/\s+/).filter(Boolean);
    var a = (p[0]||'').charAt(0);
    var b = (p[p.length-1]||'').charAt(0);
    return (a+b).toUpperCase();
  }
  function shortLabel(name){
    var s = cleanName(name);
    if (!s) return '—';
    var parts = s.split(/\s+/);
    var last = parts[parts.length-1] || s;
    if (last.length >= 5) return last; // “marca” legible
    var ac = parts.slice(0,3).map(function(w){return w[0]||'';}).join('').toUpperCase();
    return (ac.length>=2 ? ac : last.toUpperCase());
  }

  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var DIAS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  // ===== CSS =====
  function injectCSS(){
    if (document.getElementById('mmpp-cal-css')) return;
    var css = ''
    +'.cal-wrap{max-width:1200px;margin:0 auto;padding:18px}'
    +'.cal-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
    +'.cal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}'
    +'.cal-title{margin:0;font-weight:800;color:#2b3440;font-size:26px;display:flex;gap:10px;align-items:center}'
    +'.cal-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    +'.cal-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
    +'.seg{display:inline-flex;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}'
    +'.seg button{height:34px;padding:0 12px;background:#f3f4f6;border:0;cursor:pointer;font-weight:700}'
    +'.seg button.on{background:#2155ff;color:#fff}'
    +'.cal-kpis{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px}'
    +'.kpi{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font-weight:700}'
    +'.kpi .lbl{font-size:12px;color:#6b7280;font-weight:600}'
    +'.kpi input{height:32px;border:1px solid #e5e7eb;border-radius:10px;padding:0 10px;background:#fff;width:110px;margin-left:6px}'
    +'.cal-filterrow{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;margin-bottom:6px}'
    +'.cal-input{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
    +'.cal-fltstats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}'
    +'.fltstat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;font-weight:800;color:#374151}'
    +'.cal-small{font-size:12px;color:#6b7280}'
    +'.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}'
    +'.cal-dayname{font-weight:800;color:#64748b;text-align:center;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background:#f3f4f6}'
    +'.cal-cell{background:#fcfdff;border:1px solid #e5e7eb;border-radius:14px;min-height:120px;padding:8px;display:flex;flex-direction:column;gap:6px;position:relative}'
    +'.cal-cell.off{background:#f9fafb;color:#9ca3af}'
    +'.cal-cell.hol{background:#fff1f2;border-color:#fecaca}'
    +'.cal-date{display:flex;align-items:center;justify-content:space-between;font-weight:800;color:#374151}'
    +'.badge{margin-left:6px;font-size:11px;padding:2px 6px;border:1px solid #e5e7eb;border-radius:999px;background:#fff}'
    +'.badge.red{background:#fee2e2;border-color:#fecaca;color:#991b1b}'
    +'.pill{display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border-radius:8px;background:#eef2ff;color:#1e40af;border:1px solid #c7d2fe;font-size:11px}'
    +'.total{position:absolute;top:6px;right:6px}'
    +'.chip{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 6px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb}'
    +'.chip .left{display:flex;align-items:center;gap:6px;min-width:0;flex:1}'
    +'.chip .prov{font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;max-width:160px}'
    +'.chip .qty{font-weight:700;white-space:nowrap;font-size:11px}'
    +'.dot{width:8px;height:8px;border-radius:999px}'
    +'.tag{font-size:10px;font-weight:800;padding:1px 5px;border:1px solid #e5e7eb;background:#fff;border-radius:6px;color:#374151}'
    +'.weeksum{font-size:12px;font-weight:700;margin-top:auto}'
    +'.cal-tabs{display:flex;gap:6px}'
    +'.cal-tab{background:#f8fafc;border:1px solid #e5e7eb;border-radius:999px;padding:8px 12px;cursor:pointer;font-weight:800;color:#374151}'
    +'.cal-tab.on{background:#2155ff;color:#fff;border-color:#2155ff}'
    +'.modalBG{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:999}'
    +'.modal{width:min(900px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.2);padding:18px}'
    +'.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    +'.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}'
    +'.cal-list{display:flex;flex-direction:column;gap:10px;max-height:360px;overflow:auto;padding-right:4px}'
    +'.lot{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#f9fafb;cursor:pointer}'
    +'.lot.sel{background:#e0e7ff;border-color:#c7d2fe}';
    var s = document.createElement('style');
    s.id = 'mmpp-cal-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ===== Estado =====
  var STATE = {
    capacidadCamion: CAPACIDAD_CAMION_DEF,
    current: new Date(),
    view: 't',                 // 't' toneladas | 'c' camiones
    group: 'prov',             // 'prov' | 'com' | 'trans'
    filters: { comuna:'', transportista:'', proveedor:'' },
    reqByMonth: {},            // { 'YYYY-MM': número en toneladas }
    dispon: [],
    asig: []
  };

  // ===== Helpers de datos =====
  function asigKeyMonth(a){
    var y = Number(a.destAnio||a.anio||0), m = Number(a.destMes||a.mes||0);
    if(!y || !m) return null;
    return y+'-'+pad2(m);
  }
  function asigDay(a){
    var d = Number(a.destDia||0);
    if (!d) d = 1;
    return d;
  }

  function buildIndexes(){
    // Map de disponibilidad por id para "enriquecer" asignaciones
    var m = {};
    for (var i=0;i<STATE.dispon.length;i++){
      var d = STATE.dispon[i];
      if (d && d.id!=null) m[String(d.id)] = d;
    }
    return m;
  }

  function enrichAssignmentsForMonth(monthDate){
    var mk = monthKeyFromDate(monthDate);
    var all = STATE.asig.filter(function(a){ return asigKeyMonth(a)===mk; });
    var byId = buildIndexes();

    // Enriquecer preferentemente con campos de la asignación; fallback a la disponibilidad
    return all.map(function(a){
      var d = byId[String(a.disponibilidadId)] || {};
      var prov   = a.proveedorNombre || d.proveedorNombre || d.contactoNombre || '—';
      var trans  = a.transportistaNombre || d.contactoNombre || d.empresaNombre || '—';
      var comuna = a.comuna || d.comuna || '—';
      var tons   = Number(a.tons != null ? a.tons : a.cantidad || 0);
      return {
        id: a.id || null,
        day: asigDay(a),
        tons: tons,
        prov: prov,
        trans: trans,
        comuna: comuna
      };
    });
  }

  function applyFilters(rows){
    var f = STATE.filters;
    return rows.filter(function(r){
      if (f.comuna && r.comuna!==f.comuna) return false;
      if (f.transportista && r.trans!==f.transportista) return false;
      if (f.proveedor && r.prov!==f.proveedor) return false;
      return true;
    });
  }

  // Devuelve grupos con etiquetas compactas + micro-tag y data para tooltip
  function groupForDay(rows, groupKey){
    var map = {}; // key -> {label, labelShort, tag, tons, trucks, provFull, transFull, comuna}
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var baseKey = (groupKey==='prov'? r.prov : (groupKey==='com'? r.comuna : r.trans)) || '—';
      if (!map[baseKey]) {
        map[baseKey] = {
          label: baseKey,
          labelShort: shortLabel(baseKey),
          tag: initials2(r.prov || baseKey),   // micro-tag del proveedor
          tons: 0, trucks: 0,
          provFull: r.prov || '—',
          transFull: r.trans || '—',
          comuna: r.comuna || '—'
        };
      }
      map[baseKey].tons += r.tons||0;
    }
    // camiones por grupo
    var arr = Object.keys(map).map(function(k){ return map[k]; });
    for (var j=0;j<arr.length;j++){
      arr[j].trucks = Math.ceil(arr[j].tons / STATE.capacidadCamion);
    }
    // ordenar por toneladas desc
    arr.sort(function(a,b){ return (b.tons||0)-(a.tons||0); });
    return arr;
  }

  function totalsByDayEnriched(monthDate, rowsFiltered){
    var dim = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
    var byDay = {};
    for (var d=1; d<=dim; d++) byDay[d] = { tons:0, trucks:0, groups:[] };

    for (var i=0;i<rowsFiltered.length;i++){
      var r = rowsFiltered[i];
      var bucket = byDay[r.day] || (byDay[r.day]={tons:0,trucks:0,groups:[]});
      bucket.tons += r.tons||0;
    }
    // trucks por día = ceil(tons día / cap)
    var monthTons=0, monthTrucks=0;
    for (var dd=1; dd<=dim; dd++){
      var b = byDay[dd];
      monthTons += b.tons;
      b.trucks = Math.ceil(b.tons / STATE.capacidadCamion);
      monthTrucks += b.trucks;
    }
    return { byDay: byDay, monthTotals:{ tons: monthTons, trucks: monthTrucks } };
  }

  // ===== UI =====
  function buildUI(root){
    root.innerHTML = ''
    +'<div class="cal-wrap">'
      +'<div class="cal-card">'
        +'<div class="cal-head">'
          +'<h2 class="cal-title">📅 Calendario de Cosechas y Entregas</h2>'
          +'<div class="cal-actions">'
            +'<div class="seg" id="segView">'
              +'<button data-v="t" class="on">Ver en Toneladas</button>'
              +'<button data-v="c">Ver en Camiones</button>'
            +'</div>'
            +'<div class="cal-tabs" id="calGroup">'
              +'<button class="cal-tab on" data-g="prov">Proveedor</button>'
              +'<button class="cal-tab" data-g="com">Comuna</button>'
              +'<button class="cal-tab" data-g="trans">Transportista</button>'
            +'</div>'
            +'<button id="calPrev" class="cal-btn">←</button>'
            +'<div id="calMonth" class="cal-btn" style="pointer-events:none;opacity:.9"></div>'
            +'<button id="calNext" class="cal-btn">→</button>'
          +'</div>'
        +'</div>'

        +'<div class="cal-kpis">'
          +'<div class="kpi"><div class="lbl">Requerido (Mes)</div>'
            +'<div style="display:flex;align-items:center;gap:6px">'
              +'<input id="kpiReq" type="number" value="0"/>'
              +'<span id="kpiReqUnit" class="cal-small">t</span>'
            +'</div>'
          +'</div>'
          +'<div class="kpi"><div class="lbl">Asignado (Mes)</div><div id="kpiAsign">0 t</div></div>'
          +'<div class="kpi"><div class="lbl">Brecha</div><div id="kpiGap">0 t</div></div>'
        +'</div>'

        +'<div class="cal-filterrow">'
          +'<select id="calComuna" class="cal-input"></select>'
          +'<select id="calTrans" class="cal-input"></select>'
          +'<select id="calProv" class="cal-input"></select>'
          +'<div style="text-align:right"><button id="calClear" class="cal-btn">Limpiar filtros</button></div>'
        +'</div>'

        +'<div class="cal-fltstats" id="calFilterStats"></div>'

        +'<div class="cal-grid" id="calDaysHead"></div>'
        +'<div class="cal-grid" id="calDays"></div>'
        +'<div class="cal-small" id="calFootNote" style="margin-top:8px">'
          +'Doble-click en un día para asignar. 1 camión = '+STATE.capacidadCamion+' t.'
        +'</div>'
      +'</div>'
    +'</div>';
  }

  function renderMonthLabel(){
    var m = STATE.current.getMonth(), y = STATE.current.getFullYear();
    document.getElementById('calMonth').textContent = MESES[m]+' de '+y;
  }

  // FILTROS: ahora SOLO desde asignaciones del MES visible
  function fillFilterSelects(){
    var enrichedMonth = enrichAssignmentsForMonth(STATE.current);
    var provSet = {}, comSet = {}, transSet = {};

    for (var i=0;i<enrichedMonth.length;i++){
      var r = enrichedMonth[i];
      if (r.prov) provSet[r.prov]=1;
      if (r.comuna) comSet[r.comuna]=1;
      if (r.trans) transSet[r.trans]=1;
    }

    function toSortedKeys(set){ return Object.keys(set).sort(); }

    var cSel = document.getElementById('calComuna');
    var tSel = document.getElementById('calTrans');
    var pSel = document.getElementById('calProv');

    cSel.innerHTML = '<option value="">Todas las comunas</option>' + toSortedKeys(comSet).map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
    tSel.innerHTML = '<option value="">Todos los transportistas</option>' + toSortedKeys(transSet).map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('');
    pSel.innerHTML = '<option value="">Todos los proveedores</option>' + toSortedKeys(provSet).map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    if (STATE.filters.comuna && comSet[STATE.filters.comuna]) cSel.value = STATE.filters.comuna; else cSel.value='';
    if (STATE.filters.transportista && transSet[STATE.filters.transportista]) tSel.value = STATE.filters.transportista; else tSel.value='';
    if (STATE.filters.proveedor && provSet[STATE.filters.proveedor]) pSel.value = STATE.filters.proveedor; else pSel.value='';
  }

  // Muestra tarjetitas con total del mes para cada filtro activo (en la unidad actual)
  function renderFilterStats(){
    var host = document.getElementById('calFilterStats');
    if (!host) return;

    var monthRows = enrichAssignmentsForMonth(STATE.current);
    if (!monthRows.length){
      host.innerHTML = '';
      return;
    }

    function totalFor(predicate){
      var t = 0;
      for (var i=0;i<monthRows.length;i++){
        if (predicate(monthRows[i])) t += Number(monthRows[i].tons||0);
      }
      return (STATE.view==='t')
        ? t
        : Math.ceil(t / STATE.capacidadCamion);
    }

    var boxes = [];

    if (STATE.filters.comuna){
      var val = STATE.filters.comuna;
      var tot = totalFor(function(r){ return r.comuna===val; });
      boxes.push('<div class="fltstat" title="'+val+'">Comuna '+numeroCL(tot)+' '+(STATE.view==='t'?'t':'c')+'</div>');
    }
    if (STATE.filters.transportista){
      var v2 = STATE.filters.transportista;
      var tot2 = totalFor(function(r){ return r.trans===v2; });
      boxes.push('<div class="fltstat" title="'+v2+'">Transportista '+numeroCL(tot2)+' '+(STATE.view==='t'?'t':'c')+'</div>');
    }
    if (STATE.filters.proveedor){
      var v3 = STATE.filters.proveedor;
      var tot3 = totalFor(function(r){ return r.prov===v3; });
      boxes.push('<div class="fltstat" title="'+v3+'">Proveedor '+numeroCL(tot3)+' '+(STATE.view==='t'?'t':'c')+'</div>');
    }

    host.innerHTML = boxes.join('');
  }

  function renderHead(){
    var h = document.getElementById('calDaysHead');
    h.innerHTML = DIAS.map(function(n){ return '<div class="cal-dayname">'+n+'</div>'; }).join('');
  }

  function renderGrid(){
    var cont = document.getElementById('calDays');
    var y = STATE.current.getFullYear(), mIdx = STATE.current.getMonth();
    var first = new Date(y, mIdx, 1);
    var startOffset = mondayIndex(first.getDay());
    var dim = new Date(y, mIdx+1, 0).getDate();

    // datos
    var enrichedAll = enrichAssignmentsForMonth(STATE.current);
    var filtered = applyFilters(enrichedAll);
    var calc = totalsByDayEnriched(STATE.current, filtered);
    var byDay = calc.byDay;

    // KPI mes (con filtros)
    var kpiAsign = (STATE.view==='t' ? calc.monthTotals.tons : calc.monthTotals.trucks);
    var reqMap = STATE.reqByMonth || {};
    var mk = monthKeyFromDate(STATE.current);
    var reqTons = Number(reqMap[mk]||0);
    var reqDisplay = (STATE.view==='t' ? reqTons : Math.round(reqTons/STATE.capacidadCamion));
    var gap = Math.max(0, (reqDisplay||0) - (kpiAsign||0));

    // pinta KPI
    var inp = document.getElementById('kpiReq');
    var unit = document.getElementById('kpiReqUnit');
    var asignEl = document.getElementById('kpiAsign');
    var gapEl = document.getElementById('kpiGap');
    if (inp){
      inp.value = reqDisplay||0;
      inp.oninput = function(){
        var v = Math.max(0, Number(inp.value||0));
        // siempre almacenamos en toneladas
        var toStore = (STATE.view==='t' ? v : v*STATE.capacidadCamion);
        STATE.reqByMonth[mk] = toStore;
        try{ localStorage.setItem('mmpp-cal-req', JSON.stringify(STATE.reqByMonth)); }catch(e){}
        // re-calcular gap en vivo
        var gd = Math.max(0, (STATE.view==='t'?toStore:Math.round(toStore/STATE.capacidadCamion)) - kpiAsign);
        gapEl.textContent = numeroCL(gd)+' '+(STATE.view==='t'?'t':'c');
      };
    }
    if (unit) unit.textContent = (STATE.view==='t'?'t':'c');
    if (asignEl) asignEl.textContent = numeroCL(kpiAsign)+' '+(STATE.view==='t'?'t':'c');
    if (gapEl) gapEl.textContent = numeroCL(gap)+' '+(STATE.view==='t'?'t':'c');

    // celdas
    var boxes = [];
    for (var i=0; i<startOffset; i++) boxes.push('<div class="cal-cell off"></div>');

    for (var d=1; d<=dim; d++){
      var idx = startOffset + (d-1);
      var isSunday = (idx % 7)===6;
      var keyDate = y+'-'+pad2(mIdx+1)+'-'+pad2(d);
      var isHoliday = isSunday || !!CL_HOLIDAYS_2025[keyDate];

      // grupos del día
      var itemsToday = filtered.filter(function(r){ return r.day===d; });
      var groups = groupForDay(itemsToday, STATE.group);
      var totalT = byDay[d].tons;
      var totalC = byDay[d].trucks;
      var label = (STATE.view==='t' ? (numeroCL(totalT)+' t') : (numeroCL(totalC)+' c'));

      // week sum (solo en domingo)
      var weekSumHtml = '';
      if (isSunday){
        var weekT=0, weekC=0;
        for (var dd=d-6; dd<=d; dd++){
          if (dd>=1 && dd<=dim){
            weekT += byDay[dd].tons;
            weekC += byDay[dd].trucks;
          }
        }
        weekSumHtml = '<div class="weeksum">Σ Sem: '+(STATE.view==='t'
          ? (numeroCL(weekT)+' t · '+numeroCL(weekC)+' c')
          : (numeroCL(weekC)+' c · '+numeroCL(weekT)+' t'))+'</div>';
      }

      // badges
      var badge = '';
      if (isHoliday){
        var tag = isSunday && !CL_HOLIDAYS_2025[keyDate] ? 'domingo' : 'feriado';
        badge = '<span class="badge red">'+tag+'</span>';
      } else {
        var today = new Date();
        if (today.getFullYear()===y && today.getMonth()===mIdx && today.getDate()===d){
          badge = '<span class="badge">hoy</span>';
        }
      }

      // chips (máx 4)
      var chips = '';
      var maxChips = 4;
      for (var g=0; g<groups.length && g<maxChips; g++){
        var gg = groups[g];
        var qty = (STATE.view==='t' ? (numeroCL(gg.tons)+' t') : (numeroCL(gg.trucks)+' c'));
        // Texto principal compacto: si agrupas por proveedor, mostrar contacto; si no, el label reducido
        var display = (STATE.group==='prov' ? shortLabel(gg.transFull) : gg.labelShort) || gg.labelShort;
        var titleFull = (
          'Proveedor: ' + gg.provFull + ' · ' +
          'Contacto: '  + gg.transFull + ' · ' +
          'Comuna: '    + gg.comuna    + ' · ' + qty
        );

        chips += '<div class="chip" title="'+titleFull+'">'
               +   '<div class="left">'
               +     '<span class="dot" style="background:'+colorFromString(gg.provFull||gg.label)+'"></span>'
               +     '<span class="tag">'+gg.tag+'</span>'
               +     '<span class="prov">'+display+'</span>'
               +   '</div>'
               +   '<span class="qty">'+qty+'</span>'
               + '</div>';
      }
      if (groups.length>maxChips) chips += '<span class="cal-small">+'+(groups.length-maxChips)+' más…</span>';

      boxes.push(
        '<div class="cal-cell'+(isHoliday?' hol':'')+'" data-day="'+d+'">'
          +'<div class="cal-date"><span>'+d+badge+'</span></div>'
          +(totalT>0?('<span class="pill total">Total '+label+'</span>'):'')
          +'<div style="display:grid;gap:6px">'+chips+'</div>'
          +weekSumHtml
        +'</div>'
      );
    }
    cont.innerHTML = boxes.join('');

    // Delegado: doble-click para abrir modal
    cont.addEventListener('dblclick', function(ev){
      var t = ev.target;
      while (t && t!==cont && !t.getAttribute('data-day')) t = t.parentNode;
      if (!t) return;
      var day = Number(t.getAttribute('data-day'))||0;
      if (day>0) abrirModalAsignar(day);
    }, { once:true });
  }

  // ===== Modal Asignar =====
  function recMonthKey(rec){
    var y = Number(rec.anio || 0), m = Number(rec.mes || 0);
    if (y && m) return y * 100 + m;
    if (rec.mesKey && rec.mesKey.indexOf('-') > 0) {
      var p = rec.mesKey.split('-');
      return (Number(p[0])||0) * 100 + (Number(p[1])||0);
    }
    if (rec.fecha) {
      var dt = new Date(rec.fecha);
      return dt.getFullYear() * 100 + (dt.getMonth()+1);
    }
    return 0;
  }
  function groupBy(arr, keyFn){
    var m={}; (arr||[]).forEach(function(r){ var k=keyFn(r); m[k]=(m[k]||[]).concat([r]); }); return m;
  }
  function asigByDispo(){ return groupBy(STATE.asig, function(a){ return a.disponibilidadId||'__none__'; }); }
  function saldoDe(dispo){
    var g = asigByDispo();
    var usadas = (g[dispo.id]||[]).reduce(function(acc,a){ return acc + (Number(a.cantidad||a.tons||0)||0); },0);
    return Math.max(0, (Number(dispo.tons)||0) - usadas);
  }

  function abrirModalAsignar(day){
    var base = STATE.dispon.slice();
    if (STATE.filters.proveedor) base = base.filter(function(d){ return (d.proveedorNombre||d.contactoNombre)===STATE.filters.proveedor; });
    if (STATE.filters.comuna) base = base.filter(function(d){ return (d.comuna||'')===STATE.filters.comuna; });
    if (STATE.filters.transportista) base = base.filter(function(d){ return (d.contactoNombre||d.empresaNombre||'')===STATE.filters.transportista; });

    var y = STATE.current.getFullYear(), m = STATE.current.getMonth()+1;
    var cutoff = y * 100 + m;

    var lots = base
      .filter(function(d){
        var saldo = saldoDe(d);
        if (saldo <= 0) return false;
        var key = recMonthKey(d);
        return key <= cutoff; // no mostrar futuros
      })
      .map(function(d){
        return {
          id: d.id,
          prov: (d.proveedorNombre||d.contactoNombre||'—'),
          trans: (d.contactoNombre||d.empresaNombre||'—'),
          comuna: (d.comuna||'—'),
          mesKey: (d.mesKey||''),
          fecha: d.fecha||'',
          saldo: saldoDe(d),
          original: Number(d.tons||0)
        };
      });

    var host = document.createElement('div');
    host.className = 'modalBG';
    host.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">'
        +'<div style="display:flex;justify-content:space-between;align-items:center">'
          +'<h3 style="margin:0;font-weight:800">Asignar para el '+day+' de '+MESES[m-1]+' de '+y+'</h3>'
          +'<button class="cal-btn" id="calClose">✕</button>'
        +'</div>'
        +'<div class="cal-small" style="margin-top:4px">Se muestran solo disponibilidades con <strong>saldo &gt; 0</strong> hasta <strong>'+MESES[m-1]+' '+y+'</strong>. 1 camión = '+STATE.capacidadCamion+' t.</div>'
        +'<div class="row" style="margin-top:10px">'
          +'<div style="min-height:320px"><div class="cal-list" id="calLots"></div></div>'
          +'<div>'
            +'<div class="row3">'
              +'<div><label class="cal-small">Cantidad (t)</label><input id="calQty" class="cal-input" type="number" min="0" step="1" placeholder="Ej: 30" /></div>'
              +'<div><label class="cal-small">Mes destino</label><input class="cal-input" value="'+pad2(m)+'" disabled/></div>'
              +'<div><label class="cal-small">Año destino</label><input class="cal-input" value="'+y+'" disabled/></div>'
            +'</div>'
            +'<div class="cal-small" id="calLotTip" style="margin-top:8px">Selecciona un lote a la izquierda.</div>'
            +'<div style="margin-top:12px"><button id="calDoAssign" class="cal-btn" disabled>✔ Confirmar Asignación</button></div>'
          +'</div>'
        +'</div>'
      +'</div>';
    document.body.appendChild(host);

    var lotsWrap = host.querySelector('#calLots');
    var closeBtn = host.querySelector('#calClose');
    var doBtn    = host.querySelector('#calDoAssign');
    var qtyInp   = host.querySelector('#calQty');
    var tip      = host.querySelector('#calLotTip');

    var selectedLot = null, selectedSaldo = 0;

    function renderLots(){
      if (!lots.length){
        lotsWrap.innerHTML = '<div class="cal-small">No hay disponibilidades con saldo para los filtros actuales.</div>';
        return;
      }
      lotsWrap.innerHTML = lots.map(function(L){
        return '<div class="lot" data-id="'+L.id+'">'
          +'<div style="display:flex;justify-content:space-between;gap:8px">'
            +'<div><strong>'+L.prov+'</strong><div class="cal-small">'+(L.comuna||"—")+'</div></div>'
            +'<div style="text-align:right"><div>Saldo: <strong>'+numeroCL(L.saldo)+'</strong> t</div><div class="cal-small">Original: '+numeroCL(L.original)+' t</div></div>'
          +'</div>'
          +'<div class="cal-small">'+(L.mesKey?('mes '+L.mesKey):'')+(L.fecha?(' · desde '+new Date(L.fecha).toLocaleDateString('es-CL')):'')+'</div>'
        +'</div>';
      }).join('');
    }
    renderLots();

    lotsWrap.addEventListener('click', function(ev){
      var t = ev.target;
      while (t && t!==lotsWrap && !t.classList.contains('lot')) t = t.parentNode;
      if (!t || !t.classList.contains('lot')) return;
      var id = t.getAttribute('data-id');
      var L = lots.find(function(x){return String(x.id)===String(id);});
      if (!L) return;
      selectedLot = L;
      selectedSaldo = Number(L.saldo||0);
      [].slice.call(lotsWrap.querySelectorAll('.lot')).forEach(function(n){n.classList.remove('sel');});
      t.classList.add('sel');
      var cam = Math.ceil(selectedSaldo / STATE.capacidadCamion);
      tip.textContent = 'Saldo disponible: '+numeroCL(selectedSaldo)+' t  ·  ~'+numeroCL(cam)+' camiones (a '+STATE.capacidadCamion+' t/camión)';
      doBtn.disabled = !(selectedLot && Number(qtyInp.value||0)>0);
    });

    qtyInp.addEventListener('input', function(){
      var v = Math.max(0, Number(qtyInp.value||0));
      if (selectedSaldo>0 && v>selectedSaldo){
        v = selectedSaldo;
        qtyInp.value = String(v);
      }
      doBtn.disabled = !(selectedLot && v>0);
    });

    closeBtn.addEventListener('click', function(){ document.body.removeChild(host); });

    doBtn.addEventListener('click', function(){
      var cant = Number(qtyInp.value||0);
      if (!selectedLot || !(cant>0)) return;
      var m = STATE.current.getMonth()+1, y = STATE.current.getFullYear();
      var payload = {
        disponibilidadId: selectedLot.id,
        cantidad: cant,
        destMes: m,
        destAnio: y,
        destDia: day,
        destFecha: new Date(y, m-1, day).toISOString(),
        // incluir transportista (snapshot desde disponibilidad seleccionada)
        transportistaNombre: selectedLot.trans || '',
        // opcional: fuente para trazabilidad
        fuente: 'ui-calendario'
      };
      global.MMppApi.crearAsignacion(payload).then(function(){
        return loadData().then(function(){
          document.body.removeChild(host);
          refresh();
        });
      });
    });
  }

  // ===== Eventos top =====
  function attachEvents(root){
    // Navegación
    root.querySelector('#calPrev').addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()-1, 1);
      refresh();
    });
    root.querySelector('#calNext').addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()+1, 1);
      refresh();
    });

    // Vista tons/camiones
    var seg = root.querySelector('#segView');
    seg.addEventListener('click', function(ev){
      var b = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-v');
      if (!b) return;
      STATE.view = b;
      [].slice.call(seg.querySelectorAll('button')).forEach(function(x){ x.classList.remove('on'); });
      ev.target.classList.add('on');
      refresh();
    });

    // Agrupar por
    var tabsG = root.querySelector('#calGroup');
    tabsG.addEventListener('click', function(ev){
      var g = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-g');
      if (!g) return;
      STATE.group = g;
      [].slice.call(tabsG.querySelectorAll('.cal-tab')).forEach(function(n){n.classList.remove('on');});
      ev.target.classList.add('on');
      refresh();
    });

    // Filtros
    root.querySelector('#calComuna').addEventListener('change', function(e){
      STATE.filters.comuna = e.target.value || '';
      refresh();
    });
    root.querySelector('#calTrans').addEventListener('change', function(e){
      STATE.filters.transportista = e.target.value || '';
      refresh();
    });
    root.querySelector('#calProv').addEventListener('change', function(e){
      STATE.filters.proveedor = e.target.value || '';
      refresh();
    });
    root.querySelector('#calClear').addEventListener('click', function(){
      STATE.filters.comuna = '';
      STATE.filters.transportista = '';
      STATE.filters.proveedor = '';
      fillFilterSelects();
      refresh();
    });
  }

  // ===== Carga =====
  function loadData(){
    var api = global.MMppApi || null;
    if (!api) return Promise.resolve();

    // cargar KPI requeridos guardados
    try{
      STATE.reqByMonth = JSON.parse(localStorage.getItem('mmpp-cal-req')||'{}');
    }catch(e){ STATE.reqByMonth = {}; }

    return Promise.all([
      api.getDisponibilidades().then(function(d){ STATE.dispon = Array.isArray(d)?d:[]; }),
      api.getAsignaciones().then(function(a){ STATE.asig = Array.isArray(a)?a:[]; })
    ]);
  }

  // ===== Render principal =====
  function refresh(){
    renderMonthLabel();
    fillFilterSelects();
    renderFilterStats();
    renderHead();
    renderGrid();
  }

  function mount(opts){
    injectCSS();
    STATE.capacidadCamion = (opts && Number(opts.capacidadCamion)>0) ? Number(opts.capacidadCamion) : CAPACIDAD_CAMION_DEF;

    var root = document.getElementById('mmppCalendario');
    if (!root){ console.warn('[mmpp-calendario] Falta #mmppCalendario'); return; }
    buildUI(root);
    attachEvents(root);

    loadData().then(refresh);
  }

  global.MMppCalendario = { mount: mount, refresh: refresh };
})(window);
