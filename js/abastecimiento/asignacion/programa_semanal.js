// programa_semanal.js
import { fmt, altoDisponible, fechasDeSemanaISO, aToneladas } from './utilidades.js';
import * as estado from './estado.js';
import * as api from './api.js';

let tabla=null, weekKeyActual=null, fechasSemana=[];

function construirToolbar(){
  const wrap = document.getElementById('progToolbar');
  wrap.innerHTML = `
    <div class="input-field"><input id="prog_semana" type="week"><label class="active" for="prog_semana">Semana (ISO)</label></div>
    <div class="input-field"><select id="prog_unidad"><option value="tons" selected>Toneladas</option><option value="trucks">Camiones (10 t)</option></select><label>Unidad</label></div>
    <div class="input-field"><select id="prog_tipo"><option value="ALL" selected>Todos</option><option value="NORMAL">Normal</option><option value="BAP">BAP</option></select><label>Tipo MMPP</label></div>
    <div class="right-actions" style="display:flex;gap:8px;align-items:center;justify-content:flex-end">
      <a class="btn teal" id="prog_noop"><i class="material-icons left">event_busy</i>No operación…</a>
      <a class="btn grey darken-2" id="prog_csv"><i class="material-icons left">download</i>CSV</a>
      <a class="btn grey darken-2" id="prog_xlsx"><i class="material-icons left">file_download</i>XLSX</a>
    </div>
  `;
  M.FormSelect.init(wrap.querySelectorAll('select'));

  // semana actual simplificada
  const now=new Date(); const y=now.getFullYear(); const jan1=new Date(y,0,1);
  const d=Math.ceil((((now - jan1) / 86400000) + jan1.getDay()+1)/7);
  wrap.querySelector('#prog_semana').value = `${y}-W${String(d).padStart(2,'0')}`;

  wrap.querySelector('#prog_csv').addEventListener('click', ()=>{ if(tabla) tabla.download("csv","programa_semanal.csv"); });
  wrap.querySelector('#prog_xlsx').addEventListener('click', ()=>{ if(tabla) tabla.download("xlsx","programa_semanal.xlsx",{sheetName:"Programa"}); });
  wrap.querySelector('#prog_noop').addEventListener('click', ()=>{
    const modal=document.getElementById('modalNoOp'); (M.Modal.getInstance(modal)||M.Modal.init(modal)).open();
    document.getElementById('noop_fecha').value = fechasSemana[0]||''; M.FormSelect.init(document.querySelectorAll('#modalNoOp select')); M.updateTextFields();
  });

  wrap.querySelector('#prog_semana').addEventListener('change', cargarSemana);
  wrap.querySelector('#prog_unidad').addEventListener('change', renderTabla);
  wrap.querySelector('#prog_tipo').addEventListener('change', renderTabla);

  // acciones modales
  document.getElementById('btnGuardarPrograma').addEventListener('click', guardarProgramaDesdeModal);
  document.getElementById('btnGuardarNoOp').addEventListener('click', guardarNoOpDesdeModal);
}
async function cargarSemana(){
  const weekInput=document.getElementById('prog_semana').value; if(!weekInput) return;
  weekKeyActual = weekInput.replace('W','-'); // YYYY-WW
  fechasSemana = fechasDeSemanaISO(weekKeyActual);
  await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana);
  renderTabla();
}
function renderTabla(){
  if(!fechasSemana.length) return;
  const unidad=document.getElementById('prog_unidad').value;
  const tipo=document.getElementById('prog_tipo').value;

  const dayNames=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const cols=[{title:'Proveedor', field:'Proveedor', width:260}];
  fechasSemana.forEach((f,idx)=>{
    const noop=estado.esNoOperacion(f);
    cols.push({
      title: `${dayNames[idx]} ${f.slice(5)}` + (noop?` <span class="badge-noop">${noop.status==='HOLIDAY'?'Feriado':'No operación'}</span>`:''),
      field:`d${idx}`, hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue()||0), cssClass: noop ? 'col-noop' : '',
      cellClick:(e,cell)=>{
        if(noop) return M.toast({html:`Día bloqueado (${noop.reason||'sin motivo'})`, classes:'orange'});
        const modal=document.getElementById('modalProgramar'); (M.Modal.getInstance(modal)||M.Modal.init(modal)).open();
        document.getElementById('prog_fecha').value=f;
        document.getElementById('prog_camiones').value=''; document.getElementById('prog_tons').value=''; document.getElementById('prog_notas').value='';
        document.getElementById('prog_proveedor').value = cell.getRow().getData().Proveedor || ''; document.getElementById('prog_comuna').value='';
        M.FormSelect.init(document.querySelectorAll('#modalProgramar select')); M.updateTextFields();
      }
    });
  });
  cols.push({title:'Total', field:'total', hozAlign:'right', headerHozAlign:'right', formatter:(c)=>fmt(c.getValue()||0), width:110});

  const porProv=new Map();
  const entries=estado.datos.programaSemana.filter(e=> tipo==='ALL' ? true : (e.tipo||'NORMAL').toUpperCase()===tipo);
  for(const e of entries){
    const key=e.proveedorNombre||'(sin proveedor)'; if(!porProv.has(key)) porProv.set(key,{Proveedor:key,total:0});
    const row=porProv.get(key); const idx=fechasSemana.indexOf(e.fecha);
    if(idx>=0){ const value=(unidad==='trucks')?e.camiones:e.tons; row[`d${idx}`]=(row[`d${idx}`]||0)+(Number(value)||0); row.total=(row.total||0)+(Number(value)||0); }
  }
  const data=[...porProv.values()].sort((a,b)=>String(a.Proveedor).localeCompare(String(b.Proveedor)));
  const h=altoDisponible(document.getElementById('progTableWrap'));
  if(tabla){ tabla.setColumns(cols); tabla.setData(data); tabla.setHeight(h + 'px'); }
  else{ tabla=new Tabulator('#progTable', {data, columns:cols, height:h + 'px', layout:'fitColumns', columnMinWidth:110, movableColumns:true}); }

  const resumenDias = fechasSemana.map(f=>{ const st=estado.esNoOperacion(f); return st?`${f} (${st.status})`:''; }).filter(Boolean).join(' · ');
  document.getElementById('progNote').textContent = `Semana ${weekKeyActual} — ${fechasSemana[0]} a ${fechasSemana[6]}${resumenDias? ' — ' + resumenDias : ''}`;
}
async function guardarProgramaDesdeModal(){
  const fecha=document.getElementById('prog_fecha').value;
  const tipo=document.getElementById('prog_tipo').value;
  const prov=document.getElementById('prog_proveedor').value.trim();
  const comuna=document.getElementById('prog_comuna').value.trim();
  let camiones=Number(document.getElementById('prog_camiones').value||0);
  let tons=Number(document.getElementById('prog_tons').value||0);
  const notas=document.getElementById('prog_notas').value||'';
  if(!fecha || !prov || (!camiones && !tons)) return M.toast({html:'Completa fecha, proveedor y cantidad', classes:'red'});
  if(!tons && camiones) tons = aToneladas(camiones);
  const mesKey=fecha.slice(0,7); const saldo=estado.saldoMes({mesKey, tipo}); if(tons>saldo) return M.toast({html:`Excede el saldo del mes (${fmt(saldo)} t)`, classes:'red'});
  try{ await api.guardarPrograma({fecha, proveedorNombre:prov, comuna, tipo, camiones, tons, notas, estado:'BORRADOR'}); M.toast({html:'Programa guardado', classes:'teal'}); M.Modal.getInstance(document.getElementById('modalProgramar'))?.close(); await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana); renderTabla(); }
  catch(e){ console.error(e); M.toast({html:'Error guardando programa', classes:'red'}); }
}
async function guardarNoOpDesdeModal(){
  const date=document.getElementById('noop_fecha').value; const status=document.getElementById('noop_estado').value; const reason=document.getElementById('noop_motivo').value||'';
  if(!date) return;
  try{ await api.guardarEstadoDia({date, status, reason}); M.toast({html:'Estado del día guardado', classes:'teal'}); M.Modal.getInstance(document.getElementById('modalNoOp'))?.close(); await estado.cargarProgramaSemana(api, weekKeyActual, fechasSemana); renderTabla(); }
  catch(e){ console.error(e); M.toast({html:'Error guardando estado de día', classes:'red'}); }
}
export async function montar(){
  construirToolbar();
  M.Modal.init(document.querySelectorAll('.modal'));
  await cargarSemana();
  window.addEventListener('resize', ()=>{ const h=altoDisponible(document.getElementById('progTableWrap')); if(tabla) tabla.setHeight(h + 'px'); });
  estado.on('actualizado-programa', renderTabla);
}
