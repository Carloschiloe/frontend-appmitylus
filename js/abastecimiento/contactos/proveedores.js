import { state, $, setVal, slug } from './state.js';

export function mostrarCentrosDeProveedor(proveedorKey, preselectCentroId = null) {
  const select = $('#selectCentro'); if (!select) return;
  const key = String(proveedorKey || '').trim();
  const centros = (state.listaCentros || []).filter(c => {
    const k = c.proveedorKey || slug(c.proveedor || '');
    return String(k) === key;
  });

  let html = `<option value="" ${!preselectCentroId ? 'selected' : ''}>Sin centro (solo contacto al proveedor)</option>`;
  html += centros.map(c => {
    const id = c._id || c.id || '';
    const code = c.code || c.codigo || '';
    const comuna = c.comuna || '';
    const hect   = (c.hectareas ?? '');
    const sel = preselectCentroId && String(preselectCentroId) === String(id) ? 'selected' : '';
    return `<option ${sel} value="${id}" data-code="${code}" data-comuna="${comuna}" data-hect="${hect}">
      ${code} – ${comuna || 's/comuna'} (${hect || '-'} ha)
    </option>`;
  }).join('');
  select.innerHTML = html; 
  select.disabled = false;

  select.onchange = () => {
    const o = select.options[select.selectedIndex];
    setVal(['centroId'], select.value || '');
    setVal(['centroCodigo'], o?.dataset?.code || '');
    setVal(['centroComuna'], o?.dataset?.comuna || '');
    setVal(['centroHectareas'], o?.dataset?.hect || '');
  };
}

export function resetSelectCentros(){
  const select = $('#selectCentro'); if (!select) return;
  select.innerHTML = `<option value="" selected>Sin centro (solo contacto al proveedor)</option>`;
  select.disabled = true;
  setVal(['centroId'],''); 
  setVal(['centroCodigo'],''); 
  setVal(['centroComuna'],''); 
  setVal(['centroHectareas'],'');
}

export function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    datalist.innerHTML = '';
    if (!val) return;
    const filtrados = (state.listaProveedores || []).filter(p => p.nombreNormalizado.includes(val));
    filtrados.slice(0, 20).forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.nombreOriginal;
      datalist.appendChild(opt);
    });
  });

  input.addEventListener('change', () => {
    const valNorm = input.value.toLowerCase().replace(/\s+/g, ' ').trim();
    const prov = (state.listaProveedores || []).find(p => p.nombreNormalizado === valNorm);
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

export function syncHiddenFromSelect(selectEl){
  const sel = selectEl || document.getElementById('selectCentro');
  if (!sel) return;
  const o = sel.options[sel.selectedIndex];
  setVal(['centroId'], sel.value || '');
  setVal(['centroCodigo'], o?.dataset?.code || '');
  setVal(['centroComuna'], o?.dataset?.comuna || '');
  setVal(['centroHectareas'], o?.dataset?.hect || '');
}
