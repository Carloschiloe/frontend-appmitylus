// /js/abastecimiento/planificacion/ui/charts.js

const charts = { meta:null, dias:null, estados:null, rpa:null };

export function initCharts(){
  if (window.Chart === undefined) return charts; // Chart.js no disponible

  const elMeta = document.getElementById('ch_meta');
  if (elMeta) charts.meta = new Chart(elMeta, { type:'bar', data:{labels:['Meta','Plan','Confirmado'],datasets:[{data:[0,0,0]}]}, options: commonOpts() });

  const elDias = document.getElementById('ch_dias');
  if (elDias) charts.dias = new Chart(elDias, { type:'line', data:{labels:[],datasets:[{label:'t/periodo',data:[],tension:.3}]}, options: commonOpts() });

  const elEstados = document.getElementById('ch_estados');
  if (elEstados) charts.estados = new Chart(elEstados, { type:'doughnut', data:{labels:['Planificado','Confirmado','Cancelado'],datasets:[{data:[0,0,0]}]}, options:{responsive:true,plugins:{legend:{position:'bottom'}}} });

  const elRpa = document.getElementById('ch_rpa');
  if (elRpa) charts.rpa = new Chart(elRpa, { type:'line', data:{labels:[],datasets:[ {label:'Requerida',data:[],tension:.3}, {label:'Programada',data:[],tension:.3}, {label:'Abastecida',data:[],tension:.3} ]}, options: commonOpts() });

  return charts;
}

export function updateCharts({ kpis={}, dias=[], estados=[], rpa={labels:[],requerida:[],programada:[],abastecida:[]}, labelDias='Tons por día (semana)' }){
  if (charts.meta){ charts.meta.data.datasets[0].data = [kpis.meta||0, kpis.plan||0, kpis.confirmado||0]; charts.meta.update(); }

  if (charts.dias){
    document.getElementById('lbl_ch_dias') && (document.getElementById('lbl_ch_dias').textContent = labelDias);
    charts.dias.data.labels = (dias||[]).map(d=>d.label);
    charts.dias.data.datasets[0].label = labelDias.replace('Tons por ','t/').replace(' (',' (');
    charts.dias.data.datasets[0].data = (dias||[]).map(d=>d.tons||0);
    charts.dias.update();
  }

  if (charts.estados){
    const vals = ['Planificado','Confirmado','Cancelado'].map(n => (estados||[]).find(e=>e.label===n)?.value || 0);
    charts.estados.data.datasets[0].data = vals;
    charts.estados.update();
  }

  if (charts.rpa){
    charts.rpa.data.labels = rpa.labels || [];
    charts.rpa.data.datasets[0].data = rpa.requerida  || [];
    charts.rpa.data.datasets[1].data = rpa.programada || [];
    charts.rpa.data.datasets[2].data = rpa.abastecida || [];
    charts.rpa.update();
  }
}

function commonOpts(){
  const nf = new Intl.NumberFormat('es-CL');
  return { responsive:true, animation:false, plugins:{ legend:{position:'bottom'}, tooltip:{ callbacks:{ label:(ctx)=> `${ctx.dataset.label}: ${nf.format(ctx.parsed.y||0)} t` } } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=> nf.format(v) } } } };
}