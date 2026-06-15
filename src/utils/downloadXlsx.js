const API_BASE = '/api';

/**
 * Descarga un Excel desde un endpoint GET del backend.
 * Maneja auth cookie + header x-tenant-db automáticamente.
 *
 * @param {string} path   - Ruta relativa, ej: '/exportar/muestreos'
 * @param {string} filename - Nombre del archivo descargado, ej: 'muestreos_2026-06.xlsx'
 * @param {Record<string,string>} [params] - Query params opcionales
 */
export async function downloadXlsx(path, filename, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  ).toString();

  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'x-tenant-db': localStorage.getItem('selected_tenant_db') || '' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Error ${response.status} al exportar`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
