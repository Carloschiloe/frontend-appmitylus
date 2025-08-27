// /js/abastecimiento/shared/materialize.js
export const toast = (html, opts = {}) => {
if (window.M?.toast) M.toast({ html, displayLength: 2500, ...opts });
};


export const getModal = (id) => {
const el = document.getElementById(id);
if (!el) return null;
return M.Modal.getInstance(el) || M.Modal.init(el);
};


export const initSelect = (elOrSel) => {
const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
if (!el) return null;
return M.FormSelect.getInstance(el) || M.FormSelect.init(el);
};