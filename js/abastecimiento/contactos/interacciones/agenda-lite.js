// /js/abastecimiento/contactos/interacciones/agenda-lite.js
// Calendario simple de INTERACCIONES (solo lectura)

(function injectStyles(){
  if (document.getElementById('int-cal-styles')) return;
  const css = `
#int-cal { --b:#e5e7eb; --mut:#6b7280; --pill:#eef2ff; }
#int-cal .cal-wrap{ border:1px solid var(--b); border-radius:16px; padding:12px; }
#int-cal .cal-toolbar{ display:flex; align-items:center; justify-content:space-between; margin:6px 4px 12px; }
#int-cal .cal-toolbar h5{ margin:0; font-weight:700; }
#int-cal .nav-btn{ display:inline-flex; width:36px; height:36px; border:1px solid var(--b); border-radius:10px; align-items:center; justify-content:center; background:#fff; }
#int-cal .days-hdr{ display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin:6px 0 8px; }
#int-cal .days-hdr div{ text-align:center; font-weight:700; color:#334155; background:#f8fafc; border:1px solid var(--b); padding:8px 0; border-radius:12px; }
#int-cal .grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:8px; }
#int-cal .day{ min-height:120px; background:#fff; border:1px solid var(--b); border-radius:14px; padding:8px; display:flex; flex-direction:column; }
#int-cal .day .dtop{ display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
#int-cal .day .num{ font-weight:700; color:#0f172a; }
#int-cal .day .sum{ font-size:12px; color:var(--mut); }
#int-cal .list{ display:flex; flex-direction:column; gap:6px; }
#int-cal .card{ border:1px solid var(--b); border-radius:12px; padding:8px 10px; background:#fff; box-shadow:0 1px 4px rgba(2,6,23,.05); }
#int-cal .card .row1{ display:flex; gap:8px; align-items:center; margin-bottom:2px; }
#int-cal .icon{ width:20px; height:20px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; background:var(--pill); font-size:14px; }
#int-cal .ppaso{ font-weight:600; }
#int-cal .sub{ color:#6b7280; font-size:12px; line-height:1.25; }
#int-cal .badges{ display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
#int-cal .badge{ font-size:11px; padding:2px 6px; border-radius:999px; border:1px solid var(--b); background:#f8fafc; }
#int-cal .more{ margin-top:4px; }
#int-cal .more a{ font-size:12px; }
  `;
  const s = document.createElement('style');
  s.id = 'int-cal-styles';
  s.textContent = css;
  document.head.appendChild(s);
})();

export function mountAgendaLite(containerEl, interacciones){
  containerEl.innerHTML = `
    <div id="int-cal">
      <div class="cal-wrap">
        <div class="cal-toolbar">
          <h5>Calendario de actividades (Interacciones)</h5>
          <div>
            <button class="nav-btn" id="intCalPrev" aria-label="Mes anterior">‹</button>
            <span id="intCalTitle" style="font-weight:700; margin:0 10px;"></span>
            <button class="nav-btn" id="intCalNext" aria-label="Mes siguiente">›</button>
          </div>
        </div>
        <div class="days-hdr" id="intCalHdr"></div>
        <div class="grid" id="intCalGrid"></div>
      </div>
    </div>
  `;
  console.log('[int/agenda-lite] mount');

  const state = {
    baseDate: inferMonthFromData(interacciones) || new Date(),
    items: (interacciones || []).filter(i => !!(i && (i.fechaProx || i.proximoPasoFecha))),
    expanded: new Set(),
  };

  renderCalendar(containerEl, state);

  containerEl.querySelector('#intCalPrev')?.addEventListener('click', ()=>{
    state.baseDate = addMonths(state.baseDate, -1);
    renderCalendar(containerEl, state);
  });
  containerEl.querySelector('#intCalNext')?.addEventListener('click', ()=>{
    state.baseDate = addMonths(state.baseDate, +1);
    renderCalendar(containerEl, state);
  });
}

function renderCalendar(root, state){
  const title = root.querySelector('#intCalTitle');
  const hdr   = root.querySelector('#intCalHdr');
  const grid  = root.querySelector('#intCalGrid');

  const { weeks, monthLabel } = buildMonthMatrix(state.baseDate);
  title.textContent = monthLabel;
  hdr.innerHTML = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div>${d}</div>`).join('');

  const byDay = groupByDay(state.items);

  grid.innerHTML = weeks.map(week=>week.map(({ d, iso })=>{
    const list = byDay.get(iso) || [];
    const key = iso;
    const max = 4;
    const expanded = state.expanded.has(key);
    const visible = expanded ? list : list.slice(0, max);
    const moreN = Math.max(0, list.length - visible.length);

    return `
      <div class="day">
        <div class="dtop"><div class="num">${d}</div><div class="sum">${list.length? list.length+' act.':'—'}</div></div>
        <div class="list" data-day="${key}">
          ${visible.map(renderCard).join('')}
          ${moreN ? `<div class="more"><a href="#!" data-more="${key}">+ Ver ${moreN} más</a></div>` : ''}
        </div>
      </div>`;
  }).join('')).join('');

  grid.querySelectorAll('[data-more]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      state.expanded.add(a.getAttribute('data-more'));
      renderCalendar(root, state);
    });
  });
}

function renderCard(ev){
  const paso   = str(ev.proximoPaso || ev.tipo || 'Actividad');
  const fecha  = ev.fechaProx || ev.proximoPasoFecha;
  const fechaTxt = fmtDayTime(fecha);
  const contacto = str(ev.contactoNombre || ev.contacto || '');
  const prov     = str(ev.proveedorNombre || '');
  const resp     = str(ev.responsablePG || ev.responsable || '');
  const estado   = canonEstado(ev.estado);
  const tons     = numStr(ev.tonsConversadas);

  const icon = (() => {
    const p = paso.toLowerCase();
    if (p.includes('muestra'))   return '🧪';
    if (p.includes('reun'))      return '👥';
    if (p.includes('llama')||p.includes('tel')) return '📞';
    if (p.includes('visita'))    return '📍';
    if (p.includes('negoci'))    return '💬';
    if (p.includes('esperar'))   return '⏳';
    return '📌';
  })();

  return `
  <div class="card">
    <div class="row1"><span class="icon">${icon}</span><div class="ppaso">${esc(paso)}</div></div>
    <div class="sub">${fechaTxt ? esc(fechaTxt)+' · ' : ''}${contacto ? esc(contacto)+' · ' : ''}${esc(prov)}</div>
    <div class="badges">
      ${resp ? `<span class="badge" title="Responsable">${esc(resp)}</span>` : ''}
      ${estado ? `<span class="badge" title="Estado">${esc(estado)}</span>` : ''}
      ${tons ? `<span class="badge" title="Tons conversadas">${tons} t</span>` : ''}
    </div>
  </div>`;
}

/* utils */
function groupByDay(items){
  const m = new Map();
  items.forEach(i=>{
    const iso = toIso(i.fechaProx || i.proximoPasoFecha);
    if (!iso) return;
    if (!m.has(iso)) m.set(iso, []);
    m.get(iso).push(i);
  });
  for (const [,arr] of m){
    arr.sort((a,b)=>{
      const ta = timeVal(a.fechaProx||a.proximoPasoFecha);
      const tb = timeVal(b.fechaProx||b.proximoPasoFecha);
      if (ta !== tb) return ta - tb;
      return str(a.contactoNombre||'').localeCompare(str(b.contactoNombre||''),'es');
    });
  }
  return m;
}
function buildMonthMatrix(base){
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y,m,1);
  const start = startOfWeek(first);
  const end   = endOfWeek(new Date(y,m+1,0));
  const days=[];
  for (let d=new Date(start); d<=end; d=addDays(d,1)) days.push({ d:d.getDate(), iso: toIso(d) });
  const weeks=[]; for (let i=0;i<days.length;i+=7) weeks.push(days.slice(i,i+7));
  const monthLabel = first.toLocaleString('es-CL',{ month:'long', year:'numeric' }).toUpperCase();
  return { weeks, monthLabel };
}
function inferMonthFromData(items){
  const ds = (items||[]).map(i=>new Date(i.fechaProx||i.proximoPasoFecha)).filter(d=>!isNaN(d)).sort((a,b)=>a-b);
  return ds[0] || null;
}
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d){ const x=new Date(d); const w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); x.setHours(0,0,0,0); return x; }
function endOfWeek(d){ const x=new Date(d); const w=(x.getDay()+6)%7; x.setDate(x.getDate()+(6-w)); x.setHours(23,59,59,999); return x; }
function toIso(v){ const d=(v instanceof Date)?v:new Date(v); return isNaN(d)?'':d.toISOString().slice(0,10); }
function timeVal(v){ const s=String(v||''); const m=s.match(/(\d{1,2}):(\d{2})/); return m?Number(m[1])*60+Number(m[2]):24*60; }
function fmtDayTime(v){ if(!v) return ''; const d=new Date(v); if(isNaN(d)) return ''; return `${d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit'})} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`; }
function canonEstado(s){ const r=String(s||'').toLowerCase(); return r==='completado'?'hecho':r||''; }
function numStr(n){ const v=Number(n); return Number.isFinite(v)?v.toLocaleString('es-CL',{maximumFractionDigits:0}):''; }
function esc(s){ return String(s||'').replace(/[<&>]/g,c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }
function str(s){ return (s==null?'':String(s).trim()); }
