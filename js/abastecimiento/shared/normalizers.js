// /js/abastecimiento/shared/normalizers.js
export const toId = (v) => {
if (!v) return '';
if (typeof v === 'string') {
const m = v.match(/ObjectId\(["']?([0-9a-fA-F]{24})["']?\)/);
return m?.[1] ?? v;
}
if (typeof v === 'object') return toId(v.$oid || v._id || v.id || '');
return '';
};


export const centroCodigoById = (id, lista = []) => {
const x = lista.find(c => toId(c._id ?? c.id) === toId(id));
return x ? (x.code || x.codigo || x.Codigo || '') : '';
};