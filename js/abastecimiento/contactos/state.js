// Estado compartido + helpers DOM
export const state = {
  listaProveedores: [],      // [{nombreOriginal, nombreNormalizado, proveedorKey}]
  proveedoresIndex: {},      // { proveedorKey: { proveedor } }
  listaCentros: [],
  contactosGuardados: [],
  dt: null,
  editId: null,
};

export const $  = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const slug = (s) => (s||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-');

export function setVal(ids, value='') {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) { el.value = value ?? ''; return el; }
  }
  const id = ids[0];
  const hidden = document.createElement('input');
  hidden.type = 'hidden'; hidden.id = id; hidden.value = value ?? '';
  document.body.appendChild(hidden);
  return hidden;
}
export function getVal(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el.value;
  }
  return '';
}
