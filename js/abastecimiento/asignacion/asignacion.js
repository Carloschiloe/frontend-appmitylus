// =============== CONFIG INICIAL ===============
const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const currentYear = 2025;
const lockUntilMonth2025 = 8; // Ene(1)–Ago(8) -> ocultos en 2025

const elCards = document.getElementById('cards');
const elAnio  = document.getElementById('anio');
let chart, cacheSummary, lastClickedMonth = null;

// =============== ARRANQUE ===============
init();
async function init(){
  const years = [2023, 2024, 2025, 2026, 2027];
  elAnio.innerHTML = years.map(y => `<option ${y===currentYear?'selected':''}>${y}</option>`).join('');
  await loadYear(currentYear);

  document.getElementById('btnAddDisp').onclick = () => showModal('modalDisp');
  document.getElementById('btnAddProc').onclick = () => showModal('modalProc');
  document.getElementById('btnQuick').onclick   = () => showDrawer(lastClickedMonth ?? 9, +elAnio.value);

  elAnio.onchange = async (e)=> loadYear(+e.target.value);

  // cerrar con ESC o click en máscara
  document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') hideModal(); });
  const mask = document.getElementById('mask');
  mask.addEventListener('click', (ev)=>{ if(ev.target === mask) hideModal(); });
}

// =============== CARGA DE DATOS (mock) ===============
async function fetchSummaryMensual(anio){
  // Datos demo
  const req = [800,900,600,0,0,0,0,0,700,800,900,650];
  const asg = [200,300,300,0,0,0,0,0,300,600,600,450];
  const pro = [ 50,120, 80,0,0,0,0,0,100,300,450,220];
  return {anio, requerido:req, asignado:asg, procesado:pro};
}
async function fetchProveedoresMes(anio,mes){
  return [
    { proveedor:"Proveedor X", comuna:"Castro",   tons:120, cod:"CST-101" },
    { proveedor:"MarSur Ltda", comuna:"Dalcahue", tons: 80, cod:"DLH-204" },
    { proveedor:"Acuícola Y",  comuna:"Quellón",  tons: 60, cod:"QLL-330" }
  ];
}
async function putDisponibilidad(payload){ console.log('[PUT disponibilidad]', payload); alert('Disponibilidad guardada (demo)'); }
async function putProcesado(payload){ console.log('[PUT procesado semanal]', payload); alert('Procesado guardado (demo)'); }

async function loadYear(y){
  cacheSummary = await fetchSummaryMensual(y);
  paintCards(y, cacheSummary);
  paintChart(cacheSummary);
}

// =============== TARJETAS (grid único, ocultando Ene–Ago 2025) ===============
function paintCards(anio, data){
  elCards.innerHTML = '';

  // grid único
  const grid = document.createElement('div');
  grid.className = 'grid';
  elCards.appendChild(grid);

  for(let m=1; m<=12; m++){
    // 2025: ocultar meses pasados (Ene–Ago)
    if(anio === 2025 && m <= lockUntilMonth2025) continue;

    const i = m-1;
    const req  = +data.requerido[i] || 0;
    const asg  = +data.asignado[i]  || 0;
    const real = +data.procesado[i] || 0;

    const safeReq = req > 0 ? req : 1;
    const pctReal = Math.min(100, Math.round((real/safeReq)*100));
    const pctAsig = Math.min(100, Math.round((asg/safeReq)*100));
    const restanteReal = Math.max(0, req - real);

    const card = document.createElement('div');
    card.className = 'card card--mock';
    card.dataset.m = m;

    // Tarjeta estilo mock (pastilla y panel)
    card.innerHTML = `
      <div class="month-pill">${MES_LABELS[i].toUpperCase()} ${anio}</div>

      <div class="pane">
        <div class="tons-title">TONS REQ</div>
        <div class="tons-value">${fmt(req)}</div>

        <div class="rowbar">
          <div class="lbl">Real/Req</div>
          <div class="barwrap">
            <span class="fill-real" style="width:${pctReal}%"></span>
            <span class="n-left">${fmt(real)}</span>
            <span class="n-right">${fmt(restanteReal)}</span>
          </div>
          <div class="pct">${pctReal}%</div>
        </div>

        <div class="rowbar">
          <div class="lbl">Asig/Req</div>
          <div class="barwrap">
            <span class="fill-asg" style="width:${pctAsig}%"></span>
            <span class="n-left">${fmt(asg)}</span>
          </div>
          <div class="pct">${pctAsig}%</div>
        </div>
      </div>
    `;

    card.addEventListener('click', ()=>{
      highlightMonth(m);
      showDrawer(m, anio);
    });

    grid.appendChild(card);
  }
}

function highlightMonth(m){
  lastClickedMonth = m;
  const grid = elCards.querySelector('.grid');
  if(!grid) return;
  grid.querySelectorAll('.card').forEach(c => c.style.outline = 'none');
  const el = grid.querySelector(`.card[data-m="${m}"]`);
  if(el) el.style.outline = '2px solid rgba(0,150,136,.35)';
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
        // si es 2025 y el mes está oculto (Ene–Ago), no abrir
        if(year===2025 && mes <= lockUntilMonth2025) return;
        highlightMonth(mes);
        showDrawer(mes, year);
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

// =============== MODALES & GUARDADOS ===============
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

async function saveDisponibilidad(){
  const payload = {
    anio: +document.getElementById('mDispAnio').value,
    mes:  +document.getElementById('mDispMes').value,
    contactId: document.getElementById('mDispProv').value.trim(),
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

// =============== UTILS ===============
function fmt(n){ return (n||0).toLocaleString('es-CL',{maximumFractionDigits:1}) }
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }
