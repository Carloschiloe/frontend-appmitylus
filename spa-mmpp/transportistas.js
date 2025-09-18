/* /spa-mmpp/transportistas.js
   Transportistas – Vista incrustada (no modal, no drawer)
   - Lista + búsqueda
   - Crear / Editar / Eliminar
   - Campos: nombre, rut, contacto, teléfono, email
   - Área de operación: Chiloé / Calbuco
   - Capacidades: camión simple / con carro
   - Tarifas por origen (precio simple / con carro)
*/
(function (global) {
  "use strict";

  // ===== Utils =====
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const esc  = (s) => String(s || "").replace(/[&<>]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]));
  const escA = (s) => String(s || "").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const nCL  = (n) => (Number(n)||0).toLocaleString("es-CL");
  const money = (n) => "$" + nCL(n);

  const AREAS = ["Chiloé","Calbuco"];
  const empty = () => ({
    _id:null,
    nombre:"", rut:"",
    contactoNombre:"", telefono:"", email:"",
    areaOperacion:"Chiloé",
    soportaSimple:true, soportaCarro:false,
    tarifas: [] // [{origen, precioSimple, precioCarro}]
  });

  // ===== API (usa MMppApi si existe, si no REST por defecto) =====
  const api = (function(){
    const a = global.MMppApi || {};
    const has = (k)=> typeof a[k] === "function";
    const BASE = "/api/transportistas";

    async function get(){
      if (has("getTransportistas")) return a.getTransportistas();
      const r = await fetch(BASE);
      return r.ok ? r.json() : [];
    }
    async function create(payload){
      if (has("createTransportista")) return a.createTransportista(payload);
      const r = await fetch(BASE, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) });
      if(!r.ok) throw new Error("No se pudo crear transportista");
      return r.json();
    }
    async function update(id, payload){
      if (has("updateTransportista")) return a.updateTransportista(id, payload);
      const r = await fetch(`${BASE}/${id}`, { method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) });
      if(!r.ok) throw new Error("No se pudo actualizar transportista");
      return r.json();
    }
    async function del(id){
      if (has("deleteTransportista")) return a.deleteTransportista(id);
      const r = await fetch(`${BASE}/${id}`, { method:"DELETE" });
      if(!r.ok) throw new Error("No se pudo eliminar transportista");
      return { ok:true };
    }
    return { get, create, update, del };
  })();

  // ===== Estado =====
  const state = { all:[], q:"" };

  // ===== Render Listado =====
  function render(){
    const host = $("#mmppTransportistas");
    if(!host) return;

    const rows = applyFilter(state.all, state.q);

    host.innerHTML = `
      <div class="row between center" style="gap:8px; margin-bottom:12px">
        <input id="tSearch" class="input" placeholder="Buscar por nombre / RUT / origen…" style="max-width:260px">
        <button id="tNew" class="btn">+ Nuevo transportista</button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Transportista</th>
            <th>RUT</th>
            <th>Contacto</th>
            <th>Área</th>
            <th>Capacidades</th>
            <th>Tarifas</th>
            <th style="width:140px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length ? rows.map(t => {
              const caps = [t.soportaSimple?"Simple":null, t.soportaCarro?"Con carro":null].filter(Boolean).join(" / ") || "—";
              const tarifas = (t.tarifas||[])
                .slice(0,2)
                .map(x => `${esc(x.origen)}: ${money(x.precioSimple||0)}${t.soportaCarro ? " / "+money(x.precioCarro||0) : ""}`)
                .join("<br>") + ((t.tarifas||[]).length>2 ? "<br><em>…</em>" : "");
              return `
                <tr>
                  <td><strong>${esc(t.nombre)}</strong><br><small>${esc(t.email||"")}</small></td>
                  <td>${esc(t.rut||"—")}</td>
                  <td>${esc(t.contactoNombre||"—")}<br><small>${esc(t.telefono||"—")}</small></td>
                  <td>${esc(t.areaOperacion||"—")}</td>
                  <td>${caps}</td>
                  <td>${tarifas || "—"}</td>
                  <td>
                    <div class="row" style="gap:6px">
                      <button class="btn btn-light" data-act="edit" data-id="${t._id}">Editar</button>
                      <button class="btn btn-danger" data-act="del" data-id="${t._id}">Eliminar</button>
                    </div>
                  </td>
                </tr>`;
            }).join("") : `<tr><td colspan="7">Sin transportistas</td></tr>`
          }
        </tbody>
      </table>
    `;

    // Wire
    $("#tSearch").value = state.q;
    $("#tSearch").addEventListener("input", (e)=>{ state.q = e.target.value || ""; render(); });
    $("#tNew").addEventListener("click", ()=> openForm(empty()));

    $$("#mmppTransportistas [data-act='edit']").forEach(b=>{
      b.addEventListener("click", ()=>{
        const id = b.getAttribute("data-id");
        const m = state.all.find(x=> String(x._id) === String(id));
        if (m) openForm(JSON.parse(JSON.stringify(m)));
      });
    });

    $$("#mmppTransportistas [data-act='del']").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const id = b.getAttribute("data-id");
        const m = state.all.find(x=> String(x._id) === String(id));
        if (!m) return;
        if (!confirm(`Eliminar transportista "${m.nombre}"?`)) return;
        await api.del(id);
        await load();
      });
    });
  }

  function applyFilter(list,q){
    q = (q||"").toLowerCase().trim();
    if(!q) return list;
    return list.filter(t =>
      String(t.nombre||"").toLowerCase().includes(q) ||
      String(t.rut||"").toLowerCase().includes(q) ||
      (t.tarifas||[]).some(x => String(x.origen||"").toLowerCase().includes(q))
    );
  }

  // ===== Formulario (crear/editar) =====
  function openForm(m){
    const host = $("#mmppTransportistas");
    host.innerHTML = `
      <div class="row between center" style="margin-bottom:8px">
        <h3 style="margin:0">${m._id ? "Editar" : "Nuevo"} transportista</h3>
        <div class="row" style="gap:8px">
          <button id="btnCancel" class="btn btn-light">Cancelar</button>
          <button id="btnSave" class="btn">${m._id ? "Guardar cambios" : "Crear"}</button>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div>
          <label class="label">Nombre *</label>
          <input id="fNombre" class="input" value="${escA(m.nombre)}" maxlength="120">
        </div>
        <div>
          <label class="label">RUT *</label>
          <input id="fRUT" class="input" value="${escA(m.rut)}" maxlength="20" placeholder="12.345.678-9">
        </div>
        <div>
          <label class="label">Contacto</label>
          <input id="fContacto" class="input" value="${escA(m.contactoNombre)}" maxlength="120">
        </div>
        <div>
          <label class="label">Teléfono</label>
          <input id="fTelefono" class="input" value="${escA(m.telefono)}" maxlength="20" placeholder="+56 9…">
        </div>
        <div>
          <label class="label">Email</label>
          <input id="fEmail" class="input" value="${escA(m.email)}" maxlength="140" placeholder="correo@dominio.cl">
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
        <button id="btnAddTarifa" class="btn">+ Agregar origen</button>
      </div>

      <table class="table" style="margin-top:8px">
        <thead>
          <tr>
            <th style="width:40%">Origen</th>
            <th>Precio Simple</th>
            <th>Precio con Carro</th>
            <th style="width:90px"></th>
          </tr>
        </thead>
        <tbody id="tarifasBody">
          ${
            (m.tarifas||[]).length
              ? m.tarifas.map(rowTarifa).join("")
              : `<tr class="empty"><td colspan="4">Sin tarifas</td></tr>`
          }
        </tbody>
      </table>
    `;

    $("#btnCancel").addEventListener("click", render);
    $("#btnAddTarifa").addEventListener("click", ()=> addTarifaRow());
    $("#btnSave").addEventListener("click", onSave);

    $("#tarifasBody").addEventListener("click",(e)=>{
      const delBtn = e.target.closest(".btnDelTarifa");
      if(!delBtn) return;
      delBtn.closest("tr")?.remove();
      const tb = $("#tarifasBody");
      if (!tb.querySelector("tr")) tb.innerHTML = `<tr class="empty"><td colspan="4">Sin tarifas</td></tr>`;
    });

    function rowTarifa(x){
      return `
        <tr>
          <td><input class="input tOrigen" value="${escA(x.origen||"")}" placeholder="Ancud, Calbuco…"></td>
          <td><input class="input tPS" type="number" min="0" step="1000" value="${escA(x.precioSimple||0)}"></td>
          <td><input class="input tPC" type="number" min="0" step="1000" value="${escA(x.precioCarro||0)}"></td>
          <td><button class="btn btn-danger btnDelTarifa">Eliminar</button></td>
        </tr>`;
    }
    function addTarifaRow(){
      const tb = $("#tarifasBody");
      if ($(".empty", tb)) tb.innerHTML = "";
      const wrap = document.createElement("tbody");
      wrap.innerHTML = rowTarifa({ origen:"", precioSimple:0, precioCarro:0 });
      tb.appendChild(wrap.firstElementChild);
    }

    async function onSave(){
      const model = collect();
      if(!model.nombre || !model.rut){
        alert("Nombre y RUT son obligatorios."); return;
      }
      if(!model.soportaCarro){
        model.tarifas = (model.tarifas||[]).map(x=>({ ...x, precioCarro:0 }));
      }
      if(model._id) await api.update(model._id, model);
      else          await api.create(model);
      await load();
    }

    function collect(){
      const out = m._id ? { ...m } : empty();
      out.nombre = $("#fNombre").value.trim();
      out.rut = $("#fRUT").value.trim();
      out.contactoNombre = $("#fContacto").value.trim();
      out.telefono = $("#fTelefono").value.trim();
      out.email = $("#fEmail").value.trim();
      out.areaOperacion = $("#fArea").value;
      out.soportaSimple = $("#fSimple").checked;
      out.soportaCarro  = $("#fCarro").checked;

      const tarifas=[];
      $$("#tarifasBody tr").forEach(tr=>{
        const origen = $(".tOrigen", tr)?.value.trim();
        const precioSimple = Number($(".tPS", tr)?.value || 0);
        const precioCarro  = Number($(".tPC", tr)?.value || 0);
        if (origen) tarifas.push({ origen, precioSimple, precioCarro });
      });
      out.tarifas = tarifas;
      return out;
    }
  }

  // ===== Carga =====
  async function load(){
    const data = await api.get();
    state.all = Array.isArray(data) ? data : [];
    render();
  }

  document.addEventListener("DOMContentLoaded", load);
})(window);
