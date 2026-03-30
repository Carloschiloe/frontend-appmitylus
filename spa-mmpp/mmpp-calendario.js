/* /spa-mmpp/mmpp-calendario.js
   Calendario de Cosechas y Entregas (asignaciones) para MMPP
   - 10 t = 1 camión (configurable en mount)
   - Navegación por mes compacta (prev/mes/next)
   - KPI: Requerido (Mes) editable + Asignado + Brecha (persiste por mes en localStorage)
   - Vista Toneladas/Camiones
   - Tabs: Proveedor / Comuna / Transportista
   - Tarjetas (click para filtrar) con % del mes y color por entidad
   - Totales por día + chips por grupo (tintados) + resumen semanal en domingos
   - Domingos y feriados (CL) en rojo
   - Doble-click en un día abre modal para asignar (usa MMppApi)
   - En el modal se puede CREAR, EDITAR y ELIMINAR asignaciones (con confirmación)
*/
(function (global) {
  // ===== Config (nuevo: API y log desde config global) =====
  var API = (global.API_BASE || '/api'); // por si más adelante conectas endpoints directos
  var LOG = function(){ if (global.DEBUG === true) console.log.apply(console, ['[Calendario]'].concat([].slice.call(arguments))); };

  // ===== Config fija =====
  var CAPACIDAD_CAMION_DEF = 10; // t por camión
  var CL_HOLIDAYS_2025 = { "2025-09-18":1, "2025-09-19":1 };

  // ===== Utiles =====
  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n = Number(n)||0; return (n<10?"0":"")+n; }
  function monthKeyFromDate(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1); }
  function mondayIndex(jsWeekday){ return (jsWeekday+6)%7; } // 0..6 (0 = Lunes)
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  // ===== Paleta con colores BIEN separados =====
  function _hash(str){
    var h=2166136261>>>0; str=String(str||'');
    for (var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
    return h>>>0;
  }
  var HUES = [210, 12, 140, 48, 280, 110, 330, 190, 24, 160, 300, 80];
  function paletteFor(key){
    var idx = _hash(key)%HUES.length;
    var h = HUES[idx];
    return {
      main:   "hsl("+h+",75%,45%)",
      border: "hsl("+h+",70%,78%)",
      bg:     "hsl("+h+",90%,96%)",
      faint:  "hsl("+h+",85%,92%)"
    };
  }

  // --- Utiles de nombres (para chips/tarjetas) ---
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
    if (last.length >= 5) return last;
    var ac = parts.slice(0,3).map(function(w){return w[0]||'';}).join('').toUpperCase();
    return (ac.length>=2 ? ac : last.toUpperCase());
  }

  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var DIAS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  // Abreviaturas de meses para "07.sept.25"
  var MESES_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
  function fechaCorta(y, m1, d){
    var yy = String(y).slice(-2);
    var mon = MESES_ABBR[(m1-1)|0] || '';
    return pad2(d) + '.' + mon + '.' + yy;
  }

  // ===== CSS =====
  function injectCSS(){
    if (document.getElementById('mmpp-cal-css')) return;
    var css = ''
    +'.cal-wrap{max-width:1200px;margin:0 auto;padding:18px}'
    +'.cal-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
    +'.cal-title{margin:0;font-weight:800;color:#2b3440;font-size:26px;display:flex;gap:10px;align-items:center}'
    +'.cal-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
    +'.cal-btn.s{height:30px;padding:0 10px;border-radius:8px;font-size:12px}'
    +'.cal-btn.ghost{background:#f8fafc;border-color:#e5e7eb;color:#1e40af}'
    +'.seg{display:inline-flex;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}'
    +'.seg button{height:34px;padding:0 12px;background:#f3f4f6;border:0;cursor:pointer;font-weight:700}'
    +'.seg button.on{background:#2155ff;color:#fff}'
    +'.cal-tabs{display:flex;gap:6px}'
    +'.cal-tab{background:#f8fafc;border:1px solid #e5e7eb;border-radius:999px;padding:8px 12px;cursor:pointer;font-weight:800;color:#374151}'
    +'.cal-tab.on{background:#2155ff;color:#fff;border-color:#2155ff}'

    /* Cabecera */
    +'.titleRow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}'
    +'.controlRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 10px}'
    +'.monthgrp{display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:4px 8px}'
    +'.monthlbl{font-weight:800;color:#1e3a8a;padding:0 6px}'
    +'.kpisRow{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px}'

    +'.kpi{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font-weight:700;min-width:160px}'
    +'.kpi .lbl{font-size:12px;color:#6b7280;font-weight:600}'
    +'.kpi input{height:32px;border:1px solid #e5e7eb;border-radius:10px;padding:0 10px;background:#fff;width:110px;margin-left:6px}'

    +'.cal-small{font-size:12px;color:#6b7280}'

    /* ---- Tarjetas ---- */
    +'.cal-cardrow{margin:6px 0 10px}'
    +'#cardDeck{display:flex;gap:10px;align-items:stretch;width:100%;overflow:hidden}'
    +'#cardDeck .fcard{flex:1 1 0;min-width:0}'
    +'.fcard{position:relative;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:12px 12px 12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:box-shadow .15s,border-color .15s}'
    +'.fcard:hover{box-shadow:0 6px 18px rgba(17,24,39,.08)}'
    +'.fcard.active{outline:2px solid rgba(37,99,235,.25)}'
    +'.fcard .swatch{position:absolute;left:0;top:0;bottom:0;width:6px;border-radius:14px 0 0 14px}'
    +'.fcard .meta{display:flex;align-items:center;gap:10px;min-width:0}'
    +'.fcard .title{font-weight:800;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.fcard .sub{font-size:11px;color:#6b7280}'
    +'.qtyBlk{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:88px;flex:0 0 auto}'
    +'.fcard .qty{font-weight:800;font-size:18px;color:#1f2937;white-space:nowrap}'
    +'.fcard .unit{font-size:12px;color:#6b7280;margin-left:4px}'
    +'.pct{font-size:12px;color:#6b7280}'
    +'.pctbar{width:110px;height:6px;border-radius:999px;background:#e5e7eb;overflow:hidden}'
    +'.pctbar span{display:block;height:100%}'

    /* Calendario */
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
    +'.weeksum{font-size:12px;font-weight:700;margin-top:auto}'

    /* Chips del día */
    +'.chip{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 6px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb}'
    +'.chip .left{display:flex;align-items:center;gap:6px;min-width:0;flex:1}'
    +'.chip .prov{font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;max-width:160px}'
    +'.chip .qty{font-weight:700;white-space:nowrap;font-size:11px}'
    +'.dot{width:8px;height:8px;border-radius:999px}'
    +'.tag{font-size:10px;font-weight:800;padding:1px 5px;border:1px solid #e5e7eb;background:#fff;border-radius:6px;color:#374151}'

    /* Modal */
    +'.modalBG{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:999}'
    +'.modal{width:min(980px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.2);padding:18px}'
    +'.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    +'.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}'
    +'.cal-list{display:flex;flex-direction:column;gap:10px;max-height:360px;overflow:auto;padding-right:4px}'
    +'.lot{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#f9fafb;cursor:pointer}'
    +'.lot.sel{background:#e0e7ff;border-color:#c7d2fe}'
    +'.dayasigs{display:flex;flex-direction:column;gap:8px;margin-top:12px}'
    +'.aRow{display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:8px}'
    +'.aRow .who{display:flex;gap:8px;align-items:center;min-width:0}'
    +'.aRow .who .name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}'
    +'.aRow .meta{font-size:12px;color:#6b7280}'
    +'.errGlow{box-shadow:0 0 0 2px #ef4444 inset;border-radius:12px}'

    + '@media (max-width: 720px){'
    + '  .titleRow{flex-direction:column;align-items:flex-start;gap:6px}'
    + '  .monthgrp{align-self:flex-start}'
    + '}'
    ;
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
    reqByMonth: {},
    dispon: [],
    asig: [],
    modalOpen: false
  };

  function getCurrentFilter(){
    if (STATE.group==='prov')  return STATE.filters.proveedor;
    if (STATE.group==='com')   return STATE.filters.comuna;
    return STATE.filters.transportista;
  }
  function setCurrentFilter(val){
    if (STATE.group==='prov')  STATE.filters.proveedor = val;
    else if (STATE.group==='com') STATE.filters.comuna = val;
    else STATE.filters.transportista = val;
  }

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
    return all.map(function(a){
      var d = byId[String(a.disponibilidadId)] || {};
      var prov   = a.proveedorNombre || d.proveedorNombre || d.contactoNombre || '—';
      var trans  = a.transportistaNombre || d.contactoNombre || d.empresaNombre || '—';
      var comuna = a.comuna || d.comuna || '—';
      var tons   = Number(a.tons != null ? a.tons : a.cantidad || 0);
      return {
        id: a.id || null,
        a: a,
        day: asigDay(a),
        tons: tons,
        prov: prov,
        trans: trans,
        comuna: comuna
      };
    });
  }
function norm(s){ return String(s||'').trim().toLowerCase(); }
function applyFilters(rows){
  const f = STATE.filters;
  const fp = norm(f.proveedor), fc = norm(f.comuna), ft = norm(f.transportista);
  return rows.filter(r => {
    if (fc && norm(r.comuna) !== fc) return false;
    if (ft && norm(r.trans) !== ft) return false;
    if (fp && norm(r.prov) !== fp) return false;
    return true;
  });
}
  function groupForDay(rows, groupKey){
    var map = {};
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var baseKey = (groupKey==='prov'? r.prov : (groupKey==='com'? r.comuna : r.trans)) || '—';
      if (!map[baseKey]) {
        map[baseKey] = {
          label: baseKey,
          labelShort: shortLabel(baseKey),
          tag: initials2(r.prov || baseKey),
          tons: 0, trucks: 0,
          provFull: r.prov || '—',
          transFull: r.trans || '—',
          comuna: r.comuna || '—'
        };
      }
      map[baseKey].tons += r.tons||0;
    }
    var arr = Object.keys(map).map(function(k){ return map[k]; });
    for (var j=0;j<arr.length;j++){
      arr[j].trucks = Math.ceil(arr[j].tons / STATE.capacidadCamion);
    }
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

        +'<div class="titleRow">'
          +'<h2 class="cal-title">📅 Calendario de Cosechas y Entregas</h2>'
          +'<div class="monthgrp">'
            +'<button id="calPrev" class="cal-btn ghost" title="Mes anterior">←</button>'
            +'<div id="calMonth" class="monthlbl"></div>'
            +'<button id="calNext" class="cal-btn ghost" title="Mes siguiente">→</button>'
          +'</div>'
        +'</div>'

        +'<div class="controlRow">'
          +'<div class="seg" id="segView">'
            +'<button data-v="t" class="on">Ver en Toneladas</button>'
            +'<button data-v="c">Ver en Camiones</button>'
          +'</div>'
          +'<div class="cal-tabs" id="calGroup">'
            +'<button class="cal-tab on" data-g="prov">Proveedor</button>'
            +'<button class="cal-tab" data-g="com">Comuna</button>'
            +'<button class="cal-tab" data-g="trans">Transportista</button>'
          +'</div>'
          +'<button id="calClear" class="cal-btn s ghost" style="margin-left:auto">Limpiar filtros</button>'
        +'</div>'

        +'<div class="kpisRow cal-kpis">'
          +'<div class="kpi"><div class="lbl">Requerido (Mes)</div>'
            +'<div style="display:flex;align-items:center;gap:6px">'
              +'<input id="kpiReq" type="number" value="0"/>'
              +'<span id="kpiReqUnit" class="cal-small">t</span>'
            +'</div>'
          +'</div>'
          +'<div class="kpi"><div class="lbl">Asignado (Mes)</div><div id="kpiAsign">0 t</div></div>'
          +'<div class="kpi"><div class="lbl">Brecha</div><div id="kpiGap">0 t</div></div>'
        +'</div>'

        +'<div class="cal-cardrow"><div id="cardDeck"></div></div>'

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
    var el = document.getElementById('calMonth');
    if (el) el.textContent = MESES[m]+' de '+y;
  }

  // === Tarjetas por pestaña ===
  function renderCardDeck(){
    var deck = document.getElementById('cardDeck');
    if (!deck) return;

    var rows = enrichAssignmentsForMonth(STATE.current);

    // Mantener filtros de otras dimensiones
    if (STATE.group !== 'prov'  && STATE.filters.proveedor)     rows = rows.filter(function(r){ return r.prov  === STATE.filters.proveedor; });
    if (STATE.group !== 'com'   && STATE.filters.comuna)        rows = rows.filter(function(r){ return r.comuna=== STATE.filters.comuna; });
    if (STATE.group !== 'trans' && STATE.filters.transportista) rows = rows.filter(function(r){ return r.trans === STATE.filters.transportista; });

    var totalT = rows.reduce(function(acc,r){ return acc + (Number(r.tons)||0); }, 0) || 0;

    // Año/mes actual para fecha corta
    var y = STATE.current.getFullYear();
    var m1 = STATE.current.getMonth() + 1;

    // Sumar por entidad y guardar primer día
    var map = {};
    rows.forEach(function(r){
      var key = (STATE.group==='prov'? r.prov : (STATE.group==='com'? r.comuna : r.trans)) || '—';
      var tons = Number(r.tons||0);
      if (!map[key]) map[key] = { key:key, tons:0, firstDay:null };
      map[key].tons += tons;
      if (!map[key].firstDay || r.day < map[key].firstDay) map[key].firstDay = r.day;
    });

    var list = Object.keys(map).map(function(k){ return map[k]; })
      .sort(function(a,b){ return (b.tons||0)-(a.tons||0); });

    var active = getCurrentFilter();
    var labelMap = { prov:'Proveedor', com:'Comuna', trans:'Transportista' };

    var html = list.map(function(item){
      var trucks = Math.ceil(item.tons / STATE.capacidadCamion);
      var val = (STATE.view==='t') ? item.tons : trucks;
      var unit = (STATE.view==='t' ? 't' : 'c');
      var pct = totalT>0 ? Math.round((item.tons/totalT)*100) : 0;
      var pal = paletteFor(item.key);
      var act = (active && active===item.key) ? ' active' : '';
      var inicioStr = item.firstDay ? ('Inicio: ' + fechaCorta(y, m1, item.firstDay)) : 'Inicio: —';

      return '<div class="fcard'+act+'" data-key="'+escapeHtml(item.key)+'"'
           + ' style="border-color:'+pal.border+';background:'+pal.bg+'">'
           +   '<span class="swatch" style="background:'+pal.main+'"></span>'
           +   '<div class="meta">'
           +     '<span class="dot" style="background:'+pal.main+'"></span>'
           +     '<div style="display:flex;flex-direction:column;min-width:0">'
           +       '<div class="title" title="'+escapeHtml(item.key)+'">'+escapeHtml(item.key)+'</div>'
           +       '<div class="sub">'+labelMap[STATE.group]+'</div>'
           +       '<div class="sub" title="Primer día con asignación en el mes">'+inicioStr+'</div>'
           +     '</div>'
           +   '</div>'
           +   '<div class="qtyBlk">'
           +     '<div class="qty">'+numeroCL(val)+' <span class="unit">'+unit+'</span></div>'
           +     '<div class="pct">'+pct+'% del mes</div>'
           +     '<div class="pctbar"><span style="width:'+pct+'%;background:'+pal.main+';opacity:.45"></span></div>'
           +   '</div>'
           + '</div>';
    }).join('');

    deck.innerHTML = html || '<div class="cal-small">No hay datos para el mes.</div>';
  }

  function renderHead(){
    var h = document.getElementById('calDaysHead');
    if (!h) return;
    h.innerHTML = DIAS.map(function(n){ return '<div class="cal-dayname">'+n+'</div>'; }).join('');
  }

  function renderGrid(){
    var cont = document.getElementById('calDays');
    if (!cont) return;

    var y = STATE.current.getFullYear(), mIdx = STATE.current.getMonth();
    var first = new Date(y, mIdx, 1);
    var startOffset = mondayIndex(first.getDay());
    var dim = new Date(y, mIdx+1, 0).getDate();

    var enrichedAll = enrichAssignmentsForMonth(STATE.current);
    var filtered = applyFilters(enrichedAll);
    var calc = totalsByDayEnriched(STATE.current, filtered);
    var byDay = calc.byDay;

    var kpiAsign = (STATE.view==='t' ? calc.monthTotals.tons : calc.monthTotals.trucks);
    var reqMap = STATE.reqByMonth || {};
    var mk = monthKeyFromDate(STATE.current);
    var reqTons = Number(reqMap[mk]||0);
    var reqDisplay = (STATE.view==='t' ? reqTons : Math.round(reqTons/STATE.capacidadCamion));
    var gap = Math.max(0, (reqDisplay||0) - (kpiAsign||0));

    var inp = document.getElementById('kpiReq');
    var unit = document.getElementById('kpiReqUnit');
    var asignEl = document.getElementById('kpiAsign');
    var gapEl = document.getElementById('kpiGap');
    if (inp){
      inp.value = reqDisplay||0;
      inp.oninput = function(){
        var v = Math.max(0, Number(inp.value||0));
        var toStore = (STATE.view==='t' ? v : v*STATE.capacidadCamion);
        STATE.reqByMonth[mk] = toStore;
        try{ localStorage.setItem('mmpp-cal-req', JSON.stringify(STATE.reqByMonth)); }catch(e){}
        var gd = Math.max(0, (STATE.view==='t'?toStore:Math.round(toStore/STATE.capacidadCamion)) - kpiAsign);
        if (gapEl) gapEl.textContent = numeroCL(gd)+' '+(STATE.view==='t'?'t':'c');
      };
    }
    if (unit) unit.textContent = (STATE.view==='t'?'t':'c');
    if (asignEl) asignEl.textContent = numeroCL(kpiAsign)+' '+(STATE.view==='t'?'t':'c');
    if (gapEl) gapEl.textContent = numeroCL(gap)+' '+(STATE.view==='t'?'t':'c');

    var boxes = [];
    for (var i=0; i<startOffset; i++) boxes.push('<div class="cal-cell off"></div>');

    for (var d=1; d<=dim; d++){
      var idx = startOffset + (d-1);
      var isSunday = (idx % 7)===6;
      var keyDate = y+'-'+pad2(mIdx+1)+'-'+pad2(d);
      var isHoliday = isSunday || !!CL_HOLIDAYS_2025[keyDate];

      var itemsToday = filtered.filter(function(r){ return r.day===d; });
      var groups = groupForDay(itemsToday, STATE.group);
      var totalT = byDay[d].tons;
      var totalC = byDay[d].trucks;
      var label = (STATE.view==='t' ? (numeroCL(totalT)+' t') : (numeroCL(totalC)+' c'));

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

      // Chips del día
      var chips = '';
      var maxChips = 4;
      for (var g=0; g<groups.length && g<maxChips; g++){
        var gg = groups[g];
        var qty = (STATE.view==='t' ? (numeroCL(gg.tons)+' t') : (numeroCL(gg.trucks)+' c'));
        var colorKey = (STATE.group==='prov' ? (gg.provFull||gg.label)
                        : STATE.group==='com' ? (gg.comuna||gg.label)
                        : (gg.transFull||gg.label));
        var pal = paletteFor(colorKey);
        var display = (STATE.group==='prov' ? shortLabel(gg.transFull) : gg.labelShort) || gg.labelShort;
        var titleFull = (
          'Proveedor: ' + gg.provFull + ' · ' +
          'Contacto: '  + gg.transFull + ' · ' +
          'Comuna: '    + gg.comuna    + ' · ' + qty
        );
        chips += '<div class="chip" title="'+escapeHtml(titleFull)+'"'
               + ' style="background:'+pal.bg+';border-color:'+pal.border+'">'
               +   '<div class="left">'
               +     '<span class="dot" style="background:'+pal.main+'"></span>'
               +     '<span class="tag" style="border-color:'+pal.border+'">'+initials2(colorKey)+'</span>'
               +     '<span class="prov">'+escapeHtml(display)+'</span>'
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
  }

  // ===== Modal Asignar / Editar / Eliminar =====
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
  function dispoPorId(id){
    for (var i=0;i<STATE.dispon.length;i++){
      if (String(STATE.dispon[i].id)===String(id)) return STATE.dispon[i];
    }
    return null;
  }

  function abrirModalAsignar(day){
    if (STATE.modalOpen) return;
    document.querySelectorAll('.modalBG').forEach(function(n){ n.parentNode && n.parentNode.removeChild(n); });
    STATE.modalOpen = true;

    var y = STATE.current.getFullYear(), m = STATE.current.getMonth()+1;
    var cutoff = y * 100 + m;

    var base = STATE.dispon.slice();
    if (STATE.filters.proveedor) base = base.filter(function(d){ return (d.proveedorNombre||d.contactoNombre)===STATE.filters.proveedor; });
    if (STATE.filters.comuna) base = base.filter(function(d){ return (d.comuna||'')===STATE.filters.comuna; });
    if (STATE.filters.transportista) base = base.filter(function(d){ return (d.contactoNombre||d.empresaNombre||'')===STATE.filters.transportista; });

    var lots = base
      .filter(function(d){
        var saldo = saldoDe(d);
        if (saldo <= 0) return false;
        var key = recMonthKey(d);
        return key <= cutoff;
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

    // Asignaciones del día
    var monthRows = enrichAssignmentsForMonth(STATE.current);
    var dayAsigs = monthRows.filter(function(r){ return r.day===day; });

    var host = document.createElement('div');
    host.className = 'modalBG';
    host.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">'
        +'<div style="display:flex;justify-content:space-between;align-items:center">'
          +'<h3 style="margin:0;font-weight:800">Asignar para el '+day+' de '+MESES[m-1]+' de '+y+'</h3>'
          +'<button class="cal-btn" id="calClose" type="button">✕</button>'
        +'</div>'
        +'<div class="cal-small" style="margin-top:4px">Disponibilidades con <strong>saldo &gt; 0</strong> hasta <strong>'+MESES[m-1]+' '+y+'</strong>. 1 camión = '+STATE.capacidadCamion+' t.</div>'
        +'<div class="row" style="margin-top:10px">'
          +'<div><div class="cal-list" id="calLots"></div></div>'
          +'<div>'
            +'<div class="row3">'
              +'<div><label class="cal-small">Cantidad (t)</label><input id="calQty" class="cal-input" type="number" min="0" step="1" placeholder="Ej: 30" /></div>'
              +'<div><label class="cal-small">Mes destino</label><input class="cal-input" value="'+pad2(m)+'" disabled/></div>'
              +'<div><label class="cal-small">Año destino</label><input class="cal-input" value="'+y+'" disabled/></div>'
            +'</div>'
            +'<div class="cal-small" id="calLotTip" style="margin-top:8px">Selecciona un lote a la izquierda para crear, o usa la lista de abajo para editar.</div>'
            +'<div class="cal-small" id="calErr" style="margin-top:6px;color:#b91c1c"></div>'
            +'<div style="margin-top:12px;display:flex;gap:8px;align-items:center">'
              +'<button id="calDoAssign" type="button" class="cal-btn" disabled>✔ Confirmar Asignación</button>'
              +'<button id="calCancelEdit" type="button" class="cal-btn s" style="display:none">Cancelar edición</button>'
            +'</div>'
            +'<div class="dayasigs" id="dayAsigsWrap"></div>'
          +'</div>'
        +'</div>'
      +'</div>';
    document.body.appendChild(host);

    function closeModal(){
      if (host && host.parentNode) host.parentNode.removeChild(host);
      STATE.modalOpen = false;
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e){ if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onEsc);
    host.addEventListener('click', function(e){ if (e.target === host) closeModal(); });

    var lotsWrap = host.querySelector('#calLots');
    var asigsWrap = host.querySelector('#dayAsigsWrap');
    var closeBtn = host.querySelector('#calClose');
    var doBtn    = host.querySelector('#calDoAssign');
    var cancelBtn= host.querySelector('#calCancelEdit');
    var qtyInp   = host.querySelector('#calQty');
    var tip      = host.querySelector('#calLotTip');
    var errEl    = host.querySelector('#calErr');

    var selectedLot = null, selectedSaldo = 0;
    var editCtx = null;
    var saving = false;
    var warnedNoLot = false;

    function warnNoLot(){
      errEl.textContent = 'Selecciona un lote con saldo a la izquierda para continuar.';
      lotsWrap.classList.add('errGlow');
      setTimeout(function(){ lotsWrap.classList.remove('errGlow'); }, 1000);
      if (!warnedNoLot) {
        warnedNoLot = true;
        try { alert('Debes seleccionar un lote con saldo para crear la asignación.'); } catch(_){}
      }
    }

    function renderLots(){
      var html;
      if (!lots.length){
        html = '<div class="cal-small">No hay disponibilidades con saldo para los filtros actuales.</div>';
      } else {
        html = lots.map(function(L){
          return '<div class="lot" data-id="'+L.id+'">'
            +'<div style="display:flex;justify-content:space-between;gap:8px">'
            +  '<div><strong>'+escapeHtml(L.prov)+'</strong><div class="cal-small">'+escapeHtml(L.comuna||"—")+'</div></div>'
            +  '<div style="text-align:right"><div>Saldo: <strong>'+numeroCL(L.saldo)+'</strong> t</div><div class="cal-small">Original: '+numeroCL(L.original)+' t</div></div>'
            +'</div>'
            +'<div class="cal-small">'+(L.mesKey?('mes '+L.mesKey):'')+(L.fecha?(' · desde '+new Date(L.fecha).toLocaleDateString('es-CL')):'')+'</div>'
          +'</div>';
        }).join('');
      }
      lotsWrap.innerHTML = html;

      if (lots.length === 1) {
        var only = lotsWrap.querySelector('.lot');
        if (only) only.click();
      }
    }
    function renderDayAsigs(){
      if (!dayAsigs.length){
        asigsWrap.innerHTML = '<div class="cal-small">No hay asignaciones para este día.</div>';
        return;
      }
      asigsWrap.innerHTML = dayAsigs.map(function(r){
        var qty = numeroCL(r.tons)+' t';
        var prov = r.prov || '—';
        var trans = r.trans || '—';
        return '<div class="aRow" data-aid="'+(r.id||'')+'">'
          +  '<div class="who">'
          +    '<span class="dot" style="background:'+paletteFor(prov).main+'"></span>'
          +    '<span class="name" title="'+escapeHtml(prov)+' · '+escapeHtml(trans)+'">'+escapeHtml(shortLabel(trans))+' <span class="cal-small">· '+escapeHtml(shortLabel(prov))+'</span></span>'
          +  '</div>'
          +  '<div class="meta">'+qty+'</div>'
          +  '<div style="display:flex;gap:6px">'
          +    '<button class="cal-btn s" type="button" data-edit="'+(r.id||'')+'">Editar</button>'
          +    '<button class="cal-btn s" type="button" data-del="'+(r.id||'')+'">Eliminar</button>'
          +  '</div>'
          +'</div>';
      }).join('');
    }
    renderLots();
    renderDayAsigs();

    function resetCreateMode(){
      editCtx = null;
      cancelBtn.style.display = 'none';
      doBtn.textContent = '✔ Confirmar Asignación';
      tip.textContent = 'Selecciona un lote a la izquierda para crear, o usa la lista de abajo para editar.';
      qtyInp.value = '';
      errEl.textContent = '';
      selectedLot = null; selectedSaldo = 0;
      warnedNoLot = false;
      lotsWrap.classList.remove('errGlow');
      [].slice.call(lotsWrap.querySelectorAll('.lot')).forEach(function(n){n.classList.remove('sel');});
      doBtn.disabled = true;
    }

    lotsWrap.addEventListener('click', function(ev){
      var t = ev.target;
      while (t && t!==lotsWrap && !t.classList.contains('lot')) t = t.parentNode;
      if (!t || !t.classList.contains('lot')) return;
      var id = t.getAttribute('data-id');
      var L = lots.find(function(x){return String(x.id)===String(id);});
      if (!L) return;

      editCtx = null;
      cancelBtn.style.display = 'none';
      doBtn.textContent='✔ Confirmar Asignación';

      selectedLot = L;
      selectedSaldo = Number(L.saldo||0);

      [].slice.call(lotsWrap.querySelectorAll('.lot')).forEach(function(n){n.classList.remove('sel');});
      t.classList.add('sel');

      warnedNoLot = false;
      lotsWrap.classList.remove('errGlow');
      errEl.textContent = '';

      var cam = Math.ceil(selectedSaldo / STATE.capacidadCamion);
      tip.textContent = 'Saldo disponible: '+numeroCL(selectedSaldo)+' t  ·  ~'+numeroCL(cam)+' camiones (a '+STATE.capacidadCamion+' t/camión)';

      doBtn.disabled = !(Number(qtyInp.value||0) > 0);
    });

    qtyInp.addEventListener('input', function(){
      var v = Math.max(0, Number(qtyInp.value||0));
      if (editCtx){
        if (v > editCtx.max){ v = editCtx.max; qtyInp.value = String(v); }
        errEl.textContent = '';
        doBtn.disabled = !(v>0);
        return;
      }
      if (selectedSaldo>0 && v>selectedSaldo){ v = selectedSaldo; qtyInp.value = String(v); }
      doBtn.disabled = !(v>0);

      if (v > 0 && !selectedLot) {
        warnNoLot();
      } else {
        errEl.textContent = '';
        warnedNoLot = false;
        lotsWrap.classList.remove('errGlow');
      }
    });

    asigsWrap.addEventListener('click', function(ev){
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var idEdit = t.getAttribute('data-edit');
      var idDel  = t.getAttribute('data-del');

      if (idEdit){
        var row = dayAsigs.find(function(r){ return String(r.id)===String(idEdit); });
        if (!row) return;
        var a = row.a || {};
        var dpo = dispoPorId(a.disponibilidadId);
        var saldoExtra = dpo ? saldoDe(dpo) : 0;
        var max = Number(row.tons || 0) + Number(saldoExtra || 0);
        editCtx = { id: row.id, oldTons: Number(row.tons||0), dispo: dpo, max: max };
        cancelBtn.style.display = 'inline-block';
        doBtn.textContent = '💾 Guardar cambios';
        tip.textContent = 'Editando: '+(row.trans||'—')+' · '+(row.prov||'—')+'. Máximo permitido: '+numeroCL(max)+' t.';
        qtyInp.value = String(row.tons||0);
        doBtn.disabled = false;
        errEl.textContent = '';
        selectedLot = null; selectedSaldo = 0;
        [].slice.call(lotsWrap.querySelectorAll('.lot')).forEach(function(n){n.classList.remove('sel');});
        return;
      }

      if (idDel){
        var rowD = dayAsigs.find(function(r){ return String(r.id)===String(idDel); });
        if (!rowD) return;
        var msg = '¿Eliminar asignación de '+numeroCL(rowD.tons)+' t para "'+(rowD.trans||rowD.prov||'—')+ '" del día '+day+'?';
        if (!confirm(msg)) return;
        errEl.textContent = '';
        t.disabled = true;

        if (!global.MMppApi || !global.MMppApi.borrarAsignacion) {
          errEl.textContent = 'MMppApi.borrarAsignacion no disponible';
          t.disabled = false;
          return;
        }

        global.MMppApi.borrarAsignacion(idDel)
          .then(function(resp){
            if (resp && resp.__status && resp.__status>=400) throw new Error(resp.error||'No se pudo eliminar');
            return loadData().then(function(){
              var freshMonth = enrichAssignmentsForMonth(STATE.current);
              dayAsigs = freshMonth.filter(function(r){ return r.day===day; });
              renderDayAsigs();
              renderGrid();
            });
          })
          .catch(function(e){ errEl.textContent = (e && e.message) ? e.message : 'Error al eliminar asignación'; })
          .finally(function(){ t.disabled = false; });
      }
    });

    function closeModalAndRefresh(){ closeModal(); renderGrid(); }

    cancelBtn.addEventListener('click', resetCreateMode);
    closeBtn.addEventListener('click', closeModal);

    doBtn.addEventListener('click', function(){
      if (saving) return;
      var cant = Number(qtyInp.value||0);

      if (!(cant > 0)) {
        errEl.textContent = 'Ingresa una cantidad mayor a 0.';
        return;
      }

      // Crear
      if (!editCtx){
        if (!selectedLot) { warnNoLot(); return; }
        var confMsg = '¿Confirmas crear asignación de '+numeroCL(cant)+' t para "'+(selectedLot.trans||selectedLot.prov||'—')+'" el '+day+' de '+MESES[m-1]+'?';
        if (!confirm(confMsg)) return;

        if (!global.MMppApi || !global.MMppApi.crearAsignacion) {
          errEl.textContent = 'MMppApi.crearAsignacion no disponible';
          return;
        }

        saving = true;
        doBtn.disabled = true; doBtn.textContent = 'Guardando…'; errEl.textContent = '';
        var payload = {
          disponibilidadId: selectedLot.id,
          cantidad: cant,
          destMes: m,
          destAnio: y,
          destDia: day,
          destFecha: new Date(y, m-1, day).toISOString(),
          transportistaNombre: selectedLot.trans || '',
          fuente: 'ui-calendario'
        };
        global.MMppApi.crearAsignacion(payload)
          .then(function(resp){
            if (resp && resp.__status && resp.__status>=400) throw new Error(resp.error||'No se pudo crear');
            return loadData().then(function(){ renderGrid(); closeModal(); });
          })
          .catch(function(e){
            errEl.textContent = (e && e.message) ? e.message : 'Error al crear asignación';
          })
          .finally(function(){
            saving = false;
            if (STATE.modalOpen){ doBtn.disabled = false; doBtn.textContent = '✔ Confirmar Asignación'; }
          });
        return;
      }

      // Editar
      var msg = '¿Guardar cambios? Nueva cantidad: '+numeroCL(cant)+' t (antes '+numeroCL(editCtx.oldTons)+' t).';
      if (!confirm(msg)) return;

      if (!global.MMppApi || !global.MMppApi.editarAsignacion) {
        errEl.textContent = 'MMppApi.editarAsignacion no disponible';
        return;
      }

      saving = true;
      doBtn.disabled = true; doBtn.textContent = 'Guardando…'; errEl.textContent = '';
      var patch = {
        tons: cant, cantidad: cant,
        camiones: Math.ceil(cant / STATE.capacidadCamion),
        updatedAt: new Date().toISOString()
      };
      global.MMppApi.editarAsignacion(editCtx.id, patch)
        .then(function(resp){
          if (resp && resp.__status && resp.__status>=400) throw new Error(resp.error||'No se pudo actualizar');
          return loadData().then(function(){ renderGrid(); closeModal(); });
        })
        .catch(function(e){
          errEl.textContent = (e && e.message) ? e.message : 'Error al actualizar asignación';
        })
        .finally(function(){
          saving = false;
          if (STATE.modalOpen){ doBtn.disabled = false; doBtn.textContent = '💾 Guardar cambios'; }
        });
    });
  }

  // ===== Eventos top =====
  function attachEvents(root){
    var prev = root.querySelector('#calPrev');
    var next = root.querySelector('#calNext');
    if (prev) prev.addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()-1, 1);
      refresh();
    });
    if (next) next.addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()+1, 1);
      refresh();
    });

    var seg = root.querySelector('#segView');
    if (seg) seg.addEventListener('click', function(ev){
      var b = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-v');
      if (!b) return;
      STATE.view = b;
      [].slice.call(seg.querySelectorAll('button')).forEach(function(x){ x.classList.remove('on'); });
      ev.target.classList.add('on');
      refresh();
    });

    var tabsG = root.querySelector('#calGroup');
    if (tabsG) tabsG.addEventListener('click', function(ev){
      var g = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-g');
      if (!g) return;
      STATE.group = g;
      [].slice.call(tabsG.querySelectorAll('.cal-tab')).forEach(function(n){n.classList.remove('on');});
      ev.target.classList.add('on');
      renderCardDeck();
      renderGrid();
    });

    var deck = root.querySelector('#cardDeck');
    if (deck) deck.addEventListener('click', function(ev){
      var t = ev.target;
      while (t && t!==deck && !t.getAttribute('data-key')) t = t.parentNode;
      if (!t || t===deck) return;
      var key = t.getAttribute('data-key');
      var curr = getCurrentFilter();
      setCurrentFilter(curr===key ? '' : key);
      renderCardDeck();
      renderGrid();
    });

    var cont = root.querySelector('#calDays');
    if (cont && !cont._dblAttached){
      cont.addEventListener('dblclick', function(ev){
        var t = ev.target;
        while (t && t!==cont && !t.getAttribute('data-day')) t = t.parentNode;
        if (!t) return;
        var day = Number(t.getAttribute('data-day'))||0;
        if (day>0) abrirModalAsignar(day);
      });
      cont._dblAttached = true;
    }

    var clearBtn = root.querySelector('#calClear');
    if (clearBtn) clearBtn.addEventListener('click', function(){
      STATE.filters.comuna = '';
      STATE.filters.transportista = '';
      STATE.filters.proveedor = '';
      renderCardDeck();
      refresh();
    });
  }

  // ===== Carga =====
  function loadData(){
    var api = global.MMppApi || null;
    if (!api) {
      LOG('MMppApi no definido. No se cargarán datos.');
      return Promise.resolve();
    }

    try{
      STATE.reqByMonth = JSON.parse(localStorage.getItem('mmpp-cal-req')||'{}');
    }catch(e){ STATE.reqByMonth = {}; }

    var safe = function (p, fallback){
      return Promise.resolve()
        .then(function(){ return p; })
        .catch(function(err){
          console.error(err);
          return (typeof fallback === 'function') ? fallback(err) : fallback;
        });
    };

    return Promise.all([
      api.getDisponibilidades ? safe(api.getDisponibilidades(), []) : Promise.resolve([]),
      api.getAsignaciones ? safe(api.getAsignaciones(), []) : Promise.resolve([])
    ]).then(function(results){
      STATE.dispon = Array.isArray(results[0]) ? results[0] : [];
      STATE.asig   = Array.isArray(results[1]) ? results[1] : [];
      LOG('Datos cargados', {dispon: STATE.dispon.length, asig: STATE.asig.length});
    });
  }

  // ===== Render principal =====
  function refresh(){
    renderMonthLabel();
    renderCardDeck();
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

    loadData()
      .then(refresh)
      .catch(function(err){
        console.error(err);
        try { alert('Error al cargar datos del calendario: ' + (err && err.message ? err.message : err)); } catch(_){}
      });
  }

  global.MMppCalendario = { mount: mount, refresh: refresh };
})(window);
