// =============== CONFIG INICIAL ===============
const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const currentYear = 2025;
const lockUntilMonth2025 = 8;

const elCards = document.getElementById('cards');
const elAnio  = document.getElementById('anio');
let chart, cacheSummary, lastClickedMonth = null;

// =============== ARRANQUE ===============
init();
async function init(){
  const years = [2023,2024,2025,2026,2027];
  elAnio.innerHTML = years.map(y=>`<option ${y===currentYear?'selected':''}>${y}</option>`).join('');
  await loadYear(currentYear);

  document.getElementById('btnAddDisp').onclick = ()=>showModal('modalDisp');
  document.getElementById('btnAddProc').onclick = ()=>showModal('modalProc');
  document.getElementById('btnQuick').onclick   = ()=>showDrawer(lastClickedMonth ?? 9, +elAnio.value);

  elAnio.onchange = async (e)=> loadYear(+e.target.value);

  // cerrar con ESC o click en máscara
  document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') hideModal(); });
  const mask = document.getElementById('mask');
  mask.addEventListener('click', (ev)=>{ if(ev.target === mask) hideModal(); });
}

// =============== CARGA DE DATOS (mock) ===============
async function fetchSummaryMensual(anio){
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

// =============== TARJETAS ===============
function paintCards(anio, data){
  elCards.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'quarters'; // en caso de que estés usando la agrupación por trimestres

  // 4 trimestres (3 meses cada uno)
  for(let q=0; q<4; q++){
    const sec = document.createElement('section');
    sec.className = 'quarter';
    const grid = document.createElement('div');
    grid.className = 'grid';

    for(let m=q*3+1; m<=q*3+3; m++){
      const i = m-1;
      const req = +data.requerido[i]||0;
      const asg = +data.asignado[i]||0;
      const pro = +data.procesado[i]||0;

      const safeReq = req>0?req:1;
      const pctCumpl = req>0 ? Math.min(100, Math.round((pro/req)*100)) : 0; // barra header
      const pctReal  = Math.min(100, Math.round((pro/safeReq)*100));
      const pctAsig  = Math.min(100, Math.round((asg/safeReq)*100));

      const lock = (anio===2025 && m <= lockUntilMonth2025);

      const card = document.createElement('div');
      card.className = 'card card--month' + (lock?' lock':'');
      card.dataset.m = m;

      card.innerHTML = `
        <div class="head">
          <div class="month">${MES_LABELS[i]} ${anio}</div>
          <div class="hdrbar" aria-label="Cumplimiento ${pctCumpl}%">
            <span class="fill" style="width:${pctCumpl}%"></span>
          </div>
        </div>

        <div class="kpi-big">
          <div class="label">Tons req</div>
          <div class="value">${fmt(req)}</div>
        </div>

        <div class="mini">
          <div class="lbl">Real/Req</div>
          <div class="bar"><span class="real" style="width:${pctReal}%"></span></div>
          <div class="val">${pctReal}%</div>
        </div>

        <div class="mini">
          <div class="lbl">Asig/Req</div>
          <div class="bar"><span class="asg" style="width:${pctAsig}%"></span></div>
          <div class="val">${pctAsig}%</div>
        </div>
      `;

      if(!lock){
        card.addEventListener('click', ()=>{
          highlightMonth(m);
          showDrawer(m, anio);
        });
      }
      grid.appendChild(card);
    }

    sec.appendChild(grid);
    wrap.appendChild(sec);
  }

  elCards.appendChild(wrap);
}


function highlightMonth(m){
  lastClickedMonth = m;
  Array.from(elCards.children).forEach(c=>c.style.outline='none');
  const el = Array.from(elCards.children).find(c=>+c.dataset.m===m);
  if(el) el.style.outline='2px solid rgba(0,150,136,.35)';
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


