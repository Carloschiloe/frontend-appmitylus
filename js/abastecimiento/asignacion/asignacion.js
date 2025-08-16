// =============== CONFIG INICIAL ===============
const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const currentYear = 2025;   // según tu caso
const lockUntilMonth2025 = 8; // Ene(1)–Ago(8) bloqueados si anio=2025

const elCards = document.getElementById('cards');
const elAnio  = document.getElementById('anio');
let chart, cacheSummary, lastClickedMonth = null;

// =============== ARRANQUE ===============
init();
async function init(){
  const years = [2023,2024,2025,2026,2027];
  elAnio.innerHTML = years.map(y=>`<option ${y===currentYear?'selected':''}>${y}</option>`).join('');
  await loadYear(currentYear);

  // botones
  document.getElementById('btnAddDisp').onclick = ()=>showModal('modalDisp');
  document.getElementById('btnAddProc').onclick = ()=>showModal('modalProc');
  document.getElementById('btnQuick').onclick   = ()=>showDrawer(lastClickedMonth ?? 9, +elAnio.value);

  elAnio.onchange = async (e)=> loadYear(+e.target.value);
}

// =============== CARGA DE DATOS ===============
// TODO: Reemplaza por tus endpoints reales
async function fetchSummaryMensual(anio){
  // GET /planning/monthly?anio=...&materiaPrima=...
  const req = [800,900,600,0,0,0,0,0,700,800,900,650];
  const asg = [200,300,300,0,0,0,0,0,300,600,600,450];
  const pro = [ 50,120, 80,0,0,0,0,0,100,300,450,220];
  return {anio, requerido:req, asignado:asg, procesado:pro};
}
async function fetchProveedoresMes(anio,mes){
  // GET /availability/search?anio=..&mes=..&materiaPrima=..
  return [
    { proveedor:"Proveedor X", comuna:"Castro",   tons:120, cod:"CST-101" },
    { proveedor:"MarSur Ltda", comuna:"Dalcahue", tons: 80, cod:"DLH-204" },
    { proveedor:"Acuícola Y",  comuna:"Quellón",  tons: 60, cod:"QLL-330" }
  ];
}
async function putDisponibilidad(payload){
  // PUT /availability
  console.log('[PUT disponibilidad]', payload);
  alert('Disponibilidad guardada (demo)');
}
async function putProcesado(payload){
  // PUT /processings
  console.log('[PUT procesado semanal]', payload);
  alert('Procesado guardado (demo)');
}

async function loadYear(y){
  cacheSummary = await fetchSummaryMensual(y);
  paintCards(y, cacheSummary);
  paintChart(cacheSummary);
}

// =============== TARJETAS ===============
function paintCards(anio, data){
  elCards.innerHTML = '';
  for(let m=1;m<=12;m++){
    const i = m-1;
    const req = +data.requerido[i]||0, asg = +data.asignado[i]||0, pro= +data.procesado[i]||0;
    const pct = req>0 ? Math.min(100, Math.round((pro/req)*100)) : 0;
    const lock = (anio===2025 && m <= lockUntilMonth2025);

    const card = document.createElement('div');
    card.className = 'card' + (lock?' lock':'');
    card.dataset.m = m;
    card.innerHTML = `
      <h4>${MES_LABELS[i]} ${anio}</h4>
      <div class="pct">${pct}%</div>
      <div class="muted">Req: <b>${fmt(req)}</b> t · Asig: <b>${fmt(asg)}</b> t · Proc: <b>${fmt(pro)}</b> t</div>
      <div class="bar" style="margin-top:10px">
        <div class="stack" style="width:100%">
          <div class="fill-req" style="flex:${req||1}"></div>
        </div>
      </div>
      <div class="bar">
        <div class="stack" style="width:100%">
          <div class="fill-asg"  style="flex:${asg}"></div>
          <div class="fill-proc" style="flex:${pro}"></div>
        </div>
      </div>
      <div class="kpis">
        <span class="chip">Cumpl. ${pct}%</span>
        <span class="chip">${fmt(pro)}/${fmt(req)} t</span>
      </div>
      <div class="tip">
        <b>${MES_LABELS[i]}</b> — Req ${fmt(req)} t · Asig ${fmt(asg)} t · Proc ${fmt(pro)} t
        <div class="muted" style="margin-top:6px">Click para ver proveedores del mes</div>
      </div>
    `;
    elCards.appendChild(card);

    if(!lock){
      card.addEventListener('click', async ()=>{
        highlightMonth(m);
        showDrawer(m, anio);
      });
    }
  }
}
function highlightMonth(m){
  lastClickedMonth = m;
  Array.from(elCards.children).forEach(c=>c.style.outline='none');
  const el = Array.from(elCards.children).find(c=>+c.dataset.m===m);
  if(el) el.style.outline='2px solid rgba(91,157,255,.6)';
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
    <td>${esc(r.proveedor)}</td><td>${esc(r.comuna)}</td><td>${fmt(r.tons)}</td><td>${esc(r.cod)}</td>
  </tr>`).join('');
  document.getElementById('drawer').style.display='block';
}
function closeDrawer(){ document.getElementById('drawer').style.display='none' }

// =============== MODALES & GUARDADOS ===============
const mask = document.getElementById('mask');
function showModal(id){ mask.style.display='block'; document.getElementById(id).style.display='block' }
function hideModal(){
  mask.style.display='none';
  document.getElementById('modalDisp').style.display='none';
  document.getElementById('modalProc').style.display='none';
}
async function saveDisponibilidad(){
  const payload = {
    anio: +document.getElementById('mDispAnio').value,
    mes:  +document.getElementById('mDispMes').value,
    contactId: document.getElementById('mDispProv').value.trim(),
    materiaPrima: document.getElementById('mDispMP').value.trim(),
    stockInicialTons: +document.getElementById('mDispStock').value
  };
  await putDisponibilidad(payload); hideModal(); await loadYear(+elAnio.value);
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
  await putProcesado(payload); hideModal(); await loadYear(+elAnio.value);
}

// =============== UTILS ===============
function fmt(n){ return (n||0).toLocaleString('es-CL',{maximumFractionDigits:1}) }
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }
