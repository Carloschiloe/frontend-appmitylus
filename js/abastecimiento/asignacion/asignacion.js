// =============== CONFIG INICIAL ===============
const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const currentYear = 2025;
const lockUntilMonth2025 = 8;

const SIMPLE_PASS = '1234'; // <-- cámbiala si quieres

const elCards = document.getElementById('cards');
const elAnio  = document.getElementById('anio');

let chart, cacheSummary, lastClickedMonth = null;
let ctxAction = {anio:null, mes:null};

// =============== ARRANQUE ===============
init();
async function init(){
  ensureAuxUIs();

  const years = [2023,2024,2025,2026,2027];
  elAnio.innerHTML = years.map(y=>`<option ${y===currentYear?'selected':''}>${y}</option>`).join('');
  await loadYear(currentYear);

  document.getElementById('btnAddDisp').onclick = ()=>showModal('modalDisp');
  document.getElementById('btnAddProc').onclick = ()=>showModal('modalProc');
  document.getElementById('btnQuick').onclick   = ()=>showDrawer(lastClickedMonth ?? 9, +elAnio.value);

  elAnio.onchange = async (e)=> loadYear(+e.target.value);

  // cerrar con ESC o click en máscara
  document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') { hideModal(); hideActionMenu(); hidePass(); } });
  const mask = document.getElementById('mask');
  mask.addEventListener('click', (ev)=>{ if(ev.target === mask) hideModal(); });
}

// =============== MOCKS / ENDPOINTS ===============
async function fetchSummaryMensual(anio){
  // Reemplaza con tus endpoints reales
  const req = [800,900,600,0,0,0,0,0,700,800,900,650];
  const asg = [200,300,300,0,0,0,0,0,300,600,600,450];
  const pro = [ 50,120, 80,0,0,0,0,0,100,300,450,220];
  return {anio, requerido:req, asignado:asg, procesado:pro};
}
async function fetchProveedoresMes(anio,mes){
  // para Drawer y también como base del "disponible"
  return [
    { proveedor:"Proveedor X", comuna:"Castro",   tons:120, cod:"CST-101", contactId:"p1" },
    { proveedor:"MarSur Ltda", comuna:"Dalcahue", tons: 80, cod:"DLH-204", contactId:"p2" },
    { proveedor:"Acuícola Y",  comuna:"Quellón",  tons: 60, cod:"QLL-330", contactId:"p3" }
  ];
}
// Proveedores con disponibilidad desde ese mes en adelante (demo: mismos)
async function fetchProveedoresDisponiblesDesde(anio, mes){
  return fetchProveedoresMes(anio, mes);
}

async function putDisponibilidad(payload){ console.log('[PUT disponibilidad]', payload); alert('Disponibilidad guardada (demo)'); }
async function putProcesado(payload){ console.log('[PUT procesado semanal]', payload); alert('Procesado guardado (demo)'); }

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
    // 2025: ocultar Ene–Ago (<=8) completamente
    if(anio===2025 && m <= lockUntilMonth2025) continue;

    const i = m-1;
    const req = +data.requerido[i]||0;
    const asg = +data.asignado[i]||0;
    const real= +data.procesado[i]||0;
    const safeReq = req>0?req:1;

    const pctReal = Math.min(100, Math.round((real/safeReq)*100));
    const pctAsig = Math.min(100, Math.round((asg/safeReq)*100));

        const card = document.createElement('div');
    card.className = 'card card--mock';
    card.dataset.m = m;
    card.innerHTML = `
      <div class="month-pill">
        <div class="pill-fill" style="width:${pctAsig}%"></div>
        <span>${MES_LABELS[i].toUpperCase()} ${anio}</span>
      </div>
      <div class="pane">
        <div class="tons-title">TONS REQ</div>
        <div class="tons-value">${fmt(req)}</div>

        <div class="rowbar">
          <div class="lbl">Real/Req</div>
          <div class="barwrap">
            <span class="fill-real" style="width:${pctReal}%"></span>
          </div>
          <div class="pct">${pctReal}%</div>
        </div>

        <div class="rowbar">
          <div class="lbl">Asig/Req</div>
          <div class="barwrap">
            <span class="fill-asg" style="width:${pctAsig}%"></span>
          </div>
          <div class="pct">${pctAsig}%</div>
        </div>
      </div>
    `;
    card.addEventListener('click', (ev)=> openProvidersPopover(m, anio, card));


  // Tarjeta Consolidado año
  const ysum = yearTotals(data);
  const cardY = document.createElement('div');
  cardY.className = 'card card--summary';
  cardY.innerHTML = `
    <div class="month-pill">CONSOLIDADO ${anio}</div>
    <div class="pane">
      <div class="tons-title">TOTAL REQUERIDO</div>
      <div class="tons-value">${fmt(ysum.tReq)}</div>

      <div class="rowbar">
        <div class="lbl">Real/Req</div>
        <div class="barwrap">
          <span class="fill-real" style="width:${ysum.pctReal}%"></span>
        </div>
        <div class="pct">${ysum.pctReal}%</div>
      </div>

      <div class="rowbar">
        <div class="lbl">Asig/Req</div>
        <div class="barwrap">
          <span class="fill-asg" style="width:${ysum.pctAsig}%"></span>
        </div>
        <div class="pct">${ysum.pctAsig}%</div>
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
        openActionMenu(mes, year);
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

// =============== MODALES base (tuyos) ===============
const mask = document.getElementById('mask');

function showModal(id){
  const modal = document.getElementById(id);
  mask.style.display = 'block';
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  modal.setAttribute('aria-hidden','false');
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
  });
  document.body.style.overflow = '';
  mask.setAttribute('aria-hidden','true');
}

// Guardados
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
    plantaId:document.getElementById('mProcPlanta').value.trim()||null,
    kilos:+document.getElementById('mProcKg').value
  };
  await putProcesado(payload);
  hideModal();
  await loadYear(+elAnio.value);
}

// =============== Menú de ACCIONES y Password ===============
function ensureAuxUIs(){
  // Menú
  if(!document.getElementById('asigMenu')){
    const wrap = document.createElement('div');
    wrap.id = 'asigMenu';
    wrap.className = 'asig-menu';
    wrap.innerHTML = `
      <div class="backdrop" onclick="hideActionMenu()"></div>
      <div class="sheet">
        <header id="asigMenuTitle">Acciones</header>
        <div class="body">
          <button id="actAsignar">Asignar MMPP</button>
          <button id="actProd">Registrar Prod. Planta</button>
          <button id="actVerProv">Ver proveedores</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById('actAsignar').onclick = async ()=>{
      hideActionMenu();
      const ok = await askPassword();
      if(!ok) return;

      // Precarga y selector de proveedores disponibles
      document.getElementById('mDispAnio').value = ctxAction.anio;
      document.getElementById('mDispMes').value  = ctxAction.mes;

      await injectProveedorSelector(ctxAction.anio, ctxAction.mes);
      showModal('modalDisp');
    };
    document.getElementById('actProd').onclick = async ()=>{
      hideActionMenu();
      const ok = await askPassword();
      if(!ok) return;

      document.getElementById('mProcAnio').value = ctxAction.anio;
      document.getElementById('mProcMes').value  = ctxAction.mes;
      showModal('modalProc');
    };
    document.getElementById('actVerProv').onclick = ()=>{
      hideActionMenu();
      showDrawer(ctxAction.mes, ctxAction.anio);
    };
  }

  // Password
  if(!document.getElementById('asigPass')){
    const wrap = document.createElement('div');
    wrap.id = 'asigPass';
    wrap.className = 'asig-pass';
    wrap.innerHTML = `
      <div class="backdrop" onclick="hidePass()"></div>
      <div class="sheet">
        <h4>Confirmación</h4>
        <p style="margin:.25rem 0 .6rem;color:#444">Ingresa tu contraseña para continuar.</p>
        <div class="row">
          <input id="asigPassInput" type="password" placeholder="Contraseña" />
        </div>
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
}

// Abrir menú
function openActionMenu(mes, anio){
  ctxAction = {anio, mes};
  document.getElementById('asigMenuTitle').textContent = `Acciones — ${MES_LABELS[mes-1].toUpperCase()} ${anio}`;
  document.getElementById('asigMenu').style.display = 'block';
}
function hideActionMenu(){ document.getElementById('asigMenu').style.display = 'none'; }

// Password simple
function askPassword(){
  return new Promise(resolve=>{
    const pass = document.getElementById('asigPass');
    pass.style.display = 'block';
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

// Inyecta selector de proveedores disponibles en tu modal de disponibilidad
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
// ===== POPUP anclado a la tarjeta para proveedores =====
let popEl;
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
          <tr>
            <th>Proveedor</th><th>Comuna</th><th>Tons</th><th>Cod.Centro</th>
          </tr>
        </thead>
        <tbody id="popRows"></tbody>
      </table>
    </div>
  `;
  document.body.appendChild(popEl);

  // click fuera
  document.addEventListener('click', (e)=>{
    if(!popEl?.isConnected) return;
    if(popEl.style.display!=='block') return;
    if(!popEl.contains(e.target) && !e.target.closest('.card--mock')) hideProvidersPopover();
  });
  window.addEventListener('scroll', ()=>{ if(popEl.style.display==='block') repositionPopover() }, true);
  window.addEventListener('resize', ()=>{ if(popEl.style.display==='block') repositionPopover() }, true);
  return popEl;
}

let popCtx = {anchor:null, mes:null, anio:null};
function repositionPopover(){
  if(!popEl || !popCtx.anchor) return;
  const r = popCtx.anchor.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 8;
  let left = r.left + window.scrollX;

  // evitar desbordes en X
  const maxLeft = window.scrollX + (window.innerWidth - popEl.offsetWidth - 8);
  if(left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);

  popEl.style.top = `${top}px`;
  popEl.style.left = `${left}px`;
}

async function openProvidersPopover(mes, anio, anchorEl){
  ensurePopover();
  popCtx = {anchor:anchorEl, mes, anio};

  // titulo
  document.getElementById('popTitle').textContent = `${MES_LABELS[mes-1]} ${anio} · Proveedores`;

  // datos
  const rows = await fetchProveedoresMes(anio, mes);
  const tbody = document.getElementById('popRows');
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${esc(r.proveedor)}</td>
      <td>${esc(r.comuna)}</td>
      <td class="text-right">${fmt(r.tons)}</td>
      <td>${esc(r.cod)}</td>
    </tr>
  `).join('');

  popEl.style.display = 'block';
  repositionPopover();
}

function hideProvidersPopover(){
  if(popEl) popEl.style.display = 'none';
}

// =============== UTILS ===============
function fmt(n){ return (n||0).toLocaleString('es-CL',{maximumFractionDigits:1}) }
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }


