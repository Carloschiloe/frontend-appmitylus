import { state, $, setVal, slug } from './state.js';

export function mostrarCentrosDeProveedor(proveedorKey, preselectCentroId = null) {
  const select = $('#selectCentro'); if (!select) return;
  const centros = state.listaCentros.filter(c => (c.proveedorKey?.length ? c.proveedorKey : slug(c.proveedor||'')) === proveedorKey);

  let html = `<option value="" ${!preselectCentroId ? 'selected' : ''}>Sin centro (solo contacto al proveedor)</option>`;
  html += centros.map(c => {
    const id = (c._id || c.id);
    const sel = preselectCentroId && String(preselectCentroId) === String(id) ? 'selected' : '';
    return `<option ${sel} value="${id}" data-code="${c.code || c.codigo || ''}" data-comuna="${c.comuna || ''}" data-hect="${c.hectareas ?? ''}">
      ${c.code || c.codigo || ''} – ${c.comuna || 's/comuna'} (${c.hectareas ?? '-'} ha)
    </option>`;
  }).join('');
  select.innerHTML = html; select.disabled = false;

  const opt = select.options[select.selectedIndex];
  setVal(['centroId'], opt?.value || '');
  setVal(['centroCode','centroCodigo'], opt?.dataset?.code || '');
  setVal(['centroComuna'], opt?.dataset?.comuna || '');
  setVal(['centroHectareas'], opt?.dataset?.hect || '');

  select.onchange = () => {
    const o = select.options[select.selectedIndex];
    setVal(['centroId'], o.value || '');
    setVal(['centroCode','centroCodigo'], o.dataset.code || '');
    setVal(['centroComuna'], o.dataset.comuna || '');
    setVal(['centroHectareas'], o.dataset.hect || '');
  };
}

export function resetSelectCentros(){
  const select = $('#selectCentro'); if (!select) return;
  select.innerHTML = `<option value="" selected>Sin centro (solo contacto al proveedor)</option>`;
  select.disabled = true;
  setVal(['centroId'],''); setVal(['centroCode','centroCodigo'],''); setVal(['centroComuna'],''); setVal(['centroHectareas'],'');
}

export function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    datalist.innerHTML = '';
    if (!val) return;
    const filtrados = state.listaProveedores.filter(p => p.nombreNormalizado.includes(val));
    filtrados.slice(0, 20).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombreOriginal;
      datalist.appendChild(opt);
    });
  });

  input.addEventListener('change', () => {
    const valNorm = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    const prov = state.listaProveedores.find(p => p.nombreNormalizado === valNorm);
    if (prov) {
      setVal(['proveedorKey','proveedorId'], prov.proveedorKey);
      setVal(['proveedorNombre'], prov.nombreOriginal);
      mostrarCentrosDeProveedor(prov.proveedorKey);
    } else {
      setVal(['proveedorKey','proveedorId'], '');
      setVal(['proveedorNombre'], '');
      resetSelectCentros();
    }
  });
}
