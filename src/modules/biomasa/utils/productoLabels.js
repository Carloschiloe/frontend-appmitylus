// Constantes y helpers de tipo de producto.
// Sin dependencias externas.

export const PRODUCT_TYPE_LABELS = {
  entero: 'Entero',
  carne: 'Carne',
  mc: 'Media Concha',
  sin_definir: 'Sin definir',
};

export const getTipoProductoLabel = (value) => (
  PRODUCT_TYPE_LABELS[String(value || '').toLowerCase()] || PRODUCT_TYPE_LABELS.sin_definir
);

export const getPreferredTipoProducto = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').toLowerCase();
    if (normalized && normalized !== 'sin_definir') return normalized;
  }
  return 'sin_definir';
};

export const getProductClass = (value) => `product-${getPreferredTipoProducto(value)}`;

export const PRODUCT_CHIP_LABELS = { entero: 'E', carne: 'C', mc: 'MC', sin_definir: 'SD' };

export const getProductChipLabel = (key) => PRODUCT_CHIP_LABELS[String(key || '').toLowerCase()] || 'SD';

export const PRODUCT_COLORS = { entero: '#3b82f6', carne: '#f87171', mc: '#34d399', sin_definir: '#cbd5e1' };
