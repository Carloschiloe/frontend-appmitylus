/* /spa-mmpp/mmpp-calendario.js
   Calendario de Cosechas y Entregas (asignaciones) para MMPP
   - Navegación por mes
   - Totales por día (Toneladas / Camiones)
   - Click en día -> modal para asignar desde disponibilidades con saldo
   - Filtros dinámicos (Contacto y Comuna) + Limpiar filtros
   - Compatible con MMppApi.getDisponibilidades / getAsignaciones / crearAsignacion
   - Back-compat: si una asignación no trae destDia, se coloca en el día 1 (marcado "sin día")
*/

(function (global) {
  var CAPACIDAD_CAMION_DEF = 25; // t/camión por defecto (cambia con mount({capacidadCamion}))

  function injectCSS(){
    if (document.getElementById('mmpp-cal-css')) return;
    var css = ''
    +'.cal-wrap{max-width:1200px;margin:0 auto;padding:18px}'
    +'.cal-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:22px;box-shadow:0 10px 30px rgba(17,24,39,.06)}'
    +'.cal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}'
    +'.cal-title{margin:0;font-weight:800;color:#2b3440}'
    +'.cal-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    +'.cal-btn{background:#eef2ff;border:1px solid #c7d2fe;color:#1e40af;height:38px;border-radius:10px;padding:0 12px;cursor:pointer;font-weight:700}'
    +'.cal-tabs{display:flex;gap:6px}'
    +'.cal-tab{background:#f8fafc;border:1px solid #e5e7eb;border-radius:999px;padding:8px 12px;cursor:pointer;font-weight:800;color:#374151}'
    +'.cal-tab.on{background:#1e40af;color:#fff;border-color:#1e40af}'
    +'.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}'
    +'.cal-dayname{font-weight:800;color:#64748b;text-align:center}'
    +'.cal-cell{background:#fff;border:1px solid #e5e7eb;border-radius:14px;min-height:120px;padding:10px;display:flex;flex-direction:column;gap:6px}'
    +'.cal-cell.off{background:#f9fafb;color:#9ca3af}'
    +'.cal-date{display:flex;align-items:center;justify-content:space-between;font-weight:800;color:#374151}'
    +'.cal-pill{display:inline-flex;align-items:center;gap:6px;background:#ede9fe;color:#6d28d9;border-radius:999px;padding:2px 8px;font-weight:700;font-size:12px}'
    +'.cal-tag{display:inline-flex;gap:6px;align-items:center;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700}'
    +'.cal-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    +'.cal-filterrow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px}'
    +'.cal-input{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fafafa;width:100%}'
    +'.cal-small{font-size:12px;color:#6b7280}'
    +'.modalBG{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:999}'
    +'.modal{width:min(900px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.2);padding:18px}'
    +'.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    +'.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}'
    +'.cal-list{display:flex;flex-direction:column;gap:10px;max-height:360px;overflow:auto;padding-right:4px}'
    +'.lot{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#f9fafb;cursor:pointer}'
    +'.lot.sel{background:#e0e7ff;border-color:#c7d2fe}'
    ;
    var s = document.createElement('style');
    s.id = 'mmpp-cal-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var MESES_CORTO = ["Ene.","Feb.","Mar.","Abr.","May.","Jun.","Jul.","Ago.","Sept.","Oct.","Nov.","Dic."];
  var DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]; // lunes primero

  function numeroCL(n){ return (Number(n)||0).toLocaleString("es-CL"); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }

  function firstDayOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function daysInMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
  function mondayIndex(jsWeekday){ return (jsWeekday+6)%7; } // 0..6 donde 0=Lunes

  function uniqSorted(arr){
    var set={}, out=[];
    (arr||[]).forEach(function(v){ if(v!=null && v!=="" && !set[v]){ set[v]=1; out.push(v); } });
    out.sort(); return out;
  }

  function groupBy(arr, keyFn){
    var m={}; (arr||[]).forEach(function(r){ var k=keyFn(r); m[k]=(m[k]||[]).concat([r]); }); return m;
  }

  // --- Estado ---
  var STATE = {
    capacidadCamion: CAPACIDAD_CAMION_DEF,
    current: new Date(),           // mes actual
    view: 't',                     // 't' toneladas | 'c' camiones
    filters: { comuna:'', proveedor:'' },
    dispon: [],
    asig: [],
    modal: null
  };

  // --- Helpers de datos ---
  function asigKeyMonth(a){
    var y = Number(a.destAnio||0), m = Number(a.destMes||0);
    if(!y || !m) return null;
    return y+'-'+pad2(m);
  }
  function asigDay(a){
    // Si no vino día, lo ubico en 1 (y marco flag)
    var d = Number(a.destDia||0);
    if (!d) d = 1;
    return d;
  }

  function totalsByDay(monthDate){
    var y = monthDate.getFullYear(), m = monthDate.getMonth()+1;
    var mmKey = y+'-'+pad2(m);
    var filtered = STATE.asig.filter(function(a){
      return asigKeyMonth(a)===mmKey &&
        (!STATE.filters.proveedor || a.proveedorNombre===STATE.filters.proveedor);
    });
    // por día
    var out = {};
    for (var i=0;i<filtered.length;i++){
      var d = asigDay(filtered[i]);
      out[d] = (out[d]||0) + Number(filtered[i].cantidad||0);
    }
    return out; // { dia -> tons }
  }

  // saldo por disponibilidad
  function asigByDispo(){
    return groupBy(STATE.asig, function(a){ return a.disponibilidadId||'__none__'; });
  }
  function saldoDe(dispo){
    var g = asigByDispo();
    var usadas = (g[dispo.id]||[]).reduce(function(acc,a){ return acc + (Number(a.cantidad)||0); },0);
    return Math.max(0, (Number(dispo.tons)||0) - usadas);
  }

  // Filtros dinámicos
  function dynOptions(){
    var base = STATE.dispon.slice();
    var prov = uniqSorted(base.map(function(d){return d.contactoNombre||d.proveedorNombre;}).filter(Boolean));
    var com  = uniqSorted(base.map(function(d){return d.comuna;}).filter(Boolean));
    return {prov:prov, com:com};
  }

  // --- UI ---
  function buildUI(root){
    root.innerHTML = ''
    +'<div class="cal-wrap">'
      +'<div class="cal-card">'
        +'<div class="cal-head">'
          +'<h2 class="cal-title">Calendario de Cosechas y Entregas</h2>'
          +'<div class="cal-actions">'
            +'<div class="cal-tabs" id="calUnits">'
              +'<button class="cal-tab on" data-u="t">Ver en Toneladas</button>'
              +'<button class="cal-tab" data-u="c">Ver en Camiones</button>'
            +'</div>'
            +'<div class="cal-tabs" id="calGroup">'
              +'<button class="cal-tab on" data-g="prov">Proveedor</button>'
              +'<button class="cal-tab" data-g="com">Comuna</button>'
            +'</div>'
            +'<button id="calPrev" class="cal-btn">←</button>'
            +'<div id="calMonth" class="cal-btn" style="pointer-events:none;opacity:.9"></div>'
            +'<button id="calNext" class="cal-btn">→</button>'
          +'</div>'
        +'</div>'

        +'<div class="cal-filterrow">'
          +'<select id="calComuna" class="cal-input"></select>'
          +'<select id="calProv" class="cal-input"></select>'
          +'<div style="text-align:right"><button id="calClear" class="cal-btn">Limpiar filtros</button></div>'
        +'</div>'

        +'<div class="cal-grid" id="calDaysHead"></div>'
        +'<div class="cal-grid" id="calDays"></div>'
        +'<div class="cal-small" id="calFootNote" style="margin-top:8px"></div>'
      +'</div>'
    +'</div>';
  }

  function fillFilterSelects(){
    var opts = dynOptions();
    var cSel = document.getElementById('calComuna');
    var pSel = document.getElementById('calProv');

    cSel.innerHTML = '<option value="">Todas las comunas</option>' +
      opts.com.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
    pSel.innerHTML = '<option value="">Todos los contactos</option>' +
      opts.prov.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join('');

    if (STATE.filters.comuna) cSel.value = STATE.filters.comuna;
    if (STATE.filters.proveedor) pSel.value = STATE.filters.proveedor;
  }

  function renderMonthLabel(){
    var m = STATE.current.getMonth(), y = STATE.current.getFullYear();
    document.getElementById('calMonth').textContent = MESES[m]+' de '+y;
  }

  function renderHead(){
    var h = document.getElementById('calDaysHead');
    h.innerHTML = DIAS.map(function(n){ return '<div class="cal-dayname">'+n+'</div>'; }).join('');
  }

  function renderGrid(){
    var cont = document.getElementById('calDays');
    var first = firstDayOfMonth(STATE.current);
    var dim = daysInMonth(STATE.current);
    var startOffset = mondayIndex(first.getDay()); // 0..6

    var boxes = [];
    for (var i=0; i<startOffset; i++){
      boxes.push('<div class="cal-cell off"></div>');
    }

    var totals = totalsByDay(STATE.current); // {dia->tons}

    for (var d=1; d<=dim; d++){
      var tonsDia = totals[d] || 0;
      var label = (STATE.view==='t')
        ? numeroCL(tonsDia)+' t'
        : numeroCL(tonsDia/STATE.capacidadCamion)+' c';

      boxes.push(
        '<div class="cal-cell" data-day="'+d+'">'
          +'<div class="cal-date">'
            +'<span>'+d+'</span>'
            +'<span class="cal-pill">Total '+label+'</span>'
          +'</div>'
          +'<div class="cal-meta">'
            +(tonsDia>0?('<span class="cal-tag">Asignado</span>'):'')
            +'<button class="cal-btn" data-assign="'+d+'" style="margin-left:auto">Asignar</button>'
          +'</div>'
        +'</div>'
      );
    }
    cont.innerHTML = boxes.join('');
    document.getElementById('calFootNote').textContent =
      'Tip: haz clic en “Asignar” para cargar disponibilidades con saldo y crear una asignación para ese día.';

    // eventos de asignación (delegado)
    cont.addEventListener('click', function(ev){
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-assign')){
        var day = Number(t.getAttribute('data-assign'));
        abrirModalAsignar(day);
      }
    }, { once:true }); // una vez por render; se re-atacha en cada refresh
  }

  // --- Modal Asignar ---
  function abrirModalAsignar(day){
    // filtro base aplicado: proveedor / comuna
    var base = STATE.dispon.slice();
    if (STATE.filters.proveedor) base = base.filter(function(d){ return (d.contactoNombre||d.proveedorNombre)===STATE.filters.proveedor; });
    if (STATE.filters.comuna) base = base.filter(function(d){ return (d.comuna||'')===STATE.filters.comuna; });

    // lots con saldo
    var lots = base.map(function(d){
      return { id:d.id, prov:(d.contactoNombre||d.proveedorNombre||'—'), comuna:(d.comuna||'—'),
               mesKey:(d.mesKey||''), fecha:d.fecha||'', saldo: saldoDe(d), original: Number(d.tons||0) };
    }).filter(function(L){ return L.saldo>0; });

    var y = STATE.current.getFullYear(), m = STATE.current.getMonth()+1;
    var host = document.createElement('div');
    host.className = 'modalBG';
    host.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">'
        +'<div style="display:flex;justify-content:space-between;align-items:center">'
          +'<h3 style="margin:0;font-weight:800">Asignar para el '+day+' de '+MESES[m-1]+' de '+y+'</h3>'
          +'<button class="cal-btn" id="calClose">✕</button>'
        +'</div>'
        +'<div class="cal-small" style="margin-top:4px">Se muestran solo disponibilidades con <strong>saldo &gt; 0</strong> respetando los filtros de la parte superior.</div>'
        +'<div class="row" style="margin-top:10px">'
          +'<div style="min-height:320px">'
            +'<div class="cal-list" id="calLots"></div>'
          +'</div>'
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

    var selectedId = null, selectedSaldo = 0;

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
      selectedId = L.id;
      selectedSaldo = Number(L.saldo||0);
      // marcar selección
      [].slice.call(lotsWrap.querySelectorAll('.lot')).forEach(function(n){n.classList.remove('sel');});
      t.classList.add('sel');
      tip.textContent = 'Saldo disponible: '+numeroCL(selectedSaldo)+' t';
      doBtn.disabled = !(selectedId && Number(qtyInp.value||0)>0);
    });

    qtyInp.addEventListener('input', function(){
      var v = Math.max(0, Number(qtyInp.value||0));
      if (selectedSaldo>0 && v>selectedSaldo){
        v = selectedSaldo;
        qtyInp.value = String(v);
      }
      doBtn.disabled = !(selectedId && v>0);
    });

    closeBtn.addEventListener('click', function(){ document.body.removeChild(host); });

    doBtn.addEventListener('click', function(){
      var cant = Number(qtyInp.value||0);
      if (!selectedId || !(cant>0)) return;
      var payload = {
        disponibilidadId: selectedId,
        cantidad: cant,
        destMes: m,
        destAnio: y,
        // Extensión opcional para vista calendario:
        destDia: day,
        destFecha: new Date(y, m-1, day).toISOString()
      };
      global.MMppApi.crearAsignacion(payload).then(function(){
        // recargar datos y redibujar
        return loadData().then(function(){
          document.body.removeChild(host);
          refresh();
        });
      });
    });
  }

  // --- Eventos top ---
  function attachEvents(root){
    root.querySelector('#calPrev').addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()-1, 1);
      refresh();
    });
    root.querySelector('#calNext').addEventListener('click', function(){
      STATE.current = new Date(STATE.current.getFullYear(), STATE.current.getMonth()+1, 1);
      refresh();
    });

    // Ton / Camiones
    var tabsU = root.querySelector('#calUnits');
    tabsU.addEventListener('click', function(ev){
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var u = t.getAttribute('data-u');
      if (!u) return;
      STATE.view = u;
      [].slice.call(tabsU.querySelectorAll('.cal-tab')).forEach(function(n){n.classList.remove('on');});
      t.classList.add('on');
      refresh();
    });

    // Proveedor/Comuna (grupo visual – hoy no cambia el grid; se deja para extender)
    var tabsG = root.querySelector('#calGroup');
    tabsG.addEventListener('click', function(ev){
      var t = ev.target, g = t && t.getAttribute('data-g');
      if (!g) return;
      [].slice.call(tabsG.querySelectorAll('.cal-tab')).forEach(function(n){n.classList.remove('on');});
      t.classList.add('on');
    });

    root.querySelector('#calComuna').addEventListener('change', function(e){
      STATE.filters.comuna = e.target.value || '';
      refresh();
    });
    root.querySelector('#calProv').addEventListener('change', function(e){
      STATE.filters.proveedor = e.target.value || '';
      refresh();
    });
    root.querySelector('#calClear').addEventListener('click', function(){
      STATE.filters.comuna = '';
      STATE.filters.proveedor = '';
      fillFilterSelects();
      refresh();
    });
  }

  // --- Carga de datos ---
  function loadData(){
    var api = global.MMppApi || null;
    if (!api) return Promise.resolve();

    // pedimos un rango amplio (tu MMppApi ya lo hace por defecto)
    return Promise.all([
      api.getDisponibilidades().then(function(d){ STATE.dispon = Array.isArray(d)?d:[]; }),
      api.getAsignaciones().then(function(a){ STATE.asig = Array.isArray(a)?a:[]; })
    ]);
  }

  // --- render principal ---
  function refresh(){
    renderMonthLabel();
    fillFilterSelects();
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
