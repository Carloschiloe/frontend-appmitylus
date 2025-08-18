// =============== CONFIG INICIAL ===============
const API_URL = 'https://backend-appmitylus-production.up.railway.app/api';

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const currentYear = 2025;
const lockUntilMonth2025 = 8;

const SIMPLE_PASS = '1234'; // cámbiala si quieres

const elCards = document.getElementById('cards');
const elAnio  = document.getElementById('anio');

let chart, cacheSummary, lastClickedMonth = null;
let ctxAction = { anio:null, mes:null };

// --- PREDECLARACIONES para evitar TDZ ---
let cardMenuEl = null;
let cardMenuCtx = { anchor:null, anio:null, mes:null };

let popEl = null;
let popCtx = { anchor:null, mes:null, anio:null };

// =============== HELPERS HTTP ===============
async function checkResponse(resp){
  if (!resp.ok) {
    const txt = await resp.text().catch(()=> '');
    throw new Error(`HTTP ${resp.status} - ${txt}`);
  }
  if (resp.status === 204) return null;
  return await resp.json().catch(()=> null);
}
async function apiGet(path){ const r = await fetch(`${API_URL}${path}`); return checkResponse(r); }

// =============== ESTILOS DEL MODAL (para que no se corte) ===============
function injectModalStyles(){
  const old = document.getElementById('asig-modal-styles');
  if (old) return;

  const style = document.createElement('style');
  style.id = 'asig-modal-styles';
  style.textContent = `
    #mask{
      position: fixed; inset: 0;
      background: rgba(0,0,0,.35);
      display: none;
      z-index: 2147482900;
    }
    .modal-overlay{ z-index: 2147482800 !important; }

    .asig-modal{
      position: fixed; inset: 0;
      display: none;
      align-items: center; justify-content: center;
      padding: 12px;
      z-index: 2147483000;
    }
    .asig-modal__box{
      background:#fff; border-radius:12px;
      width: min(780px, 94vw);
      max-height: 90vh;
      box-shadow: 0 10px 30px rgba(0,0,0,.15);
      display: flex; flex-direction: column;
    }
    .asig-modal__header{
      display:flex; align-items:center; justify-content:space-between;
      gap:8px; padding:16px 20px; border-bottom:1px solid #eef1f3;
      position: sticky; top:0; background:#fff; z-index:1;
    }
    .asig-modal__header h3{ margin:0; font-size:1.35rem; color:#0d6b63; }
    .asig-modal__header .x{ border:0; background:#eef3f2; width:32px; height:32px; border-radius:8px; font-size:18px; cursor:pointer; }

    .asig-modal .content{ padding:14px 20px; overflow:auto; }
    .asig-modal__footer{
      padding:12px 20px; border-top:1px solid #eef1f3;
      display:flex; justify-content:flex-end; gap:10px;
      position: sticky; bottom:0; background:#fff;
    }
    .asig-modal .row{ display:flex; flex-direction:column; gap:6px; margin:8px 0; }
    .asig-modal input, .asig-modal select{
      width:100%; padding:10px 12px; border:1px solid #dfe4e6; border-radius:8px; outline:none;
    }
    .asig-modal input:focus, .asig-modal select:focus{
      border-color:#26a69a; box-shadow:0 0 0 3px rgba(38,166,154,.15);
    }
    .asig-modal__footer .ok{
      background:#26a69a; color:#fff; border:0; padding:10px 16px; border-radius:8px; cursor:pointer;
    }
    .asig-modal__footer button{ border:1px solid #cfd8dc; background:#fff; padding:10px 16px; border-radius:8px; cursor:pointer; }
  `;
  document.head.appendChild(style);
}

// =============== ARRANQUE ===============
init();
async function init(){
  injectModalStyles();
  ensureAuxUIs();
  ensureReqModal();
  ensureCardMenu();
  ensurePopover();

  const years = [2025,2026,2027,2028,2029];
  elAnio.innerHTML = years.map(y=>`<option ${y===currentYear?'selected':''}>${y}</option>`).join('');
  await loadYear(currentYear);

  elAnio.onchange = async (e)=> loadYear(+e.target.value);

  // cerrar con ESC o click en máscara
  document.addEventListener('keydown', (ev)=>{
    if(ev.key === 'Escape') { hideModal(); hideCardMenu(); hidePass(); hideProvidersPopover(); }
  });
  const mask = document.getElementById('mask');
  mask?.addEventListener('click', (ev)=>{ if(ev.target === mask) hideModal(); });

  // Week-picker reactivo
  const anioIn = document.getElementById('mProcAnio');
  const mesIn  = document.getElementById('mProcMes');
  if (anioIn && mesIn) {
    anioIn.addEventListener('input', ()=> {
      const y = +anioIn.value || currentYear;
      const m = clampMes(+mesIn.value);
      renderWeekPicker(y, m, +document.getElementById('mProcWk').value || 1);
    });
    mesIn.addEventListener('input', ()=> {
      const y = +anioIn.value || currentYear;
      const m = clampMes(+mesIn.value);
      renderWeekPicker(y, m, +document.getElementById('mProcWk').value || 1);
    });
  }
}

// =============== ENDPOINTS REALES (lecturas) ===============
async function fetchSummaryMensual(anio){
  // 1) Asignado
  const asignado = Array(12).fill(0);
  try{
    const arr = await apiGet(`/asignaciones/map?from=${anio}-01&to=${anio}-12`);
    const rows = Array.isArray(arr) ? arr : (arr?.items || []);
    for(const it of rows){
      const k = it.mesKey || it.key;
      if(!k || !/^\d{4}-\d{2}$/.test(k)) continue;
      const m = Number(k.slice(5,7)) - 1;
      const val = Number(it.asignado ?? it.total ?? it.tons ?? 0);
      if(m>=0 && m<12 && Number.isFinite(val)) asignado[m] += val;
    }
  }catch(e){ console.warn('[asignaciones/map]', e.message); }

  // 2) Requerido
  const requerido = Array(12).fill(0);
  try{
    const json = await apiGet('/planificacion/mes');
    const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
    for (const it of items) {
      const mk = String(it.mesKey || '');
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const y = Number(mk.slice(0,4));
      const m = Number(mk.slice(5,7)) - 1; // 0..11
      if (y !== anio || m<0 || m>11) continue;
      const tons = Number(it.tons ?? 0);
      if (Number.isFinite(tons)) requerido[m] += tons;
    }
  }catch(e){ console.warn('[planificacion/mes]', e.message); }

  // 3) Procesado (si aún no lo conectas, queda en 0)
  const procesado = Array(12).fill(0);

  return { anio, requerido, asignado, procesado };
}

// === DETALLE DE PROVEEDORES (asignaciones -> fallback ofertas) ===
// === DETALLE DE PROVEEDORES (desde ASIGNACIONES del mes) ===
async function fetchProveedoresMes(anio, mes1a12){
  try{
    const mk = `${anio}-${String(mes1a12).padStart(2,'0')}`;
    const json = await apiGet(`/asignaciones?from=${mk}&to=${mk}`);
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.map(it => ({
      proveedor: it.proveedorNombre || it.proveedor || '(s/empresa)',
      comuna:    it.comuna || '',
      tons:      Number(it.tons) || 0,
      cod:       it.centroCodigo || '',                // ← Cod.Centro
      area:      it.areaCodigo || it.area || ''        // ← Área (fallback)
    })).sort((a,b)=> b.tons - a.tons);
  }catch(e){
    console.warn('[fetchProveedoresMes]', e.message);
    return [];
  }
}

  // 2) Fallback: ofertas (contactos/visitas) para ese mes
  try{
    const json = await apiGet('/planificacion/ofertas');
    const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
    return items
      .filter(it=>{
        const d = new Date(it.mes || it.fecha || it.mesKey || '');
        return !isNaN(d.getTime()) && d.getFullYear() === anio && (d.getMonth()+1) === mes1a12;
      })
      .map(it=>({
        proveedor: it.proveedorNombre || '(s/empresa)',
        comuna: it.comuna || it.centroComuna || '',
        tons: Number(it.tons) || 0,
        cod: it.centroCodigo || '',
        area: it.area || it.areaCodigo || '',
        contactId: it.contactId || it.contactoId || it.proveedorKey || ''
      }))
      .sort((a,b)=> b.tons - a.tons);
  }catch(e){ console.warn('[ofertas]', e.message); }

  return [];
}

async function fetchProveedoresDisponiblesDesde(anio, mes){
  return fetchProveedoresMes(anio, mes);
}

// =============== (Opcionales aún) Guardados de otros flujos ===============
async function putDisponibilidad(payload){ console.log('[PUT disponibilidad] (no-op)', payload); alert('Disponibilidad guardada (demo)'); }
async function putProcesado(payload){ console.log('[PUT procesado semanal] (no-op)', payload); alert('Procesado guardado (demo)'); }

// =============== CARGA AÑO ===============
async function loadYear(y){
  cacheSummary = await fetchSummaryMensual(y);
  paintCards(y, cacheSummary);
  paintChart(cacheSummary);
}

// Helpers resumen
function yearTotals(data){
  const tReq = data.requerido.reduce((a,b)=>a+(+b||0),0);
  const tAsg = data.asignado.reduce((a,b)=>a+(+b||0),0);
  const tPro = data.procesado.reduce((a,b)=>a+(+b||0),0);
  const pctReal = tReq>0 ? Math.round((tPro/tReq)*100) : 0;
  const pctAsig = tReq>0 ? Math.round((tAsg/tReq)*100) : 0;
  return {tReq,tAsg,tPro,pctReal,pctAsig};
}

// =============== TARJETAS ===============
function paintCards(anio, data){
  elCards.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid';

  for(let m=1; m<=12; m++){
    if(anio===2025 && m <= lockUntilMonth2025) continue;

    const i = m-1;
    const req  = +data.requerido[i] || 0;
    const asg  = +data.asignado[i]  || 0;
    const real = +data.procesado[i] || 0;

    const safeReq = req>0 ? req : 1;
    const pctAsig = Math.min(100, Math.round((asg/safeReq)*100));
    const pctReal = Math.min(100, Math.round((real/safeReq)*100));

    const card = document.createElement('div');
    card.className = 'card card--mock';
    if(req === 0){ card.classList.add('zero'); }
    else if(asg >= req){ card.classList.add('full'); }
    else { card.classList.add('need'); }

    card.dataset.m = m;

    card.innerHTML = `
      <div class="month-pill" style="--asg:${pctAsig}">
        <span>${MES_LABELS[i].toUpperCase()} ${anio}</span>
      </div>
      <div class="pane">
        <div class="tons-title">TONS REQ</div>
        <div class="tons-value">${fmt(req)}</div>

        <div class="stats">
          <div class="stat">
            <span class="dot dot-proc"></span><span class="label">Real</span>
            <span>${fmt(real)}</span><span class="unit">t</span>
            <span class="pct">${pctReal}%</span>
          </div>
          <div class="stat">
            <span class="dot dot-asg"></span><span class="label">Asig</span>
            <span>${fmt(asg)}</span><span class="unit">t</span>
            <span class="pct">${pctAsig}%</span>
          </div>
          ${asg < req ? `<div class="stat stat-missing">Faltan <span>${fmt(req - asg)}</span> <span class="unit">t</span></div>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      lastClickedMonth = m;
      openCardMenu(card, m, anio);
    });

    grid.appendChild(card);
  }

  const ysum = yearTotals(data);
  const cardY = document.createElement('div');
  cardY.className = 'card card--summary';
  cardY.innerHTML = `
    <div class="month-pill"><span>CONSOLIDADO ${anio}</span></div>
    <div class="pane">
      <div class="tons-title">TOTAL REQUERIDO</div>
      <div class="tons-value">${fmt(ysum.tReq)}</div>

      <div class="stats">
        <div class="stat">
          <span class="dot dot-proc"></span><span class="label">Real</span>
          <span>${fmt(ysum.tPro)}</span><span class="unit">t</span>
          <span class="pct">${ysum.pctReal}%</span>
        </div>
        <div class="stat">
          <span class="dot dot-asg"></span><span class="label">Asig</span>
          <span>${fmt(ysum.tAsg)}</span><span class="unit">t</span>
          <span class="pct">${ysum.pctAsig}%</span>
        </div>
      </div>
    </div>
  `;
  grid.appendChild(cardY);
  elCards.appendChild(grid);
}

// =============== CHART ===============
function paintChart(data){
  const ctx = document.getElementById('chartMensual');
  chart?.destroy();
  chart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: MES_LABELS,
      datasets:[
        {label:'Requerido (t)', data:data.requerido, stack:'s', borderWidth:1},
        {label:'Asignado (t)',  data:data.asignado,  stack:'s', borderWidth:1},
        {label:'Procesado (t)', data:data.procesado, stack:'s', borderWidth:1}
      ]
    },
    options:{
      responsive:true,
      onClick:(e,els)=>{
        if(!els?.length) return;
        const idx = els[0].index; const mes = idx+1;
        const year = +elAnio.value;
        if(year===2025 && mes <= lockUntilMonth2025) return;
        const card = elCards.querySelector(`.card[data-m="${mes}"]`);
        if(card) openCardMenu(card, mes, year);
      },
      scales:{ x:{stacked:true}, y:{stacked:true, beginAtZero:true, title:{display:true,text:'Toneladas'}}},
      plugins:{ legend:{position:'bottom'}, tooltip:{mode:'index',intersect:false}}
    }
  });
}

// =============== DRAWER (proveedores del mes) ===============
async function showDrawer(mes, anio){
  document.getElementById('drawerTitle').textContent = `${MES_LABELS[mes-1]} ${anio} · Proveedores`;
  const rows = await fetchProveedoresMes(anio, mes);
  const tbody = document.getElementById('provRows');
  tbody.innerHTML = rows.map(r=>`<tr>
    <td>${esc(r.proveedor)}</td>
    <td>${esc(r.comuna)}</td>
    <td class="text-right">${fmt(r.tons)}</td>
    <td>${esc(r.cod)}</td>
  </tr>`).join('');
  document.getElementById('drawer').style.display='block';
}
function closeDrawer(){ document.getElementById('drawer').style.display='none' }

// =============== MODALES base ===============
const mask = document.getElementById('mask');

function showModal(id){
  const modal = document.getElementById(id);
  mask.style.display = 'block';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modal.setAttribute('aria-hidden','false');
  modal.setAttribute('aria-modal','true');
  mask.setAttribute('aria-hidden','false');
  setTimeout(()=>{
    const focusable = modal.querySelector('input,select,button,textarea');
    focusable?.focus();
  }, 0);
}
function hideModal(){
  mask.style.display = 'none';
  document.querySelectorAll('.asig-modal').forEach(m=>{
    m.style.display = 'none';
    m.setAttribute('aria-hidden','true');
    m.removeAttribute('aria-modal');
  });
  document.body.style.overflow = '';
  mask.setAttribute('aria-hidden','true');
}

// Guardados (otros)
async function saveDisponibilidad(){
  const payload = {
    anio: +document.getElementById('mDispAnio').value,
    mes:  +document.getElementById('mDispMes').value,
    contactId: (document.getElementById('mDispProvSel')?.value || document.getElementById('mDispProv').value).trim(),
    materiaPrima: document.getElementById('mDispMP').value.trim(),
    stockInicialTons: +document.getElementById('mDispStock').value
  };
  await putDisponibilidad(payload);
  hideModal();
  await loadYear(+elAnio.value);
}
async function saveProcesado(){
  const payload = {
    anio:+document.getElementById('mProcAnio').value,
    mes:+document.getElementById('mProcMes').value,
    semanaISO:+document.getElementById('mProcWk').value,
    materiaPrima:document.getElementById('mProcMP').value.trim(),
    kilos:+document.getElementById('mProcKg').value
  };
  await putProcesado(payload);
  hideModal();
  await loadYear(+elAnio.value);
}

// =============== Password simple ===============
function ensureAuxUIs(){
  if(document.getElementById('asigPass')) return;
  const wrap = document.createElement('div');
  wrap.id = 'asigPass';
  wrap.className = 'asig-pass';
  wrap.innerHTML = `
    <div class="backdrop" onclick="hidePass()"></div>
    <div class="sheet">
      <h4>Confirmación</h4>
      <p style="margin:.25rem 0 .6rem;color:#444">Ingresa tu contraseña para continuar.</p>
      <div class="row"><input id="asigPassInput" type="password" placeholder="Contraseña" /></div>
      <div class="actions">
        <button onclick="hidePass()">Cancelar</button>
        <button class="ok" id="asigPassOk">Aceptar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  document.getElementById('asigPassOk').onclick = ()=>{
    const ok = document.getElementById('asigPassInput').value === SIMPLE_PASS;
    wrap.dataset.result = ok ? 'ok':'fail';
    hidePass();
  };
}
function askPassword(){
  return new Promise(resolve=>{
    const pass = document.getElementById('asigPass');
    pass.style.display = 'flex';
    pass.dataset.result = '';
    const input = document.getElementById('asigPassInput');
    input.value=''; setTimeout(()=>input.focus(), 50);

    const obs = new MutationObserver(()=>{
      if(pass.style.display==='none'){
        obs.disconnect();
        resolve(pass.dataset.result==='ok');
      }
    });
    obs.observe(pass, {attributes:true, attributeFilter:['style']});
  });
}
function hidePass(){ document.getElementById('asigPass').style.display='none' }

// =============== MODAL: Definir Requerido (MMPP) ===============
function ensureReqModal(){
  let modal = document.getElementById('modalReq');

  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modalReq';
    modal.className = 'asig-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = `
      <div class="asig-modal__box">
        <header class="asig-modal__header">
          <h3>Definir Requerido (MMPP)</h3>
          <button class="x" onclick="hideModal()">×</button>
        </header>
        <div class="content">
          <div class="row"><label>Año</label><input id="mReqAnio" type="number" min="2024" step="1" /></div>
          <div class="row"><label>Mes</label><input id="mReqMes" type="number" min="1" max="12" step="1" /></div>
          <div class="row"><label>Materia prima</label><input id="mReqMP" type="text" placeholder="p. ej. MMPP genérica" /></div>
          <div class="row"><label>Tons requeridas</label><input id="mReqTons" type="number" step="0.01" min="0" /></div>
        </div>
        <footer class="asig-modal__footer">
          <button onclick="hideModal()">Cancelar</button>
          <button class="ok" id="mReqSave">Guardar</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const btn = document.getElementById('mReqSave');
  if (btn) btn.onclick = saveRequerido;
}

async function putRequeridoMensual(payload){
  const body = {
    mesKey: payload.mesKey || `${payload.anio}-${String(payload.mes).padStart(2,'0')}`,
    anio: payload.anio, mes: payload.mes,
    materiaPrima: payload.materiaPrima || '',
    tons: Number(payload.tons)||0
  };
  const resp = await fetch(`${API_URL}/planificacion/mes`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  return checkResponse(resp);
}

async function saveRequerido(){
  const anio = +document.getElementById('mReqAnio').value;
  const mes  = Math.min(12, Math.max(1, +document.getElementById('mReqMes').value||1));
  const mp   = (document.getElementById('mReqMP').value||'').trim();
  const tons = +document.getElementById('mReqTons').value;

  if(!anio || !mes || !Number.isFinite(tons) || tons<0){
    alert('Completa Año, Mes y toneladas válidas');
    return;
  }
  try{
    await putRequeridoMensual({ anio, mes, materiaPrima: mp, tons });
    hideModal();
    await loadYear(+elAnio.value);
  }catch(e){
    console.error(e);
    alert('No se pudo guardar el Requerido');
  }
}

// =============== MENÚ CONTEXTUAL anclado a tarjeta ===============
function ensureCardMenu(){
  if(cardMenuEl) return;
  cardMenuEl = document.createElement('div');
  cardMenuEl.id = 'asigCardMenu';
  cardMenuEl.className = 'asig-card-menu';
  cardMenuEl.innerHTML = `
    <button data-act="requerido">Definir Requerido</button>
    <button data-act="asignar">Asignar MMPP</button>
    <button data-act="producir">Registrar Prod. Planta</button>
    <button data-act="ver">Ver proveedores</button>
  `;
  document.body.appendChild(cardMenuEl);

  cardMenuEl.addEventListener('click', async (e)=>{
    const act = e.target?.dataset?.act;
    if(!act) return;
    const {anio, mes, anchor} = cardMenuCtx;

    if(act==='ver'){
      hideCardMenu();
      openProvidersPopover(mes, anio, anchor);
      return;
    }

    hideCardMenu();
    const ok = await askPassword();
    if(!ok) return;

    if(act==='requerido'){
      document.getElementById('mReqAnio').value = anio;
      document.getElementById('mReqMes').value  = mes;
      const i = mes-1;
      document.getElementById('mReqTons').value = (cacheSummary?.requerido?.[i] || 0);
      document.getElementById('mReqMP').value = '';
      showModal('modalReq');
      return;
    }

    if(act==='asignar'){
      document.getElementById('mDispAnio').value = anio;
      document.getElementById('mDispMes').value  = mes;
      await injectProveedorSelector(anio, mes);
      showModal('modalDisp');
    } else if(act==='producir'){
      document.getElementById('mProcAnio').value = anio;
      document.getElementById('mProcMes').value  = mes;
      const defW = defaultWeekFor(anio, mes);
      document.getElementById('mProcWk').value = defW;
      showModal('modalProc');
      renderWeekPicker(anio, mes, defW);
    }
  });

  document.addEventListener('click', (ev)=>{
    if(!cardMenuEl) return;
    if(cardMenuEl.style.display!=='block') return;
    if(!cardMenuEl.contains(ev.target) && !ev.target.closest('.card--mock')) hideCardMenu();
  });
  window.addEventListener('resize', ()=>{ if(cardMenuEl.style.display==='block') positionCardMenu(); });
  window.addEventListener('scroll', ()=>{ if(cardMenuEl.style.display==='block') positionCardMenu(); }, true);
}
function openCardMenu(anchor, mes, anio){
  cardMenuCtx = { anchor, mes, anio };
  cardMenuEl.style.display = 'block';
  requestAnimationFrame(positionCardMenu);
}
function positionCardMenu(){
  if(!cardMenuEl || !cardMenuCtx.anchor) return;
  const r = cardMenuCtx.anchor.getBoundingClientRect();
  const menuW = cardMenuEl.offsetWidth || 260;

  let left = r.right + window.scrollX + 8;
  const rightLimit = window.scrollX + window.innerWidth - 8;
  if (left + menuW > rightLimit) left = Math.max(window.scrollX + 8, r.left + window.scrollX - menuW - 8);

  const top = r.top + window.scrollY + 8;

  cardMenuEl.style.left = `${left}px`;
  cardMenuEl.style.top  = `${top}px`;
}
function hideCardMenu(){ if(cardMenuEl) cardMenuEl.style.display='none'; }

// =============== POPUP PROVEEDORES anclado a tarjeta ===============
function ensurePopover(){
  if(popEl) return popEl;
  popEl = document.createElement('div');
  popEl.className = 'asig-pop';
  popEl.innerHTML = `
    <header>
      <div id="popTitle">Mes · Proveedores</div>
      <button class="x" onclick="hideProvidersPopover()">×</button>
    </header>
    <div class="body">
      <table>
        <thead>
          <tr><th>Proveedor</th><th>Comuna</th><th>Tons</th><th>Cod.Centro</th><th>Área</th></tr>
        </thead>
        <tbody id="popRows"></tbody>
      </table>
    </div>
  `;
  document.body.appendChild(popEl);

  document.addEventListener('click', (e)=>{
    if(popEl.style.display!=='block') return;
    if(!popEl.contains(e.target) && !e.target.closest('.card--mock')) hideProvidersPopover();
  });
  window.addEventListener('scroll', ()=>{ if(popEl.style.display==='block') repositionPopover(); }, true);
  window.addEventListener('resize', ()=>{ if(popEl.style.display==='block') repositionPopover(); }, true);
  return popEl;
}
function repositionPopover(){
  if(!popEl || !popCtx.anchor) return;
  const r = popCtx.anchor.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 8;
  let left = r.left + window.scrollX;
  const maxLeft = window.scrollX + (window.innerWidth - popEl.offsetWidth - 8);
  if(left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
  popEl.style.top = `${top}px`;
  popEl.style.left = `${left}px`;
}
async function openProvidersPopover(mes, anio, anchorEl){
  popCtx = {anchor:anchorEl, mes, anio};
  document.getElementById('popTitle').textContent = `${MES_LABELS[mes-1]} ${anio} · Proveedores`;
  const rows = await fetchProveedoresMes(anio, mes);
  const tbody = document.getElementById('popRows');
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${esc(r.proveedor)}</td>
      <td>${esc(r.comuna)}</td>
      <td class="text-right">${fmt(r.tons)}</td>
      <td>${esc(r.cod)}</td>
      <td>${esc(r.area || '')}</td>
    </tr>
  `).join('');
  popEl.style.display = 'block';
  repositionPopover();
}
function hideProvidersPopover(){ if(popEl) popEl.style.display = 'none'; }

// =============== WEEK PICKER ===============
function clampMes(m){ return Math.min(12, Math.max(1, +m || 1)); }
function daysInMonth(y, m){ return new Date(y, m, 0).getDate(); } // m: 1-12
function defaultWeekFor(y, m){
  const now = new Date();
  if(now.getFullYear()===y && (now.getMonth()+1)===m){
    return Math.max(1, Math.ceil(now.getDate()/7));
  }
  return 1;
}
function renderWeekPicker(y, m, selectedWeek=1){
  const host = document.getElementById('weekPicker');
  if(!host) return;

  const n = daysInMonth(y, m);
  const weeks = Math.ceil(n/7);

  const styles = `
    <style>
      .wk-table{width:100%;border-collapse:collapse;margin:.25rem 0;}
      .wk-table th,.wk-table td{padding:6px 8px;border-bottom:1px solid #eef1f3;text-align:center}
      .wk-table th:first-child,.wk-table td:first-child{width:52px;color:#555}
      .wk-row{cursor:pointer}
      .wk-row:hover{background:#f6fbfa}
      .wk-row.selected{background:#eaf6ff}
      .wk-head{color:#0f1e1d;font-weight:700}
      .wk-cap{font-weight:700;text-align:center;padding:6px 0;color:#0f1e1d}
    </style>
  `;

  let html = `${styles}
  <div class="wk-cap">${MES_LABELS[m-1].toUpperCase()} ${y}</div>
  <table class="wk-table">
    <thead><tr class="wk-head"><th>SEM</th>${Array.from({length:7},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead>
    <tbody>`;

  for(let w=1; w<=weeks; w++){
    const start = (w-1)*7 + 1;
    const end = Math.min(w*7, n);
    html += `<tr class="wk-row ${w===selectedWeek?'selected':''}" data-w="${w}"><td>${w}</td>`;
    for(let d=start; d<=end; d++) html += `<td>${d}</td>`;
    for(let k=0; k<7-(end-start+1); k++) html += `<td></td>`;
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  host.innerHTML = html;

  host.querySelectorAll('.wk-row').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      const w = +tr.dataset.w;
      host.querySelectorAll('.wk-row').forEach(r=>r.classList.remove('selected'));
      tr.classList.add('selected');
      const wkInput = document.getElementById('mProcWk');
      if(wkInput){ wkInput.value = w; }
    });
  });
}

// =============== SELECTOR DE PROVEEDORES para modal ===============
async function injectProveedorSelector(anio, mes){
  const modal = document.getElementById('modalDisp');
  let slot = modal.querySelector('#provPickerSlot');
  if(!slot){
    slot = document.createElement('div');
    slot.id='provPickerSlot';
    slot.className='mt-2';
    modal.querySelector('.content')?.prepend(slot);
  }
  const rows = await fetchProveedoresDisponiblesDesde(anio, mes);
  if(!rows.length){
    slot.innerHTML = `<div class="text-soft" style="margin-bottom:8px">No hay proveedores con disponibilidad desde ${MES_LABELS[mes-1]} ${anio}.</div>`;
    return;
  }
  const opts = rows.map(r=>`<option value="${esc(r.contactId)}">${esc(r.proveedor)} — ${esc(r.comuna)} • ${esc(r.cod)} • ${fmt(r.tons)} t disp.</option>`).join('');
  slot.innerHTML = `
    <label style="font-weight:700">Proveedor disponible</label>
    <select id="mDispProvSel" class="modern-select" style="margin:4px 0 8px">${opts}</select>
  `;
}

// =============== UTILS ===============
function fmt(n){ return (n||0).toLocaleString('es-CL',{maximumFractionDigits:1}) }
function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

