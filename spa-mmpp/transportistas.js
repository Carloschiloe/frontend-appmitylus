/* /spa-mmpp/transportistas.js
   Gestión de Transportistas – MMPP
   - Lista con búsqueda rápida
   - Crear / Editar / Eliminar
   - Campos: nombre, rut, contacto, teléfono, email, área (Chiloé/Calbuco),
             soporta camión simple / con carro
   - Tarifas por origen: { origen, precioSimple, precioCarro }
*/
(function (global) {
  "use strict";

  // ===== Utils =====
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const numeroCL = (n) => (Number(n) || 0).toLocaleString("es-CL");
  const money = (n) => "$" + numeroCL(n);
  const telFmt = (s) => String(s || "").replace(/\D+/g, "").replace(/^56/, "+56 ");

  const AREAS = ["Chiloé", "Calbuco"];
  const vacioTransportista = () => ({
    _id: null,
    nombre: "",
    rut: "",
    contactoNombre: "",
    telefono: "",
    email: "",
    areaOperacion: "Chiloé",
    soportaSimple: true,
    soportaCarro: false,
    tarifas: [], // [{origen:'Ancud', precioSimple:0, precioCarro:0}]
  });

  // ===== API (usa tu MMppApi si existe) =====
  const api = (function useApi() {
    const a = global.MMppApi || {};
    // Endpoints esperados:
    // - getTransportistas(): Promise<array>
    // - createTransportista(payload): Promise<obj>
    // - updateTransportista(id, payload): Promise<obj>
    // - deleteTransportista(id): Promise<{ok:true}>
    //
    // Si no existen, caemos a fetch básicos en /api/transportistas
    const base = "/api/transportistas";
    const has = (fn) => typeof a[fn] === "function";

    async function getTransportistas() {
      if (has("getTransportistas")) return a.getTransportistas();
      const r = await fetch(base);
      return r.ok ? r.json() : [];
    }
    async function createTransportista(payload) {
      if (has("createTransportista")) return a.createTransportista(payload);
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al crear");
      return r.json();
    }
    async function updateTransportista(id, payload) {
      if (has("updateTransportista")) return a.updateTransportista(id, payload);
      const r = await fetch(`${base}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al actualizar");
      return r.json();
    }
    async function deleteTransportista(id) {
      if (has("deleteTransportista")) return a.deleteTransportista(id);
      const r = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al eliminar");
      return { ok: true };
    }
    return { getTransportistas, createTransportista, updateTransportista, deleteTransportista };
  })();

  // ===== Estado =====
  const state = {
    all: [],
    filtered: [],
    editing: null, // objeto en edición
    query: "",
  };

  // ===== Plantillas =====
  function tplHeader(mmKey) {
    return `
      <div class="card pad" style="margin-bottom:12px">
        <div class="row between center">
          <h2 style="margin:0;font-weight:800">🚚 Transportistas</h2>
          <div class="row center" style="gap:8px">
            <input id="qTransportistas" class="input" placeholder="Buscar por nombre/origen…" style="min-width:240px">
            <button id="btnNuevoTransportista" class="btn">+ Nuevo</button>
          </div>
        </div>
      </div>
    `;
  }

  function tplTable(rows) {
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
              rows.length
                ? rows
                    .map((t) => {
                      const caps = [
                        t.soportaSimple ? "Simple" : null,
                        t.soportaCarro ? "Con carro" : null,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—";
                      const tarifasResumen =
                        (t.tarifas || [])
                          .slice(0, 2)
                          .map(
                            (x) =>
                              `${x.origen}: ${
                                t.soportaCarro
                                  ? `${money(x.precioSimple || 0)} / ${money(x.precioCarro || 0)}`
                                  : `${money(x.precioSimple || 0)}`
                              }`
                          )
                          .join("<br>") +
                        ((t.tarifas || []).length > 2 ? "<br><em>…</em>" : "") ||
                        "—";
                      return `
                        <tr class="tr">
                          <td class="td"><strong>${esc(t.nombre)}</strong><br><small>${esc(
                        t.email || ""
                      )}</small></td>
                          <td class="td">${esc(t.rut || "—")}</td>
                          <td class="td">${esc(t.contactoNombre || "—")}<br><small>${esc(
                        t.telefono ? telFmt(t.telefono) : "—"
                      )}</small></td>
                          <td class="td">${esc(t.areaOperacion || "—")}</td>
                          <td class="td">${caps}</td>
                          <td class="td">${tarifasResumen}</td>
                          <td class="td">
                            <div class="row" style="gap:6px">
                              <button class="btn btn-light" data-act="edit" data-id="${t._id}">Editar</button>
                              <button class="btn btn-danger" data-act="del" data-id="${t._id}">Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr class="tr"><td class="td" colspan="7">Sin transportistas</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function tplModal(t) {
    const tarifas = (t.tarifas || []).map((x, i) => tplTarifaRow(x, i)).join("");
    return `
      <div class="modal-backdrop" id="modalBackdrop"></div>
      <div class="modal" id="modalTransportista" role="dialog" aria-modal="true">
        <div class="modal-header row between center">
          <h3 style="margin:0">${t._id ? "Editar" : "Nuevo"} transportista</h3>
          <button class="btn btn-light" id="btnCerrarModal">Cerrar</button>
        </div>
        <div class="modal-body">
          <div class="grid" style="grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px">
            <div>
              <label class="label">Nombre *</label>
              <input id="fNombre" class="input" value="${escAttr(t.nombre)}" maxlength="120">
            </div>
            <div>
              <label class="label">RUT *</label>
              <input id="fRUT" class="input" value="${escAttr(t.rut)}" maxlength="20" placeholder="12.345.678-9">
            </div>
            <div>
              <label class="label">Contacto</label>
              <input id="fContacto" class="input" value="${escAttr(t.contactoNombre)}" maxlength="120">
            </div>
            <div>
              <label class="label">Teléfono</label>
              <input id="fTelefono" class="input" value="${escAttr(t.telefono)}" maxlength="20" placeholder="+56 9…">
            </div>
            <div>
              <label class="label">Email</label>
              <input id="fEmail" class="input" value="${escAttr(t.email)}" maxlength="140" placeholder="correo@dominio.cl">
            </div>
            <div>
              <label class="label">Área de operación</label>
              <select id="fArea" class="input">
                ${AREAS.map(
                  (a) => `<option value="${escAttr(a)}" ${a === t.areaOperacion ? "selected" : ""}>${esc(a)}</option>`
                ).join("")}
              </select>
            </div>
            <div class="row center" style="gap:12px">
              <label class="checkbox"><input type="checkbox" id="fSimple" ${t.soportaSimple ? "checked" : ""}> Camión simple</label>
              <label class="checkbox"><input type="checkbox" id="fCarro" ${t.soportaCarro ? "checked" : ""}> Con carro</label>
            </div>
          </div>

          <div class="divider" style="margin:16px 0"></div>

          <div class="row between center">
            <h4 style="margin:0">Tarifas por origen</h4>
            <button class="btn" id="btnAddTarifa">+ Agregar origen</button>
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
            <tbody id="tarifasBody">
              ${tarifas || `<tr class="tr empty"><td class="td" colspan="4">Sin tarifas</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="modal-footer row end" style="gap:8px">
          <button class="btn btn-light" id="btnCancelar">Cancelar</button>
          <button class="btn" id="btnGuardar">Guardar</button>
        </div>
      </div>
    `;
  }

  function tplTarifaRow(x, i) {
    return `
      <tr class="tr" data-i="${i}">
        <td class="td"><input class="input tOrigen" value="${escAttr(x.origen || "")}" placeholder="Ancud, Calbuco…"></td>
        <td class="td"><input class="input tPS" type="number" min="0" step="1000" value="${escAttr(
          x.precioSimple || 0
        )}"></td>
        <td class="td"><input class="input tPC" type="number" min="0" step="1000" value="${escAttr(
          x.precioCarro || 0
        )}"></td>
        <td class="td"><button class="btn btn-danger btnDelTarifa">Eliminar</button></td>
      </tr>
    `;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escAttr(s) {
    return String(s || "")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ===== Render =====
  function render() {
    const host = document.getElementById("mmppTransportistas");
    if (!host) return;

    const rows = applyFilter(state.all, state.query);

    host.innerHTML = tplHeader() + tplTable(rows);

    // Wire header
    $("#btnNuevoTransportista", host)?.addEventListener("click", () => openModal(vacioTransportista()));
    $("#qTransportistas", host)?.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      render();
    });

    // Wire acciones
    $$("#mmppTransportistas [data-act='edit']", host).forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const t = state.all.find((x) => String(x._id) === String(id));
        if (t) openModal(JSON.parse(JSON.stringify(t)));
      })
    );
    $$("#mmppTransportistas [data-act='del']", host).forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const t = state.all.find((x) => String(x._id) === String(id));
        if (!t) return;
        if (!confirm(`Eliminar transportista "${t.nombre}"?`)) return;
        await api.deleteTransportista(id);
        await load();
      })
    );
  }

  function applyFilter(list, q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => {
      const hayTarifa = (t.tarifas || []).some((x) => String(x.origen || "").toLowerCase().includes(q));
      return (
        String(t.nombre || "").toLowerCase().includes(q) ||
        String(t.rut || "").toLowerCase().includes(q) ||
        hayTarifa
      );
    });
  }

  // ===== Modal =====
  function openModal(model) {
    closeModal(); // por si acaso
    state.editing = model;

    const shell = document.createElement("div");
    shell.id = "modalShell";
    shell.innerHTML = tplModal(model);
    document.body.appendChild(shell);

    // Eventos básicos
    $("#btnCerrarModal")?.addEventListener("click", closeModal);
    $("#btnCancelar")?.addEventListener("click", closeModal);
    $("#btnGuardar")?.addEventListener("click", onSave);

    $("#btnAddTarifa")?.addEventListener("click", () => addTarifaRow());

    // Delegación: borrar filas tarifas
    $("#tarifasBody")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".btnDelTarifa");
      if (!btn) return;
      const tr = btn.closest("tr");
      tr?.remove();
      if (!$("#tarifasBody .tr")) {
        $("#tarifasBody").innerHTML = `<tr class="tr empty"><td class="td" colspan="4">Sin tarifas</td></tr>`;
      }
    });

    // Cerrar al click afuera
    $("#modalBackdrop")?.addEventListener("click", closeModal);
  }

  function addTarifaRow(data) {
    const body = $("#tarifasBody");
    if (!body) return;
    if ($(".empty", body)) body.innerHTML = ""; // limpia fila empty
    const i = $$(".tr", body).length;
    const row = document.createElement("tbody"); // contenedor temporal
    row.innerHTML = tplTarifaRow(
      data || {
        origen: "",
        precioSimple: 0,
        precioCarro: 0,
      },
      i
    );
    body.appendChild(row.firstElementChild);
  }

  function collectForm() {
    const m = state.editing ? { ...state.editing } : vacioTransportista();
    m.nombre = $("#fNombre").value.trim();
    m.rut = $("#fRUT").value.trim();
    m.contactoNombre = $("#fContacto").value.trim();
    m.telefono = $("#fTelefono").value.trim();
    m.email = $("#fEmail").value.trim();
    m.areaOperacion = $("#fArea").value;
    m.soportaSimple = $("#fSimple").checked;
    m.soportaCarro = $("#fCarro").checked;

    const tarifas = [];
    $$("#tarifasBody tr").forEach((tr) => {
      const origen = $(".tOrigen", tr)?.value.trim();
      const precioSimple = Number($(".tPS", tr)?.value || 0);
      const precioCarro = Number($(".tPC", tr)?.value || 0);
      if (origen) tarifas.push({ origen, precioSimple, precioCarro });
    });
    m.tarifas = tarifas;

    return m;
  }

  async function onSave() {
    // Validación mínima
    const m = collectForm();
    if (!m.nombre || !m.rut) {
      alert("Nombre y RUT son obligatorios.");
      return;
    }
    // Si no soporta carro, forzar precioCarro = 0
    if (!m.soportaCarro) {
      m.tarifas = (m.tarifas || []).map((x) => ({ ...x, precioCarro: 0 }));
    }

    if (m._id) await api.updateTransportista(m._id, m);
    else await api.createTransportista(m);

    await load();
    closeModal();
  }

  function closeModal() {
    $("#modalShell")?.remove();
    state.editing = null;
  }

  // ===== Carga inicial =====
  async function load() {
    const data = await api.getTransportistas();
    state.all = Array.isArray(data) ? data : [];
    render();
  }

  // ===== Estilos mínimos de modal (apoya tus CSS) =====
  const style = document.createElement("style");
  style.textContent = `
    .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.25);backdrop-filter:saturate(120%) blur(1px);z-index:998}
    .modal{position:fixed;inset:auto 0 0 0; margin:auto; top:6vh; max-height:88vh; width:min(940px,92vw);
           background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:999;display:flex;flex-direction:column}
    .modal-header,.modal-footer{padding:12px 16px}
    .modal-body{padding:8px 16px;overflow:auto}
    .divider{height:1px;background:var(--border,#e5e7eb)}
  `;
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", load);
})(window);
