// js/abastecimiento/contactos/interacciones/agenda-lite.js
import { openInteraccionModal } from './modal.js';

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

function pad2(n){ return String(n).padStart(2,'0'); }
function esc(s){ return String(s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function injectStyles(){
  if (document.getElementById('agenda-lite-css')) return;
  const css = `
  .ag-wrap{max-width:1100px;margin:0 auto}
  .ag-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(17,24,39,.06);padding:16px}
  .ag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .ag-title{font-weight:800;color:#1f2937;font-size:22px}
  .ag-monthgrp{display:flex;align-items:center;gap:8px}
  .ag-btn{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;height:32px;padding:0 10px;cursor:pointer;font-weight:700}
  .ag-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
  .ag-dayname{padding:8px;text-align:center;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;font-weight:800;color:#64748b}
  .ag-cell{min-height:120px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;display:flex;flex-direction:column;gap:6px;padding:6px}
  .ag-cell.off{background:#f9fafb;color:#9ca3af}
  .ag-date{font-weight:800;color:#374151;display:flex;align-items:center;justify-content:space-between}
  .ag-empty{color:#6b7280;font-size:12px}
  .ag-ev{border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:6px;display:flex;gap:6px;align-items:flex-start}
  .ag-ev .ico{font-size:16px}
  .ag-ev .body{display:flex;flex-direction:column;min-width:0}
  .ag-ev .ttl{font-weight:700;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ag-ev .meta{font-size:12px;color:#6b7280}
  .ag-empty-month{padding:12px;border:1px dashed #e5e7eb;border-radius:12px;text-align:center;color:#6b7280}
  @media (max-width: 720px){ .ag-grid{gap:6px} .ag-cell{min-height:100px} }
  `;
  const s=document.createElement('style'); s.id='agenda-lite-css'; s.textContent=css; document.head.appendChild(s);
}

function iconFor(tipo){
  const t = String(tipo||'').toLowerCase();
  if (t.includes('llam'))    return '📞';
  if (t.includes('muestra')) return '🧪';
  if (t.includes('reun'))    return '🤝';
  if (t.includes('visita'))  return '🗺️';
  if (t.includes('seguim'))  return '🔁';
  return '✅';
}

function monthLabel(d){ return `${MESES[d.getMonth()]} de ${d.getFullYear()}`; }

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){   return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }

function mondayIndex(jsDay){ return (jsDay + 6) % 7; } // 0..6 (0=Lun)

function groupByDay(items, current){
  const y=current.getFullYear(), m=current.getMonth();
  const groups = {};
  for (const it of (items||[])){
    const raw = it.proximoPasoFecha || it.fechaProx || it.fecha;
    if (!raw) continue;
    const d = new Date(raw);
    if (d.getFullYear()!==y || d.getMonth()!==m) continue;
    const day = d.getDate();
    (groups[day] ||= []).push({ d, it });
  }
  // ordenar por hora dentro del día
  for (const k of Object.keys(groups)) groups[k].sort((a,b)=>a.d-b.d);
  return groups;
}

function fmtTime(d){
  const h=pad2(d.getHours()), m=pad2(d.getMinutes());
  return `${h}:${m}`;
}

export function mountAgendaLite(hostEl, items = []){
  injectStyles();

  const state = { current: new Date() };
  render();

  function render(){
    hostEl.innerHTML = `
      <div class="ag-wrap">
        <div class="ag-card">
          <div class="ag-head">
            <div class="ag-title">📆 Calendario de Actividades</div>
            <div class="ag-monthgrp">
              <button class="ag-btn" id="ag-prev">←</button>
              <div id="ag-month" style="font-weight:800;color:#1e3a8a">${monthLabel(state.current)}</div>
              <button class="ag-btn" id="ag-next">→</button>
            </div>
          </div>

          <div class="ag-grid" id="ag-head"></div>
          <div class="ag-grid" id="ag-days"></div>

          <div id="ag-empty" class="ag-empty-month" style="display:none">No hay actividades para este mes.</div>
        </div>
      </div>
    `;

    // nombres de día
    const head = hostEl.querySelector('#ag-head');
    head.innerHTML = DIAS.map(n=>`<div class="ag-dayname">${n}</div>`).join('');

    // celdas del mes
    const cont = hostEl.querySelector('#ag-days');
    const first = startOfMonth(state.current);
    const last  = endOfMonth(state.current);
    const offset = mondayIndex(first.getDay());
    const dim = last.getDate();

    const grouped = groupByDay(items, state.current);

    const cells=[];
    for(let i=0;i<offset;i++) cells.push(`<div class="ag-cell off"></div>`);
    let totalEvents=0;

    for(let d=1; d<=dim; d++){
      const dayEvents = grouped[d] || [];
      totalEvents += dayEvents.length;
      const evHtml = dayEvents.map(({d:dt, it})=>{
        const t = iconFor(it.tipo || it.proximoPaso);
        const title = `${esc(it.contactoNombre || it.proveedorNombre || 'Contacto')}`;
        const meta =
          [fmtTime(dt),
           esc(it.proximoPaso || it.tipo || ''),
           it.proveedorNombre ? `· ${esc(it.proveedorNombre)}` : '']
          .filter(Boolean).join(' ');
        const eid = it._id || it.id || '';
        return `<div class="ag-ev" data-id="${esc(eid)}">
          <div class="ico">${t}</div>
          <div class="body">
            <div class="ttl">${title}</div>
            <div class="meta">${meta}</div>
          </div>
        </div>`;
      }).join('');

      cells.push(`
        <div class="ag-cell" data-day="${d}">
          <div class="ag-date"><span>${d}</span></div>
          ${evHtml || '<div class="ag-empty">—</div>'}
        </div>
      `);
    }
    cont.innerHTML = cells.join('');
    hostEl.querySelector('#ag-empty').style.display = totalEvents ? 'none' : 'block';

    // nav
    hostEl.querySelector('#ag-prev').onclick = ()=>{ state.current = new Date(state.current.getFullYear(), state.current.getMonth()-1, 1); render(); };
    hostEl.querySelector('#ag-next').onclick = ()=>{ state.current = new Date(state.current.getFullYear(), state.current.getMonth()+1, 1); render(); };

    // click en evento → abrir modal de edición (si está disponible)
    cont.addEventListener('click', (ev)=>{
      let t = ev.target;
      while(t && t!==cont && !t.classList.contains('ag-ev')) t = t.parentNode;
      if (!t || t===cont) return;
      const id = t.getAttribute('data-id');
      const found = (items||[]).find(x => String(x._id||x.id||'') === String(id));
      if (found) openInteraccionModal({ preset: found, onSaved: ()=>{} });
    });
  }
}
