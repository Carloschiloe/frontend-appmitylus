(function (global){
  function numeroCL(n){ return (Number(n)||0).toLocaleString('es-CL'); }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }

  function build(rows){
    var host=document.getElementById('mmppTransportistas');
    if(!host) return;
    var y=new Date().getFullYear();
    var m=new Date().getMonth()+1;

    // totales por transportista (mes actual)
    var mmKey = y+'-'+pad2(m);
    var map = {};
    rows.forEach(function(a){
      var mk = (a.destAnio && a.destMes) ? (a.destAnio+'-'+pad2(a.destMes)) : null;
      if (mk!==mmKey) return;
      var key = a.transportistaNombre || '—';
      var cur = map[key] || {name:key, tons:0, trucks:0};
      cur.tons += Number(a.cantidad||0);
      map[key] = cur;
    });
    Object.keys(map).forEach(function(k){ map[k].trucks = Math.ceil(map[k].tons / 10); });

    var list = Object.values(map).sort(function(a,b){ return b.tons-a.tons; });

    host.innerHTML =
      '<div class="card pad">'+
        '<h2 style="margin:0 0 8px;font-weight:800">🚚 Transportistas — '+mmKey+'</h2>'+
        '<table class="table">'+
          '<thead><tr>'+
            '<th class="th">Transportista</th>'+
            '<th class="th">Toneladas</th>'+
            '<th class="th">Camiones (10 t)</th>'+
          '</tr></thead>'+
          '<tbody>'+
            (list.map(function(r){
              return '<tr class="tr">'+
                '<td class="td">'+r.name+'</td>'+
                '<td class="td">'+numeroCL(r.tons)+'</td>'+
                '<td class="td">'+numeroCL(r.trucks)+'</td>'+
              '</tr>';
            }).join('') || '<tr class="tr"><td class="td" colspan="3">Sin datos</td></tr>')+
          '</tbody>'+
        '</table>'+
      '</div>';
  }

  function load(){
    var api = global.MMppApi;
    if(!api) return;
    api.getAsignaciones().then(function(asig){
      // Ojo: aquí usamos la forma "cruda" devuelta por tu backend/API (antes de normalizeAsign).
      // Si prefieres lo normalizado, adapta mmpp-api.js para exponer también esos campos.
      build(Array.isArray(asig)?asig:[]);
    });
  }

  document.addEventListener('DOMContentLoaded', load);
})(window);
