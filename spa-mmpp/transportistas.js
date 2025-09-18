/* /spa-mmpp/transportistas.js
   Panel lateral incrustado desde la barra: CRUD Transportistas
   - Campos: nombre, rut, contacto, teléfono, email
   - Área de operación: Chiloé / Calbuco
   - Capacidades: camión simple / con carro
   - Tarifas por origen (simple / carro)
*/
(function (global) {
  "use strict";

  // ====== Utils/DOM ======
  const $ = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));
  const esc = (s) => String(s||"").replace(/[&<>]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]));
  const escA = (s) => String(s||"").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const numeroCL = (n) => (Number(n)||0).toLocaleString("es-CL");
  const money = (n) => "$"+numeroCL(n);
  const AREAS = ["Chiloé","Calbuco"];
  const empty = () => ({
    _id:null, nombre:"", rut:"", contactoNombre:"", telefono:"", email:"",
    areaOperacion:"Chiloé", soportaSimple:true, soportaCarro:false, tarifas:[]
  });

  // ====== API (usa MMppApi si existe, si no, REST plano) ======
  const api = (function(){
    const a = global.MMppApi || {};
    const has = (k)=>typeof a[k]==="function";
    const BASE = "/api/transportistas";

    const get = async()=> has("getTransportistas") ? a.getTransportistas() :
      (await fetch(BASE)).json().catch(()=>[]);
    const create = async(p)=> has("createTransportista") ? a.createTransportista(p) :
      (await fetch(BASE,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})).json();
    const update = async(id,p)=> has("updateTransportista") ? a.updateTransportista(id,p) :
      (await fetch(`${BASE}/${id}`,{method:"PUT",headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})).json();
    const del = async(id)=> has("deleteTransportista") ? a.deleteTransportista(id) :
      (await fetch(`${BASE}/${id}`,{method:"DELETE"})).ok ? {ok:true}:{ok:false};
    return { get, create, update, del };
  })();

  // ====== Estado ======
  const state = { all:[], q:"", editing:null };

  // ====== Shell del panel (drawer) ======
  const style = document.createElement("style");
  style.textContent = `
  .mmpp-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.25);backdrop-filter:blur(1px);z-index:980}
  .mmpp-drawer{position:fixed;top:0;right:0;bottom:0;width:min(980px,95vw);background:#fff;
               box-shadow:0 0 30px rgba(0,0,0,.25);z-index:981;display:flex;flex-direction:column}
  .mmpp-drawer .hdr{padding:14px 16px;border-bottom:1px solid var(--border,#e5e7eb)}
  .mmpp-drawer .body{padding:12px 16px;overflow:auto}
  .mmpp-drawer .ftr{padding:10px 16px;border-top:1px solid var(--border,#e5e7eb)}
  .grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .btn-danger{background:#ef4444;color:#fff;border:0}
  .btn-light{background:#f3f4f6;color:#111827;border:1px solid var(--border,#e5e7eb)}
  `;
  document.head.appendChild(style);

  function drawerShell(){
    const shell = document.createElement("div");
    shell.id = "transportistasDrawerShell";
    shell.innerHTML = `
      <div class="mmpp-drawer-mask" id="tMask"></div>
      <aside class="mmpp-drawer" role="dialog" aria-modal="true">
        <div class="hdr row between center">
          <div class="row center" style="gap:8px">
            <h2 style="margin:0">🚚 Transportistas</h2>
          </div>
          <button class="btn btn-light" id="tClose">Cerrar</button>
        </div>
        <div class="body" id="tBody"></div>
      </aside>`;
    document.body.appendChild(shell);
    $("#tMask", shell).addEventListener("click", close);
    $("#tClose", shell).addEventListener("click", close);
    return shell;
  }

  function close(){
    $("#transportistasDrawerShell")?.remove();
  }

  // ====== Vistas ======
  function viewHeader(){
    return `
      <div class="card pad" style="margin-bottom:12px">
        <div class="row between center" style="gap:12px">
          <input id="tSearch" class="input" placeholder="Buscar por nombre / RUT / origen…" style="min-width:260px">
          <button id="tNew" class="btn">+ Nuevo transportista</button>
        </div>
      </div>`;
  }

  function viewTable(list){
    return `
      <div class="card pad">
        <table class="table">
          <thead>
            <tr>
              <th class="th">Transportista</th>
              <th class="th">RUT</th>
              <th class="th">Contacto</th>
              <th class="th">Área</th>
              <th class="th">Capacidades</th>
              <th class="th">Tarifas</th>
              <th class="th" style="width:140px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${
              list.length ? list.map(t=>{
                const caps = [t.soportaSimple?"Simple":null, t.soportaCarro?"Con carro":null].filter(Boolean).join(" / ")||"—";
                const tarifas =
                  (t.tarifas||[]).slice(0,2).map(x=>`${esc(x.origen)}: ${
                    t.soportaCarro ? `${money(x.precioSimple||0)} / ${money(x.precioCarro||0)}`
                                   : `${money(x.precioSimple||0)}`
                  }`).join("<br>") + ((t.tarifas||[]).length>2?"<br><em>…</em>":"") || "—";
                return `
                  <tr class="tr">
                    <td class="td"><strong>${esc(t.nombre)}</strong><br><small>${esc(t.email||"")}</small></td>
                    <td class="td">${esc(t.rut||"—")}</td>
                    <td class="td">${esc(t.contactoNombre||"—")}<br><small>${esc(t.telefono||"—")}</small></td>
                    <td class="td">${esc(t.areaOperacion||"—")}</td>
                    <td class="td">${caps}</td>
                    <td class="td">${tarifas}</td>
                    <td class="td">
                      <div class="row" style="gap:6px">
                        <button class="btn btn-light" data-act="edit" data-id="${t._id}">Editar</button>
                        <button class="btn btn-danger" data-act="del" data-id="${t._id}">Eliminar</button>
                      </div>
                    </td>
                  </tr>`;
              }).join("") : `<tr class="tr"><td class="td" colspan="7">Sin transportistas</td></tr>`
            }
          </tbody>
        </table>
      </div>`;
  }

  function viewForm(m){
    const filas = (m.tarifas||[]).map((x,i)=>filaTarifa(x,i)).join("");
    return `
      <div class="card pad" id="tForm">
        <div class="grid-2">
          <div>
            <label class="label">Nombre *</label>
            <input id="fNombre" class="input" value="${escA(m.nombre)}">
          </div>
          <div>
            <label class="label">RUT *</label>
            <input id="fRUT" class="input" value="${escA(m.rut)}" placeholder="12.345.678-9">
          </div>
          <div>
            <label class="label">Contacto</label>
            <input id="fContacto" class="input" value="${escA(m.contactoNombre)}">
          </div>
          <div>
            <label class="label">Teléfono</label>
            <input id="fTelefono" class="input" value="${escA(m.telefono)}" placeholder="+56 9 …">
          </div>
          <div>
            <label class="label">Email</label>
            <input id="fEmail" class="input" value="${escA(m.email)}" placeholder="correo@dominio.cl">
          </div>
          <div>
            <label class="label">Área de operación</label>
            <select id="fArea" class="input">
              ${AREAS.map(a=>`<option value="${escA(a)}" ${a===m.areaOperacion?"selected":""}>${esc(a)}</option>`).join("")}
            </select>
          </div>
          <div class="row center" style="gap:12px">
            <label class="checkbox"><input type="checkbox" id="fSimple" ${m.soportaSimple?"checked":""}> Camión simple</label>
            <label class="checkbox"><input type="checkbox" id="fCarro" ${m.soportaCarro?"checked":""}> Con carro</label>
          </div>
        </div>

        <div class="divider" style="margin:16px 0"></div>

        <div class="row between center">
          <h4 style="margin:0">Tarifas por origen</h4>
          <button class="btn" id="tAddTarifa">+ Agregar origen</button>
        </div>

        <table class="table" style="margin-top:8px">
          <thead>
            <tr>
              <th class="th" style="width:40%">Origen</th>
              <th class="th">Precio Simple</th>
              <th class="th">Precio con Carro</th>
              <th class="th" style="width:80px"></th>
            </tr>
          </thead>
          <tbody id="tTarifasBody">
            ${filas || `<tr class="tr empty"><td class="td" colspan="4">Sin tarifas</td></tr>`}
          </tbody>
        </table>

        <div class="row end" style="gap:8px;margin-top:12px">
          <button class="btn btn-light" id="tCancel">Cancelar</button>
          <button class="btn" id="tSave">${m._id?"Guardar cambios":"Crear transportista"}</button>
        </div>
      </div>`;
  }

  function filaTarifa(x){
    return `
      <tr class="tr">
        <td class="td"><input class="input tOrigen" value="${escA(x.origen||"")}" placeholder="Ancud, Calbuco…"></td>
        <td class="td"><input class="input tPS" type="number" min="0" step="1000" value="${escA(x.precioSimple||0)}"></td>
        <td class="td"><input class="input tPC" type="number" min="0" step="1000" value="${escA(x.precioCarro||0)}"></td>
        <td class="td"><button class="btn btn-danger tDel">Eliminar</button></td>
      </tr>`;
  }

  // ====== Render principal ======
  function renderList(){
    const body = $("#tBody");
    const rows = filter(state.all, state.q);
    body.innerHTML = viewHeader() + viewTable(rows);

    $("#tSearch").value = state.q;
    $("#tSearch").addEventListener("input", (e)=>{ state.q = e.target.value||""; renderList(); });
    $("#tNew").addEventListener("click", ()=> openForm(empty()));

    $$("#tBody [data-act='edit']").forEach(b=> b.addEventListener("click", (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const m = state.all.find(x=>String(x._id)===String(id));
      if (m) openForm(JSON.parse(JSON.stringify(m)));
    }));
    $$("#tBody [data-act='del']").forEach(b=> b.addEventListener("click", async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const m = state.all.find(x=>String(x._id)===String(id));
      if (!m) return;
      if(!confirm(`Eliminar transportista "${m.nombre}"?`)) return;
      await api.del(id);
      await reload();
    }));
  }

  function filter(list, q){
    q = (q||"").toLowerCase().trim();
    if(!q) return list;
    return list.filter(t =>
      String(t.nombre||"").toLowerCase().includes(q) ||
      String(t.rut||"").toLowerCase().includes(q) ||
      (t.tarifas||[]).some(x=> String(x.origen||"").toLowerCase().includes(q))
    );
  }

  // ====== Form ======
  function openForm(m){
    const body = $("#tBody");
    body.innerHTML = viewForm(m);

    $("#tCancel").addEventListener("click", renderList);
    $("#tAddTarifa").addEventListener("click", ()=>{
      const tb = $("#tTarifasBody");
      if ($(".empty", tb)) tb.innerHTML = "";
      const tmp = document.createElement("tbody");
      tmp.innerHTML = filaTarifa({origen:"",precioSimple:0,precioCarro:0});
      tb.appendChild(tmp.firstElementChild);
    });
    $("#tTarifasBody").addEventListener("click",(e)=>{
      const btn = e.target.closest(".tDel"); if(!btn) return;
      btn.closest("tr")?.remove();
      const tb = $("#tTarifasBody");
      if (!tb.querySelector("tr")) tb.innerHTML = `<tr class="tr empty"><td class="td" colspan="4">Sin tarifas</td></tr>`;
    });

    $("#tSave").addEventListener("click", async ()=>{
      const model = collect();
      if(!model.nombre || !model.rut){ alert("Nombre y RUT son obligatorios."); return; }
      if(!model.soportaCarro){
        model.tarifas = (model.tarifas||[]).map(x=>({...x, precioCarro:0}));
      }
      if(model._id) await api.update(model._id, model); else await api.create(model);
      await reload();
    });

    function collect(){
      const out = m._id ? {...m} : empty();
      out.nombre = $("#fNombre").value.trim();
      out.rut = $("#fRUT").value.trim();
      out.contactoNombre = $("#fContacto").value.trim();
      out.telefono = $("#fTelefono").value.trim();
      out.email = $("#fEmail").value.trim();
      out.areaOperacion = $("#fArea").value;
      out.soportaSimple = $("#fSimple").checked;
      out.soportaCarro = $("#fCarro").checked;
      const tarifas=[];
      $$("#tTarifasBody tr").forEach(tr=>{
        const origen = $(".tOrigen",tr)?.value.trim();
        const precioSimple = Number($(".tPS",tr)?.value||0);
        const precioCarro  = Number($(".tPC",tr)?.value||0);
        if(origen) tarifas.push({origen, precioSimple, precioCarro});
      });
      out.tarifas = tarifas;
      return out;
    }
  }

  // ====== Carga ======
  async function reload(){
    const data = await api.get();
    state.all = Array.isArray(data) ? data : [];
    renderList();
  }

  // ====== API global: abrir panel desde nav.jsx ======
  global.openTransportistasPanel = async function(){
    close();
    const shell = drawerShell();
    await reload();
  };

})(window);
