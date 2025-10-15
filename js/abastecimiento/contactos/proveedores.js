// /js/abastecimiento/contactos/proveedores.js
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

/* ========= NUEVO: seleccionar por CÓDIGO DE CENTRO =========
   - Busca el centro por su código (4–7 dígitos)
   - Setea proveedor y carga el combo de centros preseleccionando el encontrado
   - Rellena los hidden del centro
   Devuelve true si encontró/seleccionó, false si no.
*/
export function seleccionarCentroPorCodigo(code) {
  const ccode = String(code || '').trim();
  if (!/^\d{4,7}$/.test(ccode)) return false;

  const lista = Array.isArray(state.listaCentros) ? state.listaCentros : [];
  const centro = lista.find(c =>
    String(c.codigo || c.code || '').trim() === ccode
  );
  if (!centro) return false;

  // Proveedor del centro
  const provNombre = (centro.proveedor || centro.proveedorNombre || '').trim();
  const provKey = (centro.proveedorKey || slug(provNombre)).trim();

  // Rellena buscador + hidden proveedor
  const inp = document.getElementById('buscadorProveedor');
  if (inp) inp.value = provNombre;

  setVal(['proveedorNombre'], provNombre);
  setVal(['proveedorKey'], provKey);
  setVal(['proveedorId'], provKey);

  // Cargar y preseleccionar el centro encontrado
  const centroId = centro._id || centro.id || '';
  mostrarCentrosDeProveedor(provKey, centroId);

  // Hidden del centro
  setVal(['centroId'], centroId);
  setVal(['centroCodigo'], String(centro.codigo || centro.code || ''));
  setVal(['centroComuna'], centro.comuna || '');
  setVal(['centroHectareas'], centro.hectareas || centro.ha || '');

  return true;
}

export function setupBuscadorProveedores() {
  const input = $('#buscadorProveedor');
  const datalist = $('#datalistProveedores');
  if (!input || !datalist) return;

  // helper local para normalizar el nombre
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // 👉 detecta si el usuario teclea un CÓDIGO de centro en el buscador
  const intentarCodigo = (val) => {
    const txt = String(val || '').trim();
    const m = txt.match(/\b(\d{4,7})\b/);   // primer bloque 4–7 dígitos
    if (m && seleccionarCentroPorCodigo(m[1])) {
      // si encontró por código, no seguimos con el autocompletado por nombre
      return true;
    }
    return false;
  };

  input.addEventListener('input', () => {
    // primero intenta por código (no bloquea escribir, solo autoselecciona si calza)
    if (intentarCodigo(input.value)) return;

    const val = norm(input.value);
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
    // si en change hay código válido, ya habrá seleccionado todo
    if (intentarCodigo(input.value)) return;

    const valNorm = norm(input.value);
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
